import React, { useState, useEffect } from 'react';
import '../../styles/pages/client.css';
import Header from '../../components/Header';
import type {Client, ClientCredit} from '../../types/index'
import { getClients,createClient } from "../../api/clients";
import { getClientCredits, getClientCreditSummary } from "../../api/credits";
import Card from '../../components/Card';
import Button from '../../components/Button';
import ClientModal from './ClientModal';
import CreditPaymentModal from './CreditPaymentModal';
import Swal from 'sweetalert2';

interface ClientPageProps {
  onBack: () => void;
}
 
const ClientPage: React.FC<ClientPageProps> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientCredits, setClientCredits] = useState<Record<string, { totalPending: number; credits: ClientCredit[] }>>({});
  const [selectedCredit, setSelectedCredit] = useState<ClientCredit | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);
  
  // 🟢 Llamada al API cuando el hook se monta
  useEffect(() => {
    fetchClients();
  }, []);

  // Cargar créditos pendientes cuando se cargan los clientes
  useEffect(() => {
    if (clients.length > 0) {
      loadAllClientCredits();
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

  const handlePaymentSuccess = () => {
    loadAllClientCredits();
    fetchClients(); // Recargar clientes por si cambió algo
  };

  const handleOpenPaymentModal = async (clientId: string) => {
    try {
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
    setShowAddForm(()=> true)
  };

  const handleCloseForm = () => {
    setShowAddForm(()=> false);
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (client:Omit<Client, "id">) => {
    await createClient(client);
    fetchClients();
  } 
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
              <Card className="search-card" style={{ 
                marginBottom: "16px", 
                backgroundColor: "#fef3c7", 
                border: "1px solid #f59e0b" 
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                  <strong style={{ color: "#92400e" }}>
                    {Object.keys(clientCredits).length} cliente(s) con créditos pendientes
                  </strong>
                </div>
              </Card>
            )}

            {/* Tabla de clientes */}
            <table className="client-table">
              <thead>
                <tr>
                  <th>*id</th>
                  <th>Nombre</th>
                  <th>Alias</th>
                  <th>Crédito</th>
                  <th>Límite</th>
                  <th>Pendiente</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => {
                  const credits = clientCredits[client.id];
                  const hasPending = credits && credits.totalPending > 0;
                  
                  return (
                    <tr 
                      key={client.id}
                      style={hasPending ? { backgroundColor: "#fef3c7" } : {}}
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
                        {hasPending && (
                          <Button
                            variant="success"
                            onClick={() => handleOpenPaymentModal(client.id)}
                            style={{ 
                              padding: "4px 12px", 
                              fontSize: "0.85rem",
                              backgroundColor: "#059669"
                            }}
                          >
                            💳 Abonar
                          </Button>
                        )}
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
      </div>
    </div>
  );
};

export default ClientPage;
