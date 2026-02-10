import React, { useState, useEffect, useRef, useCallback } from "react";
import Header from "../../components/Header";
import "../../styles/pages/sales.css";
import PaymentModal from "./PaymentModal";
import { GranelModal } from "./GranelModal";
import type {
  Product,
  Sale,
  SaleDetail,
  ConfirmPaymentData,
  Client,
} from "../../types";
import { getProductsFilters } from "../../api/products";
import { createSale } from "../../api/sales";
import { createCredit, getClientCreditSummary } from "../../api/credits";
import { createInventoryMovement, getProductInventory } from "../../api/inventory";
import { getActiveShift } from "../../api/cashRegister";
import type { CashRegisterShift } from "../../types";
import Footer from "./Footer";

import Swal from "sweetalert2";
import { ProductComunModal } from "./ProductComunModal";
import { PresentationModal } from "./PresentationModal";
import CategoryProductModal from "./CategoryProductModal";
import QuickAddCalculator from "./QuickAddCalculator";
import ShiftModal from "./ShiftModal";
import CashMovementModal from "./CashMovementModal";
import ClientSelectionModal from "./ClientSelectionModal";
import CreditPaymentModal from "../client/CreditPaymentModal";
import { getClientCredits } from "../../api/credits";
import type { ClientCredit } from "../../types";
import type { ProductPresentation } from "../../types";
import { createPendingSale, type PendingSale } from "../../api/pendingSales";
import PendingSalesModal from "./PendingSalesModal";
import { playAddProductSound } from "../../utils/sound";
import { getContainers, type Container } from "../../api/containers";
import { createCashMovement } from "../../api/cashRegister";
import { createClientContainerDeposit } from "../../api/clientContainerDeposits";

interface SalesPageProps {
  onBack: () => void;
}

interface ItemCart extends Product {
  quantity: number;
  selectedPresentation?: ProductPresentation; // Presentación seleccionada si aplica
  presentationQuantity?: number; // Cantidad de presentaciones (ej: 2 conos)
}

