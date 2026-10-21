import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Purchase } from "../../types";
import "../../styles/pages/purchases/purchases.css";

interface PurchaseDetailModalProps {
  isOpen: boolean;
  purchase: Purchase | null;
  onClose: () => void;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
  CREDIT: "Crédito",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagado",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const PurchaseDetailModal: React.FC<PurchaseDetailModalProps> = ({ isOpen, purchase, onClose }) => {
  if (!isOpen || !purchase) return null;

  const statusClass =
    purchase.paymentStatus === "PAID"
      ? "pur-status-badge--paid"
      : purchase.paymentStatus === "PARTIAL"
      ? "pur-status-badge--partial"
      : "pur-status-badge--pending";

  const statusLabel = PAYMENT_STATUS_LABELS[purchase.paymentStatus] || purchase.paymentStatus;
  const methodLabel = purchase.paymentMethod
    ? PAYMENT_METHOD_LABELS[purchase.paymentMethod] || purchase.paymentMethod
    : "-";

  const details = purchase.details ?? [];

  // ============================================================
  // 📄 Generar PDF con jsPDF + autotable
  // ============================================================
  const handleDownloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let y = 46;

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Detalle de Compra", marginX, y);

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`#${purchase.id}`, pageWidth - marginX, y, { align: "right" });
    doc.setTextColor(0);

    y += 22;
    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 20;

    // Datos generales (dos columnas)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const leftLines = [
      `Proveedor: ${purchase.supplier?.name || "N/A"}`,
      `Fecha de compra: ${formatDate(purchase.purchaseDate)}`,
      `Vencimiento: ${formatDate(purchase.dueDate)}`,
      `Factura: ${purchase.invoiceNumber || "-"}`,
    ];
    const rightLines = [
      `Estado de pago: ${statusLabel}`,
      `Método de pago: ${methodLabel}`,
      `Sucursal: ${purchase.branch || "-"}`,
      `Caja: ${purchase.cashRegister || "-"}`,
    ];
    leftLines.forEach((line, i) => doc.text(line, marginX, y + i * 15));
    rightLines.forEach((line, i) => doc.text(line, pageWidth / 2, y + i * 15));
    y += leftLines.length * 15 + 12;

    // Tabla de productos
    autoTable(doc, {
      startY: y,
      head: [["#", "Código", "Producto", "Cant.", "Costo U.", "Desc.", "Subtotal"]],
      body: details.map((d, i) => [
        String(i + 1),
        d.product?.code || "-",
        d.product?.name || "N/A",
        String(d.quantity),
        formatCurrency(d.unitCost),
        formatCurrency(d.discount),
        formatCurrency(d.subtotal),
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { halign: "center", cellWidth: 28 },
        3: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
      margin: { left: marginX, right: marginX },
    });

    // Totales (debajo de la tabla)
    const afterTableY = (doc as any).lastAutoTable.finalY + 20;
    const totalsX = pageWidth - marginX - 200;
    let ty = afterTableY;
    doc.setFontSize(10);

    const totalRows: Array<[string, string, boolean]> = [
      ["Subtotal", formatCurrency(purchase.subtotal), false],
      ["Descuento", `-${formatCurrency(purchase.discount)}`, false],
      ["Impuestos", formatCurrency(purchase.tax), false],
      ["Total", formatCurrency(purchase.total), true],
    ];

    if (purchase.paidAmount !== undefined && purchase.paidAmount > 0) {
      totalRows.push(["Pagado", formatCurrency(purchase.paidAmount), false]);
      totalRows.push(["Saldo pendiente", formatCurrency(purchase.balance || 0), false]);
    }

    totalRows.forEach(([label, value, strong]) => {
      doc.setFont("helvetica", strong ? "bold" : "normal");
      if (strong) doc.setFontSize(12);
      doc.text(label, totalsX, ty);
      doc.text(value, pageWidth - marginX, ty, { align: "right" });
      if (strong) doc.setFontSize(10);
      ty += strong ? 20 : 15;
    });

    if (purchase.notes) {
      ty += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Notas:", marginX, ty);
      doc.setFont("helvetica", "normal");
      const notesLines = doc.splitTextToSize(purchase.notes, pageWidth - marginX * 2);
      doc.text(notesLines, marginX, ty + 14);
    }

    doc.save(`compra-${purchase.id}.pdf`);
  };

  return (
    <div className="pur-detail-overlay" onClick={onClose}>
      <div className="pur-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pur-detail-header">
          <div className="pur-detail-title">
            <h1>Compra #{purchase.id}</h1>
            <span className={`pur-status-badge ${statusClass}`}>{statusLabel}</span>
          </div>
          <button type="button" className="pur-form-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pur-detail-body">
          {/* Datos generales */}
          <div className="pur-detail-info-grid">
            <div className="pur-detail-info">
              <span className="pur-detail-info-label">Proveedor</span>
              <span className="pur-detail-info-value">{purchase.supplier?.name || "N/A"}</span>
            </div>
            <div className="pur-detail-info">
              <span className="pur-detail-info-label">Fecha de compra</span>
              <span className="pur-detail-info-value">{formatDate(purchase.purchaseDate)}</span>
            </div>
            <div className="pur-detail-info">
              <span className="pur-detail-info-label">Vencimiento</span>
              <span className="pur-detail-info-value">{formatDate(purchase.dueDate)}</span>
            </div>
            <div className="pur-detail-info">
              <span className="pur-detail-info-label">Factura</span>
              <span className="pur-detail-info-value">{purchase.invoiceNumber || "-"}</span>
            </div>
            <div className="pur-detail-info">
              <span className="pur-detail-info-label">Método de pago</span>
              <span className="pur-detail-info-value">{methodLabel}</span>
            </div>
            <div className="pur-detail-info">
              <span className="pur-detail-info-label">Sucursal / Caja</span>
              <span className="pur-detail-info-value">
                {(purchase.branch || "-") + " · " + (purchase.cashRegister || "-")}
              </span>
            </div>
          </div>

          {/* Productos */}
          <div className="pur-detail-section-title">
            🛒 Productos ({details.length})
          </div>
          <div className="pur-detail-table-wrap">
            <table className="pur-detail-table">
              <thead>
                <tr>
                  <th className="pur-th-num">#</th>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="pur-td-right">Cantidad</th>
                  <th className="pur-td-right">Costo Unit.</th>
                  <th className="pur-td-right">Descuento</th>
                  <th className="pur-td-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {details.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="pur-table-state">
                      Esta compra no tiene productos registrados
                    </td>
                  </tr>
                ) : (
                  details.map((d, i) => (
                    <tr key={d.id ?? i}>
                      <td className="pur-td-num">{i + 1}</td>
                      <td>{d.product?.code || "-"}</td>
                      <td>
                        <span className="pur-detail-prod-name">{d.product?.name || "N/A"}</span>
                      </td>
                      <td className="pur-td-right">{d.quantity}</td>
                      <td className="pur-td-right">{formatCurrency(d.unitCost)}</td>
                      <td className="pur-td-right">{formatCurrency(d.discount)}</td>
                      <td className="pur-td-right">
                        <span className="pur-total">{formatCurrency(d.subtotal)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totales + Pago */}
          <div className="pur-detail-summary">
            <div className="pur-totals">
              <div className="pur-total-item">
                <span>Subtotal</span>
                <span>{formatCurrency(purchase.subtotal)}</span>
              </div>
              <div className="pur-total-item">
                <span>Descuento</span>
                <span>-{formatCurrency(purchase.discount)}</span>
              </div>
              <div className="pur-total-item">
                <span>Impuestos</span>
                <span>{formatCurrency(purchase.tax)}</span>
              </div>
              <div className="pur-total-item pur-total-item--final">
                <span>Total</span>
                <span>{formatCurrency(purchase.total)}</span>
              </div>
              {purchase.paidAmount !== undefined && purchase.paidAmount > 0 && (
                <>
                  <div className="pur-total-item">
                    <span>Pagado</span>
                    <span className="pur-pay-value--paid">{formatCurrency(purchase.paidAmount)}</span>
                  </div>
                  <div className="pur-total-item">
                    <span>Saldo pendiente</span>
                    <span className="pur-pay-value--pending">
                      {formatCurrency(purchase.balance || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {purchase.notes && (
            <div className="pur-detail-notes">
              <span className="pur-detail-info-label">Notas</span>
              <p>{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="pur-form-actions">
          <button type="button" className="pur-btn pur-btn--ghost" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="pur-btn pur-btn--pdf" onClick={handleDownloadPdf}>
            📄 Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseDetailModal;
