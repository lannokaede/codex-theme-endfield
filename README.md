# Codex Theme · Endfield

把《明日方舟：终末地》同人主题的纸墨工业配色，迁移成 Codex 桌面客户端官方支持的主题预设。项目只使用 `codex-theme-v1:` 导入接口，不修改 `app.asar`、全局配置或安装包。

> 非官方同人项目。本项目与 OpenAI、Hypergryph、GRYPHLINE 没有隶属、赞助或授权关系，也不包含官方游戏素材。

## 可行性与边界

Codex 的外观设置支持导入/复制自定义主题，并配置强调色、背景、前景、字体和代码配色，因此核心视觉语言可以稳定迁移。宿主界面的圆角/直角、等高线、水印、启动动画等不属于公开主题字段，本项目不会通过补丁或 CSS 注入强行覆盖。

四个预设均使用官方 `codex-theme-v1:` 格式：

| 预设 | 模式 | 强调色 | 背景 | 前景 | Skill 色 |
| --- | --- | --- | --- | --- | --- |
| Valley Yellow | Light | `#fff500` | `#e8e8e2` | `#101110` | `#6b5d00` |
| Valley Yellow | Dark | `#fff500` | `#101110` | `#f5f5f0` | `#fff500` |
| Wuling Cyan | Light | `#14d0d0` | `#e8e8e2` | `#101110` | `#006a6a` |
| Wuling Cyan | Dark | `#14d0d0` | `#101110` | `#f5f5f0` | `#14d0d0` |

共同设置为 `codex` 代码主题、不透明侧栏、Arial UI/正文字体和系统默认代码字体。亮色对比度为 `45`，暗色为 `60`；状态色经过 WCAG 普通文本对比度校验。

## 安装与切换

1. 打开 Codex → **设置 → 外观**。
2. 打开本仓库 `dist/` 下的对应 `.txt` 文件，完整复制其中一行内容。
3. 点击 **Import**，粘贴并确认。Light 与 Dark 是独立预设，需要分别导入。
4. 想切换配色时，重复导入另一组 Valley Yellow 或 Wuling Cyan 的同模式文件。

可直接复制的文件：

- [Valley Yellow · Light](dist/valley-yellow-light.txt)
- [Valley Yellow · Dark](dist/valley-yellow-dark.txt)
- [Wuling Cyan · Light](dist/wuling-cyan-light.txt)
- [Wuling Cyan · Dark](dist/wuling-cyan-dark.txt)

如果客户端显示的是 **Copy/Import** 而不是完全相同的按钮文字，请使用同一组导入/复制主题入口；无需手动编辑 `~/.codex/config.toml`。

## 卸载与恢复默认

主题导入只改变 Codex 的外观预设。要恢复默认，请在 **设置 → 外观** 选择客户端提供的 **Reset/Default** 选项（按钮名称可能随版本变化），或直接切换回内置主题。删除本仓库不会影响已经导入的主题。

## 预览

在浏览器中打开 [preview/index.html](preview/index.html) 可切换四套配色；`preview/captures/` 中也提供了四张无官方素材的 SVG 静态预览：

- [Valley Yellow · Light](preview/captures/valley-yellow-light.svg)
- [Valley Yellow · Dark](preview/captures/valley-yellow-dark.svg)
- [Wuling Cyan · Light](preview/captures/wuling-cyan-light.svg)
- [Wuling Cyan · Dark](preview/captures/wuling-cyan-dark.svg)

## 从源码重新生成

项目无运行时依赖，要求 Node.js 20 或更高版本。四套可读源配置位于 [`themes/source.json`](themes/source.json)，生成器会确定性地产出导入字符串和预览文件：

```bash
npm test
npm run build
npm run check
```

`npm run check` 会同时执行单元测试、颜色对比度测试、导入格式校验和生成文件漂移检查。

## 兼容性

导入结构按 Codex Windows `26.903` 系列的官方主题分享格式校验，使用 `codeThemeId: "codex"`、`accentSource: "custom"` 和不透明侧栏。未来客户端若升级分享格式，可能需要重新生成或调整字段；本项目不会自动操作 Codex UI，也不会写入用户配置。

## English summary

Endfield-inspired, paper-and-industrial color presets for the Codex desktop client. Import one of the four files in `dist/` from **Settings → Appearance → Import**. The package uses only the supported `codex-theme-v1:` interface, keeps UI/content in Arial, preserves the system code font, and does not patch `app.asar` or global configuration. This is an unofficial fan project with no affiliation to OpenAI, Hypergryph, or GRYPHLINE.

## 致谢与许可

视觉配色和“纸墨工业”方向参考了 [ymh0000123/dsh-theme-endfield](https://github.com/ymh0000123/dsh-theme-endfield)。上游项目以 MIT License 发布；本项目保留上游署名，且没有复制其客户端注入代码。详见 [`NOTICE.md`](NOTICE.md) 与 [`LICENSE`](LICENSE)。
