import { useEffect, useState } from "react";
import { getSettings } from "@/lib/dataStore";

function setFavicon(href: string) {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Returns the company logo URL from Settings (Supabase Storage) and keeps the
 * browser tab favicon in sync with it. Falls back to the default icon.
 */
export function useCompanyLogo(): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        const url = s?.logoUrl || null;
        setLogoUrl(url);
        setFavicon(url || "/favicon.ico");
      })
      .catch(() => setFavicon("/favicon.ico"));
    return () => {
      alive = false;
    };
  }, []);

  return logoUrl;
}
