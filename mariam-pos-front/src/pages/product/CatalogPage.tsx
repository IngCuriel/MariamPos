import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { Product, Category } from "../../types";
import {
  getProducts,
  getProductsFilters,
  getProductsByCategoryId,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../api/products";
import { getCategories } from "../../api/categories";
import "../../styles/pages/products/products.css";
import NewEditProductModal from "./NewEditProductModal";

import { toast } from "react-toastify";
import Swal from "sweetalert2";

interface CatalogPageProps {
  onBack: () => void;
}

const CatalogPage: React.FC<CatalogPageProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsEdit, setProductsEdit] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null); // 👈 referencia al input

  const [loading, setLoading] = useState(false);

  // 🟢 Llamada al API cuando el hook se monta
  useEffect(() => {
    inputRef.current?.focus();
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    if(searchTerm.length > 2) {
       const handler = setTimeout(() => {
        fetchProductsFilters();
      }, 300); // 🕒 Espera 300 ms después del último cambio

      // Limpiar el timeout si `search` cambia antes de que pasen los 300 ms
      return () => clearTimeout(handler);
    } else if (searchTerm.length===0) {
       setProducts([])
    } 
  }, [searchTerm]);

  useEffect(() => {
    fetchProductsByCategoryId();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true); // 🔹 iniciar loader
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      console.log("Finally");
      setLoading(false); // 🔹 finalizar loader
    }
  };

  const fetchProductsFilters = async () => {
      setLoading(true); // 🔹 iniciar loader
      try {
        const data = await getProductsFilters(searchTerm);
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        console.log("Finally");
        setLoading(false); // 🔹 finalizar loader
        if (selectedCategory !== "") setSelectedCategory("");
      }
  };

  const fetchProductsByCategoryId = async () => {
    setSearchTerm(() => "");
    if (selectedCategory !== "") {
      setLoading(true); // 🔹 iniciar loader
      try {
        const data = await getProductsByCategoryId(selectedCategory);
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false); // 🔹 finalizar loader
        console.log("Finally");
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      console.log("Finally");
    }
  };

  const handleDelete = async (_productId: number) => {
    try {
      const resultSwal = await Swal.fire({
        title: `¿Estás seguro que deseas eliminar el Producto?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
      });

      if (resultSwal.isConfirmed) {
        const result = await deleteProduct(_productId);
        console.log("result delete product", result);
        setProducts((prevProducts) =>
          prevProducts.filter((p) => p.id !== _productId)
        );
        // toast.success('✅ Producto eliminado correctamente');
        // 🔔 Notificación de éxito
        Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: `Eliminado correctamente.`,
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.log("Error eliminar procuto", error);
      toast.error("❌ No es posible eliminar el producto");
    } finally {
      inputRef.current?.focus();
    }
  };

  const onEdit = (product: Product) => {
    setProductsEdit(product);
    setShowAddForm(true);
  };

  const handleSave = async (product: Omit<Product, "createdAt">) => {
    console.log("product", product);
    try {
      let data = null;
      if (product.id > 0) {
        data = await updateProduct(product);
        handleCloseForm()
      } else {
        data = await createProduct(product);
        handleCloseForm()
       }
      // 🔔 Notificación de éxito
      Swal.fire({
        icon: "success",
        title: product.id ? "Producto actualizado" : "Producto creado",
        text: `${product.name} ha sido ${
          product.id ? "actualizado" : "creado"
        } correctamente.`,
        timer: 2000,
        showConfirmButton: false,
      });
      setProducts((prevProducts) =>
        prevProducts.map((p) =>
          p.id === product.id ? { ...p, ...product } : p
        )
      );
      console.log("data", data);
    } catch (err:any) {
            // 🔔 Notificación de éxito
      Swal.fire({
        icon: "error",
        title: err?.response?.data?.error || 'Ocurrio un error intentar más tarde',
        text: ``,
        timer: 3000,
        showConfirmButton: false,
      });
      console.error(err.response.data.error);
    } finally {
      inputRef.current?.focus();
    }
  };

  const handleAddNew = () => {
    setProductsEdit(null);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    inputRef.current?.focus();
  };
  
  const handleDownloadPDF = async () => {
      if (products.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No hay productos para descargar",
          timer: 1500,
          showConfirmButton: false,
        });
        return;
      }

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      // 🔹 Logo (opcional)
      const logoDataUrl = ""; // tu logo opcional
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 15);
      }

      // 🔹 Título
      doc.setFontSize(18);
      doc.text("Catálogo de Productos", pageWidth / 2, 20, { align: "center" });

      // 🔹 Fecha
      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleString()}`, pageWidth - 14, 20, { align: "right" });

      // 🔹 Columnas
      const tableColumn = ["Código", /*"Código de barras",*/ "Nombre", "Categoría", "Precio", "Costo"];

      // 🔹 Filas
      const tableRows = products.map((product) => [
        product.code,
       // "", // celda del código de barras
        product.name,
        product.category?.name || "",
        product.price.toFixed(2),
        product.cost.toFixed(2)
      ]);

      // 🔹 Crear tabla
      autoTable(doc, {
        startY: 30,
        head: [tableColumn],
        body: tableRows,
        /*styles: {
          fontSize: 9,
          cellPadding: { top: 10, bottom: 10 },
        },*/
        headStyles: {
          fillColor: [48, 133, 214],
          textColor: 255,
          fontStyle: "bold",
        },
        /*didDrawCell: (data) => {
          // ✅ Solo dibujar en el cuerpo, no en el encabezado
          if (data.section === "body" && data.column.index === 1) {
            const product = products[data.row.index];
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, product.code, {
              format: "CODE128",
              width: 1.5,
              height: 30,
              displayValue: false,
            });
            const barcodeDataUrl = canvas.toDataURL("image/png");

            // Centrar dentro de la celda
            const imgWidth = 35;
            const imgHeight = 15;
            const xPos = data.cell.x + (data.cell.width - imgWidth) / 2;
            const yPos = data.cell.y + (data.cell.height - imgHeight) / 2;

            doc.addImage(barcodeDataUrl, "PNG", xPos, yPos, imgWidth, imgHeight);
          }
        },*/
        theme: "grid",
      });

      doc.save("catalogo_productos.pdf");
    };

  return (
    <div className="app-products-catalog">
      <div className="products-catalog-container">
        <Header
          title="Catálogo de Productos"
          onBack={onBack}
          backText="← Volver a Productos"
          className="catalog-header"
        />

        <div className="catalog-content">
          {/* Filtros */}
          <Card className="filters-card">
            <div className="filters">
              <div className="search-group">
                <label htmlFor="search">Buscar producto:</label>
                <input
                  type="text"
                  ref={inputRef} // 👈 referencia aquí
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o descripción..."
                  className="search-input"
                />
              </div>

              <div className="category-group">
                <label htmlFor="category">Categoría:</label>
                <select
                      id="category"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="category-select"
                    >
                      <option value="">Todas las categorías</option>
                      {Object.entries(
                        categories.reduce((groups:any, cat) => {
                          const [main, sub] = cat.name.split('/');
                          const key = main.trim();
                          if (!groups[key]) groups[key] = [];
                          groups[key].push({ id: cat.id, sub: sub?.trim() || main.trim() });
                          return groups;
                        }, {})
                      ).map(([groupName, items]) => (
                        <optgroup key={groupName} label={groupName}>
                          {(items as any[]).map((item:any) => (
                            <option key={item.id} value={item.id}>
                              {item.sub}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
              </div>
              <div>
                <Button
                  variant="success"
                  onClick={handleAddNew}
                  className="add-category-btn"
                >
                  ➕ Agregar Producto
                </Button>
                <Button variant="warning" onClick={handleDownloadPDF} className="download-btn">
                  📄 Descargar PDF
                </Button>
              </div>
            </div>
          </Card>
          {/* Grid de productos */}
          <div className="products-grid">
            {loading ? (
              <Card className="no-products-card">
                <div className="loader-container">
                      <div className="loader"></div>
                      <p>Cargando productos...</p>
                 </div>
              </Card>
            ) : products.length === 0 ? (
              <Card className="no-products-card">
                <h3>No se encontraron productos</h3>
                <p>Intenta ajustar los filtros de búsqueda</p>
              </Card>
            ) : ( products.map((product) => (
                <Card
                  key={product.id}
                  className={`product-card`}
                  variant="product"
                >
                  {/*<div className={`product-image`}>{product.icon}</div>*/}
                  <div className="product-info">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-category">
                      Categoria: {product.category?.name}
                    </p>
                    <p className="product-price">${product.price.toFixed(2)}</p>
                    <p className="product-stock">Costo: {product.cost}</p>
                    {/*product.description && (
                      <p className="product-description">
                        {product.description}
                      </p>
                    )*/}
                    <p className="product-code">Codigo: {product.code}</p>
                  </div>
                  <div className="product-actions">
                    <Button
                      variant="info"
                      size="small"
                      onClick={() => onEdit(product)}
                      className="edit-btn"
                    >
                      Editar
                    </Button>

                    <Button
                      variant="warning"
                      size="small"
                      onClick={() => handleDelete(product.id)}
                      className="delete-btn"
                    >
                      Eliminar
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
        {/* Modal para agregar/editar categorías */}
        <NewEditProductModal
          isOpen={showAddForm}
          onClose={handleCloseForm}
          onSave={handleSave}
          product={productsEdit}
          title={"Producto"}
        />
      </div>
    </div>
  );
};

export default CatalogPage;
