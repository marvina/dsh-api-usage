# dsh-api-usage

[English](README.md) | 中文

一个可安装的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：侧栏底部面板显示 DeepSeek 账户余额、今日累计 token 用量、当前会话累计 token 用量，外加一个「通用」设置开关。

## 安装 / 卸载

```sh
dsh plugin --profile web add @marvina/dsh-api-usage
dsh web

# 卸载
dsh plugin --profile web remove @marvina/dsh-api-usage
```

该包声明了 `dsh.bundle.patch`，`dsh plugin add` 会自动把它纳入 profile 的 bundle 栈。

## 工作原理

- **Host 半**注册持久化的 `ui-api-usage` 设置分区，以及一条精确 HTTP 路由 `/api/api-usage/balance`：它通过凭据服务解析 API key，并用 shell 执行器访问平台 `/user/balance` 端点（`curl`，密钥经环境变量传入，绝不进 argv）。
- **浏览器半**是 `sidebar.footer.action` 面板加一个 `settings.general.item` 开关。两个 token 数字来自标准 `useSessions` 反馈的 `tokenUsage` 投影；余额从宿主路由获取。开关写入持久化的 `ui-api-usage` 分区（`enabled`）；面板在关闭时渲染 `null`。

## 构建

```sh
pnpm install
pnpm run build
```

## License

MIT
