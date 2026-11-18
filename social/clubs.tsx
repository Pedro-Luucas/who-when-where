"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/shell/nav-items";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { Player } from "./avatar";
import { createClub, getClub, inviteToClub, leaveClub, listClubs, removeFromClub, type Club } from "./client";
import { isMissingFeature } from "./connect-messages";
import { Members } from "./gate";
import { socialError, useSocialT } from "./messages";
import { useRemote } from "./remote";
import { SocialTabs } from "./tabs";

/** The player's clubs, and a way to open the one they own. Shown on the community page. */
export function ClubStrip() {
  const { t } = useSocialT();
  const router = useRouter();
  const clubs = useRemote("clubs", listClubs, 20_000);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (clubs.error && isMissingFeature(clubs.error)) return null;
  const owned = clubs.data?.clubs.some((club) => club.role === "owner");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createClub(trimmed);
      setName("");
      router.push(`/club/${made.club.slug}`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="club-strip" aria-labelledby="club-heading">
      <h3 id="club-heading" className="eyebrow">
        {t("club")}
      </h3>
      <p className="club-lead">{t("clubLead")}</p>
      {clubs.error && !clubs.data && <p className="form-error">{t(socialError(clubs.error))}</p>}
      {clubs.data && clubs.data.clubs.length === 0 && <p className="people-empty">{t("clubEmpty")}</p>}
      {clubs.data && clubs.data.clubs.length > 0 && (
        <ul className="club-links">
          {clubs.data.clubs.map((club) => (
            <li key={club.slug}>
              <Link href={`/club/${club.slug}`}>
                <b>{club.name}</b>
                <small>
                  {club.role === "owner" ? `${t("clubYours")} · ` : ""}
                  {t("clubMembers", { n: club.members })}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {clubs.data && !owned && (
        <form className="club-create" onSubmit={(event) => void create(event)}>
          <label className="field">
            <span>{t("clubName")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={32}
              minLength={3}
              required
              autoComplete="off"
            />
          </label>
          <button type="submit" className="chip chip-solid" disabled={busy || name.trim().length < 3}>
            {t("clubCreate")}
          </button>
          {error !== null && (
            <small className="form-error" role="alert">
              {t(socialError(error))}
            </small>
          )}
        </form>
      )}
    </section>
  );
}

/** One club: who is in it, and what they scored today. */
export function ClubScreen({ slug }: { slug: string }) {
  return <Members tab="community">{(me) => <ClubBody slug={slug} meId={me.id} />}</Members>;
}

function ClubBody({ slug, meId }: { slug: string; meId: string }) {
  const { locale, t } = useSocialT();
  const day = useDayNumber();
  const router = useRouter();
  const remote = useRemote(`club:${slug}:${day || "today"}`, () => getClub(slug, day >= 1 ? day : undefined), 20_000);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const club = remote.data?.club;
  const owner = club?.ownerId === meId;

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const name = username.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await inviteToClub(slug, name);
      setUsername("");
      remote.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      remote.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page club-page">
      <SocialTabs current="community" />
      {remote.error && !club && (
        <EmptyState
          icon={<Icon name="people" />}
          title={titleFor(remote.error.code, t)}
          action={
            <Button variant="secondary" onClick={remote.reload}>
              {t("tryAgain")}
            </Button>
          }
        >
          {isMissingFeature(remote.error) ? t("clubMissing") : t(socialError(remote.error))}
        </EmptyState>
      )}
      {!club && !remote.error && <div className="page-skeleton skeleton-block" aria-busy="true" />}
      {club && (
        <ClubBoard
          club={club}
          locale={locale}
          owner={owner}
          busy={busy}
          username={username}
          error={error}
          onUsername={setUsername}
          onInvite={(event) => void invite(event)}
          onAct={act}
          onLeave={async () => {
            setBusy(true);
            setError(null);
            try {
              await leaveClub(slug);
              router.push("/community");
            } catch (failure) {
              setError(failure);
              setBusy(false);
            }
          }}
        />
      )}
    </main>
  );
}

function titleFor(code: string, t: ReturnType<typeof useSocialT>["t"]): string {
  switch (code) {
    case "no_such_club":
    case "not_found":
    case "unavailable":
      return t("clubMissing");
    case "not_in_club":
      return t("clubClosed");
    default:
      return t("errGeneric");
  }
}

function ClubBoard({
  club,
  locale,
  owner,
  busy,
  username,
  error,
  onUsername,
  onInvite,
  onAct,
  onLeave,
}: {
  club: Club;
  locale: "en" | "pt";
  owner: boolean;
  busy: boolean;
  username: string;
  error: unknown;
  onUsername: (value: string) => void;
  onInvite: (event: React.FormEvent) => void;
  onAct: (work: () => Promise<unknown>) => void;
  onLeave: () => Promise<void>;
}) {
  const { t } = useSocialT();
  const anyScore = club.members.some((member) => member.today.points > 0);

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{t("club")}</p>
        <h1>{club.name}</h1>
        <p>
          {t("clubMembers", { n: club.members.length })}
          {owner ? ` · ${t("clubOwner")}` : ""}
        </p>
      </header>

      {!anyScore && <p className="people-empty">{t("clubNoScores")}</p>}

      <h2 className="eyebrow">{t("clubBoard")}</h2>
      <ol className="board club-board">
        {club.members.map((member, index) => (
          <li key={member.user.id} data-rank={member.today.points > 0 && index < 3 ? index + 1 : undefined}>
            <span className="board-rank">{index + 1}</span>
            <Player user={member.user} presence note={member.role === "owner" ? t("clubOwner") : `@${member.user.username}`} />
            <strong className="board-points">{formatNumber(member.today.points, locale)}</strong>
            {owner && member.role !== "owner" && (
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t("clubRemoveConfirm", { name: member.user.name }))) {
                    void onAct(() => removeFromClub(club.slug, member.user.id));
                  }
                }}
              >
                {t("clubRemove")}
              </button>
            )}
          </li>
        ))}
      </ol>

      {owner ? (
        <form className="club-invite" onSubmit={onInvite}>
          <label className="field">
            <span>{t("clubInvite")}</span>
            <input
              value={username}
              onChange={(event) => onUsername(event.target.value)}
              maxLength={20}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="chip chip-solid" disabled={busy || username.trim().length < 3}>
            {t("clubInviteAction")}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="chip"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("clubLeaveConfirm", { name: club.name }))) void onLeave();
          }}
        >
          {t("clubLeave")}
        </button>
      )}
      {error !== null && (
        <p className="form-error" role="alert">
          {t(socialError(error))}
        </p>
      )}
      <p className="hint">
        <Link href="/community">{t("community")}</Link>
      </p>
    </>
  );
}
