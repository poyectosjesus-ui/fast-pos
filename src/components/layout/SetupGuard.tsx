"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkSetup = async () => {
      try {
        const api = (window as any).electronAPI;
        
        // Si no hay API (estamos en web puro temporalmente?), dejar pasar.
        if (!api) {
          if (isMounted) setIsChecking(false);
          return;
        }

        // 1. Verificamos que el DB y el Setup inicial existan
        const setupRes = await api.getSetting("setup_completed");
        const setupCompleted = setupRes?.value === "true";

        if (!setupCompleted && pathname !== "/setup") {
          router.replace("/setup");
          return;
        }

        if (setupCompleted && pathname === "/setup") {
          router.replace("/login");
          return;
        }

        // 2. Setup terminado. Validar Licencia y Sesión
        if (setupCompleted && pathname !== "/license-expired") {
          const licenseRes = await api.getSetting("license_key");
          if (!licenseRes || !licenseRes.value) {
            router.replace("/license-expired");
            return;
          }

          const check = await api.validateLicense(licenseRes.value);
          if (!check.isValid) {
            router.replace("/license-expired");
            return;
          }

          // [FIX] Zustand persist + SQLite sync
          // Si hay un usuario cacheado en Zustand, verificamos que siga existiendo y activo en SQLite
          const sessionUser = useSessionStore.getState().user;
          if (sessionUser) {
             const usersRes = await api.getAllUsers();
             if (usersRes.success && usersRes.users) {
               const dbUser = usersRes.users.find((u: any) => u.id === sessionUser.id && u.isActive === 1);
               if (!dbUser) {
                 useSessionStore.getState().logout();
                 router.replace("/login");
                 return;
               }
             }
          }
        }

        // 3. Todo correcto
        if (isMounted) setIsChecking(false);

        if (!setupCompleted && pathname !== "/setup") {
          router.replace("/setup");
        } else if (setupCompleted && pathname === "/setup") {
          router.replace("/login");
        } else {
          if (isMounted) setIsChecking(false);
        }
      } catch (err) {
        console.error("Error validando guardias de DB y Licencia:", err);
        if (isMounted) setIsChecking(false);
      }
    };

    checkSetup();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black">
        <span className="text-white font-black tracking-widest text-sm mb-4">INICIALIZANDO MOTOR...</span>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
