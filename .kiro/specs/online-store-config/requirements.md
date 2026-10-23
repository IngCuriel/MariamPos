# Documento de Requisitos

## Introduction

MariamPOS integra funcionalidades de tienda online (pedidos, cobro en línea) que hoy dependen de valores fijos en el código del frontend: la URL del API de la tienda online está escrita directamente en `onlineStoreOrders.ts` (`ONLINE_STORE_API_URL`) y las credenciales de acceso están escritas directamente en `OnlineStoreModal.tsx` (`DEFAULT_ONLINE_STORE_EMAIL` y `DEFAULT_ONLINE_STORE_PASSWORD`). Estos valores son iguales para todas las terminales y no se pueden cambiar sin recompilar la aplicación, lo que impide que cada sucursal tenga su propia tienda online, su propia URL de API y sus propias credenciales.

Esta feature introduce un módulo de configuración de tienda online **por sucursal**. En MariamPOS la sucursal no es una entidad con identificador propio, sino un valor de texto (`branch`) que cada terminal guarda en `localStorage` bajo la clave `sucursal`. La configuración de la tienda online se asocia a ese texto como clave única.

Se agrega una tabla Prisma `OnlineStoreConfig` que almacena, por cada sucursal, si la tienda online está habilitada, la URL del API, el nombre de la tienda, el usuario, la contraseña (cifrada), y los endpoints de productos y de ventas. El backend cifra la contraseña con un algoritmo reversible (AES) usando una clave de una variable de entorno, y la descifra únicamente de forma interna cuando necesita usarla; la contraseña nunca se devuelve en claro al frontend.

El backend expone un API mínimo (consulta de la configuración de una sucursal y guardado/actualización mediante upsert). El frontend presenta un modal de configuración accesible desde el menú de administración del POS, limitado a la sucursal de la terminal actual. Cuando existe configuración, el frontend la usa para reemplazar los valores fijos de URL y credenciales. Cuando no existe configuración o la tienda online está deshabilitada, el frontend oculta por completo los accesos a las funciones de tienda online (botón "Cobrar en línea" del pie de ventas y acceso al módulo de tienda online).

### Alcance fuera de esta feature

- El cobro de pedidos en línea y el flujo de pago de pedidos online.
- La sincronización y el envío real de ventas a la tienda online.
- El mapeo entre productos de la tienda online y productos locales.
- Cambiar la forma en que el resto del sistema lee el nombre de la sucursal (`localStorage` clave `sucursal`).

## Glosario

- **Sistema**: La aplicación MariamPOS en su conjunto (backend Node/Express/Prisma sobre SQLite y frontend React/TypeScript/Electron).
- **API_Config_Tienda**: El conjunto de endpoints del backend que gestionan la configuración de tienda online por sucursal.
- **Servicio_Cifrado**: El componente del backend responsable de cifrar y descifrar credenciales mediante AES.
- **Config_Tienda_Online**: Registro `OnlineStoreConfig` que almacena la configuración de tienda online de una sucursal.
- **Sucursal**: Nombre de la sucursal (`branch`), leído de `localStorage` clave `sucursal`; actúa como clave única de la Config_Tienda_Online.
- **Clave_Cifrado**: Valor secreto definido en una variable de entorno del backend, usado por el Servicio_Cifrado para cifrar y descifrar la contraseña.
- **Password_Cifrada**: Valor del campo `password` de la Config_Tienda_Online, almacenado cifrado mediante el Servicio_Cifrado.
- **Modal_Config_Tienda**: Vista del frontend donde el administrador consulta y edita la Config_Tienda_Online de la sucursal de la terminal actual.
- **Menu_Administracion**: El menú de Configuración/Ajustes del POS desde el cual se accede al Modal_Config_Tienda.
- **Boton_Cobrar_En_Linea**: Botón "Cobrar en línea" ubicado en el pie (Footer) de la pantalla de ventas.
- **Acceso_Modulo_Tienda**: El elemento de interfaz que abre el módulo de tienda online (`OnlineStoreModal`).
- **URL_API_Online_Fija**: La constante `ONLINE_STORE_API_URL` definida en `onlineStoreOrders.ts`.
- **Credenciales_Fijas**: Las constantes `DEFAULT_ONLINE_STORE_EMAIL` y `DEFAULT_ONLINE_STORE_PASSWORD` definidas en `OnlineStoreModal.tsx`.

