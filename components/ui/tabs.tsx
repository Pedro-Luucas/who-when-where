"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { cn } from "./cn";

export type TabItem<T extends string> = {
  id: T;
  label: React.ReactNode;
  /** A number after the label (how many games, unread…). */
  count?: number;
};

const tabClass =
  "relative flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 font-mono text-xs font-semibold tracking-[0.08em] whitespace-nowrap uppercase transition-colors duration-150";
const idle = "border-transparent text-fg-2 hover:text-fg";
const current = "border-accent bg-linear-to-t from-accent-soft to-transparent text-fg";

function Count({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="font-normal text-fg-3 tabular-nums">{n}</span>;
}

type TabsProps<T extends string> = {
  /** Names the tab list for assistive technology. */
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** The id prefix the matching panels use: `${idBase}-panel-${id}` (see tabPanelProps). */
  idBase?: string;
  className?: string;
};

/**
 * A WAI-ARIA tab list. Arrow keys, Home and End move between tabs and select
 * them. Pair each panel with tabPanelProps(idBase, id).
 */
export function Tabs<T extends string>({ label, items, value, onChange, idBase, className }: TabsProps<T>) {
  const fallback = useId();
  const base = idBase ?? fallback;
  const list = useRef<HTMLDivElement>(null);

  function move(event: React.KeyboardEvent, index: number) {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(items[next].id);
    list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => move(event, index)}
            className={cn(tabClass, selected ? current : idle)}
          >
            {item.label}
            <Count n={item.count} />
          </button>
        );
      })}
    </div>
  );
}

/** Props for the panel shown by a tab of <Tabs idBase={idBase}>. */
export function tabPanelProps(idBase: string, id: string) {
  return {
    role: "tabpanel" as const,
    id: `${idBase}-panel-${id}`,
    "aria-labelledby": `${idBase}-tab-${id}`,
    tabIndex: 0,
  };
}

type NavTabsProps = {
  /** Names the navigation landmark. */
  label: string;
  items: { href: string; label: React.ReactNode; count?: number; current?: boolean }[];
  className?: string;
};

/** The same look for links between pages (aria-current marks the page you are on). */
export function NavTabs({ label, items, className }: NavTabsProps) {
  return (
    <nav aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={cn(tabClass, item.current ? current : idle)}
        >
          {item.label}
          <Count n={item.count} />
        </Link>
      ))}
    </nav>
  );
}
