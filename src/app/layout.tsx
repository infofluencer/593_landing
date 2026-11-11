import type { Metadata, Viewport } from "next";
import Script from "next/script";
import ContactProvider from "@/components/ContactProvider";
import { OPENAI_PIXEL_ID } from "@/lib/openai-pixel";
// Fontlar npm paketinden gelir (self-hosted). next/font/google build
// sırasında Google'a bağlanır; Dokploy sunucusu erişemeyince build düşüyordu.
import "@fontsource-variable/syne/wght.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/montserrat/wght.css";
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
  verification: {
    google: "g48joWh3UuI-EAEC9Jye4SkaRThumLemUOdjhLYgQwY",
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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");oaiq("init",{pixelId:"2tXEominwUS9WcyV99nbBo",debug:true});`,
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col bg-[#141111] text-[#f4f1ea]"
        suppressHydrationWarning
      >
        <Script id="openai-pixel" strategy="beforeInteractive">
          {`!function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");oaiq("init",{pixelId:"${OPENAI_PIXEL_ID}",debug:true});`}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-6GG53RB7D4"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-6GG53RB7D4');`}
        </Script>
        <ContactProvider>{children}</ContactProvider>
      </body>
    </html>
  );
}
