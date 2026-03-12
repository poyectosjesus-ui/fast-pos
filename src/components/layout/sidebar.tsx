import Link from "next/link";
import { Coffee, Home, Package2, PieChart, Settings, ShoppingBag, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 w-20 flex-col border-r bg-background sm:flex hidden">
      <div className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          href="/"
          className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-12 md:w-12 md:text-base"
        >
          <Coffee className="h-5 w-5 transition-all group-hover:scale-110" />
          <span className="sr-only">Fast POS</span>
        </Link>
        <nav className="flex flex-col gap-4 mt-8">
          <Link href="/" aria-label="POS" className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground hover:bg-muted/80">
            <ShoppingBag className="h-6 w-6" />
          </Link>
          <Link href="/products" aria-label="Products" className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <Package2 className="h-6 w-6" />
          </Link>
          <Link href="/analytics" aria-label="Analítica" className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <PieChart className="h-6 w-6" />
          </Link>
          <Link href="/history" aria-label="Historial" className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <ReceiptText className="h-6 w-6" />
          </Link>
          <Link href="/settings" aria-label="Settings" className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <Settings className="h-6 w-6" />
          </Link>
        </nav>
      </div>
    </aside>
  );
}
