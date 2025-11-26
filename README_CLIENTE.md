# 🚀 Generar Instalador Cliente - Guía Rápida

## ⚡ Pasos Rápidos

### 1️⃣ Compilar Frontend
```bash
cd mariam-pos-front
npm run build
cd ..
```

### 2️⃣ Configurar IP del Servidor
Editar `mariam-pos-front/public/config.json`:
```json
{
  "serverUrl": "http://[TU-IP-SERVIDOR]:3001/api"
}
```

### 3️⃣ Generar Instalador

**Windows:**
```cmd
build-client.bat
```

**Linux/Mac:**
```bash
chmod +x build-client.sh
./build-client.sh
```

### 4️⃣ Instalar en Cliente
- El instalador estará en `dist_client/`
- Copiar a la máquina cliente e instalar
- Configurar IP del servidor si es necesario

## 📦 Resultado

- **Tamaño**: ~50-80 MB (vs ~150-200 MB del servidor)
- **Incluye**: Solo frontend, sin backend
- **Requiere**: Conexión al servidor en la red local

## 🔧 Configuración Post-Instalación

Ejecutar `configurar-cliente.bat` (Windows) o `configurar-cliente.sh` (Linux) en la máquina cliente.

## 📖 Documentación Completa

Ver `GUIA_INSTALADOR_CLIENTE.md` para más detalles.

