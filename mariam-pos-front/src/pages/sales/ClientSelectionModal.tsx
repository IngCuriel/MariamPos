import React, { useState, useEffect, useRef, useCallback } from "react";
import { IoCloseCircleOutline, IoAddCircleOutline, IoSearchOutline } from "react-icons/io5";
import { getClientsPaginated, createClient } from "../../api/clients";
import type { Client } from "../../types/index";
import Swal from "sweetalert2";
import "../../styles/pages/sales/paymentModal.css";
import "../../styles/pages/sales/clientSelectionModal.css";

interface ClientSelectionModalProps {
  isOpen: boolean;
  currentClient: string;
  onClose: () => void;
  onSelect: (clientName: string, client?: Client) => void; // Ahora también devuelve el objeto Client
}

const CLIENTS_PER_PAGE = 8;

const ClientSelectionModal: React.FC<ClientSelectionModalProps> = ({
  isOpen,
  currentClient,
  onClose,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientAlias, setNewClientAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const loadClients = useCallback(async (page: number, search: string) => {
    try {
      setLoading(true);
      const result = await getClientsPaginated(page, CLIENTS_PER_PAGE, search);
      setClients(result.clients);
      setTotalPages(result.pagination.totalPages);
      setTotalClients(result.pagination.total);
      if (result.pagination.page !== page) {
        setCurrentPage(result.pagination.page);
      }
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los clientes",
      });
      setClients([]);
      setTotalPages(1);
      setTotalClients(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Al abrir el modal: reset y carga inicial.
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setShowCreateForm(false);
      setNewClientName("");
      setNewClientAlias("");
      setCurrentPage(1);
      void loadClients(1, "");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, loadClients]);

  // Enfocar el input de nombre completo cuando se muestra el formulario de creación
  useEffect(() => {
    if (showCreateForm) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [showCreateForm]);

  // Búsqueda con debounce (server-side): al escribir, vuelve a página 1.
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        void loadClients(1, searchTerm);
      }
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Cambio de página (no dispara en el mismo tick que la búsqueda gracias al guard).
  useEffect(() => {
    if (!isOpen) return;
    void loadClients(currentPage, searchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const getPageNumbers = (): number[] => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleSelectClient = (client: Client) => {
    const displayName = client.alias ? `${client.name} (${client.alias})` : client.name;
    onSelect(displayName, client);
    onClose();
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Nombre requerido",
        text: "Por favor ingresa el nombre del cliente",
      });
      nameInputRef.current?.focus();
      return;
    }

    setCreating(true);
    try {
      const newClient = await createClient({
        name: newClientName.trim(),
        alias: newClientAlias.trim() || undefined,
      });

      const displayName = newClient.alias
        ? `${newClient.name} (${newClient.alias})`
        : newClient.name;
      onSelect(displayName, newClient);
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se pudo crear el cliente";
      Swal.fire({
        icon: "error",
        title: "Error",
        text: message,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && showCreateForm && newClientName.trim()) {
      handleCreateClient();
    }
  };

  if (!isOpen) return null;

  const pageStartIndex = (currentPage - 1) * CLIENTS_PER_PAGE;

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown}>
      <div className="modal-container client-modal">
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={32} />
        </button>

        <h2 className="modal-title client-modal-title">👤 Seleccionar Cliente</h2>
        <p className="client-modal-subtitle">Busca un cliente existente o crea uno nuevo</p>

        {!showCreateForm ? (
          <>
            {/* Barra de búsqueda + crear cliente, en una sola fila */}
            <div className="client-modal-searchbar">
              <IoSearchOutline size={22} className="client-modal-searchbar-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre o alias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clients.length === 1) {
                    handleSelectClient(clients[0]);
                  }
                }}
                className="client-modal-input client-modal-searchbar-input"
              />
              <button
                type="button"
                className="client-modal-create-trigger client-modal-create-trigger--inline"
                onClick={() => setShowCreateForm(true)}
              >
                <IoAddCircleOutline size={20} />
                Crear Nuevo Cliente
              </button>
            </div>

            {/* Lista de clientes */}
            <div className="client-modal-list">
              {loading ? (
                <div className="client-modal-list-state">Cargando clientes...</div>
              ) : clients.length === 0 ? (
                <div className="client-modal-list-state">
                  {searchTerm ? "No se encontraron clientes" : "No hay clientes registrados"}
                </div>
              ) : (
                clients.map((client) => (
                  <div
                    key={client.id}
                    className="client-modal-row"
                    onClick={() => handleSelectClient(client)}
                  >
                    <div className="client-modal-row-info">
                      <p className="client-modal-row-name">{client.name}</p>
                      {client.alias && (
                        <span className="client-modal-row-alias">📌 {client.alias}</span>
                      )}
                    </div>
                    <span className="client-modal-row-arrow">→</span>
                  </div>
                ))
              )}
            </div>

            {/* Paginación */}
            {totalClients > 0 && (
              <div className="client-modal-pagination">
                <span className="client-modal-pagination-info">
                  {pageStartIndex + 1}–{Math.min(pageStartIndex + CLIENTS_PER_PAGE, totalClients)} de {totalClients}
                </span>
                <div className="client-modal-pagination-controls">
                  <button
                    type="button"
                    className="client-modal-pagination-btn"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1 || loading}
                    aria-label="Primera página"
                  >
                    ⏮
                  </button>
                  <button
                    type="button"
                    className="client-modal-pagination-btn"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    aria-label="Página anterior"
                  >
                    ‹
                  </button>
                  {getPageNumbers().map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={`client-modal-pagination-btn ${page === currentPage ? 'client-modal-pagination-btn--active' : ''}`}
                      onClick={() => goToPage(page)}
                      disabled={loading}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="client-modal-pagination-btn"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    aria-label="Página siguiente"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="client-modal-pagination-btn"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages || loading}
                    aria-label="Última página"
                  >
                    ⏭
                  </button>
                </div>
              </div>
            )}

            {/* Cliente actual */}
            {currentClient && currentClient !== "Publico en General" && (
              <div className="client-modal-current">
                <p className="client-modal-current-text">Cliente actual: {currentClient}</p>
              </div>
            )}

            <div className="payment-modal-actions client-modal-actions">
              <button
                type="button"
                className="client-modal-btn client-modal-btn--secondary"
                onClick={onClose}
              >
                Cancelar (ESC)
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Formulario para crear cliente */}
            <div className="input-section client-modal-field">
              <label className="client-modal-label">
                Nombre Completo <span className="client-modal-label-required">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="Ej: Juan Pérez García"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newClientName.trim()) {
                      e.preventDefault();
                      if (newClientAlias.trim()) {
                        handleCreateClient();
                      } else {
                        const aliasInput = document.getElementById("alias-input") as HTMLInputElement;
                        aliasInput?.focus();
                      }
                    }
                  }}
                  className="client-modal-input"
                />
              </div>
            </div>

            <div className="input-section client-modal-field">
              <label className="client-modal-label">Alias (Opcional)</label>
              <div className="input-wrapper">
                <input
                  id="alias-input"
                  type="text"
                  placeholder="Ej: Juanito, Don Juan, etc."
                  value={newClientAlias}
                  onChange={(e) => setNewClientAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newClientName.trim()) {
                      e.preventDefault();
                      handleCreateClient();
                    }
                  }}
                  className="client-modal-input"
                />
              </div>
              <p className="client-modal-hint">
                El alias ayuda a identificar mejor al cliente si hay nombres repetidos
              </p>
            </div>

            <div className="payment-modal-actions client-modal-actions">
              <button
                type="button"
                className="client-modal-btn client-modal-btn--secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewClientName("");
                  setNewClientAlias("");
                  setTimeout(() => {
                    searchInputRef.current?.focus();
                  }, 100);
                }}
                disabled={creating}
              >
                Volver
              </button>
              <button
                type="button"
                className="client-modal-btn client-modal-btn--primary"
                onClick={handleCreateClient}
                disabled={creating || !newClientName.trim()}
              >
                {creating ? "Creando..." : "Crear Cliente"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClientSelectionModal;
