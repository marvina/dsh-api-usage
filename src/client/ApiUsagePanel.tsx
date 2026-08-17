/** Sidebar-foot API balances and provider-attributed token usage. */

import { useEffect } from 'react'
import type { SessionId, SessionListState, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ApiUsageBalanceResult } from '../types.ts'
import type {
  ProviderTokenBuckets, ProviderTokenUsageProjection,
} from '../provider-usage-projection.ts'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: declares the sidebar slot and projection keys used below.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-token-meter/client'
import css from './ApiUsagePanel.module.css'

/** Registration-side business face. */
export interface ApiUsagePanelInjected {
  hooks: {
    /** Visibility gate (the panel renders null when false). */
    enabled: SnapshotStore<boolean>
    /** Latest DeepSeek balance result; null until the first refresh settles. */
    balance: SnapshotStore<ApiUsageBalanceResult | null>
    /** Configured provider display names, keyed by provider route id. */
    providers: SnapshotStore<Record<string, string>>
    /** Configured model display names, keyed by provider route id, then model id. */
    models: SnapshotStore<Record<string, Record<string, string>>>
  }
  /** Trigger one DeepSeek balance refresh. */
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

function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 1000000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`
}

function tokenTotal(buckets: ProviderTokenBuckets | undefined): number | null {
  if (buckets == null) return null
  return buckets.uncachedInputTokens + buckets.outputTokens
    + buckets.cacheReadTokens + buckets.cacheWriteTokens
}

function addBuckets(left: ProviderTokenBuckets, right: ProviderTokenBuckets): ProviderTokenBuckets {
  return {
    uncachedInputTokens: left.uncachedInputTokens + right.uncachedInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
  }
}

function canonicalProvider(provider: string): string {
  return provider === 'deepseek' || provider === 'deepseek-official'
    ? 'deepseek-official'
    : provider
}

function isSameDay(ts: number): boolean {
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
}

function balanceText(balance: ApiUsageBalanceResult | null): string | null {
  if (balance == null || balance.ok !== true) return null
  if (balance.balance == null) return balance.available ? '可用' : '不可用'
  const symbol = SYMBOLS[balance.currency ?? ''] ?? (balance.currency ? `${balance.currency} ` : '')
  return symbol + balance.balance
}

type SessionRow = NonNullable<SessionListState['byId'][SessionId]>

function usageOf(row: SessionRow | undefined): ProviderTokenUsageProjection {
  const values = row?.projectionValues
  const byProvider = values?.providerTokenUsage as ProviderTokenUsageProjection | undefined
  if (byProvider != null && Object.keys(byProvider).length > 0) {
    const merged: Record<string, Record<string, ProviderTokenBuckets>> = {}
    for (const [provider, models] of Object.entries(byProvider)) {
      const key = canonicalProvider(provider)
      merged[key] ??= {}
      for (const [model, buckets] of Object.entries(models)) {
        merged[key][model] = merged[key][model] == null ? buckets : addBuckets(merged[key][model], buckets)
      }
    }
    return merged
  }

  const legacy = values?.tokenUsage as ProviderTokenBuckets | undefined
  return legacy == null ? {} : { 'deepseek-official': { '': legacy } }
}

function todayTokens(
  byId: SessionListState['byId'], provider: string, model: string,
): number | null {
  let total: number | null = null
  for (const row of Object.values(byId)) {
    if (row == null || !isSameDay(row.updatedAt)) continue
    const tokens = tokenTotal(usageOf(row)[provider]?.[model])
    if (tokens != null) total = (total ?? 0) + tokens
  }
  return total
}

function currentTokens(
  byId: SessionListState['byId'], currentId: SessionId | undefined, provider: string, model: string,
): number | null {
  return currentId == null ? null : tokenTotal(usageOf(byId[currentId])[provider]?.[model])
}

function providerName(provider: string): string {
  const names: Readonly<Record<string, string>> = {
    'deepseek-official': 'DeepSeek',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
  }
  return names[provider] ?? provider.replace(/(^|[-_ ])([a-z])/g, (_, space, char: string) => `${space}${char.toUpperCase()}`)
}

function displayNameOf(provider: string, names: Readonly<Record<string, string>>): string {
  const configured = names[provider]
  return configured != null && configured.length > 0 ? configured : providerName(provider)
}

function modelDisplayName(
  provider: string,
  model: string,
  names: Readonly<Record<string, Readonly<Record<string, string>>>>,
): string {
  if (model.length === 0) return ''
  const configured = names[provider]?.[model]
  if (configured != null && configured.length > 0) return configured
  return model.replace(/(^|[-_ ])([a-z])/g, (_, space, char: string) => `${space}${char.toUpperCase()}`)
}

function modelsIn(byId: SessionListState['byId'], provider: string): string[] {
  const models = new Set<string>()
  for (const row of Object.values(byId)) {
    const buckets = usageOf(row)[provider]
    if (buckets == null) continue
    for (const model of Object.keys(buckets)) models.add(model)
  }
  return [...models].sort((left, right) => left.localeCompare(right))
}

function providersIn(
  byId: SessionListState['byId'],
  names: Readonly<Record<string, string>>,
): string[] {
  const providers = new Set<string>(['deepseek-official'])
  for (const row of Object.values(byId)) {
    for (const [provider, models] of Object.entries(usageOf(row))) {
      for (const buckets of Object.values(models)) {
        if ((tokenTotal(buckets) ?? 0) > 0) {
          providers.add(provider)
          break
        }
      }
    }
  }
  return [...providers].sort((left, right) => {
    if (left === 'deepseek-official') return -1
    if (right === 'deepseek-official') return 1
    if (left === 'openai') return -1
    if (right === 'openai') return 1
    return displayNameOf(left, names).localeCompare(displayNameOf(right, names))
  })
}

function tokensText(tokens: number | null): string {
  return tokens == null ? '—' : `${formatTokens(tokens)} tokens`
}

/** Render the API usage panel, grouped by each provider observed in session usage. */
export function ApiUsagePanel({
  wide, useSessions, useEnabled, useBalance, useProviders, useModels, refreshBalance, t,
}: ApiUsagePanelProps) {
  const enabled = useEnabled(s => s)
  const balance = useBalance(s => s)
  const providers = useProviders(s => s)
  const models = useModels(s => s)
  const currentId = useSessions(s => s.current)
  const byId = useSessions(s => s.byId)

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  if (!enabled) return null

  if (!wide) {
    const label = balanceText(balance)
    return (
      <div className={css.rail} title={`DeepSeek · ${t('panel.balance')} ${label ?? '…'}`}>
        {label?.slice(0, 4) ?? '¥'}
      </div>
    )
  }

  const deepSeekBalance = balanceText(balance)
  return (
    <div className={css.panel}>
      <div className={css.title}>{t('panel.title')}</div>
      {providersIn(byId, providers).map((provider, index) => {
        const isDeepSeek = provider === 'deepseek-official'
        const balanceValue = isDeepSeek
          ? deepSeekBalance ?? (balance?.ok === false ? t('panel.failed') : '…')
          : t('panel.balanceUnavailable')
        const balanceError = isDeepSeek && balance?.ok === false
        const balanceDetail = balanceError ? balance.error : undefined
        return (
          <section key={provider} className={index === 0 ? css.provider : `${css.provider} ${css.providerDivider}`}>
            <div className={css.providerName}>{displayNameOf(provider, providers)}</div>
            <div className={css.row}>
              <span className={css.label}>{t('panel.balance')}</span>
              <span
                className={balanceError ? `${css.value} ${css.errorValue}` : css.value}
                title={balanceDetail}
              >
                {balanceValue}
              </span>
            </div>
            {modelsIn(byId, provider).map(model => {
              const label = modelDisplayName(provider, model, models)
              return (
                <div key={model} className={css.modelGroup}>
                  {label !== '' && <div className={css.modelName}>{label}</div>}
                  <div className={css.row}>
                    <span className={css.label}>{t('panel.today')}</span>
                    <span className={css.value}>{tokensText(todayTokens(byId, provider, model))}</span>
                  </div>
                  <div className={css.row}>
                    <span className={css.label}>{t('panel.session')}</span>
                    <span className={css.value}>{tokensText(currentTokens(byId, currentId, provider, model))}</span>
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
