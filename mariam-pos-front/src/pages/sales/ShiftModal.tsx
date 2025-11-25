import { useState, useEffect, useRef } from "react";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import {
  openShift,
  closeShift,
  getActiveShift,
  getShiftSummary,
} from "../../api/cashRegister";
import type {
  CashRegisterShift,
  OpenShiftInput,
  CloseShiftInput,
} from "../../types/index";
import "../../styles/pages/sales/paymentModal.css";

interface ShiftModalProps {
  branch: string;
  cashRegister: string;
  cashierName?: string;
  onClose: () => void;
  onShiftOpened?: (shift: CashRegisterShift) => void;
  onShiftClosed?: (shift: CashRegisterShift) => void;
}

type ModalMode = "open" | "close";

const ShiftModal: React.FC<ShiftModalProps> = ({
  branch,
  cashRegister,
  cashierName,
  onClose,
  onShiftOpened,
  onShiftClosed,
}) => {
  const [mode, setMode] = useState<ModalMode>("open");
  const [initialCash, setInitialCash] = useState<string>("");
  const [finalCash, setFinalCash] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [activeShift, setActiveShift] = useState<CashRegisterShift | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      }
    } catch (error) {
      console.error("Error al verificar turno activo:", error);
    }
  };

  // Enfocar input cuando cambia el modo
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [mode]);

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
      const input: OpenShiftInput = {
        branch,
        cashRegister,
        cashierName: cashierName || undefined,
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
      const summary = await getShiftSummary(activeShift.id);
      const expectedCash = summary.shift.initialCash + summary.totals.totalCash;

      Swal.fire({
        title: "📊 Resumen del Turno",
        html: `
          <div style="text-align: left; margin-top: 15px;">
            <p><strong>Fondo Inicial:</strong> $${summary.shift.initialCash.toFixed(2)}</p>
            <p><strong>Ventas en Efectivo:</strong> $${summary.totals.totalCash.toFixed(2)}</p>
            <p><strong>Ventas en Tarjeta:</strong> $${summary.totals.totalCard.toFixed(2)}</p>
            <p><strong>Ventas en Transferencia:</strong> $${summary.totals.totalTransfer.toFixed(2)}</p>
            <p><strong>Otros:</strong> $${summary.totals.totalOther.toFixed(2)}</p>
            <hr style="margin: 10px 0;">
            <p><strong>Total Esperado en Efectivo:</strong> $${expectedCash.toFixed(2)}</p>
            <p><strong>Total de Ventas:</strong> $${summary.statistics.totalAmount.toFixed(2)}</p>
            <p><strong>Número de Ventas:</strong> ${summary.statistics.totalSales}</p>
            <p><strong>Ticket Promedio:</strong> $${summary.statistics.averageTicket.toFixed(2)}</p>
          </div>
        `,
        width: "500px",
        confirmButtonText: "Cerrar",
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
            {cashierName && (
              <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                Cajero: {cashierName}
              </p>
            )}
          </div>

          <div className="input-section">
            <label>Fondo Inicial (Efectivo en Caja):</label>
            <div className="input-wrapper">
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleOpenShift();
                  }
                }}
              />
            </div>
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

  const expectedCash = activeShift.initialCash + activeShift.totalCash;
  const difference =
    finalCash && parseFloat(finalCash) >= 0
      ? parseFloat(finalCash) - expectedCash
      : null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: "600px" }}>
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={32} />
        </button>

        <h2 className="modal-title">🔴 Cerrar Turno de Caja</h2>

        <div style={{ marginBottom: "20px", textAlign: "center" }}>
          <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            {activeShift.shiftNumber}
          </p>
          <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            {branch} - {cashRegister}
          </p>
        </div>

        <div
          style={{
            backgroundColor: "#f3f4f6",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Resumen del Turno</h3>
          <div style={{ textAlign: "left", fontSize: "0.9rem" }}>
            <p>
              <strong>Fondo Inicial:</strong> $
              {activeShift.initialCash.toFixed(2)}
            </p>
            <p>
              <strong>Ventas en Efectivo:</strong> $
              {activeShift.totalCash.toFixed(2)}
            </p>
            <p>
              <strong>Ventas en Tarjeta:</strong> $
              {activeShift.totalCard.toFixed(2)}
            </p>
            <p>
              <strong>Ventas en Transferencia:</strong> $
              {activeShift.totalTransfer.toFixed(2)}
            </p>
            <p>
              <strong>Otros:</strong> ${activeShift.totalOther.toFixed(2)}
            </p>
            <hr style={{ margin: "10px 0" }} />
            <p>
              <strong>Total Esperado en Efectivo:</strong> $
              {expectedCash.toFixed(2)}
            </p>
          </div>
          <button
            onClick={loadShiftSummary}
            style={{
              marginTop: "10px",
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Ver Resumen Completo
          </button>
        </div>

        <div className="input-section">
          <label>Efectivo Contado Físicamente:</label>
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={finalCash}
              onChange={(e) => setFinalCash(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCloseShift();
                }
              }}
            />
          </div>
          {difference !== null && (
            <p
              className="change-text"
              style={{
                color:
                  difference === 0
                    ? "#059669"
                    : difference > 0
                    ? "#dc2626"
                    : "#3b82f6",
                fontWeight: "600",
              }}
            >
              Diferencia: {difference >= 0 ? "+" : ""}
              {difference.toFixed(2)}
              {difference !== 0 && (
                <span style={{ fontSize: "0.85rem", marginLeft: "8px" }}>
                  {difference > 0 ? "(Sobrante)" : "(Faltante)"}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="input-section">
          <label>Observaciones (Opcional):</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas sobre el cierre del turno..."
            rows={3}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div className="payment-modal-actions">
          <button className="cancel-btn-payment" onClick={onClose}>
            Cancelar (ESC)
          </button>
          <button
            className="confirm-btn"
            onClick={handleCloseShift}
            disabled={loading}
          >
            {loading ? "Cerrando..." : "Cerrar Turno (Enter)"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftModal;

