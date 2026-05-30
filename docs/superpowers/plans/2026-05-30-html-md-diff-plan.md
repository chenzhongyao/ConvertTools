# HTML/Markdown 互转 + 文件对比 功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 PDF 全能工具箱中新增 HTML↔Markdown 双向互转和文件对比两个独立功能，均支持拖拽。

**Architecture:** 前端使用 marked/turndown/jsdiff 轻量库处理转换和差异计算，后端 Python 负责文件读取/保存和 docx/pptx 文本提取。延续现有 pywebview + 原生 HTML/CSS/JS 架构，不引入构建工具。

**Tech Stack:** pywebview, marked.js, turndown.js, jsdiff, python-docx, python-pptx

---

## Task 1: 下载前端 JS 库到 libs 目录

**Files:**
- Create: `ui/js/libs/marked.min.js`
- Create: `ui/js/libs/turndown.min.js`
- Create: `ui/js/libs/diff.min.js`

- [ ] **Step 1: 创建 libs 目录**

```bash
mkdir -p ui/js/libs
```

- [ ] **Step 2: 下载 marked.min.js**

```bash
curl -L "https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js" -o ui/js/libs/marked.min.js
```

验证：`head -1 ui/js/libs/marked.min.js` 应包含 `marked` 字样。

- [ ] **Step 3: 下载 turndown.min.js**

```bash
curl -L "https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js" -o ui/js/libs/turndown.min.js
```

注意：turndown 官方没有 min 版本，直接用 dist 版本即可。

- [ ] **Step 4: 下载 diff.min.js**

```bash
curl -L "https://cdn.jsdelivr.net/npm/diff@5.2.0/dist/diff.min.js" -o ui/js/libs/diff.min.js
```

- [ ] **Step 5: Commit**

```bash
git add ui/js/libs/marked.min.js ui/js/libs/turndown.min.js ui/js/libs/diff.min.js
git commit -m "chore: add marked, turndown, jsdiff frontend libraries"
```

---

## Task 2: 后端 — 添加 python-pptx 依赖和文件读取/提取 API

**Files:**
- Modify: `requirements.txt`
- Create: `core/diff_engine.py`
- Modify: `api.py`

- [ ] **Step 1: 更新 requirements.txt 添加 python-pptx**

在 `requirements.txt` 末尾追加：

```
python-pptx==1.0.2
```

- [ ] **Step 2: 安装新依赖**

```bash
pip install python-pptx==1.0.2
```

- [ ] **Step 3: 创建 core/diff_engine.py**

```python
import os
from docx import Document
from pptx import Presentation


class DiffEngine:
    """Extract text from various file formats for diff comparison."""

    SUPPORTED_FORMATS = {'.txt', '.md', '.html', '.htm', '.docx', '.pptx'}

    @staticmethod
    def extract_text(file_path):
        """Extract text content from a file for diff comparison.
        Returns (content, format_ext, error).
        """
        if not os.path.isfile(file_path):
            return None, None, '文件不存在'

        ext = os.path.splitext(file_path)[1].lower()

        if ext not in DiffEngine.SUPPORTED_FORMATS:
            return None, ext, f'不支持的文件格式: {ext}'

        try:
            if ext == '.docx':
                content = DiffEngine._extract_docx(file_path)
            elif ext == '.pptx':
                content = DiffEngine._extract_pptx(file_path)
            else:
                content = DiffEngine._extract_text_file(file_path)
        except Exception as e:
            return None, ext, str(e)

        return content, ext, None

    @staticmethod
    def _extract_text_file(file_path):
        for encoding in ('utf-8', 'gbk', 'gb2312', 'latin-1'):
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    return f.read()
            except (UnicodeDecodeError, UnicodeError):
                continue
        return ''

    @staticmethod
    def _extract_docx(file_path):
        doc = Document(file_path)
        lines = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                lines.append(text)
        return '\n'.join(lines)

    @staticmethod
    def _extract_pptx(file_path):
        prs = Presentation(file_path)
        lines = []
        for i, slide in enumerate(prs.slides, 1):
            lines.append(f'--- Slide {i} ---')
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        text = para.text.strip()
                        if text:
                            lines.append(text)
            if shape.has_table:
                table = shape.table
                for row in table.rows:
                    row_text = ' | '.join(cell.text.strip() for cell in row.cells)
                    if row_text.strip(' |'):
                        lines.append(row_text)
        return '\n'.join(lines)
```

- [ ] **Step 4: 在 api.py 中添加新方法**

在 `api.py` 顶部 import 区域添加：

```python
from core.diff_engine import DiffEngine
```

在 `Api` 类中 `unlock_pdf` 方法之后添加以下三个方法：

