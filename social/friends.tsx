"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/account/state";
import { Icon } from "@/components/shell/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { CHALLENGE_SLUGS } from "@/games/registry";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { Player } from "./avatar";
import {
  REACTIONS,
  acceptFriend,
  addFriend,
  getFriends,
  getNudges,
  getReactions,
  removeFriend,
  searchPlayers,
  sendNudge,
  setReaction,
  type PublicUser,
  type Reaction,
  type ReactionEmoji,
  type Relation,
} from "./client";
import { isMissingFeature } from "./connect-messages";
import { socialError, useSocialT, type SocialKey } from "./messages";
import { refreshPulse, usePulse } from "./pulse";
import { useRemote } from "./remote";

const MARK: Record<ReactionEmoji, string> = {
  pin: "📌",
  fire: "🔥",
  clap: "👏",
  mind: "🧠",
};

function reactionName(emoji: ReactionEmoji, t: (key: SocialKey) => string): string {
  switch (emoji) {
    case "pin":
      return t("reaction_pin");
    case "fire":
      return t("reaction_fire");
    case "clap":
      return t("reaction_clap");
    case "mind":
      return t("reaction_mind");
    default: {
      const never: never = emoji;
      return never;
    }
  }
}

function tally(list: Reaction[]): { emoji: ReactionEmoji; n: number }[] {
  const counts = new Map<ReactionEmoji, number>();
  for (const reaction of list) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  }
  return REACTIONS.flatMap((emoji) => {
    const n = counts.get(emoji);
    return n ? [{ emoji, n }] : [];
  });
}

const FRIENDS_EVERY_MS = 12_000;
const SEARCH_DELAY_MS = 300;

/** `value`, once it has stopped changing for `delay` ms. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

type RelationProps = {
  user: PublicUser;
  relation: Relation;
  /** Called after the relation changed on the server. */
  onChange: () => void;
};

/** The button that fits how the viewer stands with a player: add, accept, take back, remove. */
export function RelationButton({ user, relation, onChange }: RelationProps) {
  const { t } = useSocialT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (relation === "self") return null;

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      onChange();
      void refreshPulse();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relation">
      {relation === "none" && (
        <button type="button" className="chip chip-solid" disabled={busy} onClick={() => act(() => addFriend(user.username))}>
          {t("addFriend")}
        </button>
      )}
      {relation === "incoming" && (
        <>
          <button type="button" className="chip chip-solid" disabled={busy} onClick={() => act(() => acceptFriend(user.id))}>
            {t("accept")}
          </button>
          <button type="button" className="chip" disabled={busy} onClick={() => act(() => removeFriend(user.id))}>
            {t("decline")}
          </button>
        </>
      )}
      {relation === "outgoing" && (
        <button
          type="button"
          className="chip"
          disabled={busy}
          title={t("cancelRequest")}
          onClick={() => act(() => removeFriend(user.id))}
        >
          {t("requested")} ×
        </button>
      )}
      {relation === "friends" && (
        <button
          type="button"
          className="chip"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("removeFriendConfirm", { name: user.name }))) void act(() => removeFriend(user.id));
          }}
        >
          {t("friendsMark")} ×
        </button>
      )}
      {error !== null && (
        <small className="form-error" role="alert">
          {t(socialError(error))}
        </small>
      )}
    </span>
  );
}

type Props = {
  /** Opens a conversation with a friend. */
  onMessage?: (friend: PublicUser) => void;
  /** Shown beside each friend, e.g. an "invite" button in a party. */
  action?: (friend: PublicUser) => React.ReactNode;
  /** The community list: today's score, a nudge, and reactions. */
  roster?: boolean;
};

