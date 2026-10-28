import React, { useEffect, useState, useCallback } from "react";
import {
  fetchOnlineStoreOrdersPage,
  isOnlineStoreAuthenticated,
  loginOnlineStore,
  type StoreOrder,
} from "../../api/onlineStoreOrders";
import { ORDER_STATUS, STATUS_LABELS } from "../../constants/onlineStoreOrderStatus";
import { useOnlineStoreConfig } from "../../hooks/useOnlineStoreConfig";
import OnlineSaleDetailModal from "./OnlineSaleDetailModal";
import "../../styles/pages/sales/onlineSalesModal.css";

interface OnlineSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opcional: cargar el pedido al carrito para cobrarlo. Si no se pasa, el modal es solo lectura. */
  onSelect?: (order: StoreOrder) => void;
}

const money = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Fecha y hora en zona horaria de México.
const dateTimeMx = (v?: string | null) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

// Semáforo por estado de entrega.
const statusBadge = (status: string) => {
  if (status === ORDER_STATUS.IN_TRANSIT) return "🚚";
  return "📍"; // READY_FOR_PICKUP
};

/**
 * Vista de pedidos de la tienda online listos para entregar.
 *
 * Lista (solo lectura) los pedidos en estado READY_FOR_PICKUP (listo para
 * recoger) e IN_TRANSIT (en camino), consultando la API de la tienda online
 * (misma fuente que el módulo Tienda online → Pedidos). El cobro/entrega no se
 * realiza aquí todavía (fuera de alcance de esta etapa).
 */
