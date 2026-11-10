"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TOAST_MS, dismissToast, useToasts, type Toast } from "@/lib/toasts";

/** The notices raised with toast(), stacked at the foot of the page. */
export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((entry) => (
        <Notice key={entry.id} toast={entry} />
      ))}
    </div>
  );
}

function Notice({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.id]);

  const content = (
    <>
      <i className="seal" aria-hidden="true">
        {toast.mark}
      </i>
      <span>
        <b>{toast.title}</b>
        <small>{toast.body}</small>
      </span>
    </>
  );

  return toast.href ? (
    <Link href={toast.href} className="toast" onClick={() => dismissToast(toast.id)}>
      {content}
    </Link>
  ) : (
    <button type="button" className="toast" onClick={() => dismissToast(toast.id)}>
      {content}
    </button>
  );
}
