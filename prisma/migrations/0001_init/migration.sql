-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'ADMINISTRATIVO', 'TECNICO');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PARTICULAR', 'EMPRESA', 'CONSORCIO');

-- CreateEnum
CREATE TYPE "TipoEquipo" AS ENUM ('SPLIT', 'PISO_TECHO', 'CASSETTE', 'VENTANA', 'PORTATIL', 'CENTRAL', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoTrabajo" AS ENUM ('INSTALACION', 'MANTENIMIENTO', 'REPARACION', 'CARGA_GAS', 'DESINSTALACION', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoTrabajo" AS ENUM ('PRESUPUESTO', 'APROBADO', 'EN_CURSO', 'TERMINADO', 'COBRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('A_CONFIRMAR', 'CONFIRMADO', 'REALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA', 'CHEQUE', 'OTRO');

-- CreateEnum
CREATE TYPE "Unidad" AS ENUM ('UNIDAD', 'METRO', 'KILO', 'PAR', 'ROLLO', 'LITRO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('COMPRA', 'CONSUMO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "CategoriaGasto" AS ENUM ('PERSONAL', 'MATERIALES', 'COMBUSTIBLE', 'HERRAMIENTAS', 'VEHICULO', 'IMPUESTOS', 'SERVICIOS', 'ALQUILER', 'OTROS');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL DEFAULT 'empresa',
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT NOT NULL DEFAULT 'Bajo Cero',
    "cuit" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "condicionesPresupuesto" TEXT,
    "garantia" TEXT,
    "validezPresupuestoDias" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'TECNICO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "empleadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'PARTICULAR',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "localidad" TEXT,
    "cuit" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoEquipo" NOT NULL DEFAULT 'SPLIT',
    "marca" TEXT,
    "modelo" TEXT,
    "frigorias" INTEGER,
    "ubicacion" TEXT,
    "fechaInstalacion" TIMESTAMP(3),
    "proximoMantenimiento" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trabajo" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoTrabajo" NOT NULL DEFAULT 'INSTALACION',
    "estado" "EstadoTrabajo" NOT NULL DEFAULT 'PRESUPUESTO',
    "direccion" TEXT,
    "descripcion" TEXT,
    "condiciones" TEXT,
    "fechaPresupuesto" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validoHasta" TIMESTAMP(3),
    "fechaAprobado" TIMESTAMP(3),
    "fechaTerminado" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTrabajo" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidad" TEXT,
    "precioUnitario" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "insumoId" TEXT,

    CONSTRAINT "ItemTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "hecho" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Foto" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'A_CONFIRMAR',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobro" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "trabajoId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" INTEGER NOT NULL,
    "medio" "MedioPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "concepto" TEXT,
    "comprobanteUrl" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rubro" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "cuit" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numeroFactura" TEXT,
    "total" INTEGER NOT NULL,
    "vencimiento" TIMESTAMP(3),
    "comprobanteUrl" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCompra" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "insumoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" INTEGER NOT NULL,

    CONSTRAINT "ItemCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoProveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "compraId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" INTEGER NOT NULL,
    "medio" "MedioPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "unidad" "Unidad" NOT NULL DEFAULT 'UNIDAD',
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoUnitario" INTEGER NOT NULL DEFAULT 0,
    "precioVenta" INTEGER,
    "proveedorId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" INTEGER,
    "trabajoId" TEXT,
    "compraId" TEXT,
    "notas" TEXT,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "puesto" TEXT NOT NULL DEFAULT 'Técnico',
    "telefono" TEXT,
    "jornal" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "trabajoId" TEXT,
    "horas" DOUBLE PRECISION,
    "monto" INTEGER NOT NULL,
    "notas" TEXT,

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" "CategoriaGasto" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "medio" "MedioPago" NOT NULL DEFAULT 'EFECTIVO',
    "empleadoId" TEXT,
    "trabajoId" TEXT,
    "proveedorId" TEXT,
    "compraId" TEXT,
    "comprobanteUrl" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EmpleadoToTurno" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EmpleadoToTurno_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empleadoId_key" ON "Usuario"("empleadoId");

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "Equipo_clienteId_idx" ON "Equipo"("clienteId");

-- CreateIndex
CREATE INDEX "Equipo_proximoMantenimiento_idx" ON "Equipo"("proximoMantenimiento");

-- CreateIndex
CREATE UNIQUE INDEX "Trabajo_numero_key" ON "Trabajo"("numero");

-- CreateIndex
CREATE INDEX "Trabajo_clienteId_idx" ON "Trabajo"("clienteId");

-- CreateIndex
CREATE INDEX "Trabajo_estado_idx" ON "Trabajo"("estado");

-- CreateIndex
CREATE INDEX "ItemTrabajo_trabajoId_idx" ON "ItemTrabajo"("trabajoId");

-- CreateIndex
CREATE INDEX "ChecklistItem_trabajoId_idx" ON "ChecklistItem"("trabajoId");

-- CreateIndex
CREATE INDEX "Foto_trabajoId_idx" ON "Foto"("trabajoId");

-- CreateIndex
CREATE INDEX "Turno_inicio_idx" ON "Turno"("inicio");

-- CreateIndex
CREATE INDEX "Turno_trabajoId_idx" ON "Turno"("trabajoId");

-- CreateIndex
CREATE INDEX "Cobro_clienteId_idx" ON "Cobro"("clienteId");

-- CreateIndex
CREATE INDEX "Cobro_trabajoId_idx" ON "Cobro"("trabajoId");

-- CreateIndex
CREATE INDEX "Cobro_fecha_idx" ON "Cobro"("fecha");

-- CreateIndex
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");

-- CreateIndex
CREATE INDEX "Compra_fecha_idx" ON "Compra"("fecha");

-- CreateIndex
CREATE INDEX "ItemCompra_compraId_idx" ON "ItemCompra"("compraId");

-- CreateIndex
CREATE INDEX "PagoProveedor_proveedorId_idx" ON "PagoProveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "PagoProveedor_compraId_idx" ON "PagoProveedor"("compraId");

-- CreateIndex
CREATE INDEX "Insumo_nombre_idx" ON "Insumo"("nombre");

-- CreateIndex
CREATE INDEX "MovimientoStock_insumoId_idx" ON "MovimientoStock"("insumoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_trabajoId_idx" ON "MovimientoStock"("trabajoId");

-- CreateIndex
CREATE INDEX "Jornada_empleadoId_idx" ON "Jornada"("empleadoId");

-- CreateIndex
CREATE INDEX "Jornada_fecha_idx" ON "Jornada"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_compraId_key" ON "Gasto"("compraId");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE INDEX "Gasto_categoria_idx" ON "Gasto"("categoria");

-- CreateIndex
CREATE INDEX "_EmpleadoToTurno_B_index" ON "_EmpleadoToTurno"("B");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTrabajo" ADD CONSTRAINT "ItemTrabajo_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTrabajo" ADD CONSTRAINT "ItemTrabajo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmpleadoToTurno" ADD CONSTRAINT "_EmpleadoToTurno_A_fkey" FOREIGN KEY ("A") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmpleadoToTurno" ADD CONSTRAINT "_EmpleadoToTurno_B_fkey" FOREIGN KEY ("B") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
