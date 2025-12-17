import { useState, useEffect, useRef } from "react";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import {
  createCashMovement,
  getCashMovementsByShift,
  deleteCashMovement,
} from "../../api/cashRegister";
import type {
  CashMovement,
  CreateCashMovementInput,
  CashMovementType,
  CashRegisterShift,
} from "../../types/index";
import TouchCalculator from "../../components/TouchCalculator";
import TouchTextKeyboard from "../../components/TouchTextKeyboard";
import "../../styles/pages/sales/paymentModal.css";

interface CashMovementModalProps {
  shift: CashRegisterShift;
  onClose: () => void;
  onMovementCreated?: () => void;
  onFocusSearchInput?: () => void;
}

const CashMovementModal: React.FC<CashMovementModalProps> = ({
  shift,
  onClose,
  onMovementCreated,
  onFocusSearchInput,
}) => {
  const [type, setType] = useState<CashMovementType>("ENTRADA");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);

  // Función para mostrar la calculadora touch
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

  // Función para mostrar el teclado de letras
  const showTouchTextKeyboard = (
    initialValue: string,
    label: string,
    onConfirm: (value: string) => void
  ): void => {
    const keyboardContainer = document.createElement('div');
    keyboardContainer.id = 'touch-text-keyboard-root';
    document.body.appendChild(keyboardContainer);

    const root: Root = createRoot(keyboardContainer);

    const handleClose = () => {
      root.unmount();
      document.body.removeChild(keyboardContainer);
    };

    const handleConfirm = (value: string) => {
      onConfirm(value);
      handleClose();
    };

    root.render(
      <TouchTextKeyboard
        initialValue={initialValue}
        label={label}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );
  };

  // Cargar movimientos al montar
  useEffect(() => {
    loadMovements();
  }, []);

  // Enfocar input cuando cambia el tipo
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [type]);

  const loadMovements = async () => {
    try {
      setLoadingMovements(true);
      const data = await getCashMovementsByShift(shift.id);
      setMovements(data);
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Monto inválido",
        text: "Debe ingresar un monto mayor a 0",
        confirmButtonText: "Entendido",
      });
      return;
    }

    if (!reason.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Razón requerida",
        text: "Debe especificar la razón del movimiento",
        confirmButtonText: "Entendido",
      });
      return;
    }

    setLoading(true);
    try {
      const input: CreateCashMovementInput = {
        shiftId: shift.id,
        type,
        amount: parseFloat(amount),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      };

      await createCashMovement(input);

      Swal.fire({
        icon: "success",
        title: type === "ENTRADA" ? "✅ Entrada registrada" : "✅ Salida registrada",
        text: `Movimiento de $${parseFloat(amount).toFixed(2)} registrado correctamente`,
        timer: 2000,
        showConfirmButton: false,
      });

      // Limpiar formulario
      setAmount("");
      setReason("");
      setNotes("");

      // Recargar movimientos
      await loadMovements();

      onMovementCreated?.();

      // Cerrar modal y enfocar input de buscar producto
      onClose();
      setTimeout(() => {
        onFocusSearchInput?.();
      }, 100);
    } catch (error: any) {
      console.error("Error al registrar movimiento:", error);
      Swal.fire({
        icon: "error",
        title: "Error al registrar movimiento",
        text: error.response?.data?.error || "No se pudo registrar el movimiento",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (movementId: number) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar movimiento?",
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (result.isConfirmed) {
      try {
        await deleteCashMovement(movementId);
        Swal.fire({
          icon: "success",
          title: "Movimiento eliminado",
          timer: 1500,
          showConfirmButton: false,
        });
        await loadMovements();
        onMovementCreated?.();
      } catch (error: any) {
        console.error("Error al eliminar movimiento:", error);
        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: error.response?.data?.error || "No se pudo eliminar el movimiento",
        });
      }
    }
  };

  // Calcular totales de movimientos
  const totalEntradas = movements
    .filter((m) => m.type === "ENTRADA")
    .reduce((sum, m) => sum + m.amount, 0);
  const totalSalidas = movements
    .filter((m) => m.type === "SALIDA")
    .reduce((sum, m) => sum + m.amount, 0);
  const netoMovimientos = totalEntradas - totalSalidas;

  // Manejo de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && !loading) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [amount, reason, type, loading]);

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ 
        maxWidth: "1000px", 
        width: "95%",
        maxHeight: "95vh",
        overflowY: "auto",
        padding: "20px"
      }}>
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={28} />
        </button>

        <h2 className="modal-title" style={{ fontSize: "1.4rem", marginBottom: "12px" }}>
          {type === "ENTRADA" ? "💰 Entrada de Efectivo" : "💸 Salida de Efectivo"}
        </h2>

        <div style={{ marginBottom: "15px", textAlign: "center" }}>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "2px 0" }}>
            Turno: {shift.shiftNumber}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "2px 0" }}>
            {shift.branch} - {shift.cashRegister}
          </p>
        </div>

        {/* Layout en dos columnas */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", 
          gap: "20px",
          marginBottom: "15px"
        }}>
          {/* Columna izquierda - Formulario */}
          <div>
            {/* Selector de tipo */}
            <div className="input-section" style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.9rem" }}>Tipo de Movimiento:</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setType("ENTRADA")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "2px solid",
                    borderColor: type === "ENTRADA" ? "#059669" : "#d1d5db",
                    backgroundColor: type === "ENTRADA" ? "#d1fae5" : "white",
                    color: type === "ENTRADA" ? "#059669" : "#6b7280",
                    fontWeight: type === "ENTRADA" ? "600" : "400",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    transition: "all 0.2s",
                  }}
                >
                  💰 Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setType("SALIDA")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: "2px solid",
                    borderColor: type === "SALIDA" ? "#dc2626" : "#d1d5db",
                    backgroundColor: type === "SALIDA" ? "#fee2e2" : "white",
                    color: type === "SALIDA" ? "#dc2626" : "#6b7280",
                    fontWeight: type === "SALIDA" ? "600" : "400",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    transition: "all 0.2s",
                  }}
                >
                  💸 Salida
                </button>
              </div>
            </div>

            {/* Monto */}
            <div className="input-section" style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.9rem" }}>Monto:</label>
              <div className="input-wrapper" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  style={{ fontSize: "1rem", flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const currentValue = amount.replace(/,/g, '') || '0';
                    showTouchCalculator(currentValue, '💰 Monto', (newValue) => {
                      setAmount(newValue);
                      if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.select();
                      }
                    });
                  }}
                  style={{
                    background: "#667eea",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    whiteSpace: "nowrap",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#5568d3";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#667eea";
                  }}
                  title="Abrir calculadora"
                >
                  🧮
                </button>
              </div>
            </div>

            {/* Razón */}
            <div className="input-section" style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.9rem" }}>Razón *:</label>
              <div className="input-wrapper" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  ref={reasonInputRef}
                  type="text"
                  placeholder={
                    type === "ENTRADA"
                      ? "Ej: Cobro recibido, Reembolso, etc."
                      : "Ej: Pago a proveedor, Retiro, etc."
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  style={{ fontSize: "0.9rem", flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    showTouchTextKeyboard(reason, '📝 Razón', (newValue) => {
                      setReason(newValue);
                      if (reasonInputRef.current) {
                        reasonInputRef.current.focus();
                        reasonInputRef.current.select();
                      }
                    });
                  }}
                  style={{
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    whiteSpace: "nowrap",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#059669";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#10b981";
                  }}
                  title="Abrir teclado de letras"
                >
                  ⌨️
                </button>
              </div>
            </div>

            {/* Notas */}
            <div className="input-section" style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.9rem" }}>Notas (Opcional):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales sobre el movimiento..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  fontSize: "0.85rem",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Columna derecha - Lista de movimientos */}
          <div>
            <div
              style={{
                backgroundColor: "#f3f4f6",
                padding: "15px",
                borderRadius: "10px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                maxHeight: isMobile ? "300px" : "calc(95vh - 300px)",
              }}
            >
              <h4 style={{ 
                marginTop: 0, 
                marginBottom: "12px",
                fontSize: "1rem",
                fontWeight: "700",
                color: "#1f2937"
              }}>
                Movimientos ({movements.length})
              </h4>
              
              {/* Resumen de totales */}
              {movements.length > 0 && (
                <div style={{ 
                  marginBottom: "12px", 
                  padding: "10px",
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb"
                }}>
                  <div style={{ fontSize: "0.85rem" }}>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Total Entradas:</strong>{" "}
                      <span style={{ color: "#059669", fontWeight: "600" }}>
                        +${totalEntradas.toFixed(2)}
                      </span>
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Total Salidas:</strong>{" "}
                      <span style={{ color: "#dc2626", fontWeight: "600" }}>
                        -${totalSalidas.toFixed(2)}
                      </span>
                    </p>
                    <p style={{ 
                      margin: "4px 0", 
                      fontWeight: "600",
                      paddingTop: "6px",
                      borderTop: "1px solid #e5e7eb"
                    }}>
                      <strong>Neto:</strong>{" "}
                      <span
                        style={{
                          color: netoMovimientos >= 0 ? "#059669" : "#dc2626",
                          fontSize: "1rem",
                        }}
                      >
                        {netoMovimientos >= 0 ? "+" : ""}${netoMovimientos.toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Lista de movimientos */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  fontSize: "0.8rem",
                  minHeight: "100px",
                }}
              >
                {loadingMovements ? (
                  <p style={{ textAlign: "center", color: "#6b7280", padding: "20px" }}>
                    Cargando...
                  </p>
                ) : movements.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#6b7280", padding: "20px" }}>
                    No hay movimientos registrados
                  </p>
                ) : (
                  movements.map((movement) => (
                    <div
                      key={movement.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px",
                        marginBottom: "6px",
                        backgroundColor: "#ffffff",
                        borderRadius: "6px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              color: movement.type === "ENTRADA" ? "#059669" : "#dc2626",
                              fontWeight: "700",
                              fontSize: "0.9rem",
                            }}
                          >
                            {movement.type === "ENTRADA" ? "💰 +" : "💸 -"}${movement.amount.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ 
                          color: "#6b7280", 
                          fontSize: "0.75rem",
                          marginTop: "2px"
                        }}>
                          {movement.reason}
                        </div>
                        {movement.notes && (
                          <div style={{ 
                            color: "#9ca3af", 
                            fontSize: "0.7rem",
                            marginTop: "2px",
                            fontStyle: "italic"
                          }}>
                            {movement.notes}
                          </div>
                        )}
                        <div style={{ 
                          color: "#9ca3af", 
                          fontSize: "0.7rem",
                          marginTop: "2px"
                        }}>
                          {formatDate(movement.createdAt).split(',')[1]?.trim()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(movement.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontSize: "1rem",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fee2e2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="payment-modal-actions" style={{ marginTop: "15px" }}>
          <button 
            className="cancel-btn-payment" 
            onClick={onClose}
            style={{ fontSize: "0.9rem", padding: "10px 20px" }}
          >
            Cancelar (ESC)
          </button>
          <button
            className="confirm-btn"
            onClick={handleSubmit}
            disabled={loading}
            style={{ fontSize: "0.9rem", padding: "10px 20px" }}
          >
            {loading
              ? "Registrando..."
              : type === "ENTRADA"
              ? "Registrar Entrada (Enter)"
              : "Registrar Salida (Enter)"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashMovementModal;

