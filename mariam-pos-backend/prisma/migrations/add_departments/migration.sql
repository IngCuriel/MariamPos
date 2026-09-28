-- Departamentos que agrupan categorías (Papelería, Abarrotes, etc.).
-- Y relación opcional Categoría -> Departamento.
-- Migración aditiva y segura: no toca datos existentes.

CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "status" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'pendiente',
    "branch" TEXT DEFAULT 'Sucursal Default'
);

CREATE INDEX "Department_syncStatus_idx" ON "Department"("syncStatus");
CREATE INDEX "Department_branch_idx" ON "Department"("branch");
CREATE INDEX "Department_status_idx" ON "Department"("status");

-- Categoría puede pertenecer a un departamento (opcional).
ALTER TABLE "Category" ADD COLUMN "departmentId" TEXT;
CREATE INDEX "Category_departmentId_idx" ON "Category"("departmentId");
