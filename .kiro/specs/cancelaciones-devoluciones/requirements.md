# Documento de Requisitos: Cancelaciones y Devoluciones

## Introducción

MariamPOS es un sistema de punto de venta multisucursal. Hoy el sistema registra ventas (modelo `Sale`) con sus detalles (`SaleDetail`), las asocia a un turno de caja (`CashRegisterShift`) y agrega esa información en reportes de ventas (por categoría, por departamento, productos más vendidos, resúmenes y ventas diarias). Sin embargo, no existe un mecanismo controlado para revertir una venta cuando el cajero cometió un error, ni para devolver uno o varios productos de una venta ya cobrada (por ejemplo, por caducidad o defecto).

Esta funcionalidad cubre dos operaciones de reversión:

- **Cancelación:** anula una venta completa, normalmente dentro del mismo turno, cuando el cajero se equivocó al registrarla.
- **Devolución parcial:** devuelve uno o más productos de una venta, incluso días después de la venta original.

La propietaria del negocio requiere que ambas operaciones:

1. Puedan ser ejecutadas por la cajera sin autorización adicional, pero queden siempre registradas en una bitácora de auditoría completa.
2. Siempre exijan un motivo.
3. Afecten correctamente el inventario (regresando producto a existencias o registrando merma según el motivo) y el efectivo de la caja (registrando una salida de efectivo).
4. Se descuenten de los reportes de ventas para que estos reflejen el ingreso neto real.

El principio rector es que **una venta nunca se elimina**: se marca con un estado y se conservan registros independientes de cancelación y devolución, garantizando trazabilidad completa.

## Glosario

- **Sistema:** El conjunto del software MariamPOS (backend Node/Express + Prisma y clientes web/escritorio/móvil) que ejecuta la operación solicitada.
- **Venta (Sale):** Transacción registrada en el modelo `Sale`, con folio, total, estado, método de pago, sucursal, caja, cajero (`createdBy`) y turno asociado (`shiftId`).
- **Detalle_de_Venta (SaleDetail):** Renglón de una venta que representa un producto vendido con cantidad, precio, subtotal y referencia al producto.
- **Cancelación:** Reversión de una venta completa que marca la venta con estado "Cancelada" y genera un Registro_de_Cancelación.
- **Devolución_Parcial:** Reversión de una o más líneas (o cantidades) de una venta, que marca la venta con estado "Parcialmente Devuelta" o "Devuelta" y genera un Registro_de_Devolución.
- **Registro_de_Cancelación:** Entidad de bitácora que documenta una cancelación, enlazada a la venta original y al turno de caja.
- **Registro_de_Devolución:** Entidad de bitácora que documenta una devolución parcial, enlazada a la venta original, a los detalles devueltos y al turno de caja.
- **Motivo:** Texto obligatorio que describe la razón de la cancelación o devolución.
- **Motivos_Sugeridos:** Lista de motivos frecuentes que el Sistema ofrece como botones seleccionables con un clic, además de una opción de motivo libre ("Otro motivo").
- **Motivo_de_Merma:** Motivo clasificado como caducidad o defecto, bajo el cual el producto no regresa a existencias.
- **Turno_de_Caja (CashRegisterShift):** Período de operación de una caja (corte de caja) con estado OPEN/CLOSED/CANCELLED, al que se asocian ventas y movimientos de efectivo.
- **Movimiento_de_Efectivo (CashMovement):** Entrada o salida de efectivo registrada contra un turno de caja, con tipo ENTRADA o SALIDA.
- **Movimiento_de_Inventario (InventoryMovement):** Registro de ENTRADA, SALIDA o AJUSTE de existencias de un producto.
- **Merma:** Pérdida de producto que no regresa a existencias, registrada por caducidad o defecto.
- **Inventario (Inventory):** Existencias actuales (`currentStock`) de un producto en una sucursal; solo los productos con `trackInventory = true` se afectan.
- **Bitácora_de_Auditoría:** Conjunto de datos que identifica quién ejecutó una operación, cuándo (fecha y hora), el motivo, la sucursal, la caja y la cajera.
- **Reporte_de_Ventas:** Agregaciones de ventas que produce el Sistema: ventas por categoría, por departamento, productos más vendidos, resumen de ventas y ventas diarias.
- **Cajera:** Persona que opera la caja y ejecuta ventas, cancelaciones y devoluciones.
- **Propietaria:** Dueña del negocio, usuaria administradora que consulta reportes y bitácoras.

