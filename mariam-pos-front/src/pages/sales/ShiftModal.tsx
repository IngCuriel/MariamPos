import { useState, useEffect, useRef } from "react";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import {
  openShift,
  closeShift,
  getActiveShift,
  getShiftSummary,
  getCashMovementsByShift,
} from "../../api/cashRegister";
import { useCashier } from "../../contexts/CashierContext";
import type {
  CashRegisterShift,
  OpenShiftInput,
  CloseShiftInput,
  CashMovement,
} from "../../types/index";
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import TouchCalculator from '../../components/TouchCalculator';
import "../../styles/pages/sales/paymentModal.css";

interface ShiftModalProps {
  branch: string;
  cashRegister: string;
  onClose: () => void;
  onShiftOpened?: (shift: CashRegisterShift) => void;
  onShiftClosed?: (shift: CashRegisterShift) => void;
}

type ModalMode = "open" | "close";

// Función para mostrar la calculadora touch (reutilizada de GranelModal)
const showTouchCalculator = (
  initialValue: string,
  label: string,
  onConfirm: (value: string) => void
): void => {
  const calculatorContainer = document.createElement('div');
  calculatorContainer.id = 'touch-calculator-root';
  document.body.appendChild(calculatorContainer);

  const root: Root = createRoot(calculatorContainer);

  const handleClose = () => {
    root.unmount();
    document.body.removeChild(calculatorContainer);
  };

  const handleConfirm = (value: string) => {
    onConfirm(value);
    handleClose();
  };

  root.render(
    <TouchCalculator
      initialValue={initialValue}
      label={label}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  );
};

