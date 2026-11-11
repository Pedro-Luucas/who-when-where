"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { useSiteT } from "@/lib/i18n";

/**
 * What a page shows when it crashes (a malformed save, a bad response): the
 * rest of the site keeps working, and trying again re-renders the page.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useSiteT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main className="page page-narrow">
        <section className="notice" role="alert">
          <h1>{t("errorTitle")}</h1>
          <p>{t("errorLead")}</p>
          <div className="page-actions">
            <button type="button" className="button" onClick={() => retry()}>
              {t("errorRetry")}
            </button>
            <Link href="/" className="button button-quiet">
              {t("errorHome")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
