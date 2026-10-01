import Swal from 'sweetalert2';
import type { Product } from '../../types/index';
import { isValidOpenPrice } from '../../utils/openPrice';

/**
 * Price-capture modal for open-price ("Precio Abierto") products.
 *
 * Unlike `ProductComunModal` (which asks for name + quantity + price), this
 * modal asks ONLY for the price: the product name comes from the real catalog
 * product and the quantity is always 1. The price field starts blank (no 0
 * prefilled) and shows a placeholder prompting the cashier to enter the price.
 *
 * The price can be typed with the physical keyboard, or captured with an
 * embedded numeric keypad (toggled by the calculator icon next to the field).
 * The keypad writes into the same price input, so both input methods share one
 * source of truth and the captured price is always tied to the REAL product
 * (never the "Producto no registrado" generic flow).
 *
 * Validation reuses the pure `isValidOpenPrice` helper. On an invalid price the
 * modal shows a validation message and stays open; cancelling resolves to null.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 */
export const OpenPriceModal = async (
  product: Product
): Promise<{ precio: number } | null> => {
  const { value: formValues } = await Swal.fire({
    title: '💲 Precio del producto',
    html: `
      <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
        <label style="font-weight: 600;">${product.name}</label>

        <label style="font-weight: 600;">Precio</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input
            id="swal-precio"
            type="number"
            step="0.01"
            class="swal2-input"
            placeholder="Ingresa el precio"
            style="margin: 0; flex: 1;"
          >
          <button
            id="swal-precio-keypad-toggle"
            type="button"
            title="Mostrar/ocultar teclado numérico"
            aria-label="Mostrar u ocultar teclado numérico"
            style="
              flex: 0 0 auto;
              width: 44px;
              height: 44px;
              font-size: 22px;
              line-height: 1;
              cursor: pointer;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              background: #f3f4f6;
            "
          >🧮</button>
        </div>

        <div id="swal-precio-keypad" style="display: none;">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 6px;">
            <button type="button" class="op-key" data-key="7">7</button>
            <button type="button" class="op-key" data-key="8">8</button>
            <button type="button" class="op-key" data-key="9">9</button>
            <button type="button" class="op-key op-key--action" data-action="clear">C</button>

            <button type="button" class="op-key" data-key="4">4</button>
            <button type="button" class="op-key" data-key="5">5</button>
            <button type="button" class="op-key" data-key="6">6</button>
            <button type="button" class="op-key op-key--action" data-action="backspace">⌫</button>

            <button type="button" class="op-key" data-key="1">1</button>
            <button type="button" class="op-key" data-key="2">2</button>
            <button type="button" class="op-key" data-key="3">3</button>
            <button type="button" class="op-key op-key--action" data-action="decimal">.</button>

            <button type="button" class="op-key" data-key="0" style="grid-column: span 2;">0</button>
            <button type="button" class="op-key" data-key="00">00</button>
            <button type="button" class="op-key op-key--action" data-action="backspace">⌫</button>
          </div>
        </div>

        <style>
          #swal-precio-keypad .op-key {
            padding: 12px 0;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #ffffff;
            color: #111827;
          }
          #swal-precio-keypad .op-key:hover { background: #eef2ff; }
          #swal-precio-keypad .op-key--action { background: #f3f4f6; }
        </style>
      </div>
    `,
    confirmButtonText: 'Agregar al carrito (Enter)',
    cancelButtonText: 'Cancelar (ESC)',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    focusConfirm: false,
    allowOutsideClick: false,
    allowEscapeKey: true,
    didOpen: () => {
      const precioInput = document.getElementById('swal-precio') as HTMLInputElement;
      const confirmButton = Swal.getConfirmButton();
      const keypadToggle = document.getElementById('swal-precio-keypad-toggle');
      const keypad = document.getElementById('swal-precio-keypad');

      if (!precioInput || !confirmButton) return;

      // Enfocamos directamente el único campo (precio), que arranca en blanco.
      precioInput.focus();

      // Enter en el campo de precio pasa el foco al botón de confirmar.
      precioInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmButton.focus();
        }
      });

      // Si está enfocado el botón y presiona Enter => confirmar.
      confirmButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmButton.click();
        }
      });

      // Toggle del teclado numérico embebido.
      if (keypadToggle && keypad) {
        keypadToggle.addEventListener('click', () => {
          const isHidden = keypad.style.display === 'none';
          keypad.style.display = isHidden ? 'block' : 'none';
          // Mantener el foco en el campo de precio para que el teclado físico
          // siga funcionando aunque el keypad esté abierto.
          precioInput.focus();
        });
      }

      // Lógica del keypad: escribe sobre el mismo input de precio.
      const appendDigit = (digit: string) => {
        const current = precioInput.value;
        if (digit === '00' && (current === '' || current === '0')) {
          precioInput.value = '0';
        } else if (current === '0' && digit !== '00') {
          precioInput.value = digit;
        } else {
          precioInput.value = current + digit;
        }
      };

      const addDecimal = () => {
        if (!precioInput.value.includes('.')) {
          precioInput.value = (precioInput.value || '0') + '.';
        }
      };

      const backspace = () => {
        precioInput.value = precioInput.value.slice(0, -1);
      };

      const clear = () => {
        precioInput.value = '';
      };

      keypad?.querySelectorAll('.op-key').forEach((btn) => {
        btn.addEventListener('click', () => {
          const el = btn as HTMLElement;
          const key = el.dataset.key;
          const action = el.dataset.action;

          if (key) {
            appendDigit(key);
          } else if (action === 'decimal') {
            addDecimal();
          } else if (action === 'backspace') {
            backspace();
          } else if (action === 'clear') {
            clear();
          }

          // Devolver el foco al input para seguir tecleando con el teclado físico.
          precioInput.focus();
        });
      });
    },
    preConfirm: () => {
      const precioInput = document.getElementById('swal-precio') as HTMLInputElement;
      const precio = parseFloat(precioInput?.value || '');

      if (!isValidOpenPrice(precio)) {
        Swal.showValidationMessage('⚠️ El precio debe ser mayor que cero');
        precioInput?.focus();
        return false;
      }

      return { precio };
    },
  });

  if (formValues) {
    // No mostrar otro SweetAlert aquí, se maneja en salesPage.
    return formValues as { precio: number };
  }

  return null;
};
