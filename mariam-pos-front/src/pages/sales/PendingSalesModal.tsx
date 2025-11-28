import React, { useEffect, useState } from "react";
import { getPendingSales, deletePendingSale, type PendingSale } from "../../api/pendingSales";
import Swal from "sweetalert2";
import "../../styles/pages/sales/pendingSalesModal.css";

interface PendingSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pendingSale: PendingSale) => void;
}

const PendingSalesModal: React.FC<PendingSalesModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPendingSales();
    }
  }, [isOpen]);

  const loadPendingSales = async () => {
    try {
      setLoading(true);
      const sales = await getPendingSales();
      setPendingSales(sales);
    } catch (error) {
      console.error("Error al cargar ventas pendientes:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las ventas pendientes",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPendingSales();
  };

  const handleSelect = async (pendingSale: PendingSale) => {
    const { value: confirm } = await Swal.fire({
      title: "Cargar venta pendiente",
      html: `
        <div style="text-align: left; margin: 20px 0;">
          <p><strong>Código:</strong> ${pendingSale.code}</p>
          <p><strong>Cliente:</strong> ${pendingSale.clientName || "Sin nombre"}</p>
          <p><strong>Total:</strong> ${pendingSale.total.toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
          })}</p>
          <p><strong>Productos:</strong> ${pendingSale.details.length}</p>
        </div>
        <p style="margin-top: 15px;">¿Deseas cargar esta venta pendiente?</p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cargar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#4CAF50",
      cancelButtonColor: "#6b7280",
      allowOutsideClick: false,
      allowEscapeKey: true,
    });

    if (confirm) {
      // Cerrar el modal principal
      onClose();
      
      // Eliminar de la base de datos
      try {
        await deletePendingSale(pendingSale.id);
        onSelect(pendingSale);
      } catch (error) {
        console.error("Error al eliminar venta pendiente:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo cargar la venta pendiente",
        });
      }
    }
  };

  const handleDelete = async (pendingSale: PendingSale, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const { value: confirm } = await Swal.fire({
      title: "Eliminar venta pendiente",
      html: `
        <p>¿Estás seguro de eliminar la venta pendiente?</p>
        <p style="margin-top: 10px;"><strong>${pendingSale.code}</strong></p>
        <p>Cliente: ${pendingSale.clientName || "Sin nombre"}</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      allowOutsideClick: false,
      allowEscapeKey: true,
    });

    if (confirm) {
      try {
        await deletePendingSale(pendingSale.id);
        // Recargar la lista
        await loadPendingSales();
        Swal.fire({
          icon: "success",
          title: "Eliminada",
          text: "La venta pendiente se eliminó correctamente",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error("Error al eliminar venta pendiente:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo eliminar la venta pendiente",
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="pending-sales-modal-overlay" onClick={onClose}>
      <div className="pending-sales-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="pending-sales-modal-header">
          <h2 className="pending-sales-modal-title">Ventas Pendientes</h2>
          <div className="pending-sales-modal-actions">
            <button
              className="pending-sales-refresh-btn-large"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Cargar nuevas ventas"
            >
              {refreshing ? (
                <>
                  <span className="pending-sales-refresh-spinner">🔄</span>
                  <span>Cargando...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Cargar Nuevas</span>
                </>
              )}
            </button>
            <button
              className="pending-sales-close-btn"
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="pending-sales-modal-body">
          {loading ? (
            <div className="pending-sales-loading">
              <div className="pending-sales-spinner"></div>
              <p>Cargando ventas pendientes...</p>
            </div>
          ) : pendingSales.length === 0 ? (
            <div className="pending-sales-empty">
              <div className="pending-sales-empty-icon">📋</div>
              <p className="pending-sales-empty-title">No hay ventas pendientes</p>
              <p className="pending-sales-empty-text">
                Las ventas que guardes como pendientes aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="pending-sales-list">
              {pendingSales.map((pendingSale) => (
                <div
                  key={pendingSale.id}
                  className="pending-sales-card"
                  onClick={() => handleSelect(pendingSale)}
                >
                  <div className="pending-sales-card-header">
                    <div className="pending-sales-code">
                      <span className="pending-sales-code-label">Código:</span>
                      <span className="pending-sales-code-value">{pendingSale.code}</span>
                    </div>
                    <button
                      className="pending-sales-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDelete(pendingSale, e);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      title="Eliminar"
                      type="button"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="pending-sales-card-body">
                    <div className="pending-sales-info-row">
                      <span className="pending-sales-info-label">Cliente:</span>
                      <span className="pending-sales-info-value">
                        {pendingSale.clientName || "Sin nombre"}
                      </span>
                    </div>

                    <div className="pending-sales-info-row">
                      <span className="pending-sales-info-label">Total:</span>
                      <span className="pending-sales-total">
                        {pendingSale.total.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </span>
                    </div>

                    <div className="pending-sales-info-row">
                      <span className="pending-sales-info-label">Productos:</span>
                      <span className="pending-sales-info-value">
                        {pendingSale.details.length} {pendingSale.details.length === 1 ? "producto" : "productos"}
                      </span>
                    </div>

                    <div className="pending-sales-info-row">
                      <span className="pending-sales-info-label">Fecha:</span>
                      <span className="pending-sales-info-value">
                        {formatDate(pendingSale.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="pending-sales-card-footer">
                    <button className="pending-sales-load-btn">
                      Cargar Venta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pending-sales-modal-footer">
          <button className="pending-sales-cancel-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingSalesModal;

