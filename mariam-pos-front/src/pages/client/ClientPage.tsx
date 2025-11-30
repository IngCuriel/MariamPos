import React, { useState, useEffect } from 'react';
import '../../styles/pages/client.css';
import Header from '../../components/Header';
import type {Client, ClientCredit} from '../../types/index'
import { getClients, createClient, updateClient } from "../../api/clients";
import { getClientCredits, getClientCreditSummary } from "../../api/credits";
import { getClientPendingDeposits } from "../../api/clientContainerDeposits";
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
  const [clientCredits, setClientCredits] = useState<Record<string, { totalPending: number; credits: ClientCredit[] }>>({});
  const [clientContainerDeposits, setClientContainerDeposits] = useState<Record<string, { totalContainers: number; totalAmount: number; summary: any[] }>>({});
  const [selectedCredit, setSelectedCredit] = useState<ClientCredit | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditHistory, setShowCreditHistory] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
  const [showContainerDeposits, setShowContainerDeposits] = useState(false);
  const [selectedClientForDeposits, setSelectedClientForDeposits] = useState<Client | null>(null);
  const [_loadingCredits, setLoadingCredits] = useState(false);
  
  // 🟢 Llamada al API cuando el hook se monta
  useEffect(() => {
    fetchClients();
  }, []);

  // Cargar créditos y depósitos pendientes cuando se cargan los clientes
  useEffect(() => {
    if (clients.length > 0) {
      loadAllClientCredits();
      loadAllClientContainerDeposits();
    }
  }, [clients]);

  const fetchClients = async () => {
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllClientCredits = async () => {
    setLoadingCredits(true);
    try {
      const creditsMap: Record<string, { totalPending: number; credits: ClientCredit[] }> = {};
      
      // Cargar créditos solo de clientes que tienen crédito habilitado
      const clientsWithCredit = clients.filter(c => c.allowCredit);
      
      await Promise.all(
        clientsWithCredit.map(async (client) => {
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
        })
      );
      
      setClientCredits(creditsMap);
    } catch (error) {
      console.error("Error al cargar créditos:", error);
    } finally {
      setLoadingCredits(false);
    }
  };

  const loadAllClientContainerDeposits = async () => {
    try {
      const depositsMap: Record<string, { totalContainers: number; totalAmount: number; summary: any[] }> = {};
      
      await Promise.all(
        clients.map(async (client) => {
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
      
      setClientContainerDeposits(depositsMap);
    } catch (error) {
      console.error("Error al cargar depósitos de envases:", error);
    }
  };

  const handlePaymentSuccess = () => {
    loadAllClientCredits();
    loadAllClientContainerDeposits();
    fetchClients(); // Recargar clientes por si cambió algo
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
                  Venta #${credit.saleId} - Saldo: $${credit.remainingAmount.toFixed(2)}
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

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.alias && client.alias.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.phone && client.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSave = async (client: Omit<Client, "id">) => {
    if (clientToEdit) {
      // Modo edición
      await updateClient(clientToEdit.id, client);
    } else {
      // Modo creación
      await createClient(client);
    }
    fetchClients();
    setClientToEdit(null);
  };

  const handleViewCreditHistory = (client: Client) => {
    setSelectedClientForHistory(client);
    setShowCreditHistory(true);
  }; 
  return (
    <div className="app-client">
      <div className="client-container">
        <Header
          title="Catálogo de Clientes"
          onBack={onBack}
          backText="← Volver"
          className="catalog-header"
        />
        <div className="client-content">
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
            {/* Alerta de clientes con créditos pendientes */}
            {Object.keys(clientCredits).length > 0 && (
              <div style={{ 
                marginBottom: "16px", 
                backgroundColor: "#fef3c7", 
                border: "1px solid #f59e0b",
                borderRadius: "8px",
                padding: "16px"
              }}>
                <Card className="search-card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                  <strong style={{ color: "#92400e" }}>
                    {Object.keys(clientCredits).length} cliente(s) con créditos pendientes
                  </strong>
                </div>
                </Card>
              </div>
            )}

            {/* Alerta de clientes con depósitos de envases pendientes */}
            {Object.keys(clientContainerDeposits).length > 0 && (
              <div style={{ 
                marginBottom: "16px", 
                backgroundColor: "#ecfdf5", 
                border: "1px solid #059669",
                borderRadius: "8px",
                padding: "16px"
              }}>
                <Card className="search-card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.2rem" }}>🍺</span>
                  <strong style={{ color: "#065f46" }}>
                    {Object.keys(clientContainerDeposits).length} cliente(s) con depósitos de envases pendientes
                  </strong>
                </div>
                </Card>
              </div>
            )}

            {/* Tabla de clientes */}
            <table className="client-table">
              <thead>
                <tr>
                  <th>*id</th>
                  <th>Nombre</th>
                  <th>Alias</th>
                  <th>Celular</th>
                  <th>Crédito</th>
                  <th>Límite</th>
                  <th>Pendiente</th>
                  <th>Envases</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => {
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
                      <td>{client.id}</td>
                      <td>
                        {client.name}
                        {hasPending && (
                          <span style={{ 
                            marginLeft: "8px", 
                            color: "#dc2626", 
                            fontWeight: "600",
                            fontSize: "0.85rem"
                          }}>
                            ⚠️ Debe
                          </span>
                        )}
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
                          <div 
                            style={{ 
                              display: "flex", 
                              flexDirection: "column", 
                              gap: "2px",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              setSelectedClientForDeposits(client);
                              setShowContainerDeposits(true);
                            }}
                            title="Click para ver detalle de envases"
                          >
                            <strong style={{ color: "#059669", fontSize: "0.9rem" }}>
                              {deposits.totalContainers} envase{deposits.totalContainers !== 1 ? 's' : ''}
                            </strong>
                            <span style={{ color: "#059669", fontSize: "0.85rem" }}>
                              ${deposits.totalAmount.toFixed(2)}
                            </span>
                            <span style={{ color: "#059669", fontSize: "0.75rem", fontStyle: "italic" }}>
                              (Click para ver detalle)
                            </span>
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          <Button
                            variant="secondary"
                            onClick={() => handleEdit(client)}
                            className="button-small"
                          >
                            ✏️ Editar
                          </Button>
                          {client.allowCredit && (
                            <Button
                              variant="info"
                              onClick={() => handleViewCreditHistory(client)}
                              className="button-small"
                            >
                              📋 Historial
                            </Button>
                          )}
                          {hasPending && (
                            <Button
                              variant="success"
                              onClick={() => handleOpenPaymentModal(client.id)}
                              className="button-small"
                            >
                              💳 Abonar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              // Recargar depósitos cuando se regresa el importe
              loadAllClientContainerDeposits();
            }}
          />
      </div>
    </div>
  );
};

export default ClientPage;
