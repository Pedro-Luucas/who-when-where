import { cn } from "./cn";

/** How many avatar colours there are to pick from (the API knows the same number). */
export const AVATAR_COUNT = 8;

type AvatarProps = {
  /** The initial comes from here. */
  name: string;
  /** Index into the avatar colours (--avatar-0…7 in app/social.css). */
  color: number;
  /** Adds the dot that says the player is online (true) or away (false). */
  online?: boolean;
  /**
   * Words for the dot, read by screen readers ("online" / "away"). Without
   * them the avatar is decoration and the name next to it does the talking.
   */
  presenceLabels?: { online: string; away: string };
  size?: "small" | "large";
  className?: string;
};

/** A player's mark: their initial on the colour they picked, with a presence dot. */
export function Avatar({ name, color, online, presenceLabels, size, className }: AvatarProps) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? "?";
  const spoken = online !== undefined && presenceLabels;
  return (
    <span className={cn("avatar", className)} data-color={color % AVATAR_COUNT} data-size={size}>
      <span aria-hidden="true">{initial}</span>
      {online !== undefined && <i data-online={online ? "" : undefined} aria-hidden="true" />}
      {spoken && <span className="sr-only">{online ? presenceLabels.online : presenceLabels.away}</span>}
    </span>
  );
}
