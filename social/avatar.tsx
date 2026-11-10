import Link from "next/link";

/** How many avatar colours there are to pick from (the API knows the same number). */
export const AVATAR_COUNT = 8;

type AvatarProps = {
  /** The initial comes from here. */
  name: string;
  color: number;
  /** Adds the dot that says the player is online (true) or away (false). */
  online?: boolean;
  size?: "small" | "large";
};

/** A player's mark: their initial on the colour they picked. */
export function Avatar({ name, color, online, size }: AvatarProps) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? "?";
  return (
    <span className="avatar" data-color={color % AVATAR_COUNT} data-size={size} aria-hidden="true">
      {initial}
      {online !== undefined && <i data-online={online ? "" : undefined} />}
    </span>
  );
}

type PlayerProps = {
  user: { username: string; name: string; avatar: number; online?: boolean };
  /** Show whether they are online. */
  presence?: boolean;
  /** Extra line under the name. */
  note?: React.ReactNode;
};

/** A player as shown in lists: avatar, name and handle, linking to their profile. */
export function Player({ user, presence, note }: PlayerProps) {
  return (
    <Link href={`/player?u=${encodeURIComponent(user.username)}`} className="player">
      <Avatar name={user.name} color={user.avatar} online={presence ? !!user.online : undefined} />
      <span className="player-text">
        <b>{user.name}</b>
        <small>{note ?? `@${user.username}`}</small>
      </span>
    </Link>
  );
}
