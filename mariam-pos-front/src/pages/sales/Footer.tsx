import React from "react";
import "../../styles/pages/sales/footer.css";
import DaySalesModal from "./DaySalesModal";

interface FooterProps  {
 onSaleToPending: () => void;
 showPendingCarts:() => void;
}

const Footer:React.FC<FooterProps>= ({onSaleToPending, showPendingCarts}) =>{
  return (
    <footer className="pos-footer">
        <div className="column left">
            <button className="btn touch-btn print-last" onClick={showPendingCarts}> 🖨 Cargar Pendiente</button>
            <button className="btn touch-btn pending" onClick={onSaleToPending}>🕓 Poner Pendiente</button>
            <DaySalesModal/>
        </div>
        <div className="column right">
            11 Productos en la venta actual
        </div>
    </footer>
  );
}

export default Footer;