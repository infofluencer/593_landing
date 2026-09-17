export const OPENAI_PIXEL_ID = "Sp9uq3JP83CVrPZ7rrSSS7";

export const OPENAI_APPOINTMENT_EVENT = "appointment_scheduled" as const;

type OaiqFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    oaiq?: OaiqFn;
  }
}

/** Client-side Pixel conversion: Randevu planlandı */
export function trackAppointmentScheduled() {
  if (typeof window === "undefined" || typeof window.oaiq !== "function") {
    return;
  }
  window.oaiq("measure", OPENAI_APPOINTMENT_EVENT, {
    type: "customer_action",
  });
}
