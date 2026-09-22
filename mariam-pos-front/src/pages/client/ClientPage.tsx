import React, { useState, useEffect } from 'react';
import '../../styles/pages/client.css';
import Header from '../../components/Header';
import ClientActionsModal from './ClientActionsModal';
import type {Client, ClientCredit} from '../../types/index'
import { getClientsPaginated, createClient, updateClient } from "../../api/clients";
import { getClientCredits, getClientCreditSummary, getAllPendingCredits } from "../../api/credits";
import { getClientPendingDeposits, getAllPendingContainerDeposits, type ClientContainerDeposit } from "../../api/clientContainerDeposits";
import { getActiveShift } from "../../api/cashRegister";
import Card from '../../components/Card';
import Button from '../../components/Button';
import ClientModal from './ClientModal';
import CreditPaymentModal from './CreditPaymentModal';
import ClientCreditHistoryModal from './ClientCreditHistoryModal';
import ClientContainerDepositsModal from './ClientContainerDepositsModal';
import Swal from 'sweetalert2';

interface ClientPageProps {
  onBack: () => void;
}
 
const ClientPage: React.FC<ClientPageProps> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [loadingClients, setLoadingClients] = useState(false);
  const CLIENTS_PER_PAGE = 10;
  const [clientCredits, setClientCredits] = useState<Record<string, { totalPending: number; credits: ClientCredit[] }>>({});
  const [clientContainerDeposits, setClientContainerDeposits] = useState<Record<string, { totalContainers: number; totalAmount: number; summary: any[] }>>({});
  const [selectedCredit, setSelectedCredit] = useState<ClientCredit | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditHistory, setShowCreditHistory] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
  const [showContainerDeposits, setShowContainerDeposits] = useState(false);
  const [selectedClientForDeposits, setSelectedClientForDeposits] = useState<Client | null>(null);
  const [actionsClient, setActionsClient] = useState<Client | null>(null);
  const [_loadingCredits, setLoadingCredits] = useState(false);
  const [activeTab, setActiveTab] = useState<'clients' | 'credits' | 'containers'>('clients');
  const [allPendingCredits, setAllPendingCredits] = useState<ClientCredit[]>([]);
  const [allPendingDeposits, setAllPendingDeposits] = useState<ClientContainerDeposit[]>([]);
  const [loadingAllCredits, setLoadingAllCredits] = useState(false);
  const [loadingAllDeposits, setLoadingAllDeposits] = useState(false);
  
  // Carga la página de clientes desde el servidor (10 por página) y, para esos
  // 10 clientes, sus créditos y depósitos pendientes (indicadores por fila).
  const fetchClientsPage = async (page: number, search: string) => {
    setLoadingClients(true);
    try {
      const result = await getClientsPaginated(page, CLIENTS_PER_PAGE, search);
      setClients(result.clients);
      setTotalPages(result.pagination.totalPages);
      setTotalClients(result.pagination.total);
      // Sincroniza la página real devuelta por el servidor (puede ajustarse si estaba fuera de rango).
      if (result.pagination.page !== page) {
        setCurrentPage(result.pagination.page);
      }
      await loadCreditsAndDepositsFor(result.clients);
    } catch (err) {
      console.error(err);
      setClients([]);
      setTotalPages(1);
      setTotalClients(0);
    } finally {
      setLoadingClients(false);
    }
  };

  // Recarga la página actual (tras crear/editar/abonar).
  const reloadCurrentPage = () => {
    void fetchClientsPage(currentPage, searchTerm);
  };

  // Créditos + depósitos pendientes solo de los clientes visibles en la página.
  const loadCreditsAndDepositsFor = async (pageClients: Client[]) => {
    setLoadingCredits(true);
    try {
      const creditsMap: Record<string, { totalPending: number; credits: ClientCredit[] }> = {};
      const depositsMap: Record<string, { totalContainers: number; totalAmount: number; summary: any[] }> = {};

      await Promise.all(
        pageClients.map(async (client) => {
          // Créditos: solo si el cliente tiene crédito habilitado.
          if (client.allowCredit) {
            try {
              const summary = await getClientCreditSummary(client.id);
              if (summary.totalPending > 0) {
                creditsMap[client.id] = {
                  totalPending: summary.totalPending,
                  credits: summary.credits,
                };
              }
            } catch (error) {
              console.error(`Error al cargar créditos de ${client.name}:`, error);
            }
          }
          // Depósitos de envases pendientes.
          try {
            const depositsData = await getClientPendingDeposits(client.id);
            if (depositsData.totalContainers > 0) {
              depositsMap[client.id] = {
                totalContainers: depositsData.totalContainers,
                totalAmount: depositsData.totalAmount,
                summary: depositsData.summary,
              };
            }
          } catch (error) {
            console.error(`Error al cargar depósitos de ${client.name}:`, error);
          }
        })
      );

      setClientCredits(creditsMap);
      setClientContainerDeposits(depositsMap);
    } catch (error) {
      console.error("Error al cargar créditos/depósitos:", error);
    } finally {
      setLoadingCredits(false);
    }
  };

  // Carga inicial + cada vez que cambia la página.
  useEffect(() => {
    void fetchClientsPage(currentPage, searchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Búsqueda con debounce: al escribir, vuelve a página 1 y consulta al servidor.
  useEffect(() => {
    const id = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1); // el efecto de [currentPage] hará el fetch
      } else {
        void fetchClientsPage(1, searchTerm);
      }
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Cargar todos los créditos y depósitos pendientes cuando se cambia de pestaña
  useEffect(() => {
    if (activeTab === 'credits') {
      loadAllPendingCredits();
    } else if (activeTab === 'containers') {
      loadAllPendingDeposits();
    }
  }, [activeTab]);

  const handlePaymentSuccess = () => {
    reloadCurrentPage(); // Recargar la página actual (clientes + créditos/depósitos)
  };

  const handleOpenPaymentModal = async (clientId: string) => {
    try {
      // Validar que haya turno activo antes de permitir abono
      const branch = localStorage.getItem('sucursal') || 'Sucursal Principal';
      const cashRegister = localStorage.getItem('caja') || 'Caja 1';
      
      const activeShift = await getActiveShift(branch, cashRegister);
      
      if (!activeShift) {
        Swal.fire({
          icon: "warning",
          title: "Turno no activo",
          text: "Debe abrir un turno de caja antes de registrar un abono",
          confirmButtonText: "Entendido",
          confirmButtonColor: "#f59e0b",
        });
        return;
      }

      const credits = await getClientCredits(clientId, "PENDING");
      const partiallyPaid = await getClientCredits(clientId, "PARTIALLY_PAID");
      const allPending = [...credits, ...partiallyPaid];
      
      if (allPending.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Sin créditos pendientes",
          text: "Este cliente no tiene créditos pendientes",
          confirmButtonText: "Entendido",
        });
        return;
      }

      if (allPending.length === 1) {
        // Si solo hay un crédito, abrir directamente
        setSelectedCredit(allPending[0]);
        setShowPaymentModal(true);
      } else {
        // Si hay múltiples créditos, mostrar lista para seleccionar
        const { value: selectedCreditId } = await Swal.fire({
          title: "Seleccionar Crédito",
          html: `
            <p>Este cliente tiene ${allPending.length} crédito(s) pendiente(s).</p>
            <select id="credit-select" class="swal2-select" style="width: 100%; margin-top: 10px;">
              ${allPending.map(credit => `
                <option value="${credit.id}">
                  Venta #${credit.saleId} - Saldo: $${(credit.remainingAmount || 0).toFixed(2)}
                </option>
              `).join('')}
            </select>
          `,
          showCancelButton: true,
          confirmButtonText: "Continuar",
          cancelButtonText: "Cancelar",
          preConfirm: () => {
            const select = document.getElementById("credit-select") as HTMLSelectElement;
            return parseInt(select.value);
          },
        });

        if (selectedCreditId) {
          const credit = allPending.find(c => c.id === selectedCreditId);
          if (credit) {
            setSelectedCredit(credit);
            setShowPaymentModal(true);
          }
        }
      }
    } catch (error) {
      console.error("Error al cargar créditos:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los créditos del cliente",
        confirmButtonText: "Entendido",
      });
    }
  };

  const handleAddNew = () => {
    setClientToEdit(null);
    setShowAddForm(true);
  };

  const handleEdit = (client: Client) => {
    setClientToEdit(client);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setClientToEdit(null);
  };

  // La lista ya viene paginada y filtrada del servidor.
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * CLIENTS_PER_PAGE;

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  // Ventana de hasta 5 números de página centrada en la página actual.
  const getPageNumbers = (): number[] => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleSave = async (client: Omit<Client, "id">) => {
    if (clientToEdit) {
      // Modo edición
      await updateClient(clientToEdit.id, client);
    } else {
      // Modo creación
      await createClient(client);
    }
    reloadCurrentPage();
    setClientToEdit(null);
  };

  const handleViewCreditHistory = (client: Client) => {
    setSelectedClientForHistory(client);
    setShowCreditHistory(true);
  };

  const loadAllPendingCredits = async () => {
    setLoadingAllCredits(true);
    try {
      const credits = await getAllPendingCredits();
      setAllPendingCredits(credits);
    } catch (error) {
      console.error("Error al cargar todos los créditos pendientes:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los créditos pendientes',
        confirmButtonText: 'Entendido',
      });
    } finally {
      setLoadingAllCredits(false);
    }
  };

  const loadAllPendingDeposits = async () => {
    setLoadingAllDeposits(true);
    try {
      const deposits = await getAllPendingContainerDeposits();
      setAllPendingDeposits(deposits);
    } catch (error) {
      console.error("Error al cargar todos los depósitos pendientes:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los depósitos pendientes',
        confirmButtonText: 'Entendido',
      });
    } finally {
      setLoadingAllDeposits(false);
    }
  };

  // Calcular totales de créditos
  const totalCreditsAmount = allPendingCredits.reduce((sum, credit) => sum + (credit.remainingAmount || 0), 0);
  const totalCreditsCount = allPendingCredits.length;
  const creditsByClient = allPendingCredits.reduce((acc, credit) => {
    const clientId = credit.clientId;
    if (!acc[clientId]) {
      acc[clientId] = {
        client: clients.find(c => c.id === clientId) || { id: clientId, name: 'Cliente desconocido' },
        credits: [],
        totalAmount: 0,
      };
    }
    acc[clientId].credits.push(credit);
    acc[clientId].totalAmount += (credit.remainingAmount || 0);
    return acc;
  }, {} as Record<string, { client: Client | { id: string; name: string }, credits: ClientCredit[], totalAmount: number }>);

  // Calcular totales de depósitos
  const totalDepositsAmount = allPendingDeposits.reduce((sum, deposit) => sum + deposit.importAmount, 0);
  const totalDepositsCount = allPendingDeposits.reduce((sum, deposit) => sum + deposit.quantity, 0);
  const depositsByClient = allPendingDeposits.reduce((acc, deposit) => {
    const clientId = deposit.clientId;
    if (!acc[clientId]) {
      acc[clientId] = {
        client: clients.find(c => c.id === clientId) || { id: clientId, name: 'Cliente desconocido' },
        deposits: [],
        totalAmount: 0,
        totalContainers: 0,
      };
    }
    acc[clientId].deposits.push(deposit);
    acc[clientId].totalAmount += deposit.importAmount;
    acc[clientId].totalContainers += deposit.quantity;
    return acc;
  }, {} as Record<string, { client: Client | { id: string; name: string }, deposits: ClientContainerDeposit[], totalAmount: number, totalContainers: number }>);

  // Agrupar depósitos por tipo de envase
  const depositsByContainerType = allPendingDeposits.reduce((acc, deposit) => {
    const containerName = deposit.containerName;
    if (!acc[containerName]) {
      acc[containerName] = {
        containerName,
        unitPrice: deposit.unitPrice,
        totalQuantity: 0,
        totalAmount: 0,
        deposits: [],
      };
    }
    acc[containerName].totalQuantity += deposit.quantity;
    acc[containerName].totalAmount += deposit.importAmount;
    acc[containerName].deposits.push(deposit);
    return acc;
  }, {} as Record<string, { containerName: string; unitPrice: number; totalQuantity: number; totalAmount: number; deposits: ClientContainerDeposit[] }>);

  return (
    <div className="app-client">
      <div className="client-container">
        <Header
          title="Catálogo de Clientes"
          onBack={onBack}
          backText="← Volver al Menu Principal"
          className="catalog-header"
        />
        <div className="client-content">
          {/* Sistema de pestañas */}
          <div className="tabs-container">
            <button
              className={`tab-button ${activeTab === 'clients' ? 'active' : ''}`}
              onClick={() => setActiveTab('clients')}
            >
              👥 Clientes
            </button>
            <button
              className={`tab-button ${activeTab === 'credits' ? 'active' : ''}`}
              onClick={() => setActiveTab('credits')}
            >
              💳 Créditos por cobrar
            </button>
            <button
              className={`tab-button ${activeTab === 'containers' ? 'active' : ''}`}
              onClick={() => setActiveTab('containers')}
            >
              🍺 Envases por recuperar
            </button>
          </div>

          {/* Contenido de la pestaña de Clientes */}
          {activeTab === 'clients' && (
            <>
           {/* Barra de búsqueda */}
          <Card className="search-card">
            <div className="search-section">
              <div className="search-group">
                <label htmlFor="search">Buscar Cliente:</label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre ..."
                  className="search-input"
                />
              </div>
              <Button
                variant="success"
                onClick={handleAddNew}
                className="add-category-btn"
              >
                ➕ Nuevo Cliente
              </Button>
            </div>
          </Card>

            {/* Tabla de clientes */}
            <table className="client-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Alias</th>
                  <th>Celular</th>
                  <th>Crédito</th>
                  <th>Límite</th>
                  <th>Saldo pendiente</th>
                  <th>Envases</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingClients ? (
                  <tr>
                    <td colSpan={8} className="client-table-state">Cargando clientes...</td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="client-table-state">
                      {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                    </td>
                  </tr>
                ) : (
                clients.map(client => {
                  const credits = clientCredits[client.id];
                  const hasPending = credits && credits.totalPending > 0;
                  const deposits = clientContainerDeposits[client.id];
                  const hasDeposits = deposits && deposits.totalContainers > 0;
                  
                  return (
                    <tr 
                      key={client.id}
                      style={
                        hasPending 
                          ? { backgroundColor: "#fef3c7" } 
                          : hasDeposits 
                          ? { backgroundColor: "#ecfdf5" } 
                          : {}
                      }
                    >
                      <td>
                        <span className="client-name-cell">
                          {client.name}
                          {hasPending && (
                            <span className="client-badge client-badge--debt">
                              ⚠️ Con saldo pendiente
                            </span>
                          )}
                        </span>
                      </td>
                      <td>{client.alias || '-'}</td>
                      <td>{client.phone || '-'}</td>
                      <td>{client.allowCredit ? '✅ Sí' : '❌ No'}</td>
                      <td>
                        {client.allowCredit 
                          ? client.creditLimit?.toLocaleString("es-MX", { style: "currency", currency: "MXN" }) || '$0.00'
                          : '-'
                        }
                      </td>
                      <td>
                        {hasPending ? (
                          <strong style={{ color: "#dc2626" }}>
                            {credits.totalPending.toLocaleString("es-MX", { 
                              style: "currency", 
                              currency: "MXN" 
                            })}
                          </strong>
                        ) : '-'}
                      </td>
                      <td>
                        {hasDeposits ? (
                          <span className="client-badge client-badge--containers">
                            🍺 {deposits.totalContainers} · ${deposits.totalAmount.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="client-actions-trigger"
                          onClick={() => setActionsClient(client)}
                        >
                          Acciones ▾
                        </button>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>

            {/* Controles de paginación */}
            {totalClients > 0 && (
              <div className="client-pagination">
                <span className="client-pagination-info">
                  Mostrando {pageStartIndex + 1}–{Math.min(pageStartIndex + CLIENTS_PER_PAGE, totalClients)} de {totalClients}
                </span>
                <div className="client-pagination-controls">
                  <button
                    type="button"
                    className="client-pagination-btn"
                    onClick={() => goToPage(1)}
                    disabled={safePage === 1}
                    aria-label="Primera página"
                  >
                    ⏮
                  </button>
                  <button
                    type="button"
                    className="client-pagination-btn"
                    onClick={() => goToPage(safePage - 1)}
                    disabled={safePage === 1}
                    aria-label="Página anterior"
                  >
                    ‹
                  </button>
                  {getPageNumbers().map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={`client-pagination-btn client-pagination-page ${page === safePage ? 'client-pagination-page--active' : ''}`}
                      onClick={() => goToPage(page)}
                      aria-current={page === safePage ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="client-pagination-btn"
                    onClick={() => goToPage(safePage + 1)}
                    disabled={safePage === totalPages}
                    aria-label="Página siguiente"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="client-pagination-btn"
                    onClick={() => goToPage(totalPages)}
                    disabled={safePage === totalPages}
                    aria-label="Última página"
                  >
                    ⏭
                  </button>
                </div>
              </div>
            )}
            </>
          )}

          {/* Contenido de la pestaña de Créditos por cobrar */}
          {activeTab === 'credits' && (
            <div className="tab-content">
              <Card className="summary-card" style={{ marginBottom: '20px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: '600' }}>Total de Créditos:</span>
                    <p style={{ margin: '4px 0', fontWeight: '700', fontSize: '1.5rem', color: '#dc2626' }}>
                      {totalCreditsCount} crédito{totalCreditsCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: '600' }}>Total a Cobrar:</span>
                    <p style={{ margin: '4px 0', fontWeight: '700', fontSize: '1.5rem', color: '#dc2626' }}>
                      ${totalCreditsAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </Card>

              {loadingAllCredits ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando créditos...</div>
              ) : totalCreditsCount === 0 ? (
                <Card className="empty-state-card">
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                    <h3>No hay créditos pendientes</h3>
                    <p>Todos los créditos han sido pagados</p>
                  </div>
                </Card>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {Object.values(creditsByClient).map((clientData, idx) => (
                    <Card key={idx} className="client-credit-card" style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                      <div style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #f59e0b' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#1f2937' }}>
                              {clientData.client.name}
                            </h3>
                            {'phone' in clientData.client && clientData.client.phone && (
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                                📱 {clientData.client.phone}
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block' }}>
                              {clientData.credits.length} crédito{clientData.credits.length !== 1 ? 's' : ''}
                            </span>
                            <strong style={{ fontSize: '1.2rem', color: '#dc2626', fontWeight: '700' }}>
                              ${clientData.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {clientData.credits.map((credit) => (
                            <div
                              key={credit.id}
                              style={{
                                padding: '0.75rem',
                                backgroundColor: '#fff7ed',
                                borderRadius: '4px',
                                border: '1px solid #fed7aa',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1f2937' }}>
                                    Venta #{credit.saleId}
                                  </span>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: credit.status === 'PENDING' ? '#fee2e2' : '#fef3c7',
                                    color: credit.status === 'PENDING' ? '#dc2626' : '#92400e',
                                    fontWeight: '600',
                                  }}>
                                    {credit.status === 'PENDING' ? 'Pendiente' : 'Parcial'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                  <span>Fecha: {new Date(credit.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                                  {credit.originalAmount && credit.originalAmount !== credit.remainingAmount && (
                                    <span style={{ marginLeft: '0.5rem' }}>
                                      | Total: ${(credit.originalAmount || 0).toFixed(2)} | Pagado: ${((credit.originalAmount || 0) - (credit.remainingAmount || 0)).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                                <strong style={{ fontSize: '1rem', color: '#dc2626', fontWeight: '700' }}>
                                  ${(credit.remainingAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </strong>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                                  Saldo pendiente
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contenido de la pestaña de Envases por recuperar */}
          {activeTab === 'containers' && (
            <div className="tab-content">
              <Card className="summary-card" style={{ marginBottom: '20px', backgroundColor: '#ecfdf5', border: '2px solid #059669' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: '600' }}>Total de Envases:</span>
                    <p style={{ margin: '4px 0', fontWeight: '700', fontSize: '1.5rem', color: '#059669' }}>
                      {totalDepositsCount} envase{totalDepositsCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: '600' }}>Importe Total:</span>
                    <p style={{ margin: '4px 0', fontWeight: '700', fontSize: '1.5rem', color: '#059669' }}>
                      ${totalDepositsAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Resumen por tipo de envase */}
              {Object.keys(depositsByContainerType).length > 0 && (
                <Card className="summary-card" style={{ marginBottom: '20px', backgroundColor: '#f0fdf4', border: '1px solid #059669' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#065f46' }}>
                    📊 Resumen por Tipo de Envase
                  </h3>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {Object.values(depositsByContainerType).map((containerData, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'white',
                          borderRadius: '4px',
                          border: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.9rem', color: '#1f2937', fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>
                            {containerData.containerName}
                          </span>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            <span>{containerData.totalQuantity} envase{containerData.totalQuantity !== 1 ? 's' : ''}</span>
                            <span style={{ marginLeft: '0.5rem' }}>| Precio unitario: ${containerData.unitPrice.toFixed(2)}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                          <strong style={{ fontSize: '1rem', color: '#059669', fontWeight: '700' }}>
                            ${containerData.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                            (${containerData.unitPrice.toFixed(2)} × {containerData.totalQuantity})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {loadingAllDeposits ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando depósitos...</div>
              ) : totalDepositsCount === 0 ? (
                <Card className="empty-state-card">
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                    <h3>No hay envases pendientes</h3>
                    <p>Todos los envases han sido devueltos</p>
                  </div>
                </Card>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {Object.values(depositsByClient).map((clientData, idx) => (
                    <Card key={idx} className="client-deposit-card" style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                      <div style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #059669' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#1f2937' }}>
                              {clientData.client.name}
                            </h3>
                            {'phone' in clientData.client && clientData.client.phone && (
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                                📱 {clientData.client.phone}
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block' }}>
                              {clientData.totalContainers} envase{clientData.totalContainers !== 1 ? 's' : ''}
                            </span>
                            <strong style={{ fontSize: '1.2rem', color: '#059669', fontWeight: '700' }}>
                              ${clientData.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {Object.values(
                            clientData.deposits.reduce((acc, deposit) => {
                              const containerName = deposit.containerName;
                              if (!acc[containerName]) {
                                acc[containerName] = {
                                  containerName,
                                  unitPrice: deposit.unitPrice,
                                  quantity: 0,
                                  amount: 0,
                                  deposits: [],
                                };
                              }
                              acc[containerName].quantity += deposit.quantity;
                              acc[containerName].amount += deposit.importAmount;
                              acc[containerName].deposits.push(deposit);
                              return acc;
                            }, {} as Record<string, { containerName: string; unitPrice: number; quantity: number; amount: number; deposits: ClientContainerDeposit[] }>)
                          ).map((containerData, containerIdx) => (
                            <div
                              key={containerIdx}
                              style={{
                                padding: '0.75rem',
                                backgroundColor: '#f0fdf4',
                                borderRadius: '4px',
                                border: '1px solid #a7f3d0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1f2937', display: 'block', marginBottom: '0.25rem' }}>
                                  {containerData.containerName}
                                </span>
                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                  <span>{containerData.quantity} envase{containerData.quantity !== 1 ? 's' : ''}</span>
                                  <span style={{ marginLeft: '0.5rem' }}>| Precio unitario: ${containerData.unitPrice.toFixed(2)}</span>
                                  {containerData.deposits.length > 1 && (
                                    <span style={{ marginLeft: '0.5rem' }}>| {containerData.deposits.length} depósito{containerData.deposits.length !== 1 ? 's' : ''}</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                                <strong style={{ fontSize: '1rem', color: '#059669', fontWeight: '700' }}>
                                  ${containerData.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </strong>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                                  (${containerData.unitPrice.toFixed(2)} × {containerData.quantity})
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
         {/* Modal para agregar/editar */}
         <ClientModal 
            isOpen={showAddForm}           
            onClose={handleCloseForm}
            onSave={handleSave}
            clientToEdit={clientToEdit}
          />
         
         {/* Modal para registrar abono */}
         <CreditPaymentModal
            isOpen={showPaymentModal}
            credit={selectedCredit}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedCredit(null);
            }}
            onPaymentSuccess={handlePaymentSuccess}
          />

         {/* Modal para ver historial de créditos */}
         <ClientCreditHistoryModal
            isOpen={showCreditHistory}
            client={selectedClientForHistory}
            onClose={() => {
              setShowCreditHistory(false);
              setSelectedClientForHistory(null);
            }}
          />

         {/* Modal para ver detalle de depósitos de envases */}
         <ClientContainerDepositsModal
            isOpen={showContainerDeposits}
            client={selectedClientForDeposits}
            onClose={() => {
              setShowContainerDeposits(false);
              setSelectedClientForDeposits(null);
            }}
            onReturnSuccess={() => {
              // Recargar la página actual cuando se regresa el importe
              reloadCurrentPage();
            }}
          />

         {/* Modal de acciones por cliente */}
         <ClientActionsModal
            isOpen={actionsClient !== null}
            client={actionsClient}
            pendingAmount={actionsClient ? (clientCredits[actionsClient.id]?.totalPending ?? 0) : 0}
            containersCount={actionsClient ? (clientContainerDeposits[actionsClient.id]?.totalContainers ?? 0) : 0}
            containersAmount={actionsClient ? (clientContainerDeposits[actionsClient.id]?.totalAmount ?? 0) : 0}
            onClose={() => setActionsClient(null)}
            onEdit={() => {
              if (actionsClient) handleEdit(actionsClient);
            }}
            onViewHistory={() => {
              if (actionsClient) handleViewCreditHistory(actionsClient);
            }}
            onPay={() => {
              if (actionsClient) handleOpenPaymentModal(actionsClient.id);
            }}
            onReturnContainers={() => {
              if (actionsClient) {
                setSelectedClientForDeposits(actionsClient);
                setShowContainerDeposits(true);
              }
            }}
          />
      </div>
    </div>
  );
};

export default ClientPage;
