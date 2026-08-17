/** Host registration for the API-usage settings section and balance route. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
// Type-only: ctx.webServer Context merge.
import type {} from '@deepseek-ai/dsh-host-webserver'
// Type-only: ctx.credentials Context merge.
import type {} from '@deepseek-ai/dsh-credentials'
// Type-only: ctx.shell Context merge.
import type {} from '@deepseek-ai/dsh-shell'
// Type-only: ctx.sessionProjections Context merge.
import type {} from '@deepseek-ai/dsh-session-projection'
import { fetchApiBalance } from './balance.ts'
import { providerTokenUsageProjectionDefinition } from './provider-usage-projection.ts'
import {
  API_USAGE_BALANCE_PATH, API_USAGE_SETTINGS_NAMESPACE, ApiUsageSettingsSchema,
} from './settings.ts'

export {
  API_USAGE_BALANCE_PATH, API_USAGE_ENABLED_FIELD, API_USAGE_SETTINGS_NAMESPACE,
  DEFAULT_API_USAGE_ENABLED, type ApiUsageSettings,
} from './settings.ts'
export type { ApiUsageBalanceResult } from './types.ts'
export type { ProviderTokenBuckets, ProviderTokenUsageProjection } from './provider-usage-projection.ts'

const NAMESPACE = settingsNamespace(API_USAGE_SETTINGS_NAMESPACE)

/**
 * Register the durable API-usage section and the balance HTTP route when their
 * optional Host services are composed.
 * @param ctx - Host context that may acquire the settings and web-server services.
 */
export function apply(ctx: Context): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(providerTokenUsageProjectionDefinition)
  })
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(NAMESPACE, ApiUsageSettingsSchema)
  })
  ctx.inject(['webServer', 'credentials', 'shell'], (rctx) => {
    rctx.effect(() => rctx.webServer.register({
      kind: 'exact',
      path: API_USAGE_BALANCE_PATH,
      handler: async (_req, res) => {
        const result = await fetchApiBalance(rctx.credentials, rctx.shell)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(result))
      },
    }), 'ui-api-usage: balance route')
  })
}
