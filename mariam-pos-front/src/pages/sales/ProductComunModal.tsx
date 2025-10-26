import Swal from 'sweetalert2';
import type {Product} from '../../types/index'

export const ProductComunModal = async (_product: Product) => {
  const { value: formValues } = await Swal.fire({
    title: ``,
    html: `
      <div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">
        <label for="" style="font-weight: 600;">Producto</label>
        <input id="swal-name" type="text" value="" class="swal2-input" placeholder="Ejemplo: Nombre del producto">

        <label for="swal-cantidad" style="font-weight: 600;">Cantidad (kg, L, etc.)</label>
        <input id="swal-cantidad" type="number" value="" step="0.01" class="swal2-input" placeholder="Ejemplo: 1">

        <label for="swal-precio" style="font-weight: 600;">Precio por unidad o total</label>
        <input id="swal-precio" type="number" value="" step="0.01" class="swal2-input" placeholder="Ejemplo: 25.00">
      </div>
      `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Aceptar',
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      const nameInput = document.getElementById('swal-name') as HTMLInputElement;
      const cantidadInput = document.getElementById('swal-cantidad') as HTMLInputElement;
      const precioInput = document.getElementById('swal-precio') as HTMLInputElement;

      // 🔹 Enfocar el campo name y colocar el cursor al final del valor
      nameInput?.focus(); 

      // 🔁 Cálculo automático cuando cambia la cantidad
      /*cantidadInput?.addEventListener('input', () => {
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
      });*/

      // ⚡ Confirmar con Enter
      const onEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') Swal.clickConfirm();
      };
      cantidadInput?.addEventListener('keypress', onEnter);
      precioInput?.addEventListener('keypress', onEnter);
    },
    preConfirm: () => {
      const nombre = (document.getElementById('swal-name') as HTMLInputElement)?.value || ''
      
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

      console.log('nameProduct' ,nombre)
      if (!nombre) {
         Swal.showValidationMessage('Por favor alguna descripción del producto');
         const nameInput = document.getElementById('swal-name') as HTMLInputElement;
         nameInput?.focus(); 
        return;
      }

      return {nombre, cantidad, precio };
    }
  });

  if (formValues) {
    console.log('✅ Datos del producto:', formValues);
    return formValues;
  }

  return null;
};