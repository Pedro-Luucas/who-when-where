import type { ShellKey } from "@/lib/shell-messages";

// The site's main places, shared by the header's pills, the phone's bottom
// bar and the search. `match` says which addresses light the item up.

export type NavItem = {
  href: string;
  label: ShellKey;
  icon: IconName;
  match: (path: string) => boolean;
};

export const PLAY: NavItem = {
  href: "/play",
  label: "navPlay",
  icon: "play",
  match: (path) => path === "/play" || path.startsWith("/play/"),
};
export const DAILY: NavItem = { href: "/daily", label: "navDaily", icon: "calendar", match: (path) => path === "/daily" };
export const LEADERBOARD: NavItem = {
  href: "/leaderboard",
  label: "navLeaderboard",
  icon: "trophy",
  match: (path) => path === "/leaderboard",
};
export const COMMUNITY: NavItem = {
  href: "/community",
  label: "navCommunity",
  icon: "people",
  match: (path) => path === "/community" || path === "/player",
};
export const PARTY: NavItem = { href: "/party", label: "navParty", icon: "party", match: (path) => path === "/party" };

/** The header's pills, in order. */
export const HEADER_NAV = [PLAY, DAILY, LEADERBOARD, COMMUNITY, PARTY];

export type IconName =
  | "home"
  | "play"
  | "calendar"
  | "trophy"
  | "people"
  | "party"
  | "user"
  | "search"
  | "book"
  | "compass"
  | "sliders"
  | "star"
  | "shuffle"
  | "filter"
  | "help"
  | "chart"
  | "flag"
  | "skip"
  | "back"
  | "close"
  | "link"
  | "chevron";

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3.5 10.5L12 3.8l8.5 6.7V20a.8.8 0 0 1-.8.8H15v-6h-6v6H4.3a.8.8 0 0 1-.8-.8z" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  calendar: (
    <>
      <rect x="3.8" y="5.2" width="16.4" height="15" rx="2" />
      <path d="M3.8 9.8h16.4M8.2 3.2v4M15.8 3.2v4" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H4.2c0 3 1.4 4.6 3.6 4.9M16.5 6h3.3c0 3-1.4 4.6-3.6 4.9M12 14v3.5M8.5 20.5h7M9.5 17.5h5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.4 14.6c1.9.6 3.2 2.2 3.6 4.9" />
    </>
  ),
  party: (
    <>
      <path d="M4 20l4.2-12 7.8 7.8z" />
      <path d="M13.5 3.5c.4 1.6-.2 2.8-1.5 3.5M20.5 10.5c-1.6-.4-2.8.2-3.5 1.5M17 4.5v.1M19.5 7v.1M14.8 8.8L19 4.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.8" />
      <path d="M4.5 20.5c.8-4 3.8-6.3 7.5-6.3s6.7 2.3 7.5 6.3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  book: <path d="M12 6.2C10 4.8 7.2 4.4 3.8 4.7v13.8c3.4-.3 6.2.1 8.2 1.5 2-1.4 4.8-1.8 8.2-1.5V4.7c-3.4-.3-6.2.1-8.2 1.5zM12 6.2v13.8" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  star: <path d="M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z" />,
  shuffle: <path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.2 3.4-2.8M13.1 9.8C13.9 8.2 14.9 7 16.5 7H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.6M12 17v.2" />
    </>
  ),
  chart: <path d="M5 20V13M12 20V5M19 20v-9" />,
  flag: <path d="M6 21V4M6 5h10.5l-2 4 2 4H6" />,
  skip: <path d="M6 6.5v11l8-5.5zM17.5 6v12" />,
  back: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  chevron: <path d="M9 5.5l6.5 6.5L9 18.5" />,
};

/** A line icon on a 24-unit grid, in the current text colour. Decorative. */
export function Icon({ name, className, size = 18 }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
