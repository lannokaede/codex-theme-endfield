# ChatGPT · Endfield Interactive Enhancement

把《明日方舟：终末地》同人主题的纸墨工业视觉语言移植到 ChatGPT 客户端，加入动态等高线、工业交互、水印、启动动画和任务状态大字。

> 非官方同人项目。本项目与 OpenAI、Hypergryph、GRYPHLINE 没有隶属、赞助或授权关系，也不包含官方游戏素材。

## 功能

- Marching Squares 等高线 Canvas：24 FPS、低速、滚动/隐藏页面暂停；
- 方角/圆角、hover/active/focus、选择色、光标、滚动条和菜单反馈；
- 会话区域内的工程图形水印：几何徽记、定位十字、刻度与小号 ENDFIELD 标识；
- 首次启动工业加载板，可切换为关闭或每次启动；
- 任务状态大字：`任务完成`、`任务失败`、`任务中止`；
- Shadow DOM 设置面板，可切换 Valley Yellow/Wuling Cyan、动效和任务提示；
- `prefers-reduced-motion` 支持，减少动态效果时停止循环动画但保留静态提示。

## 安装

要求 Windows、Node.js 20+ 和当前用户已安装 ChatGPT 桌面客户端：

```powershell
npm install
npm run enhanced:doctor
npm run enhanced:install
```

安装器只写入 `%LOCALAPPDATA%\codex-theme-endfield`，并创建开始菜单快捷方式 **ChatGPT Endfield**。它会保留已有配置；如果发现由本项目创建的旧 **Codex Endfield** 快捷方式，会安全迁移到新名称。

首次启动前请从系统托盘完全退出 ChatGPT，并确认任务管理器中没有 `ChatGPT.exe` 进程，然后使用快捷方式或：

```powershell
npm run enhanced:launch
```

启动器每次自动解析最新的 `OpenAI.Codex` MSIX 路径。已运行的 ChatGPT 不会被自动结束；从桌面快捷方式启动时会弹窗说明如何完全退出，不再出现 PowerShell 窗口一闪而过却没有反馈的情况。运行期间会有一个只绑定 `127.0.0.1` 的本地调试端口，增强宿主不会把对话正文、Cookie、localStorage 或鉴权数据写入日志或配置。

设置通过 `Ctrl+Shift+E` 打开；取消右侧常驻 EF 标签。配置保存在 `%LOCALAPPDATA%\codex-theme-endfield\config.json`。

背景装饰仅挂载到主内容区域，宠物、语音及透明辅助窗口不参与美化。客户端更新后如果无法识别主内容区域，增强层不会给整个窗口铺设背景。

## 卸载与恢复

```powershell
npm run enhanced:uninstall
```

卸载只删除本项目创建的用户目录和快捷方式，不改动 ChatGPT 安装目录或 `~/.codex/config.toml`。如果增强层失效，直接使用 ChatGPT 原始快捷方式即可恢复原始界面。

## 交互预览

打开 [preview/enhanced.html](preview/enhanced.html) 可在浏览器中体验等高线、水印、设置面板和“模拟任务完成”大字。

## 开发与验证

```bash
npm test
npm run build
npm run check
npm audit --omit=dev
```

`npm run build` 只生成 `dist/enhanced-runtime.js`；`npm run check` 会验证增强配置、事件逻辑、CDP fixture、运行时语法、安装脚本和生成文件漂移。真实兼容目标为 Windows MSIX `26.903.9818.0`（内部应用版本 `26.903.71938`）；未知版本可能自动降级或禁用任务状态大字。

## 安全与兼容性

增强模式是非官方兼容层，通过 loopback-only Electron CDP 注入 CSS/JS，不修改 `app.asar`、MSIX 安装目录或全局配置，也不需要管理员权限。ChatGPT 更新后内部 DOM、事件或调试能力可能变化；此时可以卸载增强层，原始客户端仍保持完整。

技术实现仍保留现有仓库、命令和 `OpenAI.Codex` 标识，以兼容 Windows 安装器与旧脚本；用户界面统一使用 ChatGPT 名称。

## English summary

An unofficial Windows-only interactive enhancement layer for the ChatGPT desktop client, inspired by the Endfield paper-and-industrial visual language. It adds animated contours, industrial control feedback, watermark, loader, task status plates, and a Shadow DOM settings panel through a loopback-only Electron CDP launcher. It does not patch `app.asar` or ChatGPT configuration. Repository and Windows package identifiers retain their technical `Codex` names for compatibility.

## 许可与署名

视觉配色、交互方向和部分算法参考 [ymh0000123/dsh-theme-endfield](https://github.com/ymh0000123/dsh-theme-endfield)，并按上游 MIT License 保留署名。精确来源与许可信息见 [`NOTICE.md`](NOTICE.md) 和 [`LICENSE`](LICENSE)。
