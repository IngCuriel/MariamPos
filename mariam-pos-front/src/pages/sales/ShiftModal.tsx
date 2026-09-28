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
import ShiftSummaryModal from "./ShiftSummaryModal";
import type {
  CashRegisterShift,
  OpenShiftInput,
  CloseShiftInput,
  CashMovement,
  ShiftSummary,
} from "../../types/index";
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import TouchCalculator from '../../components/TouchCalculator';
import "../../styles/pages/sales/paymentModal.css";
import "../../styles/pages/sales/shiftCloseSummary.css";

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
  const [summaryData, setSummaryData] = useState<ShiftSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
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
        text: `Turno #${shift.id} iniciado correctamente`,
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

    // Confirmación para evitar cierres accidentales (ej: escaneo con Enter).
    const confirm = await Swal.fire({
      icon: "question",
      title: "¿Cerrar el turno de caja?",
      html: `Estás por cerrar el <strong>Turno #${activeShift.id}</strong>.<br/>Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar turno",
      cancelButtonText: "No, cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
      focusCancel: true, // el foco por defecto en "No" para que Enter no cierre solo
    });
    if (!confirm.isConfirmed) return;

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
          <p>Turno #${shift.id} cerrado correctamente</p>
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
      const summary = await getShiftSummary(activeShift.id);

      // Calcular efectivo esperado y persistirlo en el summary para que el
      // modal React lo muestre sin recalcular:
      // Fondo inicial + Ventas en efectivo + Neto de movimientos
      //   + Abonos en efectivo - Créditos generados.
      // Los créditos se restan porque representan dinero que NO se recibió en efectivo.
      const ventasEfectivo =
        summary.paymentMethods?.efectivo?.total || summary.totals?.totalCash || 0;
      const netoMovimientos = summary.cashMovementsSummary?.neto || 0;
      const abonosEfectivo = summary.creditsInfo?.totalCreditPaymentsCash || 0;
      const creditosGenerados = summary.creditsInfo?.totalCreditsGenerated || 0;
      const expectedCash =
        summary.shift.initialCash +
        ventasEfectivo +
        netoMovimientos +
        abonosEfectivo -
        creditosGenerados;

      setSummaryData({
        ...summary,
        shift: { ...summary.shift, expectedCash },
      });
      setShowSummary(true);
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
  // Calcular SIEMPRE localmente con los datos frescos de creditsInfo/movimientos.
  // No usar activeShift.expectedCash: es un valor precalculado por el backend que
  // puede no incluir abonos aplicados durante el turno (quedaría desfasado).
  const expectedCash =
    activeShift.initialCash +
    activeShift.totalCash +
    totalCashMovements +
    abonosEfectivo -
    creditosGenerados;
  const difference =
    finalCash && parseFloat(finalCash) >= 0
      ? parseFloat(finalCash) - expectedCash
      : null;

  // Entradas / salidas de efectivo (para el bloque de movimientos)
  const totalEntradas = cashMovements
    .filter((m) => m.type === "ENTRADA")
    .reduce((sum, m) => sum + m.amount, 0);
  const totalSalidas = cashMovements
    .filter((m) => m.type === "SALIDA")
    .reduce((sum, m) => sum + m.amount, 0);

  // Separar "Regalo" de "Otros" dentro de totalOther, usando las ventas del turno.
  let totalRegalo = 0;
  if (activeShift.sales && Array.isArray(activeShift.sales)) {
    totalRegalo = activeShift.sales
      .filter(
        (sale: any) =>
          sale.paymentMethod &&
          sale.paymentMethod.toLowerCase().includes("regalo")
      )
      .reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);
  }
  const totalOtros = activeShift.totalOther - totalRegalo;

  // Formateador de moneda unificado (2 decimales, sin redondeo).
  const money = (n: number) => `$${(n || 0).toFixed(2)}`;

  return (
    <>
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
            Turno #{activeShift.id}
          </p>
        </div>

        {/* Layout en dos columnas */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", 
          gap: "15px",
          marginBottom: "15px"
        }}>
          {/* Columna izquierda - Resumen del turno (reorganizado) */}
          <div className="shsi-card">
            <h3 className="shsi-title">Resumen del Turno</h3>

            {/* 1) Fondo inicial */}
            <div className="shsi-section">
              <span className="shsi-section-label">Fondo inicial</span>
              <div className="shsi-row shsi-row--strong">
                <span>💵 Fondo con el que abrió la caja</span>
                <span>{money(activeShift.initialCash)}</span>
              </div>
            </div>

            {/* 2) Tipos de cobro */}
            <div className="shsi-section">
              <span className="shsi-section-label">Cobros del turno</span>
              <div className="shsi-row">
                <span>💵 Efectivo</span>
                <span className="shsi-amount shsi-amount--cash">{money(activeShift.totalCash)}</span>
              </div>
              <div className="shsi-row">
                <span>💳 Tarjeta</span>
                <span className="shsi-amount shsi-amount--card">{money(activeShift.totalCard)}</span>
              </div>
              <div className="shsi-row">
                <span>🏦 Transferencia</span>
                <span className="shsi-amount shsi-amount--transfer">{money(activeShift.totalTransfer)}</span>
              </div>
              {totalRegalo > 0 && (
                <div className="shsi-row">
                  <span>🎁 Regalo</span>
                  <span className="shsi-amount shsi-amount--gift">{money(totalRegalo)}</span>
                </div>
              )}
              {totalOtros > 0 && (
                <div className="shsi-row">
                  <span>📋 Otros</span>
                  <span className="shsi-amount shsi-amount--other">{money(totalOtros)}</span>
                </div>
              )}
            </div>

            {/* 3) Créditos y abonos (en línea) */}
            {creditsInfo && (creditsInfo.creditsCount > 0 || creditsInfo.paymentsCount > 0) && (
              <div className="shsi-section shsi-section--credits shsi-section--inline">
                <span className="shsi-section-label">Créditos y abonos</span>
                <div className="shsi-inline">
                  {creditsInfo.creditsCount > 0 && (
                    <div className="shsi-cell">
                      <span className="shsi-cell-label">Fiado generado ({creditsInfo.creditsCount})</span>
                      <span className="shsi-cell-value shsi-amount--due">
                        {money(creditsInfo.totalCreditsGenerated)}
                      </span>
                    </div>
                  )}
                  {creditsInfo.totalCreditPaymentsCash > 0 && (
                    <div className="shsi-cell">
                      <span className="shsi-cell-label">Abonos efectivo ({creditsInfo.paymentsCount})</span>
                      <span className="shsi-cell-value shsi-amount--cash">
                        +{money(creditsInfo.totalCreditPaymentsCash)}
                      </span>
                    </div>
                  )}
                  {creditsInfo.totalCreditPaymentsCard > 0 && (
                    <div className="shsi-cell">
                      <span className="shsi-cell-label">Abonos tarjeta</span>
                      <span className="shsi-cell-value shsi-amount--card">
                        {money(creditsInfo.totalCreditPaymentsCard)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4) Movimientos de efectivo (en línea) */}
            {cashMovements.length > 0 && (
              <div className="shsi-section shsi-section--inline">
                <span className="shsi-section-label">
                  Movimientos de efectivo ({cashMovements.length})
                </span>
                <div className="shsi-inline">
                  <div className="shsi-cell">
                    <span className="shsi-cell-label">💰 Entradas</span>
                    <span className="shsi-cell-value shsi-amount--cash">+{money(totalEntradas)}</span>
                  </div>
                  <div className="shsi-cell">
                    <span className="shsi-cell-label">💸 Salidas</span>
                    <span className="shsi-cell-value shsi-amount--due">−{money(totalSalidas)}</span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Columna derecha - Inputs */}
          <div>
            {/* Referencia: total que el cajero debería contar */}
            <div className="shsi-expected shsi-expected--sidebar">
              <span className="shsi-expected-label">Total esperado en caja</span>
              <span className="shsi-expected-value">{money(expectedCash)}</span>
              <span className="shsi-expected-formula">
                Fondo {money(activeShift.initialCash)} + Ventas efectivo {money(activeShift.totalCash)}
                {totalCashMovements !== 0 &&
                  ` ${totalCashMovements >= 0 ? "+" : "−"} Movimientos ${money(Math.abs(totalCashMovements))}`}
                {abonosEfectivo > 0 && ` + Abonos ${money(abonosEfectivo)}`}
                {creditosGenerados > 0 && ` − Créditos ${money(creditosGenerados)}`}
              </span>
            </div>

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

    <ShiftSummaryModal
      isOpen={showSummary}
      summary={summaryData}
      onClose={() => setShowSummary(false)}
    />
    </>
  );
};

export default ShiftModal;