## Requisitos

### Requisito 1: Cancelación de una venta completa

**Historia de usuario:** Como cajera, quiero cancelar una venta completa que registré por error, para corregir la operación sin eliminar el registro de la venta.

#### Criterios de Aceptación

1. WHEN la Cajera solicita cancelar una venta cuyo estado es "Pagado" o "Pendiente", THE Sistema SHALL registrar la cancelación y marcar la Venta con estado "Cancelada".
2. WHEN la Cajera inicia la cancelación de una venta, THE Sistema SHALL solicitar el Motivo ANTES de aplicar la cancelación.
3. WHEN el Sistema solicita el Motivo de una cancelación, THE Sistema SHALL ofrecer una lista de Motivos_Sugeridos de cancelación seleccionables con un clic y SHALL ofrecer además una opción de motivo libre ("Otro motivo").
4. IF la Cajera solicita cancelar una venta sin proporcionar un Motivo, THEN THE Sistema SHALL rechazar la operación y conservar la Venta en su estado actual.
5. IF la Cajera solicita cancelar una venta cuyo estado ya es "Cancelada", THEN THE Sistema SHALL rechazar la operación e informar que la Venta ya está cancelada.
6. WHEN el Sistema completa una cancelación, THE Sistema SHALL crear un Registro_de_Cancelación enlazado a la Venta original y al Turno_de_Caja en que se ejecuta la cancelación.
7. THE Sistema SHALL conservar la Venta original y sus Detalles_de_Venta sin eliminarlos tras una cancelación.

### Requisito 2: Devolución parcial de productos

**Historia de usuario:** Como cajera, quiero devolver uno o más productos de una venta ya cobrada, para atender casos como caducidad o defecto incluso días después de la venta.

#### Criterios de Aceptación

1. WHEN la Cajera solicita devolver una o más líneas de una venta indicando el producto y la cantidad a devolver, THE Sistema SHALL registrar la devolución de las cantidades indicadas.
2. WHEN la Cajera solicita una Devolución_Parcial, THE Sistema SHALL requerir un Motivo antes de ejecutar la devolución.
3. IF la cantidad a devolver de una línea excede la cantidad vendida menos la cantidad ya devuelta de esa línea, THEN THE Sistema SHALL rechazar la operación e informar la cantidad disponible para devolución.
4. WHEN una devolución deja al menos una línea de la Venta con cantidad pendiente de devolver mayor a cero, THE Sistema SHALL marcar la Venta con estado "Parcialmente Devuelta".
5. WHEN una devolución resulta en que todas las líneas de la Venta quedan completamente devueltas, THE Sistema SHALL marcar la Venta con estado "Devuelta".
6. WHEN el Sistema completa una devolución, THE Sistema SHALL crear un Registro_de_Devolución enlazado a la Venta original, a los Detalles_de_Venta devueltos y al Turno_de_Caja en que se ejecuta la devolución.
7. THE Sistema SHALL conservar la Venta original y sus Detalles_de_Venta sin eliminarlos tras una devolución.
8. WHEN la línea devuelta corresponde a un producto vendido por Presentación, THE Sistema SHALL convertir la cantidad devuelta a la unidad base del producto usando la cantidad que contiene la presentación (p. ej. 1 Bulto de 20 kg devuelto equivale a 20 kg), y SHALL aplicar el ajuste de inventario en esa unidad base.
9. THE Sistema SHALL expresar y registrar la cantidad devuelta en la unidad base del producto (piezas o la unidad del precio base), de modo que el inventario se mueva siempre en unidad base.
10. WHEN el Sistema no dispone de un Turno_de_Caja abierto y la devolución implica salida de efectivo, THE Sistema SHALL exigir que se abra un turno antes de continuar (ver Requisito 7).

### Requisito 3: Motivo obligatorio

**Historia de usuario:** Como propietaria, quiero que toda cancelación y devolución exija un motivo, para entender por qué se revirtió cada operación.

#### Criterios de Aceptación

