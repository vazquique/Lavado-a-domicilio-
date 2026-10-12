import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/config/product";

export const metadata: Metadata = {
  title: `Panel · ${PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return <main className="mx-auto min-h-screen max-w-xl px-4 py-6">{children}</main>;
}
