"use client";

import { useEffect, useState } from "react";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { Player } from "./avatar";
import {
  acceptFriend,
  addFriend,
  getFriends,
  removeFriend,
  searchPlayers,
  type PublicUser,
  type Relation,
} from "./client";
import { socialError, useSocialT } from "./messages";
import { refreshPulse, usePulse } from "./pulse";
import { useRemote } from "./remote";

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
};

/** The player's friends: finding people, answering requests, and who is around. */
export function FriendsPanel({ onMessage, action }: Props) {
  const { locale, t } = useSocialT();
  const day = useDayNumber();
  const pulse = usePulse();
  const friends = useRemote("friends", () => getFriends(day), FRIENDS_EVERY_MS);
  const [query, setQuery] = useState("");
  const settled = useSettled(query.trim(), SEARCH_DELAY_MS);
  const search = useRemote(settled.length >= 2 ? `search:${settled}` : null, () => searchPlayers(settled));

  const unread = new Map(pulse.unread.map((entry) => [entry.userId, entry.count]));
  const changed = () => {
    friends.reload();
    search.reload();
  };
  const list = friends.data;

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
      <ul className="people">
        {list?.friends.map(({ user, today }) => (
          <li key={user.id}>
            <Player
              user={user}
              presence
              note={
                today
                  ? t("friendToday", { points: formatNumber(today.points, locale), puzzles: today.puzzles })
                  : undefined
              }
            />
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
        ))}
        {list?.friends.length === 0 && <li className="people-empty">{t("noFriendsYet")}</li>}
        {!list && !friends.error && <li className="people-empty">…</li>}
        {friends.error && !list && <li className="form-error">{t(socialError(friends.error))}</li>}
      </ul>

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
