import { describe, expect, it } from 'vitest'
import { fetchApiBalance } from '../src/balance.ts'

function credentials(key?: string) {
  return {
    async resolve() {
      return key === undefined ? undefined : { value: key }
    },
  } as never
}

function shell(outcome: { exitCode?: number; stdout?: string; stderr?: string } = {}) {
  return {
    resolve(request: unknown) {
      return request
    },
    async run() {
      return {
        exitCode: outcome.exitCode ?? 0,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: 12000,
        stdout: { text: outcome.stdout ?? '', truncated: false },
        stderr: { text: outcome.stderr ?? '', truncated: false },
      }
    },
  } as never
}

const BALANCE_PAYLOAD = JSON.stringify({
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '110.00',
      granted_balance: '10.00',
      topped_up_balance: '100.00',
    },
  ],
})

describe('fetchApiBalance', () => {
  it('reports a missing API key', async () => {
    await expect(fetchApiBalance(credentials(), shell())).resolves.toEqual({
      ok: false, error: '未配置 DEEPSEEK_API_KEY',
    })
  })

  it('parses the platform balance payload', async () => {
    await expect(fetchApiBalance(credentials('sk-test'), shell({ stdout: BALANCE_PAYLOAD }))).resolves.toEqual({
      ok: true, available: true, balance: '110.00', currency: 'CNY', granted: '10.00', toppedUp: '100.00',
    })
  })

  it('reports a non-zero curl exit', async () => {
    await expect(fetchApiBalance(credentials('sk-test'), shell({ exitCode: 28, stderr: 'timeout' }))).resolves.toEqual({
      ok: false, error: 'timeout',
    })
  })

  it('reports a non-JSON response', async () => {
    await expect(fetchApiBalance(credentials('sk-test'), shell({ stdout: 'not json' }))).resolves.toEqual({
      ok: false, error: '余额接口响应不是 JSON',
    })
  })
})