const salesPage: React.FC<SalesPageProps> = ({ onBack }) => {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null); // 👈 search al input

  const [branch, _setBranch] = useState(localStorage.getItem('sucursal') || 'Procesar Venta');
  const [cashRegister, _setCashRegister] = useState(localStorage.getItem('caja') || 'Caja 1');
  const [client, setClient] = useState("Publico en General");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null); // Cliente seleccionado completo
  const [clientPendingCredit, setClientPendingCredit] = useState<number>(0); // Crédito pendiente del cliente
  const [clientPendingCredits, setClientPendingCredits] = useState<ClientCredit[]>([]); // Lista de créditos pendientes
  const [selectedCredit, setSelectedCredit] = useState<ClientCredit | null>(null);
  const [showCreditPaymentModal, setShowCreditPaymentModal] = useState(false);

  const [cart, setCart] = useState<ItemCart[]>(() => {
    // Leer el carrito guardado si existe
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPendingSalesModal, setShowPendingSalesModal] = useState(false);
  const [activeShift, setActiveShift] = useState<CashRegisterShift | null>(null);
  const [productCounter, setProductCounter] = useState(1);
  const [containersDepositInfo, setContainersDepositInfo] = useState<{
    total: number;
    count: number;
    details: Array<{ name: string; quantity: number; amount: number }>;
  } | null>(null);

  // Nuevo Agrega estos estados y funciones dentro de tu componente
  const [activeIndex, setActiveIndex] = useState(-1);
  const cardsPerRow = 5; // Ajusta según tu grilla de productos

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (products.length === 0) return;

      if (e.key === "ArrowDown") {
        setActiveIndex((prev) =>
          Math.min(prev + cardsPerRow, products.length - 1)
        );
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setActiveIndex((prev) => Math.max(prev - cardsPerRow, 0));
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        setActiveIndex((prev) => Math.min(prev + 1, products.length - 1));
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < products.length) {
              handleAdd(products[activeIndex]);
               setActiveIndex(-1);
            }
        e.preventDefault();
      }
    };
 
  // Función para enfocar el input de búsqueda
  const focusSearchInput = useCallback(() => {
    // Usar múltiples intentos para asegurar el focus
    const attemptFocus = (attempts = 0) => {
      if (attempts > 10) return; // Máximo 10 intentos
      
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Verificar que realmente tiene el focus
          if (document.activeElement === inputRef.current) {
            return; // Éxito
          }
          // Si no tiene el focus, intentar de nuevo
          attemptFocus(attempts + 1);
        }
      }, 50 * (attempts + 1));
    };
    
    attemptFocus();
  }, []);

  // Función para agregar producto común directamente
  const handleAddCommonProduct = useCallback(async () => {
    // Crear un producto temporal con código 000000
    const commonProduct: Product = {
      id: 1,
      code: '000000',
      name: 'Producto Común',
      status: 1,
      saleType: 'Pieza',
      price: 0,
      cost: 0,
      icon: '',
      categoryId: '',
    };

    const result = await ProductComunModal(commonProduct);
    setProducts([]);
    
    if (result) {
      const quantity = result.cantidad;
      console.log('Se vendió:', result.nombre, '--Cantidad-', result.cantidad, '-Precio-', result.precio, 'MXN');
      
      setCart((prev) => {
        return [...prev, {
          ...commonProduct,
          name: result.nombre,
          price: result.precio,
          quantity
        }];
      });

      // Reproducir sonido de confirmación
      playAddProductSound();

      Swal.fire({
        icon: 'success',
        title: `${result.nombre} agregado`,
        timer: 2000,
        showConfirmButton: false,
        didClose: () => {
          // Esperar a que SweetAlert2 se cierre completamente
          setTimeout(() => {
            setSearch("");
            // Asegurar que ningún botón tenga el focus
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && (activeElement.tagName === 'BUTTON' || activeElement.classList.contains('btn-common-product'))) {
              activeElement.blur();
            }
            focusSearchInput();
          }, 400);
        }
      });
    } else {
      console.log('Venta cancelada');
      // Esperar a que SweetAlert2 se cierre completamente
      setTimeout(() => {
        setSearch("");
        // Asegurar que ningún botón tenga el focus
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && (activeElement.tagName === 'BUTTON' || activeElement.classList.contains('btn-common-product'))) {
          activeElement.blur();
        }
        focusSearchInput();
      }, 400);
    }
  }, [focusSearchInput]);

  // Verificar turno activo al cargar y cuando cambian branch/cashRegister
  useEffect(() => {
    checkActiveShift();
  }, [branch, cashRegister]);

  const checkActiveShift = async () => {
    try {
      const shift = await getActiveShift(branch, cashRegister);
      setActiveShift(shift);
    } catch (error) {
      console.error("Error al verificar turno activo:", error);
      setActiveShift(null);
    }
  };

  // Función para verificar envases en el carrito
  const checkContainersInCart = async (): Promise<Container[]> => {
    try {
      // Usar forSales=true para obtener solo envases activos (status != 0 o null)
      const allContainers = await getContainers({ forSales: true });
      const containersInCart: Container[] = [];

      for (const item of cart) {
        // Buscar envases por producto
        if (item.id) {
          const productContainers = allContainers.filter(
            (container) => container.productId === item.id && !container.presentationId
          );
          containersInCart.push(...productContainers);
        }

        // Buscar envases por presentación
        if (item.selectedPresentation?.id) {
          const presentationContainers = allContainers.filter(
            (container) => container.presentationId === item.selectedPresentation?.id
          );
          containersInCart.push(...presentationContainers);
        }
      }

      // Eliminar duplicados
      const uniqueContainers = containersInCart.filter(
        (container, index, self) =>
          index === self.findIndex((c) => c.id === container.id)
      );

      return uniqueContainers;
    } catch (error) {
      console.error("Error al verificar envases:", error);
      return [];
    }
  };

  // Función para calcular total de envases
  const calculateContainersTotal = (containers: Container[]): { total: number; count: number; details: Array<{ name: string; quantity: number; amount: number }> } => {
    let total = 0;
    let count = 0;
    const details: Array<{ name: string; quantity: number; amount: number }> = [];

    for (const item of cart) {
      // Calcular cantidad de items (considerando presentaciones)
      // Si tiene presentación, usar presentationQuantity, sino usar quantity
      const itemQuantity = item.selectedPresentation && item.presentationQuantity 
        ? item.presentationQuantity 
        : (item.quantity || 1);
      
      for (const container of containers) {
        // Verificar si el envase corresponde a este item
        const matchesProduct = container.productId === item.id && !container.presentationId;
        const matchesPresentation = container.presentationId === item.selectedPresentation?.id;

        if (matchesProduct || matchesPresentation) {
          const containerAmount = container.importAmount * itemQuantity;
          total += containerAmount;
          count += itemQuantity;
          
          // Buscar si ya existe este envase en los detalles
          const existingDetail = details.find(d => d.name === container.name);
          if (existingDetail) {
            existingDetail.quantity += itemQuantity;
            existingDetail.amount += containerAmount;
          } else {
            details.push({
              name: container.name,
              quantity: itemQuantity,
              amount: containerAmount,
            });
          }
        }
      }
    }

    return { total, count, details };
  };

  // Función para manejar el checkout con validación de envases
  const handleCheckoutWithContainers = useCallback(async () => {
    if (cart.length < 1) return;

    // Validar que haya turno activo antes de permitir venta
    if (!activeShift) {
      Swal.fire({
        icon: "warning",
        title: "Turno no activo",
        text: "Debe abrir un turno de caja antes de realizar ventas",
        confirmButtonText: "Abrir Turno",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
      }).then((result) => {
        if (result.isConfirmed) {
          setShowShiftModal(true);
        }
      });
      return;
    }

    // Verificar si hay envases en el carrito
    const containers = await checkContainersInCart();

    if (containers.length > 0) {
      // Hay envases, preguntar al cliente
      const result = await Swal.fire({
        icon: "question",
        title: "🍺 Envases Retornables",
        html: `
          <p style="font-weight: 600; color: #1f2937; font-size: 1.1rem; margin: 1rem 0;">¿El cliente trajo los envases?</p>
        `,
        showCancelButton: true,
        confirmButtonText: "✅ Sí, trajo envases",
        cancelButtonText: "💰 No, dejar importe",
        confirmButtonColor: "#059669",
        cancelButtonColor: "#667eea",
        reverseButtons: true,
      });

      if (result.isConfirmed) {
        // Trajo envases - flujo normal, limpiar información de depósitos
        setContainersDepositInfo(null);
        setShowModal(true);
      } else {
        // Va a dejar importe
        // Validar que el cliente no sea "Publico en General"
        if (!selectedClient || client === "Publico en General") {
          Swal.fire({
            icon: "warning",
            title: "Cliente requerido",
            text: "Para dejar importe de envases, debe seleccionar un cliente específico (no puede ser 'Publico en General')",
            confirmButtonText: "Entendido",
            confirmButtonColor: "#667eea",
          });
          return;
        }

        // Calcular total de envases
        const containersInfo = calculateContainersTotal(containers);
        
        // Crear un modal interactivo para ajustar cantidades
        const adjustedDetails = containersInfo.details.map(detail => ({
          ...detail,
          adjustedQuantity: detail.quantity, // Inicialmente igual a la cantidad original
          unitPrice: detail.amount / detail.quantity, // Precio unitario
        }));

        // Función para recalcular totales
        const recalculateTotals = (details: typeof adjustedDetails) => {
          const totalCount = details.reduce((sum, d) => sum + d.adjustedQuantity, 0);
          const totalAmount = details.reduce((sum, d) => sum + (d.adjustedQuantity * d.unitPrice), 0);
          return { totalCount, totalAmount };
        };

        // Crear HTML del modal con inputs para ajustar cantidades
        const createModalHTML = (details: typeof adjustedDetails) => {
          const { totalCount, totalAmount } = recalculateTotals(details);
          
          const detailsHtml = details
            .map(
              (detail, idx) =>
                `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb;">
                  <div style="flex: 1;">
                    <span style="font-weight: 600; color: #1f2937;">${detail.name}</span>
                    <div style="margin-top: 0.25rem; font-size: 0.85rem; color: #6b7280;">
                      Precio unitario: $${detail.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 1rem;">
                    <button 
                      type="button" 
                      class="btn-decrease-${idx}" 
                      style="width: 32px; height: 32px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 4px; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; ${detail.adjustedQuantity <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                      ${detail.adjustedQuantity <= 0 ? 'disabled' : ''}
                    >−</button>
                    <input 
                      type="number" 
                      id="quantity-${idx}" 
                      value="${detail.adjustedQuantity}" 
                      min="0" 
                      max="${detail.quantity}"
                      style="width: 60px; text-align: center; border: 1px solid #d1d5db; border-radius: 4px; padding: 0.25rem; font-weight: 600;"
                    />
                    <button 
                      type="button" 
                      class="btn-increase-${idx}" 
                      style="width: 32px; height: 32px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 4px; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; ${detail.adjustedQuantity >= detail.quantity ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                      ${detail.adjustedQuantity >= detail.quantity ? 'disabled' : ''}
                    >+</button>
                    <span style="color: #6b7280; font-size: 0.85rem;">/ ${detail.quantity}</span>
                    <span style="margin-left: 0.5rem; font-weight: 600; color: #059669; min-width: 80px; text-align: right;" id="amount-${idx}">
                      $${(detail.adjustedQuantity * detail.unitPrice).toFixed(2)}
                    </span>
                  </div>
                </div>`
            )
            .join("");

          return `
            <div style="text-align: left; margin-top: 1rem;">
              <p style="font-weight: 600; margin-bottom: 0.75rem; font-size: 1rem;">Cliente: <strong>${client}</strong></p>
              <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem;">
                Ajuste las cantidades si el cliente trajo algunos envases:
              </p>
              <div style="margin: 1rem 0; max-height: 300px; overflow-y: auto;">
                ${detailsHtml}
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; margin-top: 0.5rem; border-top: 2px solid #1f2937; font-size: 1.1rem;">
                <span><strong>Total de envases:</strong> <span id="total-count">${totalCount}</span></span>
                <span><strong>Total a cobrar:</strong> <span style="color: #059669;" id="total-amount">$${totalAmount.toFixed(2)}</span></span>
              </div>
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #6b7280; font-style: italic;">
                Este importe se agregará al total de la venta y se registrará como depósito de envases.
              </p>
            </div>
          `;
        };

        // Mostrar modal interactivo
        const { value: confirmed } = await Swal.fire({
          icon: "info",
          title: "📋 Resumen de Envases",
          html: createModalHTML(adjustedDetails),
          showCancelButton: true,
          confirmButtonText: "Continuar con el cobro",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#667eea",
          cancelButtonColor: "#6b7280",
          didOpen: () => {
            // Función para actualizar la UI
            const updateUI = () => {
              const { totalCount, totalAmount } = recalculateTotals(adjustedDetails);
              const totalCountEl = document.getElementById('total-count');
              const totalAmountEl = document.getElementById('total-amount');
              if (totalCountEl) totalCountEl.textContent = totalCount.toString();
              if (totalAmountEl) totalAmountEl.textContent = `$${totalAmount.toFixed(2)}`;
            };

            // Agregar event listeners para los botones de incremento/decremento
            adjustedDetails.forEach((detail, idx) => {
              const decreaseBtn = document.querySelector(`.btn-decrease-${idx}`) as HTMLButtonElement;
              const increaseBtn = document.querySelector(`.btn-increase-${idx}`) as HTMLButtonElement;
              const quantityInput = document.getElementById(`quantity-${idx}`) as HTMLInputElement;
              const amountSpan = document.getElementById(`amount-${idx}`) as HTMLElement;

              const updateButtons = () => {
                if (decreaseBtn) {
                  decreaseBtn.disabled = detail.adjustedQuantity <= 0;
                  decreaseBtn.style.opacity = detail.adjustedQuantity <= 0 ? '0.5' : '1';
                  decreaseBtn.style.cursor = detail.adjustedQuantity <= 0 ? 'not-allowed' : 'pointer';
                }
                if (increaseBtn) {
                  increaseBtn.disabled = detail.adjustedQuantity >= detail.quantity;
                  increaseBtn.style.opacity = detail.adjustedQuantity >= detail.quantity ? '0.5' : '1';
                  increaseBtn.style.cursor = detail.adjustedQuantity >= detail.quantity ? 'not-allowed' : 'pointer';
                }
              };

              if (decreaseBtn && quantityInput && amountSpan) {
                decreaseBtn.addEventListener('click', () => {
                  if (detail.adjustedQuantity > 0) {
                    detail.adjustedQuantity--;
                    quantityInput.value = detail.adjustedQuantity.toString();
                    amountSpan.textContent = `$${(detail.adjustedQuantity * detail.unitPrice).toFixed(2)}`;
                    updateButtons();
                    updateUI();
                  }
                });

                if (increaseBtn) {
                  increaseBtn.addEventListener('click', () => {
                    if (detail.adjustedQuantity < detail.quantity) {
                      detail.adjustedQuantity++;
                      quantityInput.value = detail.adjustedQuantity.toString();
                      amountSpan.textContent = `$${(detail.adjustedQuantity * detail.unitPrice).toFixed(2)}`;
                      updateButtons();
                      updateUI();
                    }
                  });
                }

                quantityInput.addEventListener('input', (e) => {
                  const newValue = Math.max(0, Math.min(detail.quantity, parseInt((e.target as HTMLInputElement).value) || 0));
                  detail.adjustedQuantity = newValue;
                  quantityInput.value = newValue.toString();
                  amountSpan.textContent = `$${(detail.adjustedQuantity * detail.unitPrice).toFixed(2)}`;
                  updateButtons();
                  updateUI();
                });

                // Inicializar estado de botones
                updateButtons();
              }
            });
          },
        });

        if (!confirmed) {
          // Usuario canceló, limpiar información de depósitos
          setContainersDepositInfo(null);
          return;
        }

        // Recalcular con las cantidades ajustadas
        const finalTotals = recalculateTotals(adjustedDetails);
        const finalDetails = adjustedDetails
          .filter(d => d.adjustedQuantity > 0) // Solo incluir envases con cantidad > 0
          .map(d => ({
            name: d.name,
            quantity: d.adjustedQuantity,
            amount: d.adjustedQuantity * d.unitPrice,
          }));

        // Guardar información de depósitos ajustada
        const adjustedContainersInfo = {
          total: finalTotals.totalAmount,
          count: finalTotals.totalCount,
          details: finalDetails,
        };

        setContainersDepositInfo(adjustedContainersInfo);

        // Continuar con el flujo normal - el importe se agregará al total en el modal
        // Esperar un momento para que SweetAlert2 se cierre completamente antes de abrir el modal
        setTimeout(() => {
          setShowModal(true);
        }, 100); // Pequeño delay para permitir que SweetAlert2 se cierre completamente
      }
    } else {
      // No hay envases - flujo normal
      setShowModal(true);
    }
  }, [cart, activeShift, selectedClient, client]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        console.log('cart', cart)
        if (cart.length >= 1) {
          handleCheckoutWithContainers();
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        handleAddCommonProduct();
      } else if (e.key === "F4") {
        e.preventDefault();
        setShowShiftModal(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, handleAddCommonProduct, activeShift, handleCheckoutWithContainers]);

  // Cada vez que cambie el carrito, lo guardamos
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
    setSearch("");
    inputRef.current?.focus();
    
    // Si el carrito está vacío, reiniciar el contador de productos no registrados
    if (cart.length === 0) {
      setProductCounter(1);
    }
  }, [cart]);

  useEffect(() => {
    if(search.length > 2) {
       const handler = setTimeout(() => {
        fetchProducts();
        setActiveIndex(0);
      }, 300); // 🕒 Espera 300 ms después del último cambio

      // Limpiar el timeout si `search` cambia antes de que pasen los 300 ms
      return () => clearTimeout(handler);
    } else if (search.length===0) {
       setProducts([])
    }
  }, [search]);

  const fetchProducts = async () => {
    try {
      // Pasar forSales=true para excluir productos inactivos en ventas
      const data = await getProductsFilters(search, true);
      if(data.length === 1) {
        const getProduct = data[0];
        if (getProduct.code === search) {
           handleAdd(getProduct);
           setProducts([]);
         } else {
           setProducts(data);
         }
      } else {
           setProducts(data);
         }
    } catch (err) {
      console.error(err);
    } finally {
      console.log("Finally");
    }
  };

  const handleAdd = async(product: Product) => {
    let quantity = 1;
    let addCart = true;
    let selectedPresentation: ProductPresentation | undefined;
    let presentationQuantity = 1;

    // 🏭 PRIMERO: Validar stock si el producto rastrea inventario
    if (product.trackInventory && product.id !== 1) {
      try {
        const inventory = await getProductInventory(product.id);
        if (inventory) {
          // Calcular cantidad que se va a agregar
          
          // Si tiene presentaciones, calcular después de seleccionar
          // Por ahora validamos después de seleccionar presentación
        }
      } catch (error) {
        console.error("Error verificando inventario:", error);
        // Continuar sin validar si hay error
      }
    }

    // 👇 PRIMERO: Verificar si el producto tiene presentaciones
    let granelDataFromPresentation: { cantidad: number; precio: number } | undefined;
    if (product.presentations && product.presentations.length > 0) {
      const presentationResult = await PresentationModal(product);
      if (presentationResult) {
        selectedPresentation = presentationResult.presentation;
        presentationQuantity = presentationResult.quantity;
        
        // Si tiene datos granel, usarlos
        if (presentationResult.granelData) {
          granelDataFromPresentation = presentationResult.granelData;
          quantity = granelDataFromPresentation.cantidad;
        } else {
          quantity = selectedPresentation.quantity * presentationQuantity; // Total de unidades
        }
        
        // 🏭 Validar stock después de seleccionar presentación
        if (product.trackInventory && product.id !== 1) {
          try {
            const inventory = await getProductInventory(product.id);
            if (inventory && inventory.currentStock < quantity) {
              Swal.fire({
                icon: "warning",
                title: "Stock insuficiente",
                html: `
                  <p>Stock disponible: <strong>${inventory.currentStock}</strong></p>
                  <p>Stock requerido: <strong>${quantity}</strong></p>
                  <p>Faltan: <strong>${quantity - inventory.currentStock}</strong> unidades</p>
                `,
                confirmButtonText: "Entendido",
              });
              setSearch("");
              inputRef.current?.focus();
              return;
            }
          } catch (error) {
            console.error("Error validando stock:", error);
          }
        }
      } else {
        addCart = false;
        console.log('Selección de presentación cancelada');
        setSearch("");
        inputRef.current?.focus();
        return;
      }
    } else {
      // 🏭 Validar stock para productos sin presentaciones
      if (product.trackInventory && product.id !== 1) {
        try {
          const inventory = await getProductInventory(product.id);
          if (inventory && inventory.currentStock < quantity) {
            Swal.fire({
              icon: "warning",
              title: "Stock insuficiente",
              html: `
                <p>Stock disponible: <strong>${inventory.currentStock}</strong></p>
                <p>Stock requerido: <strong>${quantity}</strong></p>
                <p>Faltan: <strong>${quantity - inventory.currentStock}</strong> unidades</p>
              `,
              confirmButtonText: "Entendido",
            });
            setSearch("");
            inputRef.current?.focus();
            return;
          }
        } catch (error) {
          console.error("Error validando stock:", error);
        }
      }
    }

    // Si no tiene presentaciones o ya se seleccionó una, continuar con el flujo normal
    // Solo abrir GranelModal si NO se ingresaron datos granel en el PresentationModal
    if (addCart && product.saleType === 'Granel' && !product.presentations?.length) {
         const result = await GranelModal(product);
          if (result) {
            quantity = result.cantidad;
             console.log('Se vendió:', result.cantidad, 'kg a', result.precio, 'MXN');
            // Aquí puedes actualizar tu carrito o llamar una API
          } else {
            addCart = false;
            console.log('Venta cancelada');
            setSearch("");
            inputRef.current?.focus();
          }
    }
    //Code Product Comun
    if (addCart && product.code === '000000') {
      addCart = false;
        const result = await ProductComunModal(product);
        setProducts([]);
        if (result) {
            quantity = result.cantidad;
            console.log( 'Se vendio:',result.nombre, '--Cantidad-', result.cantidad, '-Precio-', result.precio, 'MXN');
            //product.name = result.nombre;
            //product.price = result.precio;  
            setCart((prev) => {
              return [...prev, {...product, name:result.nombre, price:result.precio, quantity}];
            });
            
            // Reproducir sonido de confirmación
            playAddProductSound();
            
            // Aquí puedes actualizar tu carrito o llamar una API
        } else {
            console.log('Venta cancelada');
            setSearch("");
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
        }
    }
    if (addCart) {
      // Calcular el precio según la presentación seleccionada o datos granel
      let finalPrice: number;
      let finalQuantity: number = quantity;
      
      if (granelDataFromPresentation) {
        console.log('granelDataFromPresentation', granelDataFromPresentation);
        // Para productos granel con presentación base, guardar el precio total
        // y la cantidad granel (kg, L, etc.)
        // El precio total se guarda directamente, no se divide
        finalPrice = granelDataFromPresentation.precio; // Precio total ingresado
        finalQuantity = granelDataFromPresentation.cantidad; // Cantidad granel (kg, L, etc.)
      } else if (selectedPresentation) {
        finalPrice = selectedPresentation.unitPrice;
        finalQuantity = selectedPresentation.quantity * presentationQuantity;
      } else {
        finalPrice = product.price;
      }

      // Crear el item del carrito
      const cartItem: ItemCart = {
        ...product,
        quantity: finalQuantity,
        price: finalPrice, // Para granel con presentación base, este es el precio total
        selectedPresentation,
        presentationQuantity: granelDataFromPresentation ? finalQuantity : presentationQuantity,
      };

      setCart((prev) => {
        // Verificar si ya existe el mismo producto con la misma presentación
        const existing = prev.find((item) => {
          if (item.id !== product.id) return false;
          
          // Si ambos tienen presentación, comparar por ID de presentación
          if (selectedPresentation && item.selectedPresentation) {
            return item.selectedPresentation.id === selectedPresentation.id;
          }
          
          // Si ninguno tiene presentación, es el mismo item
          if (!selectedPresentation && !item.selectedPresentation) {
            return true;
          }
          
          return false;
        });

        if (existing) {
          return prev.map((item) => {
            const isSameItem = item.id === product.id && 
              ((selectedPresentation && item.selectedPresentation && 
                item.selectedPresentation.id === selectedPresentation.id) ||
               (!selectedPresentation && !item.selectedPresentation));
            
            if (isSameItem) {
              console.log('isSameItem', isSameItem);
              // Para productos granel con presentación base, sumar cantidades y precios totales
              if (granelDataFromPresentation) {
                const totalCantidad = item.quantity + finalQuantity;
                const totalPrecio = item.price + finalPrice;
                return {
                  ...item,
                  quantity: totalCantidad,
                  price: totalPrecio, // Suma de precios totales
                };
              }
              
              return { 
                ...item, 
                quantity: item.quantity + finalQuantity,
                presentationQuantity: item.presentationQuantity 
                  ? (item.presentationQuantity + presentationQuantity)
                  : presentationQuantity,
              };
            }
            return item;
          });
        }
        return [...prev, cartItem];
      });
      
      // Reproducir sonido de confirmación
      playAddProductSound();
      
      const presentationName = selectedPresentation 
        ? ` (${selectedPresentation.name})` 
        : '';
      
      Swal.fire({
            icon: 'success',
            title: `${product.name}${presentationName} agregado`,
            timer: 2000,
            showConfirmButton: false,
          });
      setProducts([])
   } 
  };

  // Función para agregar producto desde la calculadora
  const handleCalculatorAdd = (product: Product, quantity: number, productName: string) => {
    // Agregar al carrito
    setCart((prev) => {
      return [...prev, {
        ...product,
        name: productName,
        quantity,
      }];
    });

    // Reproducir sonido de confirmación
    playAddProductSound();

    // Incrementar contador para siguiente producto
    setProductCounter((prev) => prev + 1);
  };

  const handleRemove = (id: number, name: string, presentationId?: number) => {
    setCart((prev) => prev.filter((item) => {
      // Si se especifica presentationId, comparar también por presentación
      if (presentationId !== undefined) {
        return !(item.id === id && 
                 item.name === name && 
                 item.selectedPresentation?.id === presentationId);
      }
      // Si no hay presentación, comparar solo por id y name
      return !(item.id === id && item.name === name && !item.selectedPresentation);
    }));
  };

  // Función para actualizar cantidad de productos por pieza
  const handleUpdateQuantity = (
    id: number,
    presentationId: number | undefined,
    change: number,
    itemName?: string,
    itemPrice?: number
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        // Para productos no registrados (id: 1, code: '000000'), usar name y price para identificarlos únicamente
        const isUnregisteredProduct = item.id === 1 && item.code === '000000';
        
        let isSameItem: boolean;
        if (isUnregisteredProduct && itemName !== undefined && itemPrice !== undefined) {
          // Para productos no registrados, verificar id, name y price
          isSameItem =
          item.id === id &&
            item.name === itemName &&
            item.price === itemPrice &&
          ((presentationId !== undefined &&
            item.selectedPresentation?.id === presentationId) ||
            (presentationId === undefined && !item.selectedPresentation));
        } else {
          // Para productos normales, usar la lógica original
          isSameItem =
            item.id === id &&
            ((presentationId !== undefined &&
              item.selectedPresentation?.id === presentationId) ||
              (presentationId === undefined && !item.selectedPresentation));
        }

        if (isSameItem) {
          // Solo permitir actualizar cantidad para productos "Pieza" sin presentaciones
          // o productos con presentaciones que no sean granel
          const isPieza = item.saleType?.toLowerCase() === 'pieza';
          const hasNoPresentation = !item.selectedPresentation;
          
          if (isPieza && hasNoPresentation) {
            const newQuantity = Math.max(1, item.quantity + change);
            return {
              ...item,
              quantity: newQuantity,
            };
          }
        }
        return item;
      })
    );
  };

  // Calcular total considerando presentaciones y productos granel
  const total = cart.reduce((acc, item) => {
    // Si tiene presentación seleccionada, calcular: cantidad de presentaciones * precio unitario * unidades por presentación
    if (item.selectedPresentation && item.presentationQuantity) {
      const totalUnits = item.selectedPresentation.quantity * item.presentationQuantity;
      return acc + (item.selectedPresentation.unitPrice * totalUnits);
    }
    // Para productos granel con presentación base, el price ya es el precio total
    if (item.saleType === 'Granel' && item.selectedPresentation) {
      // El precio ya es el total ingresado por el usuario
      return acc + item.price;
    }
    // Si no tiene presentación, usar el cálculo normal
    return acc + (item.price * item.quantity);
  }, 0);

  const confirmPayment = async (data: ConfirmPaymentData) => {
    console.log("💰 Confirmando pago, datos recibidos:", {
      paymentType: data.paymentType,
      amountReceived: data.amountReceived,
      containersDepositInfo: data.containersDepositInfo,
      selectedClient,
      activeShift: activeShift?.id,
    });

    // Validar que haya turno activo
    if (!activeShift) {
      Swal.fire({
        icon: "warning",
        title: "Turno no activo",
        text: "Debe abrir un turno de caja antes de realizar ventas",
        confirmButtonText: "Abrir Turno",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
      }).then((result) => {
        if (result.isConfirmed) {
          setShowShiftModal(true);
        }
      });
      return;
    }

    setShowModal(false);
    
    // Mostrar loading mientras se procesa
    Swal.fire({
      title: "Procesando venta...",
      text: "Por favor espera",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      // 👉 tipo para crear ventas (sin id, ni campos anidados)
      type SaleDetailInput = Omit<SaleDetail, "id" | "saleId" | "product">;
      type SaleInput = Omit<Sale, "id" | "details"> & {
        details: SaleDetailInput[];
      };

      const details: SaleDetailInput[] = cart.map((item) => {
        // Calcular subtotal según presentación o producto granel
        let subtotal: number;
        if (item.selectedPresentation && item.presentationQuantity) {
          // Presentación normal
          subtotal = item.selectedPresentation.unitPrice * item.selectedPresentation.quantity * item.presentationQuantity;
        } else if (item.saleType === 'Granel' && item.selectedPresentation) {
          // Producto granel con presentación base - el price ya es el total
          subtotal = item.price;
        } else {
          // Sin presentación
          subtotal = item.price * item.quantity;
        }
        
        // Nombre del producto con presentación si aplica
        let productName: string;
        if (item.saleType === 'Granel' && item.selectedPresentation) {
          // Para granel con presentación base, mostrar cantidad granel
          productName = `${item.name} (${item.quantity} ${item.selectedPresentation.name || 'unidades'})`;
        } else if (item.selectedPresentation && item.presentationQuantity) {
          productName = `${item.name} (${item.presentationQuantity}x ${item.selectedPresentation.name})`;
        } else {
          productName = item.name;
        }
        
        // Precio unitario usado
        let unitPrice: number;
        if (item.saleType === 'Granel' && item.selectedPresentation) {
          // Para granel, calcular precio unitario (precio total / cantidad)
          unitPrice = item.quantity > 0 ? item.price / item.quantity : item.price;
        } else if (item.selectedPresentation) {
          unitPrice = item.selectedPresentation.unitPrice;
        } else {
          unitPrice = item.price;
        }
        
        // Cantidad total de unidades
        const totalQuantity = item.selectedPresentation && item.presentationQuantity
          ? item.selectedPresentation.quantity * item.presentationQuantity
          : item.quantity;

        return {
          quantity: totalQuantity,
          price: unitPrice,
          productName,
          subTotal: subtotal,
          productId: item.id,
        };
      });
      
      // Determinar el método de pago para guardar
      let paymentMethod = data.paymentType;
      if (data.paymentType === "mixto") {
        paymentMethod = `Mixto (Efectivo: $${data.cashAmount?.toFixed(2) || 0}, Tarjeta: $${data.cardAmount?.toFixed(2) || 0})`;
      } else if (data.paymentType === "regalo") {
        paymentMethod = "Regalo";
      }

      // IMPORTANTE: El total de la venta es solo el subtotal de productos
      // El depósito de envases NO se suma al total de la venta porque:
      // 1. Se registra como movimiento de efectivo (ENTRADA) separado
      // 2. Esto permite que el cierre de turno cuadre correctamente
      // 3. El cliente paga el total (productos + depósito), pero la venta solo registra productos
      const sale: Omit<SaleInput, "createdAt"> = {
        folio: "",
        total: total, // Solo subtotal de productos (sin depósito de envases)
        status: "Pagado",
        paymentMethod: paymentMethod,
        clientName: client,
        details,
        branch,
        cashRegister
      };
      
      // 1️⃣ Crear la venta
      const responseCreateSale = await createSale(sale);
      console.log("responseCreateSale", responseCreateSale);
      
      // 1.5️⃣ Si hay depósito de envases, crear movimiento de efectivo y guardar depósito
      console.log("🔍 Verificando condiciones para crear movimiento de envases:", {
        hasContainersDepositInfo: !!data.containersDepositInfo,
        containersTotal: data.containersDepositInfo?.total,
        hasSelectedClient: !!selectedClient,
        hasActiveShift: !!activeShift,
        activeShiftId: activeShift?.id,
        client,
      });

      if (data.containersDepositInfo && data.containersDepositInfo.total > 0 && selectedClient && activeShift) {
        try {
          console.log("🍺 Creando movimiento de efectivo por depósito de envases:", {
            containersDepositInfo: data.containersDepositInfo,
            selectedClient: selectedClient.id,
            activeShift: activeShift.id,
            client,
          });

          // Preparar detalles de envases para las notas
          const containersDetails = data.containersDepositInfo.details
            .map(detail => `${detail.name} (${detail.quantity}) - $${detail.amount.toFixed(2)}`)
            .join(" | ");
          
          // Crear movimiento de efectivo (ENTRADA)
          const cashMovementInput = {
            shiftId: activeShift.id,
            type: "ENTRADA" as const,
            amount: data.containersDepositInfo.total,
            reason: `Importe de envase - ${client}`,
            notes: containersDetails,
          };

          console.log("📝 Datos del movimiento a crear:", cashMovementInput);

          const cashMovement = await createCashMovement(cashMovementInput);
          
          console.log("✅ Movimiento de efectivo creado exitosamente:", cashMovement);

          // Guardar depósitos de envases (uno por cada tipo de envase)
          for (const detail of data.containersDepositInfo.details) {
            // Calcular precio unitario
            const unitPrice = detail.amount / detail.quantity;
            
            await createClientContainerDeposit({
              clientId: selectedClient.id,
              saleId: responseCreateSale.id,
              containerName: detail.name,
              quantity: detail.quantity,
              importAmount: detail.amount,
              unitPrice: unitPrice,
              shiftId: activeShift.id,
              cashMovementId: cashMovement.id,
              notes: `Depósito generado automáticamente por venta #${responseCreateSale.id}`,
            });
          }
        } catch (error: any) {
          console.error("❌ Error al crear movimiento de efectivo por depósito de envases:", error);
          console.error("❌ Detalles del error:", {
            message: error?.message,
            response: error?.response?.data,
            status: error?.response?.status,
            stack: error?.stack,
          });
          // No bloquear la venta si falla, pero mostrar advertencia
          Swal.fire({
            icon: "warning",
            title: "Venta completada",
            html: `
              <p>La venta se registró correctamente, pero hubo un error al registrar el depósito de envases.</p>
              <p style="margin-top: 10px; font-size: 0.9rem; color: #dc2626;">
                Error: ${error?.response?.data?.error || error?.message || "Error desconocido"}
              </p>
              <p style="margin-top: 10px;">Por favor regístrelo manualmente.</p>
            `,
            confirmButtonText: "Entendido",
          });
        }
      } else {
        console.warn("⚠️ No se creó movimiento de envases porque faltan condiciones:", {
          hasContainersDepositInfo: !!data.containersDepositInfo,
          containersTotal: data.containersDepositInfo?.total,
          containersCount: data.containersDepositInfo?.count,
          hasSelectedClient: !!selectedClient,
          selectedClientId: selectedClient?.id,
          hasActiveShift: !!activeShift,
          activeShiftId: activeShift?.id,
          activeShiftStatus: activeShift?.status,
        });
      }
      
      // 2️⃣ Si hay crédito, registrarlo
      if (data.creditAmount && data.creditAmount > 0 && selectedClient) {
        try {
          await createCredit({
            clientId: selectedClient.id,
            saleId: responseCreateSale.id,
            amount: data.creditAmount,
            notes: `Crédito generado automáticamente por faltante en venta #${responseCreateSale.id}`,
          });
        } catch (creditError) {
          console.error("Error al crear crédito:", creditError);
          // No bloquear la venta si falla el crédito, pero mostrar advertencia
          Swal.fire({
            icon: "warning",
            title: "Venta completada",
            text: "La venta se registró correctamente, pero hubo un error al registrar el crédito. Por favor regístrelo manualmente.",
            confirmButtonText: "Entendido",
          });
        }
      }
      
      // 3️⃣ Descontar inventario después de crear la venta exitosamente
      await updateInventoryFromSale(cart, branch);
      
      // 4️⃣ Limpiar carrito, reiniciar contador, limpiar depósitos y actualizar turno activo
      setCart([]);
      setProductCounter(1); // Reiniciar contador de productos no registrados
      setContainersDepositInfo(null); // Limpiar información de depósitos
      
      // Actualizar información del turno activo
      await checkActiveShift();
      
      // Mensaje de éxito con desglose si es pago mixto o con crédito
      let successHtml = `
        <p>La venta se registró correctamente.</p>
        <p style="margin-top: 10px; color: #059669; font-weight: 600;">
          Total: ${total.toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
          })}
        </p>
      `;

      if (data.paymentType === "mixto" && data.cashAmount && data.cardAmount) {
        successHtml += `
          <div style="margin-top: 15px; padding: 12px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 0.9rem;">Desglose de pago:</p>
            <p style="margin: 4px 0; font-size: 0.9rem;">
              💵 Efectivo: <strong style="color: #059669;">${data.cashAmount.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}</strong>
            </p>
            <p style="margin: 4px 0; font-size: 0.9rem;">
              💳 Tarjeta: <strong style="color: #3b82f6;">${data.cardAmount.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}</strong>
            </p>
          </div>
        `;
      }

      if (data.creditAmount && data.creditAmount > 0) {
        successHtml += `
          <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 0.9rem; color: #92400e;">💳 Crédito registrado:</p>
            <p style="margin: 4px 0; font-size: 0.9rem; color: #92400e;">
              Monto a crédito: <strong style="color: #d97706;">${data.creditAmount.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}</strong>
            </p>
            <p style="margin: 4px 0; font-size: 0.85rem; color: #78350f;">
              El crédito ha sido registrado y quedará pendiente de pago.
            </p>
          </div>
        `;
      }

      successHtml += `
        <p style="margin-top: 10px; font-size: 0.9rem; color: #6b7280;">
          El inventario ha sido actualizado automáticamente.
        </p>
      `;

      Swal.fire({
        icon: "success",
        title: "✅ Venta completada",
        html: successHtml,
        timer: 4000,
        showConfirmButton: false,
        didClose: () => {
          // Enfocar el input de búsqueda después de que se cierre el mensaje
          setTimeout(() => {
            if (inputRef.current) {
              // Quitar el foco de cualquier elemento que lo tenga
              if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement !== inputRef.current) {
                document.activeElement.blur();
              }
              inputRef.current.focus();
              // Verificar y re-enfocar si es necesario
              setTimeout(() => {
                if (inputRef.current && document.activeElement !== inputRef.current) {
                  if (document.activeElement && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  inputRef.current.focus();
                }
              }, 50);
            }
          }, 100);
        },
      });
      setClient("Publico en General");
      setSelectedClient(null);
    } catch (error) {
      console.error("Error ConfirmPayment", error);
      Swal.fire({
        icon: "error",
        title: "Error al procesar la venta",
        text: "No se pudo completar la venta. Por favor intenta de nuevo.",
        confirmButtonText: "Entendido",
      });
    }
  };

  // Función para descontar inventario de una venta
  const updateInventoryFromSale = async (cartItems: ItemCart[], branchName: string) => {
    const errors: Array<{ product: string; quantity: number }> = [];

    for (const item of cartItems) {
      // Solo descontar si el producto rastrea inventario y no es producto común
      const hasInventory = item.inventory?.trackInventory || item.trackInventory;
      
      if (hasInventory && item.id !== 1) { // Excluir producto común (id: 1)
        try {
          // Calcular cantidad total a descontar
          const totalQuantity = item.selectedPresentation && item.presentationQuantity
            ? item.selectedPresentation.quantity * item.presentationQuantity
            : item.quantity;

          // Crear movimiento de inventario (SALIDA)
          await createInventoryMovement({
            productId: item.id,
            type: "SALIDA",
            quantity: totalQuantity,
            reason: "Venta",
            reference: `Venta - ${branchName}`,
            notes: `Venta realizada en ${branchName}. Producto: ${item.name}${item.selectedPresentation ? ` (${item.presentationQuantity}x ${item.selectedPresentation.name})` : ''}`,
            branch: branchName,
          });
        } catch (error) {
          console.error(`Error actualizando inventario para producto ${item.id} (${item.name}):`, error);
          const totalQuantity = item.selectedPresentation && item.presentationQuantity
            ? item.selectedPresentation.quantity * item.presentationQuantity
            : item.quantity;
          errors.push({ product: item.name, quantity: totalQuantity });
          // Continuar con los demás productos aunque uno falle
        }
      }
    }

    // Mostrar advertencia si hubo errores (pero no bloquear la venta)
    if (errors.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "Advertencia de inventario",
        html: `
          <p>La venta se completó, pero hubo problemas al actualizar el inventario de algunos productos:</p>
          <ul style="text-align: left; margin-top: 10px; padding-left: 20px;">
            ${errors.map(e => `<li><strong>${e.product}</strong>: ${e.quantity} unidades</li>`).join('')}
          </ul>
          <p style="margin-top: 10px; font-size: 0.9rem; color: #6b7280;">Por favor verifica el inventario manualmente.</p>
        `,
        confirmButtonText: "Entendido",
        confirmButtonColor: "#3b82f6",
      });
    }
  };

  const saleToPending = async () => {
    if (cart.length === 0) {
      Swal.fire("No hay Productos seleccionados");
      return;
    }

    // Calcular el total del carrito
    const total = cart.reduce((sum, item) => {
      const itemPrice = item.selectedPresentation?.unitPrice || item.price;
      const itemQuantity = item.presentationQuantity 
        ? (item.selectedPresentation?.quantity || 1) * item.presentationQuantity
        : item.quantity;
      return sum + (itemPrice * itemQuantity);
    }, 0);

    // Pedir confirmación y nombre del cliente
    const { value: confirm } = await Swal.fire({
      title: "Venta pendiente",
      text: "¿Deseas guardar la venta como pendiente?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#4CAF50",
      cancelButtonColor: "#d33",
      allowOutsideClick: false,
      allowEscapeKey: true,
      didClose: () => {
        // Cuando se cierra el modal (por cancelar o ESC), enfocar el input
        // Usar múltiples intentos para asegurar que el foco se mantenga y no vuelva al botón
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (inputRef.current) {
              // Quitar el foco de cualquier elemento que lo tenga (como el botón)
              if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement !== inputRef.current) {
                document.activeElement.blur();
              }
              inputRef.current.focus();
              // Verificar y re-enfocar múltiples veces para asegurar que se mantenga
              setTimeout(() => {
                if (inputRef.current && document.activeElement !== inputRef.current) {
                  if (document.activeElement && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  inputRef.current.focus();
                }
              }, 50);
              // Tercer intento después de un delay adicional
              setTimeout(() => {
                if (inputRef.current && document.activeElement !== inputRef.current) {
                  if (document.activeElement && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  inputRef.current.focus();
                }
              }, 150);
            }
          }, 150);
        });
      },
    });

    if (!confirm) {
      // El enfoque se maneja en didClose del Swal.fire
      return;
    }

    const { value: clientName } = await Swal.fire({
      title: "Guardar venta pendiente",
      html: `
        <p style="margin-bottom: 15px;">Ingresa el nombre del cliente para recordar esta venta:</p>
        <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Total: ${total.toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
        })}</p>
      `,
      input: "text",
      inputLabel: "Nombre del cliente",
      inputPlaceholder: "Ej: Juan Pérez, Mostrador 1, etc.",
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      allowOutsideClick: false,
      allowEscapeKey: true,
      inputValidator: (value) => {
        if (!value || value.trim() === "") {
          return "Debes ingresar un nombre";
        }
        return null;
      },
      didClose: () => {
        // Cuando se cierra el modal (por cancelar o ESC), enfocar el input
        // Usar múltiples intentos para asegurar que el foco se mantenga y no vuelva al botón
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (inputRef.current) {
              // Quitar el foco de cualquier elemento que lo tenga (como el botón)
              if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement !== inputRef.current) {
                document.activeElement.blur();
              }
              inputRef.current.focus();
              // Verificar y re-enfocar múltiples veces para asegurar que se mantenga
              setTimeout(() => {
                if (inputRef.current && document.activeElement !== inputRef.current) {
                  if (document.activeElement && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  inputRef.current.focus();
                }
              }, 50);
              // Tercer intento después de un delay adicional
              setTimeout(() => {
                if (inputRef.current && document.activeElement !== inputRef.current) {
                  if (document.activeElement && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  inputRef.current.focus();
                }
              }, 150);
            }
          }, 150);
        });
      },
    });

    if (!clientName) {
      // El enfoque se maneja en didClose del Swal.fire
      return;
    }

    try {
      // Convertir el carrito a formato de detalles de venta pendiente
      const details = cart.map((item) => {
        const itemPrice = item.selectedPresentation?.unitPrice || item.price;
        const itemQuantity = item.presentationQuantity 
          ? (item.selectedPresentation?.quantity || 1) * item.presentationQuantity
          : item.quantity;
        const subTotal = itemPrice * itemQuantity;

        return {
          productId: item.id,
          quantity: itemQuantity,
          price: itemPrice,
          subTotal: subTotal,
          productName: item.name,
          presentationId: item.selectedPresentation?.id,
          presentationName: item.selectedPresentation?.name,
          saleType: item.saleType || "Pieza",
          basePrice: item.selectedPresentation?.unitPrice || item.price,
        };
      });

      // Guardar en la base de datos
      const pendingSale = await createPendingSale({
        clientName: clientName.trim(),
        total,
        branch: branch || "Sucursal Default",
        cashRegister: cashRegister || "Caja 1",
        details,
      });

      // Limpiar el carrito
      setCart([]);
      setProductCounter(1);
      localStorage.removeItem("cart");

      // Mostrar mensaje de éxito que desaparece automáticamente
      await Swal.fire({
        icon: "success",
        title: "Venta guardada",
        html: `
          <p>La venta se guardó correctamente</p>
          <p style="margin-top: 10px; font-weight: bold; color: #059669;">
            Código: ${pendingSale.code}
          </p>
          <p style="margin-top: 5px;">Cliente: ${pendingSale.clientName}</p>
        `,
        timer: 2000,
        showConfirmButton: false,
      });

      // Enfocar el input de búsqueda después de que desaparezca el mensaje (timer: 2000ms + delay adicional)
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (inputRef.current) {
            // Quitar el foco de cualquier elemento que lo tenga
            if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement !== inputRef.current) {
              document.activeElement.blur();
            }
            inputRef.current.focus();
            // Verificar y re-enfocar si es necesario
            setTimeout(() => {
              if (inputRef.current && document.activeElement !== inputRef.current) {
                if (document.activeElement && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                inputRef.current.focus();
              }
            }, 50);
          }
        }, 100);
      });
    } catch (error) {
      console.error("Error al guardar venta pendiente:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo guardar la venta pendiente. Intenta nuevamente.",
      });
    }
  };

  const showPendingCarts = () => {
    setShowPendingSalesModal(true);
  };

  const handlePendingSaleSelect = (pendingSale: PendingSale) => {
    // Convertir los detalles de la venta pendiente al formato del carrito
    const cartItems: ItemCart[] = pendingSale.details.map((detail) => {
      // Crear un producto básico con la información disponible
      // Nota: No tenemos el producto completo, solo la información del detalle
      const baseProduct: Product = {
        id: detail.productId,
        code: '',
        name: detail.productName || 'Producto',
        status: 1,
        saleType: detail.saleType || 'Pieza',
        price: detail.basePrice || detail.price,
        cost: 0,
        icon: '',
        categoryId: '',
      };
      
      // Crear presentación si existe
      let selectedPresentation: ProductPresentation | undefined;
      if (detail.presentationId && detail.presentationName) {
        selectedPresentation = {
          id: detail.presentationId,
          name: detail.presentationName,
          quantity: 1, // Valor por defecto, no tenemos esta info
          unitPrice: detail.basePrice || detail.price,
        };
      }
      
      // Calcular presentationQuantity si hay presentación
      let presentationQuantity: number | undefined;
      if (selectedPresentation && selectedPresentation.quantity > 0) {
        presentationQuantity = Math.ceil(detail.quantity / selectedPresentation.quantity);
      }
      
      // Crear el item del carrito
      const cartItem: ItemCart = {
        ...baseProduct,
        quantity: detail.quantity,
        price: detail.price,
        selectedPresentation,
        presentationQuantity,
      };

      return cartItem;
    });

    // Cargar el carrito
    setCart(() => cartItems);
    // Reiniciar contador de productos no registrados al cargar una venta pendiente
    setProductCounter(1);

    // Cerrar el modal
    setShowPendingSalesModal(false);

    Swal.fire({
      icon: "success",
      title: "Venta cargada",
      html: `
        <p>La venta <strong>${pendingSale.code}</strong> se cargó correctamente</p>
        <p style="margin-top: 10px;">Cliente: ${pendingSale.clientName || "Sin nombre"}</p>
      `,
      timer: 2000,
      showConfirmButton: false,
    });

    // Enfocar el input de búsqueda después de cargar la venta pendiente
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };
 
  return (
    <div className="app-sales">
      <div className="sales-container">
        <Header
          title= {branch}
          onBack={onBack}
          backText="← Volver al Menu Principal"
          className=""
        />
        
        {/* Indicador de Turno de Caja y Cliente */}
        <div className="shift-client-container">
          {/* Columna de Turno (2/3) */}
          <div className="shift-indicator shift-column">
            <div className="shift-info">
              <span className="shift-status-icon">
                {activeShift ? "🟢" : "🔴"}
              </span>
              <span className="shift-status-text">
                {activeShift 
                  ? `Turno Activo`
                  : "No hay turno activo"
                }
              </span>
              {activeShift && (
                <div className="shift-details">
                  <span>Fondo de Caja: ${activeShift.initialCash.toFixed(2)}</span>
                 { /*<span>Efectivo: ${activeShift.totalCash.toFixed(2)}</span>
                  <span>Tarjeta: ${activeShift.totalCard.toFixed(2)}</span>*/}
                </div>
              )}
            </div>
            <div className="shift-actions">
              {activeShift && (
                <button
                  className="btn-movements"
                  onClick={() => setShowCashMovementModal(true)}
                  title="Movimientos de Efectivo"
                >
                  💰 Movimientos
                </button>
              )}
              <button
                className={`btn-shift ${activeShift ? "close" : "open"}`}
                onClick={() => setShowShiftModal(true)}
                title={activeShift ? "Cerrar Turno (F4)" : "Abrir Turno (F4)"}
              >
                {activeShift ? "🔴 Cerrar Turno" : "🟢 Abrir Turno"}
              </button>
            </div>
          </div>

          {/* Columna de Cliente (1/3) */}
          <div className="client-column">
            <button
              className="btn-client"
              onClick={() => setShowClientModal(true)}
              title="Click para cambiar cliente"
            >
              👤 Cliente: {client}
            </button>
            {selectedClient && clientPendingCredit > 0 && (
              <div className="client-credit-info">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span>⚠️</span>
                  <span>
                    <strong>Crédito pendiente:</strong>{" "}
                    {clientPendingCredit.toLocaleString("es-MX", {
                      style: "currency",
                      currency: "MXN",
                    })}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (clientPendingCredits.length === 0) {
                      // Recargar créditos
                      try {
                        const pending = await getClientCredits(selectedClient.id, "PENDING");
                        const partiallyPaid = await getClientCredits(selectedClient.id, "PARTIALLY_PAID");
                        const allPending = [...pending, ...partiallyPaid];
                        
                        if (allPending.length === 0) {
                          Swal.fire({
                            icon: "info",
                            title: "Sin créditos pendientes",
                            text: "Este cliente no tiene créditos pendientes",
                            confirmButtonText: "Entendido",
                          });
                          return;
                        }
                        
                        if (allPending.length === 1) {
                          setSelectedCredit(allPending[0]);
                          setShowCreditPaymentModal(true);
                        } else {
                          const { value: selectedCreditId } = await Swal.fire({
                            title: "Seleccionar Crédito",
                            html: `
                              <p>Este cliente tiene ${allPending.length} crédito(s) pendiente(s).</p>
                              <select id="credit-select" class="swal2-select" style="width: 100%; margin-top: 10px;">
                                ${allPending.map(credit => `
                                  <option value="${credit.id}">
                                    Venta #${credit.saleId} - Saldo: $${credit.remainingAmount.toFixed(2)}
                                  </option>
                                `).join('')}
                              </select>
                            `,
                            showCancelButton: true,
                            confirmButtonText: "Continuar",
                            cancelButtonText: "Cancelar",
                            preConfirm: () => {
                              const select = document.getElementById("credit-select") as HTMLSelectElement;
                              return parseInt(select.value);
                            },
                          });

                          if (selectedCreditId) {
                            const credit = allPending.find(c => c.id === selectedCreditId);
                            if (credit) {
                              setSelectedCredit(credit);
                              setShowCreditPaymentModal(true);
                            }
                          }
                        }
                      } catch (error) {
                        console.error("Error al cargar créditos:", error);
                      }
                    } else if (clientPendingCredits.length === 1) {
                      setSelectedCredit(clientPendingCredits[0]);
                      setShowCreditPaymentModal(true);
                    } else {
                      const { value: selectedCreditId } = await Swal.fire({
                        title: "Seleccionar Crédito",
                        html: `
                          <p>Este cliente tiene ${clientPendingCredits.length} crédito(s) pendiente(s).</p>
                          <select id="credit-select" class="swal2-select" style="width: 100%; margin-top: 10px;">
                            ${clientPendingCredits.map(credit => `
                              <option value="${credit.id}">
                                Venta #${credit.saleId} - Saldo: $${credit.remainingAmount.toFixed(2)}
                              </option>
                            `).join('')}
                          </select>
                        `,
                        showCancelButton: true,
                        confirmButtonText: "Continuar",
                        cancelButtonText: "Cancelar",
                        preConfirm: () => {
                          const select = document.getElementById("credit-select") as HTMLSelectElement;
                          return parseInt(select.value);
                        },
                      });

                      if (selectedCreditId) {
                        const credit = clientPendingCredits.find(c => c.id === selectedCreditId);
                        if (credit) {
                          setSelectedCredit(credit);
                          setShowCreditPaymentModal(true);
                        }
                      }
                    }
                  }}
                  className="btn-credit-payment"
                >
                  💳 Abonar Crédito
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="venta-main">
          {/* 🔹 Lado izquierdo: productos */}
          <div className="venta-left">
            {!showCalculator ? (
              <>
                <div className="venta-search">
                  <div className="search-input-wrapper">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Buscar producto..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="search-input-modern"
                    />
                    {search && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => {
                          setSearch("");
                          inputRef.current?.focus();
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevenir que el input pierda el focus
                        }}
                        title="Limpiar búsqueda"
                        aria-label="Limpiar búsqueda"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    className="btn-common-product"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      // Quitar focus del botón inmediatamente
                      const button = e.currentTarget;
                      button.blur();
                      handleAddCommonProduct();
                    }}
                    onMouseDown={(e) => {
                      // Prevenir que el botón reciba focus al hacer click
                      e.preventDefault();
                    }}
                    title="Agregar producto no registrado (F3)"
                  >
                    <span className="btn-icon">➕</span>
                    <span className="btn-text">P C</span>
                  </button>
                  <button
                    className="btn-categories"
                    onClick={() => setShowCategoryModal(true)}
                    title="Buscar productos por categoría"
                  >
                    <span className="btn-icon">📂</span>
                    <span className="btn-text">Categorías</span>
                  </button>
                  <button
                    className="btn-calculator"
                    onClick={() => setShowCalculator(true)}
                    title="Calculadora rápida para agregar productos"
                  >
                    <span className="btn-icon">🧮</span>
                    <span className="btn-text">Calculadora</span>
                  </button>
                </div>
                {products.length > 0 && (
                  <div className="sales-cards">
                    {products.map((p, index) => (
                      <div
                        key={p.id}
                        className={`product-card-sales ${activeIndex === index ? "active-card" : ""}`}
                        onClick={() => handleAdd(p)}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <div>{p.icon}</div>
                        <h4>{p.name}</h4>
                        <p>
                          {p.price.toLocaleString("es-MX", {
                            style: "currency",
                            currency: "MXN",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <QuickAddCalculator
                onClose={() => {
                  setShowCalculator(false);
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 100);
                }}
                onAddToCart={handleCalculatorAdd}
                productCounter={productCounter}
              />
            )}

          </div>

          {/* 🔹 Lado derecho: cart */}
          <div className="venta-right">
            <div className="table-scroll">
              <table className="venta-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                    <th>
                      <button onClick={() => {
                        setCart([]);
                        setProductCounter(1); // Reiniciar contador al limpiar carrito
                      }}>❌</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length > 0 ? (
                    cart.map((item, index) => {
                      // Calcular subtotal según presentación
                      const subtotal = item.selectedPresentation && item.presentationQuantity
                        ? item.selectedPresentation.unitPrice * item.selectedPresentation.quantity * item.presentationQuantity
                        : item.price * item.quantity;
                      
                      // Mostrar información de presentación si existe
                      const displayName = item.selectedPresentation
                        ? `${item.name} (${item.presentationQuantity}x ${item.selectedPresentation.name})`
                        : item.name;
                      
                      // Mostrar cantidad: unidades totales o cantidad de presentaciones
                      const displayQuantity = item.selectedPresentation && item.presentationQuantity
                        ? `${item.presentationQuantity} ${item.selectedPresentation.name}${item.presentationQuantity > 1 ? 's' : ''}`
                        : item.quantity;
                      
                      // Precio unitario a mostrar
                      const displayPrice = item.selectedPresentation
                        ? item.selectedPresentation.unitPrice
                        : item.price;

                      return (
                        <tr key={`${item.id}-${item.selectedPresentation?.id || 'default'}-${index}`}>
                          <td>
                            <h4>{displayName}</h4>
                            {item.selectedPresentation && (
                              <small style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                {item.selectedPresentation.quantity} unidad{item.selectedPresentation.quantity !== 1 ? 'es' : ''} por {item.selectedPresentation.name}
                              </small>
                            )}
                          </td>
                          <td>
                            {/* Mostrar controles de cantidad solo para productos "Pieza" sin presentaciones */}
                            {item.saleType?.toLowerCase() === 'pieza' && !item.selectedPresentation ? (
                              <div className="quantity-controls">
                                <button
                                  className="quantity-btn quantity-btn-minus"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateQuantity(
                                      item.id, 
                                      item.selectedPresentation?.id, 
                                      -1,
                                      item.name,
                                      item.price
                                    );
                                  }}
                                  title="Disminuir cantidad"
                                >
                                  <span className="quantity-icon">−</span>
                                </button>
                                <span className="quantity-display">{item.quantity}</span>
                                <button
                                  className="quantity-btn quantity-btn-plus"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateQuantity(
                                      item.id, 
                                      item.selectedPresentation?.id, 
                                      1,
                                      item.name,
                                      item.price
                                    );
                                  }}
                                  title="Aumentar cantidad"
                                >
                                  <span className="quantity-icon">+</span>
                                </button>
                              </div>
                            ) : (
                              <>
                                <h4>{displayQuantity}</h4>
                                {item.selectedPresentation && item.quantity > item.presentationQuantity! && (
                                  <small style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                    ({item.quantity} unidades totales)
                                  </small>
                                )}
                              </>
                            )}
                          </td>
                          <td>
                            <h4>${displayPrice.toFixed(2)}</h4>
                            {item.selectedPresentation && (
                              <small style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                c/u
                              </small>
                            )}
                          </td>
                          <td>
                            <h4>${subtotal.toFixed(2)}</h4>
                          </td>
                          <td>
                            <button onClick={() => handleRemove(item.id, item.name, item.selectedPresentation?.id)}>
                              ✖
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ textAlign: "center", color: "#777" }}
                      >
                        No hay productos agregados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/**End scroll */}
          </div>
        </div>
      </div>
      <Footer
        cartLength={cart.length}
        total={total}
        onCheckout={handleCheckoutWithContainers}
        onSaleToPending={saleToPending}
        showPendingCarts={showPendingCarts}
        onFocusSearch={() => {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }}
        branch={branch}
        cashRegister={cashRegister}
      />
      <div>
        {showModal && (
          <PaymentModal
            total={total}
            client={selectedClient}
            containersDepositInfo={containersDepositInfo}
            onClose={() => {
              setShowModal(false);
              setContainersDepositInfo(null); // Limpiar información de depósitos
              // Enfocar el input de búsqueda después de cerrar el modal
              setTimeout(() => {
                inputRef.current?.focus();
              }, 200);
            }}
            onConfirm={confirmPayment}
          />
        )}
        {showCategoryModal && (
          <CategoryProductModal
            onClose={() => {
              setShowCategoryModal(false);
              // Solo enfocar el input de búsqueda si no se está abriendo un modal de producto
              // (como GranelModal, PresentationModal, etc.)
              setTimeout(() => {
                // Verificar que no haya un modal de SweetAlert2 abierto
                const swalContainer = document.querySelector('.swal2-container');
                if (!swalContainer) {
                  inputRef.current?.focus();
                }
              }, 100);
            }}
            onSelectProduct={handleAdd}
          />
        )}
        {showShiftModal && (
          <ShiftModal
            branch={branch}
            cashRegister={cashRegister}
            onClose={() => {
              setShowShiftModal(false);
              checkActiveShift();
              // Enfocar el input de búsqueda después de cerrar el modal
              setTimeout(() => {
                inputRef.current?.focus();
              }, 200);
            }}
            onShiftOpened={(shift) => {
              setActiveShift(shift);
              setShowShiftModal(false);
              // Enfocar el input de búsqueda después de abrir el turno
              setTimeout(() => {
                inputRef.current?.focus();
              }, 200);
            }}
            onShiftClosed={() => {
              setActiveShift(null);
              setShowShiftModal(false);
              // Enfocar el input de búsqueda después de cerrar el turno
              setTimeout(() => {
                inputRef.current?.focus();
              }, 200);
            }}
          />
        )}
        {showCashMovementModal && activeShift && (
          <CashMovementModal
            shift={activeShift}
            onClose={() => {
              setShowCashMovementModal(false);
              checkActiveShift(); // Recargar turno para actualizar cálculos
            }}
            onMovementCreated={() => {
              checkActiveShift(); // Recargar turno después de crear movimiento
            }}
            onFocusSearchInput={focusSearchInput}
          />
        )}
        {showCreditPaymentModal && (
          <CreditPaymentModal
            isOpen={showCreditPaymentModal}
            credit={selectedCredit}
            onClose={() => {
              setShowCreditPaymentModal(false);
              setSelectedCredit(null);
            }}
            onPaymentSuccess={async () => {
              // Recargar créditos del cliente
              if (selectedClient?.id) {
                try {
                  const creditSummary = await getClientCreditSummary(selectedClient.id);
                  setClientPendingCredit(creditSummary.totalPending || 0);
                  const pending = await getClientCredits(selectedClient.id, "PENDING");
                  const partiallyPaid = await getClientCredits(selectedClient.id, "PARTIALLY_PAID");
                  setClientPendingCredits([...pending, ...partiallyPaid]);
                } catch (error) {
                  console.error("Error al recargar créditos:", error);
                }
              }
            }}
          />
        )}
        {showClientModal && (
          <ClientSelectionModal
            isOpen={showClientModal}
            currentClient={client}
            onClose={() => {
              setShowClientModal(false);
              setTimeout(() => {
                inputRef.current?.focus();
              }, 100);
            }}
            onSelect={async (clientName, clientObj) => {
              setClient(clientName);
              setSelectedClient(clientObj || null);
              
              // Cargar créditos pendientes del cliente si tiene ID
              if (clientObj?.id) {
                try {
                  const creditSummary = await getClientCreditSummary(clientObj.id);
                  setClientPendingCredit(creditSummary.totalPending || 0);
                  
                  // Cargar lista de créditos pendientes
                  const pending = await getClientCredits(clientObj.id, "PENDING");
                  const partiallyPaid = await getClientCredits(clientObj.id, "PARTIALLY_PAID");
                  setClientPendingCredits([...pending, ...partiallyPaid]);
                } catch (error) {
                  console.error("Error al obtener créditos del cliente:", error);
                  setClientPendingCredit(0);
                  setClientPendingCredits([]);
                }
              } else {
                setClientPendingCredit(0);
                setClientPendingCredits([]);
              }
              
              setShowClientModal(false);
              setTimeout(() => {
                inputRef.current?.focus();
              }, 100);
            }}
          />
        )}
        <PendingSalesModal
          isOpen={showPendingSalesModal}
          onClose={() => {
            setShowPendingSalesModal(false);
            // Enfocar el input de búsqueda después de cerrar el modal
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          }}
          onSelect={handlePendingSaleSelect}
        />
      </div>
    </div>
  );
};

export default salesPage;
