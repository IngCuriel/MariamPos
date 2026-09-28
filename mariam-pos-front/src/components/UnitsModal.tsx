import React, { useState, useCallback, useEffect, useRef } from "react";
import { IoClose } from "react-icons/io5";
import Swal from "sweetalert2";
import { getUnits, createUnit, updateUnit, deleteUnit } from "../api/units";
import type { UnitOfMeasure } from "../types/index";
import "../styles/components/unitsModal.css";

interface UnitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyForm = { name: "", abbreviation: "" };

// Activo si status es null o distinto de 0.
const isActive = (status?: number | null) =>
  status === null || status === undefined || status !== 0;

type View = "list" | "form";

const UnitsModal: React.FC<UnitsModalProps> = ({ isOpen, onClose }) => {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const focusName = () => setTimeout(() => nameInputRef.current?.focus(), 80);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUnits();
      setUnits(data);
    } catch (e) {
      console.error("Error al cargar unidades:", e);
      setError("No se pudieron cargar las unidades.");
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
      setView("list");
      setEditingId(null);
      setForm(emptyForm);
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setView("form");
    focusName();
  };

  const openEdit = (u: UnitOfMeasure) => {
    setEditingId(u.id);
    setForm({ name: u.name || "", abbreviation: u.abbreviation || "" });
    setView("form");
    focusName();
  };

  const backToList = () => {
    setView("list");
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Swal.fire({ icon: "warning", title: "El nombre es obligatorio", timer: 2000, showConfirmButton: false });
      return;
    }
    if (!form.abbreviation.trim()) {
      Swal.fire({ icon: "warning", title: "La abreviatura es obligatoria", timer: 2000, showConfirmButton: false });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateUnit(editingId, {
          name: form.name.trim(),
          abbreviation: form.abbreviation.trim(),
        });
      } else {
        await createUnit({
          name: form.name.trim(),
          abbreviation: form.abbreviation.trim(),
          status: 1,
        });
      }
      await load();
      backToList();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: e?.response?.data?.error || "No se pudo guardar la unidad",
        timer: 3000,
        showConfirmButton: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (u: UnitOfMeasure) => {
    const nextStatus = isActive(u.status) ? 0 : 1;
    try {
      await updateUnit(u.id, { status: nextStatus });
      await load();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: e?.response?.data?.error || "No se pudo cambiar el estado",
        timer: 3000,
        showConfirmButton: false,
      });
    }
  };

  const handleDelete = async (u: UnitOfMeasure) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar unidad",
      html: `¿Seguro que querés eliminar <strong>${u.name} (${u.abbreviation})</strong>?`,
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteUnit(u.id);
      await load();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: e?.response?.data?.error || "Error al eliminar la unidad.",
        confirmButtonText: "Entendido",
      });
    }
  };

  return (
    <div className="uom-overlay" onClick={onClose} role="presentation">
      <div
        className="uom-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="uom-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="uom-header">
          <h2 id="uom-title" className="uom-title">📏 Unidades de Medida</h2>
          <button className="uom-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="uom-body">
          {view === "form" ? (
            <div className="uom-form">
              <span className="uom-form-title">
                {editingId ? "Editar unidad" : "Nueva unidad"}
              </span>
              <label className="uom-label">Nombre</label>
              <input
                ref={nameInputRef}
                className="uom-input"
                type="text"
                value={form.name}
                placeholder="Ej: Kilogramo, Litro, Pieza"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <label className="uom-label">Abreviatura</label>
              <input
                className="uom-input"
                type="text"
                value={form.abbreviation}
                placeholder="Ej: kg, L, pza"
                onChange={(e) => setForm((f) => ({ ...f, abbreviation: e.target.value }))}
              />

              <div className="uom-form-actions">
                <button
                  type="button"
                  className="uom-btn uom-btn--ghost"
                  onClick={backToList}
                  disabled={saving}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="uom-btn uom-btn--primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="uom-list-head">
                <span className="uom-list-title">Lista de unidades</span>
                <button
                  type="button"
                  className="uom-btn uom-btn--primary uom-btn--sm"
                  onClick={openCreate}
                >
                  ➕ Crear nueva
                </button>
              </div>

              {error ? (
                <div className="uom-empty uom-error">{error}</div>
              ) : loading ? (
                <div className="uom-empty">Cargando unidades…</div>
              ) : units.length === 0 ? (
                <div className="uom-empty">
                  No hay unidades. Creá la primera con “Crear nueva”.
                </div>
              ) : (
                <div className="uom-list">
                  {units.map((u) => (
                    <div
                      key={u.id}
                      className={`uom-item ${isActive(u.status) ? "" : "uom-item--inactive"}`}
                    >
                      <div className="uom-item-text">
                        <span className="uom-item-name">{u.name}</span>
                        <span className="uom-item-abbrev">{u.abbreviation}</span>
                      </div>
                      <div className="uom-item-right">
                        <span className="uom-item-count">{u._count?.products ?? 0} prod.</span>
                        <button
                          type="button"
                          className={`uom-status-toggle ${
                            isActive(u.status) ? "uom-status-toggle--on" : "uom-status-toggle--off"
                          }`}
                          title={isActive(u.status) ? "Activo — clic para desactivar" : "Inactivo — clic para activar"}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {isActive(u.status) ? "Activo" : "Inactivo"}
                        </button>
                        <button
                          type="button"
                          className="uom-icon-btn uom-icon-btn--edit"
                          title="Editar"
                          onClick={() => openEdit(u)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="uom-icon-btn uom-icon-btn--delete"
                          title="Eliminar"
                          onClick={() => handleDelete(u)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {view === "list" && (
          <div className="uom-footer">
            <button type="button" className="uom-btn-close" onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnitsModal;
