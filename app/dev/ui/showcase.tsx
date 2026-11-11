"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Chip,
  Combobox,
  Dialog,
  EmptyState,
  FamilyIcon,
  IconButton,
  NavTabs,
  ProgressRing,
  Segmented,
  Skeleton,
  SkeletonText,
  StatTile,
  Stepper,
  Tabs,
  Toast,
  tabPanelProps,
  type ButtonVariant,
  type ComboOption,
} from "@/components/ui";
import { FAMILIES, FAMILY_IDS } from "@/games/families";
import { COUNTRIES } from "@/lib/countries";
import { useLocale } from "@/lib/i18n";
import { THEMES, usePrefs } from "@/lib/prefs";

// Internal review page: English labels, with the content (countries, family
// names) in the visitor's language so both locales get exercised.

const SWATCHES = {
  Space: ["space-980", "space-950", "space-900", "space-850", "space-800", "space-700", "space-600"],
  Text: ["ice-50", "ice-200", "ice-400"],
  Accents: ["cyan", "cyan-bright", "blue", "blue-deep", "green", "red", "gold", "purple", "teal", "periwinkle", "pink"],
  Semantic: ["bg", "surface", "surface-2", "surface-3", "sunken", "fg", "fg-2", "fg-3", "accent", "primary", "play", "danger", "pro", "guess", "answer"],
} as const;

