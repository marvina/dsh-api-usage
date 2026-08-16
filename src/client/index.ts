/**
 * API usage surface: the sidebar-foot panel and the General settings toggle.
 * The panel derives today's and the current session's token usage from the
 * standard `useSessions` feed, and fetches the DeepSeek balance from the host
 * balance route; the toggle owns the durable `ui-api-usage` section.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.remote Context merge for `inject: ['remote']` (settings scope).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls ctx.locale into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings slots plus the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: declares the `sidebar.footer.action` slot entry.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ApiUsagePanelInjected } from './ApiUsagePanel.tsx'
import { ApiUsagePanel } from './ApiUsagePanel.tsx'
import type { ApiUsageToggleInjected } from './ApiUsageToggle.tsx'
import { ApiUsageToggle } from './ApiUsageToggle.tsx'
import { ApiUsagePolicy } from './api-usage-policy.ts'
import {
  API_USAGE_BALANCE_PATH, API_USAGE_SETTINGS_NAMESPACE, type ApiUsageSettings,
} from '../settings.ts'
import type { ApiUsageBalanceResult } from '../types.ts'
import { en, NS, zh } from './locales.ts'
import type { ApiUsageKey } from './locales.ts'

export type { ApiUsageKey } from './locales.ts'
export type { ApiUsagePanelInjected, ApiUsagePanelProps } from './ApiUsagePanel.tsx'
export type { ApiUsageToggleInjected, ApiUsageToggleProps } from './ApiUsageToggle.tsx'
export { ApiUsagePolicy } from './api-usage-policy.ts'
export type { ApiUsageSettings } from '../settings.ts'
export { API_USAGE_ENABLED_FIELD, API_USAGE_SETTINGS_NAMESPACE, DEFAULT_API_USAGE_ENABLED } from '../settings.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar panel + General toggle copy. */
    apiUsage: ApiUsageKey
  }
}

/**
 * Required services. `connection` and `remote` back the settings scope and the
 * balance Remote respectively (see the settings-scope contract).
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Mount the sidebar panel and the General settings toggle.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-api-usage: dictionaries')

  const host = ctx.settingsScope.bind<ApiUsageSettings>({ namespace: API_USAGE_SETTINGS_NAMESPACE })
  const loadBalance = async (): Promise<ApiUsageBalanceResult> => {
    const response = await fetch(API_USAGE_BALANCE_PATH)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json() as ApiUsageBalanceResult
  }
  const policy = new ApiUsagePolicy(host, loadBalance)

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'api-usage',
    order: -10,
    locale: NS,
    inject: (): ApiUsagePanelInjected => ({
      hooks: { enabled: policy.enabled, balance: policy.balance },
      refreshBalance: () => { void policy.refreshBalance() },
    }),
  }, ApiUsagePanel))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'api-usage',
    order: 30,
    locale: NS,
    inject: (): ApiUsageToggleInjected => ({
      hooks: { enabled: policy.enabled },
      setEnabled: (value) => { policy.setEnabled(value) },
    }),
  }, ApiUsageToggle))
}
