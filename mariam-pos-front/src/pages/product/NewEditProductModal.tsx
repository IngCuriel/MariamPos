import React, { useState, useEffect, useRef } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Product, Category, ProductPresentation, ProductPriceTier } from "../../types/index";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import Swal from "sweetalert2";

import { getCategories } from "../../api/categories";

import "../../styles/pages/products/newproductpage.css";
import "../../styles/pages/products/productModal.css";
import ProductHelpModal, { type ProductHelpTopic } from "./ProductHelpModal";
import { previewNextCode, suggestPrefix, createCodePrefix } from "../../api/codePrefixes";
import { getUnits } from "../../api/units";
import type { CodePreview, UnitOfMeasure } from "../../types/index";
import CategorySelect from "../../components/CategorySelect";
import {
  OPEN_PRICE_SALE_TYPE,
  buildOpenPriceProduct,
  validateOpenPriceProduct,
} from "../../utils/openPrice";

interface NewEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, "createdAt">) => void;
  product?: Product | null;
  title: string;
}

const NewEditProductModal: React.FC<NewEditProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  title,
}) => {
  const [formData, setFormData] = useState({
    id: 0,
    code: "",
    name: "",
    status: 1,
    price: 0,
    saleType: "",
    cost: 0,
    icon: "",
    description: "",
    category: "",
  });
  const [saleType, setSaleType] = useState("Pieza");
  const [status, setStatus] = useState<number>(1);
  const [trackInventory, setTrackInventory] = useState<boolean>(false);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [unitId, setUnitId] = useState<string>(""); // id de la unidad seleccionada (o "")

  // Precio escalonado (tiered pricing)
  const [pricingMode, setPricingMode] = useState<"simple" | "tiered">("simple");
  const [priceTiers, setPriceTiers] = useState<ProductPriceTier[]>([]);

  // Promoción
  const [isPromo, setIsPromo] = useState(false);
  const [promoPrice, setPromoPrice] = useState<number>(0);
  const [promoEndsAt, setPromoEndsAt] = useState<string>(""); // yyyy-mm-dd o ""
  const [labelQuantity, setLabelQuantity] = useState(5);
  const [activeTab, setActiveTab] = useState("producto");
  const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
  const [editingPresentationIndex, setEditingPresentationIndex] = useState<number | null>(null);
  const [newPresentation, setNewPresentation] = useState<Omit<ProductPresentation, 'isDefault'>>({
    name: "",
    quantity: 1,
    unitPrice: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [presentationErrors, setPresentationErrors] = useState<Record<number, Record<string, string>>>({});

  // Modal de ayuda (buenas prácticas para código / nombre)
  const [helpTopic, setHelpTopic] = useState<ProductHelpTopic | null>(null);

  // Generación automática de código por prefijo de categoría
  const [autoCode, setAutoCode] = useState(false); // true = código lo genera el backend al guardar
  const [codePreview, setCodePreview] = useState<CodePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showCreatePrefix, setShowCreatePrefix] = useState(false);
  const [prefixInput, setPrefixInput] = useState("");
  const [savingPrefix, setSavingPrefix] = useState(false);

  // 👇 Refs para todos los inputs importantes
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);
  
  // Recargar categorías y unidades CADA VEZ que se abre el modal. El modal no
  // se desmonta (solo cambia isOpen), por eso no basta con cargar al montar:
  // si el usuario crea una unidad/categoría nueva en su catálogo y vuelve a
  // abrir el formulario, debe ver los datos frescos sin salir del módulo.
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchUnits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.log("Error", error);
    }
  };

  const fetchUnits = async () => {
    try {
      const data = await getUnits(true); // solo activas
      console.log("🔎 [fetchUnits] unidades recibidas:", data);
      setUnits(data);
    } catch (error) {
      console.log("Error al cargar unidades", error);
    }
  };

  // Consultar el preview del código automático al cambiar la categoría (solo producto nuevo).
  const isNewProduct = !product || product.id === 0;

  // Producto de Precio Abierto: el precio no vive en el catálogo, se captura al
  // momento de la venta. Cuando este flag está activo, el formulario oculta los
  // campos de precio base, costo, presentaciones, precio escalonado, promoción e
  // inventario (son excluyentes con este tipo de venta).
  const isOpenPrice = saleType === OPEN_PRICE_SALE_TYPE;

  // Cambio de tipo de venta. Para "Pieza" y "Granel" el comportamiento no
  // cambia (solo actualiza el saleType). Al cambiar a "Precio Abierto" se
  // limpian las secciones incompatibles (precio escalonado, promoción,
  // inventario) y se restaura la presentación base, para que no se guarden
  // configuraciones contradictorias (Req 2.5).
  const handleSaleTypeChange = (value: string) => {
    setSaleType(value);
    if (value === OPEN_PRICE_SALE_TYPE) {
      setPricingMode("simple");
      setPriceTiers([]);
      setIsPromo(false);
      setPromoPrice(0);
      setPromoEndsAt("");
      setTrackInventory(false);
      // Restaurar la presentación base (1 pieza) descartando presentaciones extra.
      setPresentations([
        {
          name: "Pieza",
          quantity: 1,
          unitPrice: 0,
          isDefault: true,
        },
      ]);
    }
  };

  const loadCodePreview = async (categoryId: string) => {
    if (!categoryId) {
      setCodePreview(null);
      return;
    }
    try {
      setLoadingPreview(true);
      const preview = await previewNextCode(categoryId);
      setCodePreview(preview);
      // NO forzar el modo automático: si el producto tiene código de barras real,
      // el cajero debe poder escanearlo/escribirlo. El auto queda como opción
      // disponible (botón "Generar automático"), no como comportamiento por defecto.
      setAutoCode(false);
    } catch (err) {
      console.error("Error al obtener preview de código:", err);
      setCodePreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Escuchar cambios de categoría solo en producto nuevo.
  useEffect(() => {
    if (!isOpen || !isNewProduct) return;
    loadCodePreview(formData.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.category, isOpen]);

  // Alternar entre código automático y manual.
  const handleToggleAutoCode = () => {
    if (autoCode) {
      // Pasar a manual: limpiar para que el usuario escriba.
      setAutoCode(false);
      setFormData((prev) => ({ ...prev, code: "" }));
    } else if (codePreview?.hasPrefix && codePreview.code) {
      // Volver a automático.
      setAutoCode(true);
      setFormData((prev) => ({ ...prev, code: codePreview.code as string }));
    }
  };

  // Abrir el mini-formulario para crear prefijo (sugiere uno desde depto+categoría).
  const handleOpenCreatePrefix = async () => {
    if (!formData.category) {
      Swal.fire({
        icon: "info",
        title: "Selecciona una categoría",
        text: "Primero elige la categoría del producto para crear su prefijo.",
        timer: 2500,
        showConfirmButton: false,
      });
      return;
    }
    try {
      const { suggested } = await suggestPrefix(formData.category);
      setPrefixInput(suggested || "");
    } catch {
      setPrefixInput("");
    }
    setShowCreatePrefix(true);
  };

  // Guardar el prefijo nuevo y activar el código automático.
  const handleSavePrefix = async () => {
    const clean = prefixInput.trim().toUpperCase();
    if (!clean) {
      Swal.fire({
        icon: "warning",
        title: "El prefijo es obligatorio",
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }
    try {
      setSavingPrefix(true);
      await createCodePrefix({ categoryId: formData.category, prefix: clean });
      setShowCreatePrefix(false);
      // Recargar preview: ahora la categoría ya tiene prefijo.
      await loadCodePreview(formData.category);
      Swal.fire({
        icon: "success",
        title: "Prefijo creado",
        text: "El código se generará automáticamente al guardar.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: err?.response?.data?.error || "No se pudo crear el prefijo",
        timer: 3000,
        showConfirmButton: false,
      });
    } finally {
      setSavingPrefix(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Foco inicial en el campo Código (índice 1). La Categoría ahora es un
      // selector custom (CategorySelect), no un input con ref.
      const firstEl = inputRefs.current[1];
      firstEl?.focus();
      if (firstEl && "select" in firstEl && typeof firstEl.select === "function") {
        firstEl.select();
      }

      if (product) {
        setFormData({
          id: product.id,
          code: product.code?.trim() || '',
          name: product.name.trim(),
          status: product.status,
          saleType: product.saleType,
          price: product.price,
          cost: product.cost,
          icon: product.icon,
          description: product?.description || "",
          category: product.category?.id || "",
        });
        setSaleType(product.saleType)
        setStatus(product.status)
        setUnitId(product.unitId ? String(product.unitId) : "")
        // Cargar modo de precio y tramos
        setPricingMode(product.pricingMode === "tiered" ? "tiered" : "simple")
        setPriceTiers(
          product.priceTiers && product.priceTiers.length > 0
            ? product.priceTiers.map((t) => ({
                minQty: t.minQty,
                maxQty: t.maxQty,
                unitPrice: t.unitPrice,
              }))
            : []
        )
        // Cargar promoción
        setIsPromo(!!product.isPromo)
        setPromoPrice(product.promoPrice ?? 0)
        // Mostrar la fecha en HORA LOCAL (no UTC) para que no se corra un día.
        setPromoEndsAt(
          product.promoEndsAt
            ? (() => {
                const d = new Date(product.promoEndsAt as string);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                return `${y}-${m}-${day}`;
              })()
            : ""
        )
        
        // Cargar configuración de inventario
        setTrackInventory(product.inventory?.trackInventory || false);
        setInitialStock(product.inventory?.currentStock || 0);
        setMinStock(product.inventory?.minStock || 0);
        
        // Cargar presentaciones si existen, sino crear la presentación base
        if (product.presentations && product.presentations.length > 0) {
          setPresentations(product.presentations);
        } else {
          // Crear presentación base (1 pieza) si no hay presentaciones
          setPresentations([{
            name: "Pieza",
            quantity: 1,
            unitPrice: product.price,
            isDefault: true,
          }]);
        }
      } else {
        setFormData({
          id: 0,
          code: "",
          name: "",
          status: 1,
          price: 0,
          saleType: "Pieza",
          cost: 0,
          icon: "",
          description: "",
          category: "",
        });
        setStatus(1);
        setSaleType("Pieza");
        setUnitId("");
        setPricingMode("simple");
        setPriceTiers([]);
        setIsPromo(false);
        setPromoPrice(0);
        setPromoEndsAt("");
        
        // Inicializar inventario
        setTrackInventory(false);
        setInitialStock(0);
        setMinStock(0);
        
        // Inicializar con presentación base
        setPresentations([{
          name: "Pieza",
          quantity: 1,
          unitPrice: 0,
          isDefault: true,
        }]);
      }
      setErrors({});
      setPresentationErrors({});
      setEditingPresentationIndex(null);
      setNewPresentation({
        name: "",
        quantity: 1,
        unitPrice: 0,
      });
      // Reset del estado de código automático (el efecto de categoría lo recalcula).
      setAutoCode(false);
      setCodePreview(null);
      setShowCreatePrefix(false);
      setPrefixInput("");
    }
  }, [isOpen, product]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // 👇 Mover foco al siguiente input al presionar Enter y seleccionar valor
  const handleEnterFocusNext = (index: number) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        // Solo los <input> tienen .select(); los <select> no.
        if ("select" in nextInput && typeof (nextInput as any).select === "function") {
          (nextInput as any).select();
        }
      }
    }
  };

  const validatePresentation = (presentation: Omit<ProductPresentation, 'isDefault'>, index?: number): boolean => {
    const presErrors: Record<string, string> = {};
    
    if (!presentation.name.trim()) {
      presErrors.name = "El nombre es requerido";
    }
    if (!presentation.quantity || Number(presentation.quantity) <= 0) {
      presErrors.quantity = "La cantidad debe ser mayor a 0";
    }
    if (!presentation.unitPrice || Number(presentation.unitPrice) <= 0) {
      presErrors.unitPrice = "El precio unitario debe ser mayor a 0";
    }
    
    // Validar nombres duplicados
    const duplicateName = presentations.some((p, i) => 
      p.name.toLowerCase() === presentation.name.toLowerCase().trim() && 
      i !== index &&
      i !== editingPresentationIndex
    );
    if (duplicateName) {
      presErrors.name = "Ya existe una presentación con este nombre";
    }
    
    if (index !== undefined || editingPresentationIndex !== null) {
      const idx = index !== undefined ? index : editingPresentationIndex!;
      if (Object.keys(presErrors).length > 0) {
        setPresentationErrors(prev => ({ ...prev, [idx]: presErrors }));
      } else {
        setPresentationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[idx];
          return newErrors;
        });
      }
    }
    
    return Object.keys(presErrors).length === 0;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // En modo automático el código lo genera el backend, no se exige aquí.
    if (!(autoCode && isNewProduct) && !formData.code.trim())
      newErrors.code = "Codigo es requerido";

    // Precio Abierto: solo se exigen nombre y categoría. El precio y el costo
    // no viven en el catálogo (se capturan en la venta), por lo que NO se
    // exige price>0 ni cost>0, y se omiten las validaciones de presentaciones,
    // tramos, promoción e inventario (Req 1.5, 1.6).
    if (isOpenPrice) {
      if (
        !validateOpenPriceProduct({
          name: formData.name,
          categoryId: formData.category,
        })
      ) {
        if (!formData.name.trim()) newErrors.name = "El nombre es requerido";
        if (!formData.category.trim())
          newErrors.category = "La categoria es requerida";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    if (!formData.name.trim()) newErrors.name = "El nombre es requerido";
    
    if (pricingMode === "tiered") {
      // Modo escalonado: validar tramos (arrancan en 1, continuos, precios > 0).
      const tierError = validateTiers(priceTiers);
      if (tierError) newErrors.price = tierError;
    } else {
      // Modo simple: validar que haya al menos una presentación válida.
      if (presentations.length === 0) {
        newErrors.presentations = "Debe tener al menos una presentación";
      } else {
        const defaultPresentation = presentations.find(p => p.isDefault || p.quantity === 1);
        if (!defaultPresentation || !defaultPresentation.unitPrice || defaultPresentation.unitPrice <= 0) {
          newErrors.price = "El precio base (1 pieza) debe ser mayor a 0";
        }
      }
    }
    
    // Validar promoción: precio promo > 0 y menor al precio real.
    if (isPromo) {
      const base = presentations.find((p) => p.isDefault || p.quantity === 1);
      const realPrice = base ? base.unitPrice : Number(formData.price);
      if (!promoPrice || Number(promoPrice) <= 0) {
        newErrors.promoPrice = "El precio de promoción debe ser mayor a 0.";
      } else if (realPrice > 0 && Number(promoPrice) >= realPrice) {
        newErrors.promoPrice = "El precio de promoción debe ser MENOR al precio real.";
      }
    }

    if (!formData.category.trim())
      newErrors.category = "La categoria es requerida";
    if (!formData.cost || Number(formData.cost) < 0)
      newErrors.cost = "El costo debe ser 0 o mayor";

    // Validar campos de inventario si está activado
    if (trackInventory) {
      if (initialStock < 0) {
        newErrors.initialStock = "El stock inicial no puede ser negativo";
      }
      if (minStock < 0) {
        newErrors.minStock = "El stock mínimo no puede ser negativo";
      }
    }

    // En modo tiered no se validan presentaciones.
    const allPresentationsValid =
      pricingMode === "tiered"
        ? true
        : presentations.every((p, index) => validatePresentation(p, index));

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && allPresentationsValid;
  };

  // Valida los tramos escalonados en el front (espejo del backend).
  // Devuelve un mensaje de error o null si están OK.
  const validateTiers = (tiers: ProductPriceTier[]): string | null => {
    if (tiers.length === 0) return "Agrega al menos un tramo de precio.";
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    if (sorted[0].minQty !== 1) return "El primer tramo debe iniciar en 1.";
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const isLast = i === sorted.length - 1;
      if (!t.unitPrice || t.unitPrice <= 0) return "El precio de cada tramo debe ser mayor a 0.";
      if (!isLast) {
        if (t.maxQty === null) return "Solo el último tramo puede ser 'en adelante'.";
        if (t.maxQty < t.minQty) return "El máximo no puede ser menor al mínimo.";
        if (sorted[i + 1].minQty !== t.maxQty + 1)
          return `Los tramos deben ser continuos: después de ${t.maxQty} sigue ${t.maxQty + 1}.`;
      }
    }
    return null;
  };

  // Agregar un tramo nuevo. El minQty se calcula automático (continuo).
  const handleAddTier = () => {
    setPriceTiers((prev) => {
      if (prev.length === 0) {
        return [{ minQty: 1, maxQty: 10, unitPrice: 0 }];
      }
      const last = prev[prev.length - 1];
      // El tramo anterior deja de ser "en adelante": le ponemos un max si era null.
      const prevMax = last.maxQty ?? last.minQty + 9;
      const updated = prev.map((t, i) =>
        i === prev.length - 1 ? { ...t, maxQty: prevMax } : t
      );
      return [...updated, { minQty: prevMax + 1, maxQty: null, unitPrice: 0 }];
    });
  };

  const handleTierChange = (index: number, field: keyof ProductPriceTier, value: string) => {
    setPriceTiers((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        if (field === "maxQty") {
          return { ...t, maxQty: value === "" ? null : Number(value) };
        }
        return { ...t, [field]: Number(value) } as ProductPriceTier;
      })
    );
  };

  const handleRemoveTier = (index: number) => {
    setPriceTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      // Obtener el precio base de la presentación por defecto
      const defaultPresentation = presentations.find(p => p.isDefault || p.quantity === 1);
      const basePrice = defaultPresentation?.unitPrice || Number(formData.price);

      // La presentación base toma el nombre de la unidad de medida seleccionada
      // (ej: "Kilogramo"). Si no hay unidad, queda "Pieza".
      const selectedUnitName = units.find((u) => String(u.id) === unitId)?.name || "Pieza";
      const presentationsToSave = presentations.map((p) =>
        (p.isDefault || p.quantity === 1) ? { ...p, name: selectedUnitName } : p
      );

      // Campos de identidad comunes a cualquier tipo de producto.
      const code = autoCode && isNewProduct ? "" : formData.code.trim();
      const selectedCategory = categories.find(
        (cat) => cat.id === formData.category
      );

      let productToSave: Omit<Product, "createdAt">;

      if (isOpenPrice) {
        // Precio Abierto: normalizar con buildOpenPriceProduct para persistir
        // price=0, cost=0, saleType="PrecioAbierto", pricingMode="simple",
        // priceTiers=[], isPromo=false, promoPrice=0, presentations=undefined y
        // trackInventory=false, conservando la identidad del producto
        // (Req 1.4, 2.5).
        productToSave = buildOpenPriceProduct({
          id: formData.id,
          code,
          name: formData.name.trim(),
          status,
          icon: "",
          description: formData.description.trim(),
          categoryId: formData.category,
          category: selectedCategory,
          unitId: unitId ? Number(unitId) : null,
          promoEndsAt: null,
          inventory: undefined,
        }) as Omit<Product, "createdAt">;
      } else {
        productToSave = {
          id: formData.id,
          // En modo automático (producto nuevo con prefijo) se manda vacío:
          // el backend genera el código y reserva el consecutivo al guardar.
          code,
          name: formData.name.trim(),
          status: status,
          saleType: saleType,
          price: basePrice, // Precio base para compatibilidad
          cost: Number(formData.cost),
          icon: '',
          description: formData.description.trim(),
          categoryId: formData.category,
          category: selectedCategory,
          unitId: unitId ? Number(unitId) : null, // Unidad de medida opcional
          pricingMode,
          priceTiers: pricingMode === "tiered" ? priceTiers : [],
          isPromo,
          promoPrice: isPromo ? Number(promoPrice) : null,
          // La promo vale hasta el FIN del día elegido (23:59:59), no la medianoche
          // del inicio, para que "válida hasta el 30" incluya todo el día 30.
          promoEndsAt:
            isPromo && promoEndsAt
              ? (() => {
                  const [y, m, d] = promoEndsAt.split("-").map(Number);
                  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
                })()
              : null,
          // En modo tiered no se usan presentaciones.
          presentations:
            pricingMode === "tiered"
              ? undefined
              : presentationsToSave.length > 1
              ? presentationsToSave
              : undefined,
          inventory: trackInventory ? {
            id: 0,
            productId: formData.id,
            trackInventory: trackInventory,
            currentStock: initialStock,
            minStock: minStock,
          } : undefined,
          trackInventory: trackInventory
        };
      }
      
      // Guardar el producto (esperar a que termine)
      try {
        await onSave(productToSave);
        
        // Si es un nuevo producto (no tiene id o id es 0), preguntar si quiere agregar otro
        const isNewProduct = !product || product.id === 0;
        
        if (isNewProduct) {
          const result = await Swal.fire({
            icon: "success",
            title: "¡Producto creado!",
            text: `${productToSave.name} ha sido creado correctamente.`,
            showCancelButton: true,
            confirmButtonText: "Agregar otro",
            cancelButtonText: "Cerrar",
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#6b7280",
          });
          
          if (result.isConfirmed) {
            // Limpiar formulario para agregar otro producto
            setFormData({
              id: 0,
              code: "",
              name: "",
              status: 1,
              price: 0,
              saleType: "Pieza",
              cost: 0,
              icon: "",
              description: "",
              category: "",
            });
            setStatus(1);
            setSaleType("Pieza");
            setUnitId("");
            setPricingMode("simple");
            setPriceTiers([]);
            setIsPromo(false);
            setPromoPrice(0);
            setPromoEndsAt("");
            setTrackInventory(false);
            setInitialStock(0);
            setMinStock(0);
            setPresentations([{
              name: "Pieza",
              quantity: 1,
              unitPrice: 0,
              isDefault: true,
            }]);
            setErrors({});
            setPresentationErrors({});
            setEditingPresentationIndex(null);
            setNewPresentation({
              name: "",
              quantity: 1,
              unitPrice: 0,
            });
            // Reset del código automático para el siguiente producto.
            setAutoCode(false);
            setCodePreview(null);
            setActiveTab("producto");
            
            // Enfocar el primer input
            setTimeout(() => {
              const firstEl = inputRefs.current[1];
              firstEl?.focus();
              if (firstEl && "select" in firstEl && typeof firstEl.select === "function") {
                firstEl.select();
              }
            }, 100);
          } else {
            // Cerrar el modal
            onClose();
          }
        } else {
          // Si es edición, cerrar el modal directamente
          onClose();
        }
      } catch (error) {
        // El error ya se maneja en CatalogPage.handleSave
        console.error("Error al guardar producto:", error);
      }
    }
  };

  // Funciones para gestionar presentaciones
  const validateNewPresentation = (): boolean => {
    const presErrors: Record<string, string> = {};
    
    if (!newPresentation.name.trim()) {
      presErrors.name = "El nombre es requerido";
    }
    if (!newPresentation.quantity || Number(newPresentation.quantity) <= 0) {
      presErrors.quantity = "La cantidad debe ser mayor a 0";
    }
    if (!newPresentation.unitPrice || Number(newPresentation.unitPrice) <= 0) {
      presErrors.unitPrice = "El precio unitario debe ser mayor a 0";
    }
    
    // Validar nombres duplicados
    const duplicateName = presentations.some((p) => 
      p.name.toLowerCase() === newPresentation.name.toLowerCase().trim()
    );
    if (duplicateName) {
      presErrors.name = "Ya existe una presentación con este nombre";
    }
    
    if (Object.keys(presErrors).length > 0) {
      // Usar un índice temporal para mostrar errores
      setPresentationErrors(prev => ({ ...prev, [-1]: presErrors }));
      return false;
    } else {
      setPresentationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[-1];
        return newErrors;
      });
      return true;
    }
  };

  const handleAddPresentation = () => {
    if (validateNewPresentation()) {
      setPresentations(prev => [...prev, {
        ...newPresentation,
        name: newPresentation.name.trim(),
        quantity: Number(newPresentation.quantity),
        unitPrice: Number(newPresentation.unitPrice),
      }]);
      setNewPresentation({
        name: "",
        quantity: 1,
        unitPrice: 0,
      });
      setPresentationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[-1];
        return newErrors;
      });
    }
  };

  const handleEditPresentation = (index: number) => {
    setEditingPresentationIndex(index);
    setNewPresentation({
      name: presentations[index].name,
      quantity: presentations[index].quantity,
      unitPrice: presentations[index].unitPrice,
    });
  };

  const handleUpdatePresentation = () => {
    if (editingPresentationIndex === null) return;
    
    if (validatePresentation(newPresentation, editingPresentationIndex)) {
      const updated = [...presentations];
      updated[editingPresentationIndex] = {
        ...updated[editingPresentationIndex],
        name: newPresentation.name.trim(),
        quantity: Number(newPresentation.quantity),
        unitPrice: Number(newPresentation.unitPrice),
      };
      setPresentations(updated);
      setEditingPresentationIndex(null);
      setNewPresentation({
        name: "",
        quantity: 1,
        unitPrice: 0,
      });
      setPresentationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[editingPresentationIndex];
        return newErrors;
      });
    }
  };

  const handleDeletePresentation = (index: number) => {
    const presentation = presentations[index];
    // No permitir eliminar la presentación base (1 pieza)
    if (presentation.isDefault || presentation.quantity === 1) {
      return;
    }
    
    setPresentations(prev => prev.filter((_, i) => i !== index));
    setPresentationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      // Reindexar errores
      const reindexed: Record<number, Record<string, string>> = {};
      Object.keys(newErrors).forEach(key => {
        const keyNum = Number(key);
        if (keyNum > index) {
          reindexed[keyNum - 1] = newErrors[keyNum];
        } else if (keyNum < index) {
          reindexed[keyNum] = newErrors[keyNum];
        }
      });
      return reindexed;
    });
  };

  const handleCancelEditPresentation = () => {
    setEditingPresentationIndex(null);
    setNewPresentation({
      name: "",
      quantity: 1,
      unitPrice: 0,
    });
    setPresentationErrors(prev => {
      const newErrors = { ...prev };
      if (editingPresentationIndex !== null) {
        delete newErrors[editingPresentationIndex];
      }
      return newErrors;
    });
  };

  const calculateTotalPrice = (presentation: ProductPresentation): number => {
    return presentation.quantity * presentation.unitPrice;
  };
  
  const handleGenerateLabel = (cantidad: number) => {
      if (!product) return;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "cm",
        format: "a4",
      });

      // 🔹 Tamaño de cada etiqueta
      const labelWidth = 4.2;
      const labelHeight = 2.2;

      // 🔹 Márgenes entre etiquetas
      const marginX = 0 //0.5;
      const marginY = 0 //0.5;

      // 🔹 Número de etiquetas por fila y columna
      const pageWidth = 21; // A4 ancho (cm)
      const pageHeight = 29.7; // A4 alto (cm)
      //const _labelsPerRow = Math.floor(pageWidth / (labelWidth + marginX));
      //const _labelsPerCol = Math.floor(pageHeight / (labelHeight + marginY));

      let x = marginX;
      let y = marginY;

      // 🔹 Generar imagen del código de barras
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, product.code || "000000", {
        format: "CODE128",
        displayValue: false,
        width: 1,
        height: 25,
        margin: 0,
      });
      const barcodeImg = canvas.toDataURL("image/png");

      // 🔹 Calcular cuántas etiquetas caben por hoja
      //const totalLabelsPerPage = labelsPerRow * labelsPerCol;
      const totalLabelsPerPage = cantidad;
      for (let i = 0; i < totalLabelsPerPage; i++) {
        doc.setLineWidth(0.05);
        // Dibuja el contorno de la etiqueta (opcional)
        doc.rect(x, y, labelWidth, labelHeight);

        // Dibuja el código de barras
        doc.addImage(barcodeImg, "PNG", x + 0.2, y + 0.2, labelWidth - 0.4, 0.8);

        // Agrega el código numérico
        doc.setFontSize(6);
        doc.text(product.code?.toString() || '', x + labelWidth / 2, y + 1.2, { align: "center" });

        // Agrega el nombre del producto
        doc.setFontSize(7);
        const name = product.name.length > 25 ? product.name.slice(0, 25) + "..." : product.name;
        doc.text(name, x + labelWidth / 2, y + 1.6, { align: "center" });

        // Agrega el precio
        doc.setFontSize(10);
        doc.text(`$${product.price.toFixed(2)}`, x + labelWidth / 2, y + 1.9, { align: "center" });

        // Mueve coordenadas a la siguiente etiqueta
        x += labelWidth + marginX;
        if (x + labelWidth > pageWidth) {
          x = marginX;
          y += labelHeight + marginY;
        }

        // Si se termina la hoja
        if (y + labelHeight > pageHeight && i < totalLabelsPerPage - 1) {
          doc.addPage();
          x = marginX;
          y = marginY;
        }
      }

      doc.save(`etiquetas-${product.code}.pdf`);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="product-modal-overlay">
      <div className="product-modal-container">
        <Card className="product-modal-card">
          {/*<div className="modal-header">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>*/}
          <div className="product-modal-tab-header">
            <button
              type="button"
              className={`product-modal-tab-btn ${activeTab === "producto" ? "active" : ""}`}
              onClick={() => setActiveTab("producto")}
            >
              {title}
            </button>
             {product && (<button
              type="button"
              className={`product-modal-tab-btn ${activeTab === "avanzado" ? "active" : ""}`}
              onClick={() => setActiveTab("avanzado")}
            >
              Avanzado
            </button>)}
          </div>
           {activeTab === "producto" && (
            <div className="product-modal-tab-content">
              <form onSubmit={handleSubmit} className="product-modal-form">
                {/* Layout en dos columnas */}
                <div className="product-modal-form-grid">
                  {/* Columna izquierda - Información del Producto */}
                  <div className="product-modal-form-left">
                    {/* Categoría primero: define el prefijo de código disponible */}
                    <div className="product-modal-form-group">
                      <label htmlFor="category">Categoría *</label>
                      <CategorySelect
                        categories={categories}
                        value={formData.category}
                        onChange={(id) =>
                          handleInputChange({
                            target: { name: "category", value: id },
                          } as React.ChangeEvent<HTMLSelectElement>)
                        }
                        allLabel={null}
                        placeholder="Selecciona una categoría"
                        error={!!errors.category}
                      />
                      {errors.category && (
                        <span className="product-modal-error-message">{errors.category}</span>
                      )}
                    </div>

                    <div className="product-modal-form-group">
                      <label htmlFor="code">
                        Codigo del Producto *
                        <button
                          type="button"
                          className="phelp-trigger"
                          onClick={() => setHelpTopic("code")}
                          title="¿Cómo crear un buen código?"
                          aria-label="Ayuda: cómo crear el código del producto"
                        >
                          ?
                        </button>
                      </label>

                      <div className="pcode-row">
                        <input
                          ref={(el) => (inputRefs.current[1] = el as any)}
                          type="text"
                          id="code"
                          name="code"
                          value={formData.code}
                          onChange={handleInputChange}
                          onKeyDown={handleEnterFocusNext(1)}
                          className={`pcode-input ${errors.code ? "error" : ""} ${
                            autoCode && isNewProduct ? "pcode-input--auto" : ""
                          }`}
                          placeholder="Ej: 232323"
                          readOnly={autoCode && isNewProduct}
                        />
                        {isNewProduct && codePreview?.hasPrefix && (
                          <button
                            type="button"
                            className={`pcode-toggle ${autoCode ? "pcode-toggle--on" : ""}`}
                            onClick={handleToggleAutoCode}
                            title={
                              autoCode
                                ? "Código automático activado. Toca para escribir/escanear."
                                : "Generar código automático con el prefijo de la categoría"
                            }
                          >
                            {autoCode ? "🔒 Auto" : "🏷️ Generar"}
                          </button>
                        )}
                      </div>

                      {/* Estado del código automático */}
                      {isNewProduct && loadingPreview && (
                        <span className="pcode-hint">Buscando prefijo de la categoría…</span>
                      )}

                      {/* Auto activado: se generará al guardar */}
                      {isNewProduct && !loadingPreview && autoCode && codePreview?.code && (
                        <span className="pcode-hint pcode-hint--ok">
                          Se generará automático al guardar (aprox. {codePreview.code}). Si el producto
                          tiene código de barras, toca “🏷️ Auto” para escribirlo.
                        </span>
                      )}

                      {/* Hay prefijo pero auto NO está activo: escribir/escanear o usar auto */}
                      {isNewProduct &&
                        !loadingPreview &&
                        !autoCode &&
                        codePreview?.hasPrefix && (
                          <span className="pcode-hint">
                            Escanea o escribe el código de barras. ¿Sin código? Usa “🏷️ Auto” para
                            generarlo con el prefijo de la categoría.
                          </span>
                        )}

                      {/* Sin prefijo en la categoría */}
                      {isNewProduct &&
                        !loadingPreview &&
                        formData.category &&
                        codePreview &&
                        !codePreview.hasPrefix && (
                          <span className="pcode-hint pcode-hint--warn">
                            Escanea o escribe el código. Si estos productos no traen código,{" "}
                            <button
                              type="button"
                              className="pcode-link"
                              onClick={handleOpenCreatePrefix}
                            >
                              crea un prefijo
                            </button>{" "}
                            para generarlo automático.
                          </span>
                        )}

                      {errors.code && (
                        <span className="product-modal-error-message">{errors.code}</span>
                      )}
                    </div>

                    <div className="product-modal-form-group">
                      <label htmlFor="name">
                        Nombre del Producto *
                        <button
                          type="button"
                          className="phelp-trigger"
                          onClick={() => setHelpTopic("name")}
                          title="¿Cómo crear un buen nombre?"
                          aria-label="Ayuda: cómo crear el nombre del producto"
                        >
                          ?
                        </button>
                      </label>
                      <input
                        ref={(el) => (inputRefs.current[2] = el as any)}
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        onKeyDown={handleEnterFocusNext(2)}
                        className={errors.name ? "error" : ""}
                        placeholder="Ej: Manzanas rojas"
                      />
                      {errors.name && (
                        <span className="product-modal-error-message">{errors.name}</span>
                      )}
                    </div>

                    <div className="product-modal-form-row">
                      <div className="product-modal-form-group">
                        <label htmlFor="status" className="product-modal-checkbox-group">
                          <input
                            type="checkbox"
                            id="status"
                            name="status"
                            checked={status === 1}
                            onChange={() => setStatus(status === 1 ? 0 : 1)}
                          />
                          <span>Activo *</span>
                        </label>
                      </div>
                      <div className="product-modal-form-group">
                        <label> Se vende </label>
                        <div className="product-modal-radio-group">
                          <label>
                            <input
                              type="radio"
                              name="saleType"
                              value="Pieza"
                              checked={saleType === "Pieza"}
                              onChange={(e) => handleSaleTypeChange(e.target.value)}
                            />
                            Por pieza
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="saleType"
                              value="Granel"
                              checked={saleType === "Granel"}
                              onChange={(e) => handleSaleTypeChange(e.target.value)}
                            />
                            A granel
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="saleType"
                              value={OPEN_PRICE_SALE_TYPE}
                              checked={isOpenPrice}
                              onChange={(e) => handleSaleTypeChange(e.target.value)}
                            />
                            Precio Abierto
                          </label>
                        </div>
                      </div>
                    </div>
                    {isOpenPrice ? (
                      /* Precio Abierto: el precio y el costo no se definen en el
                         catálogo, se capturan al momento de la venta. */
                      <div className="product-modal-form-group">
                        <p className="product-modal-open-price-legend">
                          El precio se definirá al momento de la venta
                        </p>
                      </div>
                    ) : (
                    <div className="product-modal-form-row-3">
                      <div className="product-modal-form-group">
                        <label htmlFor="price">
                          Precio Base (1{" "}
                          {units.find((u) => String(u.id) === unitId)?.name || "Pieza"}) *
                        </label>
                        <input
                          ref={(el) => (inputRefs.current[3] = el as any)}
                          type="number"
                          id="price"
                          name="price"
                          value={(() => {
                            const basePresentation = presentations.find(p => p.isDefault || p.quantity === 1);
                            return basePresentation ? basePresentation.unitPrice : formData.price;
                          })()}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : Number(e.target.value);
                            const newPrice = isNaN(value) ? 0 : value;
                            setFormData(prev => ({ ...prev, price: newPrice }));
                            // Actualizar la presentación base
                            setPresentations(prev => prev.map(p => 
                              (p.isDefault || p.quantity === 1) 
                                ? { ...p, unitPrice: newPrice }
                                : p
                            ));
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={handleEnterFocusNext(3)}
                          className={errors.price ? "error" : ""}
                          placeholder="0"
                          step="0.01"
                          min="0"
                        />
                        {errors.price && (
                          <span className="product-modal-error-message">{errors.price}</span>
                        )}
                      </div>

                      <div className="product-modal-form-group">
                        <label htmlFor="cost">Costo *</label>
                        <input
                          ref={(el) => (inputRefs.current[4] = el as any)}
                          type="number"
                          id="cost"
                          name="cost"
                          value={formData.cost}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : Number(e.target.value);
                            setFormData(prev => ({ 
                              ...prev, 
                              cost: isNaN(value) ? 0 : value 
                            }));
                            if (errors.cost) {
                              setErrors((prev) => ({
                                ...prev,
                                cost: "",
                              }));
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={handleEnterFocusNext(4)}
                          className={errors.cost ? "error" : ""}
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                        {errors.cost && (
                          <span className="product-modal-error-message">{errors.cost}</span>
                        )}
                      </div>
                      <div className="product-modal-form-group">
                        <label htmlFor="unit">Unidad de medida</label>
                        <select
                          id="unit"
                          name="unit"
                          value={unitId}
                          onChange={(e) => setUnitId(e.target.value)}
                        >
                          <option value="">Sin unidad</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.abbreviation})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    )}

                    {/* Promoción: no aplica a Precio Abierto */}
                    {!isOpenPrice && (
                    <div className="promo-box">
                      <label className="promo-toggle">
                        <input
                          type="checkbox"
                          checked={isPromo}
                          onChange={() => setIsPromo(!isPromo)}
                        />
                        <span>🎁 Producto en promoción</span>
                      </label>

                      {isPromo && (
                        <div className="promo-fields">
                          <div className="promo-field">
                            <label htmlFor="promoPrice">Precio de promoción *</label>
                            <input
                              id="promoPrice"
                              type="number"
                              min="0"
                              step="0.01"
                              value={promoPrice}
                              onChange={(e) => setPromoPrice(Number(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              className={errors.promoPrice ? "error" : ""}
                              placeholder="0"
                            />
                          </div>
                          <div className="promo-field">
                            <label htmlFor="promoEndsAt">Válida hasta (opcional)</label>
                            <input
                              id="promoEndsAt"
                              type="date"
                              value={promoEndsAt}
                              onChange={(e) => setPromoEndsAt(e.target.value)}
                            />
                          </div>
                          {errors.promoPrice && (
                            <span className="product-modal-error-message">{errors.promoPrice}</span>
                          )}
                          {(() => {
                            const base = presentations.find((p) => p.isDefault || p.quantity === 1);
                            const realPrice = base ? base.unitPrice : Number(formData.price);
                            const ahorro = realPrice - Number(promoPrice);
                            if (promoPrice > 0 && ahorro > 0) {
                              const pct = Math.round((ahorro / realPrice) * 100);
                              return (
                                <div className="promo-save">
                                  Ahorro: ${ahorro.toFixed(2)} ({pct}% menos)
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                    )}
                  </div>

                  {/* Columna derecha - Modo de precio (presentaciones / tiered).
                      No aplica a Precio Abierto: el precio se captura en la venta. */}
                  {!isOpenPrice && (
                  <div className="product-modal-form-right">
                    {/* Selector de modo: presentaciones (simple) o precio escalonado (tiered) */}
                    <div className="ptier-mode">
                      <button
                        type="button"
                        className={`ptier-mode-btn ${pricingMode === "simple" ? "ptier-mode-btn--on" : ""}`}
                        onClick={() => setPricingMode("simple")}
                      >
                        📦 Presentaciones
                      </button>
                      <button
                        type="button"
                        className={`ptier-mode-btn ${pricingMode === "tiered" ? "ptier-mode-btn--on" : ""}`}
                        onClick={() => setPricingMode("tiered")}
                      >
                        🔢 Precio por cantidad
                      </button>
                    </div>

                    {pricingMode === "tiered" ? (
                      /* ── Precio escalonado (tiered) ── */
                      <div className="product-modal-form-group">
                        <label>Precio por cantidad (escalonado)</label>
                        <p className="ptier-hint">
                          Toda la cantidad se cobra al precio del tramo donde cae.
                          Ej: 15 piezas en el tramo 11–20 se cobran a ese precio.
                        </p>
                        <div className="ptier-table">
                          <div className="ptier-row ptier-head">
                            <span>Desde</span>
                            <span>Hasta</span>
                            <span>Precio c/u</span>
                            <span></span>
                          </div>
                          {priceTiers.map((tier, index) => {
                            const isLast = index === priceTiers.length - 1;
                            return (
                              <div key={index} className="ptier-row">
                                <input
                                  type="number"
                                  min="1"
                                  value={tier.minQty}
                                  onChange={(e) => handleTierChange(index, "minQty", e.target.value)}
                                  className="ptier-input"
                                />
                                <input
                                  type="number"
                                  min="1"
                                  value={tier.maxQty ?? ""}
                                  placeholder={isLast ? "∞" : ""}
                                  onChange={(e) => handleTierChange(index, "maxQty", e.target.value)}
                                  className="ptier-input"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={tier.unitPrice}
                                  onChange={(e) => handleTierChange(index, "unitPrice", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className="ptier-input"
                                />
                                <button
                                  type="button"
                                  className="ptier-remove"
                                  onClick={() => handleRemoveTier(index)}
                                  title="Quitar tramo"
                                >
                                  🗑️
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <button type="button" className="ptier-add" onClick={handleAddTier}>
                          + Agregar tramo
                        </button>
                        {errors.price && (
                          <span className="product-modal-error-message">{errors.price}</span>
                        )}
                      </div>
                    ) : (
                    <div className="product-modal-form-group">
                      <label>
                        Presentaciones de Venta *
                        <button
                          type="button"
                          className="phelp-trigger"
                          onClick={() => setHelpTopic("presentation")}
                          title="¿Para qué sirven las presentaciones?"
                          aria-label="Ayuda: presentaciones para venta a mayoreo"
                        >
                          ?
                        </button>
                      </label>
                      <div className="product-modal-presentations-section">
                    <div className="product-modal-presentations-list">
                      {presentations.map((presentation, index) => (
                        <div key={index} className="product-modal-presentation-item">
                          <div className="product-modal-presentation-info">
                            <div className="product-modal-presentation-name">
                              <strong>{presentation.name}</strong>
                              {presentation.isDefault && <span className="product-modal-badge-default">Base</span>}
                            </div>
                            <div className="product-modal-presentation-details">
                              <span>
                                {presentation.quantity}{" "}
                                {units.find((u) => String(u.id) === unitId)?.name
                                  || `unidad${presentation.quantity !== 1 ? "es" : ""}`}
                              </span>
                              <span className="product-modal-separator">•</span>
                              <span>${presentation.unitPrice.toFixed(2)} c/u</span>
                              <span className="product-modal-separator">•</span>
                              <span className="product-modal-total-price">Total: ${calculateTotalPrice(presentation).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="product-modal-presentation-actions">
                            {!(presentation.isDefault /*|| presentation.quantity === 1*/) ? (
                              <>
                                <button
                                  type="button"
                                  className="product-modal-btn-edit"
                                  onClick={() => handleEditPresentation(index)}
                                  disabled={editingPresentationIndex !== null}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="product-modal-btn-delete"
                                  onClick={() => handleDeletePresentation(index)}
                                  disabled={editingPresentationIndex !== null}
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <span className="product-modal-presentation-base-note">Presentación base</span>
                            )}
                          </div>
                          {presentationErrors[index] && (
                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                              {Object.values(presentationErrors[index]).map((error, errIdx) => (
                                <span key={errIdx} className="product-modal-error-message">{error}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Formulario para agregar/editar presentación */}
                    {editingPresentationIndex === null ? (
                      <div className="product-modal-add-presentation-form">
                        <h4>Agregar Nueva Presentación</h4>
                        <div className="product-modal-presentation-form-row">
                          <div className="product-modal-form-group small">
                            <label htmlFor="presentationName">Nombre</label>
                            <input
                              type="text"
                              id="presentationName"
                              value={newPresentation.name}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Ej: Cono, Six, Caja"
                              className={presentationErrors[-1]?.name ? "error" : ""}
                            />
                            {presentationErrors[-1]?.name && (
                              <span className="product-modal-error-message">{presentationErrors[-1].name}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="presentationQuantity">Cantidad</label>
                            <input
                              type="number"
                              id="presentationQuantity"
                              value={newPresentation.quantity}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 1 : Number(e.target.value);
                                setNewPresentation(prev => ({ ...prev, quantity: isNaN(value) ? 1 : value }));
                              }}
                              onFocus={(e) => e.target.select()}
                              min="1"
                              step="1"
                              placeholder="1"
                              className={presentationErrors[-1]?.quantity ? "error" : ""}
                            />
                            {presentationErrors[-1]?.quantity && (
                              <span className="product-modal-error-message">{presentationErrors[-1].quantity}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="presentationUnitPrice">Precio Unitario</label>
                            <input
                              type="number"
                              id="presentationUnitPrice"
                              value={newPresentation.unitPrice}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 0 : Number(e.target.value);
                                setNewPresentation(prev => ({ ...prev, unitPrice: isNaN(value) ? 0 : value }));
                              }}
                              onFocus={(e) => e.target.select()}
                              min="0"
                              step="0.01"
                              placeholder="0"
                              className={presentationErrors[-1]?.unitPrice ? "error" : ""}
                            />
                            {presentationErrors[-1]?.unitPrice && (
                              <span className="product-modal-error-message">{presentationErrors[-1].unitPrice}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label>&nbsp;</label>
                            <Button
                              type="button"
                              variant="primary"
                              onClick={handleAddPresentation}
                              className="add-presentation-btn"
                              title="Agregar presentación"
                              aria-label="Agregar presentación"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        {newPresentation.quantity > 0 && newPresentation.unitPrice > 0 && (
                          <div className="product-modal-presentation-preview">
                            <small>
                              Total de esta presentación: <strong>${calculateTotalPrice(newPresentation as ProductPresentation).toFixed(2)}</strong>
                            </small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="product-modal-add-presentation-form">
                        <h4>Editar Presentación</h4>
                        <div className="product-modal-presentation-form-row">
                          <div className="product-modal-form-group small">
                            <label htmlFor="editPresentationName">Nombre</label>
                            <input
                              type="text"
                              id="editPresentationName"
                              value={newPresentation.name}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, name: e.target.value }))}
                              className={presentationErrors[editingPresentationIndex]?.name ? "error" : ""}
                            />
                            {presentationErrors[editingPresentationIndex]?.name && (
                              <span className="product-modal-error-message">{presentationErrors[editingPresentationIndex].name}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="editPresentationQuantity">Cantidad</label>
                            <input
                              type="number"
                              id="editPresentationQuantity"
                              value={newPresentation.quantity}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 1 : Number(e.target.value);
                                setNewPresentation(prev => ({ ...prev, quantity: isNaN(value) ? 1 : value }));
                              }}
                              onFocus={(e) => e.target.select()}
                              min="1"
                              step="1"
                              placeholder="1"
                              className={presentationErrors[editingPresentationIndex]?.quantity ? "error" : ""}
                            />
                            {presentationErrors[editingPresentationIndex]?.quantity && (
                              <span className="product-modal-error-message">{presentationErrors[editingPresentationIndex].quantity}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="editPresentationUnitPrice">Precio Unitario</label>
                            <input
                              type="number"
                              id="editPresentationUnitPrice"
                              value={newPresentation.unitPrice}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 0 : Number(e.target.value);
                                setNewPresentation(prev => ({ ...prev, unitPrice: isNaN(value) ? 0 : value }));
                              }}
                              onFocus={(e) => e.target.select()}
                              min="0"
                              step="0.01"
                              placeholder="0"
                              className={presentationErrors[editingPresentationIndex]?.unitPrice ? "error" : ""}
                            />
                            {presentationErrors[editingPresentationIndex]?.unitPrice && (
                              <span className="product-modal-error-message">{presentationErrors[editingPresentationIndex].unitPrice}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label>&nbsp;</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button
                                type="button"
                                variant="success"
                                onClick={handleUpdatePresentation}
                                className="update-presentation-btn"
                              >
                                Guardar
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={handleCancelEditPresentation}
                                className="cancel-edit-btn"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
                        {newPresentation.quantity > 0 && newPresentation.unitPrice > 0 && (
                          <div className="product-modal-presentation-preview">
                            <small>
                              Total de esta presentación: <strong>${calculateTotalPrice(newPresentation as ProductPresentation).toFixed(2)}</strong>
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                      </div>
                      {errors.presentations && (
                        <span className="product-modal-error-message">{errors.presentations}</span>
                      )}
                    </div>
                    )}
                  </div>
                  )}
                </div>
                <div className="product-modal-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    className="product-modal-cancel-btn"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="success" className="product-modal-save-btn">
                    {product ? "Actualizar" : "Crear"} Producto
                  </Button>
                </div>
              </form>
            </div>
          )}
         {activeTab === "avanzado" && (
            <div className="product-modal-tab-content">
              <form onSubmit={handleSubmit} className="product-modal-form">
                    {/* Control de inventario: no aplica a Precio Abierto. */}
                    {!isOpenPrice && (
                    <div className="product-modal-inventory-section">
                      <div className="product-modal-inventory-toggle-card">
                        <div className="product-modal-toggle-header">
                          <div className="product-modal-toggle-info">
                            {/* Texto NO clickeable: solo el switch activa/desactiva */}
                            <span className="product-modal-toggle-label">
                              <strong>Activar control de inventario</strong>
                            </span>
                            <p className="product-modal-toggle-description">
                              {trackInventory 
                                ? "El sistema rastreará las entradas y salidas de este producto"
                                : "Sin control de inventario. Se vende sin límite de stock"}
                            </p>
                          </div>
                          <div className="product-modal-toggle-switch">
                            <input
                              type="checkbox"
                              id="inventory"
                              name="inventory"
                              checked={trackInventory}
                              onChange={() => setTrackInventory(!trackInventory)}
                              className="product-modal-switch-input"
                            />
                            <label htmlFor="inventory" className="product-modal-switch-label" aria-label="Activar control de inventario">
                              <span className="product-modal-switch-slider"></span>
                            </label>
                          </div>
                        </div>

                        {trackInventory && (
                          <div className="product-modal-inventory-fields">
                            <div className="product-modal-inventory-fields-grid">
                              <div className="product-modal-form-group">
                                <label htmlFor="initialStock">
                                  Stock Inicial *
                                  <span className="product-modal-field-hint">Cantidad disponible al crear el producto</span>
                                </label>
                                <input
                                  type="number"
                                  id="initialStock"
                                  name="initialStock"
                                  min="0"
                                  step="0.01"
                                  value={initialStock}
                                  onChange={(e) => setInitialStock(Number(e.target.value))}
                                  placeholder="Ej: 100"
                                  className={`product-modal-inventory-input ${errors.initialStock ? "error" : ""}`}
                                />
                                {errors.initialStock && (
                                  <span className="product-modal-error-message">{errors.initialStock}</span>
                                )}
                                <small className="product-modal-field-help">
                                  Establece la cantidad inicial de productos en inventario
                                </small>
                              </div>

                              <div className="product-modal-form-group">
                                <label htmlFor="minStock">
                                  Stock Mínimo *
                                  <span className="product-modal-field-hint">Nivel mínimo antes de alertar</span>
                                </label>
                                <input
                                  type="number"
                                  id="minStock"
                                  name="minStock"
                                  min="0"
                                  step="0.01"
                                  value={minStock}
                                  onChange={(e) => setMinStock(Number(e.target.value))}
                                  placeholder="Ej: 10"
                                  className={`product-modal-inventory-input ${errors.minStock ? "error" : ""}`}
                                />
                                {errors.minStock && (
                                  <span className="product-modal-error-message">{errors.minStock}</span>
                                )}
                                <small className="product-modal-field-help">
                                  Recibirás alertas cuando el stock esté por debajo de este valor
                                </small>
                              </div>
                            </div>

                            {initialStock <= minStock && initialStock > 0 && (
                              <div className="product-modal-preview-warning">
                                ⚠️ El stock inicial está en o por debajo del mínimo
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Sección de Generación de Etiquetas */}
                    <div className="product-modal-label-section">
                      <div className="product-modal-section-header">
                        <h3>🏷️ Generar Etiquetas</h3>
                        <p className="product-modal-section-description">
                          Genera etiquetas con código de barras para este producto
                        </p>
                      </div>
                      <div className="product-modal-label-controls">
                        <div className="product-modal-form-group">
                          <label htmlFor="labelQuantity">Cantidad de etiquetas</label>
                          <input
                            type="number"
                            id="labelQuantity"
                            name="labelQuantity"
                            min="1"
                            value={labelQuantity}
                            onChange={(e) => setLabelQuantity(Number(e.target.value))}
                            placeholder="Ej: 5"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => handleGenerateLabel(labelQuantity)}
                          className="generate-btn"
                        >
                          🖨️ Generar etiquetas PDF
                        </Button>
                      </div>
                    </div>
                <div className="product-modal-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    className="product-modal-cancel-btn"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="success" className="product-modal-save-btn">
                    {product ? "Actualizar" : "Crear"} Producto
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
      </div>

      {/* Modal de ayuda: buenas prácticas para código / nombre */}
      <ProductHelpModal
        isOpen={helpTopic !== null}
        topic={helpTopic ?? "code"}
        onClose={() => setHelpTopic(null)}
      />

      {/* Mini-modal: crear prefijo para la categoría */}
      {showCreatePrefix && (
        <div className="pcode-modal-overlay" onClick={() => setShowCreatePrefix(false)}>
          <div className="pcode-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pcode-modal-title">🏷️ Crear prefijo de código</h3>
            <p className="pcode-modal-desc">
              Este prefijo se usará para generar códigos automáticos de esta categoría
              (ej: {prefixInput.trim().toUpperCase() || "ABA-REF"}-001, -002…). Puedes editarlo.
            </p>
            <label className="pcode-modal-label">Prefijo</label>
            <input
              type="text"
              className="pcode-modal-input"
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value.toUpperCase())}
              placeholder="Ej: ABA-REF"
              autoFocus
            />
            <div className="pcode-modal-actions">
              <button
                type="button"
                className="pcode-modal-btn pcode-modal-btn--cancel"
                onClick={() => setShowCreatePrefix(false)}
                disabled={savingPrefix}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pcode-modal-btn pcode-modal-btn--save"
                onClick={handleSavePrefix}
                disabled={savingPrefix}
              >
                {savingPrefix ? "Guardando…" : "Crear prefijo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewEditProductModal;

