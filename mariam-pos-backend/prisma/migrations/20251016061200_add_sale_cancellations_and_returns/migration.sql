-- CreateTable
CREATE TABLE "SaleCancellation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonType" TEXT NOT NULL DEFAULT 'ESTANDAR',
    "createdBy" TEXT,
    "branch" TEXT,
    "cashRegister" TEXT,
    "shiftId" INTEGER,
    "cashMovementId" INTEGER,
    "refundedAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleCancellation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleCancellation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashRegisterShift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonType" TEXT NOT NULL DEFAULT 'ESTANDAR',
    "createdBy" TEXT,
    "branch" TEXT,
    "cashRegister" TEXT,
    "shiftId" INTEGER,
    "cashMovementId" INTEGER,
    "refundedAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleReturn_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashRegisterShift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleReturnLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleReturnId" INTEGER NOT NULL,
    "saleDetailId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "baseUnitQuantity" REAL NOT NULL,
    "subTotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturnLine_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleReturnLine_saleDetailId_fkey" FOREIGN KEY ("saleDetailId") REFERENCES "SaleDetail" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SaleDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quantity" REAL NOT NULL,
    "price" REAL NOT NULL,
    "subTotal" REAL NOT NULL,
    "productName" TEXT,
    "unitAbbrev" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedQuantity" REAL NOT NULL DEFAULT 0,
    "baseUnitQuantity" REAL,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    CONSTRAINT "SaleDetail_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SaleDetail" ("createdAt", "id", "price", "productId", "productName", "quantity", "saleId", "subTotal", "unitAbbrev") SELECT "createdAt", "id", "price", "productId", "productName", "quantity", "saleId", "subTotal", "unitAbbrev" FROM "SaleDetail";
DROP TABLE "SaleDetail";
ALTER TABLE "new_SaleDetail" RENAME TO "SaleDetail";
CREATE INDEX "SaleDetail_saleId_idx" ON "SaleDetail"("saleId");
CREATE INDEX "SaleDetail_productId_idx" ON "SaleDetail"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SaleCancellation_saleId_key" ON "SaleCancellation"("saleId");

-- CreateIndex
CREATE INDEX "SaleCancellation_saleId_idx" ON "SaleCancellation"("saleId");

-- CreateIndex
CREATE INDEX "SaleCancellation_shiftId_idx" ON "SaleCancellation"("shiftId");

-- CreateIndex
CREATE INDEX "SaleCancellation_createdAt_idx" ON "SaleCancellation"("createdAt");

-- CreateIndex
CREATE INDEX "SaleReturn_saleId_idx" ON "SaleReturn"("saleId");

-- CreateIndex
CREATE INDEX "SaleReturn_shiftId_idx" ON "SaleReturn"("shiftId");

-- CreateIndex
CREATE INDEX "SaleReturn_createdAt_idx" ON "SaleReturn"("createdAt");

-- CreateIndex
CREATE INDEX "SaleReturnLine_saleReturnId_idx" ON "SaleReturnLine"("saleReturnId");

-- CreateIndex
CREATE INDEX "SaleReturnLine_saleDetailId_idx" ON "SaleReturnLine"("saleDetailId");
