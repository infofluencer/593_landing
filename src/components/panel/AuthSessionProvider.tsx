"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Keep session client-side without refetching on every route change / focus.
 * Panel navigations were waiting on repeated /api/auth/session round-trips.
 */
export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
