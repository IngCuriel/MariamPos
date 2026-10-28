import React, { useCallback, useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import Swal from "sweetalert2";
import {
  getOnlineStoreConfig,
  saveOnlineStoreConfig,
} from "../../api/onlineStoreConfig";
import type {
  OnlineStoreConfig,
  OnlineStoreConfigPayload,
} from "../../api/onlineStoreConfig";
import "../../styles/pages/sales/onlineStoreConfigModal.css";

interface OnlineStoreConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Editable form state. The password is write-only: it always starts empty, even
 * when a credential already exists, and is only sent when the admin types one.
 */
interface FormState {
  enabled: boolean;
  apiUrl: string;
  username: string;
  password: string;
}

const EMPTY_FORM: FormState = {
  enabled: false,
  apiUrl: "",
  username: "",
  password: "",
};

/** Maps a loaded config into the non-sensitive form fields (password stays empty). */
const toForm = (config: OnlineStoreConfig | null): FormState => ({
  enabled: config?.enabled ?? false,
  apiUrl: config?.apiUrl ?? "",
  username: config?.username ?? "",
  password: "", // write-only: never prefilled
});

const OnlineStoreConfigModal: React.FC<OnlineStoreConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  // The modal always operates on the current terminal's branch (Req 5.2).
  const branch = localStorage.getItem("sucursal") ?? "";

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loads the branch config and preloads the non-sensitive fields (Req 5.3).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await getOnlineStoreConfig(branch);
      setForm(toForm(config));
      setHasStoredPassword(Boolean(config?.hasPassword));
    } catch (e) {
      console.error("Error al cargar la configuración de tienda online:", e);
      setError("No se pudo cargar la configuración. Intente de nuevo.");
      setForm(EMPTY_FORM);
      setHasStoredPassword(false);
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!branch) {
      Swal.fire({
        icon: "warning",
        title: "Sucursal no definida",
        text: "No se encontró la sucursal de la terminal actual.",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#f59e0b",
      });
      return;
    }

    // Build the upsert payload with the non-sensitive fields (Req 5.5).
    // El nombre de la tienda es el mismo que la sucursal: se guarda desde `branch`
    // (ya no se captura en un campo aparte del formulario).
    //
    // La URL del API es solo el dominio base (ej. https://mariam-pos-web-api.onrender.com/api).
    // Los endpoints concretos (/orders, /auth/login, /products, etc.) están
    // hardcodeados en el código cliente (ver api/onlineStoreOrders.ts), por lo
    // que `productsEndpoint` y `salesEndpoint` ya no se capturan y se guardan
    // como null; las columnas se conservan en el schema por compatibilidad.
    const payload: OnlineStoreConfigPayload = {
      branch,
      enabled: form.enabled,
      apiUrl: form.apiUrl.trim() || null,
      storeName: branch,
      username: form.username.trim() || null,
      productsEndpoint: null,
      salesEndpoint: null,
    };

    // Attach the password only when the admin typed one; leaving it empty keeps
    // the previously stored credential (Req 5.6).
    if (form.password.trim() !== "") {
      payload.password = form.password;
    }

    setSaving(true);
    try {
      const saved = await saveOnlineStoreConfig(payload);
      // Reflect the saved state and clear the write-only password field.
      setForm(toForm(saved));
      setHasStoredPassword(Boolean(saved.hasPassword));
      Swal.fire({
        icon: "success",
        title: "✅ Configuración guardada",
        text: "Los datos de la tienda online se guardaron correctamente.",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (e: any) {
      console.error("Error al guardar la configuración de tienda online:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          e?.response?.data?.error ||
          e?.message ||
          "No se pudo guardar la configuración.",
        confirmButtonText: "Entendido",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const passwordPlaceholder = hasStoredPassword
    ? "Dejar vacío para conservar la actual"
    : "Contraseña de la tienda online";

  return (
    <div className="osc-overlay" onClick={onClose} role="presentation">
      <div
        className="osc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="osc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="osc-header">
          <h2 id="osc-title" className="osc-title">
            🛒 Configuración de Tienda Online
          </h2>
          <button className="osc-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="osc-body">
          <p className="osc-branch">
            Sucursal: <strong>{branch || "— sin definir —"}</strong>
          </p>

          {error && <div className="osc-error">{error}</div>}

          {loading ? (
            <div className="osc-loading">Cargando configuración...</div>
          ) : (
            <form
              className="osc-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <label className="osc-switch-row" htmlFor="osc-enabled">
                <span className="osc-switch-label">Tienda online habilitada</span>
                <span className="osc-switch">
                  <input
                    id="osc-enabled"
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setField("enabled", e.target.checked)}
                  />
                  <span className="osc-slider" aria-hidden="true" />
                </span>
              </label>

              <div className="osc-field">
                <label htmlFor="osc-apiUrl">Dominio del API</label>
                <input
                  id="osc-apiUrl"
                  type="text"
                  value={form.apiUrl}
                  placeholder="https://mariam-pos-web-api.onrender.com/api"
                  onChange={(e) => setField("apiUrl", e.target.value)}
                />
                <span className="osc-hint">
                  Solo el dominio base del API (incluí el sufijo <code>/api</code>).
                  Las rutas internas (pedidos, login, productos) ya están
                  configuradas en el sistema.
                </span>
              </div>

              <div className="osc-field">
                <label htmlFor="osc-username">Usuario</label>
                <input
                  id="osc-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  placeholder="usuario@tienda.com"
                  onChange={(e) => setField("username", e.target.value)}
                />
              </div>

              <div className="osc-field">
                <label htmlFor="osc-password">Contraseña</label>
                <input
                  id="osc-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  placeholder={passwordPlaceholder}
                  onChange={(e) => setField("password", e.target.value)}
                />
                <span className="osc-hint">
                  La contraseña nunca se muestra. Dejala vacía para conservar la
                  actual.
                </span>
              </div>
            </form>
          )}
        </div>

        <div className="osc-footer">
          <button type="button" className="osc-btn-close" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="osc-btn-save"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnlineStoreConfigModal;
