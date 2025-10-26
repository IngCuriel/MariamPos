import { useState, useCallback, useEffect } from "react";
import type { Category } from "../types";
import { toast } from 'react-toastify';
import { getCategories, createCategory, updateCategory as putCategory, deleteCategory as removeCategory} from "../api/categories";

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 🟢 Llamada al API cuando el hook se monta
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error(err);
        setError("Error al cargar las categorías");
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // 🔵 Funciones locales (a futuro puedes conectarlas con el backend)
  const addCategory = useCallback( async(category: Omit<Category, "id" | "createdAt">) => {
    const newCategory: Category = {
      ...category,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    const createResponse = await createCategory(newCategory)
    console.log('createResponse', createResponse);
    setCategories((prev) => [...prev, newCategory]);
    toast.success('✅ Categoria Creado correctamente');

    return newCategory;
  }, []);

  const updateCategory = useCallback(async(id: string, updates: Partial<Category>) => {
    try {
      const updateResponse = await putCategory(id, updates)
      console.log('updateResponse', updateResponse);
      setCategories((prev) =>
        prev.map((category) =>
          category.id === id ? { ...category, ...updates } : category
        )
      );
      toast.success('✅ Categoria Actualizado correctamente');
    } catch(e) {
      console.log('Error', e);
    }
  }, []);

  const deleteCategory = useCallback(async(id: string) => {
    try {
    const deleteResponse = await removeCategory(id);
    console.log('deleteResponse', deleteResponse);
    setCategories((prev) => prev.filter((category) => category.id !== id));
     toast.success('✅ Categoria eliminado correctamente');
    } catch(e) {
      console.log('Error', e); 
      toast.error('❌ No es posible eliminar la categoria');
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
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getCategoryNames,
  };
};