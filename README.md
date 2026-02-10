# Generar ejecutable .exe
## Empaqueta el front y backend 


## Carpeta MARIAMPOS
```
npm run dist 
```

## Cualquier cambio del front es necesario, primero dentro de la carpeta mariam-pos-front  ejecutar 
```
npm run build
```


## La carpeta donde se instala el .exe es 
```
C:\Users\<user.name>\AppData\Local\Programs\MariamPOS
``` 


## Carpeta donde se crea la base de datos y los log 

1. database.db
2. mariam-pos.log.txt
```
C:\Users\<user.name>\AppData\Roaming\MariamPOS
```

## DB Browser for SQLite (la opción más recomendada)

Es un programa gratuito con interfaz gráfica para abrir, modificar y ejecutar consultas en archivos .db.

Pasos:

1. Descarga desde: https://sqlitebrowser.org/dl/

2. Instala y abre el programa.

3. Haz clic en Open Database y selecciona tu database.db.

4. Ahora podrás ver tablas, datos, y ejecutar SQL directamente en la pestaña Execute SQL. Para agregar columnas, solo ejecuta tu ALTER TABLE allí.

## Se queda prendido el api 

buscar en el administrador de tarea 
 MariamPOS.exe y node.exe y finalizar tarea


## Version dos apartir del 08-11-2025

cambio de reporte en el front (ventas del día)
cambio de reporte en el back end 

cambio de dato a la cantidad en el detalle de la compra. 
  ```
  npx prisma db push
  ```


pasar el dist carpeta del front 
y el archivo salesController, productsController del back



Crear .exe solo cliente de backend 
``
cd mariam-pos-front
   npm run build
``
```
   cd ..
   npm run build:client
``

Para generar el instalador del servidor:
# 1. Compilar el frontend
cd mariam-pos-front
npm run build
cd ..

# 2. Generar el instalador (nuevo método)
npm run build:server

# O método tradicional (también funciona)
npm run dist

# Release 14 de febrero 
      modified:   mariam-pos-backend/src/controllers/cashRegisterController.js        
      modified:   mariam-pos-backend/src/controllers/salesController.js
  