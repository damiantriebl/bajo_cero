import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bajo Cero — Gestión",
    short_name: "Bajo Cero",
    description: "Agenda, clientes, trabajos, insumos, gastos y reportes de Bajo Cero.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef3f9",
    theme_color: "#eef3f9",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nuevo turno", url: "/agenda/nuevo" },
      { name: "Registrar cobro", url: "/cobros/nuevo" },
      { name: "Cargar gasto", url: "/gastos/nuevo" },
    ],
  };
}
