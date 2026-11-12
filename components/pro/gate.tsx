"use client";

import { useEntitlements } from "@/account/entitlements";
import { Icon } from "@/components/shell/nav-items";
import { Button } from "@/components/ui/button";
import { GATING, type Feature } from "@/shared/plans";
import { useProT } from "./messages";
import { openProSheet } from "./pro-sheet";
import { ProChip } from "./pro-chip";

/**
 * Shows `children` when the player's plan has `feature`, else `fallback`
 * (a ProTeaser, usually). While gating is off everything shows.
 *
 *   <Gate feature="stats.deep" fallback={<ProTeaser feature="stats.deep" … />}>…</Gate>
 */
export function Gate({
  feature,
  fallback,
  loading = null,
  children,
}: {
  feature: Feature;
  fallback: React.ReactNode;
  /** Shown while the account is still loading (gating on only). */
  loading?: React.ReactNode;
  children: React.ReactNode;
}) {
  const entitlements = useEntitlements();
  if (GATING !== "on") return children;
  if (entitlements.loading) return loading;
  return entitlements.has(feature) ? children : fallback;
}

/**
 * What a player sees in place of something Pro: a lock, what it is, and the
 * way on ("See Pro" opens the Pro sheet). `actions` adds ways back.
 */
export function ProTeaser({
  feature,
  title,
  body,
  actions,
  className,
}: {
  feature: Feature;
  title: string;
  body: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = useProT();
  return (
    <section className={`panel-card pro-teaser ${className ?? ""}`} aria-labelledby={`teaser-${feature}`}>
      <span className="pro-teaser-icon" aria-hidden="true">
        <Icon name="lock" size={26} />
      </span>
      <ProChip always locked />
      <h2 id={`teaser-${feature}`}>{title}</h2>
      <p>{body}</p>
      <div className="pro-teaser-actions">
        <Button variant="pro" icon={<Icon name="crown" size={17} />} onClick={() => openProSheet(feature)}>
          {t("seePlans")}
        </Button>
        {actions}
      </div>
    </section>
  );
}
