# 🔧 Configuración Cliente-Servidor - MariamPOS

## 📋 Arquitectura

El sistema soporta dos modos de operación:

1. **🖥️ Modo SERVIDOR**: Máquina con backend + frontend (base de datos local)
2. **💻 Modo CLIENTE**: Máquina solo con frontend (se conecta al servidor)

## 🚀 Instalación

### Opción 1: Modo Automático (Recomendado)

El sistema detecta automáticamente si es servidor o cliente:

1. **En el servidor**: Instalar backend + frontend completo
2. **En los clientes**: Instalar solo frontend
3. **Configurar `config.json`** en cada cliente con la IP del servidor

### Opción 2: Modo Manual

Configurar explícitamente el modo en `config.json`.

## 📝 Configuración del Archivo `config.json`

### Para el SERVIDOR (Máquina Principal)

```json
{
  "mode": "server",
  "apiUrl": "http://127.0.0.1:3001/api",
  "sucursal": "Sucursal Principal",
  "caja": "Caja 1",
  "autoDetect": false
}
```

### Para los CLIENTES (PCs/Tablets)

```json
{
  "mode": "client",
  "apiUrl": "http://127.0.0.1:3001/api",
  "serverUrl": "http://192.168.1.100:3001/api",
  "sucursal": "Sucursal Principal",
  "caja": "Caja 2",
  "autoDetect": false
}
```

**Importante**: Reemplazar `192.168.1.100` con la IP real del servidor en tu red.

### Modo Automático (Recomendado)

```json
{
  "mode": "auto",
  "apiUrl": "http://127.0.0.1:3001/api",
  "serverUrl": "http://192.168.1.100:3001/api",
  "sucursal": "Sucursal Principal",
  "caja": "Caja 1",
  "autoDetect": true
}
```

El sistema:
- Intenta conectarse a `apiUrl` (localhost)
- Si no está disponible, usa `serverUrl` (servidor remoto)
- Detecta automáticamente el modo

## 🔍 Cómo Obtener la IP del Servidor

### Windows
```cmd
ipconfig
```
Buscar "Dirección IPv4" (ej: 192.168.1.100)

### Linux/Mac
```bash
ifconfig
# o
ip addr show
```

## 📦 Estructura de Instalación

### Servidor (Máquina Principal)
```
MariamPOS/
├── mariam-pos-backend/     ✅ Backend completo
├── mariam-pos-front/       ✅ Frontend completo
└── database.db             ✅ Base de datos local
```

### Cliente (PCs/Tablets)
```
MariamPOS-Client/
└── mariam-pos-front/       ✅ Solo frontend
    └── public/
        └── config.json     ✅ Configurado con IP del servidor
```

## ⚙️ Configuración de Red

### Requisitos

1. **Servidor y clientes en la misma red local**
2. **Firewall**: Permitir puerto 3001 en el servidor
3. **IP estática recomendada** para el servidor

### Configurar Firewall (Windows)

```powershell
# Permitir puerto 3001
netsh advfirewall firewall add rule name="MariamPOS Backend" dir=in action=allow protocol=TCP localport=3001
```

### Configurar Firewall (Linux)

```bash
# Ubuntu/Debian
sudo ufw allow 3001/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

## 🎯 Mejores Prácticas

### 1. **IP Estática para el Servidor**
- Configurar IP fija en el router o en el sistema operativo
- Evita que cambie la IP y rompa las conexiones

### 2. **Nombres de Host (Opcional)**
Si tienes un servidor DNS local, puedes usar:
```json
{
  "serverUrl": "http://mariampos-server.local:3001/api"
}
```

### 3. **Múltiples Cajas**
Cada cliente puede tener su propia caja:
```json
{
  "caja": "Caja 1"  // Cliente 1
}
```
```json
{
  "caja": "Caja 2"  // Cliente 2
}
```

### 4. **Múltiples Sucursales**
Si tienes múltiples servidores:
```json
{
  "sucursal": "Sucursal Norte",
  "serverUrl": "http://192.168.1.100:3001/api"
}
```

## 🔧 Script de Configuración Rápida

Crear un archivo `configurar-cliente.bat` (Windows) o `configurar-cliente.sh` (Linux):

### Windows (configurar-cliente.bat)
```batch
@echo off
echo Configuracion de Cliente MariamPOS
echo.
set /p SERVER_IP="Ingresa la IP del servidor (ej: 192.168.1.100): "
set /p CAJA="Numero de caja (ej: Caja 1): "
set /p SUCURSAL="Nombre de sucursal: "