```python
    # --- Text File Read/Save ---

    def read_text_file(self, params):
        """Read a text file and return its content.
        params: {file_path: str}
        """
        fpath = params.get('file_path')
        if not fpath or not os.path.isfile(fpath):
            return {'success': False, 'error': '文件不存在'}

        for encoding in ('utf-8', 'gbk', 'gb2312', 'latin-1'):
            try:
                with open(fpath, 'r', encoding=encoding) as f:
                    content = f.read()
                return {'success': True, 'content': content}
            except (UnicodeDecodeError, UnicodeError):
                continue

        return {'success': False, 'error': '无法解码文件'}

    def save_text_file(self, params):
        """Save text content to a file.
        params: {content: str, file_path: str}
        """
        content = params.get('content', '')
        fpath = params.get('file_path')
        if not fpath:
            return {'success': False, 'error': '未指定保存路径'}

        try:
            directory = os.path.dirname(fpath)
            if directory:
                os.makedirs(directory, exist_ok=True)
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            return {'success': True, 'file_path': fpath}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # --- File Diff ---

    def extract_file_text(self, params):
        """Extract text content from a file for diff comparison.
        params: {file_path: str}
        """
        fpath = params.get('file_path')
        if not fpath:
            return {'success': False, 'error': '未指定文件'}

        content, fmt, err = DiffEngine.extract_text(fpath)
        if err:
            return {'success': False, 'error': err}

        return {'success': True, 'content': content, 'format': fmt}

    def save_diff_report(self, params):
        """Save a diff report as an HTML file.
        params: {content: str, file_path: str}
        """
        return self.save_text_file(params)
```

- [ ] **Step 5: Commit**

```bash
git add requirements.txt core/diff_engine.py api.py
git commit -m "feat: add text file read/save and diff extraction backend APIs"
```

---

## Task 3: 前端 HTML — 添加首页卡片和新功能视图

**Files:**
- Modify: `ui/index.html`

- [ ] **Step 1: 在 index.html 的 `<head>` 中添加 JS 库引用**

在 `<link rel="stylesheet" href="css/style.css">` 之后添加：

```html
  <script src="js/libs/marked.min.js"></script>
  <script src="js/libs/turndown.min.js"></script>
  <script src="js/libs/diff.min.js"></script>
```

- [ ] **Step 2: 在首页 feature-grid 末尾（`viewSplitPdf` 卡片后面、`</div><!-- feature-grid -->` 之前）添加两张新卡片**

```html
        <div class="feature-card" data-view="viewHtmlMarkdown">
          <div class="feature-icon" style="background:linear-gradient(135deg,#16A085,#0E6655);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/></svg>
          </div>
          <div class="feature-info">
            <h3>HTML/Markdown互转</h3>
            <p>HTML与Markdown格式双向转换</p>
          </div>
        </div>

        <div class="feature-card" data-view="viewFileDiff">
          <div class="feature-icon" style="background:linear-gradient(135deg,#6C5CE7,#4834D4);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/><line x1="8" y1="8" x2="8" y2="8.01"/><line x1="16" y1="8" x2="16" y2="8.01"/><line x1="8" y1="12" x2="8" y2="12.01"/><line x1="16" y1="12" x2="16" y2="12.01"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>
          </div>
          <div class="feature-info">
            <h3>文件对比</h3>
            <p>对比两个文件的差异，支持多种格式</p>
          </div>
        </div>
```

- [ ] **Step 3: 在 `</main>` 标签之前（Merge PDF View 之后）添加 HTML↔Markdown 互转视图**

```html
    <!-- ====== HTML / Markdown Converter View ====== -->
    <section id="viewHtmlMarkdown" class="view">
      <div class="view-container">
        <!-- Direction Tabs -->
        <div class="direction-tabs">
          <button class="direction-tab active" data-direction="html2md">HTML → Markdown</button>
          <button class="direction-tab" data-direction="md2html">Markdown → HTML</button>
        </div>

        <!-- Drop Zone -->
        <div class="drop-zone" id="dropHtmlMarkdown">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p id="hmDropText">拖拽HTML文件到此处</p>
          <span class="drop-hint" id="hmDropHint">支持 .html / .htm 文件，或点击选择</span>
          <input type="file" accept=".html,.htm" style="display:none">
        </div>

        <!-- Input Area -->
        <div class="hm-panels">
          <div class="hm-panel">
            <div class="hm-panel-header">
              <span id="hmInputLabel">HTML 源码</span>
              <button class="btn btn-secondary btn-sm" id="btnClearInput" title="清空">清空</button>
            </div>
            <textarea id="hmInputArea" class="hm-textarea" placeholder="在此粘贴或编辑内容，也可拖入文件..." spellcheck="false"></textarea>
          </div>

          <div class="hm-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>

          <div class="hm-panel">
            <div class="hm-panel-header">
              <span id="hmOutputLabel">Markdown</span>
              <button class="btn btn-secondary btn-sm" id="btnCopyOutput" title="复制结果">复制</button>
            </div>
            <textarea id="hmOutputArea" class="hm-textarea" placeholder="转换结果..." spellcheck="false" readonly></textarea>
          </div>
        </div>

        <!-- Settings -->
        <div class="settings-group">
          <div class="setting-item">
            <label>输出目录</label>
            <div class="output-dir-row">
              <input type="text" id="outputDirHtmlMarkdown" placeholder="与源文件同目录" readonly>
              <button class="btn btn-secondary btn-sm" onclick="selectOutputDir('outputDirHtmlMarkdown')">选择</button>
            </div>
          </div>
        </div>

        <div class="action-bar">
          <button class="btn btn-primary btn-lg" id="btnStartHtmlMarkdown">开始转换</button>
          <button class="btn btn-secondary btn-lg" id="btnExportHtmlMarkdown" style="display:none;">导出文件</button>
        </div>
      </div>
    </section>
```

