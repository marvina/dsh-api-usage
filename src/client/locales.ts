/** `apiUsage` namespace dictionaries: sidebar panel and General settings toggle copy. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'apiUsage'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': 'API 用量',
  'panel.balance': '本 API 余额',
  'panel.today': '今日用量',
  'panel.session': '本次对话用量',
  'panel.failed': '获取失败',
  'toggle.title': 'API 用量面板',
  'toggle.description': '在左侧栏底部显示 DeepSeek API 余额与用量',
} satisfies Record<string, string>

/** The apiUsage namespace key union. */
export type ApiUsageKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'panel.title': 'API Usage',
  'panel.balance': 'Balance',
  'panel.today': 'Today',
  'panel.session': 'This chat',
  'panel.failed': 'Unavailable',
  'toggle.title': 'API usage panel',
  'toggle.description': 'Show DeepSeek API balance and usage at the sidebar foot',
} satisfies Record<ApiUsageKey, string>