const VARIANTS: ButtonVariant[] = ["primary", "play", "secondary", "ghost", "danger", "pro"];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-line pt-8">
      <h2 id={id} className="eyebrow games-heading mb-0">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Showcase() {
  const locale = useLocale();
  const [prefs, setPrefs] = usePrefs();
  const [tab, setTab] = useState<"all" | "who" | "where">("all");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [rounds, setRounds] = useState(10);
  const [dialog, setDialog] = useState<"center" | "sheet" | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const countries: ComboOption[] = useMemo(
    () =>
      COUNTRIES.map((country) => ({
        value: country.id,
        label: country.name[locale],
        hint: country.id.toUpperCase(),
        disabled: picked.includes(country.id),
      })),
    [locale, picked],
  );

  return (
    <main className="mx-auto grid w-full max-w-(--container-page) gap-10 px-4 pt-8 pb-20 md:px-6">
      <header className="grid gap-3">
        <p className="eyebrow">Phase 2 · Night Atlas</p>
        <h1 className="font-display text-display font-bold">UI kit</h1>
        <p className="max-w-(--container-prose) text-lg text-fg-2">
          Tokens live in <code className="font-mono text-accent">app/tokens.css</code>, components in{" "}
          <code className="font-mono text-accent">components/ui</code>. Switch the theme to review Daylight.
        </p>
        <Segmented
          label="Theme"
          options={THEMES.map((theme) => ({ value: theme, label: theme }))}
          value={prefs.theme}
          onChange={(theme) => setPrefs({ theme })}
        />
      </header>

      <Section id="ui-palette" title="Palette">
        {Object.entries(SWATCHES).map(([group, names]) => (
          <div key={group} className="grid gap-2">
            <p className="font-mono text-xs text-fg-2 uppercase">{group}</p>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
              {names.map((name) => (
                <li key={name} className="overflow-hidden rounded-md border border-line">
                  <span className="block h-12" style={{ background: group === "Semantic" ? `var(--${name})` : `var(--color-${name})` }} />
                  <span className="block bg-surface px-2 py-1.5 font-mono text-xs text-fg-2">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="grid gap-2">
          <p className="font-mono text-xs text-fg-2 uppercase">Families</p>
          <div className="flex flex-wrap gap-2">
            {FAMILY_IDS.map((family) => (
              <Chip key={family} family={family}>
                {FAMILIES[family].name[locale]}
              </Chip>
            ))}
          </div>
        </div>
      </Section>

      <Section id="ui-type" title="Typography">
        <div className="grid gap-3">
          <p className="font-display text-display leading-none font-bold">Who When Where</p>
          <p className="font-display text-3xl font-bold">Section heading · Bricolage Grotesque</p>
          <p className="text-xl font-semibold">Card title · Chakra Petch 600</p>
          <p className="max-w-(--container-prose) text-base text-fg-2">
            Body text in Chakra Petch. Ação, coração, São Paulo — Portuguese diacritics render in the latin subset.
          </p>
          <p className="eyebrow">Eyebrow · JetBrains Mono · 12px minimum</p>
          <p className="font-mono text-score font-bold tabular-nums">1,000</p>
        </div>
      </Section>

      <Section id="ui-buttons" title="Buttons">
        <Segmented
          label="Size"
          options={[
            { value: "sm", label: "sm 36" },
            { value: "md", label: "md 44" },
            { value: "lg", label: "lg 52" },
          ]}
          value={size}
          onChange={setSize}
        />
        <div className="flex flex-wrap items-center gap-3">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size={size}>
              {variant}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading>Saving</Button>
          <Button variant="play" disabled>
            Disabled
          </Button>
          <Button variant="secondary" icon={<PlusIcon />}>
            With icon
          </Button>
          <ButtonLink href="/" variant="play" size="lg">
            Play today ▸
          </ButtonLink>
          <button type="button" className="button">
            Legacy .button
          </button>
          <button type="button" className="button button-quiet">
            Legacy .button-quiet
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton label="Add">
            <PlusIcon />
          </IconButton>
          <IconButton label="Messages" badge={3}>
            <FamilyIcon family="social" className="size-4" />
          </IconButton>
          <IconButton label="Places" showLabel>
            <FamilyIcon family="where" className="size-4" />
          </IconButton>
        </div>
      </Section>

      <Section id="ui-chips" title="Chips and badges">
        <div className="flex flex-wrap gap-2">
          <Chip>Free account</Chip>
          <Chip tone="success">Unlimited</Chip>
          <Chip tone="accent">2 left today</Chip>
          <Chip tone="pro">Pro</Chip>
          <Chip tone="new">New</Chip>
          <Chip tone="success">✓ Done</Chip>
          <Chip tone="danger">Missed</Chip>
          <Chip tone="accent" icon={<span aria-hidden="true">🔥</span>}>
            Streak 12
          </Chip>
        </div>
      </Section>

      <Section id="ui-cards" title="Cards">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader eyebrow="Glass panel" title="Card" />
            <p className="text-fg-2">Translucent navy, a cyan hairline and a soft shadow.</p>
          </Card>
          <Card family="where">
            <CardHeader eyebrow={FAMILIES.where.name[locale]} title="Family stripe" level={3} />
            <p className="text-fg-2">A stripe in the family colour along the top.</p>
          </Card>
          <Card interactive raised tabIndex={0}>
            <CardHeader eyebrow="Interactive" title="Hover me" level={3} />
            <p className="text-fg-2">Lifts and glows on hover.</p>
          </Card>
        </div>
      </Section>

      <Section id="ui-tabs" title="Tabs and choices">
        <Tabs
          label="Families"
          idBase="ui-tabs-demo"
          value={tab}
          onChange={setTab}
          items={[
            { id: "all", label: "All", count: 6 },
            { id: "who", label: FAMILIES.who.name[locale], count: 1 },
            { id: "where", label: FAMILIES.where.name[locale], count: 2 },
          ]}
        />
        <div {...tabPanelProps("ui-tabs-demo", tab)} className="rounded-md bg-sunken p-4 text-fg-2">
          Panel for “{tab}”. Arrow keys, Home and End move between tabs.
        </div>
        <NavTabs
          label="Social"
          items={[
            { href: "/dev/ui", label: "UI kit", current: true },
            { href: "/community", label: "Community" },
            { href: "/leaderboard", label: "Leaderboard", count: 12 },
          ]}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Stepper label="Rounds" value={rounds} min={3} max={20} onChange={setRounds} />
          <Segmented
            label="Questions"
            options={[10, 25, 50].map((value) => ({ value, label: String(value) }))}
            value={rounds >= 50 ? 50 : rounds >= 25 ? 25 : 10}
            onChange={setRounds}
          />
        </div>
      </Section>

      <Section id="ui-combobox" title="Combobox">
        <div className="grid max-w-md gap-3">
          <Combobox
            label="Name a country"
            placeholder="Type a few letters…"
            emptyText="No country matches."
            options={countries}
            onSelect={(option) => setPicked((list) => [...list, option.value])}
          />
          <p className="hint">
            Named: {picked.length ? picked.map((id) => id.toUpperCase()).join(", ") : "none yet"} (named ones are struck
            through and sorted last).
          </p>
        </div>
      </Section>

      <Section id="ui-overlays" title="Dialog, sheet and toast">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialog("center")}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setDialog("sheet")}>
            Open sheet
          </Button>
        </div>
        <Dialog
          open={dialog !== null}
          onClose={() => setDialog(null)}
          title={dialog === "sheet" ? "Setup" : "How to play"}
          description="Focus starts on the title and returns here on close."
          closeLabel="Close"
          variant={dialog ?? "center"}
        >
          <ol className="help-list">
            <li>Find the place on the map.</li>
            <li>Lock in your guess.</li>
            <li>The closer you are, the more points.</li>
          </ol>
          <Button variant="play" wide onClick={() => setDialog(null)}>
            Play
          </Button>
        </Dialog>
        <Toast mark="★" title="Achievement unlocked" body="First expedition" />
      </Section>

      <Section id="ui-people" title="Avatars">
        <div className="flex flex-wrap items-center gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Avatar key={i} name={"Ana Bia Caio Duda Enzo Flor Gabi Hugo".split(" ")[i]} color={i} />
          ))}
          <Avatar name="Online" color={3} online presenceLabels={{ online: "online", away: "away" }} />
          <Avatar name="Away" color={4} online={false} presenceLabels={{ online: "online", away: "away" }} />
          <Avatar name="Small" color={1} size="small" />
          <Avatar name="Large" color={2} size="large" online />
        </div>
      </Section>

      <Section id="ui-stats" title="Stats and progress">
        <div className="flex flex-wrap items-center gap-8">
          <ProgressRing value={0.66} size={96} stroke={8} label="4 of 6 done today">
            4/6
          </ProgressRing>
          <ProgressRing value={0.3} color="var(--pro)" label="Level 3, 30% to level 4">
            L3
          </ProgressRing>
          <ProgressRing value={1} color="var(--answer)" size={40} stroke={4} />
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <StatTile label="Correct" value="7" unit="/ 10" tone="success" />
            <StatTile label="Missed" value="3" tone="danger" />
            <StatTile label="Accuracy" value="70%" tone="accent" />
            <StatTile label="Streak" value="12" tone="streak" />
          </dl>
        </div>
      </Section>

      <Section id="ui-states" title="Loading and empty states">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <Skeleton shape="circle" className="size-10" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
            <Skeleton className="h-36" />
          </div>
          <EmptyState
            icon={<FamilyIcon family="social" />}
            title="No friends yet"
            action={
              <Button variant="primary" size="sm">
                Find players
              </Button>
            }
          >
            Add friends to see their scores here and race them in parties.
          </EmptyState>
        </div>
      </Section>
    </main>
  );
}
