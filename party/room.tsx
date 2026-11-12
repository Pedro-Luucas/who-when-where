"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { ApiError } from "@/account/api";
import { useEntitlements } from "@/account/entitlements";
import { useProT } from "@/components/pro/messages";
import { ProChip } from "@/components/pro/pro-chip";
import { LIMITS } from "@/shared/plans";
import { Segmented } from "@/components/controls";
import { isRunOver, newRun, type Run, type StageResult } from "@/expedition/run";
import { Runner } from "@/expedition/runner";
import { stageCount, type ExpeditionSettings } from "@/expedition/settings";
import { SettingsForm } from "@/expedition/setup";
import { usePreloadedGames } from "@/expedition/stages";
import { RunSummary } from "@/expedition/summary";
import { copyText } from "@/lib/share";
import { readStore, usePersistent, writeStore } from "@/lib/storage";
import { ChatLog, mergeMessages } from "@/social/chat";
import {
  getParty,
  inviteToParty,
  joinParty,
  kickMember,
  leaveParty,
  postPartyResult,
  releaseStage,
  reopenLobby,
  sendPartyMessage,
  startParty,
  updateParty,
  type ChatMessage,
  type PartyMember,
  type PartyState,
  type PublicUser,
  type Visibility,
} from "@/social/client";
import { FriendsPanel } from "@/social/friends";
import type { Member } from "@/social/gate";
import { socialError, useSocialT } from "@/social/messages";
import { SocialTabs } from "@/social/tabs";
import { Racers, Standings } from "./standings";

/** How often a page in the room asks how things stand. */
const POLL_MS = 2500;
/** Errors that mean the player is not in the room any more. */
const OUT = ["no_such_party", "not_member", "join_needed", "banned", "party_full", "username_required", "unauthenticated"];

type View = {
  state: PartyState | null;
  /** The room's chat, gathered over the polls. */
  messages: ChatMessage[];
  /** The API's error name for the latest failed call. */
  error: string | null;
};

/** Enters the room and keeps asking how it stands for as long as the page is on it. */
function useRoom(code: string, joinAtOnce: boolean) {
  const [view, setView] = useState<View>({ state: null, messages: [], error: null });
  const [entry, setEntry] = useState(0);
  // Opening a bare link only looks; joining happens when the player says so.
  const [consent, setConsent] = useState(joinAtOnce);

  /** Takes in a fresh state: from a poll, or the answer to something the player did. */
  const apply = useCallback((state: PartyState) => {
    setView((previous) => ({ state, messages: mergeMessages(previous.messages, state.messages), error: null }));
  }, []);

  useEffect(() => {
    let stale = false;
    let busy = false;
    let inside = false;
    let last: number | undefined;

    async function poll() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        // The first call enters the room (and changes nothing for someone already in it).
        const state = inside || !consent ? await getParty(code, last) : await joinParty(code);
        inside = true;
        if (stale) return;
        last = state.messages.at(-1)?.id ?? last ?? 0;
        apply(state);
      } catch (error) {
        if (stale) return;
        let name = error instanceof ApiError ? error.code : "network";
        // Not in the room yet, and nobody has asked to join: offer, do not join.
        if (!inside && !consent && name === "not_member") name = "join_needed";
        if (OUT.includes(name)) {
          clearInterval(timer);
          setView((previous) => ({ ...previous, state: null, error: name }));
        } else {
          setView((previous) => ({ ...previous, error: name }));
        }
      } finally {
        busy = false;
      }
    }

    const timer = setInterval(poll, POLL_MS);
    void poll();
    document.addEventListener("visibilitychange", poll);
    return () => {
      stale = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [code, entry, consent, apply]);

  /** Adds chat lines that arrived outside a poll (the player's own, just sent). */
  const hear = useCallback((incoming: ChatMessage[]) => {
    setView((previous) => ({ ...previous, messages: mergeMessages(previous.messages, incoming) }));
  }, []);

  const reenter = useCallback(() => {
    setView({ state: null, messages: [], error: null });
    setEntry((value) => value + 1);
  }, []);

  const join = useCallback(() => {
    setView({ state: null, messages: [], error: null });
    setConsent(true);
    setEntry((value) => value + 1);
  }, []);

  return { ...view, apply, hear, reenter, join };
}

