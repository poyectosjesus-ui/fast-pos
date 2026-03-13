"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSessionStore, UserRole } from "@/store/useSessionStore";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useSessionStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    // 1. Si no está logeado, y no está en /login, enviarlo a /login
    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    // 2. Si está logeado pero la ruta exige roles que el usuario no tiene
    if (isAuthenticated && user && allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        // Redirigir a la pantalla principal si es cajero asomándose donde no debe
        router.replace("/");
        return;
      }
    }
  }, [isAuthenticated, user, pathname, allowedRoles, router, isClient]);

  // Mostrar un loader mínimo mientras hidratamos el cliente local
  if (!isClient) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prevenir flash de contenido protegido
  if (!isAuthenticated && pathname !== "/login") return null;
  if (isAuthenticated && user && allowedRoles && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
