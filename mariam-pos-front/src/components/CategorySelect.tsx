import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Category } from "../types/index";
import "../styles/components/categorySelect.css";

interface CategorySelectProps {
  categories: Category[];
  value: string; // id de la categoría seleccionada ("" = ninguna)
  onChange: (categoryId: string) => void;
  /** Texto de la opción vacía. Si es null, no se muestra opción vacía. */
  allLabel?: string | null;
  placeholder?: string;
  className?: string;
  error?: boolean;
}

/**
 * Selector de categoría personalizado (dropdown táctil).
 * Reemplaza al <select> nativo: scroll visible, agrupado por departamento,
 * altura máxima y estilo controlado. Cierra al hacer clic fuera o con Escape.
 */
const CategorySelect: React.FC<CategorySelectProps> = ({
  categories,
  value,
  onChange,
  allLabel = "Todas las categorías",
  placeholder = "Selecciona una categoría",
  className = "",
  error = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Agrupar por departamento; las sin departamento van al final.
  const grouped = useMemo(() => {
    const byDept = new Map<string, { name: string; cats: Category[] }>();
    const noDept: Category[] = [];
    for (const c of categories) {
      if (c.department?.id) {
        const g = byDept.get(c.department.id) ?? { name: c.department.name, cats: [] };
        g.cats.push(c);
        byDept.set(c.department.id, g);
      } else {
        noDept.push(c);
      }
    }
    const groups = Array.from(byDept.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    );
    groups.forEach((g) => g.cats.sort((a, b) => a.name.localeCompare(b.name, "es")));
    noDept.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { groups, noDept };
  }, [categories]);

  const selectedName = useMemo(() => {
    if (!value) return allLabel || placeholder;
    return categories.find((c) => c.id === value)?.name || placeholder;
  }, [value, categories, allLabel, placeholder]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Cerrar con Escape.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className={`csel-root ${className}`} ref={rootRef}>
      <button
        type="button"
        className={`csel-trigger ${error ? "csel-trigger--error" : ""} ${open ? "csel-trigger--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`csel-value ${!value ? "csel-value--placeholder" : ""}`}>
          {selectedName}
        </span>
        <span className={`csel-arrow ${open ? "csel-arrow--open" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="csel-panel" role="listbox">
          {allLabel !== null && (
            <button
              type="button"
              className={`csel-option csel-option--all ${!value ? "csel-option--selected" : ""}`}
              onClick={() => select("")}
            >
              {allLabel}
            </button>
          )}

          {grouped.groups.map((group) => (
            <div key={group.name} className="csel-group">
              <div className="csel-group-title">{group.name}</div>
              {group.cats.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`csel-option ${value === cat.id ? "csel-option--selected" : ""}`}
                  onClick={() => select(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          ))}

          {grouped.noDept.length > 0 && (
            <div className="csel-group">
              <div className="csel-group-title">Sin departamento</div>
              {grouped.noDept.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`csel-option ${value === cat.id ? "csel-option--selected" : ""}`}
                  onClick={() => select(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {grouped.groups.length === 0 && grouped.noDept.length === 0 && (
            <div className="csel-empty">No hay categorías</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySelect;
