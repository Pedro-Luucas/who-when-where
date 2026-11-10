"use client";

import { gradeOf, runTotal } from "@/expedition/run";
import { formatNumber } from "@/lib/i18n";
import { Avatar, Player } from "@/social/avatar";
import type { PartyMember } from "@/social/client";
import { useSocialT } from "@/social/messages";

/** Members in the order of the race: most points first, then furthest along. */
export function ranked(members: PartyMember[]): (PartyMember & { total: number; rank: number })[] {
  const sorted = members
    .map((member) => ({ ...member, total: runTotal(member.results) }))
    .sort((a, b) => b.total - a.total || b.results.length - a.results.length);
  let rank = 0;
  return sorted.map((member, i) => {
    if (i === 0 || member.total < sorted[i - 1].total) rank = i + 1;
    return { ...member, rank };
  });
}

type Props = {
  members: PartyMember[];
  /** Puzzles in the run. */
  stages: number;
  /** The viewer's id. */
  me: string;
  hostId: string;
  /** Shown at the end of each row (the host's "remove" button). */
  action?: (member: PartyMember) => React.ReactNode;
};

/** Who is in the party and how each stands in the run: a square per puzzle, and the total. */
export function Standings({ members, stages, me, hostId, action }: Props) {
  const { locale, t } = useSocialT();
  const anyScore = members.some((member) => member.results.length > 0);

  return (
    <ol className="board standings">
      {ranked(members).map((member) => {
        const done = member.results.length;
        const note = member.spectator
          ? t("watching")
          : !member.here
            ? t("away")
            : !anyScore
              ? member.user.id === hostId
                ? t("host")
                : `@${member.user.username}`
              : done >= stages
                ? t("finished")
                : t("progressOf", { n: done, total: stages });
        return (
          <li
            key={member.user.id}
            data-rank={anyScore && member.rank <= 3 ? member.rank : undefined}
            data-me={member.user.id === me ? "" : undefined}
            data-away={member.here ? undefined : ""}
          >
            <span className="board-rank">{anyScore ? member.rank : "·"}</span>
            <Player user={{ ...member.user, online: member.here }} presence note={note} />
            {anyScore && (
              <ol className="run-dots" aria-hidden="true">
                {Array.from({ length: stages }, (_, stage) => {
                  const result = member.results[stage];
                  return (
                    <li
                      key={stage}
                      data-state={result ? "done" : stage === done && !member.spectator ? "current" : "todo"}
                      data-grade={result ? gradeOf(result.points) : undefined}
                      title={result ? String(result.points) : undefined}
                    />
                  );
                })}
              </ol>
            )}
            {anyScore && <strong className="board-points">{formatNumber(member.total, locale)}</strong>}
            {action?.(member)}
          </li>
        );
      })}
    </ol>
  );
}

/** The race in a few marks, for the bar above the puzzle: the leaders and their totals. */
export function Racers({ members, me }: { members: PartyMember[]; me: string }) {
  const { locale } = useSocialT();
  const racing = ranked(members.filter((member) => !member.spectator));
  return (
    <ol className="racers">
      {racing.slice(0, 6).map((member) => (
        <li
          key={member.user.id}
          data-me={member.user.id === me ? "" : undefined}
          data-away={member.here ? undefined : ""}
          title={`${member.user.name} · ${member.results.length}`}
        >
          <Avatar name={member.user.name} color={member.user.avatar} size="small" />
          <span>{formatNumber(member.total, locale)}</span>
        </li>
      ))}
    </ol>
  );
}
