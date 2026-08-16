import { describe, expect, it, vi } from 'vitest'

// The published `@deepseek-ai/dsh-client-runtime/client` is a browser bundle
// (loader banner). Mock the one runtime value the policy imports so the policy
// can be tested in-process.
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => {
  const createSnapshotStore = <T>(initial: T) => {
    let value = initial
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => value,
      set: (next: T) => {
        value = next
        for (const listener of listeners) listener()
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    }
  }
  return { createSnapshotStore }
})

import { ApiUsagePolicy } from '../src/client/api-usage-policy.ts'

describe('ApiUsagePolicy', () => {
  it('toggles the enabled snapshot without a host scope', () => {
    const policy = new ApiUsagePolicy()
    expect(policy.enabled.getSnapshot()).toBe(true)
    policy.setEnabled(false)
    expect(policy.enabled.getSnapshot()).toBe(false)
    policy.setEnabled(false)
    expect(policy.enabled.getSnapshot()).toBe(false)
  })

  it('publishes the fetched balance result', async () => {
    const load = vi.fn(async () => ({
      ok: true as const,
      available: true,
      balance: '110.00',
      currency: 'CNY',
      granted: null,
      toppedUp: null,
    }))
    const policy = new ApiUsagePolicy(undefined, load)
    expect(policy.balance.getSnapshot()).toBeNull()
    await policy.refreshBalance()
    expect(policy.balance.getSnapshot()).toEqual({
      ok: true, available: true, balance: '110.00', currency: 'CNY', granted: null, toppedUp: null,
    })
  })

  it('folds a thrown fetch into the error branch', async () => {
    const load = vi.fn(async () => { throw new Error('boom') })
    const policy = new ApiUsagePolicy(undefined, load)
    await policy.refreshBalance()
    expect(policy.balance.getSnapshot()).toEqual({ ok: false, error: 'boom' })
  })

  it('collapses concurrent refreshes into one in-flight fetch', async () => {
    let resolve: (value: { ok: false; error: string }) => void = () => {}
    const load = vi.fn(() => new Promise<{ ok: false; error: string }>(r => { resolve = r }))
    const policy = new ApiUsagePolicy(undefined, load)
    const first = policy.refreshBalance()
    const second = policy.refreshBalance()
    resolve({ ok: false, error: 'once' })
    await Promise.all([first, second])
    expect(load).toHaveBeenCalledTimes(1)
    expect(policy.balance.getSnapshot()).toEqual({ ok: false, error: 'once' })
  })
})
