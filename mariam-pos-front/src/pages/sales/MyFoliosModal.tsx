import React, { useEffect, useState } from "react";
import {
  getPendingSales,
  type PendingSale,
  type PendingSaleStatus,
} from "../../api/pendingSales";
import PendingSaleDetailModal from "./PendingSaleDetailModal";
import "../../styles/pages/sales/pendingSalesModal.css";
import "../../styles/pages/sales/myFoliosModal.css";

interface MyFoliosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Semáforo de estado (Req 7.1)
const STATUS_BADGE: Record<PendingSaleStatus, string> = {
  PENDING: "🟡",
  PAID: "🟢",
};

const STATUS_LABEL: Record<PendingSaleStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
};

// Intervalo de refresco automático del polling (Req 7.5)
const POLL_INTERVAL_MS = 15000;

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const MyFoliosModal: React.FC<MyFoliosModalProps> = ({ isOpen, onClose }) => {
  // Caja_Origen leída de localStorage (Req 7.2)
  const caja = localStorage.getItem("caja");

  const [folios, setFolios] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [detailSale, setDetailSale] = useState<PendingSale | null>(null);

  // Carga filtrada por la caja de origen (Req 7.2)
  const load = async () => {
    // Sin caja no se consulta la API: resultado vacío, sin folios de otras cajas (Req 7.3)
    if (!caja) {
      setFolios([]);
      return;
    }
    try {
      setLoading(true);
      const sales = await getPendingSales({ cashRegister: caja });
      setFolios(sales);
    } catch (error) {
      // Ante fallo de la consulta, conservar la última lista y reintentar en el
      // siguiente ciclo de polling (Req 7.5). No se limpia `folios`.
      console.error("Error al cargar los folios:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresco manual: vuelve a consultar y actualiza el estado mostrado (Req 7.4)
  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  // Carga al abrir el modal
  useEffect(() => {
    if (isOpen) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Polling simple: solo mientras el modal está abierto, hay caja y el refresco
  // automático está habilitado; se limpia el intervalo en el cleanup (Req 7.5)
  useEffect(() => {
    if (!isOpen || !caja || !autoRefresh) return;
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, caja, autoRefresh]);

  if (!isOpen) return null;

  return (
    <>
      <div className="pending-sales-modal-overlay" onClick={onClose}>
        <div
          className="pending-sales-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pending-sales-modal-header">
            <h2 className="pending-sales-modal-title">Mis Folios</h2>
            <div className="pending-sales-modal-actions">
              {caja && (
                <>
                  {/* Toggle de refresco automático / polling (Req 7.5) */}
                  <label className="myf-autorefresh" title="Refresco automático">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    <span>Auto</span>
                  </label>
                  {/* Refresco manual (Req 7.4) */}
                  <button
                    className="pending-sales-refresh-btn-large"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title="Actualizar folios"
                  >
                    {refreshing ? (
                      <>
                        <span className="pending-sales-refresh-spinner">🔄</span>
                        <span>Actualizando...</span>
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        <span>Actualizar</span>
                      </>
                    )}
                  </button>
                </>
              )}
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
            {!caja ? (
              <div className="pending-sales-empty">
                <div className="pending-sales-empty-icon">🗄️</div>
                <p className="pending-sales-empty-title">Caja no configurada</p>
                <p className="pending-sales-empty-text">
                  Configura la caja de esta terminal para ver tus folios
                </p>
              </div>
            ) : loading ? (
              <div className="pending-sales-loading">
                <div className="pending-sales-spinner"></div>
                <p>Cargando folios...</p>
              </div>
            ) : folios.length === 0 ? (
              <div className="pending-sales-empty">
                <div className="pending-sales-empty-icon">📋</div>
                <p className="pending-sales-empty-title">No hay folios</p>
                <p className="pending-sales-empty-text">
                  Los folios que generes en esta caja aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="pending-sales-list">
                {folios.map((folio) => (
                  <div key={folio.id} className="pending-sales-card">
                    {/* Encabezado: semáforo + folio */}
                    <div className="ps-card-top">
                      <div className="ps-folio">
                        <span className="ps-folio-label">Folio</span>
                        <span className="ps-folio-value">{folio.code}</span>
                      </div>
                      <span
                        className="myf-status"
                        title={STATUS_LABEL[folio.status]}
                      >
                        <span className="myf-status-badge">
                          {STATUS_BADGE[folio.status]}
                        </span>
                        <span className="myf-status-label">
                          {STATUS_LABEL[folio.status]}
                        </span>
                      </span>
                    </div>

                    {/* Meta: total + fecha de creación (Req 7.6) */}
                    <div className="ps-meta">
                      <span className="ps-total">{money(folio.total)}</span>
                      <span className="ps-meta-sub">
                        {formatDate(folio.createdAt)}
                      </span>
                      {folio.clientName && (
                        <span className="ps-note">📝 {folio.clientName}</span>
                      )}
                    </div>

                    {/* Acciones: ver detalle del folio (Req 6.3) */}
                    <div className="ps-actions">
                      <button
                        className="ps-btn ps-btn--ghost"
                        onClick={() => setDetailSale(folio)}
                        type="button"
                      >
                        👁 Ver productos
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pending-sales-modal-footer">
            <button className="pending-sales-cancel-btn" onClick={onClose}>
              Cerrar
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

export default MyFoliosModal;
