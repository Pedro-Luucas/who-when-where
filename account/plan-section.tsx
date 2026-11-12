"use client";

import { useProT } from "@/components/pro/messages";
import { ProChip } from "@/components/pro/pro-chip";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { numberLocale, useLocale } from "@/lib/i18n";
import { useEntitlements } from "./entitlements";

/** The account page's plan: Free or Pro, until when, today's practice, and the way to /pricing. */
export function PlanSection() {
  const t = useProT();
  const locale = useLocale();
  const { plan, planExpiresAt, gating, limits, practiceToday } = useEntitlements();
  const pro = plan === "pro";
  const status = pro
    ? planExpiresAt
      ? t("proUntil", {
          date: new Intl.DateTimeFormat(numberLocale(locale), { dateStyle: "long" }).format(new Date(planExpiresAt)),
        })
      : t("planProForever")
    : t("planFree");

  return (
    <section className="account-section plan-section">
      <h2>
        {t("planTitle")} {pro ? <ProChip always /> : <Chip tone="neutral">{t("freeName")}</Chip>}
      </h2>
      <p>{status}</p>
      {gating === "off" && <p className="hint">{t("planOff")}</p>}
      {gating === "on" && !pro && limits.practicePerDay !== null && (
        <p className="hint">{t("planPractice", { used: Math.min(practiceToday, limits.practicePerDay), limit: limits.practicePerDay })}</p>
      )}
      <div className="account-row">
        <ButtonLink href="/pricing" variant={pro ? "secondary" : "pro"} size="sm" icon={<Icon name="crown" size={16} />}>
          {t("planSee")}
        </ButtonLink>
      </div>
    </section>
  );
}
