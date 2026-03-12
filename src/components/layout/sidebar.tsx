import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, Package2, PieChart, Settings, ShoppingBag, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "POS", icon: ShoppingBag },
    { href: "/products", label: "Catálogo", icon: Package2 },
    { href: "/analytics", label: "Analítica", icon: PieChart },
    { href: "/history", label: "Historial", icon: ReceiptText },
    { href: "/settings", label: "Ajustes", icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-10 w-20 flex-col border-r bg-background sm:flex hidden shadow-sm">
      <div className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          href="/"
          className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-12 md:w-12 md:text-base mb-4"
        >
          <Coffee className="h-5 w-5 transition-all group-hover:scale-110" />
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
    </aside>
  );
}