1. THE Sistema SHALL requerir un Motivo no vacío para toda Cancelación.
2. THE Sistema SHALL requerir un Motivo no vacío para toda Devolución_Parcial.
3. WHEN el Sistema solicita el Motivo de una Cancelación, THE Sistema SHALL ofrecer los siguientes Motivos_Sugeridos seleccionables con un clic: "Error de captura", "Producto equivocado", "Cliente se arrepintió", "Cobro duplicado", "Precio incorrecto" y "Prueba / capacitación".
4. WHEN el Sistema solicita el Motivo de una Devolución_Parcial, THE Sistema SHALL ofrecer los siguientes Motivos_Sugeridos seleccionables con un clic: "Producto caducado", "Producto defectuoso / dañado", "Producto equivocado", "Cliente insatisfecho" y "No era lo que esperaba".
5. THE Sistema SHALL clasificar los Motivos_Sugeridos "Producto caducado" y "Producto defectuoso / dañado" como Motivo_de_Merma (el producto no regresa a existencias).
6. WHEN el Sistema ofrece Motivos_Sugeridos, THE Sistema SHALL ofrecer además una opción de motivo libre ("Otro motivo") que acepta texto escrito por la Cajera.
7. WHEN la Cajera selecciona la opción de motivo libre, THE Sistema SHALL permitir marcar manualmente ese motivo como Motivo_de_Merma.
8. WHEN el Sistema registra el Motivo, THE Sistema SHALL almacenar el texto del Motivo y su clasificación (merma o estándar) en el Registro_de_Cancelación o en el Registro_de_Devolución correspondiente.

### Requisito 4: Permisos de ejecución

**Historia de usuario:** Como propietaria, quiero que la cajera pueda cancelar y devolver sin autorización adicional, para que la operación del negocio sea ágil.

#### Criterios de Aceptación

1. WHEN la Cajera solicita una Cancelación, THE Sistema SHALL permitir la ejecución sin requerir una autorización adicional de un supervisor o administrador.
2. WHEN la Cajera solicita una Devolución_Parcial, THE Sistema SHALL permitir la ejecución sin requerir una autorización adicional de un supervisor o administrador.
3. WHEN la Cajera ejecuta una Cancelación o una Devolución_Parcial, THE Sistema SHALL registrar la operación en la Bitácora_de_Auditoría.

### Requisito 5: Bitácora de auditoría

**Historia de usuario:** Como propietaria, quiero que cada cancelación y devolución quede registrada con todos sus datos, para tener trazabilidad completa de quién revirtió qué, cuándo y por qué.

#### Criterios de Aceptación

1. WHEN el Sistema registra una Cancelación, THE Sistema SHALL almacenar en el Registro_de_Cancelación la Cajera que la ejecutó, la fecha y hora de ejecución, el Motivo, la sucursal, la caja y la referencia a la Venta original.
2. WHEN el Sistema registra una Devolución_Parcial, THE Sistema SHALL almacenar en el Registro_de_Devolución la Cajera que la ejecutó, la fecha y hora de ejecución, el Motivo, la sucursal, la caja, la referencia a la Venta original y las líneas con sus cantidades devueltas.
3. THE Sistema SHALL enlazar cada Registro_de_Cancelación y cada Registro_de_Devolución con el Turno_de_Caja en que se ejecutó la operación.
4. WHEN la Propietaria consulta la Bitácora_de_Auditoría de cancelaciones y devoluciones, THE Sistema SHALL presentar la Cajera, la fecha y hora, el Motivo, la sucursal, la caja y la Venta de cada registro.

### Requisito 6: Efecto sobre el inventario

**Historia de usuario:** Como propietaria, quiero que el producto cancelado o devuelto regrese a existencias por defecto, salvo cuando sea merma, para que el inventario refleje la realidad.

#### Criterios de Aceptación

1. THE Sistema SHALL afectar el inventario (ENTRADA o Merma) únicamente para los productos cuyo `trackInventory = true`.
2. WHERE un producto tiene `trackInventory = false`, THE Sistema SHALL omitir todo movimiento y ajuste de inventario (incluida la Merma) para ese producto y SHALL continuar con el resto de la operación (estado de la venta, efectivo y reportes).
3. WHEN el Sistema completa una Cancelación o una Devolución_Parcial con un Motivo estándar sobre un producto con `trackInventory = true`, THE Sistema SHALL registrar un Movimiento_de_Inventario de tipo ENTRADA por la cantidad revertida e incrementar las existencias del producto.
4. WHERE el Motivo es un Motivo_de_Merma (caducidad o defecto) y el producto tiene `trackInventory = true`, THE Sistema SHALL registrar la cantidad revertida como Merma y SHALL omitir el incremento de existencias del producto.
5. WHEN el Sistema registra un Movimiento_de_Inventario derivado de una cancelación o devolución, THE Sistema SHALL incluir la sucursal, la caja, la Cajera y una referencia al Registro_de_Cancelación o Registro_de_Devolución correspondiente.

