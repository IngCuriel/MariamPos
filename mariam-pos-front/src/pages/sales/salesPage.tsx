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
} from "../../types";
import { getProductsFilters } from "../../api/products";
import { createSale } from "../../api/sales";
import { createInventoryMovement, getProductInventory } from "../../api/inventory";
import Footer from "./Footer";

import Swal from "sweetalert2";
import { ProductComunModal } from "./ProductComunModal";
import { PresentationModal } from "./PresentationModal";
import CategoryProductModal from "./CategoryProductModal";
import QuickAddCalculator from "./QuickAddCalculator";
import type { ProductPresentation } from "../../types";

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
  const [client, _setClient] = useState("Publico en General");

  const [cart, setCart] = useState<ItemCart[]>(() => {
    // Leer el carrito guardado si existe
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [productCounter, setProductCounter] = useState(1);

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

      Swal.fire({
        icon: 'success',
        title: `${result.nombre} agregado`,
        timer: 2000,
        showConfirmButton: false,
      });
    } else {
      console.log('Venta cancelada');
    }
    setSearch("");
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        console.log('cart', cart)
        if (cart.length >= 1) {
          setShowModal(true); 
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        handleAddCommonProduct();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, handleAddCommonProduct]);

  // Cada vez que cambie el carrito, lo guardamos
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
    setSearch("");
    inputRef.current?.focus();
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
      const data = await getProductsFilters(search);
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
    if (product.presentations && product.presentations.length > 0) {
      const presentationResult = await PresentationModal(product);
      if (presentationResult) {
        selectedPresentation = presentationResult.presentation;
        presentationQuantity = presentationResult.quantity;
        quantity = selectedPresentation.quantity * presentationQuantity; // Total de unidades
        
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
    if (addCart && product.saleType === 'Granel') {
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
            // Aquí puedes actualizar tu carrito o llamar una API
        } else {
            console.log('Venta cancelada');
            setSearch("");
            inputRef.current?.focus();
        }
    }
    if (addCart) {
      // Calcular el precio según la presentación seleccionada
      const finalPrice = selectedPresentation 
        ? selectedPresentation.unitPrice 
        : product.price;

      // Crear el item del carrito
      const cartItem: ItemCart = {
        ...product,
        quantity,
        price: finalPrice, // Precio unitario de la presentación
        selectedPresentation,
        presentationQuantity,
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
              return { 
                ...item, 
                quantity: item.quantity + quantity,
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

  // Calcular total considerando presentaciones
  const total = cart.reduce((acc, item) => {
    // Si tiene presentación seleccionada, calcular: cantidad de presentaciones * precio unitario * unidades por presentación
    if (item.selectedPresentation && item.presentationQuantity) {
      const totalUnits = item.selectedPresentation.quantity * item.presentationQuantity;
      return acc + (item.selectedPresentation.unitPrice * totalUnits);
    }
    // Si no tiene presentación, usar el cálculo normal
    return acc + (item.price * item.quantity);
  }, 0);

  const confirmPayment = async (data: ConfirmPaymentData) => {
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
        // Calcular subtotal según presentación
        const subtotal = item.selectedPresentation && item.presentationQuantity
          ? item.selectedPresentation.unitPrice * item.selectedPresentation.quantity * item.presentationQuantity
          : item.price * item.quantity;
        
        // Nombre del producto con presentación si aplica
        const productName = item.selectedPresentation
          ? `${item.name} (${item.presentationQuantity}x ${item.selectedPresentation.name})`
          : item.name;
        
        // Precio unitario usado
        const unitPrice = item.selectedPresentation
          ? item.selectedPresentation.unitPrice
          : item.price;
        
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
      
      const sale: Omit<SaleInput, "createdAt"> = {
        folio: "",
        total: total,
        status: "Pagado",
        paymentMethod: data.paymentType,
        clientName: client,
        details,
        branch,
        cashRegister
      };
      
      // 1️⃣ Crear la venta
      const responseCreateSale = await createSale(sale);
      console.log("responseCreateSale", responseCreateSale);
      
      // 2️⃣ Descontar inventario después de crear la venta exitosamente
      await updateInventoryFromSale(cart, branch);
      
      // 3️⃣ Limpiar carrito, reiniciar contador y mostrar éxito
      setCart([]);
      setProductCounter(1); // Reiniciar contador de productos no registrados
      
      Swal.fire({
        icon: "success",
        title: "✅ Venta completada",
        html: `
          <p>La venta se registró correctamente.</p>
          <p style="margin-top: 10px; color: #059669; font-weight: 600;">
            Total: ${total.toLocaleString("es-MX", {
              style: "currency",
              currency: "MXN",
            })}
          </p>
          <p style="margin-top: 10px; font-size: 0.9rem; color: #6b7280;">
            El inventario ha sido actualizado automáticamente.
          </p>
        `,
        timer: 4000,
        showConfirmButton: false,
      });
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

  const saleToPending = () => {
     if (cart.length === 0) {
      Swal.fire("No hay Productos  selecionados");
      return;
    }
    Swal.fire({
      title: "Venta pendiente",
      text: "¿Deseas guardar la venta como pendiente?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#4CAF50",
      cancelButtonColor: "#d33",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { value: name } = await Swal.fire({
          title: "Ingresa un nombre para el  ticket",
          input: "text",
          inputLabel: "Name",
          inputPlaceholder: "Ticket # name",
          showCancelButton: true,
        });
        if (name) {
          // Obtener los carritos existentes
          const stored = localStorage.getItem("cart-pending");
          const cartPending = stored ? JSON.parse(stored) : [];
          // Crear nuevo carrito
          const newCart = {
            name,
            items: cart,
          };
          // Agregar al array
          cartPending.push(newCart);
          localStorage.setItem("cart-pending", JSON.stringify(cartPending));
          setCart(() => []);
          Swal.fire(
            "Guardado",
            `La venta se guardó correctamente ${name}`,
            "success"
          );
        }
      }
    });
  };

  const showPendingCarts = async () => {
    // Obtener carritos del localStorage
    const stored = localStorage.getItem("cart-pending");
    const carts = stored ? JSON.parse(stored) : [];

    if (carts.length === 0) {
      Swal.fire("No hay carritos pendientes");
      return;
    }

    // Crear un objeto para SweetAlert2 tipo select
    const options: Record<number, string> = {};;
    carts.forEach((cart:ItemCart, index:number) => {
      options[index] = cart.name; // la key puede ser el índice
    });

    // Mostrar alerta
    const { value: selectedIndex } = await Swal.fire({
      title: "Selecciona un carrito pendiente",
      input: "select",
      inputOptions: options,
      inputPlaceholder: "Elige un carrito",
      showCancelButton: true,
    });

    if (selectedIndex !== undefined) {
      const selectedCart = carts[selectedIndex];
      console.log("Carrito seleccionado:", selectedCart);
      setCart(() => selectedCart.items);
      //Eliminar del localstorage el carrito pendiente
      carts.splice(selectedIndex, 1);
      localStorage.setItem("cart-pending", JSON.stringify(carts));
    }
  };
 
  return (
    <div className="app-sales">
      <div className="sales-container">
        <Header
          title= {branch}
          onBack={onBack}
          backText="← Volver al POS"
          className=""
        />

        <div className="venta-main">
          {/* 🔹 Lado izquierdo: productos */}
          <div className="venta-left">
            {!showCalculator ? (
              <>
                <div className="venta-search">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  <button
                    className="btn-common-product"
                    onClick={handleAddCommonProduct}
                    title="Agregar producto no registrado (F3)"
                  >
                    <span className="btn-icon">➕</span>
                    <span className="btn-text">Producto Común</span>
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
                onClose={() => setShowCalculator(false)}
                onAddToCart={handleCalculatorAdd}
                productCounter={productCounter}
              />
            )}

          </div>

          {/* 🔹 Lado derecho: cart */}
          <div className="venta-right">
            <button className="btn-finalizar">👤 Cliente: {client}</button>
            <div className="table-scroll">
              <table className="venta-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                    <th>
                      <button onClick={() => setCart([])}>❌</button>
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
                            <h4>{displayQuantity}</h4>
                            {item.selectedPresentation && item.quantity > item.presentationQuantity! && (
                              <small style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                ({item.quantity} unidades totales)
                              </small>
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
            <div className="venta-summary">
              <h1>
                Total:{" "}
                {total.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })}
              </h1>
              <button
                className="btn-finalizar"
                disabled={cart.length === 0}
                onClick={() => setShowModal(true)}
              >
                💵 Cobrar (F2)
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer
        cartLength = {cart.length}
        onSaleToPending={saleToPending}
        showPendingCarts={showPendingCarts}
      />
      <div>
        {showModal && (
          <PaymentModal
            total={total}
            onClose={() => setShowModal(false)}
            onConfirm={confirmPayment}
          />
        )}
        {showCategoryModal && (
          <CategoryProductModal
            onClose={() => setShowCategoryModal(false)}
            onSelectProduct={handleAdd}
          />
        )}
      </div>
    </div>
  );
};

export default salesPage;
