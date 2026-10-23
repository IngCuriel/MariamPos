# Documento de Requisitos

## Introduction

MariamPOS opera con tres cajas. Dos cajas funcionan como **cajas auxiliares**: arman el carrito de productos pero no cobran; guardan la venta como "pendiente" y entregan al cliente un folio legible (por ejemplo `PP-1050`). La tercera es la **caja principal**, única autorizada para cobrar: carga el folio desde la lista de ventas pendientes y realiza el cobro.

El problema actual es que, al cargar un folio en la caja principal, el sistema elimina la venta pendiente de la base de datos (el frontend invoca `deletePendingSale` apenas se confirma la carga del folio, incluso antes de cobrar). En consecuencia, la caja auxiliar no tiene forma de saber si su folio ya fue cobrado para entregar el producto, y si la caja principal descarta el folio sin cobrar, la venta pendiente se pierde.

Esta feature convierte la venta pendiente en una máquina de estados de dos estados (Pendiente y Pagado), deja de eliminarla al cargarla, la marca como Pagada únicamente al cobrarla y la vincula con la venta real generada. En la caja principal, el folio se carga como un **bloque inmutable**: sus productos no se editan ni se eliminan individualmente; la caja principal solo puede agregar productos adicionales (extras) o quitar el folio completo. De esta forma, lo que se cobra del folio es exactamente lo que la caja auxiliar generó, y la auxiliar entrega el contenido del folio sin ambigüedad. Si el cliente quiere cambiar el contenido del folio, debe volver a la caja auxiliar.

Adicionalmente, esta feature deja preparado un campo de **origen de venta** (`origin`) en el modelo `Sale` para clasificar las ventas (directa, proveniente de folio pendiente, en línea). El flujo completo de ventas en línea queda fuera de esta feature; solo se deja el campo disponible para no rehacer el esquema más adelante.

### Alcance fuera de esta feature

- Estado "Entregado" y acción de marcar entrega (la caja auxiliar entrega por su cuenta al ver el estado Pagado).
- Comunicación en tiempo real compleja (websockets); se usa refresco manual y/o polling simple.
- Centralización del cobro en un único punto (ya está centralizado en la caja principal).
- Implementación del flujo completo de ventas en línea (`ONLINE`): descuento de inventario local, sincronización, etc. Solo se prepara el campo `origin`.
- Edición del contenido de un folio desde la caja principal (el contenido del folio solo se modifica en la caja auxiliar).

## Glosario

- **Sistema**: La aplicación MariamPOS en su conjunto (backend Node/Express/Prisma y frontend React/Electron).
- **API_Ventas_Pendientes**: El conjunto de endpoints del backend que gestionan ventas pendientes (`pendingSalesController`).
- **Venta_Pendiente**: Registro `PendingSale` que representa un carrito guardado por una caja auxiliar, identificado por un folio único (`code`).
- **Folio**: Código legible y único de una Venta_Pendiente (campo `code`, formato `PP-NNNN`) que la caja auxiliar entrega al cliente.
- **Caja_Auxiliar**: Caja que arma carritos y guarda ventas pendientes, pero no cobra.
- **Caja_Principal**: Caja autorizada para cobrar; carga un Folio y genera la venta real.
- **Venta_Real**: Registro `Sale` generado cuando la Caja_Principal cobra.
- **Estado_Venta_Pendiente**: Atributo de la Venta_Pendiente cuyo valor es `PENDING` (🟡 Pendiente) o `PAID` (🟢 Pagado).
- **Bloque_Folio**: Conjunto de productos provenientes de un Folio cargado en el carrito de la Caja_Principal, tratado como una unidad inmutable.
- **Producto_Extra**: Producto agregado por la Caja_Principal al carrito que NO proviene del Bloque_Folio.
- **Origen_Venta**: Atributo de la Venta_Real (`origin`) que clasifica su procedencia: `DIRECT`, `PENDING_SALE` u `ONLINE`.
- **Vista_Mis_Folios**: Vista del frontend para la Caja_Auxiliar que lista sus folios con el semáforo de estado.
- **Caja_Origen**: Nombre de la caja que registró la Venta_Pendiente (`cashRegister`), leído de `localStorage` clave `caja`.
- **Sucursal**: Nombre de la sucursal (`branch`), leído de `localStorage` clave `sucursal`.
- **Cajero_Registrador**: Identificador del cajero que creó la Venta_Pendiente (`createdBy`).

