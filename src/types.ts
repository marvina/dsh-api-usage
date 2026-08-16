/** Client-safe vocabulary shared by the API-usage host and browser halves. */

/** A detached account-balance lookup, or one bounded failure message. */
export type ApiUsageBalanceResult =
  | {
    readonly ok: true
    /** Whether the platform reports the account usable. */
    readonly available: boolean
    /** Total balance as the platform's own string (kept verbatim, never re-parsed). */
    readonly balance: string | null
    /** ISO-4217 currency code, absent when the platform reports none. */
    readonly currency: string | null
    /** Granted (promotional) balance string, absent when none. */
    readonly granted: string | null
    /** Topped-up balance string, absent when none. */
    readonly toppedUp: string | null
  }
  | {
    readonly ok: false
    /** Bounded, user-facing reason the lookup could not complete. */
    readonly error: string
  }
