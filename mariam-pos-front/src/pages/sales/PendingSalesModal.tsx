import React, { useEffect, useState } from "react";
import { getPendingSales, deletePendingSale, type PendingSale, type PendingSaleStatus } from "../../api/pendingSales";
import Swal from "sweetalert2";
import PendingSaleDetailModal from "./PendingSaleDetailModal";
import "../../styles/pages/sales/pendingSalesModal.css";

interface PendingSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pendingSale: PendingSale) => void;
}

// Fecha de HOY en zona horaria de México (America/Mexico_City), formato YYYY-MM-DD.
// Se usa como valor por defecto del rango de fechas de la pestaña "Pagadas".
const todayMexico = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // en-CA entrega directamente YYYY-MM-DD

const PendingSalesModal: React.FC<PendingSalesModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  // Pestaña activa: folios por cobrar (PENDING) o ya cobrados (PAID).
  const [activeTab, setActiveTab] = useState<PendingSaleStatus>("PENDING");
  // Rango de fechas de la pestaña "Pagadas" (por defecto: HOY en zona México).
  const [startDate, setStartDate] = useState<string>(todayMexico());
  const [endDate, setEndDate] = useState<string>(todayMexico());
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailSale, setDetailSale] = useState<PendingSale | null>(null); // venta cuyos productos se ven en detalle

  // Recargar al abrir el modal o al cambiar de pestaña.
  useEffect(() => {
    if (isOpen) {
      loadPendingSales(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab]);

  const loadPendingSales = async (status: PendingSaleStatus) => {
    try {
      setLoading(true);
      // Lista los folios del estado de la pestaña activa:
      // - PENDING: folios cobrables (todos los por cobrar, sin filtro de fecha).
      // - PAID: folios ya cobrados (solo lectura), filtrados por rango de fechas
      //   sobre la fecha de cobro (paidAt).
      const sales = await getPendingSales(
        status === "PAID" ? { status, startDate, endDate } : { status }
      );
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
    await loadPendingSales(activeTab);
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

      // Cargar el folio como bloque inmutable SIN eliminar la venta pendiente.
      // La venta pendiente se conserva en PENDING y solo pasa a PAID al cobrar.
      onSelect(pendingSale);
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
        // Recargar la lista de la pestaña activa
        await loadPendingSales(activeTab);
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
              title="Actualizar lista"
            >
              {refreshing ? (
                <>
                  <span className="pending-sales-refresh-spinner">🔄</span>
                  <span>Cargando...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Actualizar</span>
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

        {/* Pestañas: por cobrar (PENDING) vs ya cobradas (PAID) */}
        <div className="pending-sales-tabs">
          <button
            type="button"
            className={`pending-sales-tab ${activeTab === "PENDING" ? "pending-sales-tab--active" : ""}`}
            onClick={() => setActiveTab("PENDING")}
          >
            🟡 Pendientes
          </button>
          <button
            type="button"
            className={`pending-sales-tab ${activeTab === "PAID" ? "pending-sales-tab--active" : ""}`}
            onClick={() => setActiveTab("PAID")}
          >
            🟢 Pagadas
          </button>
        </div>

        {/* Filtro de rango de fechas (solo Pagadas): por defecto HOY (zona México) */}
        {activeTab === "PAID" && (
          <div className="pending-sales-filters">
            <div className="ps-filter-field">
              <label htmlFor="ps-start">Desde</label>
              <input
                id="ps-start"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="ps-filter-field">
              <label htmlFor="ps-end">Hasta</label>
              <input
                id="ps-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="ps-filter-search"
              onClick={() => loadPendingSales("PAID")}
              disabled={loading}
            >
              {loading ? "Buscando..." : "🔍 Buscar"}
            </button>
          </div>
        )}

        <div className="pending-sales-modal-body">
          {loading ? (
            <div className="pending-sales-loading">
              <div className="pending-sales-spinner"></div>
              <p>
                {activeTab === "PENDING"
                  ? "Cargando ventas pendientes..."
                  : "Cargando ventas pagadas..."}
              </p>
            </div>
          ) : pendingSales.length === 0 ? (
            <div className="pending-sales-empty">
              <div className="pending-sales-empty-icon">
                {activeTab === "PENDING" ? "📋" : "🧾"}
              </div>
              <p className="pending-sales-empty-title">
                {activeTab === "PENDING"
                  ? "No hay ventas pendientes"
                  : "No hay ventas pagadas"}
              </p>
              <p className="pending-sales-empty-text">
                {activeTab === "PENDING"
                  ? "Las ventas que guardes como pendientes aparecerán aquí"
                  : "Los folios que ya fueron cobrados aparecerán aquí"}
              </p>
            </div>
          ) : (
            <div className="pending-sales-list">
              {pendingSales.map((pendingSale) => (
                <div key={pendingSale.id} className="pending-sales-card">
                  {/* Fila superior: folio + utilidades.
                      En Pendientes: 👁 ver + 🗑️ eliminar (el primario abajo es "Cargar").
                      En Pagadas: sin íconos (el primario abajo ya es "Ver productos"). */}
                  <div className="ps-card-top">
                    <span className="ps-folio-value">{pendingSale.code}</span>
                    {activeTab === "PENDING" && (
                      <div className="ps-icon-actions">
                        <button
                          className="ps-icon-btn"
                          onClick={() => setDetailSale(pendingSale)}
                          type="button"
                          title="Ver productos"
                          aria-label="Ver productos"
                        >
                          👁
                        </button>
                        <button
                          className="ps-icon-btn ps-icon-btn--danger"
                          onClick={(e) => handleDelete(pendingSale, e)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Eliminar folio"
                          aria-label="Eliminar folio"
                          type="button"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Total destacado */}
                  <div className="ps-total-row">
                    <span className="ps-total">
                      {pendingSale.total.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                    {activeTab === "PAID" && (
                      <span className="ps-paid-badge" title="Folio cobrado">
                        🟢 Pagado
                      </span>
                    )}
                  </div>

                  {/* Meta mínima: productos + cliente (desambiguación) */}
                  <div className="ps-meta-line">
                    <span className="ps-meta-sub">
                      {pendingSale.details.length}{" "}
                      {pendingSale.details.length === 1 ? "producto" : "productos"}
                    </span>
                    {pendingSale.clientName && (
                      <span className="ps-client" title={pendingSale.clientName}>
                        · {pendingSale.clientName}
                      </span>
                    )}
                  </div>

                  {/* Acción principal full-width */}
                  {activeTab === "PENDING" ? (
                    <button
                      className="ps-primary-btn"
                      onClick={() => handleSelect(pendingSale)}
                      type="button"
                    >
                      Cargar venta
                    </button>
                  ) : (
                    <button
                      className="ps-primary-btn ps-primary-btn--view"
                      onClick={() => setDetailSale(pendingSale)}
                      type="button"
                    >
                      Ver productos
                    </button>
                  )}
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

