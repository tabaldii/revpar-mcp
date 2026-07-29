import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RevPar Intel Agent",
  description: "Inteligência de Mercado e Precificação Dinâmica para Aluguel por Temporada",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
