# Requisitos — Productos de Precio Abierto

## Introducción

Hoy el POS permite cobrar un importe libre mediante el "Producto Común" (código `000000`),
que abre un modal pidiendo nombre, precio y cantidad. El problema: ese producto es **anónimo**,
no queda ligado a una categoría ni departamento, por lo que en los reportes cae como
"Producto no registrado" y no aporta información útil de negocio.

Esta feature introduce un nuevo tipo de venta, **Precio Abierto** (`saleType = "PrecioAbierto"`),
para registrar productos permanentes en el catálogo (con nombre, categoría y departamento fijos)
cuyo **precio se define al momento de vender**. El objetivo es **reemplazar el uso del Producto Común**
por productos registrados que sí sumen correctamente en los reportes por categoría y departamento.

Características del tipo Precio Abierto:
- El precio NO está fijo en el catálogo; lo escribe el cajero en cada venta (arranca en blanco).
- La cantidad es siempre 1 (no editable).
- No maneja inventario.
- Es excluyente con presentaciones, precio escalonado (tiered) y promoción.

## Glosario

- **Precio Abierto**: tipo de producto cuyo precio se captura en la venta, no en el catálogo.
- **Producto Común**: mecanismo actual de importe libre anónimo (código `000000`). A reemplazar.
- **saleType**: campo del producto que determina el flujo de venta ("Pieza", "Granel", "PrecioAbierto").

---

## Requisitos

### Requisito 1 — Registrar un producto de Precio Abierto en el catálogo

**Historia de usuario:** Como administrador del catálogo, quiero crear productos marcados como
"Precio Abierto" ligados a una categoría, para que las ventas de importe libre queden registradas
y aporten a los reportes por categoría y departamento.

#### Criterios de aceptación

1. CUANDO el usuario crea o edita un producto ENTONCES el formulario DEBE ofrecer el tipo de venta "Precio Abierto" junto a los tipos existentes (Pieza, Granel).
2. CUANDO el usuario selecciona el tipo "Precio Abierto" ENTONCES el sistema DEBE ocultar los campos "Precio base" y "Costo".
3. CUANDO los campos "Precio base" y "Costo" se ocultan ENTONCES el sistema DEBE mostrar en su lugar la leyenda "El precio se definirá al momento de la venta".
4. CUANDO el usuario guarda un producto de tipo "Precio Abierto" ENTONCES el sistema DEBE persistir `saleType = "PrecioAbierto"` y un precio base de 0.
5. CUANDO el usuario guarda un producto de tipo "Precio Abierto" ENTONCES el sistema DEBE exigir nombre y categoría como cualquier otro producto.
6. CUANDO el usuario guarda un producto de tipo "Precio Abierto" ENTONCES el sistema NO DEBE exigir que el precio base ni el costo sean mayores a 0.

### Requisito 2 — Exclusividad con otras modalidades de precio

**Historia de usuario:** Como administrador, quiero que "Precio Abierto" no se combine con presentaciones,
precio escalonado ni promoción, para evitar configuraciones contradictorias.

#### Criterios de aceptación

1. CUANDO el producto es de tipo "Precio Abierto" ENTONCES el sistema NO DEBE permitir configurar presentaciones.
2. CUANDO el producto es de tipo "Precio Abierto" ENTONCES el sistema NO DEBE permitir activar precio escalonado (tiered).
3. CUANDO el producto es de tipo "Precio Abierto" ENTONCES el sistema NO DEBE permitir activar promoción.
4. CUANDO el producto es de tipo "Precio Abierto" ENTONCES el sistema NO DEBE permitir activar inventario.
5. CUANDO el usuario cambia un producto a tipo "Precio Abierto" teniendo configuradas presentaciones, tiered o promoción ENTONCES el sistema DEBE ocultar/limpiar esas secciones para que no se guarden.

### Requisito 3 — Capturar el precio al momento de la venta

**Historia de usuario:** Como cajero, quiero que al vender un producto de Precio Abierto se me pida
el precio en un modal simple, para cobrar el importe que corresponda en ese momento.

#### Criterios de aceptación

