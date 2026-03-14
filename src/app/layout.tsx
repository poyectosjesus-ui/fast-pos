import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fast POS",
  description: "Sistema de Punto de Venta ligero, offline-first y ultra rápido.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FastPOS",
  },
};

import { Toaster } from "@/components/ui/sonner";
import { SetupGuard } from "@/components/layout/SetupGuard";
import { ThemeWrapper } from "@/components/layout/ThemeWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark theme-emerald">
      <body className={`${inter.className} bg-background text-foreground overflow-hidden selection:bg-primary selection:text-primary-foreground`}>
        <ThemeWrapper>
          <div className="flex flex-col h-screen">
            <SetupGuard>
              {children}
            </SetupGuard>
          </div>
          <Toaster />
        </ThemeWrapper>
      </body>
    </html>
  );
}
