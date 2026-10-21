import React, { useState, useEffect, useRef } from 'react';
import '../../styles/pages/client.css';
// Reutilizamos los estilos de layout del catálogo (filtros, tabla, paginación)
// para unificar el diseño entre las pantallas del sistema.
import '../../styles/pages/products/catalog.css';
import Header from '../../components/Header';
import type { Client } from '../../types/index';
import { getClientsPaginated, createClient, updateClient } from '../../api/clients';
import Card from '../../components/Card';
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
  const CLIENTS_PER_PAGE = 25;

  const inputRef = useRef<HTMLInputElement>(null);

  // Carga la página de clientes desde el servidor (25 por página).
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Única fuente de carga: reacciona a página y término de búsqueda con debounce.
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

  const safePage = Math.min(currentPage, totalPages);

  const handleSave = async (client: Omit<Client, 'id'>) => {
    if (clientToEdit) {
      await updateClient(clientToEdit.id, client);
    } else {
      await createClient(client);
    }
    reloadCurrentPage();
    setClientToEdit(null);
  };

  return (
    <div className="client-page">
      <Header
        title="👥 Catálogo de Clientes"
        onBack={onBack}
        backText="← Volver al Menú Principal"
      />

      <div className="catalog-content client-content">
        {/* Sección de Filtros (mismo bloque que el catálogo) */}
        <Card className="catalog-filters-section">
          <div className="catalog-filters">
            <div className="catalog-filter-group">
              <label htmlFor="client-search" className="catalog-filter-label">
                Buscar
              </label>
              <input
                ref={inputRef}
                id="client-search"
                type="text"
                placeholder="Nombre, alias o celular..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="catalog-search-input"
              />
            </div>

            <div className="catalog-filter-group catalog-actions-group">
              <button
                type="button"
                className="client-add-btn"
                onClick={handleAddNew}
              >
                ➕ Nuevo Cliente
              </button>
            </div>
          </div>
        </Card>

        {/* Tabla de clientes (mismo contenedor que el catálogo) */}
        <Card className="catalog-table-card client-table-card">
          <div className="client-table-container">
            {loadingClients ? (
              <div className="loading">Cargando clientes...</div>
            ) : clients.length === 0 ? (
              <div className="no-results">
                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </div>
            ) : (
              <table className="client-table">
                <thead>
                  <tr>
                    <th className="client-th-num">#</th>
                    <th>Nombre</th>
                    <th>Alias</th>
                    <th>Celular</th>
                    <th>Crédito</th>
                    <th>Límite</th>
                    <th>Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, index) => (
                    <tr key={client.id}>
                      {/* Número consecutivo global según la página actual. */}
                      <td className="client-td-num">
                        {(safePage - 1) * CLIENTS_PER_PAGE + index + 1}
                      </td>
                      <td>
                        <span className="client-name-cell">{client.name}</span>
                      </td>
                      <td>{client.alias || '-'}</td>
                      <td>{client.phone || '-'}</td>
                      <td>
                        <span
                          className={`client-credit-chip ${
                            client.allowCredit
                              ? 'client-credit-chip--yes'
                              : 'client-credit-chip--no'
                          }`}
                        >
                          {client.allowCredit ? '✅ Sí' : '❌ No'}
                        </span>
                      </td>
                      <td className="client-td-money">
                        {client.allowCredit
                          ? client.creditLimit?.toLocaleString('es-MX', {
                              style: 'currency',
                              currency: 'MXN',
                            }) || '$0.00'
                          : '-'}
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Footer con paginación (estilo catálogo) */}
        {totalClients > 0 && (
          <div className="client-footer-bar">
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
            >
              ← Anterior
            </button>
            <span className="prod-page-info">
              Página {safePage} de {totalPages} ·{' '}
              {totalClients.toLocaleString('es-MX')} clientes
            </span>
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
            >
              Siguiente →
            </button>
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
  );
};

export default ClientPage;