## Requirements

### Requirement 1: Máquina de estados de dos estados

**User Story:** Como negocio, quiero que cada venta pendiente tenga un estado explícito Pendiente o Pagado, para poder saber si un folio ya fue cobrado sin que el registro se elimine.

#### Criterios de aceptación

1. THE Sistema SHALL definir para cada Venta_Pendiente un Estado_Venta_Pendiente cuyo único conjunto de valores válidos es `PENDING` y `PAID`.
2. WHEN se crea una Venta_Pendiente, THE API_Ventas_Pendientes SHALL asignar el Estado_Venta_Pendiente con valor `PENDING`.
3. WHEN la Caja_Principal cobra un Folio cargado, THE API_Ventas_Pendientes SHALL cambiar el Estado_Venta_Pendiente de la Venta_Pendiente de `PENDING` a `PAID`.
4. IF se solicita cambiar el Estado_Venta_Pendiente a un valor distinto de `PENDING` o `PAID`, THEN THE API_Ventas_Pendientes SHALL rechazar la solicitud y devolver un error descriptivo.

### Requirement 2: Conservar la venta pendiente al cargar el folio

**User Story:** Como cajero principal, quiero que el folio no se borre al cargarlo, para que la venta pendiente permanezca disponible si decido no cobrarla.

#### Criterios de aceptación

1. WHEN la Caja_Principal carga un Folio al carrito, THE Sistema SHALL conservar la Venta_Pendiente en la base de datos con su Estado_Venta_Pendiente actual.
2. WHILE un Folio permanece cargado en la Caja_Principal sin haber sido cobrado, THE Sistema SHALL mantener el Estado_Venta_Pendiente en `PENDING`.
3. IF la Caja_Principal descarta o cancela un Folio cargado sin cobrarlo, THEN THE Sistema SHALL mantener la Venta_Pendiente con Estado_Venta_Pendiente `PENDING`.

### Requirement 3: Bloque de folio inmutable en la caja principal

**User Story:** Como cajero principal, quiero que los productos del folio se carguen como un bloque que no puedo editar, para que lo cobrado del folio coincida exactamente con lo que generó la caja auxiliar.

#### Criterios de aceptación

1. WHEN la Caja_Principal carga un Folio al carrito, THE Sistema SHALL agrupar los productos del Folio en un Bloque_Folio identificable visualmente de forma clara y discreta (sin elementos visuales invasivos).
2. THE Sistema SHALL impedir la edición de cantidad, precio o cualquier atributo de los productos que pertenecen al Bloque_Folio.
3. THE Sistema SHALL impedir la eliminación individual de productos que pertenecen al Bloque_Folio.
4. THE Sistema SHALL permitir a la Caja_Principal agregar Productos_Extra al carrito como líneas normales editables, independientes del Bloque_Folio.
5. WHEN la Caja_Principal solicita quitar el Bloque_Folio, THE Sistema SHALL eliminar del carrito todos los productos del Bloque_Folio como una sola unidad y conservar los Productos_Extra.
6. WHEN la Caja_Principal quita el Bloque_Folio del carrito, THE Sistema SHALL mantener la Venta_Pendiente asociada con Estado_Venta_Pendiente `PENDING`.
7. THE Sistema SHALL mostrar en el Bloque_Folio el código del Folio y la Caja_Origen.

### Requirement 4: Marcar como pagada y vincular a la venta real

**User Story:** Como negocio, quiero que al cobrar un folio la venta pendiente quede marcada como Pagada y vinculada a la venta real, para poder saber que ese folio fue cobrado y en qué venta.

#### Criterios de aceptación

