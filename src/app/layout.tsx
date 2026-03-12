import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fast POS System",
  description: "Next Generation POS Progressive Web App",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
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
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground overflow-hidden selection:bg-primary selection:text-primary-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
