import React, { useEffect, useState } from "react";
import { getPendingSales, deletePendingSale, type PendingSale } from "../../api/pendingSales";
import Swal from "sweetalert2";
import PendingSaleDetailModal from "./PendingSaleDetailModal";
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
  const [detailSale, setDetailSale] = useState<PendingSale | null>(null); // venta cuyos productos se ven en detalle

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
        <div style="text-align: center; margin: 16px 0;">
          <p style="font-size: 13px; color: #6b7280; margin: 0;">Folio</p>
          <p style="font-size: 22px; font-weight: 800; color: #4f46e5; font-family: 'Courier New', monospace; margin: 4px 0;">${pendingSale.code}</p>
          <p style="font-size: 20px; font-weight: 700; color: #059669; margin: 8px 0 0;">${pendingSale.total.toLocaleString(
            "es-MX",
            { style: "currency", currency: "MXN" }
          )}</p>
          <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0;">${pendingSale.details.length} ${
        pendingSale.details.length === 1 ? "producto" : "productos"
      }</p>
        </div>
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
        <p style="margin-top: 10px; font-size: 20px; font-weight: 800; color: #4f46e5; font-family: 'Courier New', monospace;">${pendingSale.code}</p>
        ${pendingSale.clientName ? `<p style="color:#6b7280; font-size:13px;">📝 ${pendingSale.clientName}</p>` : ""}
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
    <>
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
                <div key={pendingSale.id} className="pending-sales-card">
                  {/* Encabezado: folio + eliminar */}
                  <div className="ps-card-top">
                    <div className="ps-folio">
                      <span className="ps-folio-label">Folio</span>
                      <span className="ps-folio-value">{pendingSale.code}</span>
                    </div>
                    <button
                      className="pending-sales-delete-btn"
                      onClick={(e) => handleDelete(pendingSale, e)}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Eliminar"
                      type="button"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Meta: total, productos, fecha */}
                  <div className="ps-meta">
                    <span className="ps-total">
                      {pendingSale.total.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                    <span className="ps-meta-sub">
                      {pendingSale.details.length}{" "}
                      {pendingSale.details.length === 1 ? "producto" : "productos"} ·{" "}
                      {formatDate(pendingSale.createdAt)}
                    </span>
                    {pendingSale.clientName && (
                      <span className="ps-note">📝 {pendingSale.clientName}</span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="ps-actions">
                    <button
                      className="ps-btn ps-btn--ghost"
                      onClick={() => setDetailSale(pendingSale)}
                      type="button"
                    >
                      👁 Ver productos
                    </button>
                    <button
                      className="ps-btn ps-btn--load"
                      onClick={() => handleSelect(pendingSale)}
                      type="button"
                    >
                      Cargar venta
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

    <PendingSaleDetailModal
      isOpen={detailSale !== null}
      pendingSale={detailSale}
      onClose={() => setDetailSale(null)}
    />
    </>
  );
};

export default PendingSalesModal;

