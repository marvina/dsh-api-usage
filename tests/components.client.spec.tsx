// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { ApiUsageBalanceResult } from '../src/types.ts'
import { ApiUsagePanel } from '../src/client/ApiUsagePanel.tsx'
import type { ApiUsagePanelProps } from '../src/client/ApiUsagePanel.tsx'
import { ApiUsageToggle } from '../src/client/ApiUsageToggle.tsx'
import type { ApiUsageToggleProps } from '../src/client/ApiUsageToggle.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof zh): string => zh[key]

function selectorHook<T>(value: T) {
  return <S,>(sel: (s: T) => S): S => sel(value)
}

const BALANCE: ApiUsageBalanceResult = {
  ok: true,
  available: true,
  balance: '110.00',
  currency: 'CNY',
  granted: null,
  toppedUp: null,
}

const SESSIONS: SessionListState = {
  ids: ['s1'],
  byId: {
    s1: {
      id: 's1',
      displayTitle: 'Session',
      blank: false,
      running: false,
      updatedAt: Date.now(),
      projectionValues: {
        providerTokenUsage: {
          deepseek: {
            uncachedInputTokens: 10,
            outputTokens: 20,
            cacheReadTokens: 5,
            cacheWriteTokens: 3,
          },
          openai: {
            uncachedInputTokens: 100,
            outputTokens: 50,
            cacheReadTokens: 25,
            cacheWriteTokens: 0,
          },
        },
      },
    },
  },
  current: 's1',
  phase: 'ready',
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
} as unknown as SessionListState

function panelProps(overrides: Partial<ApiUsagePanelProps> = {}): ApiUsagePanelProps {
  return {
    wide: true,
    useSessions: selectorHook(SESSIONS),
    useEnabled: selectorHook(true),
    useBalance: selectorHook<ApiUsageBalanceResult | null>(BALANCE),
    refreshBalance: vi.fn(),
    t,
    ...overrides,
  } as unknown as ApiUsagePanelProps
}

describe('ApiUsagePanel', () => {
  it('renders balances and usage independently for each provider', () => {
    render(<ApiUsagePanel {...panelProps()} />)
    expect(screen.getByText('API 用量')).toBeTruthy()
    expect(screen.getByText('DeepSeek')).toBeTruthy()
    expect(screen.getByText('OpenAI')).toBeTruthy()
    expect(screen.getAllByText('API 余额')).toHaveLength(2)
    expect(screen.getByText('¥110.00')).toBeTruthy()
    expect(screen.getByText('暂不支持')).toBeTruthy()
    expect(screen.getAllByText('今日用量')).toHaveLength(2)
    expect(screen.getAllByText('38 tokens')).toHaveLength(2)
    expect(screen.getAllByText('175 tokens')).toHaveLength(2)
    expect(screen.getAllByText('本次对话用量')).toHaveLength(2)
  })

  it('falls back to legacy token usage as DeepSeek usage', () => {
    const legacySessions = {
      ...SESSIONS,
      byId: {
        s1: {
          ...SESSIONS.byId.s1,
          projectionValues: {
            tokenUsage: {
              uncachedInputTokens: 10,
              outputTokens: 20,
              cacheReadTokens: 5,
              cacheWriteTokens: 3,
            },
          },
        },
      },
    } as unknown as SessionListState

    render(<ApiUsagePanel {...panelProps({ useSessions: selectorHook(legacySessions) })} />)
    expect(screen.getByText('DeepSeek')).toBeTruthy()
    expect(screen.queryByText('OpenAI')).toBeNull()
    expect(screen.getAllByText('38 tokens')).toHaveLength(2)
  })

  it('renders nothing while disabled', () => {
    const { container } = render(<ApiUsagePanel {...panelProps({ useEnabled: selectorHook(false) })} />)
    expect(container.firstChild).toBeNull()
  })

  it('refreshes the balance on mount', () => {
    const refreshBalance = vi.fn()
    render(<ApiUsagePanel {...panelProps({ refreshBalance })} />)
    expect(refreshBalance).toHaveBeenCalledTimes(1)
  })
})

describe('ApiUsageToggle', () => {
  it('flips the persisted visibility on click', () => {
    const setEnabled = vi.fn()
    render(
      <ApiUsageToggle
        {...{
          useEnabled: selectorHook(true),
          setEnabled,
          t,
        } as unknown as ApiUsageToggleProps}
      />,
    )
    expect(screen.getByText('API 用量面板')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch'))
    expect(setEnabled).toHaveBeenCalledWith(false)
  })
})