## Requirements

### Requirement 1: Modelo y persistencia de la configuración por sucursal

**User Story:** Como negocio con varias sucursales, quiero que cada sucursal tenga su propia configuración de tienda online almacenada de forma persistente, para que cada terminal use los datos que le corresponden.

#### Criterios de aceptación

1. THE Sistema SHALL definir un modelo `OnlineStoreConfig` en Prisma con los campos `branch`, `enabled`, `apiUrl`, `storeName`, `username`, `password`, `productsEndpoint`, `salesEndpoint` y marcas de tiempo de creación y actualización.
2. THE Sistema SHALL definir el campo `branch` como clave única de la Config_Tienda_Online, de modo que exista como máximo una Config_Tienda_Online por valor de Sucursal.
3. WHEN se crea una Config_Tienda_Online sin especificar el campo `enabled`, THE Sistema SHALL asignar al campo `enabled` el valor por defecto `false`.
4. THE Sistema SHALL almacenar el campo `password` de la Config_Tienda_Online como Password_Cifrada.
5. THE Sistema SHALL aplicar el cambio de esquema a la base de datos existente mediante `prisma db push` y únicamente tras confirmación explícita del usuario, debido al historial de migraciones no reproducible del proyecto.

### Requirement 2: Cifrado reversible de credenciales

**User Story:** Como responsable de seguridad, quiero que la contraseña de la tienda online se almacene cifrada y nunca se exponga en claro, para proteger las credenciales de cada sucursal.

#### Criterios de aceptación

1. WHEN la API_Config_Tienda recibe una contraseña para guardar, THE Servicio_Cifrado SHALL cifrar la contraseña mediante AES usando la Clave_Cifrado antes de persistirla como Password_Cifrada.
2. WHEN el Sistema necesita usar la contraseña de la Config_Tienda_Online de forma interna, THE Servicio_Cifrado SHALL descifrar la Password_Cifrada mediante AES usando la Clave_Cifrado.
3. THE Servicio_Cifrado SHALL obtener la Clave_Cifrado desde una variable de entorno del backend.
4. IF la Clave_Cifrado no está definida en el entorno al intentar cifrar o descifrar, THEN THE Servicio_Cifrado SHALL rechazar la operación y devolver un error descriptivo.
5. THE API_Config_Tienda SHALL omitir el valor de la contraseña en claro en toda respuesta de consulta de la Config_Tienda_Online.

### Requirement 3: Consulta de la configuración con contraseña enmascarada

**User Story:** Como administrador, quiero consultar la configuración de tienda online de mi sucursal sin ver la contraseña en claro, para revisar los datos sin exponer el secreto.

#### Criterios de aceptación

1. WHEN se solicita la Config_Tienda_Online de una Sucursal, THE API_Config_Tienda SHALL devolver los campos `branch`, `enabled`, `apiUrl`, `storeName`, `username`, `productsEndpoint` y `salesEndpoint` de esa Sucursal.
2. WHEN se solicita la Config_Tienda_Online de una Sucursal, THE API_Config_Tienda SHALL devolver la contraseña de forma enmascarada o ausente, sin incluir el valor en claro.
3. IF se solicita la Config_Tienda_Online de una Sucursal para la que no existe registro, THEN THE API_Config_Tienda SHALL responder indicando la ausencia de configuración para esa Sucursal.
4. WHEN se solicita la Config_Tienda_Online de una Sucursal, THE API_Config_Tienda SHALL devolver únicamente la configuración cuyo campo `branch` coincide con la Sucursal solicitada.

### Requirement 4: Guardado y actualización de la configuración (upsert)

**User Story:** Como administrador, quiero crear o actualizar la configuración de tienda online de mi sucursal en una sola operación, para gestionar los datos sin preocuparme por si ya existía un registro.

#### Criterios de aceptación

1. WHEN la API_Config_Tienda recibe una solicitud de guardado para una Sucursal sin Config_Tienda_Online previa, THE API_Config_Tienda SHALL crear una nueva Config_Tienda_Online con los datos recibidos.
2. WHEN la API_Config_Tienda recibe una solicitud de guardado para una Sucursal con Config_Tienda_Online existente, THE API_Config_Tienda SHALL actualizar la Config_Tienda_Online existente con los datos recibidos.
3. WHEN la API_Config_Tienda recibe una solicitud de guardado que incluye una contraseña nueva, THE API_Config_Tienda SHALL persistir la contraseña como Password_Cifrada mediante el Servicio_Cifrado.
4. WHERE una solicitud de guardado no incluye una contraseña nueva para una Config_Tienda_Online existente, THE API_Config_Tienda SHALL conservar la Password_Cifrada previamente almacenada.
5. IF una solicitud de guardado no especifica el valor de `branch`, THEN THE API_Config_Tienda SHALL rechazar la solicitud y devolver un error descriptivo.

