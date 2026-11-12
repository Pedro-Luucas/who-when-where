"use client";

import { Icon } from "@/components/shell/nav-items";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useConnectT } from "./connect-messages";
import { usePush } from "./push-client";

/**
 * The switch for Web Push on this device. Shows nothing while loading, or
 * when the server has push turned off; `compact` hides it once it is on.
 */
export function PushCard({ compact }: { compact?: boolean }) {
  const { t } = useConnectT();
  const push = usePush();
  if (push.state === "loading" || push.state === "unavailable") return null;
  if (compact && (push.state === "on" || push.state === "unsupported")) return null;

  return (
    <section
      className={cn(
        "mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-line-strong bg-(image:--panel-fill) p-4",
        push.state === "on" && "border-answer/40",
      )}
      aria-labelledby="push-title"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name="bell" size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="push-title" className="font-bold text-fg">
          {t("pushTitle")}
        </h2>
        <p className="text-sm text-fg-2">
          {push.state === "on"
            ? t("pushEnabled")
            : push.state === "denied"
              ? t("pushDenied")
              : push.state === "unsupported"
                ? t("pushUnsupported")
                : t("pushLead")}
        </p>
        {push.error && (
          <p className="form-error text-sm" role="alert">
            {t("pushFailed")}
          </p>
        )}
      </div>
      {push.state === "off" && (
        <Button size="sm" loading={push.busy} onClick={() => void push.enable()}>
          {t("pushOn")}
        </Button>
      )}
      {push.state === "on" && (
        <span className="flex gap-2">
          <Button size="sm" variant="secondary" loading={push.busy} onClick={() => void push.test()}>
            {t("pushTest")}
          </Button>
          <Button size="sm" variant="ghost" disabled={push.busy} onClick={() => void push.disable()}>
            {t("pushOff")}
          </Button>
        </span>
      )}
    </section>
  );
}