const OnlineSalesModal: React.FC<OnlineSalesModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { username: configUsername, config } = useOnlineStoreConfig();
  const storeName = config?.storeName ?? null;
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean>(false);
  const [detailOrder, setDetailOrder] = useState<StoreOrder | null>(null);

  // Estado del formulario de login (visible cuando no hay sesión en la tienda online).
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const load = useCallback(async () => {
    // Requiere sesión en la tienda online (token propio).
    if (!isOnlineStoreAuthenticated()) {
      setAuthed(false);
      setOrders([]);
      return;
    }
    setAuthed(true);
    setLoading(true);
    setError(null);
    try {
      // Pedidos listos para entregar: recoger en tienda + envío en camino.
      const [ready, transit] = await Promise.all([
        fetchOnlineStoreOrdersPage(ORDER_STATUS.READY_FOR_PICKUP, 1, 100),
        fetchOnlineStoreOrdersPage(ORDER_STATUS.IN_TRANSIT, 1, 100),
      ]);
      const merged = [
        ...(ready?.orders ?? []),
        ...(transit?.orders ?? []),
      ].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(merged);
    } catch (e) {
      console.error("Error al cargar pedidos en línea:", e);
      // Conserva la última lista; muestra un aviso no intrusivo.
      setError("No se pudieron cargar los pedidos en línea. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // Precarga el email con el usuario de la config (salvo que el cajero ya escribió).
  useEffect(() => {
    if (isOpen && !emailTouched && configUsername) {
      setLoginEmail(configUsername);
    }
  }, [isOpen, configUsername, emailTouched]);

  // Al cerrar, limpia el formulario (el email vuelve al usuario de la config).
  useEffect(() => {
    if (!isOpen) {
      setLoginEmail(configUsername ?? "");
      setLoginPassword("");
      setEmailTouched(false);
      setLoginError(null);
      setLoginLoading(false);
    }
  }, [isOpen, configUsername]);

  // Inicia sesión en la tienda online y, si tiene éxito, carga los pedidos.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Ingresá usuario y contraseña.");
      return;
    }
    setLoginLoading(true);
    try {
      await loginOnlineStore(loginEmail.trim(), loginPassword);
      setLoginPassword("");
      setEmailTouched(false);
      await load(); // ya autenticado → trae los pedidos
    } catch (err: any) {
      setLoginError(
        err?.message || "No se pudo iniciar sesión. Verificá los datos."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="onl-overlay" onClick={onClose} role="presentation">
        <div
          className="onl-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onl-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="onl-header">
            <h2 id="onl-title" className="onl-title">🌐 Cobrar en línea</h2>
            <div className="onl-header-actions">
              {authed && (
                <button
                  className="onl-refresh"
                  onClick={load}
                  disabled={loading}
                  title="Actualizar"
                  type="button"
                >
                  {loading ? "🔄 ..." : "🔄 Actualizar"}
                </button>
              )}
              <button className="onl-close" onClick={onClose} aria-label="Cerrar" type="button">
                ✕
              </button>
            </div>
          </div>

          <div className="onl-body">
            {!authed ? (
              <div className="onl-login">
                <div className="onl-login-icon">🔒</div>
                <h3 className="onl-login-title">Iniciar sesión en la tienda online</h3>
                <p className="onl-login-sub">
                  {storeName
                    ? `Tienda: ${storeName}`
                    : "Ingresá tus credenciales para ver los pedidos listos para entregar."}
                </p>

                <form className="onl-login-form" onSubmit={handleLogin}>
                  <div className="onl-login-field">
                    <label htmlFor="onl-login-email">Usuario</label>
                    <input
                      id="onl-login-email"
                      type="email"
                      autoComplete="username"
                      value={loginEmail}
                      placeholder="usuario@tienda.com"
                      onChange={(e) => {
                        setEmailTouched(true);
                        setLoginEmail(e.target.value);
                      }}
                      disabled={loginLoading}
                    />
                  </div>

                  <div className="onl-login-field">
                    <label htmlFor="onl-login-password">Contraseña</label>
                    <input
                      id="onl-login-password"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      placeholder="Tu contraseña"
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loginLoading}
                    />
                  </div>

                  {loginError && <div className="onl-login-error">⚠️ {loginError}</div>}

                  <button
                    type="submit"
                    className="onl-login-btn"
                    disabled={loginLoading}
                  >
                    {loginLoading ? "Iniciando sesión..." : "Iniciar sesión"}
                  </button>
                </form>
              </div>
            ) : error ? (
              <div className="onl-empty onl-error">
                <div className="onl-empty-icon">⚠️</div>
                <p className="onl-empty-title">Error</p>
                <p className="onl-empty-text">{error}</p>
              </div>
            ) : loading ? (
              <div className="onl-empty">
                <div className="onl-spinner" />
                <p className="onl-empty-text">Cargando pedidos...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="onl-empty">
                <div className="onl-empty-icon">📦</div>
                <p className="onl-empty-title">No hay pedidos listos</p>
                <p className="onl-empty-text">
                  Los pedidos de la tienda online listos para entregar aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="onl-list">
                {orders.map((order) => {
                  const clientName = order.user?.name || order.user?.email || "Cliente";
                  const itemCount = order.items?.length ?? 0;
                  return (
                    <div key={order.id} className="onl-card">
                      <div className="onl-card-top">
                        <span className="onl-folio">
                          Folio {order.id}
                        </span>
                        <span
                          className="onl-status"
                          title={STATUS_LABELS[order.status] || order.status}
                        >
                          {statusBadge(order.status)}{" "}
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>

                      <div className="onl-total-row">
                        <span className="onl-total">{money(order.total)}</span>
                      </div>

                      <div className="onl-meta-line">
                        <span className="onl-meta-sub">
                          {itemCount} {itemCount === 1 ? "producto" : "productos"}
                        </span>
                        <span className="onl-client" title={clientName}>
                          · {clientName}
                        </span>
                        <span className="onl-meta-date">
                          {dateTimeMx(order.createdAt)}
                        </span>
                      </div>

                      <div className="onl-actions">
                        <button
                          className="onl-ghost-btn"
                          onClick={() => setDetailOrder(order)}
                          type="button"
                        >
                          👁 Ver
                        </button>
                        {onSelect && (
                          <button
                            className="onl-primary-btn"
                            onClick={() => onSelect(order)}
                            type="button"
                          >
                            Cargar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="onl-footer">
            <button type="button" className="onl-btn-close" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <OnlineSaleDetailModal
        isOpen={detailOrder !== null}
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
      />
    </>
  );
};

export default OnlineSalesModal;
