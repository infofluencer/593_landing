import type { Metadata } from "next";
import CareerPage from "@/components/CareerPage";

export const metadata: Metadata = {
  title: "Kariyer | 593 E-Marketing",
  description:
    "593 E-Marketing ekibine katıl. Açık pozisyonlar ve başvuru formu.",
};

export default function KariyerPage() {
  return <CareerPage />;
}
