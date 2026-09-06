"use client";

import { signOut } from "next-auth/react";

/**
 * Sign out without following Auth.js absolute redirect (which can point at
 * localhost while the cookie lives on *.localhost tenant host).
 */
export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut({ redirect: false });
        // Hard navigation on the current host clears RSC/session caches.
        window.location.assign("/login");
      }}
      className="rounded-md px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
    >
      Çıkış
    </button>
  );
}
