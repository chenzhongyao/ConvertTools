# HTML/Markdown 互转 + 文件对比功能设计

## 概述

在现有 PDF 全能工具箱中新增两个独立功能模块，保持现有功能不变：
1. **HTML ↔ Markdown 双向互转** — 两个独立子功能，用户选择转换方向
2. **文件对比** — 并排对比，相同部分折叠，差异部分颜色区分，支持多种文件格式

两个功能均支持拖拽文件和点击选择文件。

## 技术栈

- **前端转换引擎**：
  - `marked` (v9+) — Markdown → HTML
  - `turndown` (v7+) — HTML → Markdown
  - `jsdiff` (v5+) — 文本差异计算
- **后端解析引擎**（Python）：
  - `python-docx` — Word (.docx) 文件文本提取
  - `python-pptx` — PPT (.pptx) 文件文本提取
  - 内置读取 — TXT、Markdown、HTML 文件
- **UI 框架**：继续使用现有 pywebview + 原生 HTML/CSS/JS 架构

---

## 功能一：HTML ↔ Markdown 双向互转

### UI 设计

首页新增一张功能卡片（渐变绿色图标），点击进入 `viewHtmlMarkdown` 视图。

视图内部结构：
- **方向切换**：顶部两个 Tab 按钮 — "HTML → Markdown" / "Markdown → HTML"
- **输入区**：
  - 拖拽区域（复用现有 drop-zone 组件）
  - 支持 .html/.htm（HTML→MD 方向）或 .md（MD→HTML 方向）文件拖拽
  - 点击选择按钮调用 pywebview 文件对话框
  - 也支持直接在文本框中粘贴/编辑内容
- **输出区**：
  - 转换结果以文本框显示，可编辑
  - "复制到剪贴板"按钮
  - "导出文件"按钮 — 调用 pywebview 保存对话框
- **操作栏**：
  - "开始转换"按钮
  - 输出目录设置（与现有功能一致）

### 转换逻辑

**HTML → Markdown（前端执行）**：
1. 用户拖入或选择 .html/.htm 文件
2. 后端读取文件内容，返回纯文本（HTML源码）
3. 前端使用 `turndown` 将 HTML 转为 Markdown
4. 结果显示在输出文本框

**Markdown → HTML（前端执行）**：
1. 用户拖入或选择 .md 文件
2. 后端读取文件内容，返回纯文本
3. 前端使用 `marked` 将 Markdown 转为 HTML
4. 结果显示在输出文本框

### API 接口

```python
# api.py 新增方法
def read_text_file(self, params):
    """读取文本文件内容返回给前端
    params: {file_path: str}
    return: {success: bool, content: str, error: str}
    """

def save_text_file(self, params):
    """保存文本内容到文件
    params: {content: str, file_path: str}
    return: {success: bool, error: str}
    """
```

### 导出行为

- HTML → Markdown：默认导出为 `.md` 文件
- Markdown → HTML：默认导出为 `.html` 文件
- 支持输出目录设置（与现有功能共用 default_output_dir 逻辑）

---

## 功能二：文件对比

### UI 设计

首页新增一张功能卡片（渐变蓝紫色图标），点击进入 `viewFileDiff` 视图。

视图内部结构：
- **输入区**：左右两个拖拽区域
  - 左侧："文件 A" — 拖拽或选择文件
  - 右侧："文件 B" — 拖拽或选择文件
  - 支持的文件格式提示：.docx, .pptx, .txt, .md, .html, .htm
- **对比结果区**（选择两个文件后自动触发）：
  - 并排对比视图（双栏同步滚动）
  - 相同行折叠为一行摘要，如 "▸ 相同内容 (15行)"，点击可展开
  - 对比时文件格式要保持不变，支持图片、表格等内容对比
  - 差异行用颜色区分：
    - 红色背景：仅存在于文件 A 的内容（删除）
    - 绿色背景：仅存在于文件 B 的内容（新增）
    - 黄色背景：修改的行（两侧都变，行内差异用更深的颜色高亮）
  - 行号显示
