import type { NextConfig } from "next";

const permanentRedirects: Array<{
  source: string;
  destination: string;
}> = [
  { source: "/ekibimiz", destination: "/hakkimizda" },
  { source: "/iletisim", destination: "/" },
  { source: "/kariyer", destination: "/" },
  { source: "/blog", destination: "/" },
  { source: "/projeler", destination: "/" },
  { source: "/hizmetler", destination: "/hizmetlerimiz" },
  { source: "/about", destination: "/hakkimizda" },
  { source: "/contact", destination: "/" },

  { source: "/service/web-tasarim", destination: "/hizmetlerimiz/web-tasarim" },
  {
    source: "/service/dijital-pazarlama",
    destination: "/hizmetlerimiz/dijital-pazarlama",
  },
  { source: "/service/seo", destination: "/hizmetlerimiz/seo" },
  {
    source: "/service/sosyal-medya-yonetimi",
    destination: "/hizmetlerimiz/sosyal-medya",
  },
  {
    source: "/service/sosyal-medya",
    destination: "/hizmetlerimiz/sosyal-medya",
  },
  {
    source: "/service/kreatif-icerik-hizmetleri",
    destination: "/hizmetlerimiz/kreatif-icerik",
  },
  {
    source: "/service/kreatif-icerik",
    destination: "/hizmetlerimiz/kreatif-icerik",
  },
  {
    source: "/service/infofluencer",
    destination: "https://infofluencer.co/tr",
  },

  { source: "/portfolio/:slug*", destination: "/" },
  { source: "/blog/:slug*", destination: "/" },
  { source: "/projeler/:slug*", destination: "/" },
  { source: "/service/:slug*", destination: "/hizmetlerimiz" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["nodemailer"],
  async redirects() {
    return permanentRedirects.map((rule) => ({
      ...rule,
      permanent: true,
    }));
  },
};

export default nextConfig;
