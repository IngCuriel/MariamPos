import React from "react";
import "../../styles/pages/sales/footer.css";
import DaySalesModal from "./DaySalesModal";

interface FooterProps  {
 cartLength:number;
 total: number;
 onCheckout: () => void;
 onSaleToPending: () => void;
 showPendingCarts:() => void;
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
  onFocusSearch
}) =>{
  return (
    <footer className="pos-footer">
        <div className="column left">
            <button className="btn touch-btn print-last" onClick={showPendingCarts}> 🖨 Cargar Pendiente</button>
            <button className="btn touch-btn pending" onClick={onSaleToPending}>🕓 Poner Pendiente</button>
            <DaySalesModal onClose={onFocusSearch}/>
        </div>
        <div className="column center">
            <div className="cart-info">
                <span className="cart-count">{cartLength} Productos</span>
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