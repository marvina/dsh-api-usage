/** Host-side DeepSeek account-balance lookup over the credential and shell seams. */

import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { ShellExecutor } from '@deepseek-ai/dsh-shell'
import type { ApiUsageBalanceResult } from './types.ts'

/** Platform account-balance endpoint (account-level, not the chat-completions base). */
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
/** Ordinary environment entry carrying the key into the curl invocation (never argv). */
const BALANCE_KEY_ENV = 'BALANCE_API_KEY'
/** Standard DeepSeek API-key credential reference. */
const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'

/**
 * Resolve the DeepSeek account balance.
 * @param credentials - credential seam resolving the API key.
 * @param shell - shell seam running the platform endpoint.
 * @returns detached balance facts, or a bounded failure message.
 */
export async function fetchApiBalance(
  credentials: CredentialProvider,
  shell: ShellExecutor,
): Promise<ApiUsageBalanceResult> {
  try {
    const hit = await credentials.resolve(credentialRef(DEFAULT_API_KEY_ENV))
    if (hit === undefined) return { ok: false, error: `未配置 ${DEFAULT_API_KEY_ENV}` }
    const spec = shell.resolve({
      command: `curl -sS --max-time 10 -H "Authorization: Bearer $${BALANCE_KEY_ENV}" ${BALANCE_URL}`,
      env: { [BALANCE_KEY_ENV]: hit.value },
      timeoutMs: 12000,
      stdoutMaxBytes: 65536,
    })
    const result = await shell.run(spec)
    if (result.exitCode !== 0) {
      const detail = result.stderr.text.trim()
      return { ok: false, error: detail.slice(0, 200) || `curl 退出码 ${result.exitCode}` }
    }
    const text = result.stdout.text.trim()
    if (text === '') return { ok: false, error: '余额接口返回为空' }
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      return { ok: false, error: '余额接口响应不是 JSON' }
    }
    const info = payload as {
      is_available?: boolean
      balance_infos?: Array<{
        total_balance?: string
        currency?: string
        granted_balance?: string
        topped_up_balance?: string
      }>
    }
    const first = Array.isArray(info.balance_infos) ? info.balance_infos[0] : undefined
    if (first === undefined) {
      return {
        ok: true,
        available: info.is_available === true,
        balance: null,
        currency: null,
        granted: null,
        toppedUp: null,
      }
    }
    return {
      ok: true,
      available: info.is_available === true,
      balance: first.total_balance != null ? String(first.total_balance) : null,
      currency: first.currency != null ? String(first.currency) : null,
      granted: first.granted_balance != null ? String(first.granted_balance) : null,
      toppedUp: first.topped_up_balance != null ? String(first.topped_up_balance) : null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message.slice(0, 300) }
  }
}
