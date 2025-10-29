import Swal from 'sweetalert2';
import type { Product } from '../../types/index';

export const ProductComunModal = async (_product: Product) => {
  const { value: formValues } = await Swal.fire({
    title: '🆕 Producto no registrado',
    html: `
      <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
        <label style="font-weight: 600;">Nombre del producto</label>
        <input id="swal-name" type="text" class="swal2-input" placeholder="Ejemplo: Refresco 600ml">

        <label style="font-weight: 600;">Cantidad</label>
        <input id="swal-cantidad" type="number" step="0.01" class="swal2-input" placeholder="Ejemplo: 1">

        <label style="font-weight: 600;">Precio unitario o total</label>
        <input id="swal-precio" type="number" step="0.01" class="swal2-input" placeholder="Ejemplo: 25.00">
      </div>
    `,
    confirmButtonText: 'Agregar al carrito (Enter)',
    cancelButtonText: 'Cancelar (ESC)',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    focusConfirm: false,
    didOpen: () => {
      const nameInput = document.getElementById('swal-name') as HTMLInputElement;
      const cantidadInput = document.getElementById('swal-cantidad') as HTMLInputElement;
      const precioInput = document.getElementById('swal-precio') as HTMLInputElement;
      const confirmButton = Swal.getConfirmButton();

      if (!nameInput || !cantidadInput || !precioInput || !confirmButton) return;

      // Comenzamos enfocando el primer input
      nameInput.focus();

      // Función para pasar el foco con Enter
      const focusNext = (current: HTMLElement, next: HTMLElement) => {
        current.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            next.focus();
          }
        });
      };

      focusNext(nameInput, cantidadInput);
      focusNext(cantidadInput, precioInput);
      focusNext(precioInput, confirmButton);

      // Si está enfocado el botón y presiona Enter => confirmar
      confirmButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmButton.click();
        }
      });
    },
    preConfirm: () => {
        const nombreInput = document.getElementById('swal-name') as HTMLInputElement;
        const cantidadInput = document.getElementById('swal-cantidad') as HTMLInputElement;
        const precioInput = document.getElementById('swal-precio') as HTMLInputElement;

        const nombre = nombreInput?.value.trim();
        const cantidad = parseFloat(cantidadInput?.value || '0');
        const precio = parseFloat(precioInput?.value || '0');

        if (!nombre) {
          Swal.showValidationMessage('⚠️ Ingresa una descripción del producto');
          nombreInput?.focus(); // <--- aquí forzamos el foco al input que falta
          return false;
        }

        if (cantidad <= 0) {
          Swal.showValidationMessage('⚠️ La cantidad debe ser mayor que cero');
          cantidadInput?.focus(); // <--- foco en cantidad
          return false;
        }

        if (precio <= 0) {
          Swal.showValidationMessage('⚠️ El precio debe ser mayor que cero');
          precioInput?.focus(); // <--- foco en precio
          return false;
        }

        return { nombre, cantidad, precio };
      },
  });

  if (formValues) {
    Swal.fire({
      icon: 'success',
      title: '📦 Producto agregado al carrito',
      timer: 2000,
      showConfirmButton: false,
    });
    return formValues;
  }

  return null;
};
