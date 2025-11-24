import React, { useState, useEffect, useRef } from "react";
import { IoCloseCircleOutline, IoAddCircleOutline } from "react-icons/io5";
import type { Product } from "../../types";
import "../../styles/pages/sales/quickAddCalculator.css";
import Swal from "sweetalert2";

interface QuickAddCalculatorProps {
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, productName: string) => void;
  productCounter: number;
}

const QuickAddCalculator: React.FC<QuickAddCalculatorProps> = ({
  onClose,
  onAddToCart,
  productCounter,
}) => {
  const [price, setPrice] = useState<string>("");
  const priceInputRef = useRef<HTMLInputElement>(null);
  const quantity = 1; // Siempre 1

  // Enfocar el input de precio al montar
  useEffect(() => {
    priceInputRef.current?.focus();
  }, []);

  // Manejar teclas del teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        handleAdd();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [price]);

  const handleNumberClick = (num: string) => {
    setPrice((prev) => {
      if (prev === "" || prev === "0") return num;
      return prev + num;
    });
  };

  const handleDecimal = () => {
    if (!price.includes(".")) {
      setPrice((prev) => (prev || "0") + ".");
    }
  };

  const handleClear = () => {
    setPrice("");
  };

  const handleBackspace = () => {
    setPrice((prev) => {
      if (prev.length <= 1) return "";
      return prev.slice(0, -1);
    });
  };

  const handleAdd = () => {
    const prc = parseFloat(price || "0");

    if (prc <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Precio inválido",
        text: "El precio debe ser mayor que cero",
        timer: 2000,
        showConfirmButton: false,
      });
      priceInputRef.current?.focus();
      return;
    }

    // Crear producto no registrado
    const productName = `Producto no registrado ${productCounter}`;
    const product: Product = {
      id: 1,
      code: "000000",
      name: productName,
      status: 1,
      saleType: "Pieza",
      price: prc,
      cost: 0,
      icon: "",
      categoryId: "",
    };

    // Agregar al carrito
    onAddToCart(product, quantity, productName);

    // Limpiar campo de precio
    setPrice("");

    // Mostrar confirmación
    Swal.fire({
      icon: "success",
      title: "✅ Agregado",
      html: `
        <p><strong>${productName}</strong></p>
        <p>Precio: ${prc.toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
        })}</p>
      `,
      timer: 1500,
      showConfirmButton: false,
    });

    // Enfocar precio para siguiente producto
    setTimeout(() => {
      priceInputRef.current?.focus();
    }, 100);
  };

  const total = quantity * parseFloat(price || "0");

  return (
    <div className="quick-add-calculator-inline">
      {/* Header */}
      <div className="quick-add-calculator-header-inline">
        <h2 className="quick-add-calculator-title-inline">
          🧮 Calculadora Rápida
        </h2>
        <button
          className="quick-add-calculator-close-btn-inline"
          onClick={onClose}
          title="Cerrar (ESC)"
        >
          <IoCloseCircleOutline size={24} />
        </button>
      </div>

      {/* Display Section */}
      <div className="quick-add-calculator-display-inline">
        {/* Input oculto para capturar el precio */}
        <input
          ref={priceInputRef}
          type="text"
          className="quick-add-calculator-input-hidden"
          value={price}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, "");
            setPrice(val);
          }}
          placeholder="0.00"
          autoFocus
        />

        <div className="quick-add-calculator-total-inline">
          <label className="quick-add-calculator-label-inline">Total</label>
          <div className="quick-add-calculator-total-value-inline">
            {total.toLocaleString("es-MX", {
              style: "currency",
              currency: "MXN",
            })}
          </div>
        </div>
      </div>

      {/* Calculator Keypad */}
      <div className="quick-add-calculator-keypad-inline">
          <div className="quick-add-calculator-row">
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("7")}
            >
              7
            </button>
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("8")}
            >
              8
            </button>
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("9")}
            >
              9
            </button>
            <button
              className="quick-add-calculator-btn action-btn clear-btn"
              onClick={handleClear}
            >
              C
            </button>
          </div>

          <div className="quick-add-calculator-row">
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("4")}
            >
              4
            </button>
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("5")}
            >
              5
            </button>
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("6")}
            >
              6
            </button>
            <button
              className="quick-add-calculator-btn action-btn backspace-btn"
              onClick={handleBackspace}
            >
              ⌫
            </button>
          </div>

          <div className="quick-add-calculator-row">
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("1")}
            >
              1
            </button>
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("2")}
            >
              2
            </button>
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("3")}
            >
              3
            </button>
            <button
              className="quick-add-calculator-btn action-btn decimal-btn"
              onClick={handleDecimal}
            >
              .
            </button>
          </div>

          <div className="quick-add-calculator-row">
            <button
              className="quick-add-calculator-btn number-btn zero-btn"
              onClick={() => handleNumberClick("0")}
            >
              0
            </button>
            <button
              className="quick-add-calculator-btn number-btn"
              onClick={() => handleNumberClick("00")}
            >
              00
            </button>
            <button
              className="quick-add-calculator-btn action-btn add-btn"
              onClick={handleAdd}
            >
              <IoAddCircleOutline size={24} />
              <span>Agregar</span>
            </button>
          </div>
        </div>

      {/* Footer Info */}
      <div className="quick-add-calculator-footer-inline">
        <p className="quick-add-calculator-hint-inline">
          💡 Presiona Enter para agregar • ESC para cerrar
        </p>
      </div>
    </div>
  );
};

export default QuickAddCalculator;
