import React, { useMemo } from "react";
import { IoClose } from "react-icons/io5";
import type { Category, Department } from "../types/index";
import "../styles/components/categoryOrgChart.css";

interface CategoryOrgChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  categories: Category[];
}

const CategoryOrgChartModal: React.FC<CategoryOrgChartModalProps> = ({
  isOpen,
  onClose,
  departments,
  categories,
}) => {
  const branch = localStorage.getItem("sucursal") || "Sucursal Principal";

  // Agrupar categorías por departamento + las que no tienen.
  const { byDept, unassigned } = useMemo(() => {
    const map: Record<string, Category[]> = {};
    const free: Category[] = [];
    for (const c of categories) {
      if (c.departmentId) {
        (map[c.departmentId] ??= []).push(c);
      } else {
        free.push(c);
      }
    }
    // Ordenar categorías por nombre dentro de cada grupo.
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.name.localeCompare(b.name, "es"))
    );
    free.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { byDept: map, unassigned: free };
  }, [categories]);

  if (!isOpen) return null;

  // Departamentos ordenados alfabéticamente; se agrega el nodo "Sin departamento" al final.
  const sortedDepts = [...departments].sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );

  const nodes: Array<{ id: string; name: string; cats: Category[]; none?: boolean }> = [
    ...sortedDepts.map((d) => ({
      id: d.id,
      name: d.name,
      cats: byDept[d.id] || [],
    })),
  ];
  if (unassigned.length > 0) {
    nodes.push({ id: "__none__", name: "Sin departamento", cats: unassigned, none: true });
  }

  return (
    <div className="org-overlay" onClick={onClose} role="presentation">
      <div
        className="org-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="org-header">
          <h2 id="org-title" className="org-title">🗂️ Estructura del catálogo</h2>
          <button className="org-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="org-body">
          {nodes.length === 0 ? (
            <div className="org-empty">
              No hay departamentos ni categorías para mostrar.
            </div>
          ) : (
            <div className="org-chart">
              {/* Nivel 1: Sucursal */}
              <div className="org-level org-level--root">
                <div className="org-node org-node--branch">
                  <span className="org-node-name">{branch}</span>
                  <span className="org-node-sub">Sucursal</span>
                </div>
              </div>

              {/* Conector raíz → departamentos */}
              <div className="org-connector-root" />

              {/* Nivel 2 + 3: Departamentos y sus categorías */}
              <div className="org-departments">
                {nodes.map((node) => (
                  <div key={node.id} className="org-branch">
                    <div
                      className={`org-node org-node--dept ${
                        node.none ? "org-node--none" : ""
                      }`}
                    >
                      <span className="org-node-name">{node.name}</span>
                      <span className="org-node-sub">
                        {node.cats.length} categoría{node.cats.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {node.cats.length > 0 && (
                      <>
                        <div className="org-connector-dept" />
                        <div className="org-categories">
                          {node.cats.map((c) => (
                            <div key={c.id} className="org-node org-node--cat">
                              📂 {c.name}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="org-footer">
          <button type="button" className="org-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryOrgChartModal;
