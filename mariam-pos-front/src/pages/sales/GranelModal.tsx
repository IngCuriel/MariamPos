import Swal from 'sweetalert2';
import type {Product} from '../../types/index'

export const GranelModal = async (product: Product) => {
  const { value: formValues } = await Swal.fire({
    title: `Precio Unitario = ${product.price}`,
    html: `
      <h3 style="margin-bottom: 10px;">${product.name}</h3>
      <div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">
        <label for="swal-cantidad" style="font-weight: 600;">Cantidad (kg, L, etc.)</label>
        <input id="swal-cantidad" type="number" value="1" step="0.01" class="swal2-input" placeholder="Ejemplo: 0.5">

        <label for="swal-precio" style="font-weight: 600;">Precio por unidad o total</label>
        <input id="swal-precio" type="number" value="${product.price}" step="0.01" class="swal2-input" placeholder="Ejemplo: 25.00">
      </div>
      `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Aceptar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    didOpen: () => {
      const cantidadInput = document.getElementById('swal-cantidad') as HTMLInputElement;
      const precioInput = document.getElementById('swal-precio') as HTMLInputElement;
      const confirmButton = Swal.getConfirmButton();
       
      if ( !cantidadInput || !precioInput || !confirmButton) return;
       
      // 🔹 Enfocar el campo cantidad y colocar el cursor al final del valor
      cantidadInput?.focus(); 
      cantidadInput?.select();

       // Función para pasar el foco con Enter
      const focusNext = (current: HTMLElement, next: HTMLElement) => {
        current.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            next?.focus();
            if (next instanceof HTMLInputElement) next.select(); // 👈 también selecciona el siguiente
           }
        });
      };

      focusNext(cantidadInput, precioInput);
      focusNext(precioInput, confirmButton);

      // 🔁 Cálculo automático cuando cambia la cantidad
      cantidadInput?.addEventListener('input', () => {
        const cantidad = parseFloat(cantidadInput.value);
        if (!isNaN(cantidad)) {
          const nuevoPrecio = cantidad * product.price;
          precioInput.value = nuevoPrecio.toFixed(2);
        }
      });

      // 🔁 Cálculo automático cuando cambia el precio total
      precioInput?.addEventListener('input', () => {
        const precioTotal = parseFloat(precioInput.value);
        if (!isNaN(precioTotal)) {
          const nuevaCantidad = precioTotal / product.price;
          cantidadInput.value = nuevaCantidad.toFixed(6);
        }
      });

      // ⚡ Confirmar con Enter 
      confirmButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmButton.click();
        }
      });
    },
    preConfirm: () => {
      const cantidad = parseFloat(
        (document.getElementById('swal-cantidad') as HTMLInputElement)?.value || '0'
      );
      const precio = parseFloat(
        (document.getElementById('swal-precio') as HTMLInputElement)?.value || '0'
      );

      if (!cantidad || !precio) {
        Swal.showValidationMessage('Por favor ingresa cantidad y precio válidos');
        return;
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