1. CUANDO el cajero agrega a la venta un producto con `saleType = "PrecioAbierto"` ENTONCES el sistema DEBE abrir un modal que pida únicamente el precio.
2. CUANDO se abre el modal de precio ENTONCES el campo de precio DEBE estar en blanco (sin 0 precargado) y mostrar un mensaje de fondo (placeholder) indicando que ingrese el precio.
3. CUANDO se abre el modal de precio ENTONCES el sistema NO DEBE mostrar ni permitir editar la cantidad (la cantidad es siempre 1).
4. CUANDO el cajero confirma con un precio mayor a 0 ENTONCES el sistema DEBE agregar el producto al carrito con cantidad 1 y ese precio.
5. CUANDO el cajero confirma con un precio vacío, 0 o inválido ENTONCES el sistema DEBE mostrar una validación y NO agregar el producto.
6. CUANDO el cajero cancela el modal ENTONCES el sistema NO DEBE agregar el producto y DEBE devolver el foco al buscador.
7. CUANDO el producto se agrega al carrito ENTONCES el subtotal de esa línea DEBE ser igual al precio capturado (precio × 1).

### Requisito 4 — Comportamiento en el carrito

**Historia de usuario:** Como cajero, quiero que en el carrito el producto de Precio Abierto se comporte
de forma consistente, para evitar confusiones con cantidades.

#### Criterios de aceptación

1. CUANDO un producto de Precio Abierto está en el carrito ENTONCES el sistema NO DEBE mostrar los controles de cantidad (+/−).
2. CUANDO un producto de Precio Abierto está en el carrito ENTONCES su cantidad DEBE permanecer en 1.
3. CUANDO el cajero agrega dos veces el mismo producto de Precio Abierto ENTONCES el sistema DEBE tratarlos como líneas independientes (cada una con su precio capturado), NO sumar cantidad.

### Requisito 5 — Ventas pendientes

**Historia de usuario:** Como cajero, quiero poder guardar y cargar ventas pendientes que incluyan
productos de Precio Abierto, para no perder el precio capturado.

#### Criterios de aceptación

1. CUANDO se guarda como pendiente una venta con un producto de Precio Abierto ENTONCES el sistema DEBE preservar el precio capturado y la cantidad 1.
2. CUANDO se carga una venta pendiente con un producto de Precio Abierto ENTONCES el sistema DEBE restaurar el precio capturado y la cantidad 1 sin volver a pedir el precio.

### Requisito 6 — Reportes

**Historia de usuario:** Como dueño, quiero que las ventas de Precio Abierto aparezcan en los reportes
por categoría y departamento, para medir cuánto venden estos productos.

#### Criterios de aceptación

1. CUANDO se vende un producto de Precio Abierto ENTONCES su importe DEBE sumar en el reporte de ventas por categoría según la categoría del producto.
2. CUANDO se vende un producto de Precio Abierto ENTONCES su importe DEBE sumar en el reporte de ventas por departamento según el departamento de su categoría.
3. CUANDO se consulta el reporte de productos más vendidos ENTONCES los productos de Precio Abierto DEBEN aparecer con su nombre real (no como "Producto no registrado").

### Requisito 7 — Transición desde el Producto Común

**Historia de usuario:** Como dueño, quiero migrar del Producto Común a productos de Precio Abierto
registrados, para mejorar la calidad de los reportes.

#### Criterios de aceptación

1. CUANDO esta feature esté disponible ENTONCES el sistema DEBE seguir soportando las ventas históricas ya registradas con el Producto Común (no se rompen datos existentes).
2. CUANDO el equipo decida reemplazar el Producto Común ENTONCES la decisión de ocultar o quitar el botón "Sin código" DEBE quedar documentada como paso posterior (fuera del alcance técnico mínimo de esta feature, a confirmar con el usuario).

---

## Fuera de alcance (por ahora)

- Quitar o deshabilitar el botón "Sin código" / Producto Común (se evaluará después de validar la nueva feature).
- Permitir cantidad distinta de 1 en productos de Precio Abierto.
- Precio sugerido precargado en el modal de venta (se decidió arrancar en blanco).

## Preguntas abiertas

- Ninguna pendiente de bloqueo. (El reemplazo del botón "Sin código" se tratará como paso posterior.)
