"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/account/api";
import { numberLocale } from "@/lib/i18n";
import { Avatar } from "./avatar";
import { getMessages, sendMessage, type ChatMessage, type Room } from "./client";
import { socialError, useSocialT } from "./messages";
import { refreshPulse } from "./pulse";

const MESSAGE_MAX = 500;
/** How often an open room asks for new messages. */
const POLL_MS = 3000;
/** The most a page keeps of one room. */
const KEPT = 300;

/** Adds messages to a log: no repeats, oldest first, and not without end. */
export function mergeMessages(log: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const known = new Set(log.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  if (!fresh.length) return log;
  return [...log, ...fresh].sort((a, b) => a.id - b.id).slice(-KEPT);
}

type LogProps = {
  messages: ChatMessage[];
  /** The viewer's id: their own lines are marked. */
  me: string;
  /** Sends a line; rejects with an ApiError when the server refuses. */
  onSend: (body: string) => Promise<void>;
  /** Shown while there is nothing to read. */
  empty: string;
  /** Still fetching the room's first messages. */
  loading?: boolean;
};

/** A room's messages, with a line to write on. Whoever renders it holds the messages. */
export function ChatLog({ messages, me, onSend, empty, loading }: LogProps) {
  const { locale, t } = useSocialT();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const list = useRef<HTMLOListElement>(null);
  const time = new Intl.DateTimeFormat(numberLocale(locale), { hour: "2-digit", minute: "2-digit" });

  // Keep the newest line in view, unless the reader has scrolled up to read.
  const newest = messages.at(-1)?.id;
  const atBottom = useRef(true);
  useEffect(() => {
    const element = list.current;
    if (element && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [newest]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(body);
      setDraft("");
      atBottom.current = true;
    } catch (failure) {
      setError(failure);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat">
      <ol
        className="chat-log"
        ref={list}
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget;
          atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
        }}
      >
        {messages.map((message, i) => {
          // Lines in a row from one player share one heading.
          const follows = i > 0 && messages[i - 1].user.id === message.user.id && message.at - messages[i - 1].at < 300_000;
          return (
            <li key={message.id} data-own={message.user.id === me ? "" : undefined} data-follows={follows ? "" : undefined}>
              {!follows && (
                <p className="chat-who">
                  <Avatar name={message.user.name} color={message.user.avatar} size="small" />
                  <b>{message.user.name}</b>
                  <time>{time.format(message.at)}</time>
                </p>
              )}
              <p className="chat-body">{message.body}</p>
            </li>
          );
        })}
        {messages.length === 0 && <li className="chat-empty">{loading ? "…" : empty}</li>}
      </ol>
      {error !== null && (
        <p className="form-error" role="alert">
          {t(socialError(error))}
        </p>
      )}
      <form className="chat-form" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MESSAGE_MAX}
          placeholder={t("chatPlaceholder")}
          aria-label={t("chatPlaceholder")}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button type="submit" className="button" disabled={sending || !draft.trim()}>
          {t("send")}
        </button>
      </form>
    </div>
  );
}

type RoomState = { key: string; messages: ChatMessage[]; loaded: boolean; error: ApiError | null };

/** The global room or a conversation with a friend, kept up to date while it is on screen. */
export function RoomChat({ room, me, empty }: { room: Room; me: string; empty: string }) {
  const { t } = useSocialT();
  const kind = room.kind;
  const userId = room.kind === "dm" ? room.userId : "";
  const key = `${kind}:${userId}`;
  const [state, setState] = useState<RoomState>({ key, messages: [], loaded: false, error: null });
  const current = state.key === key ? state : { key, messages: [], loaded: false, error: null };

  useEffect(() => {
    const target: Room = kind === "dm" ? { kind, userId } : { kind };
    let stale = false;
    let busy = false;
    let last: number | undefined;

    async function poll() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const { messages } = await getMessages(target, last);
        if (stale) return;
        const first = last === undefined;
        last = messages.at(-1)?.id ?? last ?? 0;
        setState((previous) => ({
          key,
          messages: mergeMessages(previous.key === key ? previous.messages : [], messages),
          loaded: true,
          error: null,
        }));
        // Reading a conversation marks it read: the badges should follow.
        if (kind === "dm" && (first || messages.length)) void refreshPulse();
      } catch (error) {
        const failure = error instanceof ApiError ? error : new ApiError("network", 0);
        if (!stale) {
          setState((previous) => ({
            key,
            messages: previous.key === key ? previous.messages : [],
            loaded: true,
            error: failure,
          }));
        }
      } finally {
        busy = false;
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stale = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [key, kind, userId]);

  async function send(body: string) {
    const { message } = await sendMessage(room, body);
    setState((previous) =>
      previous.key === key ? { ...previous, messages: mergeMessages(previous.messages, [message]) } : previous,
    );
  }

  return (
    <>
      {current.error && current.messages.length === 0 && (
        <p className="form-error" role="alert">
          {t(socialError(current.error))}
        </p>
      )}
      <ChatLog messages={current.messages} me={me} onSend={send} empty={empty} loading={!current.loaded} />
    </>
  );
}
