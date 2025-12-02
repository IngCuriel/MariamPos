import React, { useState, useEffect } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { AccountPayable, Supplier } from "../../types";
import {
  getAccountPayables,
  getAccountPayablesSummary,
  registerPayment,
  deleteAccountPayable,
} from "../../api/accountPayables";
import { getSuppliers } from "../../api/suppliers";
import PaymentModal from "./PaymentModal";
import Swal from "sweetalert2";
import "../../styles/pages/accountPayables/accountPayables.css";

interface AccountPayablesPageProps {
  onBack: () => void;
}

const AccountPayablesPage: React.FC<AccountPayablesPageProps> = ({ onBack }) => {
  const [accountPayables, setAccountPayables] = useState<AccountPayable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountPayable | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    supplierId: "",
    status: "",
    overdue: false,
  });

  useEffect(() => {
    fetchSuppliers();
    fetchSummary();
    fetchAccountPayables();
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
        itemsPerPage,
        filters.supplierId ? parseInt(filters.supplierId) : undefined,
        filters.status || undefined,
        filters.overdue
      );
      setAccountPayables(response.data);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching account payables:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las cuentas por pagar",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = (account: AccountPayable) => {
    setSelectedAccount(account);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    await fetchAccountPayables();
    await fetchSummary();
    Swal.fire({
      icon: "success",
      title: "¡Éxito!",
      text: "Pago registrado correctamente",
    });
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
        Swal.fire({
          icon: "success",
          title: "¡Éxito!",
          text: "Cuenta por pagar eliminada correctamente",
        });
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

    const statusMap: Record<string, { label: string; class: string }> = {
      PENDING: { label: isOverdue ? "Vencida" : "Pendiente", class: isOverdue ? "overdue" : "pending" },
      PARTIAL: { label: isOverdue ? "Vencida (Parcial)" : "Parcial", class: isOverdue ? "overdue" : "partial" },
      PAID: { label: "Pagada", class: "paid" },
      OVERDUE: { label: "Vencida", class: "overdue" },
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
    <div className="account-payables-page">
      <Header title="💳 Cuentas por Pagar" onBack={onBack} backText="← Volver" />

      <div className="account-payables-container">
        {summary && (
          <div className="summary-cards">
            <Card className="summary-card">
              <div className="summary-label">Total Pendiente</div>
              <div className="summary-value">{formatCurrency(summary.total.balance)}</div>
              <div className="summary-count">{summary.total.count} cuenta(s)</div>
            </Card>
            <Card className="summary-card pending">
              <div className="summary-label">Pendientes</div>
              <div className="summary-value">{formatCurrency(summary.pending.balance)}</div>
              <div className="summary-count">{summary.pending.count} cuenta(s)</div>
            </Card>
            <Card className="summary-card partial">
              <div className="summary-label">Parciales</div>
              <div className="summary-value">{formatCurrency(summary.partial.balance)}</div>
              <div className="summary-count">{summary.partial.count} cuenta(s)</div>
            </Card>
            <Card className="summary-card overdue">
              <div className="summary-label">Vencidas</div>
              <div className="summary-value">{formatCurrency(summary.overdue.balance)}</div>
              <div className="summary-count">{summary.overdue.count} cuenta(s)</div>
            </Card>
          </div>
        )}

        <Card className="account-payables-card">
          <div className="account-payables-header">
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
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">Todos los estados</option>
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="OVERDUE">Vencida</option>
              </select>

              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.overdue}
                  onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })}
                />
                <span>Solo vencidas</span>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="loading">Cargando...</div>
          ) : accountPayables.length === 0 ? (
            <div className="no-results">No se encontraron cuentas por pagar pendientes</div>
          ) : (
            <>
              <div className="account-payables-table-container">
                <table className="account-payables-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Monto</th>
                      <th>Pagado</th>
                      <th>Saldo</th>
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
                            <strong>{account.supplier?.name || "N/A"}</strong>
                            {account.purchase && (
                              <div className="purchase-info">Compra: {account.purchase.folio}</div>
                            )}
                          </td>
                          <td>{formatCurrency(account.amount)}</td>
                          <td>{formatCurrency(account.paidAmount)}</td>
                          <td>
                            <strong>{formatCurrency(account.balance)}</strong>
                          </td>
                          <td>{formatDate(account.dueDate)}</td>
                          <td>
                            <span className={`status-badge ${statusInfo.class}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <Button
                                variant="primary"
                                size="small"
                                onClick={() => handlePayment(account)}
                              >
                                💰 Pagar
                              </Button>
                              <Button
                                variant="danger"
                                size="small"
                                onClick={() => handleDelete(account.id)}
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
                <div className="account-payables-pagination">
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

              <div className="account-payables-summary">
                <span>
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems.toLocaleString('es-MX')} cuenta(s) pendiente(s)
                </span>
              </div>
            </>
          )}
        </Card>
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