- [ ] **Step 4: 在 HTML↔Markdown 视图之后添加文件对比视图**

```html
    <!-- ====== File Diff View ====== -->
    <section id="viewFileDiff" class="view">
      <div class="view-container" style="max-width:960px;">
        <!-- Two Drop Zones Side by Side -->
        <div class="diff-drop-row">
          <div class="drop-zone diff-drop-zone" id="dropDiffLeft">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p>文件 A</p>
            <span class="drop-hint">拖拽文件或点击选择</span>
            <input type="file" accept=".txt,.md,.html,.htm,.docx,.pptx" style="display:none">
          </div>
          <div class="drop-zone diff-drop-zone" id="dropDiffRight">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p>文件 B</p>
            <span class="drop-hint">拖拽文件或点击选择</span>
            <input type="file" accept=".txt,.md,.html,.htm,.docx,.pptx" style="display:none">
          </div>
        </div>

        <!-- File Names -->
        <div class="diff-file-info" id="diffFileInfo" style="display:none;">
          <span id="diffFileNameA" class="diff-file-name"></span>
          <span class="diff-vs">vs</span>
          <span id="diffFileNameB" class="diff-file-name"></span>
        </div>

        <!-- Diff Result Area -->
        <div class="diff-result" id="diffResult" style="display:none;">
          <div class="diff-toolbar">
            <span class="diff-summary" id="diffSummary"></span>
            <div class="diff-toolbar-actions">
              <button class="btn btn-secondary btn-sm" id="btnExpandAll">展开全部</button>
              <button class="btn btn-secondary btn-sm" id="btnCollapseAll">折叠相同</button>
              <button class="btn btn-primary btn-sm" id="btnExportDiff">导出报告</button>
            </div>
          </div>
          <div class="diff-container" id="diffContainer">
            <div class="diff-pane" id="diffPaneA">
              <div class="diff-pane-header">文件 A</div>
              <div class="diff-pane-content" id="diffContentA"></div>
            </div>
            <div class="diff-divider"></div>
            <div class="diff-pane" id="diffPaneB">
              <div class="diff-pane-header">文件 B</div>
              <div class="diff-pane-content" id="diffContentB"></div>
            </div>
          </div>
        </div>

        <!-- Settings -->
        <div class="settings-group" id="diffSettings" style="display:none;">
          <div class="setting-item">
            <label>输出目录</label>
            <div class="output-dir-row">
              <input type="text" id="outputDirFileDiff" placeholder="与源文件同目录" readonly>
              <button class="btn btn-secondary btn-sm" onclick="selectOutputDir('outputDirFileDiff')">选择</button>
            </div>
          </div>
        </div>
      </div>
    </section>
```

- [ ] **Step 5: Commit**

```bash
git add ui/index.html
git commit -m "feat: add HTML/Markdown converter and file diff view HTML"
```

---

## Task 4: 前端 CSS — 添加互转和对比视图样式

**Files:**
- Modify: `ui/css/style.css`

- [ ] **Step 1: 在 style.css 末尾（`/* --- Utility --- */` 之前）添加互转和对比视图样式**

