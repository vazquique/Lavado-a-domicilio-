import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/config/product";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Cotiza y reserva tu lavado de auto a domicilio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
