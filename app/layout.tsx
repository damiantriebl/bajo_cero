import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { PwaRegister } from "@/components/shell/pwa";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: { default: "Bajo Cero", template: "%s · Bajo Cero" },
  description: "Agenda, clientes, trabajos y números de Bajo Cero, instalación de aires acondicionados.",
  applicationName: "Bajo Cero",
  appleWebApp: { capable: true, title: "Bajo Cero", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef3f9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="min-h-full text-[15px] leading-[1.35]">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