const ShiftModal: React.FC<ShiftModalProps> = ({
  branch,
  cashRegister,
  onClose,
  onShiftOpened,
  onShiftClosed,
}) => {
  const { selectedCashier } = useCashier();
  const [mode, setMode] = useState<ModalMode>("open");
  const [initialCash, setInitialCash] = useState<string>("");
  const [finalCash, setFinalCash] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [activeShift, setActiveShift] = useState<CashRegisterShift | null>(null);
  const [loading, setLoading] = useState(false);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Verificar si hay turno activo al montar
  useEffect(() => {
    checkActiveShift();
  }, []);

  const checkActiveShift = async () => {
    try {
      const shift = await getActiveShift(branch, cashRegister);
      if (shift) {
        setActiveShift(shift);
        setMode("close");
        // Cargar movimientos de efectivo
        loadCashMovements(shift.id);
      }
    } catch (error) {
      console.error("Error al verificar turno activo:", error);
    }
  };

  const loadCashMovements = async (shiftId: number) => {
    try {
      const movements = await getCashMovementsByShift(shiftId);
      setCashMovements(movements);
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
    }
  };

  // Enfocar input cuando cambia el modo
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
        if (inputRef.current?.setSelectionRange) {
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
        }
      }, 100);
    }
  }, [mode]);

  // Configurar botón de calculadora touch para fondo inicial
  useEffect(() => {
    if (mode === "open") {
      const btnCambiarFondo = document.getElementById('btn-cambiar-fondo-inicial');
      if (btnCambiarFondo && inputRef.current) {
        const handleClick = () => {
          const currentValue = inputRef.current?.value.replace(/,/g, '') || '0';
          showTouchCalculator(currentValue, '💰 Fondo Inicial', (newValue) => {
            if (inputRef.current) {
              inputRef.current.value = newValue;
              setInitialCash(newValue);
              inputRef.current.focus();
              inputRef.current.select();
              if (inputRef.current.setSelectionRange) {
                inputRef.current.setSelectionRange(0, inputRef.current.value.length);
              }
            }
          });
        };
        btnCambiarFondo.addEventListener('click', handleClick);
        return () => {
          btnCambiarFondo.removeEventListener('click', handleClick);
        };
      }
    }
  }, [mode]);

  // Configurar botón de calculadora touch para efectivo contado
  useEffect(() => {
    if (mode === "close") {
      const btnCalcularEfectivo = document.getElementById('btn-calcular-efectivo-contado');
      if (btnCalcularEfectivo && inputRef.current) {
        const handleClick = () => {
          const currentValue = inputRef.current?.value.replace(/,/g, '') || '0';
          showTouchCalculator(currentValue, '💰 Efectivo Contado', (newValue) => {
            if (inputRef.current) {
              inputRef.current.value = newValue;
              setFinalCash(newValue);
              inputRef.current.focus();
              inputRef.current.select();
              if (inputRef.current.setSelectionRange) {
                inputRef.current.setSelectionRange(0, inputRef.current.value.length);
              }
            }
          });
        };
        btnCalcularEfectivo.addEventListener('click', handleClick);
        return () => {
          btnCalcularEfectivo.removeEventListener('click', handleClick);
        };
      }
    }
  }, [mode]);

  // Cargar información de créditos cuando hay turno activo y está en modo cerrar
  useEffect(() => {
    const loadCreditsInfo = async () => {
      if (activeShift && mode === "close") {
        try {
          const summary = await getShiftSummary(activeShift.id);
          setCreditsInfo(summary.creditsInfo);
        } catch (error) {
          console.error("Error al cargar información de créditos:", error);
          setCreditsInfo(null);
        }
      } else {
        setCreditsInfo(null);
      }
    };
    loadCreditsInfo();
  }, [activeShift, mode]);

  const handleOpenShift = async () => {
    if (!initialCash || parseFloat(initialCash) < 0) {
      Swal.fire({
        icon: "warning",
        title: "Fondo inicial requerido",
        text: "Debe ingresar un monto válido para el fondo inicial",
        confirmButtonText: "Entendido",
      });
      return;
    }

    setLoading(true);
    try {
      // Usar el cajero del contexto (seleccionado en HomePage)
      const cashierNameToUse = selectedCashier?.name || "Anónimo";

      const input: OpenShiftInput = {
        branch,
        cashRegister,
        cashierName: cashierNameToUse,
        initialCash: parseFloat(initialCash),
      };

      const shift = await openShift(input);
      setActiveShift(shift);

      Swal.fire({
        icon: "success",
        title: "✅ Turno abierto",
        text: `Turno ${shift.shiftNumber} iniciado correctamente`,
        timer: 2000,
        showConfirmButton: false,
      });

      onShiftOpened?.(shift);
      onClose();
    } catch (error: any) {
      console.error("Error al abrir turno:", error);
      Swal.fire({
        icon: "error",
        title: "Error al abrir turno",
        text: error.response?.data?.error || "No se pudo abrir el turno",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;

    if (!finalCash || parseFloat(finalCash) < 0) {
      Swal.fire({
        icon: "warning",
        title: "Efectivo contado requerido",
        text: "Debe ingresar el monto de efectivo contado físicamente",
        confirmButtonText: "Entendido",
      });
      return;
    }

    setLoading(true);
    try {
      const input: CloseShiftInput = {
        finalCash: parseFloat(finalCash),
        notes: notes || undefined,
      };

      const shift = await closeShift(activeShift.id, input);

      Swal.fire({
        icon: "success",
        title: "✅ Turno cerrado",
        html: `
          <p>Turno ${shift.shiftNumber} cerrado correctamente</p>
          <p style="margin-top: 10px; font-size: 0.9rem;">
            Diferencia: <strong style="color: ${shift.difference === 0 ? '#059669' : shift.difference! > 0 ? '#dc2626' : '#3b82f6'}">
              ${shift.difference! >= 0 ? '+' : ''}${shift.difference?.toFixed(2)}
            </strong>
          </p>
        `,
        timer: 4000,
        showConfirmButton: false,
      });

      onShiftClosed?.(shift);
      onClose();
    } catch (error: any) {
      console.error("Error al cerrar turno:", error);
      Swal.fire({
        icon: "error",
        title: "Error al cerrar turno",
        text: error.response?.data?.error || "No se pudo cerrar el turno",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadShiftSummary = async () => {
    if (!activeShift) return;

    try {
      console.log('activeShift.id', activeShift.id);
      const summary = await getShiftSummary(activeShift.id);
      console.log('summary resumen de turno', summary);
      // Calcular efectivo esperado correctamente
      // Fondo inicial + Ventas en efectivo + Neto de movimientos + Abonos en efectivo - Créditos generados
      // Los créditos se restan porque representan dinero que NO se recibió en efectivo
      // Siempre calcular localmente para asegurar precisión
      const ventasEfectivo = summary.paymentMethods?.efectivo?.total || summary.paymentMethods?.Efectivo?.total || summary.totals?.totalCash || 0;
      const ventasTarjeta = summary.paymentMethods?.tarjeta?.total || summary.paymentMethods?.Tarjeta?.total || summary.totals?.totalCard || 0;
      const netoMovimientos = summary.cashMovementsSummary?.neto || 0;
      const abonosEfectivo = summary.creditsInfo?.totalCreditPaymentsCash || 0;
      const creditosGenerados = summary.creditsInfo?.totalCreditsGenerated || 0;
      const expectedCash = summary.shift.initialCash + ventasEfectivo + netoMovimientos + abonosEfectivo - creditosGenerados;
      
      // Construir HTML de movimientos si existen
      let movementsHtml = "";
      if (summary.cashMovements && summary.cashMovements.length > 0) {
        movementsHtml = `
          <hr style="margin: 15px 0;">
          <p style="font-weight: 600; margin-bottom: 8px;">Movimientos de Efectivo:</p>
          <div style="max-height: 200px; overflow-y: auto; font-size: 0.85rem;">
            ${summary.cashMovements.map((m: any) => `
              <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
                <div>
                  <span style="color: ${m.type === 'ENTRADA' ? '#059669' : '#dc2626'}; font-weight: 600;">
                    ${m.type === 'ENTRADA' ? '💰 +' : '💸 -'}$${m.amount.toFixed(2)}
                  </span>
                  <span style="color: #6b7280; margin-left: 8px;">${m.reason || 'Sin razón'}</span>
                </div>
                <span style="color: #9ca3af; font-size: 0.8rem;">
                  ${new Date(m.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            `).join('')}
          </div>
          ${summary.cashMovementsSummary ? `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #d1d5db;">
              <p style="font-size: 0.85rem;">
                <strong>Total Entradas:</strong> <span style="color: #059669;">+$${summary.cashMovementsSummary.totalEntradas.toFixed(2)}</span>
              </p>
              <p style="font-size: 0.85rem;">
                <strong>Total Salidas:</strong> <span style="color: #dc2626;">-$${summary.cashMovementsSummary.totalSalidas.toFixed(2)}</span>
              </p>
              <p style="font-size: 0.85rem; font-weight: 600;">
                <strong>Neto Movimientos:</strong> 
                <span style="color: ${summary.cashMovementsSummary.neto >= 0 ? '#059669' : '#dc2626'};">
                  ${summary.cashMovementsSummary.neto >= 0 ? '+' : ''}$${summary.cashMovementsSummary.neto.toFixed(2)}
                </span>
              </p>
            </div>
          ` : ''}
        `;
      }

      Swal.fire({
        title: "📊 Resumen Completo del Turno",
        html: `
          <div style="text-align: left; margin-top: 15px; font-size: 1.05rem; max-width: 100%;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div>
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 0.95rem;">Fondo Inicial:</span>
                  <p style="margin: 4px 0; font-size: 1.2rem; font-weight: 700; color: #1f2937;">
                    $${summary.shift.initialCash.toFixed(2)}
                  </p>
                </div>
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 0.95rem;">Ventas en Efectivo:</span>
                  <p style="margin: 4px 0; font-size: 1.2rem; font-weight: 700; color: #059669;">
                    $${ventasEfectivo.toFixed(2)}
                  </p>
                </div>
                ${summary.cashMovementsSummary ? `
                  <div style="margin-bottom: 12px; padding: 10px; background: #f3f4f6; border-radius: 8px;">
                    <p style="margin: 4px 0; color: #059669; font-weight: 600; font-size: 1rem;">
                      <strong>💰 Entradas:</strong> +$${summary.cashMovementsSummary.totalEntradas.toFixed(2)}
                    </p>
                    <p style="margin: 4px 0; color: #dc2626; font-weight: 600; font-size: 1rem;">
                      <strong>💸 Salidas:</strong> -$${summary.cashMovementsSummary.totalSalidas.toFixed(2)}
                    </p>
                    <p style="margin: 4px 0; font-weight: 600; font-size: 1rem;">
                      <strong>Neto:</strong> 
                      <span style="color: ${summary.cashMovementsSummary.neto >= 0 ? '#059669' : '#dc2626'};">
                        ${summary.cashMovementsSummary.neto >= 0 ? '+' : ''}$${summary.cashMovementsSummary.neto.toFixed(2)}
                      </span>
                    </p>
                  </div>
                ` : ''}
              </div>
              <div>
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 0.95rem;">Ventas en Tarjeta:</span>
                  <p style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #3b82f6;">
                    $${ventasTarjeta.toFixed(2)}
                  </p>
                </div>
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 0.95rem;">Ventas en Transferencia:</span>
                  <p style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #8b5cf6;">
                    $${summary.totals.totalTransfer.toFixed(2)}
                  </p>
                </div>
                ${summary.paymentMethods?.Regalo ? `
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 0.95rem;">Regalo:</span>
                  <p style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #f59e0b;">
                    $${summary.paymentMethods.Regalo.total.toFixed(2)}
                  </p>
                </div>
                ` : ''}
                ${(summary.totals.totalOther - (summary.paymentMethods?.Regalo?.total || 0)) > 0 ? `
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 0.95rem;">Otros:</span>
                  <p style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #6b7280;">
                    $${(summary.totals.totalOther - (summary.paymentMethods?.Regalo?.total || 0)).toFixed(2)}
                  </p>
                </div>
                ` : ''}
              </div>
            </div>
            <hr style="margin: 15px 0; border-color: #d1d5db;">
            <div style="padding: 15px; background: #dbeafe; border-radius: 8px; border: 2px solid #3b82f6; margin-bottom: 15px;">
              <span style="color: #1e40af; font-size: 1rem; font-weight: 600;">
                Total Esperado en Efectivo:
              </span>
              <p style="margin: 8px 0 0 0; font-size: 1.5rem; font-weight: 700; color: #1e40af;">
                $${expectedCash.toFixed(2)}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 0.9rem; color: #6b7280;">
                (Fondo: $${summary.shift.initialCash.toFixed(2)} + Ventas: $${ventasEfectivo.toFixed(2)} ${netoMovimientos !== 0 ? `+ Movimientos: ${netoMovimientos >= 0 ? '+' : ''}$${netoMovimientos.toFixed(2)}` : ''}${abonosEfectivo > 0 ? ` + Abonos: +$${abonosEfectivo.toFixed(2)}` : ''}${creditosGenerados > 0 ? ` - Créditos: -$${creditosGenerados.toFixed(2)}` : ''})
              </p>
            </div>
            ${summary.creditsInfo && summary.creditsInfo.creditsCount > 0 ? `
            <div style="padding: 15px; background: #fef3c7; border-radius: 8px; border: 2px solid #f59e0b; margin-bottom: 15px;">
              <span style="color: #92400e; font-size: 1rem; font-weight: 600;">
                💳 Créditos y Abonos:
              </span>
              <div style="margin-top: 10px; font-size: 0.9rem;">
                <p style="margin: 4px 0; color: #92400e;">
                  <strong>Créditos Generados:</strong> ${summary.creditsInfo.creditsCount} crédito(s) - <span style="color: #dc2626;">$${summary.creditsInfo.totalCreditsGenerated.toFixed(2)}</span>
                </p>
                ${summary.creditsInfo.paymentsCount > 0 ? `
                  <p style="margin: 4px 0; color: #92400e;">
                    <strong>Abonos Recibidos:</strong> ${summary.creditsInfo.paymentsCount} abono(s)
                  </p>
                  <p style="margin: 4px 0; color: #92400e;">
                    - En Efectivo: <span style="color: #059669; font-weight: 600;">+$${summary.creditsInfo.totalCreditPaymentsCash.toFixed(2)}</span>
                  </p>
                  ${summary.creditsInfo.totalCreditPaymentsCard > 0 ? `
                    <p style="margin: 4px 0; color: #92400e;">
                      - En Tarjeta: <span style="color: #3b82f6; font-weight: 600;">$${summary.creditsInfo.totalCreditPaymentsCard.toFixed(2)}</span>
                    </p>
                  ` : ''}
                  ${summary.creditsInfo.totalCreditPaymentsOther > 0 ? `
                    <p style="margin: 4px 0; color: #92400e;">
                      - Otros: <span style="font-weight: 600;">$${summary.creditsInfo.totalCreditPaymentsOther.toFixed(2)}</span>
                    </p>
                  ` : ''}
                ` : '<p style="margin: 4px 0; color: #92400e; font-style: italic;">Sin abonos registrados</p>'}
              </div>
            </div>
            ` : ''}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
              <div>
                <span style="color: #6b7280; font-size: 0.95rem;">Total de Ventas:</span>
                <p style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #1f2937;">
                  $${summary.statistics.totalAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <span style="color: #6b7280; font-size: 0.95rem;">Número de Ventas:</span>
                <p style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #1f2937;">
                  ${summary.statistics.totalSales}
                </p>
              </div>
            </div>
            <div style="margin-bottom: 15px;">
              <span style="color: #6b7280; font-size: 0.95rem;">Ticket Promedio:</span>
              <p style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #1f2937;">
                $${summary.statistics.averageTicket.toFixed(2)}
              </p>
            </div>
            ${movementsHtml}
          </div>
        `,
        width: isMobile ? "95%" : "800px",
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#3b82f6",
      });
    } catch (error) {
      console.error("Error al cargar resumen:", error);
    }
  };

  // Manejo de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "open") {
          handleOpenShift();
        } else {
          handleCloseShift();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, initialCash, finalCash, activeShift]);

  if (mode === "open") {
    return (
      <div className="modal-overlay">
        <div className="modal-container">
          <button className="close-btn" onClick={onClose}>
            <IoCloseCircleOutline size={32} />
          </button>

          <h2 className="modal-title">🟢 Abrir Turno de Caja</h2>

          <div style={{ marginBottom: "20px", textAlign: "center" }}>
            <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              {branch} - {cashRegister}
            </p>
          </div>

          <div className="input-section">
            <label>
              <span style={{ marginRight: "0.5rem" }}>💰</span>
              Fondo Inicial (Efectivo en Caja):
            </label>
            <div className="input-wrapper" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                ref={inputRef}
                type="text"
                step="0.01"
                min="0"
                placeholder="0.00"
                inputMode="decimal"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleOpenShift();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button
                id="btn-cambiar-fondo-inicial"
                type="button"
                style={{
                  background: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#5568d3";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#667eea";
                }}
              >
                🧮 Calcular
              </button>
            </div>
          </div>

          <div className="input-section">
            <label>Cajero Actual:</label>
            <div className="input-wrapper">
              <div
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontFamily: "inherit",
                  backgroundColor: selectedCashier ? "#f0fdf4" : "#f9fafb",
                  color: selectedCashier ? "#059669" : "#6b7280",
                  fontWeight: selectedCashier ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>{selectedCashier ? "✓" : "👤"}</span>
                <span>{selectedCashier?.name || "Anónimo"}</span>
                {selectedCashier?.role && (
                  <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                    ({selectedCashier.role})
                  </span>
                )}
              </div>
            </div>
            <p style={{ marginTop: "5px", fontSize: "0.85rem", color: "#6b7280", fontStyle: "italic" }}>
              {selectedCashier 
                ? "Este cajero fue seleccionado al iniciar sesión"
                : "No se seleccionó un cajero. Se registrará como 'Anónimo'"
              }
            </p>
          </div>

          <div className="payment-modal-actions">
            <button className="cancel-btn-payment" onClick={onClose}>
              Cancelar (ESC)
            </button>
            <button
              className="confirm-btn"
              onClick={handleOpenShift}
              disabled={loading}
            >
              {loading ? "Abriendo..." : "Abrir Turno (Enter)"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modo cerrar turno
  if (!activeShift) {
    return null;
  }

  // Calcular efectivo esperado incluyendo movimientos, abonos y restando créditos generados
  // Los créditos se restan porque representan dinero que NO se recibió en efectivo
  const totalCashMovements = cashMovements.reduce(
    (sum, m) => sum + (m.type === "ENTRADA" ? m.amount : -m.amount),
    0
  );
  const abonosEfectivo = creditsInfo?.totalCreditPaymentsCash || 0;
  const creditosGenerados = creditsInfo?.totalCreditsGenerated || 0;
  const expectedCash = activeShift.expectedCash ?? 
    (activeShift.initialCash + activeShift.totalCash + totalCashMovements + abonosEfectivo - creditosGenerados);
  const difference =
    finalCash && parseFloat(finalCash) >= 0
      ? parseFloat(finalCash) - expectedCash
      : null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ 
        maxWidth: "1000px", 
        width: "98%",
        maxHeight: "98vh",
        overflowY: "auto",
        padding: "20px"
      }}>
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={28} />
        </button>

        <h2 className="modal-title" style={{ fontSize: "1.5rem", marginBottom: "12px", marginTop: "0" }}>
          🔴 Cerrar Turno de Caja
        </h2>

        <div style={{ marginBottom: "15px", textAlign: "center" }}>
          <p style={{ fontSize: "0.95rem", color: "#6b7280", fontWeight: "600", margin: "2px 0" }}>
            {activeShift.shiftNumber}
          </p>
          <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "2px 0" }}>
            {branch} - {cashRegister}
          </p>
        </div>

        {/* Layout en dos columnas */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", 
          gap: "15px",
          marginBottom: "15px"
        }}>
          {/* Columna izquierda - Resumen */}
          <div
            style={{
              backgroundColor: "#f3f4f6",
              padding: "15px",
              borderRadius: "10px",
            }}
          >
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "10px",
              fontSize: "1.1rem",
              fontWeight: "700",
              color: "#1f2937"
            }}>
              Resumen del Turno
            </h3>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "8px",
              fontSize: "0.9rem"
            }}>
              <div>
                <span style={{ color: "#6b7280", fontSize: "0.85rem", display: "block" }}>Fondo Inicial:</span>
                <p style={{ margin: "2px 0", fontSize: "1rem", fontWeight: "700", color: "#1f2937" }}>
                  ${activeShift.initialCash.toFixed(2)}
                </p>
              </div>
              
              <div>
                <span style={{ color: "#6b7280", fontSize: "0.85rem", display: "block" }}>Ventas Efectivo:</span>
                <p style={{ margin: "2px 0", fontSize: "1rem", fontWeight: "700", color: "#059669" }}>
                  ${activeShift.totalCash.toFixed(2)}
                </p>
              </div>

              {cashMovements.length > 0 && (
                <>
                  <div style={{ gridColumn: "1 / -1", padding: "8px", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                    <span style={{ color: "#6b7280", fontSize: "0.85rem", display: "block", marginBottom: "4px" }}>Movimientos:</span>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                      <span style={{ color: "#059669", fontWeight: "600" }}>
                        💰 +${cashMovements.filter((m) => m.type === "ENTRADA").reduce((sum, m) => sum + m.amount, 0).toFixed(2)}
                      </span>
                      <span style={{ color: "#dc2626", fontWeight: "600" }}>
                        💸 -${cashMovements.filter((m) => m.type === "SALIDA").reduce((sum, m) => sum + m.amount, 0).toFixed(2)}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "4px", textAlign: "center" }}>
                      ({cashMovements.length} movimiento{cashMovements.length !== 1 ? "s" : ""})
                    </p>
                  </div>
                </>
              )}

              <div>
                <span style={{ color: "#6b7280", fontSize: "0.85rem", display: "block" }}>Tarjeta:</span>
                <p style={{ margin: "2px 0", fontSize: "0.95rem", fontWeight: "600", color: "#3b82f6" }}>
                  ${activeShift.totalCard.toFixed(2)}
                </p>
              </div>

              <div>
                <span style={{ color: "#6b7280", fontSize: "0.85rem", display: "block" }}>Transferencia:</span>
                <p style={{ margin: "2px 0", fontSize: "0.95rem", fontWeight: "600", color: "#8b5cf6" }}>
                  ${activeShift.totalTransfer.toFixed(2)}
                </p>
              </div>

              {(() => {
                // Calcular regalos desde las ventas si están disponibles
                let totalRegalo = 0;
                if (activeShift.sales && Array.isArray(activeShift.sales)) {
                  totalRegalo = activeShift.sales
                    .filter((sale: any) => sale.paymentMethod && sale.paymentMethod.toLowerCase().includes("regalo"))
                    .reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);
                }
                const totalOtros = activeShift.totalOther - totalRegalo;
                
                return (
                  <>
                    {totalRegalo > 0 && (
                      <div>
                        <span style={{ color: "#6b7280", fontSize: "0.85rem", display: "block" }}>Regalo:</span>
                        <p style={{ margin: "2px 0", fontSize: "0.95rem", fontWeight: "600", color: "#f59e0b" }}>
                          {totalRegalo.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {totalOtros > 0 && (
                      <div>
                        <span style={{ color: "#6b7280", fontSize: "0.85rem", display: "block" }}>Otros:</span>
                        <p style={{ margin: "2px 0", fontSize: "0.95rem", fontWeight: "600", color: "#6b7280" }}>
                          {totalOtros.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <hr style={{ margin: "10px 0", borderColor: "#d1d5db" }} />
            
            <div style={{ 
              padding: "12px",
              backgroundColor: "#dbeafe",
              borderRadius: "8px",
              border: "2px solid #3b82f6"
            }}>
              <span style={{ color: "#1e40af", fontSize: "0.9rem", fontWeight: "600", display: "block" }}>
                Total Esperado en Efectivo:
              </span>
              <p style={{ 
                margin: "4px 0 0 0", 
                fontSize: "1.3rem", 
                fontWeight: "700", 
                color: "#1e40af"
              }}>
                ${expectedCash.toFixed(2)}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#6b7280" }}>
                (Fondo: ${activeShift.initialCash.toFixed(2)} + Ventas: ${activeShift.totalCash.toFixed(2)} ${totalCashMovements !== 0 ? `+ Mov: ${totalCashMovements >= 0 ? '+' : ''}${totalCashMovements.toFixed(2)}` : ''}${abonosEfectivo > 0 ? ` + Abonos: +${abonosEfectivo.toFixed(2)}` : ''}${creditosGenerados > 0 ? ` - Créditos: -${creditosGenerados.toFixed(2)}` : ''})
              </p>
            </div>
            {creditsInfo && creditsInfo.creditsCount > 0 && (
              <div style={{ 
                padding: "12px", 
                background: "#fef3c7", 
                borderRadius: "8px", 
                border: "2px solid #f59e0b", 
                marginTop: "10px" 
              }}>
                <span style={{ color: "#92400e", fontSize: "0.9rem", fontWeight: "600" }}>
                  💳 Créditos y Abonos:
                </span>
                <div style={{ marginTop: "6px", fontSize: "0.85rem", color: "#92400e" }}>
                  <p style={{ margin: "2px 0" }}>
                    <strong>Créditos:</strong> {creditsInfo.creditsCount} - <span style={{ color: "#dc2626" }}>${creditsInfo.totalCreditsGenerated.toFixed(2)}</span>
                  </p>
                  {creditsInfo.paymentsCount > 0 && (
                    <>
                      <p style={{ margin: "2px 0" }}>
                        <strong>Abonos:</strong> {creditsInfo.paymentsCount} abono(s)
                      </p>
                      {creditsInfo.totalCreditPaymentsCash > 0 && (
                        <p style={{ margin: "2px 0", color: "#059669" }}>
                          - Efectivo: +${creditsInfo.totalCreditPaymentsCash.toFixed(2)}
                        </p>
                      )}
                      {creditsInfo.totalCreditPaymentsCard > 0 && (
                        <p style={{ margin: "2px 0", color: "#3b82f6" }}>
                          - Tarjeta: ${creditsInfo.totalCreditPaymentsCard.toFixed(2)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha - Inputs */}
          <div>
            <div className="input-section" style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "6px", display: "block" }}>
                <span style={{ marginRight: "0.5rem" }}>💰</span>
                Efectivo Contado Físicamente:
              </label>
              <div className="input-wrapper" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  ref={inputRef}
                  type="text"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCloseShift();
                    }
                  }}
                  style={{
                    fontSize: "1.2rem",
                    padding: "12px",
                    fontWeight: "600",
                    flex: 1
                  }}
                />
                <button
                  id="btn-calcular-efectivo-contado"
                  type="button"
                  style={{
                    background: "#667eea",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    whiteSpace: "nowrap",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#5568d3";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#667eea";
                  }}
                >
                  🧮 Calcular
                </button>
              </div>
              {difference !== null && (
                <div style={{
                  marginTop: "10px",
                  padding: "10px",
                  borderRadius: "8px",
                  backgroundColor: difference === 0 ? "#d1fae5" : difference > 0 ? "#fee2e2" : "#dbeafe",
                  border: `2px solid ${difference === 0 ? "#059669" : difference > 0 ? "#dc2626" : "#3b82f6"}`,
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: "700",
                    color: difference === 0 ? "#059669" : difference > 0 ? "#dc2626" : "#3b82f6",
                    textAlign: "center"
                  }}>
                    Diferencia: {difference >= 0 ? "+" : ""}${difference.toFixed(2)}
                    {difference !== 0 && (
                      <span style={{ fontSize: "0.85rem", display: "block", marginTop: "2px" }}>
                        {difference > 0 ? "(Sobrante)" : "(Faltante)"}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="input-section" style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "6px", display: "block" }}>
                Observaciones (Opcional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre el cierre del turno..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "2px solid #d1d5db",
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <button
              onClick={loadShiftSummary}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "10px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "600",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#2563eb"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#3b82f6"}
            >
              📊 Ver Resumen Completo
            </button>
          </div>
        </div>

        <div className="payment-modal-actions" style={{ 
          marginTop: "15px",
          paddingTop: "15px",
          borderTop: "2px solid #e5e7eb"
        }}>
          <button 
            className="cancel-btn-payment" 
            onClick={onClose}
            style={{
              fontSize: "0.95rem",
              padding: "10px 20px",
              fontWeight: "600"
            }}
          >
            Cancelar (ESC)
          </button>
          <button
            className="confirm-btn"
            onClick={handleCloseShift}
            disabled={loading}
            style={{
              fontSize: "0.95rem",
              padding: "10px 20px",
              fontWeight: "600"
            }}
          >
            {loading ? "Cerrando..." : "Cerrar Turno (Enter)"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftModal;

