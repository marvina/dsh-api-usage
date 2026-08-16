/** API-usage panel preference stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the API-usage plugin. */
export const API_USAGE_SETTINGS_NAMESPACE = 'ui-api-usage'

/** Host HTTP route the browser half fetches for the DeepSeek account balance. */
export const API_USAGE_BALANCE_PATH = '/api/api-usage/balance'

/** Field carrying whether the sidebar panel is shown. */
export const API_USAGE_ENABLED_FIELD = 'enabled'

/** Default: the panel is visible until the user turns it off. */
export const DEFAULT_API_USAGE_ENABLED = true

/** Durable API-usage section shared by the Host schema and the browser scope. */
export interface ApiUsageSettings {
  /** Whether the sidebar-foot usage panel renders. */
  enabled: boolean
}

/** Durable API-usage schema; also the wire envelope the browser scope validates against. */
export const ApiUsageSettingsSchema: z<ApiUsageSettings> = z.object({
  [API_USAGE_ENABLED_FIELD]: z.boolean().default(DEFAULT_API_USAGE_ENABLED),
})
