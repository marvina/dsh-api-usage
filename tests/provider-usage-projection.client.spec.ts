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

const header = (provider: string, model = `${provider}-model`) => event('request/header', {
  header: { config: { provider, model } },
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
  it('attributes usage to the provider and model active for each request', () => {
    let state = projection.init()
    state = projection.apply(state, header('deepseek-official'))
    state = projection.apply(state, assistantUsage(1, 1, 10, 5))
    state = projection.apply(state, header('openai'))
    state = projection.apply(state, assistantUsage(2, 1, 20, 8))

    expect(projection.view(state)).toEqual({
      'deepseek-official': {
        'deepseek-official-model': {
          uncachedInputTokens: 10,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      openai: {
        'openai-model': {
          uncachedInputTokens: 20,
          outputTokens: 8,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
    })
  })

  it('keeps usage separated by model within one provider', () => {
    let state = projection.init()
    state = projection.apply(state, header('deepseek-official', 'flash'))
    state = projection.apply(state, assistantUsage(1, 1, 10, 5))
    state = projection.apply(state, header('deepseek-official', 'pro'))
    state = projection.apply(state, assistantUsage(2, 1, 20, 8))

    expect(projection.view(state)).toEqual({
      'deepseek-official': {
        flash: {
          uncachedInputTokens: 10,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        pro: {
          uncachedInputTokens: 20,
          outputTokens: 8,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
    })
  })

  it('replaces a streamed sample with the final usage for the same step', () => {
    let state = projection.init()
    state = projection.apply(state, header('deepseek-official'))
    state = projection.apply(state, usageChunk(1, 1, 10, 2))
    state = projection.apply(state, assistantUsage(1, 1, 12, 5))

    expect(projection.view(state)['deepseek-official']['deepseek-official-model']).toEqual({
      uncachedInputTokens: 12,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })

  it('normalizes legacy and official DeepSeek provider ids into one provider key', () => {
    let state = projection.init()
    state = projection.apply(state, header('deepseek'))
    state = projection.apply(state, assistantUsage(1, 1, 10, 5))
    state = projection.apply(state, header('deepseek-official'))
    state = projection.apply(state, assistantUsage(2, 1, 20, 8))

    const view = projection.view(state)
    expect(Object.keys(view)).toEqual(['deepseek-official'])
    expect(view['deepseek-official']['deepseek-model']).toEqual({
      uncachedInputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    expect(view['deepseek-official']['deepseek-official-model']).toEqual({
      uncachedInputTokens: 20,
      outputTokens: 8,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })
})