### Requirement 5: Modal de configuración y su acceso

**User Story:** Como administrador, quiero configurar la tienda online de la terminal actual desde el menú de administración del POS, para gestionar los datos de la sucursal sin acceder a otras sucursales.

#### Criterios de aceptación

1. THE Sistema SHALL ofrecer el acceso al Modal_Config_Tienda desde el Menu_Administracion del POS.
2. WHEN el administrador abre el Modal_Config_Tienda, THE Modal_Config_Tienda SHALL leer la Sucursal desde `localStorage` clave `sucursal` y operar únicamente sobre la Config_Tienda_Online de esa Sucursal.
3. WHEN el administrador abre el Modal_Config_Tienda, THE Modal_Config_Tienda SHALL consultar la API_Config_Tienda y mostrar los valores actuales de `enabled`, `apiUrl`, `storeName`, `username`, `productsEndpoint` y `salesEndpoint` de la Sucursal.
4. THE Modal_Config_Tienda SHALL presentar el campo de contraseña como campo de solo escritura, sin mostrar la contraseña almacenada.
5. WHEN el administrador guarda los cambios en el Modal_Config_Tienda, THE Modal_Config_Tienda SHALL enviar los datos a la API_Config_Tienda mediante la operación de upsert para la Sucursal actual.
6. WHERE el administrador deja vacío el campo de contraseña al guardar una Config_Tienda_Online existente, THE Modal_Config_Tienda SHALL guardar los demás campos sin modificar la contraseña almacenada.

### Requirement 6: Lectura de la configuración para reemplazar los valores fijos

**User Story:** Como negocio, quiero que la aplicación use la URL del API y las credenciales almacenadas en la configuración de la sucursal, para dejar de depender de los valores escritos en el código.

#### Criterios de aceptación

1. WHERE existe Config_Tienda_Online para la Sucursal actual, THE Sistema SHALL usar el campo `apiUrl` de la Config_Tienda_Online en lugar de la URL_API_Online_Fija.
2. WHERE existe Config_Tienda_Online para la Sucursal actual, THE Sistema SHALL usar el `username` y la contraseña de la Config_Tienda_Online en lugar de las Credenciales_Fijas al autenticar contra la tienda online.
3. THE Sistema SHALL usar los campos `productsEndpoint` y `salesEndpoint` de la Config_Tienda_Online para resolver las rutas de productos y de ventas de la tienda online de la Sucursal actual.
4. IF no existe Config_Tienda_Online para la Sucursal actual, THEN THE Sistema SHALL abstenerse de usar las funciones de tienda online conforme a la degradación segura definida en el Requirement 7.

### Requirement 7: Degradación segura al faltar o deshabilitar la configuración

**User Story:** Como cajero, quiero que las funciones de tienda online solo aparezcan cuando están configuradas y habilitadas para mi sucursal, para no intentar usar funciones que no están disponibles.

#### Criterios de aceptación

1. IF no existe Config_Tienda_Online para la Sucursal actual, THEN THE Sistema SHALL ocultar por completo el Boton_Cobrar_En_Linea del pie de la pantalla de ventas.
2. IF no existe Config_Tienda_Online para la Sucursal actual, THEN THE Sistema SHALL ocultar por completo el Acceso_Modulo_Tienda.
3. WHILE el campo `enabled` de la Config_Tienda_Online de la Sucursal actual tiene valor `false`, THE Sistema SHALL ocultar por completo el Boton_Cobrar_En_Linea del pie de la pantalla de ventas.
4. WHILE el campo `enabled` de la Config_Tienda_Online de la Sucursal actual tiene valor `false`, THE Sistema SHALL ocultar por completo el Acceso_Modulo_Tienda.
5. WHERE existe Config_Tienda_Online para la Sucursal actual con el campo `enabled` en valor `true`, THE Sistema SHALL mostrar el Boton_Cobrar_En_Linea y el Acceso_Modulo_Tienda.
