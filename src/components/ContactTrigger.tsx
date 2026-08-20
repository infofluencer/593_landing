"use client";

import type { ReactNode } from "react";
import { useContact } from "./ContactProvider";

export default function ContactTrigger({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const { open } = useContact();

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        open();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
