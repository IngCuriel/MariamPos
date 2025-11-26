import Swal from "sweetalert2";
import type { Product, ProductPresentation } from '../../types/index';

export const PresentationModal = async (product: Product): Promise<{ presentation: ProductPresentation; quantity: number; granelData?: { cantidad: number; precio: number } } | null> => {
  if (!product.presentations || product.presentations.length === 0) {
    return null;
  }

  if (product.presentations.length === 1) {
    return {
      presentation: product.presentations[0],
      quantity: 1,
    };
  }

  // Verificar si es producto a granel con múltiples presentaciones
  const isGranel = product.saleType === 'Granel';

  const presentationsHTML = product.presentations
    .map((pres, index) => {
      const totalPrice = pres.quantity * pres.unitPrice;
      const isDefault = pres.isDefault || pres.quantity === 1;
      return `
        <div class="presentation-card" data-index="${index}" style="
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          background: ${isDefault ? '#f0f9ff' : '#fff'};
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <strong style="font-size: 1.1rem; color: #1f2937;">${pres.name}</strong>
                ${isDefault ? '<span style="background: #3b82f6; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Base</span>' : ''}
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: #6b7280;">
                <span>📦 ${pres.quantity} unidad${pres.quantity !== 1 ? 'es' : ''}</span>
                <span>💰 $${pres.unitPrice.toFixed(2)} c/u</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">
                $${totalPrice.toFixed(2)}
              </div>
              <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">
                Total
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const { value: selectedIndex } = await Swal.fire({
    title: ``,
    html: `
      <div style="text-align: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #1f2937; font-size: 1.2rem;">${product.name}</h3>
        <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">Elige cómo quieres vender este producto</p>
      </div>
      <div id="presentations-container" style="max-height: 400px; overflow-y: auto; padding: 0.5rem;">
        ${presentationsHTML}
      </div>
      <div id="presentation-quantity-field" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
        <label for="swal-quantity" style="display: block; font-weight: 600; margin-bottom: 0.5rem; text-align: left;">Cantidad de presentaciones:</label>
        <input 
          id="swal-quantity" 
          type="number" 
          value="1" 
          min="1" 
          step="1" 
          class="swal2-input" 
          placeholder="Ejemplo: 2"
          style="width: 70%;"
        >
      </div>
      ${isGranel ? `
      <div id="granel-fields" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; display: none;">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="swal-granel-cantidad" style="display: block; font-weight: 600; margin-bottom: 0.5rem; text-align: left;">Cantidad (kg, L, etc.):</label>
            <input 
              id="swal-granel-cantidad" 
              type="number" 
              value="1" 
              step="0.01" 
              min="0.01"
              class="swal2-input" 
              placeholder="Ejemplo: 0.5"
            >
          </div>
          <div>
            <label for="swal-granel-precio" style="display: block; font-weight: 600; margin-bottom: 0.5rem; text-align: left;">Precio por unidad o total:</label>
            <input 
              id="swal-granel-precio" 
              type="number" 
              value="${product.price}" 
              step="0.01" 
              min="0"
              class="swal2-input" 
              placeholder="Ejemplo: 25.00"
            >
          </div>
        </div>
      </div>
      ` : ''}
    `,
    width: '600px',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Agregar al carrito (Enter)',
    cancelButtonText: 'Cancelar (ESC)',
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#ef4444',

    // importante para recibir teclas en container en fase capture
    keydownListenerCapture: true,
    allowOutsideClick: false,
    allowEnterKey: true,
    allowEscapeKey: true,

    didOpen: () => {
      const quantityInput = document.getElementById('swal-quantity') as HTMLInputElement | null;
      const presentationQuantityField = document.getElementById('presentation-quantity-field') as HTMLElement | null;
      const cards = Array.from(document.querySelectorAll('.presentation-card')) as HTMLElement[];
      const granelFields = document.getElementById('granel-fields') as HTMLElement | null;
      const granelCantidadInput = document.getElementById('swal-granel-cantidad') as HTMLInputElement | null;
      const granelPrecioInput = document.getElementById('swal-granel-precio') as HTMLInputElement | null;
      let selectedCardIndex = 0;
      let isBaseSelected = false;

      if (!quantityInput || cards.length === 0) return;

      // función visual
      const updateSelection = (index: number) => {
        cards.forEach((c, i) => {
          const isDefault = product.presentations![i].isDefault || product.presentations![i].quantity === 1;
          if (i === index) {
            c.style.border = '2px solid #10b981';
            c.style.background = '#ecfdf5';
            c.setAttribute('data-selected', 'true');
          } else {
            c.style.border = '2px solid #e5e7eb';
            c.style.background = isDefault ? '#f0f9ff' : '#fff';
            c.removeAttribute('data-selected');
          }
        });
        selectedCardIndex = index;
        
        // Verificar si la presentación seleccionada es la base y si es producto a granel
        if (isGranel && granelFields && presentationQuantityField && granelCantidadInput && granelPrecioInput) {
          const selectedPres = product.presentations![index];
          const wasBaseSelected = isBaseSelected;
          isBaseSelected = selectedPres.isDefault || selectedPres.quantity === 1;
          
          if (isBaseSelected) {
            // Mostrar campos granel y ocultar campo de cantidad de presentaciones
            granelFields.style.display = 'block';
            presentationQuantityField.style.display = 'none';
            // Inicializar valores con el precio de la presentación base seleccionada
            const precioBase = selectedPres.unitPrice;
            // Si ya había campos granel visibles, mantener la cantidad y recalcular el precio
            // Si no, inicializar con 1
            const cantidadActual = wasBaseSelected ? (parseFloat(granelCantidadInput.value) || 1) : 1;
            granelCantidadInput.value = cantidadActual.toString();
            granelPrecioInput.value = (cantidadActual * precioBase).toFixed(2);
            // Enfocar el input de cantidad
            setTimeout(() => {
              granelCantidadInput.focus();
              granelCantidadInput.select();
            }, 50);
          } else {
            // Ocultar campos granel y mostrar campo de cantidad de presentaciones
            granelFields.style.display = 'none';
            presentationQuantityField.style.display = 'block';
            // Enfocar el input de cantidad de presentaciones
            setTimeout(() => {
              quantityInput?.focus();
              quantityInput?.select();
            }, 50);
          }
        }
      };

      // seleccionar 1a
      updateSelection(0);

      // click en tarjetas
      cards.forEach((card, index) => {
        card.addEventListener('click', () => {
          updateSelection(index);
          // El updateSelection ya maneja el enfoque según el tipo de presentación
        });

        card.addEventListener('mouseenter', () => {
          if (selectedCardIndex !== index) {
            card.style.border = '2px solid #3b82f6';
            card.style.background = '#f0f9ff';
          }
        });

        card.addEventListener('mouseleave', () => {
          if (selectedCardIndex !== index) {
            const isDefault = product.presentations![index].isDefault || product.presentations![index].quantity === 1;
            card.style.border = '2px solid #e5e7eb';
            card.style.background = isDefault ? '#f0f9ff' : '#fff';
          }
        });
      });

      // --- handler de teclado completo ---
      const handleKeyDown = (e: KeyboardEvent) => {
        // console para debug
        // Si no ves este console.log, prueba abrir devtools antes de abrir modal.
        console.log('PresentationModal keydown ->', e.key);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = Math.min(selectedCardIndex + 1, cards.length - 1);
          updateSelection(newIndex);
          cards[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.max(selectedCardIndex - 1, 0);
          updateSelection(newIndex);
          cards[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }

        if (e.key === 'Enter') {
          // Stop propagation so SweetAlert2 doesn't handle it first
          e.stopImmediatePropagation();
          e.preventDefault();

          // Si el foco está en el input o en el documento, confirmar
          // uso Swal.clickConfirm() porque es más fiable que click() en algunos setups
          Swal.clickConfirm();
        }
      };

      // agregar listener en container en capture (más fiable)
      const container = Swal.getContainer();
      container?.addEventListener('keydown', handleKeyDown, { capture: true });

      // enfocar y seleccionar el input (focus antes de select)
      setTimeout(() => {
        // Si es granel y la primera presentación es base, enfocar el input de cantidad granel
        if (isGranel && granelFields && granelCantidadInput && granelPrecioInput && presentationQuantityField) {
          const firstPres = product.presentations![0];
          if (firstPres.isDefault || firstPres.quantity === 1) {
            granelFields.style.display = 'block';
            presentationQuantityField.style.display = 'none';
            isBaseSelected = true;
            // Inicializar con el precio de la presentación base
            const precioBase = firstPres.unitPrice;
            granelCantidadInput.value = '1';
            granelPrecioInput.value = precioBase.toString();
            granelCantidadInput.focus();
            granelCantidadInput.select();
          } else {
            granelFields.style.display = 'none';
            presentationQuantityField.style.display = 'block';
            quantityInput.focus();
            quantityInput.select();
          }
        } else {
          quantityInput.focus();
          quantityInput.select();
        }
      }, 20);

      // Cálculo automático para campos granel (similar a GranelModal)
      if (isGranel && granelCantidadInput && granelPrecioInput) {
        // Función para obtener el precio unitario de la presentación actual
        const getCurrentUnitPrice = () => {
          const selectedPres = product.presentations![selectedCardIndex];
          return selectedPres ? selectedPres.unitPrice : product.price;
        };

        // Cálculo automático cuando cambia la cantidad
        granelCantidadInput.addEventListener('input', () => {
          const cantidad = parseFloat(granelCantidadInput.value);
          if (!isNaN(cantidad) && cantidad > 0) {
            const precioUnitario = getCurrentUnitPrice();
            const nuevoPrecio = cantidad * precioUnitario;
            granelPrecioInput.value = nuevoPrecio.toFixed(2);
          }
        });

        // Cálculo automático cuando cambia el precio total
        granelPrecioInput.addEventListener('input', () => {
          const precioTotal = parseFloat(granelPrecioInput.value);
          if (!isNaN(precioTotal) && precioTotal > 0) {
            const precioUnitario = getCurrentUnitPrice();
            const nuevaCantidad = precioTotal / precioUnitario;
            granelCantidadInput.value = nuevaCantidad.toFixed(6);
          }
        });

        // Actualizar precio cuando cambia la presentación seleccionada
        const updateGranelPriceOnSelectionChange = () => {
          if (isBaseSelected && granelCantidadInput && granelPrecioInput) {
            const cantidad = parseFloat(granelCantidadInput.value) || 1;
            const precioUnitario = getCurrentUnitPrice();
            const nuevoPrecio = cantidad * precioUnitario;
            granelPrecioInput.value = nuevoPrecio.toFixed(2);
          }
        };

        // Guardar referencia para actualizar cuando cambie la selección
        (window as any).__updateGranelPrice = updateGranelPriceOnSelectionChange;

        // Navegación con Enter entre campos granel
        granelCantidadInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            granelPrecioInput?.focus();
            granelPrecioInput?.select();
          }
        });

        granelPrecioInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const confirmButton = Swal.getConfirmButton();
            confirmButton?.click();
          }
        });
      }

      // limpiar al cerrar el modal
      const removeHandler = () => {
        container?.removeEventListener('keydown', handleKeyDown, { capture: true } as EventListenerOptions);
      };

      // SweetAlert2 dispara eventos propios; usamos 'swal-close' como hook para limpiar
      const popup = Swal.getPopup();
      popup?.addEventListener('swal-close', removeHandler);
      // también limpiar si el container se oculta
      Swal.getContainer()?.addEventListener('hidden', removeHandler);
    },

    preConfirm: () => {
      const quantityInput = document.getElementById('swal-quantity') as HTMLInputElement | null;
      const selectedCard = document.querySelector('.presentation-card[data-selected="true"]') as HTMLElement | null;
      const granelCantidadInput = document.getElementById('swal-granel-cantidad') as HTMLInputElement | null;
      const granelPrecioInput = document.getElementById('swal-granel-precio') as HTMLInputElement | null;

      if (!selectedCard) {
        Swal.showValidationMessage('Por favor selecciona una presentación');
        return false;
      }

      const cardIndex = parseInt(selectedCard.getAttribute('data-index') || '0', 10);
      const selectedPres = product.presentations![cardIndex];
      const isBase = selectedPres.isDefault || selectedPres.quantity === 1;

      // Validar campos granel si es producto a granel y se seleccionó la base
      if (isGranel && isBase && granelCantidadInput && granelPrecioInput) {
        const granelCantidad = parseFloat(granelCantidadInput.value);
        const granelPrecio = parseFloat(granelPrecioInput.value);

        if (!granelCantidad || granelCantidad <= 0) {
          Swal.showValidationMessage('Por favor ingresa una cantidad válida (kg, L, etc.)');
          granelCantidadInput.focus();
          return false;
        }

        if (!granelPrecio || granelPrecio <= 0) {
          Swal.showValidationMessage('Por favor ingresa un precio válido');
          granelPrecioInput.focus();
          return false;
        }

        return {
          presentationIndex: cardIndex,
          quantity: 1, // Para granel con base, siempre es 1 presentación
          granelData: {
            cantidad: granelCantidad,
            precio: granelPrecio,
          },
        };
      }

      // Validar cantidad de presentaciones para presentaciones no base
      if (!quantityInput) {
        Swal.showValidationMessage('Error: campo de cantidad no encontrado');
        return false;
      }

      const quantity = parseInt(quantityInput.value, 10) || 1;
      if (quantity <= 0) {
        Swal.showValidationMessage('La cantidad debe ser mayor a 0');
        quantityInput.focus();
        return false;
      }

      return {
        presentationIndex: cardIndex,
        quantity,
      };
    },
  });

  if (selectedIndex && product.presentations) {
    const result = typeof selectedIndex === 'object' && 'presentationIndex' in selectedIndex
      ? selectedIndex
      : null;

    if (result && result.presentationIndex !== undefined) {
      const selectedPresentation = product.presentations[result.presentationIndex];
      if (selectedPresentation) {
        const returnValue: { presentation: ProductPresentation; quantity: number; granelData?: { cantidad: number; precio: number } } = {
          presentation: selectedPresentation,
          quantity: result.quantity || 1,
        };

        // Incluir datos granel si existen
        if ('granelData' in result && result.granelData) {
          returnValue.granelData = result.granelData as { cantidad: number; precio: number };
        }

        return returnValue;
      }
    }
  }

  return null;
};
