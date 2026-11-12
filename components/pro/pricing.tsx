"use client";

import Link from "next/link";
import { useEntitlements } from "@/account/entitlements";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { numberLocale, useLocale } from "@/lib/i18n";
import { FEATURES, GATING, LIMITS, type Feature } from "@/shared/plans";
import { FEATURE_TEXT, useProT, type ProKey } from "./messages";
import { formatPrice, pricesFor, yearlySaving } from "./prices";
import { ProChip } from "./pro-chip";

// /pricing: Free and Pro side by side (AUDIT_AND_PLAN §7.2, §7.5). There is
// no checkout: the Pro buttons say "Coming soon", and a banner says what the
// plans switch (shared/plans.ts) currently means for players.

const ICONS: Record<Feature, IconName> = {
  "games.pro": "play",
  "practice.unlimited": "shuffle",
  "archive.all": "calendar",
  "party.host16": "party",
  "party.unlockGames": "people",
  "expedition.allSettings": "sliders",
  "stats.deep": "chart",
  "cosmetics.pro": "sparkle",
  "streak.freeze3": "clock",
  "weekly.past": "star",
  "games.early": "bell",
};

const BANNER: Record<typeof GATING, ProKey> = { off: "bannerOff", preview: "bannerPreview", on: "bannerOn" };

type Line = { text: string; yes: boolean };

