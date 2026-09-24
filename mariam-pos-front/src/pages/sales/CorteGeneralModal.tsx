import React from "react";
import { IoClose } from "react-icons/io5";
import "../../styles/pages/sales/corteGeneralModal.css";

export interface CorteResumenVentas {
  totalEfectivo: number;
  totalTarjeta: number;
  totalRegalo: number;
  totalOtros: number;
  totalGeneral: number;
}

export interface CorteResumenCreditos {
  totalCreditsGenerated: number;
  creditsCount: number;
  totalPaymentsCash: number;
  totalPaymentsCard: number;
  totalPaymentsOther: number;
  paymentsCount: number;
}

export interface CorteResumenMovimientos {
  totalEntradas: number;
  totalSalidas: number;
  neto: number;
  movementsCount: number;
}

interface CorteGeneralModalProps {
  isOpen: boolean;
  onClose: () => void;
  fecha: string;
  caja: string;
  salesCount: number;
  resumen: CorteResumenVentas;
  resumenCreditos: CorteResumenCreditos;
  resumenMovimientos: CorteResumenMovimientos;
}

const mxn = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const CorteGeneralModal: React.FC<CorteGeneralModalProps> = ({
  isOpen,
  onClose,
  fecha,
  caja,
  salesCount,
  resumen,
  resumenCreditos,
  resumenMovimientos,
}) => {
  if (!isOpen) return null;

  // Ticket promedio de las ventas del periodo.
  const ticketPromedio = salesCount > 0 ? resumen.totalGeneral / salesCount : 0;

  // Efectivo que debería haber físicamente en la caja.
  // La venta guarda el total completo aunque parte quede a crédito; por eso se
  // resta el crédito generado hoy (regla de negocio: el fiado sale de ventas en efectivo).
  //   ventas efectivo − fiado del día + abonos efectivo + entradas − salidas
  const efectivoEsperado =
    resumen.totalEfectivo -
    resumenCreditos.totalCreditsGenerated +
    resumenCreditos.totalPaymentsCash +
    resumenMovimientos.totalEntradas -
    resumenMovimientos.totalSalidas;

  // Total realmente cobrado en el día (todos los métodos).
  // Se resta el fiado del día porque la venta guarda el total completo aunque
  // parte quede a crédito. Se suman los abonos de crédito recibidos hoy.
  const totalAbonos =
    resumenCreditos.totalPaymentsCash +
    resumenCreditos.totalPaymentsCard +
    resumenCreditos.totalPaymentsOther;
  const totalCobrado =
    resumen.totalGeneral -
    resumenCreditos.totalCreditsGenerated +
    totalAbonos;

  return (
    <div className="corte-overlay" onClick={onClose} role="presentation">
      <div
        className="corte-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="corte-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="corte-header">
          <div>
            <h2 id="corte-title" className="corte-title">📊 Corte general todos los turnos incluidos</h2>
            <span className="corte-subtitle">
              {caja === "all" ? "Todas las cajas" : caja} · {fecha}
            </span>
          </div>
          <button className="corte-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="corte-body">
          {/* Destacado: efectivo esperado en caja */}
          <div className="corte-highlight">
            <div className="corte-highlight-main">
              <span className="corte-highlight-label">Efectivo esperado en caja</span>
              <span className="corte-highlight-value">{mxn(efectivoEsperado)}</span>
            </div>
            <div className="corte-highlight-side">
              <div className="corte-mini">
                <span className="corte-mini-label">Total cobrado</span>
                <span className="corte-mini-value">{mxn(totalCobrado)}</span>
              </div>
              <div className="corte-mini">
                <span className="corte-mini-label">N.º de ventas</span>
                <span className="corte-mini-value">{salesCount}</span>
              </div>
              <div className="corte-mini">
                <span className="corte-mini-label">Ticket promedio</span>
                <span className="corte-mini-value">{mxn(ticketPromedio)}</span>
              </div>
            </div>
          </div>

          {/* Desgloses lado a lado: efectivo en caja | total cobrado */}
          <div className="corte-split">
            <section className="corte-section">
              <h3 className="corte-section-title">Cómo se calcula el efectivo en caja</h3>
              <div className="corte-rows">
                <div className="corte-row">
                  <span>Ventas en efectivo</span>
                  <span className="corte-row-paid">{mxn(resumen.totalEfectivo)}</span>
                </div>
                <div className="corte-row">
                  <span>(−) Fiado del día (créditos generados)</span>
                  <span className="corte-row-due">−{mxn(resumenCreditos.totalCreditsGenerated)}</span>
                </div>
                <div className="corte-row">
                  <span>(+) Abonos recibidos en efectivo</span>
                  <span className="corte-row-paid">{mxn(resumenCreditos.totalPaymentsCash)}</span>
                </div>
                <div className="corte-row">
                  <span>(+) Entradas de efectivo</span>
                  <span className="corte-row-paid">{mxn(resumenMovimientos.totalEntradas)}</span>
                </div>
                <div className="corte-row">
                  <span>(−) Salidas de efectivo</span>
                  <span className="corte-row-due">−{mxn(resumenMovimientos.totalSalidas)}</span>
                </div>
                <div className="corte-row corte-row--strong">
                  <span>= Efectivo esperado en caja</span>
                  <span className="corte-row-paid">{mxn(efectivoEsperado)}</span>
                </div>
              </div>
            </section>

            <section className="corte-section">
              <h3 className="corte-section-title">Cómo se calcula el total cobrado</h3>
              <div className="corte-rows">
                <div className="corte-row">
                  <span>Ventas del día (todos los métodos)</span>
                  <span className="corte-row-paid">{mxn(resumen.totalGeneral)}</span>
                </div>
                <div className="corte-row">
                  <span>(−) Fiado del día (créditos generados)</span>
                  <span className="corte-row-due">−{mxn(resumenCreditos.totalCreditsGenerated)}</span>
                </div>
                <div className="corte-row">
                  <span>(+) Abonos recibidos hoy (todos los métodos)</span>
                  <span className="corte-row-paid">{mxn(totalAbonos)}</span>
                </div>
                <div className="corte-row corte-row--strong">
                  <span>= Total cobrado en el día</span>
                  <span className="corte-row-paid">{mxn(totalCobrado)}</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="corte-footer">
          <button type="button" className="corte-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CorteGeneralModal;
