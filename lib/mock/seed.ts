// Datos de ejemplo de Bajo Cero, armados en relación a "hoy" para que la
// agenda, los vencimientos y el mes en curso siempre tengan contenido.
// Mismos nombres y montos que el diseño.
import { fechaAR, inicioDia, partesAR, sumarDias, sumarMeses } from "@/lib/fechas";
import {
  nuevaCompra,
  nuevaJornada,
  nuevoChecklistItem,
  nuevoCliente,
  nuevoCobro,
  nuevoEmpleado,
  nuevoEquipo,
  nuevoGasto,
  nuevoInsumo,
  nuevoItemCompra,
  nuevoItemTrabajo,
  nuevoMovimiento,
  nuevoPagoProveedor,
  nuevoProveedor,
  nuevoTrabajo,
  nuevoTurno,
} from "./fabricas";
import type { Store } from "./store";
import type { TipoTrabajo } from "@/lib/generated/prisma/enums";

export function crearDatosDeEjemplo(ahora: Date): Store {
  const hoy = inicioDia(ahora);
  const p = partesAR(ahora);

  /** Día relativo a hoy, a una hora de Argentina. */
  const dia = (offset: number, hora = 10, minuto = 0) => {
    const q = partesAR(sumarDias(hoy, offset));
    return fechaAR(q.anio, q.mes, q.dia, hora, minuto);
  };
  /** Día N del mes en curso, sin pasarse de hoy. */
  const delMes = (n: number, hora = 10) => fechaAR(p.anio, p.mes, Math.min(n, p.dia), hora);
  /** Día N de hace `atras` meses. */
  const mesAtras = (atras: number, n: number, hora = 10) => {
    const q = partesAR(sumarMeses(fechaAR(p.anio, p.mes, 1), -atras));
    return fechaAR(q.anio, q.mes, n, hora);
  };

  const s: Store = {
    empresa: {
      id: "empresa",
      razonSocial: "[RAZÓN SOCIAL]",
      nombreFantasia: "Bajo Cero",
      cuit: null,
      telefono: null,
      email: null,
      direccion: null,
      condicionesPresupuesto:
        "Seña del 50 % para reservar la fecha; el saldo al terminar.\nPasada la fecha de validez, los precios pueden cambiar.",
      garantia: null,
      validezPresupuestoDias: 15,
    },
    clientes: [],
    equipos: [],
    trabajos: [],
    items: [],
    checklist: [],
    fotos: [],
    turnos: [],
    turnoTecnicos: [],
    cobros: [],
    proveedores: [],
    compras: [],
    itemsCompra: [],
    pagosProveedor: [],
    insumos: [],
    movimientos: [],
    empleados: [],
    jornadas: [],
    gastos: [],
  };

  // ───────── Personal ─────────
  const diego = nuevoEmpleado({ nombre: "Diego", puesto: "Técnico", jornal: 40_000, telefono: "11 5555-0201" });
  const nico = nuevoEmpleado({ nombre: "Nico", puesto: "Ayudante", jornal: 26_000, telefono: "11 5555-0202" });
  s.empleados.push(diego, nico);

  // ───────── Clientes ─────────
  const marta = nuevoCliente({ nombre: "Marta Giménez", telefono: "11 5555-0101", direccion: "Av. San Martín 1420, 3.º B" });
  const alvear = nuevoCliente({
    nombre: "Consorcio Edificio Alvear",
    tipo: "CONSORCIO",
    telefono: "11 5555-0102",
    direccion: "Alvear 850",
    notas: "Coordinar con el encargado (Ramón). Llaves de la terraza en portería.",
  });
  const farmacia = nuevoCliente({
    nombre: "Farmacia Del Sol",
    tipo: "EMPRESA",
    telefono: "11 5555-0103",
    direccion: "Belgrano 2210",
  });
  const lucas = nuevoCliente({ nombre: "Lucas Ferreyra", telefono: "11 5555-0104", direccion: "Los Aromos 233" });
  const carolina = nuevoCliente({ nombre: "Carolina Paz", telefono: "11 5555-0105", direccion: "Mitre 77, 1.º A" });
  const taller = nuevoCliente({
    nombre: "Taller Rodríguez Hnos.",
    tipo: "EMPRESA",
    telefono: "11 5555-0106",
    direccion: "Ruta 9 km 12",
  });
  const julieta = nuevoCliente({ nombre: "Julieta Sosa", telefono: "11 5555-0107", direccion: "Rivadavia 3015" });
  s.clientes.push(marta, alvear, farmacia, lucas, carolina, taller, julieta);

  // ───────── Equipos de los clientes ─────────
  s.equipos.push(
    nuevoEquipo({
      clienteId: marta.id,
      frigorias: 3000,
      ubicacion: "Living",
      fechaInstalacion: dia(0),
      proximoMantenimiento: sumarMeses(dia(0), 12),
    }),
    nuevoEquipo({ clienteId: alvear.id, frigorias: 4500, ubicacion: "Hall de entrada", proximoMantenimiento: dia(0) }),
    nuevoEquipo({ clienteId: alvear.id, tipo: "PISO_TECHO", frigorias: 9000, ubicacion: "SUM", proximoMantenimiento: dia(0) }),
    nuevoEquipo({ clienteId: taller.id, tipo: "CASSETTE", frigorias: 6000, ubicacion: "Oficina" }),
    nuevoEquipo({ clienteId: julieta.id, frigorias: 2250, ubicacion: "Dormitorio", proximoMantenimiento: dia(20) }),
    nuevoEquipo({ clienteId: carolina.id, frigorias: 3000, ubicacion: "Living", proximoMantenimiento: dia(-5) }),
  );

  // ───────── Trabajos ─────────
  let numero = 120;
  const trabajo = (
    clienteId: string,
    titulo: string,
    tipo: TipoTrabajo,
    estado: Parameters<typeof nuevoTrabajo>[0]["estado"],
    creado: Date,
    items: [string, number, number, string?][],
    extra: Partial<Parameters<typeof nuevoTrabajo>[0]> = {},
  ) => {
    const t = nuevoTrabajo(
      {
        clienteId,
        titulo,
        tipo,
        estado,
        numero: ++numero,
        fechaPresupuesto: creado,
        validoHasta: sumarDias(creado, 15),
        ...extra,
      },
      creado,
    );
    s.trabajos.push(t);
    items.forEach(([descripcion, cantidad, precioUnitario, unidad], orden) =>
      s.items.push(nuevoItemTrabajo({ trabajoId: t.id, descripcion, cantidad, precioUnitario, unidad: unidad ?? null, orden })),
    );
    return t;
  };

  const turno = (
    trabajoId: string,
    inicio: Date,
    horas: number,
    estado: Parameters<typeof nuevoTurno>[0]["estado"],
    tecnicos: string[],
    notas: string | null = null,
  ) => {
    const t = nuevoTurno({ trabajoId, inicio, fin: new Date(inicio.getTime() + horas * 3_600_000), estado, notas });
    s.turnos.push(t);
    tecnicos.forEach((empleadoId) => s.turnoTecnicos.push({ turnoId: t.id, empleadoId }));
    return t;
  };

  const cobro = (clienteId: string, trabajoId: string, monto: number, fecha: Date, concepto: string, medio: Parameters<typeof nuevoCobro>[0]["medio"] = "TRANSFERENCIA") =>
    s.cobros.push(nuevoCobro({ clienteId, trabajoId, monto, fecha, concepto, medio }, fecha));

  // — Historial de los 5 meses anteriores (para reportes) —
  const historico: { cobrado: number; gastos: number }[] = [
    { cobrado: 2_000_000, gastos: 1_240_000 },
    { cobrado: 1_590_000, gastos: 1_050_000 },
    { cobrado: 1_240_000, gastos: 950_000 },
    { cobrado: 910_000, gastos: 800_000 },
    { cobrado: 1_100_000, gastos: 850_000 },
  ];
  const clientesHist = [taller, julieta, lucas, marta, alvear];
  const titulosHist: [string, TipoTrabajo][] = [
    ["Instalación split 4500 fg", "INSTALACION"],
    ["Mantenimiento de equipos", "MANTENIMIENTO"],
    ["Reparación de pérdida de gas", "REPARACION"],
  ];
  historico.forEach(({ cobrado, gastos }, i) => {
    const atras = i + 1;
    [0.5, 0.3, 0.2].forEach((frac, k) => {
      const monto = Math.round((cobrado * frac) / 1000) * 1000;
      const [titulo, tipo] = titulosHist[k];
      const cli = clientesHist[(i + k) % clientesHist.length];
      const fecha = mesAtras(atras, 5 + k * 8);
      const t = trabajo(cli.id, titulo, tipo, "COBRADO", fecha, [["Mano de obra y materiales", 1, monto]], {
        fechaAprobado: fecha,
        fechaTerminado: fecha,
      });
      turno(t.id, fechaAR(partesAR(fecha).anio, partesAR(fecha).mes, partesAR(fecha).dia, 9), 4, "REALIZADO", [diego.id, nico.id]);
      cobro(cli.id, t.id, monto, fecha, "Pago total");
    });
    const reparto: [Parameters<typeof nuevoGasto>[0]["categoria"], number, string][] = [
      ["PERSONAL", 0.55, "Jornales del mes"],
      ["MATERIALES", 0.28, "Compras de materiales"],
      ["COMBUSTIBLE", 0.1, "Nafta de la camioneta"],
      ["HERRAMIENTAS", 0.04, "Herramientas y repuestos"],
      ["IMPUESTOS", 0.03, "Monotributo"],
    ];
    reparto.forEach(([categoria, frac, descripcion], k) => {
      const fecha = mesAtras(atras, 3 + k * 5);
      s.gastos.push(nuevoGasto({ categoria, descripcion, monto: Math.round((gastos * frac) / 1000) * 1000, fecha }, fecha));
    });
  });

  // — Trabajos ya cobrados este mes —
  const t144 = trabajo(taller.id, "Mantenimiento de 6 equipos", "MANTENIMIENTO", "COBRADO", delMes(2), [
    ["Mantenimiento preventivo por equipo", 6, 80_000],
  ], { fechaAprobado: delMes(2), fechaTerminado: delMes(4) });
  turno(t144.id, delMes(4, 9), 6, "REALIZADO", [diego.id, nico.id]);
  cobro(taller.id, t144.id, 480_000, delMes(4), "Pago total");

  const t145 = trabajo(julieta.id, "Instalación split 2250 fg", "INSTALACION", "COBRADO", delMes(3), [
    ["Mano de obra de instalación", 1, 260_000],
    ["Caño de cobre 1/4″ y 3/8″", 4, 25_000, "m"],
    ["Ménsulas reforzadas", 1, 30_000, "par"],
    ["Cable, aislación y desagüe", 1, 45_000],
  ], { fechaAprobado: delMes(3), fechaTerminado: delMes(6) });
  turno(t145.id, delMes(6, 9), 4, "REALIZADO", [diego.id, nico.id]);
  cobro(julieta.id, t145.id, 435_000, delMes(6), "Pago total", "EFECTIVO");

  // — Marta: instalación hoy, con seña —
  const t146 = trabajo(marta.id, "Instalación split 3000 fg", "INSTALACION", "EN_CURSO", dia(-7), [
    ["Mano de obra de instalación", 1, 280_000],
    ["Caño de cobre 1/4″ y 3/8″", 4, 16_000, "m"],
    ["Cable tipo taller 5×1,5", 6, 3_500, "m"],
    ["Ménsulas reforzadas", 1, 30_000, "par"],
    ["Aislación, cinta y desagüe", 1, 25_000],
  ], {
    fechaAprobado: dia(-6),
    condiciones: null,
    descripcion: "Equipo provisto por el cliente. Unidad exterior en el balcón.",
  });
  turno(t146.id, dia(0, 9), 3, "CONFIRMADO", [diego.id, nico.id]);
  cobro(marta.id, t146.id, 210_000, delMes(8), "Seña");
  [
    "Ubicar unidad interior y exterior",
    "Amurar ménsulas",
    "Perforar el pasaje de la cañería",
    "Tender cañería, cable y desagüe",
    "Hacer vacío",
    "Abrir llaves y probar pérdidas",
    "Prueba de funcionamiento y limpieza",
  ].forEach((texto, orden) => s.checklist.push(nuevoChecklistItem({ trabajoId: t146.id, texto, orden, hecho: orden < 4 })));

  // — Farmacia: aprobado, con seña, sin fecha —
  const t147 = trabajo(farmacia.id, "Instalación de 2 equipos piso-techo", "INSTALACION", "APROBADO", dia(-9), [
    ["Mano de obra de instalación (2 equipos)", 1, 1_100_000],
    ["Caño de cobre 3/8″ y 5/8″", 14, 30_000, "m"],
    ["Cable tipo taller 5×2,5", 24, 3_500, "m"],
    ["Soportes para piso-techo", 2, 45_000, "pares"],
    ["Tablero y térmicas", 1, 156_000],
  ], { fechaAprobado: dia(-4) });
  cobro(farmacia.id, t147.id, 925_000, delMes(10), "Seña");

  // — Consorcio: mantenimiento en dos días, sin cobros —
  const t148 = trabajo(alvear.id, "Mantenimiento de 8 equipos", "MANTENIMIENTO", "EN_CURSO", dia(-12), [
    ["Mantenimiento preventivo por equipo", 8, 80_000],
  ], { fechaAprobado: dia(-10) });
  turno(t148.id, dia(0, 13, 30), 3, "A_CONFIRMAR", [diego.id, nico.id], "Día 1 de 2");
  turno(t148.id, dia(1, 15), 3, "A_CONFIRMAR", [diego.id, nico.id], "Día 2 de 2");

  // — Carolina: presupuesto enviado que vence mañana —
  trabajo(carolina.id, "Mantenimiento anual", "MANTENIMIENTO", "PRESUPUESTO", dia(-14), [
    ["Mantenimiento preventivo de split", 1, 60_000],
  ], { validoHasta: dia(1) });

  // — Lucas: carga de gas hoy, pagada por adelantado —
  const t150 = trabajo(lucas.id, "Carga de gas R410A", "CARGA_GAS", "APROBADO", dia(-3), [
    ["Carga de gas R410A", 1.5, 40_000, "kg"],
    ["Mano de obra", 1, 35_000],
  ], { fechaAprobado: dia(-2) });
  turno(t150.id, dia(0, 17), 1, "CONFIRMADO", [diego.id]);
  cobro(lucas.id, t150.id, 95_000, delMes(12), "Pago total", "MERCADO_PAGO");

  // — Taller: reparación mañana, pagada —
  const t151 = trabajo(taller.id, "Reparación de equipo cassette", "REPARACION", "EN_CURSO", dia(-5), [
    ["Diagnóstico y reparación de placa", 1, 150_000],
  ], { fechaAprobado: dia(-4) });
  turno(t151.id, dia(1, 10), 2, "CONFIRMADO", [diego.id]);
  cobro(taller.id, t151.id, 150_000, delMes(11), "Pago total");

  // — Julieta: mantenimiento pasado mañana, pagado —
  const t152 = trabajo(julieta.id, "Mantenimiento de split", "MANTENIMIENTO", "APROBADO", dia(-2), [
    ["Mantenimiento preventivo de split", 1, 45_000],
  ], { fechaAprobado: dia(-1) });
  turno(t152.id, dia(2, 9), 1.5, "CONFIRMADO", [nico.id]);
  cobro(julieta.id, t152.id, 45_000, delMes(13), "Pago total", "EFECTIVO");

  // ───────── Proveedores ─────────
  const norte = nuevoProveedor({ nombre: "Refrigeración Norte", rubro: "Caños, gas y repuestos", contacto: "Sergio", telefono: "11 5555-0301" });
  const electricidad = nuevoProveedor({ nombre: "Electricidad Central", rubro: "Cables y térmicas", telefono: "11 5555-0302" });
  const tornillo = nuevoProveedor({ nombre: "Ferretería El Tornillo", rubro: "Fijaciones y ménsulas", telefono: "11 5555-0303" });
  const mayorista = nuevoProveedor({ nombre: "Mayorista de Climatización", rubro: "Equipos split y piso-techo", telefono: "11 5555-0304" });
  s.proveedores.push(norte, electricidad, tornillo, mayorista);

  // ───────── Insumos ─────────
  const ins = (nombre: string, categoria: string, unidad: Parameters<typeof nuevoInsumo>[0]["unidad"], stock: number, stockMinimo: number, costoUnitario: number, precioVenta: number, proveedorId: string) => {
    const i = nuevoInsumo({ nombre, categoria, unidad, stock, stockMinimo, costoUnitario, precioVenta, proveedorId });
    s.insumos.push(i);
    return i;
  };
  const cano14 = ins("Caño de cobre 1/4″", "Cañería", "METRO", 6, 15, 7_500, 9_500, norte.id);
  const cano38 = ins("Caño de cobre 3/8″", "Cañería", "METRO", 22, 15, 9_800, 12_500, norte.id);
  const r410 = ins("Gas R410A", "Gas refrigerante", "KILO", 2.5, 5, 28_000, 40_000, norte.id);
  const mensulas = ins("Ménsulas reforzadas", "Soportes", "PAR", 2, 4, 21_000, 30_000, tornillo.id);
  const cable = ins("Cable tipo taller 5×1,5", "Electricidad", "METRO", 48, 20, 2_400, 3_500, electricidad.id);
  const aislacion = ins("Aislación 3/8″", "Aislación", "METRO", 30, 15, 1_900, 2_800, norte.id);
  ins("Cinta de PVC", "Aislación", "ROLLO", 12, 6, 1_500, 2_500, tornillo.id);
  ins("Caño de desagüe cristal", "Cañería", "METRO", 25, 10, 900, 1_500, tornillo.id);
  ins("Gas R32", "Gas refrigerante", "KILO", 4, 3, 26_000, 38_000, norte.id);
  ins("Térmica bipolar 16 A", "Electricidad", "UNIDAD", 5, 3, 9_500, 14_000, electricidad.id);

  // Consumos del trabajo de Marta (costo de lo que se usó)
  [
    [cano14, 2],
    [cano38, 2],
    [cable, 6],
    [mensulas, 1],
    [aislacion, 4],
  ].forEach(([insumo, cantidad]) => {
    const i = insumo as typeof cano14;
    s.movimientos.push(nuevoMovimiento({ insumoId: i.id, tipo: "CONSUMO", cantidad: -(cantidad as number), costoUnitario: i.costoUnitario, trabajoId: t146.id, fecha: dia(0, 9) }));
  });
  s.movimientos.push(nuevoMovimiento({ insumoId: r410.id, tipo: "AJUSTE", cantidad: -0.5, notas: "Pérdida en garrafa", fecha: dia(-8) }));

  // ───────── Compras y pagos a proveedores ─────────
  const compra = (proveedorId: string, fecha: Date, items: [string, number, number, string | null][], extra: Partial<Parameters<typeof nuevaCompra>[0]> = {}) => {
    const total = items.reduce((acc, [, c, pu]) => acc + c * pu, 0);
    const c = nuevaCompra({ proveedorId, fecha, total, ...extra }, fecha);
    s.compras.push(c);
    items.forEach(([descripcion, cantidad, precioUnitario, insumoId]) => {
      s.itemsCompra.push(nuevoItemCompra({ compraId: c.id, descripcion, cantidad, precioUnitario, insumoId }));
      if (insumoId) s.movimientos.push(nuevoMovimiento({ insumoId, tipo: "COMPRA", cantidad, costoUnitario: precioUnitario, compraId: c.id, fecha }));
    });
    s.gastos.push(nuevoGasto({ categoria: "MATERIALES", descripcion: `Compra a ${s.proveedores.find((x) => x.id === proveedorId)?.nombre}`, monto: total, fecha, proveedorId, compraId: c.id, medio: "TRANSFERENCIA" }, fecha));
    return c;
  };

  // Pendientes de pago
  compra(norte.id, delMes(12), [
    ["Caño de cobre 3/8″", 10, 9_800, cano38.id],
    ["Aislación 3/8″", 20, 1_900, aislacion.id],
    ["Gas R410A", 2.5, 28_000, r410.id],
    ["Válvulas de servicio", 4, 6_000, null],
  ], { numeroFactura: "A-0003-00012877", vencimiento: dia(6) });
  // compra del mes anterior (gasto del mes pasado, deuda vigente)
  const deuda = compra(norte.id, mesAtras(1, 20), [["Caño de cobre 1/4″", 12, 7_500, cano14.id], ["Repuestos varios", 1, 36_000, null]], {
    numeroFactura: "A-0003-00012511",
    vencimiento: dia(6),
  });
  compra(electricidad.id, delMes(5), [["Cable tipo taller 5×1,5", 25, 2_400, cable.id], ["Térmica bipolar 16 A", 2, 8_000, null]], {
    vencimiento: dia(14),
  });
  // Pagadas
  const pagadaTornillo = compra(tornillo.id, delMes(3), [
    ["Ménsulas reforzadas", 4, 21_000, mensulas.id],
    ["Tarugos y tornillería", 1, 68_000, null],
  ]);
  s.pagosProveedor.push(nuevoPagoProveedor({ proveedorId: tornillo.id, compraId: pagadaTornillo.id, monto: pagadaTornillo.total, fecha: delMes(3), medio: "EFECTIVO" }));
  // El gasto del mes anterior de Norte ya está en `deuda`; ajustar el total histórico
  // de materiales de ese mes para no duplicarlo.
  const gastoMaterialesMesPasado = s.gastos.find(
    (x) => x.categoria === "MATERIALES" && x.compraId === null && partesAR(x.fecha).mes === partesAR(deuda.fecha).mes,
  );
  if (gastoMaterialesMesPasado) gastoMaterialesMesPasado.monto -= deuda.total;

  // ───────── Gastos del mes en curso ─────────
  const gasto = (categoria: Parameters<typeof nuevoGasto>[0]["categoria"], descripcion: string, monto: number, fecha: Date, extra: Partial<Parameters<typeof nuevoGasto>[0]> = {}) =>
    s.gastos.push(nuevoGasto({ categoria, descripcion, monto, fecha, ...extra }, fecha));

  gasto("PERSONAL", "Pago a Diego (1.ª quincena)", 260_000, delMes(7), { empleadoId: diego.id, medio: "TRANSFERENCIA" });
  gasto("PERSONAL", "Pago a Nico (1.ª quincena)", 130_000, delMes(7), { empleadoId: nico.id });
  gasto("PERSONAL", "Adelanto a Diego", 260_000, delMes(14), { empleadoId: diego.id, medio: "TRANSFERENCIA" });
  gasto("PERSONAL", "Adelanto a Nico", 130_000, delMes(14), { empleadoId: nico.id });
  gasto("COMBUSTIBLE", "Nafta de la camioneta", 52_000, delMes(2));
  gasto("COMBUSTIBLE", "Nafta de la camioneta", 52_000, delMes(9));
  gasto("COMBUSTIBLE", "Nafta de la camioneta", 38_000, delMes(13));
  gasto("HERRAMIENTAS", "Juego de llaves para flare", 64_000, delMes(6), { medio: "TARJETA" });
  gasto("IMPUESTOS", "Monotributo", 40_000, delMes(5), { medio: "TRANSFERENCIA" });

  // ───────── Jornadas (días trabajados) ─────────
  // Diego 13 y Nico 10 en las últimas semanas, sin domingos.
  const diasHabiles: Date[] = [];
  for (let k = 0; diasHabiles.length < 13; k++) {
    const d = dia(-k, 8);
    if (partesAR(d).diaSemana !== 0) diasHabiles.push(d);
  }
  diasHabiles.forEach((fecha, k) => {
    const trabajoId = k === 0 ? t146.id : null;
    s.jornadas.push(nuevaJornada({ empleadoId: diego.id, fecha, monto: diego.jornal, horas: 8, trabajoId }));
    if (k < 10) s.jornadas.push(nuevaJornada({ empleadoId: nico.id, fecha, monto: nico.jornal, horas: 8, trabajoId }));
  });

  return s;
}
