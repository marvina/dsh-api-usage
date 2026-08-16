/**
 * API-usage policy: the live enabled preference plus the balance snapshot,
 * mirrored from the durable settings scope and the host balance route.
 */

import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ApiUsageBalanceResult } from '../types.ts'
import {
  API_USAGE_ENABLED_FIELD, DEFAULT_API_USAGE_ENABLED, type ApiUsageSettings,
} from '../settings.ts'

export { DEFAULT_API_USAGE_ENABLED }

/**
 * Policy used by both the sidebar panel and the General settings toggle. It
 * owns the reactive enabled/balance snapshots and the two write paths
 * (preference write and balance refresh); the host scope supplies durability.
 */
export class ApiUsagePolicy {
  /** Reactive visibility preference for the Settings toggle and the panel gate. */
  readonly enabled: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_API_USAGE_ENABLED)
  /** Latest balance result; `null` until the first refresh settles. */
  readonly balance: SnapshotStore<ApiUsageBalanceResult | null> =
    createSnapshotStore<ApiUsageBalanceResult | null>(null)

  private readonly host: SettingsScope<ApiUsageSettings> | undefined
  private readonly loadBalance: (() => Promise<ApiUsageBalanceResult>) | undefined
  private refreshing = false

  /**
   * @param host - durable preference scope owned by the providing plugin.
   * @param loadBalance - Remote-backed balance fetch; absent compositions leave the snapshot at null.
   */
  constructor(
    host?: SettingsScope<ApiUsageSettings>,
    loadBalance?: () => Promise<ApiUsageBalanceResult>,
  ) {
    this.host = host
    this.loadBalance = loadBalance
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change the panel visibility; the live value publishes before the durable write.
   * @param value - whether the sidebar panel renders.
   */
  setEnabled(value: boolean): void {
    if (this.enabled.getSnapshot() === value) return
    this.enabled.set(value)
    void this.host?.set(API_USAGE_ENABLED_FIELD, value)
  }

  /** Refresh the balance snapshot; concurrent calls collapse into one in-flight fetch. */
  async refreshBalance(): Promise<void> {
    if (this.loadBalance === undefined || this.refreshing) return
    this.refreshing = true
    try {
      this.balance.set(await this.loadBalance())
    } catch (error) {
      this.balance.set({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.refreshing = false
    }
  }

  /** Adopt the scope's accepted durable visibility without writing it back. */
  private adopt(host: SettingsScope<ApiUsageSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined || this.enabled.getSnapshot() === section.enabled) return
    this.enabled.set(section.enabled)
  }
}
