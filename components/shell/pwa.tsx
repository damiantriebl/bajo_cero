"use client";

import { useEffect, useState } from "react";
import { useOffline } from "next/offline";
import { Download, WifiOff } from "lucide-react";
import { buttonClass } from "@/components/ui/base";

/** Registra el service worker (instalación + caché de archivos estáticos). */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/** Aviso cuando no hay señal. Next reintenta solo las acciones al volver la conexión. */
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="no-print sticky top-0 z-20 flex items-center gap-2.5 bg-night px-5 py-2.5 text-sm text-white">
      <WifiOff aria-hidden className="size-5 shrink-0 text-ice-light" />
      <span>
        <strong>Sin señal.</strong> Lo que cargues se envía solo cuando vuelva la conexión.
      </span>
    </div>
  );
}

type EventoInstalacion = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Botón "Instalar" (Android/Chrome/Edge). En iPhone explica cómo agregarla. */
export function InstallAppButton() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [esIOS, setEsIOS] = useState(false);

  useEffect(() => {
    // Lectura de APIs del navegador al montar: no hay forma de saberlo en el servidor.
    /* eslint-disable react-hooks/set-state-in-effect */
    setInstalada(window.matchMedia("(display-mode: standalone)").matches);
    setEsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    /* eslint-enable react-hooks/set-state-in-effect */
    const alPedir = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacion);
    };
    const alInstalar = () => setInstalada(true);
    window.addEventListener("beforeinstallprompt", alPedir);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPedir);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (instalada) return <p className="text-sm font-semibold text-ok">Ya está instalada en este dispositivo.</p>;

  if (esIOS && !evento) {
    return (
      <p className="text-sm text-muted">
        En iPhone: tocá <strong>Compartir</strong> y después <strong>Agregar a inicio</strong>.
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={!evento}
      onClick={async () => {
        if (!evento) return;
        await evento.prompt();
        await evento.userChoice;
        setEvento(null);
      }}
      className={buttonClass("primary", "sm")}
    >
      <Download aria-hidden className="size-5" />
      Instalar
    </button>
  );
}
