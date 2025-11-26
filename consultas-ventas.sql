SELECT 
 
  DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City') AS fecha_local,
  id,
  folio,
  total,
  status,
  "paymentMethod",
  "createdAt",
  "clientName",
  "syncStatus",
  branch,
  "cashRegister"
FROM public."Sale" order by id desc ;

SELECT 
  DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') AS fecha,
  COUNT(*) AS total_ventas,
  TO_CHAR(SUM(total), 'FM$999,999,990.00') AS total_dinero
FROM public."Sale" 
GROUP BY 1
ORDER BY 1 DESC limit 100;

SELECT 
  "branch" as Suculsal,
  "paymentMethod" as "Metodo de pago",
  DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') AS fecha,
  COUNT(*) AS total_ventas,
  TO_CHAR(SUM(total), 'FM$999,999,990.00') AS total_dinero
FROM public."Sale"
WHERE 
  "branch" = 'Mini Super Curiel' 
  AND  "createdAt" >= '2025-11-19T06:00:00.000Z'
  AND "createdAt" <= '2025-11-20T05:59:59.999Z'
GROUP BY 1, 2, 3
ORDER BY 3 DESC, 2;


SELECT 
  "branch" as Suculsal,
  "paymentMethod" as "Metodo de pago",
  DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') AS fecha,
  COUNT(*) AS total_ventas,
  TO_CHAR(SUM(total), 'FM$999,999,990.00') AS total_dinero
FROM public."Sale"
WHERE 
  "branch" = 'Papeleria Curiel' 
 GROUP BY 1, 2, 3
ORDER BY 3 DESC, 2;

SELECT 
  DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') AS fecha,
  COUNT(*) AS total_ventas,
  TO_CHAR(SUM(total), 'FM$999,999,990.00') AS total_dinero,
  TO_CHAR(SUM(total) * 0.20, 'FM$999,999,990.00') AS ganancia_20,
  TO_CHAR(SUM(total) * 0.35, 'FM$999,999,990.00') AS ganancia_35
FROM public."Sale" where  "branch" = 'Papeleria Curiel' 
GROUP BY 1
ORDER BY 1 DESC;

SELECT 
  DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') AS fecha,
  COUNT(*) AS total_ventas,
  TO_CHAR(SUM(total), 'FM$999,999,990.00') AS total_dinero,
  TO_CHAR(SUM(total) * 0.20, 'FM$999,999,990.00') AS ganancia_20,
  TO_CHAR(SUM(total) * 0.30, 'FM$999,999,990.00') AS ganancia_30
FROM public."Sale" where  "branch" = 'Mini Super Curiel' 
GROUP BY 1
ORDER BY 1 DESC;

SELECT sum(quantity) cantidad, sum("subTotal") as "total", "productName" 
	FROM public."SaleDetail" group by "productName" order by "cantidad" desc ;

SELECT  DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') AS fecha, *
	FROM public."SaleDetail" order by id desc limit 100;
	
SELECT id, quantity, price, "subTotal", "productName", "createdAt", "saleId", DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') AS fecha
	FROM public."SaleDetail" where "saleId" in (1960,1959)  order by id desc;

SELECT 
  DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City') AS fecha_local,
  "createdAt", id, folio, total
FROM public."Sale"
WHERE ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City'
      BETWEEN TIMESTAMP '2025-11-08 00:00:00' 
          AND TIMESTAMP '2025-11-08 23:59:59'
ORDER BY "createdAt" DESC;


SELECT
  DATE(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')) AS fecha,
  id, folio, total, status, "paymentMethod", "createdAt", "clientName", "syncStatus", branch, "cashRegister"
FROM public."Sale"
WHERE  "branch" = 'Mini Super Curiel' 
  AND  "createdAt" >= '2025-11-08T06:00:00.000Z'
  AND "createdAt" <= '2025-11-09T05:59:59.999Z'
  order by id desc;

 