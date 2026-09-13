# Codex Theme · Endfield

把《明日方舟：终末地》同人主题的纸墨工业视觉语言迁移到 Codex：既有官方主题预设，也有可选的 Windows 交互增强层。

> 非官方同人项目。本项目与 OpenAI、Hypergryph、GRYPHLINE 没有隶属、赞助或授权关系，也不包含官方游戏素材。

## 两种模式

### 官方主题模式（稳定回退）

官方外观接口支持导入强调色、背景、前景、字体和代码配色；它不提供等高线、水印、启动动画或任务大字字段。[Codex 外观设置](https://learn.chatgpt.com/docs/reference/settings)

| 预设 | 模式 | 强调色 | 背景 | 前景 | Skill 色 |
| --- | --- | --- | --- | --- | --- |
| Valley Yellow | Light | `#fff500` | `#e8e8e2` | `#101110` | `#6b5d00` |
| Valley Yellow | Dark | `#fff500` | `#101110` | `#f5f5f0` | `#fff500` |
| Wuling Cyan | Light | `#14d0d0` | `#e8e8e2` | `#101110` | `#006a6a` |
| Wuling Cyan | Dark | `#14d0d0` | `#101110` | `#f5f5f0` | `#14d0d0` |

在 Codex **设置 → 外观 → Import** 粘贴 `dist/` 下对应 `.txt` 文件中的完整 `codex-theme-v1:` 字符串。亮色和暗色需要分别导入。

- [Valley Yellow · Light](dist/valley-yellow-light.txt)
- [Valley Yellow · Dark](dist/valley-yellow-dark.txt)
- [Wuling Cyan · Light](dist/wuling-cyan-light.txt)
- [Wuling Cyan · Dark](dist/wuling-cyan-dark.txt)

### Windows 交互增强模式（非官方兼容层）

增强模式使用专用启动器，通过本机 loopback 的 Electron 调试通道注入 CSS/JS；Electron 支持该调试开关，CDP 也支持在页面脚本前注入运行时。[Electron 调试开关](https://www.electronjs.org/docs/latest/api/command-line-switches) · [CDP 页面注入](https://chromedevtools.github.io/devtools-protocol/1-3/Page/)

它不会修改 `app.asar`、MSIX 安装目录或 `~/.codex/config.toml`，不需要管理员权限。Codex 更新后如果内部结构变化，增强效果可能自动降级或暂时失效，但不会破坏 Codex 安装；官方主题仍可正常使用。

增强层包含：

- Marching Squares 等高线 Canvas（24 FPS、低速、滚动暂停）；
- 方角/圆角、hover/active/focus、选择色、光标、滚动条和菜单反馈；
- `ENDFIELD` 背景水印；
- 首次启动工业加载板，可切换为关闭或每次启动；
- 任务状态大字：`任务完成`、`任务失败`、`任务中止`；
- Shadow DOM 设置面板，可切换 Valley Yellow/Wuling Cyan、动效和任务提示；
- `prefers-reduced-motion` 支持，减少动态效果时保留静态提示。

## 安装增强模式

要求 Windows、Node.js 20+ 和当前用户已安装 Codex 桌面客户端：

```powershell
npm install
npm run enhanced:doctor
npm run enhanced:install
```

安装器只写入 `%LOCALAPPDATA%\codex-theme-endfield`，并创建开始菜单快捷方式 **Codex Endfield**。首次启动前请完全关闭所有 Codex 进程，然后使用该快捷方式或：

```powershell
npm run enhanced:launch
```

启动器每次自动解析最新的 `OpenAI.Codex` MSIX 路径。已普通启动的 Codex 不会被自动结束；请关闭后重新启动增强版。运行期间会有一个只绑定 `127.0.0.1` 的调试端口，增强宿主不会把对话正文、Cookie、localStorage 或鉴权数据写入日志或配置。

设置通过 Codex 右侧的 `EF` 标签或 `Ctrl+Shift+E` 打开，配置保存在 `%LOCALAPPDATA%\codex-theme-endfield\config.json`。

卸载增强层：

```powershell
npm run enhanced:uninstall
```

卸载只删除本项目创建的用户目录和快捷方式，不改动 Codex 本体。官方模式恢复默认只需在 **设置 → 外观** 选择内置主题或 Reset/Default。

## 交互预览

打开 [preview/enhanced.html](preview/enhanced.html) 可在浏览器中体验等高线、水印、设置面板和“模拟任务完成”大字；四套官方配色静态截图仍位于 [preview/captures/](preview/captures/)。

## 开发与验证

```bash
npm test
npm run build
npm run check
npm audit --omit=dev
```

`npm run check` 会验证主题导入格式、颜色对比度、配置/事件逻辑、CDP fixture、增强运行时语法和生成文件漂移。真实 Codex 兼容目标为 Windows MSIX `26.903.9818.0`（内部应用版本 `26.903.71938`）；未知版本执行能力探针，事件结构不确定时会禁用任务大字。

## English summary

Endfield-inspired Codex theme presets plus an optional Windows-only interactive enhancement layer. The safe mode uses the supported `codex-theme-v1:` import format. The enhancement launcher injects a CSS/JS runtime through a loopback-only Electron CDP port and adds contour lines, industrial interactions, watermark, loader, and task status plates. It does not patch `app.asar` or Codex configuration. This is an unofficial fan project with no affiliation with OpenAI, Hypergryph, or GRYPHLINE.

## 许可与署名

视觉配色、交互方向和部分算法参考 [ymh0000123/dsh-theme-endfield](https://github.com/ymh0000123/dsh-theme-endfield)，并按上游 MIT License 保留署名；适配基准为提交 `e6dd22a70bf78e5ffea5744c749f8e0065384ab7`。详见 [`NOTICE.md`](NOTICE.md) 与 [`LICENSE`](LICENSE)。
