import Swal from "sweetalert2";
import type { Product, ProductPresentation } from '../../types/index';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import TouchCalculator from '../../components/TouchCalculator';

// Función para mostrar la calculadora touch (reutilizada de GranelModal)
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

  // Nombre de la unidad de medida del producto (ej: "Kilogramo"). Fallback: "unidad".
  const unitName = product.unit?.name || 'unidad';
  const unitPlural = product.unit?.name ? product.unit.name : 'unidades';

  const presentationsHTML = product.presentations
    .map((pres, index) => {
      const totalPrice = pres.quantity * pres.unitPrice;
      const isDefault = pres.isDefault || pres.quantity === 1;

      // Contenido (unidades que trae) usando el nombre de la unidad:
      // - Base:  "1 Kilogramo"
      // - No base: "20 Kilogramos por Bulto"
      const contentLabel = isDefault
        ? `${pres.quantity} ${pres.quantity === 1 ? unitName : unitPlural}`
        : `${pres.quantity} ${unitPlural} por ${pres.name}`;

      return `
        <div class="presentation-card" data-index="${index}" style="
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          padding: 0.6rem 0.8rem;
          margin-bottom: 0.5rem;
          cursor: pointer;
          transition: all 0.15s ease;
          background: ${isDefault ? '#f0f9ff' : '#fff'};
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem;">
                <strong style="font-size: 1rem; color: #1f2937;">${pres.name}</strong>
                ${isDefault ? '<span style="background: #3b82f6; color: white; padding: 0.1rem 0.4rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700;">Base</span>' : ''}
              </div>
              <div style="font-size: 0.82rem; color: #6b7280;">
                ${contentLabel} · $${pres.unitPrice.toFixed(2)} por ${unitName}
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div style="font-size: 1.25rem; font-weight: 800; color: #059669; white-space: nowrap;">
                $${totalPrice.toFixed(2)}
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
      <div style="text-align: center; margin-bottom: 0.6rem;">
        <h3 style="margin: 0; color: #1f2937; font-size: 1.1rem;">${product.name}</h3>
        <p style="margin: 0.2rem 0 0 0; color: #6b7280; font-size: 0.82rem;">Elegí la presentación</p>
      </div>
      <div id="presentations-container" style="max-height: 320px; overflow-y: auto; padding: 0.25rem;">
        ${presentationsHTML}
      </div>
      <div id="presentation-quantity-field" style="margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid #e5e7eb;">
        <label for="swal-quantity" id="swal-quantity-label" style="display: block; font-weight: 600; margin-bottom: 0.35rem; text-align: left; font-size: 0.85rem;">
          📦 ¿Cuántas presentaciones?
        </label>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <input 
            id="swal-quantity" 
            type="text" 
            value="1" 
            min="1" 
            step="1" 
            class="swal2-input" 
            placeholder="Ejemplo: 2"
            inputmode="numeric"
            style="flex: 1;"
          />
          <button 
            id="btn-cambiar-cantidad-presentaciones" 
            type="button"
            style="
              background: #667eea;
              color: white;
              border: none;
              border-radius: 8px;
              padding: 10px 16px;
              font-weight: 600;
              cursor: pointer;
              font-size: 0.9rem;
              white-space: nowrap;
              transition: background 0.2s ease;
            "
            onmouseover="this.style.background='#5568d3'"
            onmouseout="this.style.background='#667eea'"
          >
            🧮 Cambiar
          </button>
        </div>
      </div>
      ${isGranel ? `
      <div id="granel-fields" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; display: none;">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="swal-granel-cantidad" style="display: block; font-weight: 600; margin-bottom: 0.35rem; text-align: left; font-size: 0.85rem;">
              ⚖️ Cantidad en ${unitPlural}:
            </label>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input 
                id="swal-granel-cantidad" 
                type="text" 
                value="1" 
                step="0.01" 
                min="0.01"
                class="swal2-input" 
                placeholder="Ejemplo: 0.5"
                inputmode="decimal"
                style="flex: 1;"
              />
              <button 
                id="btn-cambiar-cantidad-granel" 
                type="button"
                style="
                  background: #667eea;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  padding: 10px 16px;
                  font-weight: 600;
                  cursor: pointer;
                  font-size: 0.9rem;
                  white-space: nowrap;
                  transition: background 0.2s ease;
                "
                onmouseover="this.style.background='#5568d3'"
                onmouseout="this.style.background='#667eea'"
              >
                🧮 Cambiar
              </button>
            </div>
          </div>
          <div>
            <label for="swal-granel-precio" style="display: block; font-weight: 600; margin-bottom: 0.35rem; text-align: left; font-size: 0.85rem;">
              💰 Precio Total:
            </label>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input 
                id="swal-granel-precio" 
                type="text" 
                value="${product.price}" 
                step="0.01" 
                min="0"
                class="swal2-input" 
                placeholder="Ejemplo: 25.00"
                inputmode="decimal"
                style="flex: 1;"
              />
              <button 
                id="btn-cambiar-precio-granel" 
                type="button"
                style="
                  background: #667eea;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  padding: 10px 16px;
                  font-weight: 600;
                  cursor: pointer;
                  font-size: 0.9rem;
                  white-space: nowrap;
                  transition: background 0.2s ease;
                "
                onmouseover="this.style.background='#5568d3'"
                onmouseout="this.style.background='#667eea'"
              >
                🧮 Cambiar
              </button>
            </div>
          </div>
        </div>
      </div>
      ` : ''}
    `,
    width: '460px',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '✓ Agregar al carrito',
    cancelButtonText: '✕ Cancelar',
    confirmButtonColor: '#667eea',
    cancelButtonColor: '#64748b',

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
      const btnCambiarCantidadPresentaciones = document.getElementById('btn-cambiar-cantidad-presentaciones');
      const btnCambiarCantidadGranel = document.getElementById('btn-cambiar-cantidad-granel');
      const btnCambiarPrecioGranel = document.getElementById('btn-cambiar-precio-granel');
      let selectedCardIndex = 0;
      let isBaseSelected = false;

      if (!quantityInput || cards.length === 0) return;

      const quantityLabel = document.getElementById('swal-quantity-label') as HTMLElement | null;

      // Pluralizar simple: agrega "s" si no termina ya en "s".
      const pluralize = (name: string) => {
        const n = (name || '').trim();
        if (!n) return 'presentaciones';
        return n.toLowerCase().endsWith('s') ? n : `${n}s`;
      };

      // función visual
      const updateSelection = (index: number) => {
        // Actualizar el label de cantidad con el nombre de la presentación en plural.
        if (quantityLabel) {
          const pres = product.presentations![index];
          quantityLabel.textContent = `📦 ¿Cuántos ${pluralize(pres.name)}?`;
        }
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
            const cantidadActual = wasBaseSelected ? (parseFloat(granelCantidadInput.value.replace(/,/g, '')) || 1) : 1;
            granelCantidadInput.value = cantidadActual.toString();
            const precioCalculado = cantidadActual * precioBase;
            granelPrecioInput.value = precioCalculado.toFixed(2);
            // Enfocar el input de cantidad granel
            setTimeout(() => {
              granelCantidadInput.focus();
              granelCantidadInput.select();
              if (granelCantidadInput.setSelectionRange) {
                granelCantidadInput.setSelectionRange(0, granelCantidadInput.value.length);
              }
            }, 100);
          } else {
            // Ocultar campos granel y mostrar campo de cantidad de presentaciones
            granelFields.style.display = 'none';
            presentationQuantityField.style.display = 'block';
            // Enfocar el input de cantidad de presentaciones
            setTimeout(() => {
              if (quantityInput) {
                quantityInput.focus();
                quantityInput.select();
                if (quantityInput.setSelectionRange) {
                  quantityInput.setSelectionRange(0, quantityInput.value.length);
                }
              }
            }, 100);
          }
        } else {
          // Si NO es producto granel, siempre enfocar el input de cantidad de presentaciones
          setTimeout(() => {
            if (quantityInput) {
              quantityInput.focus();
              quantityInput.select();
              if (quantityInput.setSelectionRange) {
                quantityInput.setSelectionRange(0, quantityInput.value.length);
              }
            }
          }, 100);
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

      // Botón Cambiar Cantidad de Presentaciones - Abre calculadora
      if (btnCambiarCantidadPresentaciones && quantityInput) {
        btnCambiarCantidadPresentaciones.addEventListener('click', () => {
          const currentValue = quantityInput.value.replace(/,/g, '') || '1';
          showTouchCalculator(currentValue, '📦 Cantidad de presentaciones', (newValue) => {
            const numValue = parseInt(newValue, 10);
            if (!isNaN(numValue) && numValue > 0) {
              quantityInput.value = numValue.toString();
              quantityInput.focus();
              quantityInput.select();
            }
          });
        });
      }

      // Cálculo automático para campos granel (similar a GranelModal)
      if (isGranel && granelCantidadInput && granelPrecioInput) {
        // Función para obtener el precio unitario de la presentación actual
        const getCurrentUnitPrice = () => {
          const selectedPres = product.presentations![selectedCardIndex];
          return selectedPres ? selectedPres.unitPrice : product.price;
        };

        // Función para actualizar el precio cuando cambia la cantidad
        const updatePrecioFromCantidad = () => {
          const cantidad = parseFloat(granelCantidadInput!.value.replace(/,/g, '')) || 0;
          if (cantidad > 0) {
            const precioUnitario = getCurrentUnitPrice();
            const nuevoPrecio = cantidad * precioUnitario;
            granelPrecioInput!.value = nuevoPrecio.toFixed(2);
          }
        };

        // Función para actualizar la cantidad cuando cambia el precio
        const updateCantidadFromPrecio = () => {
          const precioTotal = parseFloat(granelPrecioInput!.value.replace(/,/g, '')) || 0;
          if (precioTotal > 0) {
            const precioUnitario = getCurrentUnitPrice();
            if (precioUnitario > 0) {
              const nuevaCantidad = precioTotal / precioUnitario;
              granelCantidadInput!.value = nuevaCantidad.toFixed(6);
            }
          }
        };

        // Cálculo automático cuando cambia la cantidad
        granelCantidadInput.addEventListener('input', updatePrecioFromCantidad);
        granelCantidadInput.addEventListener('blur', updatePrecioFromCantidad);

        // Cálculo automático cuando cambia el precio total
        granelPrecioInput.addEventListener('input', updateCantidadFromPrecio);
        granelPrecioInput.addEventListener('blur', updateCantidadFromPrecio);

        // Botón Cambiar Cantidad Granel - Abre calculadora
        if (btnCambiarCantidadGranel) {
          btnCambiarCantidadGranel.addEventListener('click', () => {
            const currentValue = granelCantidadInput.value.replace(/,/g, '') || '1';
            showTouchCalculator(currentValue, '⚖️ Cantidad (kg, L, etc.)', (newValue) => {
              granelCantidadInput.value = newValue;
              updatePrecioFromCantidad();
              granelCantidadInput.focus();
              granelCantidadInput.select();
            });
          });
        }

        // Botón Cambiar Precio Granel - Abre calculadora
        if (btnCambiarPrecioGranel) {
          btnCambiarPrecioGranel.addEventListener('click', () => {
            const currentValue = granelPrecioInput.value.replace(/,/g, '') || '0';
            showTouchCalculator(currentValue, '💰 Precio Total', (newValue) => {
              granelPrecioInput.value = newValue;
              updateCantidadFromPrecio();
              granelPrecioInput.focus();
              granelPrecioInput.select();
            });
          });
        }

        // Actualizar precio cuando cambia la presentación seleccionada
        const updateGranelPriceOnSelectionChange = () => {
          if (isBaseSelected && granelCantidadInput && granelPrecioInput) {
            const cantidad = parseFloat(granelCantidadInput.value.replace(/,/g, '')) || 1;
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

      const quantity = parseInt(quantityInput.value.replace(/,/g, ''), 10) || 1;
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
