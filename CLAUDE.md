# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 项目概述

WuxieGameHub 是一个静态单页应用，用于聚合和展示"秦无邪OvO"的独立游戏作品。游戏部署在 Bilibili TOY 平台，通过卡片网格形式展示，支持筛选、点击记录和最近游玩历史。

**技术栈**：纯原生 HTML/CSS/JS — 无框架、无构建工具、无包管理器。直接以静态文件形式提供服务。

## 快速启动

```powershell
# 用任意静态文件服务器启动本地预览：
python -m http.server 8000
# 或
npx http-server -p 8000
```

在浏览器中打开 http://localhost:8000。追加 `?selftest=1` 可运行内置自测模式。

## 架构

```
index.html          →  入口文件。包含 DOM 骨架、内联运行时诊断脚本（`__WUXIE_RUNTIME__`）
                       以及 deferred 方式加载的 games.js + app.js。
css/style.css       →  所有样式。暗色主题，使用 CSS 自定义属性（:root）。
                       响应式断点 960px 和 640px。尊重 prefers-reduced-motion。
js/games.js         →  数据层。设置 window.WUXIE_GAMES 为游戏对象数组。
                       新增游戏 = 在这里添加一个对象 + 放入封面图即可。
js/app.js           →  应用逻辑（IIFE）。读取 WUXIE_GAMES，负责：
                       - 按游戏类型筛选
                       - 游戏卡片渲染
                       - 随机游玩按钮
                       - 点击次数追踪（localStorage）
                       - 最近游玩历史（localStorage，最多 5 条）
                       - Toast 消息提示
                       - 加载失败的降级容错
                       - 自测模式（?selftest=1）
assets/             →  封面图（JPEG）和头像 SVG
```

## 游戏数据 Schema（js/games.js）

`window.WUXIE_GAMES` 中每项的结构如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 数字字符串，唯一 |
| title | string | 游戏显示名称 |
| type | string | 分类标识（驱动筛选按钮） |
| status | "playable" \| "developing" | 控制按钮状态 |
| statusText | string | 状态的显示标签 |
| releasedAt | string | 日期字符串 |
| toyUrl | string | 外部游玩链接（Bilibili TOY） |
| videoUrl | string | 外部视频链接 |
| coverImage | string | assets/ 下的 JPG 路径 |
| description | string | 简短介绍 |
| tags | string[] | 标签列表 |
| palette | { primary, secondary, glow } | 卡片渐变封面的 CSS 颜色值 |

## 关键模式

- **数据驱动**：要新增游戏，只需在 `WUXIE_GAMES` 中添加一项并将封面图放入 `assets/`，无需改动其他代码。
- **降级容错**：若 `games.js` 加载失败，页面骨架仍可见并显示降级信息。若 `app.js` 崩溃，内联运行时仍能捕获错误。
- **运行时诊断**：`window.__WUXIE_RUNTIME__` 暴露就绪状态、错误日志、游戏数量、视口信息。可通过隐藏的 `#runtime-diagnostics` pre 元素查看。
- **localStorage 键名**：`wuxie-game-hub:clicks` 和 `wuxie-game-hub:recent`
- **自测模式**：URL 添加 `?selftest=1`。应用会桩化 `window.open`，执行筛选 + 随机游玩序列，并将结果写入诊断信息。

## 开发注意事项

- 代码风格：HTML/CSS/JS 统一 2 空格缩进。变量和函数使用 `camelCase`。CSS 中不使用分号。
- 默认不要自动运行本地预览、自测脚本、浏览器检查或其他测试流程，除非用户明确要求。该项目的验证由用户手动执行。
- 无自动化测试。若用户要求测试，手动冒烟测试项包括：页面加载、筛选功能、游戏卡片渲染、按钮跳转、localStorage 跨刷新持久化、控制台无报错。
- `AGENTS.md` 包含额外的项目级约定（如被引用时参考）。
