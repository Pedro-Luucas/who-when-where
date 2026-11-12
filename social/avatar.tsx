import Link from "next/link";

// The avatar itself is the UI kit's (components/ui/avatar.tsx).
import { Avatar } from "@/components/ui/avatar";
export { AVATAR_COUNT, Avatar } from "@/components/ui/avatar";

/** A player's chosen flag, small, beside their name. Decorative: the name says who they are. */
export function Flag({ code, className }: { code?: string | null; className?: string }) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG; next/image adds nothing here
    <img
      src={`/flags/${code.toLowerCase()}.svg`}
      alt=""
      width={18}
      height={13}
      loading="lazy"
      className={className ?? "inline-block h-[13px] w-[18px] shrink-0 rounded-[2px] object-cover align-[-1px] shadow-[0_0_0_1px_rgb(255_255_255/0.15)]"}
    />
  );
}

type PlayerProps = {
  user: { username: string; name: string; avatar: number; online?: boolean; country?: string | null };
  /** Show whether they are online. */
  presence?: boolean;
  /** Extra line under the name. */
  note?: React.ReactNode;
};

/** A player as shown in lists: avatar, name and handle, linking to their profile. */
export function Player({ user, presence, note }: PlayerProps) {
  return (
    <Link href={`/u/${encodeURIComponent(user.username)}`} className="player">
      <Avatar name={user.name} color={user.avatar} online={presence ? !!user.online : undefined} />
      <span className="player-text">
        <b>
          {user.name} <Flag code={user.country} />
        </b>
        <small>{note ?? `@${user.username}`}</small>
      </span>
    </Link>
  );
}
