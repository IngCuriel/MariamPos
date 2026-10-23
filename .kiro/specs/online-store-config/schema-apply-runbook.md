# Runbook: Aplicación del esquema y variable de entorno

Feature: `online-store-config` · Requisitos: 1.5, 2.3

Este runbook describe el procedimiento manual para aplicar la nueva tabla
`OnlineStoreConfig` a la base de datos SQLite del backend y para definir la
variable de entorno `ONLINE_STORE_CRYPTO_KEY` que usa el servicio de cifrado.
Ambos son procedimientos manuales y controlados: **no se automatizan y se
ejecutan únicamente tras confirmación explícita del usuario** (Req 1.5).

## 1. Propósito y cuándo ejecutarlo

Esta feature agrega un modelo **nuevo** `OnlineStoreConfig` al esquema de Prisma
(ver tarea 1 del plan y la sección "Data Models" del diseño). La tabla almacena,
por cada sucursal (`branch`), la configuración de tienda online: `enabled`,
`apiUrl`, `storeName`, `username`, `password` (cifrada), `productsEndpoint`,
`salesEndpoint` y marcas de tiempo.

**Cuándo ejecutarlo:** una vez aprobada esta feature y **antes** de usar en
producción cualquier funcionalidad que dependa de la configuración por sucursal
(consulta/guardado de configuración, cifrado de credenciales, visibilidad de las
funciones de tienda online).

Como `OnlineStoreConfig` es un modelo **nuevo**, aplicar el esquema solo **agrega
la tabla**; no altera ni migra las tablas ni los datos existentes. Los registros
previos de otras tablas quedan intactos.

## 2. Prerrequisitos

- Node.js y las dependencias del backend instaladas (`npm install` en `mariam-pos-backend`).
- Ubicar el archivo de base de datos SQLite:
  - La fuente de verdad es `datasource db` en `mariam-pos-backend/prisma/schema.prisma`,
    cuyo `url` es `env("DATABASE_URL")`.
  - Con `DATABASE_URL="file:./database.db"` (ruta relativa a `prisma/`), el archivo real es:
    **`mariam-pos-backend/prisma/database.db`**.
  - Verificar el valor real en el entorno donde se vaya a aplicar antes de continuar
    (puede diferir en despliegues empaquetados).
- **Detener el backend** y cualquier proceso que tenga abierta la base de datos antes de
  respaldar y aplicar, para evitar copias inconsistentes o bloqueos del archivo.
- Contar con la **confirmación explícita del usuario** para ejecutar el push.

## 3. Respaldo previo (obligatorio)

Copiar el archivo SQLite a un respaldo con marca de tiempo **antes** de aplicar el esquema.
Ejecutar desde el directorio `mariam-pos-backend/prisma/`.

PowerShell (Windows):

```powershell
Copy-Item .\database.db ".\database.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss').db"
```

Bash (Linux/macOS):

```bash
cp ./database.db "./database.backup.$(date +%Y%m%d-%H%M%S).db"
```

Si existen archivos auxiliares de SQLite (`database.db-wal`, `database.db-shm`), respaldarlos
también junto con el archivo principal.

## 4. Aplicación del esquema

Ejecutar desde el directorio del paquete backend (`mariam-pos-backend`):

```bash
npx prisma db push
```

Si el cliente de Prisma no se regenera automáticamente, generarlo:

```bash
npx prisma generate
```

`db push` sincroniza el esquema declarado en `schema.prisma` con la base de datos.
Al tratarse de un modelo nuevo, crea la tabla `OnlineStoreConfig` con sus columnas,
el índice declarado y la restricción de unicidad sobre `branch`, sin tocar los datos
existentes en las demás tablas.

## 5. Nota importante sobre el método

- **Usar `npx prisma db push`.**
- **NO usar `npx prisma migrate dev`.** El proyecto no mantiene un historial de migraciones
  reproducible, por lo que `migrate dev` podría intentar reconstruir el estado y generar
  resultados no deseados. `db push` es el método correcto para este esquema (Req 1.5).
- Ejecutar el push **solo tras confirmación explícita del usuario**. No forma parte de
  ningún script automático ni de los checkpoints de pruebas.

## 6. Variable de entorno `ONLINE_STORE_CRYPTO_KEY`

