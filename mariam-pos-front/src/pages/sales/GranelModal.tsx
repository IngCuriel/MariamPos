import Swal from 'sweetalert2';
import type {Product} from '../../types/index';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import TouchCalculator from '../../components/TouchCalculator';
import '../../styles/pages/sales/granelModal.css';

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

export const GranelModal = async (product: Product, unitPriceOverride?: number) => {
  // Precio unitario efectivo: si viene un override (ej: precio promocional
  // vigente calculado en la venta) se usa ese; si no, el precio normal.
  const basePrice = parseFloat(product.price.toString()) || 0;
  const precioUnitario =
    unitPriceOverride !== undefined && unitPriceOverride > 0
      ? unitPriceOverride
      : basePrice;
  // ¿Hay promoción aplicada? (el override es menor al precio normal).
  const hasPromo =
    unitPriceOverride !== undefined &&
    unitPriceOverride > 0 &&
    unitPriceOverride < basePrice;
  const cantidadInicial = '1';
  const precioInicial = precioUnitario.toString();

  // Unidad de medida del producto (informativa). Si la tiene, se usa su nombre;
  // si no, se muestra el texto genérico marcado en rojo para avisar al cajero
  // que a ese producto le falta configurar la unidad.
  const unitName = product.unit?.name?.trim();
  const hasUnit = !!unitName;
  const cantidadLabelText = hasUnit
    ? `Cantidad (${unitName})`
    : 'Cantidad (kg, L, etc.)';
  const cantidadLabelClass = hasUnit
    ? 'granel-modal-label'
    : 'granel-modal-label granel-modal-label--no-unit';

  const { value: formValues } = await Swal.fire({
    title: '',
    html: `
      <div class="granel-modal-container">
        <h3 class="granel-modal-title">${product.name}</h3>
        <p class="granel-modal-subtitle">
          ${
            hasPromo
              ? `<span class="granel-modal-promo-badge">🎁 PROMO</span>
                 <span class="granel-modal-price-old">$${basePrice.toFixed(2)}</span>
                 <span class="granel-modal-price-promo">Precio Unitario: $${precioUnitario.toFixed(2)}</span>`
              : `Precio Unitario: $${precioUnitario.toFixed(2)}`
          }
        </p>
        
        <div class="granel-modal-form">
          <div class="granel-modal-field">
            <label for="swal-cantidad" class="${cantidadLabelClass}">
              <span class="granel-modal-label-icon">⚖️</span>
              ${cantidadLabelText}
              ${hasUnit ? '' : '<span class="granel-modal-unit-warn" title="Este producto no tiene unidad de medida configurada">⚠️ sin unidad</span>'}
            </label>
            <div class="granel-modal-input-wrapper">
              <input 
                id="swal-cantidad" 
                type="text" 
                value="${cantidadInicial}" 
                step="0.01" 
                class="granel-modal-input" 
                placeholder="0.00"
                inputmode="decimal"
              />
              <button 
                id="btn-cambiar-cantidad" 
                class="granel-modal-change-btn"
                type="button"
              >
                🧮 Cambiar
              </button>
            </div>
          </div>

          <div class="granel-modal-field">
            <label for="swal-precio" class="granel-modal-label">
              <span class="granel-modal-label-icon">💰</span>
              Precio Total
            </label>
            <div class="granel-modal-input-wrapper">
              <input 
                id="swal-precio" 
                type="text" 
                value="${precioInicial}" 
                step="0.01" 
                class="granel-modal-input" 
                placeholder="0.00"
                inputmode="decimal"
              />
              <button 
                id="btn-cambiar-precio" 
                class="granel-modal-change-btn"
                type="button"
              >
                🧮 Cambiar
              </button>
            </div>
          </div>

          <div class="granel-modal-info">
            <p class="granel-modal-info-text">
              💡 Puedes editar directamente o usar el botón "Cambiar" para la calculadora touch
            </p>
          </div>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '✓ Agregar al carrito',
    cancelButtonText: '✕ Cancelar',
    confirmButtonColor: '#667eea',
    cancelButtonColor: '#64748b',
    customClass: {
      popup: 'granel-modal-popup',
      htmlContainer: 'granel-modal-html-container',
    },
    didOpen: () => {
      // Usar requestAnimationFrame para asegurar que el DOM esté completamente renderizado
      requestAnimationFrame(() => {
        setTimeout(() => {
          const cantidadInput = document.getElementById('swal-cantidad') as HTMLInputElement;
          const precioInput = document.getElementById('swal-precio') as HTMLInputElement;
          const btnCambiarCantidad = document.getElementById('btn-cambiar-cantidad');
          const btnCambiarPrecio = document.getElementById('btn-cambiar-precio');
          const confirmButton = Swal.getConfirmButton();
           
          if (!cantidadInput || !precioInput || !btnCambiarCantidad || !btnCambiarPrecio || !confirmButton) return;
           
          // 🔹 Función mejorada para enfocar el campo cantidad
          const focusInput = () => {
            if (cantidadInput) {
              // Intentar múltiples métodos para asegurar el focus
              cantidadInput.focus();
              cantidadInput.select();
              
              // Usar setSelectionRange para asegurar la selección
              if (cantidadInput.setSelectionRange) {
                cantidadInput.setSelectionRange(0, cantidadInput.value.length);
              }
              
              // Verificar si el focus fue exitoso
              if (document.activeElement !== cantidadInput) {
                // Si no funcionó, intentar de nuevo con un pequeño delay
                setTimeout(() => {
                  cantidadInput.focus();
                  cantidadInput.select();
                  if (cantidadInput.setSelectionRange) {
                    cantidadInput.setSelectionRange(0, cantidadInput.value.length);
                  }
                }, 50);
              }
            }
          };
          
          // Intentar focus inmediatamente
          focusInput();
          
          // También intentar después de delays adicionales para asegurar que funcione
          setTimeout(focusInput, 100);
          setTimeout(focusInput, 200);

      // Función para actualizar el precio cuando cambia la cantidad
      const updatePrecioFromCantidad = () => {
        const cantidad = parseFloat(cantidadInput.value.replace(/,/g, '')) || 0;
        if (cantidad > 0) {
          const nuevoPrecio = cantidad * precioUnitario;
          precioInput.value = nuevoPrecio.toFixed(2);
        }
      };

      // Función para actualizar la cantidad cuando cambia el precio
      const updateCantidadFromPrecio = () => {
        const precioTotal = parseFloat(precioInput.value.replace(/,/g, '')) || 0;
        if (precioTotal > 0 && precioUnitario > 0) {
          const nuevaCantidad = precioTotal / precioUnitario;
          cantidadInput.value = nuevaCantidad.toFixed(6);
        }
      };

      // 🔁 Cálculo automático cuando cambia la cantidad (teclado)
      cantidadInput.addEventListener('input', updatePrecioFromCantidad);
      cantidadInput.addEventListener('blur', updatePrecioFromCantidad);

      // 🔁 Cálculo automático cuando cambia el precio total (teclado)
      precioInput.addEventListener('input', updateCantidadFromPrecio);
      precioInput.addEventListener('blur', updateCantidadFromPrecio);

      // Botón Cambiar Cantidad - Abre calculadora
      btnCambiarCantidad.addEventListener('click', () => {
        const currentValue = cantidadInput.value.replace(/,/g, '') || '0';
        showTouchCalculator(currentValue, '⚖️ Cantidad', (newValue) => {
          cantidadInput.value = newValue;
          updatePrecioFromCantidad();
          cantidadInput.focus();
        });
      });

      // Botón Cambiar Precio - Abre calculadora
      btnCambiarPrecio.addEventListener('click', () => {
        const currentValue = precioInput.value.replace(/,/g, '') || '0';
        showTouchCalculator(currentValue, '💰 Precio Total', (newValue) => {
          precioInput.value = newValue;
          updateCantidadFromPrecio();
          precioInput.focus();
        });
      });

      // Función para pasar el foco con Enter
      const focusNext = (current: HTMLElement, next: HTMLElement) => {
        current.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            next?.focus();
            if (next instanceof HTMLInputElement) next.select();
          }
        });
      };

      focusNext(cantidadInput, precioInput);
      focusNext(precioInput, confirmButton);

      // ⚡ Confirmar con Enter 
      confirmButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmButton.click();
        }
      });
        }, 0); // Delay inicial de 0ms para ejecutar en el siguiente tick
      }); // Cierre del requestAnimationFrame
    },
    preConfirm: () => {
      const cantidad = parseFloat(
        (document.getElementById('swal-cantidad') as HTMLInputElement)?.value.replace(/,/g, '') || '0'
      );
      const precio = parseFloat(
        (document.getElementById('swal-precio') as HTMLInputElement)?.value.replace(/,/g, '') || '0'
      );

      if (!cantidad || cantidad <= 0) {
        Swal.showValidationMessage('Por favor ingresa una cantidad válida mayor a cero');
        return false;
      }

      if (!precio || precio <= 0) {
        Swal.showValidationMessage('Por favor ingresa un precio válido mayor a cero');
        return false;
      }

      return { cantidad, precio };
    }
  });

  if (formValues) {
    console.log('✅ Datos del producto:', formValues);
    return formValues;
  }

  return null;
};