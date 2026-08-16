/**
 * General settings toggle for the API usage panel, registered into the
 * `settings.general.item` slot by this package — the feature owns its own
 * settings surface.
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: declares the `settings.general.item` slot entry and ctx.settingsScope.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import css from './ApiUsageToggle.module.css'

/** Registration-side preference face. */
export interface ApiUsageToggleInjected {
  hooks: {
    /** Persisted visibility bound as useEnabled. */
    enabled: SnapshotStore<boolean>
  }
  /** Flip the panel visibility. */
  setEnabled: (value: boolean) => void
}

/** Full settings-row props. */
export type ApiUsageToggleProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'apiUsage'>
  & InjectFace<ApiUsageToggleInjected>

/**
 * Render the API-usage toggle row.
 * @param props - composed slot props.
 * @returns the preference row.
 */
export function ApiUsageToggle({ useEnabled, setEnabled, t }: ApiUsageToggleProps) {
  const enabled = useEnabled(s => s)
  return (
    <div className={css.row}>
      <div className={css.text}>
        <div className={css.title}>{t('toggle.title')}</div>
        <div className={css.desc}>{t('toggle.description')}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        className={css.switch}
        onClick={() => { setEnabled(!enabled) }}
      >
        <span className={css.knob} />
      </button>
    </div>
  )
}