- **操作栏**：
  - "导出对比报告"按钮 — 导出为 HTML 文件
  - 输出目录设置

### 文件解析逻辑（后端）

不同格式文件在后端提取为结构化文本，返回给前端进行 diff：

| 格式 | 提取方式 | 结构化策略 |
|------|---------|-----------|
| .txt | 直接读取 | 按行分割 |
| .md | 直接读取 | 按行分割 |
| .html/.htm | 直接读取 | 按行分割（保留源码对比） |
| .docx | python-docx | 按段落提取，段落间用换行分隔 |
| .pptx | python-pptx | 按幻灯片提取，每个幻灯片标记标题（如 `--- Slide 1 ---`），幻灯片内按段落分割 |

### API 接口

```python
# api.py 新增方法
def extract_file_text(self, params):
    """提取文件文本内容用于对比
    params: {file_path: str}
    return: {success: bool, content: str, format: str, error: str}
    """
```

### Diff 计算与渲染（前端）

1. 前端收到两个文件的文本后，使用 `jsdiff` 的 `DiffLines` 计算行级差异
2. 将 diff 结果渲染为并排视图：
   - 相同块（unchanged）：折叠为一行 "▸ 相同内容 (N行)"
   - 删除块（removed）：红色背景，显示在左侧
   - 新增块（added）：绿色背景，显示在右侧
   - 修改块：使用 `DiffWords` 做行内差异高亮
3. 双栏同步滚动

### 导出对比报告

导出为独立的 HTML 文件，包含：
- 内联 CSS（不依赖外部样式）
- 并排对比视图（与 app 内展示一致）
- 文件名和对比时间戳
- 可在浏览器中直接打开查看

---

## 整体架构

```
main.py                # 不变
api.py                 # 新增: read_text_file, save_text_file, extract_file_text
core/
  html_md_engine.py    # 新增: 文件读取/保存辅助（大部分逻辑在前端）
  diff_engine.py       # 新增: 文件文本提取（docx/pptx/txt/md/html）
utils/
  config.py            # 不变
  file_utils.py        # 不变
ui/
  index.html           # 新增: 两个功能视图的 HTML
  css/style.css        # 新增: 对比视图和互转视图的样式
  js/
    app.js             # 新增: 互转和对比的前端逻辑
    libs/
      marked.min.js    # 新增: Markdown → HTML
      turndown.min.js  # 新增: HTML → Markdown
      diff.min.js      # 新增: 文本差异计算
```

## 新增依赖

### Python（后端）
- `python-pptx` — PPT 文件文本提取（pip install python-pptx）

### JavaScript（前端，内联到 libs/）
- `marked` — 从 CDN 下载 min.js 放入 libs/
- `turndown` — 从 CDN 下载 min.js 放入 libs/
- `jsdiff` — 从 CDN 下载 min.js 放入 libs/

不使用 npm/构建工具，与现有项目架构保持一致（纯 HTML/CSS/JS）。

## 状态管理

app.js 的 `state` 对象新增：
```javascript
state.files.viewHtmlMarkdown = []     // 互转功能的文件
state.files.viewFileDiff = []         // 对比功能的文件（左）
state.files.viewFileDiffRight = []    // 对比功能的文件（右）
state.htmlMdDirection = 'html2md'     // 互转方向
state.diffResult = null               // diff 计算结果缓存
```

## 错误处理

- 不支持的文件格式：拖拽时过滤，并显示提示
- 文件读取失败：显示具体错误信息
- 空文件：提示"文件内容为空"
- 编码问题：后端尝试 UTF-8，失败后尝试 GBK/GB2312 自动检测
- PPT/Word 中含图片：仅提取文本，忽略图片，提示"仅对比文本内容"
