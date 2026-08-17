/** Provider-aware token usage accumulated from durable session events. */

import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { z } from 'zod'

/** The four disjoint provider-reported token buckets. */
export interface ProviderTokenBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** Cumulative token buckets keyed by normalized provider id, then model id. */
export type ProviderTokenUsageProjection = Readonly<Record<string, Readonly<Record<string, ProviderTokenBuckets>>>>

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Provider-reported usage accumulated independently for each API provider. */
    providerTokenUsage: ProviderTokenUsageProjection
  }
}

interface UsageSample {
  turn: number
  step: number
  provider: string
  model: string
  buckets: ProviderTokenBuckets
}

interface ProviderTokenUsageState {
  provider?: string
  model?: string
  totals: Record<string, Record<string, ProviderTokenBuckets>>
  last: UsageSample | null
}

const bucketsSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
}).strict()

const projectionSchema = z.record(z.string(), z.record(z.string(), bucketsSchema))

const zeroBuckets = (): ProviderTokenBuckets => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

function ensureModel(
  totals: Record<string, Record<string, ProviderTokenBuckets>>,
  provider: string,
  model: string,
): Record<string, Record<string, ProviderTokenBuckets>> {
  const providerTotals = totals[provider]
  if (providerTotals != null && providerTotals[model] != null) return totals
  return {
    ...totals,
    [provider]: {
      ...(providerTotals ?? {}),
      [model]: zeroBuckets(),
    },
  }
}

function providerId(provider: string): string {
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'deepseek' || normalized === 'deepseek-official') return 'deepseek-official'
  return normalized || 'unknown'
}

function modelId(model: string): string {
  return model.trim() || 'unknown'
}

function usageOf(event: SessionEvent) {
  if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.chunk.usage }
  }
  if (event.type === 'assistant/message' && event.data.usage != null) {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.usage }
  }
  return null
}

function bucketsFrom(usage: NonNullable<ReturnType<typeof usageOf>>['usage']): ProviderTokenBuckets {
  return {
    uncachedInputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  }
}

function equalBuckets(left: ProviderTokenBuckets, right: ProviderTokenBuckets): boolean {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.outputTokens === right.outputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
}

function addReplacing(
  total: ProviderTokenBuckets,
  previous: ProviderTokenBuckets | undefined,
  next: ProviderTokenBuckets | undefined,
): ProviderTokenBuckets {
  return {
    uncachedInputTokens: total.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0)
      + (next?.uncachedInputTokens ?? 0),
    outputTokens: total.outputTokens - (previous?.outputTokens ?? 0) + (next?.outputTokens ?? 0),
    cacheReadTokens: total.cacheReadTokens - (previous?.cacheReadTokens ?? 0)
      + (next?.cacheReadTokens ?? 0),
    cacheWriteTokens: total.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0)
      + (next?.cacheWriteTokens ?? 0),
  }
}

function replaceModelBucket(
  providerTotals: Record<string, ProviderTokenBuckets> | undefined,
  model: string,
  previous: ProviderTokenBuckets | undefined,
  next: ProviderTokenBuckets | undefined,
): Record<string, ProviderTokenBuckets> {
  const total = providerTotals?.[model] ?? zeroBuckets()
  return {
    ...(providerTotals ?? {}),
    [model]: addReplacing(total, previous, next),
  }
}

/** Session projection that preserves the provider attribution token-meter drops. */
export const providerTokenUsageProjectionDefinition: ProjectionDefinition<
  'providerTokenUsage', ProviderTokenUsageState
> = {
  key: 'providerTokenUsage',
  schema: projectionSchema,
  init: () => ({ totals: {}, last: null }),
  apply: (state, event) => {
    if (event.type === 'request/header') {
      const provider = providerId(event.data.header.config.provider)
      const model = modelId(event.data.header.config.model)
      if (provider === state.provider && model === state.model && state.totals[provider]?.[model] != null) return state
      return {
        ...state,
        provider,
        model,
        totals: ensureModel(state.totals, provider, model),
      }
    }
    if (event.type === 'request/context') {
      const provider = providerId(event.data.provider)
      const model = modelId(event.data.model)
      if (provider === state.provider && model === state.model && state.totals[provider]?.[model] != null) return state
      return {
        ...state,
        provider,
        model,
        totals: ensureModel(state.totals, provider, model),
      }
    }

    const sample = usageOf(event)
    if (sample == null) return state
    const provider = state.provider ?? 'unknown'
    const model = state.model ?? 'unknown'
    const buckets = bucketsFrom(sample.usage)
    const previous = state.last?.turn === sample.turn && state.last.step === sample.step
      ? state.last
      : null
    if (previous?.provider === provider && previous?.model === model && equalBuckets(previous.buckets, buckets)) return state

    const totals = { ...state.totals }
    if (previous != null) {
      totals[previous.provider] = replaceModelBucket(totals[previous.provider], previous.model, previous.buckets, undefined)
    }
    totals[provider] = replaceModelBucket(totals[provider], model, undefined, buckets)
    return {
      provider,
      model,
      totals,
      last: { turn: sample.turn, step: sample.step, provider, model, buckets },
    }
  },
  view: state => state.totals,
  stateVersion: 2,
}