### Requisito 7: Efecto sobre el efectivo de la caja

**Historia de usuario:** Como propietaria, quiero que la devolución de dinero quede registrada como salida de efectivo en la caja solo cuando realmente se devuelve dinero al cliente, para que el corte de caja cuadre con el efectivo físico.

#### Criterios de Aceptación

1. WHEN el Sistema completa una Cancelación de una Venta que fue cobrada en efectivo, THE Sistema SHALL registrar un Movimiento_de_Efectivo de tipo SALIDA por el monto en efectivo devuelto al cliente, contra el Turno_de_Caja activo al momento de la cancelación.
2. IF la Venta a cancelar no fue cobrada en efectivo (p. ej. estaba "Pendiente", o se pagó con tarjeta o regalo), THEN THE Sistema SHALL omitir el Movimiento_de_Efectivo de salida y SHALL cambiar únicamente el estado de la Venta y su exclusión de reportes.
3. WHEN la Venta se pagó de forma mixta (parte efectivo, parte tarjeta), THE Sistema SHALL registrar el Movimiento_de_Efectivo de tipo SALIDA solo por la porción pagada en efectivo.
4. WHEN el Sistema completa una Devolución_Parcial en la que se devuelve dinero en efectivo al cliente, THE Sistema SHALL registrar un Movimiento_de_Efectivo de tipo SALIDA por la suma de los subtotales de las líneas devueltas, contra el Turno_de_Caja activo al momento de la devolución.
5. THE Sistema SHALL registrar el Movimiento_de_Efectivo de salida contra el Turno_de_Caja activo donde se ejecuta la operación (no contra el turno de la Venta original), de modo que el efectivo salga del turno en que físicamente se devuelve el dinero.
6. WHEN el Sistema registra el Movimiento_de_Efectivo derivado de una cancelación o devolución, THE Sistema SHALL asociar el Motivo, la Cajera y una referencia al Registro_de_Cancelación o Registro_de_Devolución correspondiente.
7. IF la operación implica una salida de efectivo y no existe un Turno_de_Caja con estado OPEN en la caja al momento de ejecutarla, THEN THE Sistema SHALL rechazar la operación e informar que se requiere un turno de caja abierto.

### Requisito 8: Impacto en los reportes de ventas

**Historia de usuario:** Como propietaria, quiero que las ventas canceladas y los productos devueltos se descuenten de los reportes, para ver el ingreso neto real por categoría, departamento y producto.

#### Criterios de Aceptación

1. WHEN el Sistema genera el Reporte_de_Ventas por categoría, THE Sistema SHALL excluir los importes y cantidades de las ventas con estado "Cancelada".
2. WHEN el Sistema genera el Reporte_de_Ventas por departamento, THE Sistema SHALL excluir los importes y cantidades de las ventas con estado "Cancelada".
3. WHEN el Sistema genera el reporte de productos más vendidos, THE Sistema SHALL excluir los importes y cantidades de las ventas con estado "Cancelada".
4. WHEN el Sistema genera el resumen de ventas y las ventas diarias, THE Sistema SHALL excluir los importes de las ventas con estado "Cancelada".
5. WHEN el Sistema genera cualquier Reporte_de_Ventas que incluya una venta con líneas devueltas, THE Sistema SHALL descontar las cantidades y los subtotales devueltos de los totales reportados para el producto, la categoría y el departamento correspondientes.
6. THE Sistema SHALL calcular los totales de los Reporte_de_Ventas de modo que reflejen el ingreso neto una vez descontadas cancelaciones y devoluciones.

### Requisito 9: Conservación e inmutabilidad de la venta (invariante de no eliminación)

**Historia de usuario:** Como propietaria, quiero que ninguna venta se borre nunca, para conservar la trazabilidad histórica completa del negocio.

#### Criterios de Aceptación

