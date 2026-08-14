import type { Metadata } from "next";
import ServicesPage from "@/components/ServicesPage";

export const metadata: Metadata = {
  title: "Hizmetlerimiz | 593 E-Marketing",
  description:
    "Web tasarım, dijital pazarlama, SEO, sosyal medya, kreatif içerik ve Infofluencer — 593 E-Marketing hizmetleri.",
};

export default function HizmetlerimizPage() {
  return <ServicesPage />;
}
