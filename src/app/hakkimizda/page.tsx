import type { Metadata } from "next";
import AboutPage from "@/components/AboutPage";

export const metadata: Metadata = {
  title: "Hakkımızda | 593 E-Marketing",
  description:
    "593 E-Marketing; tasarım, strateji ve büyümeyi tek ritimde kuran yaratıcı pazarlama stüdyosu.",
};

export default function HakkimizdaPage() {
  return <AboutPage />;
}
