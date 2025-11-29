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
  } catch {
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
  // Información del entorno
  const isElectron = typeof window !== 'undefined' && 
    (window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron === true;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'N/A';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : 'N/A';
  
  console.log("🔍 [loadConfig] Iniciando carga de configuración...");
  console.log("📍 [loadConfig] Entorno:", {
    isElectron,
    currentUrl,
    currentPath,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
  });

  // Detectar si estamos en Electron con protocolo file://
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  
  // Construir rutas basadas en la ubicación actual
  let configPaths: string[] = [];
  
  if (isFileProtocol && typeof window !== 'undefined') {
    // En Electron con file://, necesitamos rutas relativas al directorio actual
    // El currentPath es algo como: "/C:/Users/.../dist/index.html"
    // Necesitamos extraer el directorio: "/C:/Users/.../dist/"
    const pathParts = currentPath.split('/');
    pathParts.pop(); // Eliminar "index.html"
    const currentDir = pathParts.join('/') + '/';
    
    console.log("📂 [loadConfig] Protocolo file:// detectado");
    console.log("📂 [loadConfig] Directorio actual detectado:", currentDir);
    
    // Priorizar rutas relativas para evitar que apunte a C:/config.json
    configPaths = [
      "./config.json",          // Ruta relativa al directorio actual (dist/) - PRIMERA PRIORIDAD
      "config.json",            // Sin punto, también relativa
      currentDir + "config.json", // Ruta explícita relativa
      "/config.json",           // Ruta absoluta (fallback, puede apuntar a C:/) - ÚLTIMA PRIORIDAD
    ];
  } else {
    // En desarrollo o navegador web, usar rutas estándar
    configPaths = [
      "/config.json",           // Ruta estándar (funciona en dev y prod)
      "./config.json",          // Ruta relativa
      "../config.json",         // Ruta relativa alternativa
    ];
  }
  
  console.log("🗺️ [loadConfig] Rutas a intentar (en orden de prioridad):", configPaths);

  // Intentar cargar desde cada ruta posible
  for (const configPath of configPaths) {
    try {
      // Construir URL completa para logging
      let fullUrl = configPath;
      if (typeof window !== 'undefined') {
        try {
          fullUrl = new URL(configPath, window.location.href).href;
        } catch {
          fullUrl = `${window.location.origin}${configPath}`;
        }
      }
      
      console.log(`🔎 [loadConfig] Intentando cargar desde: ${configPath} (URL completa: ${fullUrl})`);
      
      const response = await fetch(configPath, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log(`📊 [loadConfig] Respuesta de ${configPath}:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.ok) {
        const config = await response.json();
        console.log(`✅ [loadConfig] Config cargado exitosamente desde: ${configPath}`);
        console.log(`📄 [loadConfig] URL final del archivo: ${response.url}`);
        console.log(`📋 [loadConfig] Contenido del config:`, JSON.stringify(config, null, 2));
        console.log(`🏢 [loadConfig] Sucursal configurada: "${config.sucursal}"`);
        console.log(`💰 [loadConfig] Caja configurada: "${config.caja}"`);
        console.log(`🌐 [loadConfig] Server URL: "${config.serverUrl || config.apiUrl}"`);
        return config;
      } else {
        console.warn(`⚠️ [loadConfig] Respuesta no OK desde ${configPath}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Continuar con la siguiente ruta
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [loadConfig] Error al cargar desde ${configPath}:`, errorMessage);
      if (error instanceof Error && error.stack) {
        console.warn(`📚 [loadConfig] Stack trace:`, error.stack);
      }
    }
  }

  // Si ninguna ruta funcionó, usar valores por defecto
  console.error("❌ [loadConfig] Error cargando config.json desde todas las rutas. Usando valores por defecto.");
  console.error("🔍 [loadConfig] Rutas intentadas:", configPaths);
  const defaultConfig: Config = {
    mode: "auto",
    apiUrl: "http://127.0.0.1:3001/api",
    sucursal: "DEFAULT",
    caja: "1",
    autoDetect: true,
  };
  console.warn("⚠️ [loadConfig] Usando configuración por defecto:", defaultConfig);
  return defaultConfig;
}

// Función que inicializa y devuelve el cliente Axios
export async function getAxiosClient() {
  if (axiosClient) {
    console.log("♻️ [getAxiosClient] Reutilizando cliente Axios existente");
    return axiosClient; // si ya existe, reutilízalo
  }

  console.log("🚀 [getAxiosClient] Inicializando nuevo cliente Axios...");
  const config = await loadConfig();
  const backendUrl = await determineBackendUrl(config);

  console.log("🔧 [getAxiosClient] Configuración recibida:", {
    mode: config.mode,
    apiUrl: config.apiUrl,
    serverUrl: config.serverUrl,
    sucursal: config.sucursal,
    caja: config.caja,
    autoDetect: config.autoDetect
  });
  console.log("🌐 [getAxiosClient] URL del backend determinada:", backendUrl);

  axiosClient = axios.create({
    baseURL: backendUrl,
    timeout: 30000, // 30 segundos timeout
  });
  
  console.log("💾 [getAxiosClient] Guardando en localStorage:");
  console.log(`   - sucursal: "${config.sucursal}"`);
  console.log(`   - caja: "${config.caja}"`);
  
  localStorage.setItem("sucursal", config.sucursal);
  localStorage.setItem("caja", config.caja);
  
  // Verificar que se guardó correctamente
  const savedSucursal = localStorage.getItem("sucursal");
  const savedCaja = localStorage.getItem("caja");
  console.log("✅ [getAxiosClient] Verificación de localStorage:");
  console.log(`   - sucursal guardada: "${savedSucursal}" (coincide: ${savedSucursal === config.sucursal})`);
  console.log(`   - caja guardada: "${savedCaja}" (coincide: ${savedCaja === config.caja})`);
  
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

  console.log("✅ [getAxiosClient] AxiosClient inicializado con baseURL:", backendUrl);
  console.log("🎉 [getAxiosClient] Cliente Axios listo para usar");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

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
