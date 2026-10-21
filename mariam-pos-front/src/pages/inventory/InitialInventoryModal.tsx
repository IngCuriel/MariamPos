import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Department, Product } from "../../types";
import { getDepartments } from "../../api/departments";
import { getCategories } from "../../api/categories";
import {
  getProductsByDepartmentForInventory,
  saveInitialInventoryBatch,
} from "../../api/inventory";
import Swal from "sweetalert2";
import "../../styles/pages/inventory/inventory.css";

interface InitialInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Estado por producto en el paso 3.
interface Row {
  product: Product;
  selected: boolean;
  qty: number;
}

const InitialInventoryModal: React.FC<InitialInventoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  // Productos de TODO el departamento (se cargan una vez y se filtran por categoría).
  const [deptProducts, setDeptProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkQty, setBulkQty] = useState<number>(0);
  const [scan, setScan] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  // Cargar departamentos y categorías al abrir.
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedDept(null);
    setSelectedCat(null);
    setDeptProducts([]);
    setRows([]);
    setScan("");
    setBulkQty(0);
    (async () => {
      try {
        const [depts, cats] = await Promise.all([
          getDepartments(true),
          getCategories(),
        ]);
        setDepartments(depts);
        setCategories(cats);
      } catch {
        setDepartments([]);
        setCategories([]);
      }
    })();
  }, [isOpen]);

  // Categorías del departamento elegido.
  const deptCategories = useMemo(
    () =>
      selectedDept
        ? categories.filter((c) => c.department?.id === selectedDept.id)
        : [],
    [categories, selectedDept]
  );

  // Paso 1 → 2: elegir departamento y cargar sus productos (una vez).
  const pickDepartment = async (dept: Department) => {
    setSelectedDept(dept);
    setStep(2);
    setLoading(true);
    try {
      const products = await getProductsByDepartmentForInventory(dept.id);
      setDeptProducts(products);
    } catch {
      setDeptProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Paso 2 → 3: elegir categoría y armar las filas.
  const pickCategory = (cat: Category) => {
    setSelectedCat(cat);
    setStep(3);
    const prods = deptProducts.filter((p) => p.category?.id === cat.id);
    setRows(
      prods.map((p) => ({
        product: p,
        selected: !!p.trackInventory,
        qty: p.inventory?.currentStock ?? 0,
      }))
    );
    setTimeout(() => scanRef.current?.focus(), 150);
  };

  // Conteo de productos por categoría (para mostrarlo en el paso 2).
  const countByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of deptProducts) {
      const id = p.category?.id;
      if (id) map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  }, [deptProducts]);

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const selectedCount = rows.filter((r) => r.selected).length;

  const toggleAll = () => {
    const next = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: next })));
  };

  const toggleRow = (productId: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.product.id === productId ? { ...r, selected: !r.selected } : r
      )
    );
  };

  const setRowQty = (productId: number, qty: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.product.id === productId
          ? { ...r, qty: Number.isFinite(qty) && qty >= 0 ? qty : 0 }
          : r
      )
    );
  };

  const applyBulkQty = () => {
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, qty: bulkQty } : r))
    );
  };

  // Escaneo: busca por código entre las filas de la categoría actual.
  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const match = rows.find(
      (r) => (r.product.code || "").toLowerCase() === code
    );
    if (!match) {
      Swal.fire({
        icon: "warning",
        title: "Código no encontrado",
        text: "Ese código no pertenece a un producto de esta categoría.",
        timer: 2200,
        showConfirmButton: false,
      });
      setScan("");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.product.id === match.product.id ? { ...r, selected: true } : r
      )
    );
    setScan("");
    setTimeout(() => {
      const el = document.getElementById(`iniqty-${match.product.id}`);
      (el as HTMLInputElement | null)?.focus();
      (el as HTMLInputElement | null)?.select();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  };

  const handleSave = async () => {
    const items = rows
      .filter((r) => r.selected)
      .map((r) => ({ productId: r.product.id, currentStock: r.qty, minStock: 0 }));

    if (items.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Sin productos",
        text: "Selecciona al menos un producto para guardar el inventario inicial.",
      });
      return;
    }

    setSaving(true);
    try {
      const branch = localStorage.getItem("sucursal") || undefined;
      const cashRegister = localStorage.getItem("caja") || undefined;
      const res = await saveInitialInventoryBatch({
        items,
        branch,
        cashRegister,
      });
      Swal.fire({
        icon: "success",
        title: "Inventario inicial guardado",
        text: `Se configuró el inventario de ${res.count} producto(s).`,
        timer: 2200,
        showConfirmButton: false,
      });
      onSuccess();
      onClose();
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo guardar el inventario inicial.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const headerSuffix =
    step >= 3 && selectedCat
      ? ` · ${selectedDept?.name} › ${selectedCat.name}`
      : step === 2 && selectedDept
      ? ` · ${selectedDept.name}`
      : "";

  return (
    <div className="modal-overlay">
      <div className="inv-modal inv-wizard">
        <div className="inv-modal-header">
          <h2>🗂️ Inventario inicial{headerSuffix}</h2>
          <button className="inv-modal-close" onClick={onClose} title="Cerrar">
            ×
          </button>
        </div>

        <div className="inv-modal-body inv-wizard-body">
          {/* PASO 1 — departamento */}
          {step === 1 && (
            <>
              <p className="inv-wizard-hint">
                Paso 1: elige el departamento.
              </p>
              <div className="inv-dept-grid">
                {departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="inv-dept-card"
                    onClick={() => pickDepartment(d)}
                  >
                    <span className="inv-dept-icon">{d.icon || "🏢"}</span>
                    <span className="inv-dept-name">{d.name}</span>
                  </button>
                ))}
                {departments.length === 0 && (
                  <div className="no-results">No hay departamentos.</div>
                )}
              </div>
            </>
          )}

          {/* PASO 2 — categoría */}
          {step === 2 && (
            <>
              <p className="inv-wizard-hint">
                Paso 2: elige la categoría de <strong>{selectedDept?.name}</strong>.
              </p>
              {loading ? (
                <div className="loading">Cargando categorías...</div>
              ) : (
                <div className="inv-dept-grid">
                  {deptCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="inv-dept-card"
                      onClick={() => pickCategory(c)}
                    >
                      <span className="inv-dept-icon">📂</span>
                      <span className="inv-dept-name">{c.name}</span>
                      <span className="inv-cat-count">
                        {countByCategory.get(c.id) || 0} producto(s)
                      </span>
                    </button>
                  ))}
                  {deptCategories.length === 0 && (
                    <div className="no-results">
                      Este departamento no tiene categorías.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* PASO 3 — productos */}
          {step === 3 && (
            <>
              {/* Ayuda breve para el usuario */}
              <div className="inv-wizard-help">
                <span>
                  ✅ Marca los productos que quieras inventariar, escribe su
                  <strong> cantidad inicial</strong> y guarda. Los que no marques
                  no se tocan.
                </span>
              </div>

              <div className="inv-wizard-controls">
                <input
                  ref={scanRef}
                  type="text"
                  className="inv-input"
                  placeholder="🔦 Escanea un código de barras..."
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={handleScan}
                />
                <label
                  className="inv-checkbox"
                  title="Marca o desmarca de golpe todos los productos de la lista."
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                  <span>Seleccionar todos</span>
                </label>
                <div className="inv-bulk">
                  <input
                    type="number"
                    min={0}
                    className="inv-input inv-bulk-input"
                    placeholder="Cantidad"
                    value={bulkQty}
                    title="Escribe aquí una cantidad y aplícala de golpe a todos los productos marcados."
                    onChange={(e) => setBulkQty(Number(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    className="inv-btn inv-btn--ghost"
                    onClick={applyBulkQty}
                    title="Pone la cantidad escrita a la izquierda en TODOS los productos seleccionados, de una sola vez."
                  >
                    Aplicar a seleccionados
                  </button>
                </div>
              </div>

              <div className="inv-wizard-table">
                {rows.length === 0 ? (
                  <div className="no-results">
                    Esta categoría no tiene productos.
                  </div>
                ) : (
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Producto</th>
                        <th>Código</th>
                        <th style={{ width: 130 }}>Cantidad inicial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.product.id}
                          className={r.selected ? "ini-row--on" : ""}
                        >
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={r.selected}
                              onChange={() => toggleRow(r.product.id)}
                              style={{ width: 16, height: 16 }}
                            />
                          </td>
                          <td>
                            <strong>{r.product.name}</strong>
                          </td>
                          <td className="prod-td-muted">
                            {r.product.code || "—"}
                          </td>
                          <td>
                            <input
                              id={`iniqty-${r.product.id}`}
                              type="number"
                              min={0}
                              step="0.01"
                              className="inv-input"
                              style={{ width: "100%", minWidth: 0 }}
                              value={r.qty}
                              disabled={!r.selected}
                              onChange={(e) =>
                                setRowQty(r.product.id, Number(e.target.value))
                              }
                              onFocus={(e) => e.target.select()}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer de acciones */}
        <div className="inv-wizard-footer">
          {step === 1 && (
            <button
              type="button"
              className="inv-btn inv-btn--ghost"
              onClick={onClose}
            >
              Cancelar
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              className="inv-btn inv-btn--ghost"
              onClick={() => setStep(1)}
            >
              ← Cambiar departamento
            </button>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                className="inv-btn inv-btn--ghost"
                onClick={() => setStep(2)}
                disabled={saving}
              >
                ← Cambiar categoría
              </button>
              <span className="inv-wizard-count">
                {selectedCount} seleccionado(s)
              </span>
              <button
                type="button"
                className="inv-btn inv-btn--success"
                onClick={handleSave}
                disabled={saving || selectedCount === 0}
                title="Activa el control de inventario en los productos marcados y guarda su cantidad inicial. Queda registrado en el Kardex."
              >
                {saving ? "Guardando..." : "Guardar inventario inicial"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitialInventoryModal;
