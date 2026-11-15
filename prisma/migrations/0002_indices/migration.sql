-- DropIndex
DROP INDEX "Compra_proveedorId_idx";

-- DropIndex
DROP INDEX "PagoProveedor_proveedorId_idx";

-- CreateIndex
CREATE INDEX "Compra_proveedorId_fecha_idx" ON "Compra"("proveedorId", "fecha");

-- CreateIndex
CREATE INDEX "Gasto_trabajoId_idx" ON "Gasto"("trabajoId");

-- CreateIndex
CREATE INDEX "Gasto_empleadoId_fecha_idx" ON "Gasto"("empleadoId", "fecha");

-- CreateIndex
CREATE INDEX "Jornada_trabajoId_idx" ON "Jornada"("trabajoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_fecha_idx" ON "MovimientoStock"("fecha");

-- CreateIndex
CREATE INDEX "PagoProveedor_proveedorId_fecha_idx" ON "PagoProveedor"("proveedorId", "fecha");

-- CreateIndex
CREATE INDEX "Trabajo_fechaTerminado_idx" ON "Trabajo"("fechaTerminado");
