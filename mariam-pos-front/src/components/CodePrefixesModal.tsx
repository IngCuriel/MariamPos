import React, { useState, useCallback, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import Swal from "sweetalert2";
import {
  getCodePrefixes,
  updateCodePrefix,
  deleteCodePrefix,
} from "../api/codePrefixes";
import type { CategoryCodePrefix } from "../types/index";
import "../styles/components/codePrefixesModal.css";

interface CodePrefixesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CodePrefixesModal: React.FC<CodePrefixesModalProps> = ({ isOpen, onClose }) => {
  const [prefixes, setPrefixes] = useState<CategoryCodePrefix[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edición inline por fila.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrefix, setEditPrefix] = useState("");
  const [editLastNumber, setEditLastNumber] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCodePrefixes();
      setPrefixes(data);
    } catch (e) {
      console.error("Error al cargar prefijos:", e);
      setError("No se pudieron cargar los prefijos.");
      setPrefixes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
      setEditingId(null);
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  const startEdit = (p: CategoryCodePrefix) => {
    setEditingId(p.id);
    setEditPrefix(p.prefix);
    setEditLastNumber(p.lastNumber);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrefix("");
    setEditLastNumber(0);
  };

  const handleSave = async (p: CategoryCodePrefix) => {
    const clean = editPrefix.trim().toUpperCase();
    if (!clean) {
      Swal.fire({ icon: "warning", title: "El prefijo es obligatorio", timer: 2000, showConfirmButton: false });
      return;
    }
    setSaving(true);
    try {
      await updateCodePrefix(p.id, {
        prefix: clean,
        lastNumber: editLastNumber < 0 ? 0 : editLastNumber,
      });
      await load();
      cancelEdit();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: e?.response?.data?.error || "No se pudo guardar",
        timer: 3000,
        showConfirmButton: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: CategoryCodePrefix) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar prefijo",
      html: `¿Seguro que querés eliminar el prefijo <strong>${p.prefix}</strong>?<br/>Los productos existentes conservan su código; solo se deja de generar automático para esta categoría.`,
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteCodePrefix(p.id);
      await load();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: e?.response?.data?.error || "No se pudo eliminar",
        timer: 3000,
        showConfirmButton: false,
      });
    }
  };

  const nextCode = (p: CategoryCodePrefix) =>
    `${p.prefix}-${String(p.lastNumber + 1).padStart(p.padding, "0")}`;

  return (
    <div className="cpx-overlay" onClick={onClose} role="presentation">
      <div
        className="cpx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cpx-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cpx-header">
          <h2 id="cpx-title" className="cpx-title">🏷️ Prefijos de Código</h2>
          <button className="cpx-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="cpx-body">
          <p className="cpx-desc">
            Cada categoría puede tener un prefijo. Al registrar un producto sin código, se genera
            automático: <strong>PREFIJO-001, PREFIJO-002…</strong> Los prefijos se crean desde el
            formulario de producto al elegir la categoría.
          </p>

          {error ? (
            <div className="cpx-empty cpx-error">{error}</div>
          ) : loading ? (
            <div className="cpx-empty">Cargando prefijos…</div>
          ) : prefixes.length === 0 ? (
            <div className="cpx-empty">
              Aún no hay prefijos. Creá uno desde el formulario de producto, al elegir la categoría.
            </div>
          ) : (
            <div className="cpx-table-wrap">
              <table className="cpx-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Departamento</th>
                    <th>Prefijo</th>
                    <th className="cpx-right">Consecutivo</th>
                    <th>Siguiente</th>
                    <th className="cpx-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prefixes.map((p) => {
                    const editing = editingId === p.id;
                    return (
                      <tr key={p.id}>
                        <td className="cpx-strong">{p.category?.name || "—"}</td>
                        <td className="cpx-muted">{p.category?.department?.name || "—"}</td>
                        <td>
                          {editing ? (
                            <input
                              className="cpx-input"
                              value={editPrefix}
                              onChange={(e) => setEditPrefix(e.target.value.toUpperCase())}
                            />
                          ) : (
                            <span className="cpx-badge">{p.prefix}</span>
                          )}
                        </td>
                        <td className="cpx-right">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              className="cpx-input cpx-input--num"
                              value={editLastNumber}
                              onChange={(e) => setEditLastNumber(Number(e.target.value) || 0)}
                            />
                          ) : (
                            <span className="cpx-muted">{p.lastNumber}</span>
                          )}
                        </td>
                        <td className="cpx-next">{nextCode(p)}</td>
                        <td className="cpx-center">
                          <div className="cpx-actions">
                            {editing ? (
                              <>
                                <button
                                  type="button"
                                  className="cpx-btn cpx-btn--save"
                                  onClick={() => handleSave(p)}
                                  disabled={saving}
                                >
                                  {saving ? "…" : "Guardar"}
                                </button>
                                <button
                                  type="button"
                                  className="cpx-btn cpx-btn--ghost"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="cpx-btn cpx-btn--edit"
                                  onClick={() => startEdit(p)}
                                  title="Editar prefijo o consecutivo"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  type="button"
                                  className="cpx-btn cpx-btn--delete"
                                  onClick={() => handleDelete(p)}
                                  title="Eliminar prefijo"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="cpx-footer">
          <button type="button" className="cpx-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodePrefixesModal;
