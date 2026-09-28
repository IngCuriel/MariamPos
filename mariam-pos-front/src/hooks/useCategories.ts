import { useState, useCallback } from "react";
import type { Category } from "../types";
import { toast } from 'react-toastify';
import { getCategories, createCategory, updateCategory as putCategory, deleteCategory as removeCategory} from "../api/categories";

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  // 🟢 Función para cargar categorías manualmente
  const loadCategories = useCallback(async () => {
    // Si ya están cargadas, no volver a cargar
    if (loaded) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getCategories();
      setCategories(data);
      setLoaded(true);
    } catch (err) {
      console.error(err);
      setError("Error al cargar las categorías");
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  // 🔵 Funciones locales (a futuro puedes conectarlas con el backend)
  const addCategory = useCallback( async(category: Omit<Category, "id" | "createdAt">) => {
    // Usar la categoría real que devuelve el backend (incluye id real y el
    // objeto department con su nombre), no una construida localmente.
    const created = await createCategory(category as Omit<Category, "id">);
    setCategories((prev) => [...prev, created]);
    toast.success('✅ Categoria Creado correctamente');
    return created;
  }, []);

  const updateCategory = useCallback(async(id: string, updates: Partial<Category>) => {
    try {
      // Reemplazar la categoría con la respuesta del backend (trae el objeto
      // department actualizado). Fallback al merge local si no viniera.
      const updated = await putCategory(id, updates);
      setCategories((prev) =>
        prev.map((category) =>
          category.id === id ? (updated ?? { ...category, ...updates }) : category
        )
      );
      toast.success('✅ Categoria Actualizado correctamente');
    } catch(e) {
      console.log('Error', e);
    }
  }, []);

  const deleteCategory = useCallback(async(id: string) => {
    try {
      await removeCategory(id);
      setCategories((prev) => prev.filter((category) => category.id !== id));
      toast.success('✅ Categoria eliminada correctamente');
    } catch (e: unknown) {
      // Mostrar el mensaje real del backend (ej. "tiene N productos asignados").
      const message =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(`❌ ${message || 'No es posible eliminar la categoría'}`);
    }
  }, []);

  const getCategoryById = useCallback(
    (id: string) => categories.find((category) => category.id === id),
    [categories]
  );

  const getCategoryNames = useCallback(
    () => categories.map((category) => category.name),
    [categories]
  );

  return {
    categories,
    loading,
    error,
    loaded,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getCategoryNames,
  };
};