import { useEffect, useMemo, useState } from "react";
import {
  CANCEL_REASONS,
  RETURN_REASONS,
  MERMA_REASONS,
} from "../../constants/index";
import type { SaleReversalReasonType } from "../../types/index";

// Modo de operación: define qué lista de motivos sugeridos se muestra (Req 3.3 / 3.4).
export type ReasonPickerMode = "cancel" | "return";

// Resultado que ReasonPicker expone al padre en cada cambio.
export interface ReasonSelection {
  // Texto del motivo (sugerido o libre). Vacío mientras no haya selección válida.
  reason: string;
  // Clasificación merma/estándar (Req 3.5, 3.7).
  reasonType: SaleReversalReasonType;
  // true cuando el motivo es válido (no vacío). El padre bloquea el envío si es false (Req 3.1, 3.2).
  isValid: boolean;
}

interface ReasonPickerProps {
  // Determina la lista de motivos sugeridos: cancelación vs. devolución.
  mode: ReasonPickerMode;
  // Callback invocado en cada cambio con el motivo y su clasificación.
  onChange: (selection: ReasonSelection) => void;
  // Deshabilita la interacción (p. ej. mientras se envía la operación).
  disabled?: boolean;
  // Oculta el checkbox "Es merma". Útil cuando el destino del inventario se
  // decide con un control aparte en el modal (p. ej. cancelación). El picker
  // sigue reportando reasonType="estandar" por defecto en ese caso.
  hideMermaToggle?: boolean;
}

// Valor interno que representa que la cajera eligió "Otro motivo" (texto libre).
const FREE_TEXT = "__free__";

// Normaliza un motivo canónico de merma para comparación insensible a espacios.
const isCanonicalMermaReason = (reason: string): boolean =>
  (MERMA_REASONS as readonly string[]).includes(reason.trim());

/**
 * ReasonPicker
 *
 * Selector de motivo reutilizable para los modales de cancelación y devolución.
 * - Botones de un clic con los motivos sugeridos según `mode` (Req 3.3 / 3.4).
 * - Opción de motivo libre "Otro motivo" con campo de texto (Req 3.6).
 * - Checkbox "Es merma": se marca y bloquea automáticamente para los motivos
 *   canónicos de merma ("Producto caducado", "Producto defectuoso / dañado", Req 3.5);
 *   para motivo libre, la cajera puede alternarlo manualmente (Req 3.7).
 * - No envía nada por sí mismo: expone el motivo + clasificación + validez vía `onChange`,
 *   para que el modal padre bloquee el envío cuando no hay motivo (Req 3.1, 3.2).
 */