/** A party's room: the lobby, the race, and the chat that runs through both. */
export function Room({ code, me, joinAtOnce }: { code: string; me: Member; joinAtOnce: boolean }) {
  const { t } = useSocialT();
  const router = useRouter();
  const { state, messages, error, apply, hear, reenter, join } = useRoom(code, joinAtOnce);
  const runKey = `party-run:${code}`;
  const [run, setRun] = usePersistent<Run | null>(runKey, null);
  const posting = useRef(false);
  const [failure, setFailure] = useState<unknown>(null);

  /** Sends one of the player's scores; the server takes them in order. */
  async function post(runNumber: number, stage: number, result: StageResult) {
    if (posting.current) return;
    posting.current = true;
    try {
      await postPartyResult(code, { run: runNumber, stage, points: result.points, detail: result.detail });
    } catch {
      // Lost on the way, or the run ended: the next poll sorts it out.
    } finally {
      posting.current = false;
    }
  }

  // Keeps the run on this device and the scores on the server in step.
  const reconcile = useEffectEvent((current: PartyState) => {
    const { party } = current;
    const mine = current.members.find((member) => member.user.id === current.you);
    if (!mine || party.status !== "playing" || mine.spectator) return;

    const id = `${party.code}:${party.run}`;
    const local = readStore<Run | null>(runKey, null);
    if (local?.id !== id) {
      // A new run began (or this device is new to it): start where the server says.
      writeStore<Run>(runKey, newRun(id, party.seed, party.settings, mine.results));
    } else if (local.results.length < mine.results.length) {
      // Played further on another device: carry on from there.
      writeStore<Run>(runKey, { ...newRun(id, party.seed, party.settings, mine.results) });
    } else if (local.results.length > mine.results.length) {
      const stage = mine.results.length;
      void post(party.run, stage, local.results[stage]);
    }
  });
  useEffect(() => {
    if (state) reconcile(state);
  }, [state]);

  /** Runs something the player asked for, and shows why if the server refuses. */
  async function act(work: () => Promise<PartyState | void>) {
    setFailure(null);
    try {
      const next = await work();
      if (next) apply(next);
    } catch (problem) {
      setFailure(problem);
    }
  }

  async function send(body: string) {
    const { message } = await sendPartyMessage(code, body);
    hear([message]);
  }

  async function leave() {
    if (!window.confirm(t("leaveConfirm"))) return;
    await leaveParty(code).catch(() => {});
    router.push("/party");
  }

  if (!state) {
    return (
      <main className="page page-narrow" aria-busy={!error}>
        <SocialTabs current="party" />
        {error ? (
          <section className="notice">
            <h1>
              {t(
                error === "join_needed"
                  ? "joinPartyTitle"
                  : error === "not_member" || error === "banned"
                    ? "partyRemovedTitle"
                    : "partyGoneTitle",
              )}
            </h1>
            <p>{error === "join_needed" ? t("joinPartyLead", { code }) : t(socialError(new ApiError(error, 0)))}</p>
            <div className="page-actions">
              {error === "join_needed" && (
                <button type="button" className="button" onClick={join}>
                  {t("joinParty")}
                </button>
              )}
              {error !== "join_needed" && error !== "no_such_party" && error !== "not_member" && error !== "banned" && (
                <button type="button" className="button" onClick={reenter}>
                  {t("tryAgain")}
                </button>
              )}
              <Link href="/party" className="button button-quiet">
                {t("otherParties")}
              </Link>
            </div>
          </section>
        ) : (
          <div className="page-skeleton skeleton-block" />
        )}
      </main>
    );
  }

  const { party, members } = state;
  const isHost = party.hostId === me.id;
  const mine = members.find((member) => member.user.id === me.id);
  const stages = stageCount(party.settings);
  const racing = party.status === "playing" && !!mine && !mine.spectator;
  const active = racing && run?.id === `${party.code}:${party.run}` ? run : null;
  const title = party.name || t("partyOf", { name: members.find((member) => member.user.id === party.hostId)?.user.name ?? "" });
  const problem = failure !== null && (
    <p className="form-error" role="alert">
      {t(socialError(failure))}
    </p>
  );

  // ── Racing: the puzzle fills the page; the room rides along in a drawer ──
  if (active && !isRunOver(active)) {
    // Playing "together": a finished puzzle waits for everyone who is here.
    const finishedStage = active.results.length > active.stage;
    const waitingFor = members.filter(
      (member) =>
        member.user.id !== me.id && !member.spectator && member.results.length <= active.stage,
    );
    const held =
      party.settings.pace === "together" && finishedStage && waitingFor.length > 0 && party.released < active.stage;

    return (
      <>
        <Runner
          run={active}
          onChange={setRun}
          onResult={(stage, result) => void post(party.run, stage, result)}
          aside={<Racers members={members} me={me.id} />}
          hold={
            held ? (
              <div className="hold">
                <p>{t("waitingFor", { names: waitingFor.map((member) => member.user.name).join(", ") })}</p>
                {isHost && (
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => act(() => releaseStage(code, active.stage))}
                  >
                    {t("stopWaiting")}
                  </button>
                )}
              </div>
            ) : undefined
          }
        />
        <RoomDrawer messages={messages} me={me.id} onSend={send}>
          <Standings members={members} stages={stages} me={me.id} hostId={party.hostId} />
          {isHost && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                if (window.confirm(t("endRunConfirm"))) void act(() => reopenLobby(code));
              }}
            >
              {t("endRun")}
            </button>
          )}
        </RoomDrawer>
      </>
    );
  }

  const chat = (
    <section className="panel panel-chat" aria-labelledby="party-chat">
      <header className="panel-head">
        <h2 id="party-chat">{t("partyChat")}</h2>
      </header>
      <ChatLog messages={messages} me={me.id} onSend={send} empty={t("partyChatEmpty")} />
    </section>
  );

  // ── The race, seen from the side: finished, or watching ──
  if (party.status === "playing") {
    // Someone whose tab went quiet is not finished: the host can end the race from the buttons below.
    const everyoneDone = members.every((member) => member.spectator || member.results.length >= stages);
    return (
      <main className="page">
        <SocialTabs current="party" />
        <header className="page-head">
          <p className="eyebrow">{title}</p>
          <h1>{t(everyoneDone ? "finalStandings" : "raceOn")}</h1>
          <p>
            {mine?.spectator
              ? t("spectating")
              : everyoneDone
                ? t(isHost ? "raceOverHost" : "raceOverGuest")
                : t("raceWaiting")}
          </p>
        </header>
        {error === "network" && <p className="form-error">{t("reconnecting")}</p>}
        <div className="community">
          <section className="panel">
            <Standings members={members} stages={stages} me={me.id} hostId={party.hostId} />
            {isHost && (
              <div className="page-actions">
                {everyoneDone && (
                  <button type="button" className="button" onClick={() => act(() => startParty(code))}>
                    {t("playAgain")}
                  </button>
                )}
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => {
                    // Others may still be playing: asking first keeps one click from wiping their race.
                    if (everyoneDone || window.confirm(t("endRunConfirm"))) void act(() => reopenLobby(code));
                  }}
                >
                  {t("backToLobby")}
                </button>
              </div>
            )}
            {problem}
            {active && (
              <details className="run-details">
                <summary>{t("yourRun")}</summary>
                <RunSummary run={active} />
              </details>
            )}
            <button type="button" className="link-button" onClick={leave}>
              {t("leaveParty")}
            </button>
          </section>
          {chat}
        </div>
      </main>
    );
  }

  // ── The lobby ──
  return (
    <Lobby
      state={state}
      me={me}
      title={title}
      act={act}
      onLeave={leave}
      offline={error === "network"}
      problem={problem}
      chat={chat}
    />
  );
}

