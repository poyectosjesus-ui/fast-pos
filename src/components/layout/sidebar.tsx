import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, Package2, PieChart, Settings, ShoppingBag, ReceiptText, LogOut, Users, Power, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/useSessionStore";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useSessionStore();
  
  // Filtrar rutas permitidas. Un ADMIN ve todas, un CASHIER solo algunas.
  const navItems = [
    { href: "/", label: "POS", icon: ShoppingBag, roles: ["ADMIN", "CASHIER"] },
    { href: "/history", label: "Historial", icon: ReceiptText, roles: ["ADMIN", "CASHIER"] },
    { href: "/cash-registers", label: "Cajas", icon: Wallet, roles: ["ADMIN", "CASHIER"] },
    { href: "/products", label: "Catálogo", icon: Package2, roles: ["ADMIN"] },
    { href: "/analytics", label: "Analítica", icon: PieChart, roles: ["ADMIN"] },
    { href: "/users", label: "Equipo", icon: Users, roles: ["ADMIN"] },
    { href: "/settings", label: "Ajustes", icon: Settings, roles: ["ADMIN"] },
  ].filter(item => !item.roles || item.roles.includes(user?.role || ""));

  return (
    <aside className="fixed inset-y-0 left-0 z-10 w-20 flex-col border-r bg-background sm:flex hidden shadow-sm">
      <div className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          href="/"
          className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full overflow-hidden md:h-12 md:w-12 mb-4 ring-2 ring-primary/20 hover:ring-primary transition-all"
        >
          <img 
            src="/pos.svg" 
            alt="Fast POS Logo" 
            className="h-full w-full object-cover transition-all group-hover:scale-110" 
          />
          <span className="sr-only">Fast POS</span>
        </Link>
        <nav className="flex flex-col gap-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href}
                href={item.href} 
                aria-label={item.label} 
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md scale-105" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-6 w-6" />
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="flex-1" />
      
      {/* Botones de control de sesión y app */}
      <div className="flex flex-col items-center justify-end pb-6 gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={logout}
          className="w-12 h-12 rounded-xl text-neutral-500 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
          title="Bloquear Sesión"
        >
          <Lock className="w-5 h-5" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger 
            className="w-12 h-12 flex items-center justify-center rounded-xl text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Cerrar Sistema Seguramente"
          >
            <Power className="w-5 h-5" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar el sistema?</AlertDialogTitle>
              <AlertDialogDescription>
                Se sincronizará y guardará la base de datos de manera segura antes de salir.
                ¿Deseas cerrar la aplicación por completo?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (typeof window !== "undefined" && (window as any).electronAPI) {
                    (window as any).electronAPI.quitApp();
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Cerrar Sistema
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </aside>
  );
}