```css
/* --- Direction Tabs (HTML/Markdown Converter) --- */
.direction-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 4px;
  transition: background var(--transition);
}

.direction-tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition), color var(--transition), box-shadow var(--transition);
}

.direction-tab.active {
  background: var(--surface);
  color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.direction-tab:hover:not(.active) {
  color: var(--text);
}

/* --- HTML/Markdown Panels --- */
.hm-panels {
  display: flex;
  align-items: stretch;
  gap: 12px;
  margin-top: 20px;
}

.hm-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.hm-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.hm-textarea {
  flex: 1;
  min-height: 300px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition), background var(--transition), color var(--transition), box-shadow var(--transition);
}

.hm-textarea:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.hm-textarea[readonly] {
  background: var(--bg-secondary);
}

.hm-arrow {
  display: flex;
  align-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
  padding-top: 24px;
}

/* --- File Diff Drop Row --- */
.diff-drop-row {
  display: flex;
  gap: 16px;
}

.diff-drop-zone {
  flex: 1;
  padding: 32px 16px;
}

.diff-drop-zone svg {
  width: 36px;
  height: 36px;
}

/* --- Diff File Info --- */
.diff-file-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
  font-size: 13px;
}

.diff-file-name {
  font-weight: 600;
  color: var(--text);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-vs {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

/* --- Diff Result --- */
.diff-result {
  margin-top: 20px;
}

.diff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: background var(--transition), border-color var(--transition);
}

.diff-summary {
  font-size: 13px;
  color: var(--text-secondary);
}

.diff-toolbar-actions {
  display: flex;
  gap: 8px;
}

/* --- Diff Container (Side-by-Side) --- */
.diff-container {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface);
  transition: background var(--transition), border-color var(--transition);
}

.diff-pane {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.diff-pane-header {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  transition: background var(--transition), border-color var(--transition), color var(--transition);
}

.diff-pane-content {
  overflow-y: auto;
  max-height: 500px;
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace;
  font-size: 12px;
  line-height: 1.6;
}

.diff-divider {
  width: 1px;
  background: var(--border);
  flex-shrink: 0;
  transition: background var(--transition);
}

/* --- Diff Line Styles --- */
.diff-line {
  display: flex;
  min-height: 22px;
  padding: 0 8px 0 0;
  border-left: 3px solid transparent;
}

.diff-line-num {
  width: 44px;
  min-width: 44px;
  text-align: right;
  padding-right: 8px;
  color: var(--text-muted);
  user-select: none;
  font-size: 11px;
  line-height: 22px;
}

.diff-line-text {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
  padding-left: 4px;
  line-height: 22px;
}

.diff-line-unchanged {
  color: var(--text);
}

.diff-line-removed {
  background: rgba(231, 76, 60, 0.12);
  border-left-color: var(--danger);
}

.diff-line-removed .diff-line-text {
  color: var(--danger);
}

.diff-line-added {
  background: rgba(39, 174, 96, 0.12);
  border-left-color: var(--success);
}

.diff-line-added .diff-line-text {
  color: var(--success);
}

/* Inline diff highlight */
.diff-line-highlight {
  background: rgba(241, 196, 15, 0.25);
  border-radius: 2px;
  padding: 0 2px;
}

/* Folded same-content block */
.diff-fold {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  transition: background var(--transition), color var(--transition);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.diff-fold:hover {
  background: var(--primary-light);
  color: var(--primary);
}

.diff-fold-arrow {
  margin-right: 6px;
  font-size: 10px;
}

/* --- Responsive for new views --- */
@media (max-width: 640px) {
  .hm-panels {
    flex-direction: column;
  }

  .hm-arrow {
    transform: rotate(90deg);
    padding-top: 0;
    justify-content: center;
  }

  .diff-drop-row {
    flex-direction: column;
  }

  .diff-container {
    flex-direction: column;
  }

  .diff-divider {
    width: 100%;
    height: 1px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/css/style.css
git commit -m "feat: add styles for HTML/Markdown converter and file diff views"
```

---

## Task 5: 前端 JS — 添加 HTML↔Markdown 互转逻辑

**Files:**
- Modify: `ui/js/app.js`

- [ ] **Step 1: 在 state 对象中添加新视图的文件状态和方向**

将 `state.files` 改为：

```javascript
  const state = {
    currentView: 'viewHome',
    files: {
      viewPdfToWord: [],
      viewPdfToImage: [],
      viewImageToPdf: [],
      viewMergePdf: [],
      viewSplitPdf: [],
      viewHtmlMarkdown: [],
      viewFileDiffLeft: [],
      viewFileDiffRight: [],
    },
    pageOrder: [],
    pageRotations: {},
    pdfPath: null,
    pdfPassword: null,
    passwordCallback: null,
    suppressClick: false,
    defaultOutputDir: '',
    htmlMdDirection: 'html2md',
    hmOutputContent: '',
    hmSourceFileName: '',
  };
```

- [ ] **Step 2: 在 viewTitles 中添加新视图标题**

```javascript
  const viewTitles = {
    viewHome: 'PDF全能工具箱',
    viewPdfToWord: 'PDF转Word',
    viewPdfToImage: 'PDF转图片',
    viewImageToPdf: '图片转PDF',
    viewPageManager: '页面操作',
    viewMergePdf: '合并PDF',
    viewSplitPdf: '拆分PDF',
    viewHtmlMarkdown: 'HTML/Markdown互转',
    viewFileDiff: '文件对比',
  };
```

- [ ] **Step 3: 在 outputDirInputIds 数组中添加新视图的输出目录输入 ID**

将 `outputDirInputIds` 改为：

```javascript
  const outputDirInputIds = [
    'outputDirPdfToWord',
    'outputDirPdfToImage',
    'outputDirImageToPdf',
    'outputDirPageManager',
    'outputDirSplitPdf',
    'outputDirMergePdf',
    'outputDirHtmlMarkdown',
    'outputDirFileDiff',
  ];
```

- [ ] **Step 4: 在现有 `setupDropZone` 调用之后添加新的 drop zone 初始化**

在 `setupDropZone('dropSplitPdf', 'viewSplitPdf', '.pdf', false);` 之后添加：

```javascript
  setupDropZone('dropHtmlMarkdown', 'viewHtmlMarkdown', '.html,.htm,.md');
  setupDropZone('dropDiffLeft', 'viewFileDiffLeft', '.txt,.md,.html,.htm,.docx,.pptx', false);
  setupDropZone('dropDiffRight', 'viewFileDiffRight', '.txt,.md,.html,.htm,.docx,.pptx', false);
```