type LobbyProps = {
  state: PartyState;
  me: Member;
  title: string;
  act: (work: () => Promise<PartyState | void>) => Promise<void>;
  onLeave: () => void;
  offline: boolean;
  problem: React.ReactNode;
  chat: React.ReactNode;
};

/** Between runs: who is here, the rules of the next run, and (for the host) the start button. */
function Lobby({ state, me, title, act, onLeave, offline, problem, chat }: LobbyProps) {
  const { t } = useSocialT();
  const { party, members } = state;
  const { code } = party;
  const isHost = party.hostId === me.id;
  const stages = stageCount(party.settings);
  const [copied, setCopied] = useState(false);
  // What the host is changing, shown at once while the server catches up.
  const [draft, setDraft] = useState<ExpeditionSettings | null>(null);
  const [invited, setInvited] = useState<string[]>([]);
  const inside = new Set(members.map((member) => member.user.id));
  // While everyone waits in the lobby, the games of the next run are fetched.
  usePreloadedGames(party.settings);

  async function changeSettings(settings: ExpeditionSettings) {
    setDraft(settings);
    await act(() => updateParty(code, { settings }, party.settings));
    setDraft((current) => (current === settings ? null : current));
  }

  async function copyLink() {
    if (await copyText(`${window.location.origin}/party?code=${code}`)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  }

  const invite = (friend: PublicUser) =>
    inside.has(friend.id) ? (
      <span className="chip chip-flat">{t("inParty")}</span>
    ) : (
      <button
        type="button"
        className="chip chip-solid"
        disabled={invited.includes(friend.id)}
        onClick={() =>
          void inviteToParty(code, friend.id)
            .then(() => setInvited((list) => [...list, friend.id]))
            .catch(() => {})
        }
      >
        {t(invited.includes(friend.id) ? "invited" : "invite")}
      </button>
    );

  return (
    <main className="page">
      <SocialTabs current="party" />
      <header className="page-head party-head">
        <div>
          <p className="eyebrow">{t("partyLobby")}</p>
          <h1>{title}</h1>
        </div>
        <div className="party-code">
          <span className="eyebrow">{t("partyCode")}</span>
          <strong>{code}</strong>
          <button type="button" className="chip" onClick={copyLink}>
            {copied ? t("copied") : t("copyInvite")}
          </button>
        </div>
      </header>
      {offline && <p className="form-error">{t("reconnecting")}</p>}

      <div className="lobby">
        <section className="panel" aria-labelledby="party-members">
          <header className="panel-head">
            <h2 id="party-members">
              {t("players")} <small>{members.length}/{party.seats ?? 12}</small>
            </h2>
          </header>
          {isHost && <ProSeatsHint />}
          <Standings
            members={party.run > 0 ? members : members.map((member) => ({ ...member, results: [] }))}
            stages={stages}
            me={me.id}
            hostId={party.hostId}
            action={(member: PartyMember) =>
              isHost && member.user.id !== me.id ? (
                <button
                  type="button"
                  className="chip"
                  onClick={() => act(() => kickMember(code, member.user.id))}
                  aria-label={`${t("remove")}: ${member.user.name}`}
                >
                  {t("remove")}
                </button>
              ) : null
            }
          />
          {party.run > 0 && <p className="hint">{t("lastRunNote")}</p>}

          <details className="invite-friends">
            <summary>{t("inviteFriends")}</summary>
            <FriendsPanel action={invite} />
          </details>

          {isHost && (
            <div className="party-admin">
              <PartyName code={code} name={party.name} act={act} />
              <Segmented
                label={t("visibility")}
                options={[
                  { value: "private" as Visibility, label: t("visibility_private") },
                  { value: "public" as Visibility, label: t("visibility_public") },
                ]}
                value={party.visibility}
                onChange={(visibility) => void act(() => updateParty(code, { visibility }))}
              />
              <p className="hint">{t(`visibilityHint_${party.visibility}`)}</p>
            </div>
          )}
          <button type="button" className="link-button" onClick={onLeave}>
            {t("leaveParty")}
          </button>
        </section>

        <section className="panel" aria-labelledby="party-rules">
          <header className="panel-head">
            <h2 id="party-rules">{t("theGame")}</h2>
          </header>
          {!isHost && <p className="hint">{t("hostDecides")}</p>}
          <SettingsForm value={draft ?? party.settings} onChange={changeSettings} disabled={!isHost} party />
          {problem}
          <div className="page-actions">
            {isHost ? (
              <button type="button" className="button button-wide" onClick={() => act(() => startParty(code))}>
                {t(members.length > 1 ? "startParty" : "startAlone")}
              </button>
            ) : (
              <p className="waiting-host">{t("waitingHost")}</p>
            )}
          </div>
        </section>

        {chat}
      </div>
    </main>
  );
}

/** The host names the party. */
function PartyName({ code, name, act }: { code: string; name: string; act: LobbyProps["act"] }) {
  const { t } = useSocialT();
  return (
    <form
      className="party-name"
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("name");
        void act(() => updateParty(code, { name: String(value ?? "") }));
      }}
    >
      <label className="field">
        <span>{t("partyName")}</span>
        <input name="name" key={name} defaultValue={name} maxLength={40} placeholder={t("partyNamePlaceholder")} />
      </label>
      <button type="submit" className="chip">
        {t("save")}
      </button>
    </form>
  );
}

