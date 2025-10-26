import React, { useState, useEffect, useRef } from "react";
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
import Footer from "./Footer";

import Swal from "sweetalert2";
import { ProductComunModal } from "./ProductComunModal";

interface SalesPageProps {
  onBack: () => void;
}

interface ItemCart extends Product {
  quantity: number;
}

const salesPage: React.FC<SalesPageProps> = ({ onBack }) => {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null); // 👈 search al input

  const [client, _setClient] = useState("Publico en General");

  const [cart, setCart] = useState<ItemCart[]>(() => {
    // Leer el carrito guardado si existe
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Cada vez que cambie el carrito, lo guardamos
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
    setSearch("");
    inputRef.current?.focus();
  }, [cart]);

  useEffect(() => {
    if(search.length > 2) {
      fetchProducts();
    }
  }, [search]);

  const fetchProducts = async () => {
    try {
      const data = await getProductsFilters(search);
      if(data.length === 1) {
        const getProduct = data[0];
        if (getProduct.code === search) {
            handleAdd(getProduct);
        }
      }
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      console.log("Finally");
    }
  };

  const handleAdd = async(product: Product) => {
    let quantity = 1;
    let addCart = true;
    if (product.saleType === 'Granel') {
         const result = await GranelModal(product);
          if (result) {
            quantity = result.cantidad;
             console.log('Se vendió:', result.cantidad, 'kg a', result.precio, 'MXN');
            // Aquí puedes actualizar tu carrito o llamar una API
          } else {
            addCart = false;
            console.log('Venta cancelada');
          }
    }
    //Code Product Comun
    if (product.code==='111') {
      addCart = false;
        const result = await ProductComunModal(product);
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
        }
    }
    if (addCart) {
      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [...prev, { ...product, quantity}];
      });
   } 
  };

  const handleRemove = (id: number) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const total = cart.reduce((acc, p) => acc + p.price * p.quantity, 0);

  const confirmPayment = async (data: ConfirmPaymentData) => {
     setShowModal(false);
    try {
      // 👉 tipo para crear ventas (sin id, ni campos anidados)
      type SaleDetailInput = Omit<SaleDetail, "id" | "saleId" | "product">;
      type SaleInput = Omit<Sale, "id" | "details"> & {
        details: SaleDetailInput[];
      };

      const details: SaleDetailInput[] = cart.map((cart) => {
        return {
          quantity: cart.quantity,
          price: cart.price,
          productName: cart.name,
          subTotal: cart.quantity * cart.price,
          productId: cart.id,
        };
      });
      const sale: SaleInput = {
        folio: "",
        total: total,
        status: "Pagado",
        paymentMethod: data.paymentType,
        clientName: client,
        details,
      };
      const responseCreateSale = await createSale(sale);
      setCart([]);
      console.log("responseCreateSale", responseCreateSale);
    } catch (error) {
      console.log("Error ConfirmPayment", error);
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
          title="Procesar Venta"
          onBack={onBack}
          backText="← Volver al POS"
          className=""
        />

        <div className="venta-main">
          {/* 🔹 Lado izquierdo: productos */}
          <div className="venta-left">
            <div className="venta-search">
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar producto... ó Producto Común Codigo=111"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="sales-cards">
              {products.length > 0 ? (
                products.map((p) => (
                  <div
                    key={p.id}
                    className="product-card-sales"
                    onClick={() => handleAdd(p)}
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
                ))
              ) : (
                <p className="no-result">No se encontraron productos</p>
              )}
            </div>
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
                    cart.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <h4>{item.name}</h4>
                        </td>
                        <td>
                          <h4>{item.quantity}</h4>
                        </td>
                        <td>
                          <h4>${item.price.toFixed(2)}</h4>
                        </td>
                        <td>
                          <h4>${(item.price * item.quantity).toFixed(2)}</h4>
                        </td>
                        <td>
                          <button onClick={() => handleRemove(item.id)}>
                            ✖
                          </button>
                        </td>
                      </tr>
                    ))
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
                💵 Cobrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer
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
      </div>
    </div>
  );
};

export default salesPage;
