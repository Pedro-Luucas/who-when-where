// Fixed-window counters, kept in memory: enough for one process, and they
// reset on restart.

type Window = { count: number; resetsAt: number };

const MINUTE = 60_000;

export type Limit = { max: number; windowMs: number };

export const LIMITS = {
  /** Sign-in attempts against one e-mail address. */
  loginPerEmail: { max: 10, windowMs: 15 * MINUTE },
  /** Sign-in attempts from one address. */
  loginPerIp: { max: 60, windowMs: 15 * MINUTE },
  /** Accounts created from one address. */
  signupPerIp: { max: 20, windowMs: 60 * MINUTE },
  /** Password re-checks (change e-mail or password, delete account) per account. */
  confirmPerUser: { max: 10, windowMs: 15 * MINUTE },
  /** Save uploads per account. */
  savesPerUser: { max: 120, windowMs: MINUTE },
  /** Finished-puzzle scores sent for the leaderboards, per account. */
  resultsPerUser: { max: 120, windowMs: MINUTE },
  /** Chat messages per account, in every room together. */
  chatPerUser: { max: 30, windowMs: MINUTE },
  /** Friend requests per account. */
  friendsPerUser: { max: 40, windowMs: 60 * MINUTE },
  /** Player searches per account. */
  searchPerUser: { max: 90, windowMs: MINUTE },
  /** Parties opened per account. */
  partiesPerUser: { max: 20, windowMs: 60 * MINUTE },
  /** Party invitations sent per account. */
  invitesPerUser: { max: 60, windowMs: 60 * MINUTE },
} satisfies Record<string, Limit>;

export class RateLimiter {
  private windows = new Map<string, Window>();

  /** Counts one attempt. Returns 0 if it is allowed, else the seconds to wait. */
  hit(key: string, limit: Limit, now = Date.now()): number {
    let window = this.windows.get(key);
    if (!window || window.resetsAt <= now) {
      window = { count: 0, resetsAt: now + limit.windowMs };
      this.windows.set(key, window);
    }
    window.count++;
    return window.count > limit.max ? Math.ceil((window.resetsAt - now) / 1000) : 0;
  }

  /** Drops finished windows; call now and then. */
  sweep(now = Date.now()): void {
    for (const [key, window] of this.windows) {
      if (window.resetsAt <= now) this.windows.delete(key);
    }
  }
}
