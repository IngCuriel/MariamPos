#!/bin/bash

echo "========================================"
echo "  Configuración de Cliente MariamPOS"
echo "========================================"
echo ""
echo "Este script configurará el cliente para conectarse al servidor."
echo ""

read -p "Ingresa la IP del servidor (ej: 192.168.1.100): " SERVER_IP
read -p "Número de caja (ej: Caja 1): " CAJA
read -p "Nombre de sucursal: " SUCURSAL

echo ""
echo "Creando config.json..."

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
echo ""
echo "Archivo creado en: public/config.json"
echo ""
echo "Configuración:"
echo "  - Modo: Cliente"
echo "  - Servidor: http://${SERVER_IP}:3001/api"
echo "  - Sucursal: ${SUCURSAL}"
echo "  - Caja: ${CAJA}"
echo ""

