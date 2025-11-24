import Swal from 'sweetalert2';
import type { Product, ProductPresentation } from '../../types/index';

export const PresentationModal = async (product: Product): Promise<{ presentation: ProductPresentation; quantity: number } | null> => {
  if (!product.presentations || product.presentations.length === 0) {
    return null;
  }

  // Si solo hay una presentación (la base), retornarla directamente
  if (product.presentations.length === 1) {
    return {
      presentation: product.presentations[0],
      quantity: 1,
    };
  }

  // Crear HTML para mostrar las presentaciones como tarjetas
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
    title: `📦 Selecciona la presentación`,
    html: `
      <div style="text-align: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #1f2937; font-size: 1.2rem;">${product.name}</h3>
        <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">Elige cómo quieres vender este producto</p>
      </div>
      <div id="presentations-container" style="max-height: 400px; overflow-y: auto; padding: 0.5rem;">
        ${presentationsHTML}
      </div>
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
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
    `,
    width: '600px',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Agregar al carrito (Enter)',
    cancelButtonText: 'Cancelar (ESC)',
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#ef4444',
    didOpen: () => {
      const quantityInput = document.getElementById('swal-quantity') as HTMLInputElement;
      const confirmButton = Swal.getConfirmButton();
      const cards = document.querySelectorAll('.presentation-card');
      let selectedCardIndex = 0;

      if (!quantityInput || !confirmButton || cards.length === 0) return;

      // Función para actualizar la selección visual
      const updateSelection = (index: number) => {
        cards.forEach((c, i) => {
          const cardEl = c as HTMLElement;
          const isDefault = product.presentations![i].isDefault || product.presentations![i].quantity === 1;
          
          if (i === index) {
            cardEl.style.border = '2px solid #10b981';
            cardEl.style.background = '#ecfdf5';
            cardEl.setAttribute('data-selected', 'true');
          } else {
            cardEl.style.border = '2px solid #e5e7eb';
            cardEl.style.background = isDefault ? '#f0f9ff' : '#fff';
            cardEl.removeAttribute('data-selected');
          }
        });
        selectedCardIndex = index;
      };

      // Seleccionar la primera tarjeta por defecto
      updateSelection(0);

      // Agregar eventos de clic a las tarjetas
      cards.forEach((card, index) => {
        card.addEventListener('click', () => {
          updateSelection(index);
        });

        // Hover effect
        card.addEventListener('mouseenter', () => {
          if (selectedCardIndex !== index) {
            (card as HTMLElement).style.border = '2px solid #3b82f6';
            (card as HTMLElement).style.background = '#f0f9ff';
          }
        });

        card.addEventListener('mouseleave', () => {
          if (selectedCardIndex !== index) {
            const isDefault = product.presentations![index].isDefault || product.presentations![index].quantity === 1;
            (card as HTMLElement).style.border = '2px solid #e5e7eb';
            (card as HTMLElement).style.background = isDefault ? '#f0f9ff' : '#fff';
          }
        });
      });

      // Navegación con teclado
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = Math.min(selectedCardIndex + 1, cards.length - 1);
          updateSelection(newIndex);
          (cards[newIndex] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.max(selectedCardIndex - 1, 0);
          updateSelection(newIndex);
          (cards[newIndex] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (e.key === 'Enter' && document.activeElement === quantityInput) {
          e.preventDefault();
          confirmButton.click();
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      // Enfocar el input de cantidad
      quantityInput.focus();
      quantityInput.select();

      // Limpiar listener al cerrar
      Swal.getContainer()?.addEventListener('hidden', () => {
        document.removeEventListener('keydown', handleKeyDown);
      });
    },
    preConfirm: () => {
      const quantityInput = document.getElementById('swal-quantity') as HTMLInputElement;
      // Buscar la tarjeta seleccionada usando el atributo data-selected
      const selectedCard = document.querySelector('.presentation-card[data-selected="true"]') as HTMLElement;
      
      if (!selectedCard || !quantityInput) {
        Swal.showValidationMessage('Por favor selecciona una presentación');
        return false;
      }

      const quantity = parseInt(quantityInput.value) || 1;
      if (quantity <= 0) {
        Swal.showValidationMessage('La cantidad debe ser mayor a 0');
        quantityInput.focus();
        return false;
      }

      const cardIndex = parseInt(selectedCard.getAttribute('data-index') || '0');
      return {
        presentationIndex: cardIndex,
        quantity,
      };
    },
  });

  if (selectedIndex && product.presentations) {
    // SweetAlert2 puede retornar el valor directamente o como objeto
    const result = typeof selectedIndex === 'object' && 'presentationIndex' in selectedIndex
      ? selectedIndex
      : null;
    
    if (result && result.presentationIndex !== undefined) {
      const selectedPresentation = product.presentations[result.presentationIndex];
      if (selectedPresentation) {
        return {
          presentation: selectedPresentation,
          quantity: result.quantity || 1,
        };
      }
    }
  }

  return null;
};

