# dsh-api-usage

English | [中文](README.zh.md)

An installable [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin: a sidebar-foot panel showing the DeepSeek account balance, today's cumulative token usage, and the current session's cumulative token usage, plus a General settings toggle.

## Install / uninstall

```sh
dsh plugin --profile web add @marvina/dsh-api-usage
dsh web

# uninstall
dsh plugin --profile web remove @marvina/dsh-api-usage
```

The package declares `dsh.bundle.patch`, so `dsh plugin add` reconciles it into the profile's bundle stack automatically.

## How it works

- **Host half** registers the durable `ui-api-usage` settings section and one exact HTTP route, `/api/api-usage/balance`, which resolves the API key through the credential seam and runs the platform `/user/balance` endpoint through the shell executor (`curl`, key via an environment entry, never argv).
- **Browser half** is a `sidebar.footer.action` panel plus a `settings.general.item` toggle. The two token figures derive from the standard `useSessions` feed's `tokenUsage` projection; the balance is fetched from the host route. The toggle writes the durable `ui-api-usage` section (`enabled`); the panel renders `null` while disabled.

## Build

```sh
pnpm install
pnpm run build
```

## License

MIT
