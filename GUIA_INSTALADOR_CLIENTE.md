# 📦 Guía: Generar Instalador Cliente - MariamPOS

## 🎯 Objetivo

Generar un instalador **solo cliente** (frontend) que se conecte a un servidor remoto, sin incluir el backend.

## 📋 Requisitos Previos

1. ✅ Node.js instalado
2. ✅ Frontend compilado (`mariam-pos-front/dist/`)
3. ✅ Electron Builder instalado globalmente o localmente

## 🚀 Pasos para Generar el Instalador Cliente

### Paso 1: Compilar el Frontend

```bash
cd mariam-pos-front
npm run build
cd ..
```

Asegúrate de que exista `mariam-pos-front/dist/index.html`

### Paso 2: Configurar el Frontend para Modo Cliente

Edita `mariam-pos-front/public/config.json`:

```json
{
  "mode": "client",
  "apiUrl": "http://127.0.0.1:3001/api",
  "serverUrl": "http://192.168.1.100:3001/api",
  "sucursal": "Sucursal Principal",
  "caja": "Caja 1",
  "autoDetect": true
}
```

**Importante**: Reemplaza `192.168.1.100` con la IP real de tu servidor.

### Paso 3: Generar el Instalador

#### Windows:
```cmd
build-client.bat
```

#### Linux/Mac:
```bash
chmod +x build-client.sh
./build-client.sh
```

### Paso 4: Encontrar el Instalador

El instalador se generará en la carpeta `dist_client/`:

- **Windows**: `MariamPOS Cliente Setup 1.0.0.exe`
- **Linux**: `MariamPOS Cliente-1.0.0.AppImage` o `.deb`
- **Mac**: `MariamPOS Cliente-1.0.0.dmg`

## 📱 Instalación en Máquina Cliente

### Para PC (Windows/Linux/Mac)

1. **Copiar el instalador** a la máquina cliente
2. **Ejecutar el instalador** y seguir las instrucciones
3. **Configurar la conexión al servidor**:
   - Opción A: Editar `config.json` manualmente antes de instalar
   - Opción B: Ejecutar `configurar-cliente.bat` después de instalar

### Para Dispositivos Móviles (Tablets)

**Nota**: Electron no genera aplicaciones nativas para móviles. Para tablets, considera:

#### Opción 1: Aplicación Web (Recomendado)
- Compilar el frontend como PWA (Progressive Web App)
- Acceder desde el navegador del tablet
- Agregar a la pantalla de inicio

#### Opción 2: Android (Requiere desarrollo adicional)
- Usar Capacitor o similar para generar APK
- Requiere configuración adicional

#### Opción 3: Windows Tablet
- Usar el instalador Windows normal
- Funciona en tablets con Windows

## 🔧 Configuración Post-Instalación

### Método 1: Script Automático (Recomendado)

1. Después de instalar, navegar a la carpeta de instalación
2. Ejecutar `configurar-cliente.bat` (Windows) o `configurar-cliente.sh` (Linux)
3. Ingresar la IP del servidor cuando se solicite

### Método 2: Manual

1. Navegar a la carpeta de instalación
2. Buscar `resources/mariam-pos-front/dist/config.json`
3. Editar con un editor de texto:
   ```json
   {
     "mode": "client",
     "serverUrl": "http://[IP-DEL-SERVIDOR]:3001/api",
     "sucursal": "Sucursal Principal",
     "caja": "Caja 1"
   }
   ```

## 📊 Comparación: Servidor vs Cliente

| Característica | Servidor | Cliente |
|---------------|----------|---------|
| Backend | ✅ Incluido | ❌ No incluido |
| Frontend | ✅ Incluido | ✅ Incluido |
| Base de Datos | ✅ Local | ❌ No tiene |
| Tamaño | ~150-200 MB | ~50-80 MB |
| Requiere Node.js | ✅ Sí | ❌ No |
| Conexión a Red | Opcional | ✅ Requerida |

## 🎯 Estructura del Instalador Cliente

```
MariamPOS Cliente/
├── resources/
│   └── mariam-pos-front/
│       └── dist/
│           ├── index.html
│           ├── assets/
│           └── config.json  ← Editar aquí
└── MariamPOS Cliente.exe
```

## 🔍 Verificar que Funciona

1. **Iniciar el servidor** en la máquina servidor
2. **Abrir el cliente** en la máquina cliente
3. **Verificar en la consola** (F12):
   - Debe mostrar: `✅ AxiosClient inicializado con baseURL: http://[IP-SERVIDOR]:3001/api`
   - Debe mostrar: `💻 Modo CLIENTE detectado`

## 🚨 Troubleshooting

### Problema: El cliente no se conecta al servidor

1. **Verificar IP del servidor**:
   ```bash
   # En el servidor
   ipconfig  # Windows
   ifconfig  # Linux/Mac
   ```

2. **Verificar que el servidor esté ejecutándose**:
   - Abrir navegador en cliente: `http://[IP-SERVIDOR]:3001/health`
   - Debe responder con `{"status":"ok"}`

3. **Verificar firewall**:
   - Asegurar que el puerto 3001 esté abierto en el servidor

4. **Verificar config.json**:
   - IP correcta
   - Puerto correcto (3001)
   - Modo "client" o "auto"

### Problema: Error al cargar la aplicación

1. Verificar que `mariam-pos-front/dist/index.html` exista
2. Verificar logs en: `%APPDATA%\MariamPOS-Client\mariam-pos-client-log.txt`

### Problema: El instalador es muy grande

- El instalador cliente es más pequeño que el servidor
- Si aún es grande, verificar que no se incluyan archivos innecesarios
- Revisar la configuración de `package-client.json`

## 📝 Notas Importantes

1. **IP Estática**: Recomendado configurar IP estática en el servidor
2. **Misma Red**: Servidor y clientes deben estar en la misma red local
3. **Firewall**: Permitir puerto 3001 en el servidor
4. **Configuración**: Cada cliente puede tener su propia caja y sucursal

## 🔄 Actualizar el Cliente

Para actualizar el cliente:

1. Generar nuevo instalador con `build-client.bat`
2. Distribuir el nuevo instalador
3. Los clientes instalan sobre la versión anterior (mantiene config.json)

## 📞 Soporte

Si tienes problemas:
1. Revisar logs en `%APPDATA%\MariamPOS-Client\mariam-pos-client-log.txt`
2. Verificar configuración de red
3. Verificar que el servidor esté accesible

