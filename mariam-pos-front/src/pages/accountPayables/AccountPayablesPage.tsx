import React, { useState, useEffect } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import type { AccountPayable, Supplier } from "../../types";
import {
  getAccountPayables,
  getAccountPayablesSummary,
  deleteAccountPayable,
} from "../../api/accountPayables";
import { getSuppliers } from "../../api/suppliers";
import PaymentModal from "./PaymentModal";
import Swal from "sweetalert2";
// Reutilizamos los estilos de layout del catálogo (filtros, tabla, paginación).
import "../../styles/pages/products/catalog.css";
import "../../styles/pages/accountPayables/accountPayables.css";

interface AccountPayablesPageProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 25;

const AccountPayablesPage: React.FC<AccountPayablesPageProps> = ({ onBack }) => {
  const [accountPayables, setAccountPayables] = useState<AccountPayable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountPayable | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    supplierId: "",
    status: "",
    overdue: false,
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchAccountPayables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  const fetchSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data.filter((s) => s.status === 1));
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await getAccountPayablesSummary(
        filters.supplierId ? parseInt(filters.supplierId) : undefined
      );
      setSummary(data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const fetchAccountPayables = async () => {
    setLoading(true);
    try {
      const response = await getAccountPayables(
        currentPage,
        ITEMS_PER_PAGE,
        filters.supplierId ? parseInt(filters.supplierId) : undefined,
        filters.status || undefined,
        filters.overdue
      );
      setAccountPayables(response.data);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching account payables:", error);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar las cuentas por pagar" });
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (patch: Partial<typeof filters>) => {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handlePayment = (account: AccountPayable) => {
    setSelectedAccount(account);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    await fetchAccountPayables();
    await fetchSummary();
    Swal.fire({ icon: "success", title: "¡Éxito!", text: "Pago registrado correctamente" });
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar cuenta por pagar?",
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await deleteAccountPayable(id);
        Swal.fire({ icon: "success", title: "¡Éxito!", text: "Cuenta por pagar eliminada correctamente" });
        fetchAccountPayables();
        fetchSummary();
      } catch (error: any) {
        console.error("Error deleting account payable:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.error || "No se pudo eliminar la cuenta por pagar",
        });
      }
    }
  };

  const getStatusBadge = (status: string, dueDate: Date | string) => {
    const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
    const today = new Date();
    const isOverdue = due < today && status !== "PAID";

    const statusMap: Record<string, { label: string; cls: string }> = {
      PENDING: {
        label: isOverdue ? "Vencida" : "Pendiente",
        cls: isOverdue ? "ap-status-badge--overdue" : "ap-status-badge--pending",
      },
      PARTIAL: {
        label: isOverdue ? "Vencida (Parcial)" : "Parcial",
        cls: isOverdue ? "ap-status-badge--overdue" : "ap-status-badge--partial",
      },
      PAID: { label: "Pagada", cls: "ap-status-badge--paid" },
      OVERDUE: { label: "Vencida", cls: "ap-status-badge--overdue" },
    };
    return statusMap[status] || { label: status, cls: "" };
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);

  return (
    <div className="account-payables-page">
      <Header title="💳 Cuentas por Pagar" onBack={onBack} backText="← Volver al Menú Principal" />

      <div className="catalog-content ap-content">
        {/* Resumen compacto en chips */}
        {summary && (
          <div className="ap-summary">
            <div className="ap-summary-chip ap-summary-chip--total">
              <span className="ap-summary-label">Total pendiente</span>
              <span className="ap-summary-value">{formatCurrency(summary.total.balance)}</span>
              <span className="ap-summary-count">{summary.total.count} cuenta(s)</span>
            </div>
            <div className="ap-summary-chip ap-summary-chip--pending">
              <span className="ap-summary-label">Pendientes</span>
              <span className="ap-summary-value">{formatCurrency(summary.pending.balance)}</span>
              <span className="ap-summary-count">{summary.pending.count} cuenta(s)</span>
            </div>
            <div className="ap-summary-chip ap-summary-chip--partial">
              <span className="ap-summary-label">Parciales</span>
              <span className="ap-summary-value">{formatCurrency(summary.partial.balance)}</span>
              <span className="ap-summary-count">{summary.partial.count} cuenta(s)</span>
            </div>
            <div className="ap-summary-chip ap-summary-chip--overdue">
              <span className="ap-summary-label">Vencidas</span>
              <span className="ap-summary-value">{formatCurrency(summary.overdue.balance)}</span>
              <span className="ap-summary-count">{summary.overdue.count} cuenta(s)</span>
            </div>
          </div>
        )}

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
                value={filters.status}
                onChange={(e) => updateFilter({ status: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="OVERDUE">Vencida</option>
              </select>
            </div>

            <div className="catalog-filter-group catalog-actions-group">
              <label className="ap-filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.overdue}
                  onChange={(e) => updateFilter({ overdue: e.target.checked })}
                />
                <span>Solo vencidas</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Tabla de cuentas por pagar */}
        <Card className="catalog-table-card ap-table-card">
          <div className="ap-table-container">
            {loading ? (
              <div className="loading">Cargando...</div>
            ) : accountPayables.length === 0 ? (
              <div className="no-results">No se encontraron cuentas por pagar pendientes</div>
            ) : (
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th className="ap-th-right">Monto</th>
                    <th className="ap-th-right">Pagado</th>
                    <th className="ap-th-right">Saldo</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {accountPayables.map((account) => {
                    const statusInfo = getStatusBadge(account.status, account.dueDate);
                    return (
                      <tr key={account.id}>
                        <td>
                          <span className="ap-supplier-name">{account.supplier?.name || "N/A"}</span>
                          {account.purchase && (
                            <div className="ap-purchase-info">Compra #{account.purchase.id}</div>
                          )}
                        </td>
                        <td className="ap-td-right ap-money">{formatCurrency(account.amount)}</td>
                        <td className="ap-td-right ap-money">{formatCurrency(account.paidAmount)}</td>
                        <td className="ap-td-right">
                          <span className="ap-balance">{formatCurrency(account.balance)}</span>
                        </td>
                        <td>{formatDate(account.dueDate)}</td>
                        <td>
                          <span className={`ap-status-badge ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td>
                          <div className="ap-actions">
                            <button
                              type="button"
                              className="ap-action ap-action--pay"
                              onClick={() => handlePayment(account)}
                            >
                              💰 Pagar
                            </button>
                            <button
                              type="button"
                              className="ap-action ap-action--delete"
                              onClick={() => handleDelete(account.id)}
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

        {/* Footer con paginación */}
        {totalItems > 0 && (
          <div className="ap-footer-bar">
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Anterior
            </button>
            <span className="prod-page-info">
              Página {currentPage} de {totalPages} · {totalItems.toLocaleString("es-MX")} cuenta(s)
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

      {showPaymentModal && selectedAccount && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedAccount(null);
          }}
          onSave={handlePaymentSuccess}
          accountPayable={selectedAccount}
        />
      )}
    </div>
  );
};

export default AccountPayablesPage;