1. THE Sistema SHALL conservar toda Venta registrada sin eliminarla, independientemente de cancelaciones o devoluciones posteriores.
2. WHEN el Sistema procesa una Cancelación o una Devolución_Parcial, THE Sistema SHALL expresar el resultado mediante el estado de la Venta y mediante Registros_de_Cancelación o Registros_de_Devolución independientes.
3. THE Sistema SHALL conservar el total original y los Detalles_de_Venta originales de la Venta tras una cancelación o devolución.
4. WHEN la Propietaria consulta una Venta con estado "Cancelada", "Parcialmente Devuelta" o "Devuelta", THE Sistema SHALL presentar la Venta original junto con sus Registros_de_Cancelación o Registros_de_Devolución asociados.

### Requisito 10: Comprobante de cancelación o devolución

**Historia de usuario:** Como cajera, quiero generar un comprobante de la cancelación o devolución, para entregárselo al cliente y respaldar la operación.

#### Criterios de Aceptación

1. WHEN el Sistema completa una Cancelación, THE Sistema SHALL permitir generar un comprobante que incluya el folio de la Venta original, la fecha y hora, la Cajera, la sucursal, la caja, el Motivo y el monto devuelto.
2. WHEN el Sistema completa una Devolución_Parcial, THE Sistema SHALL permitir generar un comprobante que incluya el folio de la Venta original, la fecha y hora, la Cajera, la sucursal, la caja, el Motivo, las líneas devueltas con sus cantidades y el monto devuelto.
3. THE Sistema SHALL identificar claramente en el comprobante que se trata de una operación de cancelación o de devolución (no de una venta).

## Fuera de Alcance

- Autorización por supervisor o administrador para cancelar o devolver (la decisión de negocio es permitir a la cajera ejecutar ambas operaciones sin autorización adicional).
- Cambios de producto (intercambio de un artículo por otro) como operación distinta de la devolución.
- Reintegro automático a tarjeta o reversión de pagos con proveedor de pagos; el efecto monetario se modela como Movimiento_de_Efectivo de salida en la caja.
- Devoluciones que afecten créditos de cliente (`ClientCredit`) o depósitos de envases (`ClientContainerDeposit`); se tratarán como extensiones posteriores.
- Decisión entre cliente web (mariam-pos-front), escritorio (Electron) y móvil (mariam-pos-app) para exponer estas operaciones; el alcance de interfaz se definirá en la fase de diseño.
- Facturación fiscal o emisión de notas de crédito electrónicas.
- Límite de tiempo (días) para aceptar devoluciones: por decisión del negocio NO se aplica límite; se puede devolver en cualquier momento.

## Decisiones Tomadas

- **Efectivo al cancelar/devolver:** la salida de efectivo se registra SOLO cuando la venta fue cobrada en efectivo y se devuelve dinero al cliente; si no hubo cobro en efectivo (pendiente, tarjeta o regalo), solo cambia el estado y se excluye de reportes. El efectivo sale del Turno_de_Caja activo donde se ejecuta la operación, no del turno de la venta original.
- **Motivos:** se ofrecen Motivos_Sugeridos de un clic más una opción de motivo libre ("Otro motivo"). "Producto caducado" y "Producto defectuoso / dañado" se clasifican como merma (no regresan a inventario).
- **Inventario:** se afecta únicamente para productos con `trackInventory = true`; los demás no mueven stock.
- **Devolución de presentaciones:** la cantidad devuelta se convierte a la unidad base del producto usando la cantidad que contiene la presentación (ej. 1 Bulto de 20 kg → 20 kg). El inventario se mueve siempre en unidad base.
- **Turnos (mañana/día/tarde):** la salida de efectivo siempre se registra contra el turno ACTIVO donde se ejecuta la operación, sin importar en qué turno se hizo la venta original. Si hay devolución de efectivo y no hay turno abierto, el Sistema exige abrir un turno antes de continuar.
- **Comprobante:** sí se genera comprobante de cancelación y de devolución (Requisito 10).
- **Límite de días para devolver:** sin límite (se puede devolver en cualquier momento).
- **Turno original cerrado:** cancelar/devolver sobre una venta de un turno ya cerrado está permitido; la operación afecta el turno activo de hoy (no se reabre el turno original).

## Preguntas Abiertas

- Ninguna pendiente de bloqueo. El alcance de interfaz (web / escritorio / móvil) y el formato exacto del comprobante se definirán en la fase de diseño.