type DrawerProps = {
  messages: ChatMessage[];
  me: string;
  onSend: (body: string) => Promise<void>;
  /** Shown above the chat: the standings. */
  children: React.ReactNode;
};

/** The room while a puzzle is on screen: a button in the corner that opens the standings and the chat. */
function RoomDrawer({ messages, me, onSend, children }: DrawerProps) {
  const { t } = useSocialT();
  const [open, setOpen] = useState(false);
  const newest = messages.at(-1)?.id ?? 0;
  // The newest message the player has seen: what came later counts as unread.
  const [seen, setSeen] = useState(newest);
  const unread = open ? 0 : messages.filter((message) => message.id > seen && message.user.id !== me).length;

  return (
    <aside className="drawer" data-open={open ? "" : undefined}>
      {open && (
        <div className="drawer-body">
          {children}
          <ChatLog messages={messages} me={me} onSend={onSend} empty={t("partyChatEmpty")} />
        </div>
      )}
      <button
        type="button"
        className="button drawer-toggle"
        aria-expanded={open}
        onClick={() => {
          setSeen(newest);
          setOpen(!open);
        }}
      >
        {open ? t("close") : t("partyRoom")}
        {unread > 0 && <i className="badge">{unread}</i>}
      </button>
    </aside>
  );
}

/** For a host without Pro, while plans are shown: what a Pro host's room gets. */
function ProSeatsHint() {
  const t = useProT();
  const { showPro, owns } = useEntitlements();
  if (!showPro || owns("party.host16")) return null;
  return (
    <p className="hint pro-hint">
      <ProChip /> {t("partySeats", { n: LIMITS.pro.partySeats })}
    </p>
  );
}