- [ ] **Step 5: 在 `addFiles` 函数中添加对新视图的处理**

在 `addFiles` 函数中，现有 `if (viewId === 'viewSplitPdf')` 块之后添加：

```javascript
    // HTML/Markdown converter: single file, read content
    if (viewId === 'viewHtmlMarkdown' && state.files[viewId].length > 0) {
      loadHtmlMdFileContent();
    }

    // File Diff: trigger comparison when both sides have files
    if (viewId === 'viewFileDiffLeft' || viewId === 'viewFileDiffRight') {
      updateDiffFileInfo();
      if (state.files.viewFileDiffLeft.length > 0 && state.files.viewFileDiffRight.length > 0) {
        startFileDiff();
      }
    }
```

- [ ] **Step 6: 在 `removeFile` 函数中添加对新视图的处理**

在 `removeFile` 函数的现有代码之后添加：

```javascript
    if (viewId === 'viewFileDiffLeft' || viewId === 'viewFileDiffRight') {
      updateDiffFileInfo();
    }
```

- [ ] **Step 7: 在 IIFE 末尾（`window.pdfToolbox` 赋值之后，`// ---- Init` 之前）添加 HTML↔Markdown 互转的所有逻辑**

```javascript
  // ---- Direction Tabs (HTML/Markdown Converter) ----
  $$('.direction-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.direction-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.htmlMdDirection = tab.dataset.direction;
      updateHtmlMdLabels();
      // Clear file list for new direction
      state.files.viewHtmlMarkdown = [];
      renderFileList('viewHtmlMarkdown');
      $('#hmInputArea').value = '';
      $('#hmOutputArea').value = '';
      state.hmOutputContent = '';
      state.hmSourceFileName = '';
      $('#btnExportHtmlMarkdown').style.display = 'none';
    });
  });

  function updateHtmlMdLabels() {
    const dir = state.htmlMdDirection;
    if (dir === 'html2md') {
      $('#hmInputLabel').textContent = 'HTML 源码';
      $('#hmOutputLabel').textContent = 'Markdown';
      $('#hmDropText').textContent = '拖拽HTML文件到此处';
      $('#hmDropHint').textContent = '支持 .html / .htm 文件，或点击选择';
      $('#dropHtmlMarkdown input').setAttribute('accept', '.html,.htm');
    } else {
      $('#hmInputLabel').textContent = 'Markdown';
      $('#hmOutputLabel').textContent = 'HTML';
      $('#hmDropText').textContent = '拖拽Markdown文件到此处';
      $('#hmDropHint').textContent = '支持 .md 文件，或点击选择';
      $('#dropHtmlMarkdown input').setAttribute('accept', '.md');
    }
  }

  // Load file content into textarea
  async function loadHtmlMdFileContent() {
    const files = state.files.viewHtmlMarkdown;
    if (!files.length) return;
    const fpath = files[0].path;
    state.hmSourceFileName = files[0].name;

    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.read_text_file({ file_path: fpath });
        if (result.success) {
          $('#hmInputArea').value = result.content;
        } else {
          alert(result.error || '读取文件失败');
        }
      } catch (err) {
        alert('读取文件失败: ' + err.message);
      }
    }
  }

  // Clear input
  $('#btnClearInput').addEventListener('click', () => {
    $('#hmInputArea').value = '';
    $('#hmOutputArea').value = '';
    state.hmOutputContent = '';
    state.files.viewHtmlMarkdown = [];
    renderFileList('viewHtmlMarkdown');
    state.hmSourceFileName = '';
    $('#btnExportHtmlMarkdown').style.display = 'none';
  });

  // Start conversion
  $('#btnStartHtmlMarkdown').addEventListener('click', () => {
    const input = $('#hmInputArea').value;
    if (!input.trim()) {
      alert('请输入或导入内容');
      return;
    }

    let output = '';
    if (state.htmlMdDirection === 'html2md') {
      const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      output = turndownService.turndown(input);
    } else {
      output = marked.parse(input);
    }

    $('#hmOutputArea').value = output;
    state.hmOutputContent = output;
    $('#btnExportHtmlMarkdown').style.display = 'inline-flex';
    showSuccess('转换完成！');
  });

  // Copy output
  $('#btnCopyOutput').addEventListener('click', () => {
    const text = $('#hmOutputArea').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('已复制到剪贴板');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showSuccess('已复制到剪贴板');
    });
  });

  // Export file
  $('#btnExportHtmlMarkdown').addEventListener('click', async () => {
    if (!state.hmOutputContent) return;

    const isHtml2Md = state.htmlMdDirection === 'html2md';
    const defaultName = state.hmSourceFileName
      ? state.hmSourceFileName.replace(/\.[^.]+$/, isHtml2Md ? '.md' : '.html')
      : (isHtml2Md ? 'output.md' : 'output.html');

    const outputDir = getOutputDir('outputDirHtmlMarkdown');
    let savePath;
    if (outputDir) {
      savePath = outputDir + '/' + defaultName;
    } else if (state.files.viewHtmlMarkdown.length > 0 && state.files.viewHtmlMarkdown[0].source_dir) {
      savePath = state.files.viewHtmlMarkdown[0].source_dir + '/' + defaultName;
    } else {
      savePath = defaultName;
    }

    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.save_text_file({ content: state.hmOutputContent, file_path: savePath });
        if (result.success) {
          showSuccess('文件已保存至: ' + result.file_path);
        } else {
          alert(result.error || '保存失败');
        }
      } catch (err) {
        alert('保存失败: ' + err.message);
      }
    }
  });
```

