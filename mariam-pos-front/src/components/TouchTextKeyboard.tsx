import React, { useState, useEffect } from 'react';
import { IoCloseCircleOutline } from 'react-icons/io5';
import '../styles/components/touchTextKeyboard.css';

interface TouchTextKeyboardProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
  label: string;
}

const TouchTextKeyboard: React.FC<TouchTextKeyboardProps> = ({
  initialValue,
  onConfirm,
  onClose,
  label,
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [isUpperCase, setIsUpperCase] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === ' ') {
        handleSpace();
      } else if (e.key.length === 1 && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(e.key)) {
        handleLetterClick(isUpperCase ? e.key.toUpperCase() : e.key.toLowerCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, isUpperCase]);

  const handleLetterClick = (letter: string) => {
    setValue((prev) => prev + letter);
    // Cambiar a minúsculas después de escribir (excepto si se mantiene presionado Shift)
    if (isUpperCase) {
      setIsUpperCase(false);
    }
  };

  const handleSpace = () => {
    setValue((prev) => prev + ' ');
  };

  const handleBackspace = () => {
    setValue((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setValue('');
  };

  const handleToggleCase = () => {
    setIsUpperCase((prev) => !prev);
  };

  const handleConfirm = () => {
    onConfirm(value.trim());
  };

  // Teclado QWERTY en español
  const keyboardLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  return (
    <div className="touch-text-keyboard-overlay" onClick={onClose}>
      <div className="touch-text-keyboard-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="touch-text-keyboard-header">
          <h3 className="touch-text-keyboard-title">{label}</h3>
          <button
            className="touch-text-keyboard-close-btn"
            onClick={onClose}
            title="Cerrar (ESC)"
          >
            <IoCloseCircleOutline size={28} />
          </button>
        </div>

        {/* Display */}
        <div className="touch-text-keyboard-display">
          <div className="touch-text-keyboard-display-value">
            {value || <span style={{ color: '#9ca3af' }}>Escribe aquí...</span>}
          </div>
        </div>

        {/* Keyboard */}
        <div className="touch-text-keyboard-keypad">
          {keyboardLayout.map((row, rowIndex) => (
            <div key={rowIndex} className="touch-text-keyboard-row">
              {row.map((letter) => (
                <button
                  key={letter}
                  className="touch-text-keyboard-btn letter-btn"
                  onClick={() => handleLetterClick(isUpperCase ? letter : letter.toLowerCase())}
                >
                  {isUpperCase ? letter : letter.toLowerCase()}
                </button>
              ))}
            </div>
          ))}

          {/* Special keys row */}
          <div className="touch-text-keyboard-row">
            <button
              className="touch-text-keyboard-btn action-btn shift-btn"
              onClick={handleToggleCase}
            >
              {isUpperCase ? '⇧ MAYÚS' : '⇧ mayús'}
            </button>
            <button
              className="touch-text-keyboard-btn action-btn space-btn"
              onClick={handleSpace}
            >
              Espacio
            </button>
            <button
              className="touch-text-keyboard-btn action-btn backspace-btn"
              onClick={handleBackspace}
            >
              ⌫
            </button>
          </div>

          {/* Action buttons row */}
          <div className="touch-text-keyboard-row">
            <button
              className="touch-text-keyboard-btn action-btn clear-btn"
              onClick={handleClear}
            >
              Limpiar
            </button>
            <button
              className="touch-text-keyboard-btn action-btn confirm-btn"
              onClick={handleConfirm}
            >
              ✓ Aceptar
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="touch-text-keyboard-footer">
          <p className="touch-text-keyboard-hint">
            💡 Presiona Enter para aceptar • ESC para cerrar
          </p>
        </div>
      </div>
    </div>
  );
};

export default TouchTextKeyboard;

