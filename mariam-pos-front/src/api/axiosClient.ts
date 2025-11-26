import axios from "axios";
import type { Config } from "../types/config";

// Variable global para almacenar el cliente
let axiosClient: ReturnType<typeof axios.create> | null = null;

/**
 * Verifica si el backend está disponible en una URL específica
 */
async function checkBackendAvailability(url: string, timeout: number = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`${url}/health`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    return response.ok || response.status < 500;
  } catch (error) {
    // Si /health no existe, intentar con un endpoint simple
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      await fetch(`${url}/categories`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Determina la URL del backend según el modo de operación
 */
async function determineBackendUrl(config: Config): Promise<string> {
  // Si el modo está explícitamente configurado
  if (config.mode === "server") {
    // Modo servidor: usar localhost
    return config.apiUrl || "http://127.0.0.1:3001/api";
  }
  
  if (config.mode === "client") {
    // Modo cliente: usar la URL del servidor
    return config.serverUrl || config.apiUrl;
  }
  
  // Modo auto: detectar automáticamente
  if (config.autoDetect !== false) {
    // 1. Intentar con localhost primero (modo servidor)
    const localUrl = config.apiUrl || "http://127.0.0.1:3001/api";
    const isLocalAvailable = await checkBackendAvailability(localUrl);
    
    if (isLocalAvailable) {
      console.log("🖥️ Modo SERVIDOR detectado (backend local disponible)");
      return localUrl;
    }
    
    // 2. Si no está disponible localmente, usar la URL del servidor (modo cliente)
    const serverUrl = config.serverUrl || config.apiUrl;
    const isServerAvailable = await checkBackendAvailability(serverUrl);
    
    if (isServerAvailable) {
      console.log("💻 Modo CLIENTE detectado (conectando al servidor remoto)");
      return serverUrl;
    }
    
    // 3. Si ninguna está disponible, usar localhost por defecto (intentará conectarse)
    console.warn("⚠️ No se pudo detectar el backend. Usando configuración por defecto.");
    return localUrl;
  }
  
  // Si autoDetect está desactivado, usar apiUrl
  return config.apiUrl || "http://127.0.0.1:3001/api";
}

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
      mode: "auto",
      apiUrl: "http://127.0.0.1:3001/api",
      sucursal: "DEFAULT",
      caja: "1",
      autoDetect: true,
    };
  }
}

// Función que inicializa y devuelve el cliente Axios
export async function getAxiosClient() {
  if (axiosClient) return axiosClient; // si ya existe, reutilízalo

  const config = await loadConfig();
  const backendUrl = await determineBackendUrl(config);

  axiosClient = axios.create({
    baseURL: backendUrl,
    timeout: 30000, // 30 segundos timeout
  });
  
  localStorage.setItem("sucursal", config.sucursal)
  localStorage.setItem("caja", config.caja)
  
  axiosClient.interceptors.request.use((reqConfig) => {
    const token = localStorage.getItem("token");
    if (token) reqConfig.headers.Authorization = `Bearer ${token}`;
    return reqConfig;
  });

  // Interceptor para manejar errores de conexión
  axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        console.error("❌ Error de conexión al backend:", backendUrl);
        console.error("   Verifica que el servidor esté ejecutándose y la URL sea correcta");
      }
      return Promise.reject(error);
    }
  );

  console.log("✅ AxiosClient inicializado con baseURL:", backendUrl);

  return axiosClient;
}

/**
 * Recarga la configuración y reinicializa el cliente
 * Útil cuando se cambia la configuración en tiempo de ejecución
 */
export async function reloadAxiosClient() {
  axiosClient = null;
  return await getAxiosClient();
}
