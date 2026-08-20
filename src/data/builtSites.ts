export type BuiltSite = {
  brand: string;
  href: string;
  image: string;
  note: string;
  /** contain = full page visible; cover = crop to fill (default) */
  fit?: "contain" | "cover";
};

/** Live sites built by 593 — used as visual proof on services pages. */
export const builtSites: readonly BuiltSite[] = [
  {
    brand: "Infofluencer",
    href: "https://infofluencer.co/tr",
    image: "/works/infofluencer.jpg",
    note: "Influencer pazarlama platformu",
    fit: "contain",
  },
  {
    brand: "Suare Davet",
    href: "https://suaredavet.co/",
    image: "/works/suare-davet.jpg",
    note: "Davet ve organizasyon deneyimi",
  },
  {
    brand: "Artalp",
    href: "https://artalp.com.tr/",
    image: "/works/artalp.jpg",
    note: "Hamam, sauna ve spa sistemleri",
  },
  {
    brand: "Yedi Mavi Cadde",
    href: "https://yedimavicadde.com/",
    image: "/works/yedi-mavi-cadde.jpg",
    note: "Yaşam ve alışveriş merkezi",
  },
  {
    brand: "MAREEN",
    href: "https://mareen.com.tr/",
    image: "/works/mareen.jpg",
    note: "Şal ve eşarp e-ticaret",
  },
  {
    brand: "Op. Dr. Eyüp Baykara",
    href: "https://endoskopikbelameliyati.com/",
    image: "/works/endoskopik-bel-ameliyati.jpg",
    note: "Full endoskopik cerrahi sitesi",
  },
] as const;