1. WHEN la Caja_Principal completa el cobro de una venta que contiene un Bloque_Folio, THE API_Ventas_Pendientes SHALL registrar en la Venta_Pendiente el identificador de la Venta_Real generada (`paidSaleId`).
2. WHEN la Caja_Principal completa el cobro de una venta que contiene un Bloque_Folio, THE API_Ventas_Pendientes SHALL registrar en la Venta_Pendiente la fecha y hora del cobro (`paidAt`), la caja que cobró (`paidCashRegister`) y el cajero que cobró (`paidBy`).
3. WHEN la Venta_Pendiente cambia a Estado_Venta_Pendiente `PAID`, THE API_Ventas_Pendientes SHALL registrar `paidAt`, `paidSaleId`, `paidCashRegister` y `paidBy` de forma atómica en una única operación.
4. WHEN una Venta_Pendiente alcanza el Estado_Venta_Pendiente `PAID`, THE Sistema SHALL conservar el registro de la Venta_Pendiente en la base de datos sin eliminarlo.
5. IF el cobro de la Venta_Real falla, THEN THE Sistema SHALL mantener el Estado_Venta_Pendiente en `PENDING` y no registrar `paidSaleId`, `paidAt`, `paidCashRegister` ni `paidBy`.

### Requirement 5: Trazabilidad de origen y de cobro

**User Story:** Como negocio, quiero registrar quién y dónde creó y cobró cada folio, para tener trazabilidad del flujo entre cajas.

#### Criterios de aceptación

1. WHEN se crea una Venta_Pendiente, THE API_Ventas_Pendientes SHALL registrar la Caja_Origen (`cashRegister`), la Sucursal (`branch`) y el Cajero_Registrador (`createdBy`).
2. WHEN una Venta_Pendiente alcanza el Estado_Venta_Pendiente `PAID`, THE API_Ventas_Pendientes SHALL registrar `paidCashRegister` con el nombre de la Caja_Principal que realizó el cobro.
3. WHILE una Venta_Pendiente tiene Estado_Venta_Pendiente `PENDING`, THE Sistema SHALL mantener vacíos los campos `paidAt`, `paidSaleId`, `paidCashRegister` y `paidBy`.

### Requirement 6: Entrega basada en el contenido del folio

**User Story:** Como cajero auxiliar, quiero entregar exactamente el contenido del folio cuando esté Pagado, para no depender de cambios hechos en la caja principal.

#### Criterios de aceptación

1. WHEN una Venta_Pendiente tiene Estado_Venta_Pendiente `PAID`, THE Sistema SHALL presentar como detalle a entregar el detalle propio del Folio (los productos de la Venta_Pendiente).
2. THE Sistema SHALL tratar los Productos_Extra agregados por la Caja_Principal como ajenos al Folio y NO incluirlos en el detalle a entregar por la Caja_Auxiliar.
3. THE Vista_Mis_Folios SHALL permitir consultar el detalle del Folio de cada Venta_Pendiente.

### Requirement 7: Vista "Mis folios" para la caja auxiliar

**User Story:** Como cajero auxiliar, quiero una vista de mis folios con un semáforo de estado, para saber cuándo un folio fue cobrado y entregar el producto.

#### Criterios de aceptación

1. THE Vista_Mis_Folios SHALL mostrar los folios con un indicador de estado 🟡 para `PENDING` y 🟢 para `PAID`.
2. THE Vista_Mis_Folios SHALL filtrar siempre los folios por la Caja_Origen correspondiente al valor de `localStorage` clave `caja`.
3. IF `localStorage` clave `caja` no contiene un valor, THEN THE Vista_Mis_Folios SHALL mostrar un resultado vacío sin presentar folios de otras cajas.
4. WHEN el usuario activa el control de refresco de la Vista_Mis_Folios, THE Vista_Mis_Folios SHALL volver a consultar la API_Ventas_Pendientes y actualizar el Estado_Venta_Pendiente mostrado de cada folio.
5. WHERE el refresco automático está habilitado, THE Vista_Mis_Folios SHALL volver a consultar la API_Ventas_Pendientes de forma periódica para reflejar los cambios de Estado_Venta_Pendiente.
6. WHEN la API_Ventas_Pendientes devuelve los folios, THE Vista_Mis_Folios SHALL mostrar el Folio, el Estado_Venta_Pendiente, el total y la fecha de creación de cada Venta_Pendiente.