export function Pricing() {
  const t = useProT();
  const locale = useLocale();
  const { plan, planExpiresAt } = useEntitlements();
  const prices = pricesFor(locale);
  const money = (value: number) => formatPrice(value, prices.currency, locale);
  const free = LIMITS.free;
  const pro = LIMITS.pro;

  const proLines: Line[] = [
    { text: t("lineAllGames"), yes: true },
    { text: t("lineUnlimited"), yes: true },
    { text: t("lineArchiveAll"), yes: true },
    { text: t("lineParty16", { n: pro.partySeats }), yes: true },
    { text: t("lineStats"), yes: true },
    { text: t("lineLooks"), yes: true },
    { text: t("lineFreezes"), yes: true },
    { text: t("lineEarly"), yes: true },
  ];
  const freeLines: Line[] = [
    { text: t("lineDailies"), yes: true },
    { text: t("linePractice", { n: free.practicePerDay ?? 0 }), yes: true },
    { text: t("lineArchive", { n: free.archiveDays ?? 0 }), yes: true },
    { text: t("lineParty", { n: free.partySeats }), yes: true },
    { text: t("lineNoProGames"), yes: false },
    { text: t("lineNoLooks"), yes: false },
  ];

  const until =
    plan === "pro" && planExpiresAt
      ? t("proUntil", {
          date: new Intl.DateTimeFormat(numberLocale(locale), { dateStyle: "long" }).format(new Date(planExpiresAt)),
        })
      : null;

  return (
    <main className="shell-page pricing">
      <section className="pricing-hero" aria-labelledby="pricing-title">
        <div>
          <p className="eyebrow">{t("pricingEyebrow")}</p>
          <h1 id="pricing-title">
            <span className="pricing-free">{t("heroA")}</span> <span className="pricing-pro">{t("heroB")}</span>
          </h1>
        </div>
        <div className="pricing-hero-side">
          <p>{t("heroLead")}</p>
          {until && <Chip tone="pro">{until}</Chip>}
          <div className="pricing-hero-actions">
            {plan === "guest" ? (
              <>
                <ButtonLink href="/account?mode=signup" icon={<Icon name="user" size={17} />}>
                  {t("heroAccount")}
                </ButtonLink>
                <ButtonLink href="/daily" variant="secondary" icon={<Icon name="play" size={17} />}>
                  {t("heroPlay")}
                </ButtonLink>
                <Link href="/play" className="pricing-guest">
                  {t("heroGuest")}
                </Link>
              </>
            ) : (
              <ButtonLink href="/daily" variant="play" icon={<Icon name="play" size={17} />}>
                {t("heroPlay")}
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <nav className="pricing-toc" aria-label={t("onThisPage")}>
        <span className="eyebrow">{t("onThisPage")}</span>
        <a href="#plans">{t("navPlans")}</a>
        <a href="#unlocks">{t("navUnlocks")}</a>
        <a href="#compare">{t("navCompare")}</a>
        <a href="#faq">{t("navFaq")}</a>
      </nav>

      <p className="pricing-banner" data-gating={GATING}>
        <Icon name={GATING === "off" ? "sparkle" : "help"} size={18} />
        {t(BANNER[GATING])}
      </p>

      <section id="plans" className="pricing-plans" aria-label={t("navPlans")}>
        <PlanCard
          kind="yearly"
          name={t("yearlyName")}
          bestFor={t("yearlyFor")}
          price={money(prices.yearly)}
          per={t("perYear")}
          note={t("perMonthEq", { price: money(prices.yearly / 12) })}
          badge={t("bestValue")}
          saving={t("save", { n: yearlySaving(locale) })}
          lines={proLines}
          current={plan === "pro"}
        />
        <PlanCard
          kind="monthly"
          name={t("monthlyName")}
          bestFor={t("monthlyFor")}
          price={money(prices.monthly)}
          per={t("perMonth")}
          lines={proLines}
          current={plan === "pro"}
        />
        <PlanCard
          kind="free"
          name={t("freeName")}
          bestFor={t("freeFor")}
          price={money(0)}
          per={t("freePrice")}
          lines={freeLines}
          current={plan === "free"}
          cta={
            plan === "guest" ? (
              <ButtonLink href="/account?mode=signup" variant="secondary" wide icon={<Icon name="chevron" size={16} />}>
                {t("ctaFree")}
              </ButtonLink>
            ) : (
              <ButtonLink href="/play" variant="secondary" wide icon={<Icon name="play" size={16} />}>
                {t("ctaPlay")}
              </ButtonLink>
            )
          }
        />
      </section>

      <section id="unlocks" className="pricing-section" aria-labelledby="unlocks-title">
        <div className="section-head">
          <h2 id="unlocks-title" className="section-heading">
            {t("unlocksTitle")}
          </h2>
          <p className="section-lead">{t("unlocksLead")}</p>
        </div>
        <ul className="pricing-unlocks">
          {FEATURES.map((feature) => {
            const [title, line] = FEATURE_TEXT[feature][locale];
            return (
              <li key={feature}>
                <span className="pricing-unlock-icon" aria-hidden="true">
                  <Icon name={ICONS[feature]} size={20} />
                </span>
                <b>{title}</b>
                <small>{line}</small>
              </li>
            );
          })}
        </ul>
      </section>

      <Compare />

      <section id="faq" className="pricing-section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="section-heading">
          {t("faqTitle")}
        </h2>
        <div className="pricing-faq">
          {(["Free", "Buy", "Reset", "End", "Fair", "Currency"] as const).map((key) => (
            <details key={key}>
              <summary>{t(`faq${key}Q`)}</summary>
              <p>{t(`faq${key}A`)}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

function PlanCard({
  kind,
  name,
  bestFor,
  price,
  per,
  note,
  badge,
  saving,
  lines,
  current,
  cta,
}: {
  kind: "yearly" | "monthly" | "free";
  name: string;
  bestFor: string;
  price: string;
  per: string;
  note?: string;
  badge?: string;
  saving?: string;
  lines: Line[];
  current: boolean;
  cta?: React.ReactNode;
}) {
  const t = useProT();
  const isPro = kind !== "free";
  return (
    <article className="plan-card" data-plan={kind} aria-labelledby={`plan-${kind}`}>
      <header className="plan-head">
        <h2 id={`plan-${kind}`}>
          {name} {isPro && <ProChip always />}
        </h2>
        {badge && <span className="plan-badge">{badge}</span>}
        {current && <Chip tone="accent">{t("currentPlan")}</Chip>}
        <p className="plan-for">
          <span className="eyebrow">{t("bestFor")}</span> {bestFor}
        </p>
      </header>
      <div className="plan-price">
        <p>
          <strong>{price}</strong> <span>{per}</span>
        </p>
        {note && <p className="plan-note">{note}</p>}
        {saving && <Chip tone="success">{saving}</Chip>}
      </div>
      <div className="plan-cta">
        {cta ?? (
          // No checkout yet (AUDIT_AND_PLAN §8, phase 17).
          <button type="button" className={`key ${kind === "yearly" ? "key-pro" : "key-secondary"} w-full`} disabled>
            <Icon name="clock" size={16} />
            {t("ctaSoon")}
          </button>
        )}
      </div>
      <h3 className="plan-get">{t("whatYouGet")}</h3>
      <ul className="plan-lines">
        {lines.map((line) => (
          <li key={line.text} data-yes={line.yes ? "" : undefined}>
            <span className="plan-mark" aria-label={t(line.yes ? "yes" : "no")} role="img">
              <Icon name={line.yes ? "check" : "close"} size={14} />
            </span>
            {line.text}
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Guest, Free and Pro, row by row. `true` is a tick, `false` a dash. */
function Compare() {
  const t = useProT();
  const { guest, free, pro } = LIMITS;
  const rows: [ProKey, string | boolean, string | boolean, string | boolean][] = [
    ["rowDailies", t("cellOnDevice"), true, true],
    [
      "rowPractice",
      t("cellPerDay", { n: guest.practicePerDay ?? 0 }),
      t("cellPerDayClassics", { n: free.practicePerDay ?? 0 }),
      t("cellUnlimited"),
    ],
    ["rowArchive", false, t("cellLastDays", { n: free.archiveDays ?? 0 }), t("cellAll")],
    ["rowWeekly", t("cellPlay"), t("cellPlayBoard"), t("cellPlayBoardPast")],
    ["rowFreezes", t("cellLocal"), t("cellOne"), t("cellThree")],
    ["rowSocial", false, true, true],
    ["rowParties", t("cellJoin"), t("cellHost", { n: free.partySeats }), t("cellHostPro", { n: pro.partySeats })],
    ["rowExpedition", t("cellPresets"), t("cellPresets"), t("cellAllSettings")],
    ["rowStats", t("cellBasic"), t("cellPerGame"), t("cellDeep")],
    ["rowLooks", false, t("cellAvatars"), t("cellProLooks")],
    ["rowProGames", false, false, true],
    ["rowEarly", false, false, true],
  ];
  const cell = (value: string | boolean) =>
    typeof value === "string" ? (
      value
    ) : (
      <span className="plan-mark" data-yes={value ? "" : undefined} role="img" aria-label={t(value ? "yes" : "no")}>
        <Icon name={value ? "check" : "close"} size={14} />
      </span>
    );

  return (
    <section id="compare" className="pricing-section" aria-labelledby="compare-title">
      <h2 id="compare-title" className="section-heading">
        {t("compareTitle")}
      </h2>
      <div className="pricing-table-wrap">
        <table className="pricing-table">
          <thead>
            <tr>
              <td />
              <th scope="col">{t("colGuest")}</th>
              <th scope="col">{t("colFree")}</th>
              <th scope="col" data-pro="">
                <ProChip always />
                <span className="sr-only">{t("colPro")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, guestCell, freeCell, proCell]) => (
              <tr key={label}>
                <th scope="row">{t(label)}</th>
                <td>{cell(guestCell)}</td>
                <td>{cell(freeCell)}</td>
                <td data-pro="">{cell(proCell)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
