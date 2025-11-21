import React, { useState, useEffect } from "react";
import type { Product, Inventory } from "../../types";
import { getProductInventory } from "../../api/inventory";

interface ProductCardWithStockProps {
  product: Product;
  index: number;
  activeIndex: number;
  onAdd: () => void;
  onMouseEnter: () => void;
}

const ProductCardWithStock: React.FC<ProductCardWithStockProps> = ({
  product,
  index,
  activeIndex,
  onAdd,
  onMouseEnter,
}) => {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product.trackInventory && product.id !== 1) {
      setLoading(true);
      getProductInventory(product.id)
        .then((inv) => {
          setInventory(inv);
        })
        .catch((error) => {
          console.error("Error loading inventory:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [product.id, product.trackInventory]);

  const getStockBadge = () => {
    if (!inventory || !product.trackInventory) return null;

    if (inventory.currentStock <= 0) {
      return <span className="stock-badge stock-out">Sin stock</span>;
    }
    if (inventory.currentStock <= inventory.minStock) {
      return <span className="stock-badge stock-low">{inventory.currentStock}</span>;
    }
    return <span className="stock-badge stock-ok">{inventory.currentStock}</span>;
  };

  return (
    <div
      className={`product-card-sales ${activeIndex === index ? "active-card" : ""}`}
      onClick={onAdd}
      onMouseEnter={onMouseEnter}
    >
      <div>{product.icon}</div>
      <h4>{product.name}</h4>
      <p>
        {product.price.toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
        })}
      </p>
      {getStockBadge()}
    </div>
  );
};

export default ProductCardWithStock;

