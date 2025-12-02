import React, { useState, useEffect } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { Purchase, Supplier } from "../../types";
import { getPurchases, createPurchase, deletePurchase } from "../../api/purchases";
import { getSuppliers } from "../../api/suppliers";
import PurchaseModal from "./PurchaseModal";
import Swal from "sweetalert2";
import "../../styles/pages/purchases/purchases.css";

interface PurchasesPageProps {
  onBack: () => void;
}

const PurchasesPage: React.FC<PurchasesPageProps> = ({ onBack }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    supplierId: "",
    paymentStatus: "",
    search: "",
  });

  useEffect(() => {
    fetchSuppliers();
    fetchPurchases();
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
        itemsPerPage,
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
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las compras",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    await fetchPurchases();
    Swal.fire({
      icon: "success",
      title: "¡Éxito!",
      text: "Compra registrada correctamente",
    });
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
        Swal.fire({
          icon: "success",
          title: "¡Éxito!",
          text: "Compra eliminada correctamente",
        });
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
    const statusMap: Record<string, { label: string; class: string }> = {
      PENDING: { label: "Pendiente", class: "pending" },
      PARTIAL: { label: "Parcial", class: "partial" },
      PAID: { label: "Pagado", class: "paid" },
    };
    return statusMap[status] || { label: status, class: "" };
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  return (
    <div className="purchases-page">
      <Header title="🛒 Compras" onBack={onBack} backText="← Volver" />

      <div className="purchases-container">
        <Card className="purchases-card">
          <div className="purchases-header">
            <div className="filters-section">
              <select
                className="filter-select"
                value={filters.supplierId}
                onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
              >
                <option value="">Todos los proveedores</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={filters.paymentStatus}
                onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
              >
                <option value="">Todos los estados</option>
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagado</option>
              </select>

              <input
                type="text"
                placeholder="Buscar por folio o factura..."
                className="search-input"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <Button variant="primary" onClick={() => setShowModal(true)}>
              ➕ Nueva Compra
            </Button>
          </div>

          {loading ? (
            <div className="loading">Cargando compras...</div>
          ) : purchases.length === 0 ? (
            <div className="no-results">No se encontraron compras</div>
          ) : (
            <>
              <div className="purchases-table-container">
                <table className="purchases-table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Proveedor</th>
                      <th>Fecha</th>
                      <th>Factura</th>
                      <th>Total</th>
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
                            <strong>{purchase.folio}</strong>
                          </td>
                          <td>{purchase.supplier?.name || "N/A"}</td>
                          <td>{formatDate(purchase.purchaseDate)}</td>
                          <td>{purchase.invoiceNumber || "-"}</td>
                          <td>
                            <div>
                              <strong>{formatCurrency(purchase.total)}</strong>
                              {purchase.balance !== undefined && purchase.balance > 0 && (
                                <div className="balance-info">
                                  <span className="balance-label">Pendiente:</span>
                                  <span className="balance-amount">{formatCurrency(purchase.balance)}</span>
                                  {purchase.pendingPercentage !== undefined && (
                                    <span className="balance-percentage">({purchase.pendingPercentage.toFixed(1)}%)</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${statusInfo.class}`}>
                              {statusInfo.label}
                            </span>
                            {purchase.paidPercentage !== undefined && purchase.paidPercentage > 0 && purchase.paidPercentage < 100 && (
                              <div className="payment-progress">
                                <div className="progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ width: `${purchase.paidPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="progress-text">{purchase.paidPercentage.toFixed(1)}% pagado</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() => {
                                  Swal.fire({
                                    icon: "info",
                                    title: "Detalles de Compra",
                                    html: `
                                      <div style="text-align: left;">
                                        <p><strong>Folio:</strong> ${purchase.folio}</p>
                                        <p><strong>Proveedor:</strong> ${purchase.supplier?.name}</p>
                                        <p><strong>Fecha:</strong> ${formatDate(purchase.purchaseDate)}</p>
                                        <p><strong>Factura:</strong> ${purchase.invoiceNumber || "N/A"}</p>
                                        <p><strong>Subtotal:</strong> ${formatCurrency(purchase.subtotal)}</p>
                                        <p><strong>Impuestos:</strong> ${formatCurrency(purchase.tax)}</p>
                                        <p><strong>Descuento:</strong> ${formatCurrency(purchase.discount)}</p>
                                <p><strong>Total:</strong> ${formatCurrency(purchase.total)}</p>
                                ${purchase.paidAmount !== undefined && purchase.paidAmount > 0 ? `
                                  <p><strong>Pagado:</strong> ${formatCurrency(purchase.paidAmount)}</p>
                                  <p><strong>Saldo Pendiente:</strong> ${formatCurrency(purchase.balance || 0)}</p>
                                  ${purchase.paidPercentage !== undefined ? `<p><strong>Porcentaje Pagado:</strong> ${purchase.paidPercentage.toFixed(2)}%</p>` : ""}
                                  ${purchase.pendingPercentage !== undefined ? `<p><strong>Porcentaje Pendiente:</strong> ${purchase.pendingPercentage.toFixed(2)}%</p>` : ""}
                                ` : ""}
                                <p><strong>Estado:</strong> ${statusInfo.label}</p>
                                ${purchase.notes ? `<p><strong>Notas:</strong> ${purchase.notes}</p>` : ""}
                                      </div>
                                    `,
                                  });
                                }}
                              >
                                👁️ Ver
                              </Button>
                              <Button
                                variant="danger"
                                size="small"
                                onClick={() => handleDelete(purchase.id)}
                              >
                                🗑️ Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="purchases-pagination">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    ⏮️ Primera
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    ◀️ Anterior
                  </Button>
                  <span className="pagination-info">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente ▶️
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Última ⏭️
                  </Button>
                </div>
              )}

              <div className="purchases-summary">
                <span>
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems.toLocaleString('es-MX')} compras
                </span>
              </div>
            </>
          )}
        </Card>
      </div>

      {showModal && (
        <PurchaseModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default PurchasesPage;

