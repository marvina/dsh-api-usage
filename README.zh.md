# dsh-api-usage

[English](README.md) | 中文

一个可安装的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：侧栏底部面板显示 DeepSeek 账户余额、今日累计 token 用量、当前会话累计 token 用量，外加一个「通用」设置开关。

## 安装 / 卸载

```sh
# 从 git 安装（push 之后）
dsh plugin --profile web add github:<user>/dsh-api-usage
dsh web

# 卸载
dsh plugin --profile web remove dsh-api-usage
```

该包声明了 `dsh.bundle.patch`，`dsh plugin add` 会自动把它纳入 profile 的 bundle 栈。
它同时声明了 `prepare` 脚本，因此从 git 安装时会自动构建 `lib/`；
pnpm 可能会要求你允许该构建脚本——把 pnpm 打印的 key 加到
`~/.dsh/profiles/web/pnpm-workspace.yaml` 的 `allowBuilds` 下再重跑即可。

本地 checkout 安装：

```sh
cd /path/to/dsh-api-usage
dsh plugin --profile web add link:.
```

## 工作原理

- **Host 半**注册持久化的 `ui-api-usage` 设置分区，以及一条精确 HTTP 路由 `/api/api-usage/balance`：它通过凭据服务解析 API key，并用 shell 执行器访问平台 `/user/balance` 端点（`curl`，密钥经环境变量传入，绝不进 argv）。
- **浏览器半**是 `sidebar.footer.action` 面板加一个 `settings.general.item` 开关。两个 token 数字来自标准 `useSessions` 反馈的 `tokenUsage` 投影；余额从宿主路由获取。开关写入持久化的 `ui-api-usage` 分区（`enabled`）；面板在关闭时渲染 `null`。

## 构建

```sh
pnpm install
pnpm run build
```

## 开发

```sh
pnpm run watch
```

`tsdown --watch` 会在你修改 `src/` 时自动重编 `lib/`。保持 `dsh web` 打开，
浏览器侧改动（`src/client/*`）会自动热更新。主机侧改动
（`src/index.ts`、`src/balance.ts`、`src/settings.ts`、`src/provider-usage-projection.ts`）
仍需在重编后重启 `dsh web`。

## License

MIT