- [ ] **Step 8: Commit**

```bash
git add ui/js/app.js
git commit -m "feat: add HTML/Markdown converter frontend logic"
```

---

## Task 6: 前端 JS — 添加文件对比逻辑

**Files:**
- Modify: `ui/js/app.js`

- [ ] **Step 1: 在上一步添加的 HTML↔Markdown 逻辑之后添加文件对比逻辑**

```javascript
  // ---- File Diff ----
  function updateDiffFileInfo() {
    const leftFiles = state.files.viewFileDiffLeft;
    const rightFiles = state.files.viewFileDiffRight;
    const infoEl = $('#diffFileInfo');

    if (leftFiles.length > 0 || rightFiles.length > 0) {
      infoEl.style.display = 'flex';
      $('#diffFileNameA').textContent = leftFiles.length ? leftFiles[0].name : '未选择';
      $('#diffFileNameB').textContent = rightFiles.length ? rightFiles[0].name : '未选择';
    } else {
      infoEl.style.display = 'none';
    }
  }

  async function startFileDiff() {
    const leftPath = state.files.viewFileDiffLeft[0]?.path;
    const rightPath = state.files.viewFileDiffRight[0]?.path;

    if (!leftPath || !rightPath) return;

    showLoading('正在提取文件内容...');

    try {
      const [resultA, resultB] = await Promise.all([
        pywebview.api.extract_file_text({ file_path: leftPath }),
        pywebview.api.extract_file_text({ file_path: rightPath }),
      ]);

      hideLoading();

      if (!resultA.success) {
        alert('文件A读取失败: ' + (resultA.error || '未知错误'));
        return;
      }
      if (!resultB.success) {
        alert('文件B读取失败: ' + (resultB.error || '未知错误'));
        return;
      }

      renderDiffResult(resultA.content, resultB.content);
    } catch (err) {
      hideLoading();
      alert('对比失败: ' + err.message);
    }
  }

  function renderDiffResult(textA, textB) {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');

    // Use jsdiff structuredPatch for line-level diff
    const changes = Diff.diffLines(textA, textB);

    let htmlA = '';
    let htmlB = '';
    let lineNumA = 1;
    let lineNumB = 1;
    let addedCount = 0;
    let removedCount = 0;

    const blocks = [];

    for (const change of changes) {
      const lines = change.value.split('\n');
      // Remove trailing empty element from split
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      if (change.added) {
        addedCount += lines.length;
        blocks.push({ type: 'added', lines: lines, lineNumStart: lineNumB });
        for (const line of lines) {
          htmlB += buildDiffLine(lineNumB++, line, 'diff-line-added');
        }
        // Pad left side with empty lines
        for (let i = 0; i < lines.length; i++) {
          htmlA += buildDiffLine('', '', 'diff-line-unchanged diff-line-empty');
        }
      } else if (change.removed) {
        removedCount += lines.length;
        blocks.push({ type: 'removed', lines: lines, lineNumStart: lineNumA });
        for (const line of lines) {
          htmlA += buildDiffLine(lineNumA++, line, 'diff-line-removed');
        }
        // Pad right side with empty lines
        for (let i = 0; i < lines.length; i++) {
          htmlB += buildDiffLine('', '', 'diff-line-unchanged diff-line-empty');
        }
      } else {
        // Unchanged block — fold it
        blocks.push({ type: 'unchanged', lines: lines, lineNumStartA: lineNumA, lineNumStartB: lineNumB });
        const count = lines.length;
        const foldId = 'fold-' + lineNumA + '-' + lineNumB;

        // Folded summary line
        htmlA += buildFoldLine(foldId, count, lineNumA, lineNumA + count - 1, 'A');
        htmlB += buildFoldLine(foldId, count, lineNumB, lineNumB + count - 1, 'B');

        // Hidden expanded content
        let expandedA = '';
        let expandedB = '';
        for (const line of lines) {
          expandedA += buildDiffLine(lineNumA++, line, 'diff-line-unchanged');
          expandedB += buildDiffLine(lineNumB++, line, 'diff-line-unchanged');
        }
        htmlA += `<div class="diff-fold-content" id="${foldId}-A" style="display:none;">${expandedA}</div>`;
        htmlB += `<div class="diff-fold-content" id="${foldId}-B" style="display:none;">${expandedB}</div>`;
      }
    }

    $('#diffContentA').innerHTML = htmlA;
    $('#diffContentB').innerHTML = htmlB;

    // Summary
    $('#diffSummary').textContent = `+${addedCount} 行新增  -${removedCount} 行删除`;

    // Show result area
    $('#diffResult').style.display = 'block';
    $('#diffSettings').style.display = 'block';

    // Sync scroll
    setupDiffSyncScroll();

    // Fold click handlers
    setupFoldClickHandlers();
  }

  function buildDiffLine(lineNum, text, className) {
    const escapedText = escapeHtml(text);
    return `<div class="diff-line ${className}"><span class="diff-line-num">${lineNum}</span><span class="diff-line-text">${escapedText}</span></div>`;
  }

  function buildFoldLine(foldId, count, startLine, endLine, side) {
    return `<div class="diff-fold" data-fold-id="${foldId}" data-fold-side="${side}"><span class="diff-fold-arrow">▸</span>相同内容 (${count}行, 第${startLine}-${endLine}行)</div>`;
  }

  function setupFoldClickHandlers() {
    $$('.diff-fold').forEach((fold) => {
      fold.addEventListener('click', () => {
        const foldId = fold.dataset.foldId;
        const contentA = document.getElementById(foldId + '-A');
        const contentB = document.getElementById(foldId + '-B');
        if (!contentA || !contentB) return;

        const isHidden = contentA.style.display === 'none';
        contentA.style.display = isHidden ? 'block' : 'none';
        contentB.style.display = isHidden ? 'block' : 'none';

        // Update arrow
        const arrow = fold.querySelector('.diff-fold-arrow');
        if (arrow) arrow.textContent = isHidden ? '▾' : '▸';
      });
    });
  }

  function setupDiffSyncScroll() {
    const paneA = $('#diffContentA');
    const paneB = $('#diffContentB');
    let syncing = false;

    paneA.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      paneB.scrollTop = paneA.scrollTop;
      syncing = false;
    });

    paneB.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      paneA.scrollTop = paneB.scrollTop;
      syncing = false;
    });
  }

  // Expand All / Collapse All
  $('#btnExpandAll').addEventListener('click', () => {
    $$('.diff-fold-content').forEach((el) => { el.style.display = 'block'; });
    $$('.diff-fold-arrow').forEach((el) => { el.textContent = '▾'; });
  });

  $('#btnCollapseAll').addEventListener('click', () => {
    $$('.diff-fold-content').forEach((el) => { el.style.display = 'none'; });
    $$('.diff-fold-arrow').forEach((el) => { el.textContent = '▸'; });
  });

  // Export diff report
  $('#btnExportDiff').addEventListener('click', async () => {
    const container = $('#diffContainer');
    if (!container) return;

    const nameA = state.files.viewFileDiffLeft[0]?.name || 'File A';
    const nameB = state.files.viewFileDiffRight[0]?.name || 'File B';
    const summary = $('#diffSummary').textContent;
    const now = new Date().toLocaleString('zh-CN');

    // Build standalone HTML report
    const reportHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>文件对比报告</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;margin:0;padding:20px;background:#f7f8fa;color:#2c3e50;}
h1{font-size:20px;margin-bottom:4px;}
.meta{font-size:13px;color:#7f8c8d;margin-bottom:20px;}
.diff-container{display:flex;border:1px solid #e1e8ed;border-radius:10px;overflow:hidden;background:#fff;}
.diff-pane{flex:1;min-width:0;overflow:auto;}
.diff-pane-header{padding:8px 14px;font-size:12px;font-weight:600;color:#7f8c8d;text-transform:uppercase;background:#eef1f5;border-bottom:1px solid #e1e8ed;}
.diff-divider{width:1px;background:#e1e8ed;}
.diff-line{display:flex;min-height:22px;padding:0 8px 0 0;border-left:3px solid transparent;font-family:monospace;font-size:12px;line-height:22px;}
.diff-line-num{width:44px;min-width:44px;text-align:right;padding-right:8px;color:#b0bec5;user-select:none;font-size:11px;}
.diff-line-text{flex:1;white-space:pre-wrap;word-break:break-all;padding-left:4px;}
.diff-line-removed{background:rgba(231,76,60,0.12);border-left-color:#e74c3c;}
.diff-line-removed .diff-line-text{color:#e74c3c;}
.diff-line-added{background:rgba(39,174,96,0.12);border-left-color:#27ae60;}
.diff-line-added .diff-line-text{color:#27ae60;}
.diff-line-unchanged{color:#2c3e50;}
.diff-line-empty{background:transparent;}
.diff-fold{display:flex;align-items:center;justify-content:center;padding:6px 12px;background:#eef1f5;color:#b0bec5;font-size:11px;}
</style>
</head>
<body>
<h1>文件对比报告</h1>
<p class="meta">${escapeHtml(nameA)} vs ${escapeHtml(nameB)} — ${summary} — ${now}</p>
${container.outerHTML}
</body>
</html>`;

    const outputDir = getOutputDir('outputDirFileDiff');
    const defaultName = `diff_report_${Date.now()}.html`;
    let savePath = defaultName;
    if (outputDir) {
      savePath = outputDir + '/' + defaultName;
    }

    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.save_diff_report({ content: reportHtml, file_path: savePath });
        if (result.success) {
          showSuccess('报告已保存至: ' + result.file_path);
        } else {
          alert(result.error || '保存失败');
        }
      } catch (err) {
        alert('保存失败: ' + err.message);
      }
    }
  });
