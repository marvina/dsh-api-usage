import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { providerTokenUsageProjectionDefinition as projection } from '../src/provider-usage-projection.ts'

let seq = 0
function event<T extends SessionEvent['type']>(
  type: T,
  data: Extract<SessionEvent, { type: T }>['data'],
): SessionEvent {
  return { type, data, seq: seq++, time: Date.now() } as SessionEvent
}

const header = (provider: string) => event('request/header', {
  header: { config: { provider, model: `${provider}-model` } },
  reason: 'change',
})

const usageChunk = (
  turn: number, step: number, inputTokens: number, outputTokens: number,
) => event('assistant/chunk', {
  turn,
  step,
  chunk: { type: 'usage', usage: { inputTokens, outputTokens } },
})

const assistantUsage = (
  turn: number, step: number, inputTokens: number, outputTokens: number,
) => event('assistant/message', {
  turn,
  step,
  message: { role: 'assistant', content: [] },
  usage: { inputTokens, outputTokens },
})

describe('providerTokenUsageProjectionDefinition', () => {
  it('attributes usage to the provider active for each request', () => {
    let state = projection.init()
    state = projection.apply(state, header('deepseek'))
    state = projection.apply(state, assistantUsage(1, 1, 10, 5))
    state = projection.apply(state, header('openai'))
    state = projection.apply(state, assistantUsage(2, 1, 20, 8))

    expect(projection.view(state)).toEqual({
      deepseek: {
        uncachedInputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      openai: {
        uncachedInputTokens: 20,
        outputTokens: 8,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    })
  })

  it('replaces a streamed sample with the final usage for the same step', () => {
    let state = projection.init()
    state = projection.apply(state, header('deepseek'))
    state = projection.apply(state, usageChunk(1, 1, 10, 2))
    state = projection.apply(state, assistantUsage(1, 1, 12, 5))

    expect(projection.view(state).deepseek).toEqual({
      uncachedInputTokens: 12,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })
})
