import type { Metadata, Viewport } from "next";
import { DM_Sans, Montserrat, Syne } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#141111",
};

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "593 E-Marketing | Creative Marketing Studio",
  description:
    "593 E-Marketing icin editorial hissi tasiyan yeni nesil yaratıcı pazarlama ve dijital deneyim landing sayfasi.",
  applicationName: "593 E-Marketing",
  appleWebApp: {
    capable: true,
    title: "593",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${syne.variable} ${dmSans.variable} ${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-[#141111] text-[#f4f1ea]"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
