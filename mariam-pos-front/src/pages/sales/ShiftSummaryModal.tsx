import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import type { ShiftSummary } from "../../types/index";
import "../../styles/pages/sales/shiftSummaryModal.css";

interface ShiftSummaryModalProps {
  isOpen: boolean;
  summary: ShiftSummary | null;
  onClose: () => void;
}

const mxn = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const dateTime = (v?: string | Date) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const ShiftSummaryModal: React.FC<ShiftSummaryModalProps> = ({ isOpen, summary, onClose }) => {
  const [showFolios, setShowFolios] = useState(false);

  if (!isOpen || !summary) return null;

  const { shift, totals, statistics, cashMovements, cashMovementsSummary, creditsInfo, sales } = summary;
  const mov = cashMovementsSummary ?? { totalEntradas: 0, totalSalidas: 0, neto: 0 };
  const cred = creditsInfo ?? {
    totalCreditsGenerated: 0,
    totalCreditPaymentsCash: 0,
    creditsCount: 0,
    paymentsCount: 0,
  };

  const expectedCash =
    shift.expectedCash ??
    shift.initialCash +
      totals.totalCash +
      mov.neto +
      cred.totalCreditPaymentsCash -
      cred.totalCreditsGenerated;

  const sortedSales = (sales ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Listas de detalle para el turno
  const movementsList = (cashMovements ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const creditsList = (creditsInfo?.credits ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const paymentsList = (creditsInfo?.payments ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="shs-overlay" onClick={onClose} role="presentation">
      <div
        className="shs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shs-header">
          <div>
            <h2 id="shs-title" className="shs-title">📊 Resumen del turno</h2>
            <span className="shs-subtitle">
              {shift.id ? `Turno #${shift.id} · ` : ""}
              {shift.cashRegister ?? ""}
              {shift.cashierName ? ` · ${shift.cashierName}` : ""}
            </span>
          </div>
          <button className="shs-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="shs-body">
          {/* ── ZONA 1: EFECTIVO A CUADRAR ─────────────────────────── */}
          {/* Lo primero que el cajero necesita para cerrar la caja. */}
          <div className="shs-cash-block">
            {/* Destacado: el número protagonista */}
            <div className="shs-highlight">
              <span className="shs-highlight-label">Efectivo esperado en caja</span>
              <span className="shs-highlight-value">{mxn(expectedCash)}</span>
              <span className="shs-highlight-hint">
                Este es el monto que deberías contar físicamente al cerrar.
              </span>
            </div>

            {/* Desglose del efectivo esperado, pegado al número que explica */}
            <div className="shs-breakdown">
              <span className="shs-breakdown-title">Cómo se llega a este monto</span>
              <div className="shs-rows">
                <div className="shs-row">
                  <span>Fondo inicial</span>
                  <span>{mxn(shift.initialCash)}</span>
                </div>
                <div className="shs-row">
                  <span>(+) Ventas en efectivo</span>
                  <span className="shs-paid">{mxn(totals.totalCash)}</span>
                </div>
                {cred.totalCreditsGenerated > 0 && (
                  <div className="shs-row">
                    <span>(−) Fiado del día (créditos generados)</span>
                    <span className="shs-due">−{mxn(cred.totalCreditsGenerated)}</span>
                  </div>
                )}
                {cred.totalCreditPaymentsCash > 0 && (
                  <div className="shs-row">
                    <span>(+) Abonos recibidos en efectivo</span>
                    <span className="shs-paid">{mxn(cred.totalCreditPaymentsCash)}</span>
                  </div>
                )}
                {mov.totalEntradas > 0 && (
                  <div className="shs-row">
                    <span>(+) Entradas de efectivo</span>
                    <span className="shs-paid">{mxn(mov.totalEntradas)}</span>
                  </div>
                )}
                {mov.totalSalidas > 0 && (
                  <div className="shs-row">
                    <span>(−) Salidas de efectivo</span>
                    <span className="shs-due">−{mxn(mov.totalSalidas)}</span>
                  </div>
                )}
                <div className="shs-row shs-row--strong">
                  <span>= Efectivo esperado</span>
                  <span className="shs-paid">{mxn(expectedCash)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ZONA 2: ANÁLISIS DE LA OPERACIÓN ───────────────────── */}
          {/* Estadísticas del turno; útiles para revisar, no para cuadrar caja. */}
          <section className="shs-section">
            <h3 className="shs-section-title">Resumen de la operación</h3>
            <div className="shs-stats">
              <div className="shs-stat">
                <span className="shs-stat-label">N.º de ventas</span>
                <span className="shs-stat-value">{statistics.totalSales}</span>
              </div>
              <div className="shs-stat">
                <span className="shs-stat-label">Total vendido</span>
                <span className="shs-stat-value">{mxn(statistics.totalAmount)}</span>
              </div>
              <div className="shs-stat">
                <span className="shs-stat-label">Ticket promedio</span>
                <span className="shs-stat-value">{mxn(statistics.averageTicket)}</span>
              </div>
            </div>
          </section>

          {/* Créditos y abonos aplicados en el turno */}
          {(creditsList.length > 0 || paymentsList.length > 0) && (
            <section className="shs-section">
              <h3 className="shs-section-title">Créditos y abonos del turno</h3>

              {/* Totales rápidos */}
              <div className="shs-rows">
                <div className="shs-row">
                  <span>Créditos generados ({cred.creditsCount})</span>
                  <span className="shs-due">{mxn(cred.totalCreditsGenerated)}</span>
                </div>
                <div className="shs-row">
                  <span>Abonos recibidos en efectivo ({cred.paymentsCount})</span>
                  <span className="shs-paid">{mxn(cred.totalCreditPaymentsCash)}</span>
                </div>
              </div>

              {/* Lista de créditos generados */}
              {creditsList.length > 0 && (
                <>
                  <span className="shs-list-title">Créditos generados</span>
                  <div className="shs-table-wrap">
                    <table className="shs-table">
                      <thead>
                        <tr>
                          <th>Folio crédito</th>
                          <th>Venta</th>
                          <th>Hora</th>
                          <th>Cliente</th>
                          <th className="shs-th-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creditsList.map((c) => (
                          <tr key={c.id}>
                            <td className="shs-td-folio">#{c.id}</td>
                            <td className="shs-td-method">
                              {c.sale?.folio ? `#${c.sale.folio}` : c.saleId ? `#${c.saleId}` : "—"}
                            </td>
                            <td>{dateTime(c.createdAt)}</td>
                            <td className="shs-td-client">
                              {c.client?.name || "Cliente General"}
                            </td>
                            <td className="shs-th-right shs-td-total shs-due">
                              {mxn(c.originalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Lista de abonos aplicados */}
              {paymentsList.length > 0 && (
                <>
                  <span className="shs-list-title">Abonos aplicados</span>
                  <div className="shs-table-wrap">
                    <table className="shs-table">
                      <thead>
                        <tr>
                          <th>Folio abono</th>
                          <th>Venta</th>
                          <th>Hora</th>
                          <th>Cliente</th>
                          <th>Método</th>
                          <th className="shs-th-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsList.map((p) => (
                          <tr key={p.id}>
                            <td className="shs-td-folio">#{p.id}</td>
                            <td className="shs-td-method">
                              {p.credit?.sale?.folio
                                ? `#${p.credit.sale.folio}`
                                : p.credit?.saleId
                                ? `#${p.credit.saleId}`
                                : "—"}
                            </td>
                            <td>{dateTime(p.createdAt)}</td>
                            <td className="shs-td-client">
                              {p.credit?.client?.name || "Cliente General"}
                            </td>
                            <td className="shs-td-method">{p.paymentMethod || "Efectivo"}</td>
                            <td className="shs-th-right shs-td-total">{mxn(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Movimientos de efectivo del turno */}
          {movementsList.length > 0 && (
            <section className="shs-section">
              <h3 className="shs-section-title">
                Movimientos de efectivo ({movementsList.length})
              </h3>
              <div className="shs-rows">
                <div className="shs-row">
                  <span>Entradas</span>
                  <span className="shs-paid">+{mxn(mov.totalEntradas)}</span>
                </div>
                <div className="shs-row">
                  <span>Salidas</span>
                  <span className="shs-due">−{mxn(mov.totalSalidas)}</span>
                </div>
              </div>
              <div className="shs-table-wrap">
                <table className="shs-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Hora</th>
                      <th>Motivo</th>
                      <th className="shs-th-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsList.map((m) => {
                      const isIn = m.type === "ENTRADA";
                      return (
                        <tr key={m.id}>
                          <td className={isIn ? "shs-paid" : "shs-due"}>
                            {isIn ? "💰 Entrada" : "💸 Salida"}
                          </td>
                          <td>{dateTime(m.createdAt)}</td>
                          <td className="shs-td-client">{m.reason || "—"}</td>
                          <td
                            className={`shs-th-right shs-td-total ${
                              isIn ? "shs-paid" : "shs-due"
                            }`}
                          >
                            {isIn ? "+" : "−"}
                            {mxn(m.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Folios del turno (colapsable) */}
          {sortedSales.length > 0 && (
            <section className="shs-section">
              <div className="shs-section-head">
                <h3 className="shs-section-title">
                  Folios del turno ({sortedSales.length})
                </h3>
                <button
                  type="button"
                  className="shs-toggle"
                  onClick={() => setShowFolios((v) => !v)}
                >
                  {showFolios ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {showFolios && (
                <div className="shs-table-wrap">
                  <table className="shs-table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Hora</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th className="shs-th-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSales.map((s) => (
                        <tr key={s.id}>
                          <td className="shs-td-folio">{s.folio ?? s.id}</td>
                          <td>{dateTime(s.createdAt)}</td>
                          <td className="shs-td-client">{s.clientName || "Cliente General"}</td>
                          <td className="shs-td-method">{s.paymentMethod || "—"}</td>
                          <td className="shs-th-right shs-td-total">{mxn(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="shs-th-right">Total general</td>
                        <td className="shs-th-right shs-td-total">{mxn(statistics.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="shs-footer">
          <button type="button" className="shs-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftSummaryModal;