echo.
echo Creando config.json...
(
echo {
echo   "mode": "client",
echo   "apiUrl": "http://127.0.0.1:3001/api",
echo   "serverUrl": "http://%SERVER_IP%:3001/api",
echo   "sucursal": "%SUCURSAL%",
echo   "caja": "%CAJA%",
echo   "autoDetect": true
echo }
) > public\config.json

echo.
echo Configuracion completada!
echo Archivo creado en: public\config.json
pause
```

### Linux/Mac (configurar-cliente.sh)
```bash
#!/bin/bash
echo "Configuración de Cliente MariamPOS"
echo ""
read -p "Ingresa la IP del servidor (ej: 192.168.1.100): " SERVER_IP
read -p "Número de caja (ej: Caja 1): " CAJA
read -p "Nombre de sucursal: " SUCURSAL

cat > public/config.json << EOF
{
  "mode": "client",
  "apiUrl": "http://127.0.0.1:3001/api",
  "serverUrl": "http://${SERVER_IP}:3001/api",
  "sucursal": "${SUCURSAL}",
  "caja": "${CAJA}",
  "autoDetect": true
}
EOF

echo ""
echo "✅ Configuración completada!"
echo "Archivo creado en: public/config.json"
```

## 🧪 Verificar Conexión

### Desde el Cliente

1. Abrir la consola del navegador (F12)
2. Verificar el log: `✅ AxiosClient inicializado con baseURL: http://...`
3. Si hay error, verificar:
   - IP del servidor correcta
   - Servidor ejecutándose
   - Firewall permitiendo conexiones
   - Misma red local

## 📊 Ventajas de esta Arquitectura

### ✅ Rendimiento
- **Servidor**: Procesa todo localmente (rápido)
- **Clientes**: Solo UI, sin carga de base de datos
- **Red**: Solo tráfico HTTP (ligero)

### ✅ Escalabilidad
- Múltiples clientes pueden conectarse al mismo servidor
- Cada cliente puede tener su propia caja
- Fácil agregar más clientes

### ✅ Mantenimiento
- Actualizaciones solo en el servidor
- Clientes ligeros (solo frontend)
- Base de datos centralizada

### ✅ Confiabilidad
- Si un cliente falla, los demás siguen funcionando
- Datos centralizados en el servidor
- Backup más simple (solo servidor)

## 🚨 Troubleshooting

### Problema: Cliente no se conecta al servidor

1. **Verificar IP del servidor**
   ```bash
   # En el servidor
   ipconfig  # Windows
   ifconfig  # Linux/Mac
   ```

2. **Verificar que el servidor esté ejecutándose**
   ```bash
   # En el servidor, verificar que el puerto 3001 esté abierto
   netstat -an | findstr 3001  # Windows
   netstat -an | grep 3001     # Linux/Mac
   ```

3. **Probar conexión desde el cliente**
   ```bash
   # Desde el cliente
   curl http://192.168.1.100:3001/api/categories
   # o en navegador
   http://192.168.1.100:3001/api/categories
   ```

4. **Verificar firewall**
   - Asegurar que el puerto 3001 esté abierto en el servidor
   - Verificar que no haya bloqueo de antivirus

### Problema: Detección automática no funciona

- Desactivar `autoDetect: false` y usar modo manual
- Verificar que las URLs sean correctas
- Revisar logs de la consola del navegador

## 📝 Notas Importantes

- El archivo `config.json` debe estar en `public/config.json`
- Los cambios en `config.json` requieren recargar la aplicación
- Para cambios en tiempo de ejecución, usar `reloadAxiosClient()`
- La IP del servidor debe ser accesible desde la red local

