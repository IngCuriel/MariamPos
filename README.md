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