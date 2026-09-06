import { redirect } from "next/navigation";

/** Eski /ads yolu → Google sunum ekranı */
export default function AdsRedirectPage() {
  redirect("/google");
}