/** The player's friends: finding people, answering requests, and who is around. */
export function FriendsPanel({ onMessage, action, roster = false }: Props) {
  const { locale, t } = useSocialT();
  const day = useDayNumber();
  const pulse = usePulse();
  const account = useAccount();
  const meId = account.status === "user" ? account.account.id : "";
  const friends = useRemote(day >= 1 ? `friends:${day}` : "friends", () => getFriends(day), FRIENDS_EVERY_MS);
  const nudges = useRemote(roster && day >= 1 ? `nudges:${day}` : null, () => getNudges(day), FRIENDS_EVERY_MS);
  const reactions = useRemote(roster && day >= 1 ? `reactions:${day}` : null, () => getReactions(day), FRIENDS_EVERY_MS);
  const [busy, setBusy] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<{ id: string; error: unknown } | null>(null);
  const [query, setQuery] = useState("");
  const settled = useSettled(query.trim(), SEARCH_DELAY_MS);
  const search = useRemote(settled.length >= 2 ? `search:${settled}` : null, () => searchPlayers(settled));

  const unread = new Map(pulse.unread.map((entry) => [entry.userId, entry.count]));
  const changed = () => {
    friends.reload();
    search.reload();
  };
  const list = friends.data;
  const sent = new Set(nudges.data?.sent ?? []);
  const showNudge = roster && !isMissingFeature(nudges.error);
  const showReactions = roster && !isMissingFeature(reactions.error);
  const onFriend = new Map<string, Reaction[]>();
  for (const reaction of reactions.data?.reactions ?? []) {
    if (reaction.game !== "all") continue;
    const group = onFriend.get(reaction.toId) ?? [];
    group.push(reaction);
    onFriend.set(reaction.toId, group);
  }

  async function nudge(userId: string) {
    setBusy(userId);
    setTrouble(null);
    try {
      await sendNudge(userId);
      nudges.reload();
    } catch (error) {
      setTrouble({ id: userId, error });
    } finally {
      setBusy(null);
    }
  }

  async function react(userId: string, emoji: ReactionEmoji) {
    setBusy(`${userId}:${emoji}`);
    setTrouble(null);
    try {
      await setReaction(userId, emoji);
      reactions.reload();
    } catch (error) {
      setTrouble({ id: userId, error });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="friends">
      <label className="field">
        <span>{t("findPlayers")}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("findPlayersPlaceholder")}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      {settled.length >= 2 && (
        <ul className="people">
          {search.data?.players.map(({ user, relation }) => (
            <li key={user.id}>
              <Player user={user} presence />
              <RelationButton user={user} relation={relation} onChange={changed} />
            </li>
          ))}
          {search.data?.players.length === 0 && <li className="people-empty">{t("noPlayersFound")}</li>}
          {search.error && <li className="form-error">{t(socialError(search.error))}</li>}
        </ul>
      )}

      {list && list.incoming.length > 0 && (
        <>
          <h3 className="eyebrow">{t("friendRequests")}</h3>
          <ul className="people">
            {list.incoming.map((user) => (
              <li key={user.id}>
                <Player user={user} />
                <RelationButton user={user} relation="incoming" onChange={changed} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="eyebrow">
        {t("friends")} {list && <small>{list.friends.length}</small>}
      </h3>
      {roster && list?.friends.length === 0 ? (
        <EmptyState icon={<Icon name="people" />} title={t("friendsEmptyTitle")}>
          {t("friendsEmptyLead")}
        </EmptyState>
      ) : (
        <ul className="people">
          {list?.friends.map(({ user, today }) => {
            const marks = tally(onFriend.get(user.id) ?? []);
            const mine = (onFriend.get(user.id) ?? []).find((reaction) => reaction.from.id === meId)?.emoji;
            const scoreLabel = today
              ? t("friendToday", {
                  points: formatNumber(today.points, locale),
                  puzzles: today.puzzles,
                  total: CHALLENGE_SLUGS.length,
                })
              : undefined;
            if (!roster) {
              return (
                <li key={user.id}>
                  <Player user={user} presence note={scoreLabel} />
                  <span className="relation">
                    {action?.(user)}
                    {onMessage && (
                      <button type="button" className="chip" onClick={() => onMessage(user)}>
                        {t("message")}
                        {unread.has(user.id) && <i className="badge">{unread.get(user.id)}</i>}
                      </button>
                    )}
                  </span>
                </li>
              );
            }
            return (
              <li key={user.id} className="friend-row">
                <div className="friend-main">
                  <Player user={user} presence note={today ? `@${user.username}` : t("notPlayedToday")} />
                  {today && (
                    <span className="friend-score" aria-label={scoreLabel}>
                      <strong>{formatNumber(today.points, locale)}</strong>
                      <small>
                        {t("statToday")} · {today.puzzles}/{CHALLENGE_SLUGS.length}
                      </small>
                    </span>
                  )}
                  {showReactions && marks.length > 0 && (
                    <p className="reaction-marks">
                      {marks.map((mark) => (
                        <span key={mark.emoji}>
                          <span aria-hidden="true">{MARK[mark.emoji]}</span> {mark.n}
                          <span className="sr-only"> {reactionName(mark.emoji, t)}</span>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="friend-tools">
                  <span className="relation">
                    {action?.(user)}
                    {onMessage && (
                      <button type="button" className="chip" onClick={() => onMessage(user)}>
                        {t("message")}
                        {unread.has(user.id) && <i className="badge">{unread.get(user.id)}</i>}
                      </button>
                    )}
                    {showNudge && !today &&
                      (sent.has(user.id) ? (
                        <button type="button" className="chip chip-quiet" disabled>
                          {t("nudged")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="chip"
                          disabled={busy === user.id}
                          onClick={() => void nudge(user.id)}
                        >
                          {t("nudge")}
                        </button>
                      ))}
                  </span>
                  {showReactions && (
                    <div className="reaction-keys" role="group" aria-label={t("react")}>
                      {REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="chip"
                          aria-pressed={mine === emoji}
                          aria-label={reactionName(emoji, t)}
                          disabled={busy === `${user.id}:${emoji}`}
                          onClick={() => void react(user.id, emoji)}
                        >
                          <span aria-hidden="true">{MARK[emoji]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {trouble?.id === user.id && (
                    <small className="form-error" role="alert">
                      {t(socialError(trouble.error))}
                    </small>
                  )}
                </div>
              </li>
            );
          })}
          {!roster && list?.friends.length === 0 && <li className="people-empty">{t("noFriendsYet")}</li>}
          {!list && !friends.error && <li className="people-empty">…</li>}
          {friends.error && !list && <li className="form-error">{t(socialError(friends.error))}</li>}
        </ul>
      )}

      {list && list.outgoing.length > 0 && (
        <>
          <h3 className="eyebrow">{t("sentRequests")}</h3>
          <ul className="people">
            {list.outgoing.map((user) => (
              <li key={user.id}>
                <Player user={user} />
                <RelationButton user={user} relation="outgoing" onChange={changed} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
