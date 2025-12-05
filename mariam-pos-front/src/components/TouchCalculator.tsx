import React, { useState, useEffect } from 'react';
import { IoCloseCircleOutline } from 'react-icons/io5';
import '../styles/components/touchCalculator.css';

interface TouchCalculatorProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
  label: string;
}

const TouchCalculator: React.FC<TouchCalculatorProps> = ({
  initialValue,
  onConfirm,
  onClose,
  label,
}) => {
  const [value, setValue] = useState(initialValue || '0');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key >= '0' && e.key <= '9') {
        handleNumberClick(e.key);
      } else if (e.key === '.') {
        handleDecimal();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value]);

  const handleNumberClick = (num: string) => {
    setValue((prev) => {
      if (prev === '0' || prev === '') return num;
      return prev + num;
    });
  };

  const handleDecimal = () => {
    if (!value.includes('.')) {
      setValue((prev) => (prev || '0') + '.');
    }
  };

  const handleClear = () => {
    setValue('0');
  };

  const handleBackspace = () => {
    setValue((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleConfirm = () => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      onConfirm(value);
    }
  };

  const displayValue = parseFloat(value || '0').toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  return (
    <div className="touch-calculator-overlay" onClick={onClose}>
      <div className="touch-calculator-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="touch-calculator-header">
          <h3 className="touch-calculator-title">{label}</h3>
          <button
            className="touch-calculator-close-btn"
            onClick={onClose}
            title="Cerrar (ESC)"
          >
            <IoCloseCircleOutline size={28} />
          </button>
        </div>

        {/* Display */}
        <div className="touch-calculator-display">
          <div className="touch-calculator-display-value">{displayValue}</div>
        </div>

        {/* Keypad */}
        <div className="touch-calculator-keypad">
          <div className="touch-calculator-row">
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('7')}
            >
              7
            </button>
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('8')}
            >
              8
            </button>
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('9')}
            >
              9
            </button>
            <button
              className="touch-calculator-btn action-btn clear-btn"
              onClick={handleClear}
            >
              C
            </button>
          </div>

          <div className="touch-calculator-row">
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('4')}
            >
              4
            </button>
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('5')}
            >
              5
            </button>
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('6')}
            >
              6
            </button>
            <button
              className="touch-calculator-btn action-btn backspace-btn"
              onClick={handleBackspace}
            >
              ⌫
            </button>
          </div>

          <div className="touch-calculator-row">
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('1')}
            >
              1
            </button>
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('2')}
            >
              2
            </button>
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('3')}
            >
              3
            </button>
            <button
              className="touch-calculator-btn action-btn decimal-btn"
              onClick={handleDecimal}
            >
              .
            </button>
          </div>

          <div className="touch-calculator-row">
            <button
              className="touch-calculator-btn number-btn zero-btn"
              onClick={() => handleNumberClick('0')}
            >
              0
            </button>
            <button
              className="touch-calculator-btn number-btn"
              onClick={() => handleNumberClick('00')}
            >
              00
            </button>
            <button
              className="touch-calculator-btn action-btn confirm-btn"
              onClick={handleConfirm}
            >
              ✓ Aceptar
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="touch-calculator-footer">
          <p className="touch-calculator-hint">
            💡 Presiona Enter para aceptar • ESC para cerrar
          </p>
        </div>
      </div>
    </div>
  );
};

export default TouchCalculator;

