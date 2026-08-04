"use client";

import Image from "next/image";
import Link from "next/link";

export default function SpeakBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/95 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-md">
        <Link
          href="mailto:hello@593emarketing.com"
          className="inline-flex items-center gap-2 rounded-full bg-[#f3f3ef] px-4 py-2.5 text-[13px] font-semibold text-black transition-transform hover:scale-[1.02] sm:px-5"
        >
          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] text-black/55"
          >
            ✉
          </span>
          İletişim
        </Link>
        <Link
          href="#iletisim"
          className="inline-flex items-center gap-2.5 rounded-full bg-black py-1.5 pl-1.5 pr-4 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] sm:pr-5"
        >
          <Image
            src="/593-logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-full bg-white object-contain p-0.5"
          />
          Görüşme ayarla
        </Link>
      </div>
    </div>
  );
}
