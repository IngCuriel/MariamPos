import axios from "axios";
import type { Config } from "../types/config";

// Variable global para almacenar el cliente
let axiosClient: ReturnType<typeof axios.create> | null = null;

// Función para cargar la configuración desde /public/config.json
async function loadConfig(): Promise<Config> {
  try {
    const response = await fetch("/config.json", { cache: "no-store" });
    const config = await response.json();
    return config;
  } catch (error) {
    console.error("❌ Error cargando config.json:", error);
    // Valor por defecto si no existe el archivo o hay error
    return {
      apiUrl: "http://localhost:3001/api",
      sucursal: "DEFAULT",
      caja: "1",
    };
  }
}

// Función que inicializa y devuelve el cliente Axios
export async function getAxiosClient() {
  if (axiosClient) return axiosClient; // si ya existe, reutilízalo

  const config = await loadConfig();

  axiosClient = axios.create({
    baseURL: config.apiUrl,
  });
  
  localStorage.setItem("sucursal", config.sucursal)
  localStorage.setItem("caja", config.caja)
  axiosClient.interceptors.request.use((reqConfig) => {
    const token = localStorage.getItem("token");
    if (token) reqConfig.headers.Authorization = `Bearer ${token}`;
    return reqConfig;
  });

  console.log("✅ AxiosClient inicializado con baseURL:", config.apiUrl);

  return axiosClient;
}
