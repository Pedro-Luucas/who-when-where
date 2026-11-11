import Link from "next/link";

// The avatar itself is the UI kit's (components/ui/avatar.tsx).
import { Avatar } from "@/components/ui/avatar";
export { AVATAR_COUNT, Avatar } from "@/components/ui/avatar";

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
