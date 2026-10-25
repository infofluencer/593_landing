import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PositionPage from "@/components/PositionPage";
import { getPosition, positions } from "@/data/positions";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return positions.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const position = getPosition(slug);
  if (!position) return {};

  return {
    title: `${position.title} | Kariyer | 593 E-Marketing`,
    description: position.intro.slice(0, 160),
  };
}

export default async function PositionSlugPage({ params }: Props) {
  const { slug } = await params;
  const position = getPosition(slug);
  if (!position) notFound();

  return <PositionPage position={position} />;
}