El servicio de cifrado del backend (`mariam-pos-backend/src/services/cryptoService.js`)
usa **AES-256-GCM** para cifrar y descifrar la contraseña de la tienda online. La clave
se obtiene de la variable de entorno `ONLINE_STORE_CRYPTO_KEY` (Req 2.3) y se deriva de
forma determinista a 32 bytes mediante `sha256` antes de usarse como clave AES-256.

### 6.1 Definición en `.env`

Definir la variable en `mariam-pos-backend/.env` con el formato:

```dotenv
ONLINE_STORE_CRYPTO_KEY="<valor-secreto-de-alta-entropia>"
```

Generar un valor seguro de alta entropía (32 bytes aleatorios en base64):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copiar la salida completa como valor de la variable.

### 6.2 Advertencia crítica: no cambiar el valor una vez en uso

Una vez definida la clave y con credenciales ya guardadas (contraseñas cifradas en la
tabla), **NO cambiar el valor de `ONLINE_STORE_CRYPTO_KEY`**. El cifrado es reversible y
depende de la clave: si se cambia el valor, las contraseñas cifradas existentes **ya no
se podrán descifrar** y deberán volver a capturarse desde el modal de configuración.

### 6.3 Comportamiento ante ausencia de la clave

La clave se evalúa en el momento de cada operación de cifrado/descifrado:

- Si la variable está **ausente o vacía**, toda operación de cifrado/descifrado se rechaza
  con un error descriptivo (`statusCode 500`). Esto bloquea el guardado de una contraseña
  nueva y el descifrado interno de credenciales.
- La **consulta** de la configuración (GET) **no descifra** la contraseña (solo devuelve
  `hasPassword` y los campos no sensibles), por lo que **sigue funcionando** aunque la clave
  no esté definida. La ausencia de clave no impide consultar la configuración.

### 6.4 Reinicio del backend

Las variables de entorno se leen al arrancar el proceso. Tras **definir o cambiar**
`ONLINE_STORE_CRYPTO_KEY` es necesario **reiniciar el backend** para que el nuevo valor
tenga efecto.

### 6.5 No commitear el `.env`

El archivo `.env` contiene un secreto y **no debe commitearse**. Ya está excluido del
control de versiones en `mariam-pos-backend/.gitignore`. Verificar que siga ignorado antes
de hacer commit y nunca incluir el valor de la clave en el repositorio ni en logs.

## 7. Verificación posterior

Tras aplicar el esquema, confirmar que la tabla nueva existe y que las tablas previas
conservan sus datos. Ejecutar desde `mariam-pos-backend/prisma`.

1. **La tabla `OnlineStoreConfig` existe:**

   ```bash
   sqlite3 database.db ".tables"
   # esperado: OnlineStoreConfig aparece en el listado

   sqlite3 database.db "PRAGMA table_info(OnlineStoreConfig);"
   # esperado: columnas branch, enabled, apiUrl, storeName, username,
   #           password, productsEndpoint, salesEndpoint, createdAt, updatedAt
   ```

2. **Las tablas previas conservan sus filas:** registrar el número de filas de las tablas
   principales antes de aplicar y confirmar que coinciden después (ningún dato debe perderse).

   ```bash
   # Ejemplo: comparar conteos antes/después de las tablas relevantes del proyecto
   sqlite3 database.db "SELECT COUNT(*) FROM Sale;"
   sqlite3 database.db "SELECT COUNT(*) FROM PendingSale;"
   ```

3. **Prueba funcional mínima (opcional):** definir `ONLINE_STORE_CRYPTO_KEY`, reiniciar el
   backend y confirmar que un guardado (upsert) de configuración persiste la contraseña
   cifrada y que la consulta devuelve `hasPassword: true` sin exponer el valor en claro.

## 8. Rollback

Si algo sale mal (error al aplicar, verificación fallida o comportamiento inesperado):

1. Detener el backend.
2. Restaurar el respaldo creado en el paso 3, sobrescribiendo el archivo actual.

   PowerShell (Windows):

   ```powershell
   Copy-Item ".\database.backup.<marca-de-tiempo>.db" .\database.db -Force
   ```

   Bash (Linux/macOS):

   ```bash
   cp "./database.backup.<marca-de-tiempo>.db" ./database.db
   ```

3. Restaurar también los archivos auxiliares (`-wal`, `-shm`) si se respaldaron.
4. Reiniciar el backend y verificar que la aplicación opera con el esquema anterior.

Conservar el respaldo hasta confirmar que el nuevo esquema funciona de forma estable.