const ReasonPicker: React.FC<ReasonPickerProps> = ({
  mode,
  hideMermaToggle = false,
  onChange,
  disabled = false,
}) => {
  const suggestedReasons = useMemo(
    () => (mode === "cancel" ? CANCEL_REASONS : RETURN_REASONS),
    [mode]
  );

  // Motivo sugerido seleccionado, o FREE_TEXT si se eligió "Otro motivo". null = nada elegido.
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  // Texto escrito en el campo de motivo libre.
  const [freeText, setFreeText] = useState("");
  // Marca manual de merma, solo relevante en motivo libre.
  const [manualMerma, setManualMerma] = useState(false);

  const isFreeText = selectedReason === FREE_TEXT;

  // Texto efectivo del motivo según la selección actual.
  const effectiveReason = isFreeText ? freeText.trim() : selectedReason ?? "";

  // Clasificación efectiva:
  // - Motivo sugerido canónico de merma => "merma" (automático, Req 3.5).
  // - Motivo libre => según el checkbox manual (Req 3.7).
  // - Resto => "estandar".
  const effectiveReasonType: SaleReversalReasonType = isFreeText
    ? manualMerma
      ? "merma"
      : "estandar"
    : selectedReason && isCanonicalMermaReason(selectedReason)
    ? "merma"
    : "estandar";

  const isValid = effectiveReason.length > 0;

  // El checkbox "Es merma" solo es editable en motivo libre; en motivos sugeridos
  // refleja la clasificación automática y queda bloqueado (Req 3.5 / 3.7).
  const mermaChecked = effectiveReasonType === "merma";
  const mermaCheckboxDisabled = disabled || !isFreeText;

  // Notifica al padre en cada cambio relevante.
  useEffect(() => {
    onChange({
      reason: effectiveReason,
      reasonType: effectiveReasonType,
      isValid,
    });
    // onChange se asume estable (envuelto por el padre); se omite de deps a propósito
    // para evitar re-notificaciones si el padre recrea la función en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveReason, effectiveReasonType, isValid]);

  const handleSuggestedClick = (reason: string) => {
    if (disabled) return;
    setSelectedReason(reason);
    setManualMerma(false); // la clasificación de sugeridos es automática
  };

  const handleFreeTextClick = () => {
    if (disabled) return;
    setSelectedReason(FREE_TEXT);
  };

  return (
    <div className="reason-picker" style={{ width: "100%" }}>
      <label
        style={{
          display: "block",
          fontSize: "0.9rem",
          fontWeight: 600,
          color: "#1f2937",
          marginBottom: "8px",
        }}
      >
        Motivo *:
      </label>

      {/* Lista de motivos sugeridos con radio buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          marginBottom: "10px",
        }}
      >
        {suggestedReasons.map((reason) => {
          const active = selectedReason === reason;
          const canonicalMerma = isCanonicalMermaReason(reason);
          return (
            <label
              key={reason}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 10px",
                borderRadius: "7px",
                border: "1px solid",
                borderColor: active ? "#667eea" : "#e5e7eb",
                backgroundColor: active ? "#eef2ff" : "white",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                color: active ? "#4338ca" : "#374151",
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
                opacity: disabled ? 0.6 : 1,
              }}
              title={canonicalMerma ? "Se clasifica como merma" : undefined}
            >
              <input
                type="radio"
                name="reason-picker"
                checked={active}
                disabled={disabled}
                onChange={() => handleSuggestedClick(reason)}
                style={{ accentColor: "#667eea" }}
              />
              <span>
                {reason}
                {canonicalMerma ? " ⚠️" : ""}
              </span>
            </label>
          );
        })}

        {/* Opción "Otro motivo" (texto libre, Req 3.6) */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "7px 10px",
            borderRadius: "7px",
            border: "1px dashed",
            borderColor: isFreeText ? "#667eea" : "#9ca3af",
            backgroundColor: isFreeText ? "#eef2ff" : "white",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            color: isFreeText ? "#4338ca" : "#374151",
            fontWeight: isFreeText ? 600 : 400,
            transition: "all 0.15s",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <input
            type="radio"
            name="reason-picker"
            checked={isFreeText}
            disabled={disabled}
            onChange={handleFreeTextClick}
            style={{ accentColor: "#667eea" }}
          />
          <span>✏️ Otro motivo</span>
        </label>
      </div>

      {/* Campo de texto libre, visible solo cuando se elige "Otro motivo" */}
      {isFreeText && (
        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            autoFocus
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            disabled={disabled}
            placeholder="Escribe el motivo..."
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Checkbox "Es merma" (Req 3.5 automático / 3.7 manual en libre).
          Se oculta cuando el destino del inventario se decide con un control
          aparte en el modal (hideMermaToggle). */}
      {!hideMermaToggle && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.85rem",
            color: mermaCheckboxDisabled ? "#9ca3af" : "#374151",
            cursor: mermaCheckboxDisabled ? "not-allowed" : "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={mermaChecked}
            disabled={mermaCheckboxDisabled}
            onChange={(e) => {
              if (isFreeText) setManualMerma(e.target.checked);
            }}
            style={{ width: "16px", height: "16px" }}
          />
          Es merma (el producto no regresa a existencias)
          {!isFreeText && mermaChecked ? " — automático" : ""}
        </label>
      )}

      {/* Aviso de bloqueo cuando no hay motivo válido */}
      {!isValid && (
        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            fontSize: "0.8rem",
            color: "#dc2626",
          }}
        >
          Selecciona o escribe un motivo para continuar.
        </p>
      )}
    </div>
  );
};

export default ReasonPicker;
