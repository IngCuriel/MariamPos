import React, { useState } from "react";
import "../../styles/pages/sales/footer.css";
import DaySalesModal from "./DaySalesModal";
import DepartmentSalesModal from "./DepartmentSalesModal";

interface FooterProps  {
 cartLength:number;
 total: number;
 onCheckout: () => void;
 onSaleToPending: () => void;
 showPendingCarts:() => void;
 showOnlineSales:() => void;
 onlineSalesVisible: boolean;
 onFocusSearch?: () => void;
 branch?: string;
 cashRegister?: string;
}

const Footer:React.FC<FooterProps>= ({
  cartLength, 
  total,
  onCheckout,
  onSaleToPending, 
  showPendingCarts, 
  showOnlineSales,
  onlineSalesVisible,
  onFocusSearch,
  cashRegister
}) =>{
  const [showDeptSales, setShowDeptSales] = useState(false);

  return (
    <footer className="pos-footer">
        <div className="column left">
            {/* Grupo: Folios y cobros (acento azul) */}
            <div className="btn-group btn-group--cobros" role="group" aria-label="Folios y cobros">
                <button className="btn touch-btn print-last" onClick={showPendingCarts}> 🧾 Cobrar folio</button>
                {onlineSalesVisible && (
                    <button
                        className="btn touch-btn online-sales"
                        onClick={showOnlineSales}
                    >
                        🌐 Cobrar en línea
                    </button>
                )}
                <button 
                    className="btn touch-btn pending" 
                    onClick={onSaleToPending}
                    disabled={cartLength === 0}
                >
                    🕓 Guardar folio
                </button>
            </div>

            <span className="btn-group-divider" aria-hidden="true" />

            {/* Grupo: Reportes (acento neutro) */}
            <div className="btn-group btn-group--reportes" role="group" aria-label="Reportes">
                <DaySalesModal onClose={onFocusSearch}/>
                <button
                    className="btn touch-btn dept-sales"
                    onClick={() => setShowDeptSales(true)}
                >
                    🏢 Ventas x D
                </button>
            </div>

            <DepartmentSalesModal
                isOpen={showDeptSales}
                cashRegister={cashRegister}
                onClose={() => {
                    setShowDeptSales(false);
                    onFocusSearch?.();
                }}
            />
        </div>
        <div className="column center">
            <div className="cart-info">
                <span className="cart-count" title="Productos en el carrito">
                    🛒 {cartLength}
                </span>
            </div>
        </div>
        <div className="column right">
            <div className="checkout-section">
                <div className="total-display">
                    <span className="total-label">Total:</span>
                    <span className="total-amount">
                        {total.toLocaleString("es-MX", {
                            style: "currency",
                            currency: "MXN",
                        })}
                    </span>
                </div>
                <button
                    className="btn-checkout"
                    disabled={cartLength === 0}
                    onClick={onCheckout}
                >
                    💵 Cobrar (F2)
                </button>
            </div>
        </div>
    </footer>
  );
}

export default Footer;