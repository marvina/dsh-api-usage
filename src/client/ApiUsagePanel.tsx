/**
 * Sidebar-foot API usage panel: DeepSeek balance plus today's and the current
 * session's cumulative token usage, derived in-component from `useSessions`.
 */

import { useEffect } from 'react'
import type { SessionId, SessionListState, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ApiUsageBalanceResult } from '../types.ts'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: declares the `sidebar.footer.action` slot entry.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: merges the `tokenUsage` key into SessionProjectionMap.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import css from './ApiUsagePanel.module.css'

/** Registration-side business face. */
export interface ApiUsagePanelInjected {
  hooks: {
    /** Visibility gate (the panel renders null when false). */
    enabled: SnapshotStore<boolean>
    /** Latest balance result; null until the first refresh settles. */
    balance: SnapshotStore<ApiUsageBalanceResult | null>
  }
  /** Trigger one balance refresh. */
  refreshBalance: () => void
}

/** Full panel props: sidebar owner state + locale seat + injected face. */
export type ApiUsagePanelProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'apiUsage'>
  & InjectFace<ApiUsagePanelInjected>

const SYMBOLS: Readonly<Record<string, string>> = {
  CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
}

/** Compact human token count: exact below 1000, then K/M with one decimal. */
function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 1000000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`
}

/** Sum the four disjoint provider-reported usage buckets, or null when absent. */
function tokenTotal(tu: unknown): number | null {
  if (tu == null || typeof tu !== 'object') return null
  const buckets = tu as {
    uncachedInputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
  return (buckets.uncachedInputTokens ?? 0)
    + (buckets.outputTokens ?? 0)
    + (buckets.cacheReadTokens ?? 0)
    + (buckets.cacheWriteTokens ?? 0)
}

/** Whether a millisecond timestamp falls on the local calendar today. */
function isSameDay(ts: number): boolean {
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

/** Currency-symbol prefixed balance, or the availability fallback, or null. */
function balanceText(balance: ApiUsageBalanceResult | null): string | null {
  if (balance == null || balance.ok !== true) return null
  if (balance.balance == null) return balance.available ? '可用' : '不可用'
  const symbol = SYMBOLS[balance.currency ?? ''] ?? (balance.currency ? `${balance.currency} ` : '')
  return symbol + balance.balance
}

/** Cumulative token usage across today's active sessions, or null when none report usage. */
function todayTokens(byId: SessionListState['byId']): number | null {
  let total: number | null = null
  for (const row of Object.values(byId)) {
    if (row == null || !isSameDay(row.updatedAt)) continue
    const tokens = tokenTotal(row.projectionValues?.tokenUsage)
    if (tokens != null) total = (total ?? 0) + tokens
  }
  return total
}

/** Cumulative token usage of the addressed session, or null when absent. */
function currentTokens(byId: SessionListState['byId'], currentId: SessionId | undefined): number | null {
  if (currentId == null) return null
  const row = byId[currentId]
  return row == null ? null : tokenTotal(row.projectionValues?.tokenUsage)
}

/**
 * Render the API usage panel.
 * @param props - composed slot props.
 * @returns the panel, the rail badge, or null while disabled.
 */
export function ApiUsagePanel({
  wide, useSessions, useEnabled, useBalance, refreshBalance, t,
}: ApiUsagePanelProps) {
  const enabled = useEnabled(s => s)
  const balance = useBalance(s => s)
  const currentId = useSessions(s => s.current)
  const byId = useSessions(s => s.byId)

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  if (!enabled) return null

  if (!wide) {
    const label = balanceText(balance)
    return (
      <div className={css.rail} title={`${t('panel.title')} · ${t('panel.balance')} ${label ?? '…'}`}>
        {label?.slice(0, 4) ?? '¥'}
      </div>
    )
  }

  const label = balanceText(balance)
  const rows = [
    {
      key: 'balance',
      label: t('panel.balance'),
      value: label ?? (balance?.ok === false ? t('panel.failed') : '…'),
      error: balance?.ok === false,
      detail: balance?.ok === false ? balance.error : undefined,
    },
    {
      key: 'today',
      label: t('panel.today'),
      value: todayTokens(byId) != null ? `${formatTokens(todayTokens(byId)!)} tokens` : '—',
    },
    {
      key: 'session',
      label: t('panel.session'),
      value: currentTokens(byId, currentId) != null
        ? `${formatTokens(currentTokens(byId, currentId)!)} tokens`
        : '—',
    },
  ]

  return (
    <div className={css.panel}>
      <div className={css.title}>{t('panel.title')}</div>
      {rows.map(row => (
        <div key={row.key} className={css.row}>
          <span className={css.label}>{row.label}</span>
          <span
            className={row.error ? `${css.value} ${css.errorValue}` : css.value}
            title={row.detail}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
