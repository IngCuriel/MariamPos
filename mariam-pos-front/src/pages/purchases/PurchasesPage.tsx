import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import type { Purchase, Supplier } from "../../types";
import { getPurchases, deletePurchase } from "../../api/purchases";
import { getSuppliers } from "../../api/suppliers";
import PurchaseModal from "./PurchaseModal";
import PurchaseDetailModal from "./PurchaseDetailModal";
import Swal from "sweetalert2";
// Reutilizamos los estilos de layout del catálogo (filtros, tabla, paginación)
// para unificar el diseño con el resto de las pantallas del sistema.
import "../../styles/pages/products/catalog.css";
import "../../styles/pages/purchases/purchases.css";

interface PurchasesPageProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 25;

const PurchasesPage: React.FC<PurchasesPageProps> = ({ onBack }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    supplierId: "",
    paymentStatus: "",
    search: "",
  });

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  const fetchSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data.filter((s) => s.status === 1)); // Solo activos
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const response = await getPurchases(
        currentPage,
        ITEMS_PER_PAGE,
        filters.supplierId ? parseInt(filters.supplierId) : undefined,
        filters.paymentStatus || undefined,
        undefined,
        undefined,
        filters.search || undefined
      );
      setPurchases(response.data);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching purchases:", error);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar las compras" });
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (patch: Partial<typeof filters>) => {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    await fetchPurchases();
    Swal.fire({ icon: "success", title: "¡Éxito!", text: "Compra registrada correctamente" });
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar compra?",
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await deletePurchase(id);
        Swal.fire({ icon: "success", title: "¡Éxito!", text: "Compra eliminada correctamente" });
        fetchPurchases();
      } catch (error: any) {
        console.error("Error deleting purchase:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.error || "No se pudo eliminar la compra",
        });
      }
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; cls: string }> = {
      PENDING: { label: "Pendiente", cls: "pur-status-badge--pending" },
      PARTIAL: { label: "Parcial", cls: "pur-status-badge--partial" },
      PAID: { label: "Pagado", cls: "pur-status-badge--paid" },
    };
    return statusMap[status] || { label: status, cls: "" };
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  return (
    <div className="purchases-page">
      <Header title="🛒 Compras" onBack={onBack} backText="← Volver al Menú Principal" />

      <div className="catalog-content purchases-content">
        {/* Sección de Filtros (mismo bloque que el catálogo) */}
        <Card className="catalog-filters-section">
          <div className="catalog-filters">
            <div className="catalog-filter-group">
              <label className="catalog-filter-label">Proveedor</label>
              <select
                className="catalog-category-select"
                value={filters.supplierId}
                onChange={(e) => updateFilter({ supplierId: e.target.value })}
              >
                <option value="">Todos</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="catalog-filter-group">
              <label className="catalog-filter-label">Estado</label>
              <select
                className="catalog-category-select"
                value={filters.paymentStatus}
                onChange={(e) => updateFilter({ paymentStatus: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagado</option>
              </select>
            </div>

            <div className="catalog-filter-group">
              <label htmlFor="pur-search" className="catalog-filter-label">
                Buscar
              </label>
              <input
                ref={searchRef}
                id="pur-search"
                type="text"
                placeholder="Folio o factura..."
                className="catalog-search-input"
                value={filters.search}
                onChange={(e) => updateFilter({ search: e.target.value })}
              />
            </div>

            <div className="catalog-filter-group catalog-actions-group">
              <button type="button" className="pur-add-btn" onClick={() => setShowModal(true)}>
                ➕ Nueva Compra
              </button>
            </div>
          </div>
        </Card>

        {/* Tabla de compras (mismo contenedor que el catálogo) */}
        <Card className="catalog-table-card pur-table-card">
          <div className="pur-table-container">
            {loading ? (
              <div className="loading">Cargando compras...</div>
            ) : purchases.length === 0 ? (
              <div className="no-results">No se encontraron compras</div>
            ) : (
              <table className="pur-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Proveedor</th>
                    <th>Fecha</th>
                    <th>Factura</th>
                    <th className="pur-th-right">Total</th>
                    <th>Estado Pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const statusInfo = getPaymentStatusBadge(purchase.paymentStatus);
                    return (
                      <tr key={purchase.id}>
                        <td>
                          {/* Folio interno = id de la compra (corto). El folio
                              largo autogenerado sigue en BD pero no se muestra. */}
                          <span className="pur-folio">#{purchase.id}</span>
                        </td>
                        <td>{purchase.supplier?.name || "N/A"}</td>
                        <td>{formatDate(purchase.purchaseDate)}</td>
                        <td>{purchase.invoiceNumber || "-"}</td>
                        <td className="pur-td-right">
                          <span className="pur-total">{formatCurrency(purchase.total)}</span>
                          {purchase.balance !== undefined && purchase.balance > 0 && (
                            <div className="pur-balance-info">
                              <span>Pendiente:</span>
                              <span className="pur-balance-amount">
                                {formatCurrency(purchase.balance)}
                              </span>
                              {purchase.pendingPercentage !== undefined && (
                                <span className="pur-balance-pct">
                                  ({purchase.pendingPercentage.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`pur-status-badge ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                          {purchase.paidPercentage !== undefined &&
                            purchase.paidPercentage > 0 &&
                            purchase.paidPercentage < 100 && (
                              <div className="pur-progress">
                                <div className="pur-progress-bar">
                                  <div
                                    className="pur-progress-fill"
                                    style={{ width: `${purchase.paidPercentage}%` }}
                                  />
                                </div>
                                <span className="pur-progress-text">
                                  {purchase.paidPercentage.toFixed(1)}% pagado
                                </span>
                              </div>
                            )}
                        </td>
                        <td>
                          <div className="pur-actions">
                            <button
                              type="button"
                              className="pur-action pur-action--view"
                              onClick={() => setDetailPurchase(purchase)}
                            >
                              👁️ Ver
                            </button>
                            <button
                              type="button"
                              className="pur-action pur-action--delete"
                              onClick={() => handleDelete(purchase.id)}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Footer con paginación (estilo catálogo) */}
        {totalItems > 0 && (
          <div className="pur-footer-bar">
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Anterior
            </button>
            <span className="prod-page-info">
              Página {currentPage} de {totalPages} · {totalItems.toLocaleString("es-MX")} compra(s)
            </span>
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <PurchaseModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleSave} />
      )}

      <PurchaseDetailModal
        isOpen={detailPurchase !== null}
        purchase={detailPurchase}
        onClose={() => setDetailPurchase(null)}
      />
    </div>
  );
};

export default PurchasesPage;
