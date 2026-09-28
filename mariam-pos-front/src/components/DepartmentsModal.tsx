import React, { useState, useCallback, useEffect, useRef } from "react";
import { IoClose } from "react-icons/io5";
import Swal from "sweetalert2";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentCategories,
  getUnassignedCategories,
  assignCategoryToDepartment,
  removeCategoryFromDepartment,
} from "../api/departments";
import type { Department, Category } from "../types/index";
import "../styles/components/departmentsModal.css";

interface DepartmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyForm = { name: "", description: "" };

// Activo si status es null o distinto de 0.
const isActive = (status?: number | null) =>
  status === null || status === undefined || status !== 0;

type View = "list" | "form";

const DepartmentsModal: React.FC<DepartmentsModalProps> = ({ isOpen, onClose }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vista actual: lista o formulario (alta/edición).
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Categorías del departamento en edición (solo aplica al editar).
  const [deptCategories, setDeptCategories] = useState<Category[]>([]);
  const [unassigned, setUnassigned] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [assignSelect, setAssignSelect] = useState<string>("");

  const focusName = () => setTimeout(() => nameInputRef.current?.focus(), 80);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (e) {
      console.error("Error al cargar departamentos:", e);
      setError("No se pudieron cargar los departamentos.");
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadDepartments();
      setView("list");
      setEditingId(null);
      setForm(emptyForm);
      setDeptCategories([]);
      setUnassigned([]);
    }
  }, [isOpen, loadDepartments]);

  // Cargar categorías (ligadas + sin departamento) para el departamento en edición.
  const loadCategoriesFor = useCallback(async (departmentId: string) => {
    setLoadingCats(true);
    setAssignSelect("");
    try {
      const [cats, free] = await Promise.all([
        getDepartmentCategories(departmentId),
        getUnassignedCategories(),
      ]);
      setDeptCategories(cats);
      setUnassigned(free);
    } catch (e) {
      console.error("Error al cargar categorías:", e);
      setDeptCategories([]);
      setUnassigned([]);
    } finally {
      setLoadingCats(false);
    }
  }, []);

  if (!isOpen) return null;

  // ── Navegación alta/edición ─────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDeptCategories([]);
    setUnassigned([]);
    setView("form");
    focusName();
  };

  const openEdit = (d: Department) => {
    setEditingId(d.id);
    setForm({ name: d.name || "", description: d.description || "" });
    setView("form");
    focusName();
    loadCategoriesFor(d.id);
  };

  const backToList = () => {
    setView("list");
    setEditingId(null);
    setForm(emptyForm);
    setDeptCategories([]);
    setUnassigned([]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Nombre requerido",
        text: "El nombre del departamento es obligatorio.",
        confirmButtonText: "Entendido",
      });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateDepartment(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
      } else {
        await createDepartment({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          status: 1,
        });
      }
      await loadDepartments();
      backToList();
    } catch (e: any) {
      console.error("Error al guardar departamento:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.error || "No se pudo guardar el departamento.",
        confirmButtonText: "Entendido",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (d: Department) => {
    const nextStatus = isActive(d.status) ? 0 : 1;
    try {
      await updateDepartment(d.id, { status: nextStatus });
      await loadDepartments();
    } catch (e: any) {
      console.error("Error al cambiar estado:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.error || "No se pudo cambiar el estado.",
        confirmButtonText: "Entendido",
      });
    }
  };

  const handleDelete = async (d: Department) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar departamento",
      html: `¿Seguro que querés eliminar <strong>${d.name}</strong>?`,
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteDepartment(d.id);
      await loadDepartments();
    } catch (e: any) {
      console.error("Error al eliminar departamento:", e);
      Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: e?.response?.data?.error || "Error al eliminar el departamento.",
        confirmButtonText: "Entendido",
      });
    }
  };

  // ── Categorías (dentro del editar) ──────────────────────
  const handleAssign = async () => {
    if (!editingId || !assignSelect) return;
    try {
      await assignCategoryToDepartment(editingId, assignSelect);
      await loadCategoriesFor(editingId);
    } catch (e: any) {
      console.error("Error al asignar categoría:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.error || "No se pudo asignar la categoría.",
        confirmButtonText: "Entendido",
      });
    }
  };

  const handleRemoveCategory = async (cat: Category) => {
    if (!editingId) return;
    try {
      await removeCategoryFromDepartment(cat.id);
      await loadCategoriesFor(editingId);
    } catch (e: any) {
      console.error("Error al quitar categoría:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.error || "No se pudo quitar la categoría.",
        confirmButtonText: "Entendido",
      });
    }
  };

  return (
    <div className="dep-overlay" onClick={onClose} role="presentation">
      <div
        className="dep-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dep-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dep-header">
          <h2 id="dep-title" className="dep-title">🏢 Departamentos</h2>
          <button className="dep-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="dep-body">
          {view === "form" ? (
            /* ── Formulario de alta/edición ── */
            <div className="dep-form">
              <span className="dep-form-title">
                {editingId ? "Editar departamento" : "Nuevo departamento"}
              </span>
              <input
                ref={nameInputRef}
                className="dep-input"
                type="text"
                value={form.name}
                placeholder="Nombre (ej. Papelería, Abarrotes)"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="dep-input"
                type="text"
                value={form.description}
                placeholder="Descripción (opcional)"
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />

              {/* Categorías: solo al editar (el departamento ya existe) */}
              {editingId && (
                <div className="dep-cat-section">
                  <span className="dep-cat-section-title">📂 Categorías del departamento</span>

                  {/* Asignar categoría existente sin departamento */}
                  <div className="dep-assign">
                    <select
                      className="dep-input"
                      value={assignSelect}
                      onChange={(e) => setAssignSelect(e.target.value)}
                      disabled={loadingCats || unassigned.length === 0}
                    >
                      <option value="">
                        {unassigned.length === 0
                          ? "No hay categorías sin departamento"
                          : "Elegí una categoría para asignar..."}
                      </option>
                      {unassigned.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="dep-btn dep-btn--primary dep-btn--sm"
                      onClick={handleAssign}
                      disabled={!assignSelect || loadingCats}
                    >
                      Asignar
                    </button>
                  </div>

                  {/* Categorías ligadas */}
                  {loadingCats ? (
                    <div className="dep-empty">Cargando categorías...</div>
                  ) : deptCategories.length === 0 ? (
                    <div className="dep-empty">
                      Este departamento aún no tiene categorías.
                    </div>
                  ) : (
                    <div className="dep-cat-list">
                      {deptCategories.map((c) => (
                        <div key={c.id} className="dep-cat-item">
                          <span className="dep-cat-name">📂 {c.name}</span>
                          <button
                            type="button"
                            className="dep-cat-remove"
                            title="Quitar del departamento"
                            onClick={() => handleRemoveCategory(c)}
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="dep-form-actions">
                <button
                  type="button"
                  className="dep-btn dep-btn--ghost"
                  onClick={backToList}
                  disabled={saving}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="dep-btn dep-btn--primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear"}
                </button>
              </div>
            </div>
          ) : (
            /* ── Vista lista ── */
            <>
              <div className="dep-list-head">
                <span className="dep-list-title">Lista de departamentos</span>
                <button
                  type="button"
                  className="dep-btn dep-btn--primary dep-btn--sm"
                  onClick={openCreate}
                >
                  ➕ Crear nuevo
                </button>
              </div>

              {error ? (
                <div className="dep-empty dep-error">{error}</div>
              ) : loading ? (
                <div className="dep-empty">Cargando departamentos...</div>
              ) : departments.length === 0 ? (
                <div className="dep-empty">
                  No hay departamentos. Creá el primero con “Crear nuevo”.
                </div>
              ) : (
                <div className="dep-list">
                  {departments.map((d) => (
                    <div
                      key={d.id}
                      className={`dep-item ${isActive(d.status) ? "" : "dep-item--inactive"}`}
                    >
                      <div className="dep-item-text">
                        <span className="dep-item-name">{d.name}</span>
                        {d.description && (
                          <span className="dep-item-desc">{d.description}</span>
                        )}
                      </div>
                      <div className="dep-item-right">
                        <span className="dep-item-count">
                          {d._count?.categories ?? 0} cat.
                        </span>
                        <button
                          type="button"
                          className={`dep-status-toggle ${
                            isActive(d.status)
                              ? "dep-status-toggle--on"
                              : "dep-status-toggle--off"
                          }`}
                          title={isActive(d.status) ? "Activo — clic para desactivar" : "Inactivo — clic para activar"}
                          onClick={() => handleToggleStatus(d)}
                        >
                          {isActive(d.status) ? "Activo" : "Inactivo"}
                        </button>
                        <button
                          type="button"
                          className="dep-icon-btn dep-icon-btn--edit"
                          title="Editar y asignar categorías"
                          onClick={() => openEdit(d)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="dep-icon-btn dep-icon-btn--delete"
                          title="Eliminar"
                          onClick={() => handleDelete(d)}
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

        {/* El footer "Cerrar" solo aparece en la lista; en el formulario
            quedan únicamente "Volver" y "Guardar cambios". */}
        {view === "list" && (
          <div className="dep-footer">
            <button type="button" className="dep-btn-close" onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentsModal;
