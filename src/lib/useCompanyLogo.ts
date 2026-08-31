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

/** Inline SRL diamond mark (data URI) used as the fallback favicon. */
const SRL_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="rotate(45 50 50)"><rect x="12" y="12" width="76" height="76" rx="6" fill="#0B2A55" stroke="#C1121F" stroke-width="3"/></g><text x="50" y="60" text-anchor="middle" font-family="Arial" font-weight="800" font-size="34" fill="#ffffff" letter-spacing="1">SRL</text></svg>`,
  );

/**
 * Returns the company logo URL from Settings (Supabase Storage) and keeps the
 * browser tab favicon in sync with it. Falls back to the SRL diamond brand mark.
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
        setFavicon(url || SRL_FAVICON);
      })
      .catch(() => setFavicon(SRL_FAVICON));
    return () => {
      alive = false;
    };
  }, []);

  return logoUrl;
}
