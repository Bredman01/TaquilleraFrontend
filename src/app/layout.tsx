import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taquillera · Cartelera y venta de boletas",
  description:
    "Consulta las películas en cartelera y compra tus boletas en línea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <header className="border-b border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-950">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Taquillera
            </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
