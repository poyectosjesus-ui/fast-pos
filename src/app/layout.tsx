import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fast POS — Motor de Ventas",
  description: "Sistema de Punto de Venta ligero, offline-first y ultra rápido.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FastPOS",
  },
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-background text-foreground overflow-hidden selection:bg-primary selection:text-primary-foreground`}>
        <div className="flex flex-col h-screen">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
