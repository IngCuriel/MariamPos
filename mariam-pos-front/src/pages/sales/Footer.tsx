import React from "react";
import "../../styles/pages/sales/footer.css";
import DaySalesModal from "./DaySalesModal";

interface FooterProps  {
 cartLength:number;
 onSaleToPending: () => void;
 showPendingCarts:() => void;
 onFocusSearch?: () => void;
 branch?: string;
 cashRegister?: string;
}

const Footer:React.FC<FooterProps>= ({cartLength, onSaleToPending, showPendingCarts, onFocusSearch, branch, cashRegister}) =>{
  return (
    <footer className="pos-footer">
        <div className="column left">
            <button className="btn touch-btn print-last" onClick={showPendingCarts}> 🖨 Cargar Pendiente</button>
            <button className="btn touch-btn pending" onClick={onSaleToPending}>🕓 Poner Pendiente</button>
            <DaySalesModal onClose={onFocusSearch}/>
        </div>
        <div className="column right">
            {cartLength} Productos en la venta actual
        </div>
    </footer>
  );
}

export default Footer;