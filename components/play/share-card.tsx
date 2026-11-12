"use client";

import { useState } from "react";
import { Icon } from "@/components/shell/nav-items";
import { Dialog } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n";
import { cardQuery, type CardVerdict } from "@/lib/result-share";
import { useShellT } from "@/lib/shell-messages";

type Props = {
  slug: string;
  points: number;
  verdicts: CardVerdict[];
  label: string;
};

/**
 * "Share card": a picture of the result (app/play/[slug]/card), previewed in
 * a dialog, to send through the device's share sheet where it takes files
 * (phones), or to save as a PNG everywhere else.
 */
export function ShareCardButton({ slug, points, verdicts, label }: Props) {
  const t = useShellT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const src = `/play/${slug}/card?${cardQuery({ points, verdicts, label, locale })}`;
  const file = `who-when-where-${slug}.png`;
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  async function picture(): Promise<Blob> {
    const response = await fetch(src);
    if (!response.ok) throw new Error(String(response.status));
    return response.blob();
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await picture();
      const image = new File([blob], file, { type: "image/png" });
      if (canShareFiles && navigator.canShare({ files: [image] })) {
        await navigator.share({ files: [image], text: `${window.location.origin}/play/${slug}` });
      } else save(blob);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setState("failed");
    } finally {
      setBusy(false);
    }
  }

  function save(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function download() {
    setBusy(true);
    try {
      save(await picture());
    } catch {
      setState("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="key key-secondary key-sm share-card-key" onClick={() => (setState("loading"), setOpen(true))}>
        <Icon name="share" size={16} />
        <span>{t("shareCard")}</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("shareCardTitle")}
        description={t("shareCardLead")}
        closeLabel={t("close")}
        className="share-card-dialog"
      >
        <div className="share-card-preview" data-state={state}>
          {open && (
            // A picture drawn on the server from the address; next/image would only re-encode it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              width={1200}
              height={630}
              alt={t("shareCardAlt", { points })}
              onLoad={() => setState("ready")}
              onError={() => setState("failed")}
            />
          )}
          {state === "loading" && <p className="share-card-note">{t("shareCardLoading")}</p>}
          {state === "failed" && <p className="share-card-note">{t("shareCardFailed")}</p>}
        </div>
        <div className="share-card-actions">
          {canShareFiles && (
            <button type="button" className="key key-play" onClick={share} disabled={busy || state === "failed"}>
              <Icon name="share" size={17} />
              <span>{t("shareImage")}</span>
            </button>
          )}
          <button
            type="button"
            className={canShareFiles ? "key key-secondary" : "key key-play"}
            onClick={download}
            disabled={busy || state === "failed"}
          >
            <Icon name="download" size={17} />
            <span>{t("saveImage")}</span>
          </button>
        </div>
      </Dialog>
    </>
  );
}
