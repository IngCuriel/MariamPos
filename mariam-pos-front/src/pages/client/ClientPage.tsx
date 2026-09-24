import React, { useState, useEffect } from 'react';
import '../../styles/pages/client.css';
import Header from '../../components/Header';
import type {Client} from '../../types/index'
import { getClientsPaginated, createClient, updateClient } from "../../api/clients";
import Card from '../../components/Card';
import Button from '../../components/Button';
import ClientModal from './ClientModal';

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
  const CLIENTS_PER_PAGE = 7;

  // Carga la página de clientes desde el servidor (7 por página).
  // Ya no consulta créditos/depósitos por fila (eso vive en sus módulos
  // dedicados), evitando el problema N+1 al abrir/paginar.
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
    } catch (err) {
      console.error(err);
      setClients([]);
      setTotalPages(1);
      setTotalClients(0);
    } finally {
      setLoadingClients(false);
    }
  };

  // Recarga la página actual (tras crear/editar).
  const reloadCurrentPage = () => {
    void fetchClientsPage(currentPage, searchTerm);
  };

  // Única fuente de carga: reacciona a página y término de búsqueda con debounce.
  // Al escribir, primero se resetea a página 1 (efecto separado abajo) y este
  // efecto hace el fetch. Evita la doble carga que había con dos efectos.
  useEffect(() => {
    const id = setTimeout(() => {
      void fetchClientsPage(currentPage, searchTerm);
    }, searchTerm ? 350 : 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm]);

  // Al cambiar la búsqueda, volver a página 1 (si no lo está ya).
  useEffect(() => {
    setCurrentPage((prev) => (prev !== 1 ? 1 : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

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
                  <th>Editar</th>
                </tr>
              </thead>
              <tbody>
                {loadingClients ? (
                  <tr>
                    <td colSpan={6} className="client-table-state">Cargando clientes...</td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="client-table-state">
                      {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                    </td>
                  </tr>
                ) : (
                clients.map(client => {
                  return (
                    <tr key={client.id}>
                      <td>
                        <span className="client-name-cell">{client.name}</span>
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
                        <button
                          type="button"
                          className="client-edit-btn"
                          onClick={() => handleEdit(client)}
                        >
                          ✏️ Editar
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

        </div>
         {/* Modal para agregar/editar */}
         <ClientModal 
            isOpen={showAddForm}           
            onClose={handleCloseForm}
            onSave={handleSave}
            clientToEdit={clientToEdit}
          />
      </div>
    </div>
  );
};

export default ClientPage;