### Requirement 8: Consulta de ventas pendientes con estado

**User Story:** Como desarrollador del frontend, quiero que la API exponga el estado y los datos de trazabilidad de cada venta pendiente, para poder mostrar el semáforo y el detalle correcto.

#### Criterios de aceptación

1. WHEN se consulta la lista de ventas pendientes, THE API_Ventas_Pendientes SHALL incluir para cada Venta_Pendiente el Estado_Venta_Pendiente, `cashRegister`, `branch`, `createdBy`, `paidAt`, `paidSaleId`, `paidCashRegister` y `paidBy`.
2. WHERE la consulta recibe un filtro por Caja_Origen, THE API_Ventas_Pendientes SHALL devolver únicamente las ventas pendientes cuya Caja_Origen coincide con el valor del filtro.
3. WHERE la consulta recibe un filtro por Estado_Venta_Pendiente, THE API_Ventas_Pendientes SHALL devolver únicamente las ventas pendientes cuyo Estado_Venta_Pendiente coincide con el valor del filtro.
4. THE API_Ventas_Pendientes SHALL exponer los folios con Estado_Venta_Pendiente `PENDING` a la vista de carga de folios de la Caja_Principal, de modo que el comportamiento actual de esa vista no se vea afectado por la conservación de folios `PAID`.

### Requirement 9: Origen de venta preparado en el modelo Sale

**User Story:** Como negocio, quiero clasificar el origen de cada venta, para poder distinguir ventas directas, provenientes de folio y en línea, y habilitar reportes y comisiones a futuro.

#### Criterios de aceptación

1. THE Sistema SHALL definir en la Venta_Real un atributo Origen_Venta (`origin`) cuyo conjunto de valores válidos incluye `DIRECT`, `PENDING_SALE` y `ONLINE`.
2. WHEN se crea una Venta_Real sin especificar el Origen_Venta, THE Sistema SHALL asignar el valor por defecto `DIRECT`.
3. WHEN la Caja_Principal cobra una venta que contiene un Bloque_Folio, THE Sistema SHALL asignar a la Venta_Real el Origen_Venta `PENDING_SALE`.
4. WHEN la Venta_Real tiene Origen_Venta `PENDING_SALE`, THE Sistema SHALL registrar la Caja_Origen del Folio en un campo de referencia (`sourceCashRegister`).
5. THE Sistema SHALL mantener disponible un campo de referencia opcional para pedidos en línea (`onlineOrderId`) sin requerir su uso en esta feature.

### Requirement 10: Compatibilidad con datos existentes

**User Story:** Como responsable del sistema en producción, quiero que los nuevos campos no afecten los datos ya existentes, para no perder información ni romper el funcionamiento actual.

#### Criterios de aceptación

1. THE Sistema SHALL agregar todo campo nuevo en `PendingSale` y en `Sale` como opcional o con un valor por defecto, de modo que los registros existentes permanezcan válidos sin migración de datos.
2. WHEN se aplica el cambio de esquema a la base de datos existente, THE Sistema SHALL preservar intactos todos los registros y valores previos de `PendingSale` y `Sale`.
3. WHERE un registro de `Sale` existente no tiene Origen_Venta, THE Sistema SHALL interpretarlo con el valor por defecto `DIRECT`.
4. WHERE un registro de `PendingSale` existente no tiene Estado_Venta_Pendiente, THE Sistema SHALL interpretarlo con el valor por defecto `PENDING`.
5. THE Sistema SHALL aplicar el cambio de esquema mediante `prisma db push` (no `migrate dev`) y únicamente tras confirmación explícita del usuario, debido al historial de migraciones no reproducible del proyecto.
