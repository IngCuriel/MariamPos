import React, { useState, useEffect, useRef } from "react";
import { IoCloseCircleOutline, IoAddCircleOutline, IoSearchOutline } from "react-icons/io5";
import { getClients, createClient } from "../../api/clients";
import type { Client } from "../../types/index";
import Swal from "sweetalert2";
import "../../styles/pages/sales/paymentModal.css";

interface ClientSelectionModalProps {
  isOpen: boolean;
  currentClient: string;
  onClose: () => void;
  onSelect: (clientName: string, client?: Client) => void; // Ahora también devuelve el objeto Client
}

const ClientSelectionModal: React.FC<ClientSelectionModalProps> = ({
  isOpen,
  currentClient,
  onClose,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientAlias, setNewClientAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadClients();
      setSearchTerm("");
      setShowCreateForm(false);
      setNewClientName("");
      setNewClientAlias("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredClients(clients);
    } else {
      const search = searchTerm.toLowerCase();
      setFilteredClients(
        clients.filter(
          (client) =>
            client.name.toLowerCase().includes(search) ||
            client.alias?.toLowerCase().includes(search)
        )
      );
    }
  }, [searchTerm, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(data);
      setFilteredClients(data);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los clientes",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: Client) => {
    const displayName = client.alias ? `${client.name} (${client.alias})` : client.name;
    onSelect(displayName, client); // Pasar también el objeto Client completo
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

      // Seleccionar el cliente recién creado - pasar el objeto completo
      const displayName = newClient.alias
        ? `${newClient.name} (${newClient.alias})`
        : newClient.name;
      onSelect(displayName, newClient); // Pasar también el objeto Client completo
      onClose();
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo crear el cliente",
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

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown}>
      <div
        className="modal-container"
        style={{
          maxWidth: "650px",
          width: "95%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={32} />
        </button>

        <h2 className="modal-title" style={{ fontSize: "1.6rem", marginBottom: "10px", marginTop: "0" }}>
          👤 Seleccionar Cliente
        </h2>
        <p style={{ margin: "0 0 20px 0", fontSize: "0.9rem", color: "#6b7280", textAlign: "center" }}>
          Busca un cliente existente o crea uno nuevo
        </p>

        {!showCreateForm ? (
          <>
            {/* Barra de búsqueda */}
            <div className="input-section" style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "8px" }}>
                Buscar Cliente:
              </label>
              <div className="input-wrapper" style={{ position: "relative" }}>
                <IoSearchOutline
                  size={20}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9ca3af",
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por nombre o alias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredClients.length === 1) {
                      handleSelectClient(filteredClients[0]);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 10px 10px 40px",
                    fontSize: "1rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                  }}
                />
              </div>
            </div>

            {/* Lista de clientes */}
            <div
              style={{
                flex: 1,
                minHeight: "200px",
                maxHeight: "400px",
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                marginBottom: "20px",
                backgroundColor: "#fafafa",
              }}
            >
              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                  Cargando clientes...
                </div>
              ) : filteredClients.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                  {searchTerm ? "No se encontraron clientes" : "No hay clientes registrados"}
                </div>
              ) : (
                <div style={{ padding: "8px" }}>
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      style={{
                        padding: "14px 16px",
                        margin: "6px 8px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        backgroundColor: "#fff",
                        border: "2px solid #e5e7eb",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f0f9ff";
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.transform = "translateX(4px)";
                        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff";
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.transform = "translateX(0)";
                        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0", fontWeight: "600", fontSize: "1rem", color: "#1f2937" }}>
                            {client.name}
                          </p>
                          {client.alias && (
                            <div
                              style={{
                                marginTop: "6px",
                                display: "inline-block",
                                padding: "2px 8px",
                                backgroundColor: "#dbeafe",
                                borderRadius: "4px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.8rem",
                                  color: "#1e40af",
                                  fontWeight: "500",
                                }}
                              >
                                📌 {client.alias}
                              </span>
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: "1.3rem", color: "#3b82f6", marginLeft: "12px" }}>→</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón para crear nuevo cliente */}
            <div style={{ marginBottom: "15px" }}>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  // Enfocar el input de nombre completo después de mostrar el formulario
                  setTimeout(() => {
                    nameInputRef.current?.focus();
                  }, 100);
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#f3f4f6",
                  border: "2px dashed #d1d5db",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  color: "#374151",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#e5e7eb";
                  e.currentTarget.style.borderColor = "#9ca3af";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
              >
                <IoAddCircleOutline size={20} />
                Crear Nuevo Cliente
              </button>
            </div>

            {/* Cliente actual */}
            {currentClient && currentClient !== "Publico en General" && (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#dbeafe",
                  border: "1px solid #3b82f6",
                  borderRadius: "8px",
                  marginBottom: "15px",
                }}
              >
                <p style={{ margin: "0", fontSize: "0.85rem", color: "#1e40af", fontWeight: "600" }}>
                  Cliente actual: {currentClient}
                </p>
              </div>
            )}

            <div className="payment-modal-actions">
              <button className="cancel-btn-payment" onClick={onClose}>
                Cancelar (ESC)
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Formulario para crear cliente */}
            <div className="input-section" style={{ marginBottom: "15px" }}>
              <label style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "8px" }}>
                Nombre Completo <span style={{ color: "#dc2626" }}>*</span>
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
                  style={{ fontSize: "1rem", padding: "10px" }}
                />
              </div>
            </div>

            <div className="input-section" style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "8px" }}>
                Alias (Opcional)
              </label>
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
                  style={{ fontSize: "1rem", padding: "10px" }}
                />
              </div>
              <p style={{ marginTop: "5px", fontSize: "0.8rem", color: "#6b7280" }}>
                El alias ayuda a identificar mejor al cliente si hay nombres repetidos
              </p>
            </div>

            <div className="payment-modal-actions">
              <button
                className="cancel-btn-payment"
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
                className="confirm-btn"
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