```

- [ ] **Step 2: 在 `addFiles` 函数中修复 viewFileDiff 的 renderFileList 和 updateButtonStates 调用**

在 `addFiles` 函数中，在现有的 `renderFileList(viewId)` 调用之前，增加对 viewFileDiffLeft/Right 的列表渲染处理。找到现有的 `renderFileList(viewId);` 行，在其前面添加：

```javascript
    // For diff views, render the correct list element
    if (viewId === 'viewFileDiffLeft' || viewId === 'viewFileDiffRight') {
      renderDiffFileList(viewId);
    }
```

然后在文件末尾（diff 逻辑之前）添加 `renderDiffFileList` 函数：

```javascript
  function renderDiffFileList(viewId) {
    const isLeft = viewId === 'viewFileDiffLeft';
    const zone = isLeft ? $('#dropDiffLeft') : $('#dropDiffRight');
    const files = state.files[viewId] || [];

    if (files.length > 0) {
      zone.innerHTML = `<div style="padding:8px 0;font-size:13px;font-weight:500;color:var(--text);">${escapeHtml(files[0].name)}<button class="file-remove" style="margin-left:8px;width:22px;height:22px;border:none;border-radius:50%;background:transparent;color:var(--text-muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" data-view="${viewId}" title="移除"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
      zone.querySelector('.file-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        state.files[viewId] = [];
        resetDiffDropZone(viewId);
        updateDiffFileInfo();
        $('#diffResult').style.display = 'none';
        $('#diffSettings').style.display = 'none';
      });
    } else {
      resetDiffDropZone(viewId);
    }
  }

  function resetDiffDropZone(viewId) {
    const isLeft = viewId === 'viewFileDiffLeft';
    const zone = isLeft ? $('#dropDiffLeft') : $('#dropDiffRight');
    const label = isLeft ? '文件 A' : '文件 B';
    const accept = '.txt,.md,.html,.htm,.docx,.pptx';
    zone.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p>${label}</p>
      <span class="drop-hint">拖拽文件或点击选择</span>
      <input type="file" accept="${accept}" style="display:none">`;
    // Re-attach click handler for the hidden file input
    zone.addEventListener('click', (e) => {
      if (state.suppressClick) return;
      if (e.target.closest('.file-remove')) return;
      e.preventDefault();
      e.stopPropagation();
      openPywebviewFileDialog(viewId, accept);
    });
  }
```

- [ ] **Step 3: Commit**

```bash
git add ui/js/app.js
git commit -m "feat: add file diff frontend logic with side-by-side view"
```

---

## Task 7: 集成测试 — 运行应用验证功能

- [ ] **Step 1: 启动应用**

```bash
cd /media/fighting/刘丽楠/czy_work/czy_claude_tools_final/ConvertTools && python main.py
```

- [ ] **Step 2: 验证首页新增卡片**

确认首页有 8 张功能卡片，新增的"HTML/Markdown互转"和"文件对比"卡片可见且可点击。

- [ ] **Step 3: 测试 HTML→Markdown 互转**

1. 点击"HTML/Markdown互转"卡片
2. 确认方向切换 Tab 正常
3. 在输入框粘贴一段 HTML 代码
4. 点击"开始转换"
5. 确认输出框显示 Markdown 格式内容
6. 点击"复制"按钮确认可复制
7. 切换到"Markdown → HTML"方向
8. 在输入框粘贴 Markdown 内容
9. 点击"开始转换"
10. 确认输出框显示 HTML 格式内容

- [ ] **Step 4: 测试文件拖拽导入**

1. 拖拽一个 .html 文件到互转视图的拖拽区
2. 确认文件内容加载到输入框
3. 拖拽一个 .md 文件，切换方向后确认也能加载

- [ ] **Step 5: 测试文件对比**

1. 点击首页"文件对比"卡片
2. 拖拽或选择两个文件（左侧文件A，右侧文件B）
3. 确认自动触发对比，结果以并排视图展示
4. 确认相同内容折叠显示，点击可展开
5. 确认差异行用颜色区分（红色=删除，绿色=新增）
6. 点击"展开全部"和"折叠相同"按钮确认功能正常
7. 点击"导出报告"确认生成 HTML 文件

- [ ] **Step 6: 测试 Word/PPT 对比**

1. 准备两个 .docx 文件
2. 分别拖入文件 A 和文件 B
3. 确认提取文本内容后正确显示差异

- [ ] **Step 7: 测试暗色主题**

1. 切换到暗色主题
2. 确认互转和对比视图在暗色主题下样式正常

- [ ] **Step 8: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete HTML/Markdown converter and file diff features"
```
