# PDF全能工具箱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency, single-file PDF toolbox with GUI for Windows and Ubuntu, supporting PDF↔Word/Image conversion, page operations, merging, and OCR.

**Architecture:** PyWebView renders local HTML/CSS/JS as the frontend; Python backend handles PDF/Word/Image/OCR operations. JS→Python via `pywebview.api` bridge. PyInstaller packages everything into a single executable per platform.

**Tech Stack:** Python 3.10+, PyWebView, PyMuPDF, python-docx, Pillow, pytesseract, Tesseract runtime, PyInstaller

---

## File Structure

```
czy_pdf2word/
├── main.py                       # Entry point: create PyWebView window
├── api.py                        # PyWebView API bridge (all JS-callable methods)
├── core/
│   ├── __init__.py
│   ├── pdf_engine.py             # PyMuPDF wrapper: read, render, merge, page ops
│   ├── word_engine.py            # python-docx wrapper: generate Word from extracted content
│   ├── ocr_engine.py             # Tesseract wrapper: detect scans, OCR text extraction
│   └── image_engine.py           # Pillow wrapper: resize, format convert, DPI control
├── ui/
│   ├── index.html                # Single-page app: all views in one HTML
│   ├── css/
│   │   └── style.css             # All styles: variables, light/dark, components, pages
│   └── js/
│       └── app.js                # All frontend logic: routing, drag-drop, API calls
├── assets/
│   └── icons/                    # SVG icons for feature cards (inline in HTML)
├── utils/
│   ├── __init__.py
│   ├── file_utils.py             # File dialog, temp dir, output path helpers
│   └── config.py                 # App config, Tesseract path resolution
├── requirements.txt
└── build.spec                    # PyInstaller config
```

**Key design decisions:**
- Single HTML file with JS-based view switching (no page reloads, simpler PyWebView setup)
- Single CSS file with CSS custom properties for theming
- Single JS file for all frontend logic (app is small enough, avoids module loading complexity)
- `api.py` is the sole bridge file — all `pywebview.api.*` calls land here, it delegates to core modules

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `requirements.txt`
- Create: `main.py`
- Create: `utils/__init__.py`
- Create: `utils/config.py`
- Create: `utils/file_utils.py`
- Create: `core/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
PyMuPDF>=1.23.0
python-docx>=0.8.11
Pillow>=10.0
pytesseract>=0.3.10
pywebview>=4.0
```

- [ ] **Step 2: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: All packages install successfully

- [ ] **Step 3: Create utils/config.py**

```python
import os
import sys

def get_tesseract_cmd():
    """Resolve Tesseract binary path based on OS and whether running from PyInstaller bundle."""
    if getattr(sys, 'frozen', False):
        base = sys._MEIPASS
        if sys.platform == 'win32':
            return os.path.join(base, 'tesseract', 'tesseract.exe')
        else:
            return os.path.join(base, 'tesseract', 'tesseract')
    # Development: rely on system PATH
    return 'tesseract'

def get_tessdata_prefix():
    """Resolve tessdata directory for bundled Tesseract."""
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'tesseract', 'tessdata')
    return None

APP_TITLE = "PDF全能工具箱"
APP_VERSION = "1.0.0"
WINDOW_WIDTH = 1100
WINDOW_HEIGHT = 750
```

- [ ] **Step 4: Create utils/file_utils.py**

```python
import os
import tempfile
import shutil

def ensure_output_dir(output_dir=None):
    """Return a valid output directory, creating it if needed."""
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        return output_dir
    return os.getcwd()

def get_output_path(input_path, suffix, output_dir=None):
    """Generate output file path with suffix, keeping original filename stem."""
    basename = os.path.splitext(os.path.basename(input_path))[0]
    directory = output_dir or os.path.dirname(input_path) or os.getcwd()
    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, f"{basename}{suffix}")

def create_temp_dir():
    """Create a temporary directory for intermediate files."""
    return tempfile.mkdtemp(prefix='pdf_toolbox_')

def cleanup_temp_dir(path):
    """Safely remove a temporary directory."""
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass
```

- [ ] **Step 5: Create main.py**

```python
import webview
from api import Api
from utils.config import APP_TITLE, WINDOW_WIDTH, WINDOW_HEIGHT

def main():
    api = Api()
    webview.create_window(
        APP_TITLE,
        url='ui/index.html',
        js_api=api,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(900, 600),
        resizable=True,
    )
    webview.start(debug=False)

if __name__ == '__main__':
    main()
```

- [ ] **Step 6: Create api.py skeleton**

```python
class Api:
    """PyWebView API bridge. All methods here are callable from JS via pywebview.api.*."""

    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    # --- File dialogs ---

    def select_files(self, file_types):
        """Open file selection dialog. file_types: list of extensions like ['pdf', 'png', 'jpg']."""
        if not self._window:
            return []
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=(f'Files ({" ".join(f"*.{ft}" for ft in file_types)})',)
        )
        return list(result) if result else []

    def select_folder(self):
        """Open folder selection dialog."""
        if not self._window:
            return ''
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        return result[0] if result else ''

    def save_file(self, default_name, file_types):
        """Open save file dialog."""
        if not self._window:
            return ''
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=(f'Files ({" ".join(f"*.{ft}" for ft in file_types)})',)
        )
        return result if result else ''

    # --- Feature stubs (implemented in later tasks) ---

    def pdf_to_word(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def pdf_to_image(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def image_to_pdf(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def get_pdf_page_thumbnails(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def reorder_pages(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def rotate_pages(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def delete_pages(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def merge_pdfs(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def check_pdf_encrypted(self, params):
        return {'success': False, 'error': 'Not implemented'}

    def unlock_pdf(self, params):
        return {'success': False, 'error': 'Not implemented'}
```

- [ ] **Step 7: Wire up window reference in main.py**

Update main.py to set window reference:

```python
def main():
    api = Api()
    window = webview.create_window(
        APP_TITLE,
        url='ui/index.html',
        js_api=api,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(900, 600),
        resizable=True,
    )
    api.set_window(window)
    webview.start(debug=False)
```

- [ ] **Step 8: Commit**

```bash
git add requirements.txt main.py api.py utils/ core/__init__.py
git commit -m "feat: project scaffolding with dependencies and API bridge skeleton"
```

---

### Task 2: Frontend — HTML/CSS Shell, Home Page, Theme, Routing

**Files:**
- Create: `ui/index.html`
- Create: `ui/css/style.css`
- Create: `ui/js/app.js`

- [ ] **Step 1: Create ui/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF全能工具箱</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- Navigation bar -->
    <nav id="navbar">
        <button id="btn-back" class="nav-btn hidden" onclick="navigateTo('home')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            返回
        </button>
        <h1 id="nav-title" class="nav-title">PDF全能工具箱</h1>
        <button id="btn-theme" class="nav-btn" onclick="toggleTheme()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        </button>
    </nav>

    <!-- Home view -->
    <div id="view-home" class="view active">
        <div class="card-grid">
            <div class="feature-card" onclick="navigateTo('pdf-to-word')">
                <div class="card-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <h3>PDF转Word</h3>
                <p>提取文字图片，生成可编辑Word文档</p>
            </div>
            <div class="feature-card" onclick="navigateTo('pdf-to-image')">
                <div class="card-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <h3>PDF转图片</h3>
                <p>将PDF每页转为PNG或JPG图片</p>
            </div>
            <div class="feature-card" onclick="navigateTo('image-to-pdf')">
                <div class="card-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>
                </div>
                <h3>图片转PDF</h3>
                <p>将多张图片合并为一个PDF文件</p>
            </div>
            <div class="feature-card" onclick="navigateTo('page-manager')">
                <div class="card-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </div>
                <h3>页面操作</h3>
                <p>旋转、删除、重排PDF页面</p>
            </div>
            <div class="feature-card" onclick="navigateTo('merge-pdf')">
                <div class="card-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                </div>
                <h3>合并PDF</h3>
                <p>将多个PDF文件合并为一个</p>
            </div>
        </div>
        <footer class="home-footer">PDF全能工具箱 v1.0.0</footer>
    </div>

    <!-- PDF to Word view -->
    <div id="view-pdf-to-word" class="view">
        <div class="page-container">
            <div class="drop-zone" id="drop-pdf2word"
                 ondragover="handleDragOver(event)" ondrop="handleDrop(event, 'pdf')" onclick="selectFiles('pdf2word', ['pdf'])">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p>拖拽PDF文件到此处，或点击选择</p>
            </div>
            <div class="file-list" id="file-list-pdf2word"></div>
            <div class="action-bar">
                <button class="btn-primary" onclick="startPdfToWord()">开始转换</button>
            </div>
            <div class="progress-area hidden" id="progress-pdf2word">
                <div class="progress-bar"><div class="progress-fill" id="progress-fill-pdf2word"></div></div>
                <p class="progress-text" id="progress-text-pdf2word"></p>
            </div>
        </div>
    </div>

    <!-- PDF to Image view -->
    <div id="view-pdf-to-image" class="view">
        <div class="page-container">
            <div class="drop-zone" id="drop-pdf2img"
                 ondragover="handleDragOver(event)" ondrop="handleDrop(event, 'pdf')" onclick="selectFiles('pdf2img', ['pdf'])">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p>拖拽PDF文件到此处，或点击选择</p>
            </div>
            <div class="file-list" id="file-list-pdf2img"></div>
            <div class="settings-group">
                <label>输出格式</label>
                <select id="img-format">
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                </select>
                <label>DPI</label>
                <input type="number" id="img-dpi" value="150" min="72" max="600" step="1">
            </div>
            <div class="action-bar">
                <button class="btn-primary" onclick="startPdfToImage()">开始转换</button>
            </div>
            <div class="progress-area hidden" id="progress-pdf2img">
                <div class="progress-bar"><div class="progress-fill" id="progress-fill-pdf2img"></div></div>
                <p class="progress-text" id="progress-text-pdf2img"></p>
            </div>
        </div>
    </div>

    <!-- Image to PDF view -->
    <div id="view-image-to-pdf" class="view">
        <div class="page-container">
            <div class="drop-zone" id="drop-img2pdf"
                 ondragover="handleDragOver(event)" ondrop="handleDrop(event, 'image')" onclick="selectFiles('img2pdf', ['png','jpg','jpeg','bmp','tiff'])">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p>拖拽图片文件到此处，或点击选择</p>
            </div>
            <div class="file-list sortable" id="file-list-img2pdf"></div>
            <div class="settings-group">
                <label>页面模式</label>
                <select id="pdf-page-mode" onchange="onPageModeChange()">
                    <option value="original">原始比例</option>
                    <option value="a4">A4纸张</option>
                </select>
                <div id="a4-options" class="settings-sub hidden">
                    <label>A4方向</label>
                    <select id="a4-orientation">
                        <option value="auto">自动</option>
                        <option value="portrait">纵向</option>
                        <option value="landscape">横向</option>
                    </select>
                </div>
                <div id="original-options" class="settings-sub">
                    <label>基准图片</label>
                    <select id="base-image-index">
                        <option value="0">第一张图片</option>
                    </select>
                </div>
                <label>DPI</label>
                <input type="number" id="pdf-dpi" value="150" min="72" max="600" step="1">
            </div>
            <div class="action-bar">
                <button class="btn-primary" onclick="startImageToPdf()">开始转换</button>
            </div>
            <div class="progress-area hidden" id="progress-img2pdf">
                <div class="progress-bar"><div class="progress-fill" id="progress-fill-img2pdf"></div></div>
                <p class="progress-text" id="progress-text-img2pdf"></p>
            </div>
        </div>
    </div>

    <!-- Page Manager view -->
    <div id="view-page-manager" class="view">
        <div class="page-container">
            <div class="drop-zone" id="drop-pagemgr"
                 ondragover="handleDragOver(event)" ondrop="handleDrop(event, 'pdf-single')" onclick="selectFiles('pagemgr', ['pdf'])">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p>拖拽单个PDF文件到此处</p>
            </div>
            <div class="page-thumbnails" id="page-thumbnails"></div>
            <div class="settings-group">
                <label>删除页面（输入页码范围，如 1-3,5）</label>
                <input type="text" id="delete-page-range" placeholder="1-3,5">
                <button class="btn-secondary" onclick="deletePageRange()">删除指定页</button>
            </div>
            <div class="action-bar">
                <button class="btn-primary" onclick="savePageManager()">保存PDF</button>
            </div>
        </div>
    </div>

    <!-- Merge PDF view -->
    <div id="view-merge-pdf" class="view">
        <div class="page-container">
            <div class="drop-zone" id="drop-merge"
                 ondragover="handleDragOver(event)" ondrop="handleDrop(event, 'pdf')" onclick="selectFiles('merge', ['pdf'])">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p>拖拽多个PDF文件到此处，或点击选择</p>
            </div>
            <div class="file-list sortable" id="file-list-merge"></div>
            <div class="settings-group" id="merge-mode-group" style="display:none">
                <label>页面尺寸不一致，请选择合并模式</label>
                <select id="merge-mode">
                    <option value="original">原始大小拼接</option>
                    <option value="fit-a4">统一缩放到A4</option>
                </select>
                <div id="merge-a4-options" class="settings-sub hidden">
                    <label>A4方向</label>
                    <select id="merge-a4-orientation">
                        <option value="auto">自动</option>
                        <option value="portrait">纵向</option>
                        <option value="landscape">横向</option>
                    </select>
                </div>
            </div>
            <div class="action-bar">
                <button class="btn-primary" onclick="startMergePdf()">开始合并</button>
            </div>
        </div>
    </div>

    <!-- Password modal -->
    <div id="password-modal" class="modal hidden">
        <div class="modal-content">
            <h3>PDF已加密</h3>
            <p>请输入密码以解锁文件</p>
            <input type="password" id="pdf-password" placeholder="输入密码">
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closePasswordModal()">取消</button>
                <button class="btn-primary" onclick="submitPassword()">解锁</button>
            </div>
        </div>
    </div>

    <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create ui/css/style.css**

```css
:root {
    --primary: #4A90D9;
    --primary-hover: #3A7BC8;
    --accent: #F5A623;
    --bg: #F7F8FA;
    --surface: #FFFFFF;
    --text: #2C3E50;
    --text-secondary: #7F8C8D;
    --border: #E1E4E8;
    --shadow: 0 2px 12px rgba(0,0,0,0.08);
    --shadow-hover: 0 4px 20px rgba(0,0,0,0.12);
    --radius: 12px;
    --radius-sm: 8px;
    --transition: 0.2s ease;
    --danger: #E74C3C;
    --success: #27AE60;
}

[data-theme="dark"] {
    --primary: #5BA0E8;
    --primary-hover: #4A90D9;
    --accent: #F5B84D;
    --bg: #1A1A2E;
    --surface: #16213E;
    --text: #E4E6EB;
    --text-secondary: #A0A3A8;
    --border: #2C3E50;
    --shadow: 0 2px 12px rgba(0,0,0,0.3);
    --shadow-hover: 0 4px 20px rgba(0,0,0,0.4);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    transition: background var(--transition), color var(--transition);
    user-select: none;
}

/* --- Navbar --- */
#navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
}

.nav-title { font-size: 18px; font-weight: 700; color: var(--primary); }

.nav-btn {
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    transition: background var(--transition);
}
.nav-btn:hover { background: var(--border); }

/* --- Views --- */
.view { display: none; padding: 24px; max-width: 1000px; margin: 0 auto; }
.view.active { display: block; }

.hidden { display: none !important; }

/* --- Home --- */
.card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-top: 40px;
}

.feature-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 32px 24px;
    text-align: center;
    cursor: pointer;
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
    box-shadow: var(--shadow);
}
.feature-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-hover);
    border-color: var(--primary);
}

.card-icon { margin-bottom: 16px; }
.feature-card h3 { font-size: 16px; margin-bottom: 8px; color: var(--text); }
.feature-card p { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

.home-footer {
    text-align: center;
    margin-top: 60px;
    font-size: 12px;
    color: var(--text-secondary);
}

/* --- Page container --- */
.page-container { max-width: 800px; margin: 0 auto; }

/* --- Drop zone --- */
.drop-zone {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    padding: 48px 24px;
    text-align: center;
    cursor: pointer;
    transition: border-color var(--transition), background var(--transition);
    background: var(--surface);
}
.drop-zone:hover, .drop-zone.drag-over {
    border-color: var(--primary);
    background: rgba(74,144,217,0.05);
}
.drop-zone svg { margin-bottom: 12px; }
.drop-zone p { color: var(--text-secondary); font-size: 14px; }

/* --- File list --- */
.file-list {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
}
.file-item .file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-item .file-size { color: var(--text-secondary); margin: 0 12px; font-size: 12px; }
.file-item .btn-remove {
    background: none; border: none; color: var(--danger); cursor: pointer;
    font-size: 18px; padding: 0 4px; line-height: 1;
}
.file-item .btn-remove:hover { opacity: 0.7; }

.file-item.dragging { opacity: 0.5; }

/* --- Settings --- */
.settings-group {
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
}
.settings-group label { font-size: 13px; font-weight: 600; white-space: nowrap; }
.settings-group select, .settings-group input[type="number"], .settings-group input[type="text"] {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    min-width: 80px;
}
.settings-sub {
    display: flex; align-items: center; gap: 8px;
}

/* --- Buttons --- */
.btn-primary {
    background: var(--primary);
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--transition), transform var(--transition);
}
.btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.btn-secondary {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
    transition: background var(--transition);
}
.btn-secondary:hover { background: var(--border); }

/* --- Action bar --- */
.action-bar { margin-top: 24px; text-align: center; }

/* --- Progress --- */
.progress-area { margin-top: 16px; }
.progress-bar {
    width: 100%;
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
}
.progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 4px;
    width: 0%;
    transition: width 0.3s ease;
}
.progress-text { font-size: 13px; color: var(--text-secondary); margin-top: 8px; text-align: center; }

/* --- Page thumbnails (page manager) --- */
.page-thumbnails {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
    margin-top: 16px;
}
.thumb-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    position: relative;
    cursor: grab;
    transition: box-shadow var(--transition);
}
.thumb-card:hover { box-shadow: var(--shadow-hover); }
.thumb-card.dragging { opacity: 0.5; }
.thumb-card img {
    width: 100%;
    height: 180px;
    object-fit: contain;
    background: #fff;
}
.thumb-card .thumb-label {
    text-align: center;
    padding: 6px;
    font-size: 12px;
    color: var(--text-secondary);
}
.thumb-card .thumb-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 4px;
}
.thumb-btn {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: rgba(0,0,0,0.5);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.thumb-btn:hover { background: rgba(0,0,0,0.7); }
.thumb-btn.delete { background: rgba(231,76,60,0.8); }
.thumb-btn.delete:hover { background: rgba(231,76,60,1); }

/* --- Modal --- */
.modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
}
.modal-content {
    background: var(--surface);
    border-radius: var(--radius);
    padding: 32px;
    min-width: 360px;
    text-align: center;
}
.modal-content h3 { margin-bottom: 8px; }
.modal-content p { font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; }
.modal-content input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    margin-bottom: 16px;
    background: var(--bg);
    color: var(--text);
}
.modal-actions { display: flex; gap: 12px; justify-content: center; }
```

- [ ] **Step 3: Create ui/js/app.js**

```javascript
// ===== State =====
const state = {
    currentView: 'home',
    files: {
        pdf2word: [],
        pdf2img: [],
        img2pdf: [],
        pagemgr: [],
        merge: [],
    },
    pageOrder: [],       // for page manager: ordered page indices
    pageRotations: {},   // page_index -> rotation degrees
    passwordCallback: null,
};

// ===== Navigation =====
function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + viewId);
    if (view) view.classList.add('active');

    const backBtn = document.getElementById('btn-back');
    const title = document.getElementById('nav-title');
    if (viewId === 'home') {
        backBtn.classList.add('hidden');
        title.textContent = 'PDF全能工具箱';
    } else {
        backBtn.classList.remove('hidden');
        title.textContent = document.querySelector(`.feature-card[onclick="navigateTo('${viewId}')"] h3`)?.textContent || 'PDF全能工具箱';
    }
    state.currentView = viewId;
}

// ===== Theme =====
function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}
// Load saved theme
(function() {
    const saved = localStorage.getItem('theme');
    if (saved) document.body.setAttribute('data-theme', saved);
})();

// ===== File Selection =====
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

async function selectFiles(key, extensions) {
    if (!window.pywebview) return;
    try {
        const files = await pywebview.api.select_files(extensions);
        if (files && files.length > 0) {
            addFiles(key, files);
        }
    } catch (err) {
        console.error('File selection error:', err);
    }
}

function handleDrop(e, fileType) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    // PyWebView file drop handling: get paths from event
    const files = [];
    if (e.dataTransfer.files) {
        for (let f of e.dataTransfer.files) {
            files.push(f.path || f.name);
        }
    }
    if (files.length > 0) {
        // Determine which key based on drop zone id
        const dropId = e.currentTarget.id;
        const keyMap = {
            'drop-pdf2word': 'pdf2word',
            'drop-pdf2img': 'pdf2img',
            'drop-img2pdf': 'img2pdf',
            'drop-pagemgr': 'pagemgr',
            'drop-merge': 'merge',
        };
        const key = keyMap[dropId];
        if (key) addFiles(key, files);
    }
}

function addFiles(key, filePaths) {
    for (const fp of filePaths) {
        if (!state.files[key].find(f => f.path === fp)) {
            state.files[key].push({ path: fp, name: fp.split(/[\\/]/).pop() });
        }
    }
    renderFileList(key);

    // Special: page manager — load thumbnails
    if (key === 'pagemgr' && state.files.pagemgr.length > 0) {
        loadPageThumbnails();
    }
    // Special: merge — check page size consistency
    if (key === 'merge') {
        checkMergePageSizes();
    }
    // Special: img2pdf — update base image selector
    if (key === 'img2pdf') {
        updateBaseImageSelector();
    }
}

function removeFile(key, index) {
    state.files[key].splice(index, 1);
    renderFileList(key);
    if (key === 'img2pdf') updateBaseImageSelector();
    if (key === 'merge') checkMergePageSizes();
}

function renderFileList(key) {
    const container = document.getElementById('file-list-' + key);
    if (!container) return;
    container.innerHTML = '';
    state.files[key].forEach((f, i) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.draggable = container.classList.contains('sortable');
        div.innerHTML = `
            <span class="file-name">${f.name}</span>
            <button class="btn-remove" onclick="removeFile('${key}', ${i})">×</button>
        `;
        // Drag reorder for sortable lists
        if (div.draggable) {
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', i);
                div.classList.add('dragging');
            });
            div.addEventListener('dragend', () => div.classList.remove('dragging'));
            div.addEventListener('dragover', (e) => e.preventDefault());
            div.addEventListener('drop', (e) => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData('text/plain'));
                const to = i;
                if (from !== to) {
                    const item = state.files[key].splice(from, 1)[0];
                    state.files[key].splice(to, 0, item);
                    renderFileList(key);
                }
            });
        }
        container.appendChild(div);
    });
}

// ===== Image-to-PDF: page mode toggle =====
function onPageModeChange() {
    const mode = document.getElementById('pdf-page-mode').value;
    document.getElementById('a4-options').classList.toggle('hidden', mode !== 'a4');
    document.getElementById('original-options').classList.toggle('hidden', mode !== 'original');
}

function updateBaseImageSelector() {
    const sel = document.getElementById('base-image-index');
    sel.innerHTML = '';
    state.files.img2pdf.forEach((f, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `第${i + 1}张 - ${f.name}`;
        sel.appendChild(opt);
    });
}

// ===== Merge: check page sizes =====
async function checkMergePageSizes() {
    const group = document.getElementById('merge-mode-group');
    if (state.files.merge.length < 2) {
        group.style.display = 'none';
        return;
    }
    if (!window.pywebview) { group.style.display = 'flex'; return; }
    try {
        const result = await pywebview.api.check_merge_page_sizes(
            state.files.merge.map(f => f.path)
        );
        group.style.display = result.uniform ? 'none' : 'flex';
    } catch (e) {
        group.style.display = 'flex';
    }
}

document.getElementById('merge-mode').addEventListener('change', function() {
    document.getElementById('merge-a4-options').classList.toggle('hidden', this.value !== 'fit-a4');
});

// ===== Page Manager =====
async function loadPageThumbnails() {
    if (state.files.pagemgr.length === 0) return;
    const container = document.getElementById('page-thumbnails');
    container.innerHTML = '<p>加载中...</p>';
    try {
        const result = await pywebview.api.get_pdf_page_thumbnails({
            file_path: state.files.pagemgr[0].path
        });
        if (result.success) {
            state.pageOrder = result.page_order;
            state.pageRotations = result.rotations || {};
            renderThumbnails(result.thumbnails);
        } else {
            container.innerHTML = `<p style="color:var(--danger)">${result.error}</p>`;
        }
    } catch (e) {
        container.innerHTML = '<p style="color:var(--danger)">加载失败</p>';
    }
}

function renderThumbnails(thumbnails) {
    const container = document.getElementById('page-thumbnails');
    container.innerHTML = '';
    state.pageOrder.forEach((pageIndex, displayIndex) => {
        const div = document.createElement('div');
        div.className = 'thumb-card';
        div.draggable = true;
        div.dataset.index = displayIndex;
        const rotation = state.pageRotations[pageIndex] || 0;
        div.innerHTML = `
            <img src="${thumbnails[pageIndex]}" alt="第${pageIndex + 1}页" style="transform:rotate(${rotation}deg)">
            <div class="thumb-label">第${pageIndex + 1}页${rotation ? ` (${rotation}°)` : ''}</div>
            <div class="thumb-actions">
                <button class="thumb-btn" onclick="rotatePage(${pageIndex})" title="旋转90°">↻</button>
                <button class="thumb-btn delete" onclick="deleteSinglePage(${displayIndex})" title="删除">×</button>
            </div>
        `;
        // Drag reorder
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', displayIndex);
            div.classList.add('dragging');
        });
        div.addEventListener('dragend', () => div.classList.remove('dragging'));
        div.addEventListener('dragover', (e) => e.preventDefault());
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData('text/plain'));
            const to = displayIndex;
            if (from !== to) {
                const item = state.pageOrder.splice(from, 1)[0];
                state.pageOrder.splice(to, 0, item);
                renderThumbnails(thumbnails);
            }
        });
        container.appendChild(div);
    });
}

async function rotatePage(pageIndex) {
    const current = state.pageRotations[pageIndex] || 0;
    state.pageRotations[pageIndex] = (current + 90) % 360;
    loadPageThumbnails();
}

function deleteSinglePage(displayIndex) {
    state.pageOrder.splice(displayIndex, 1);
    loadPageThumbnails();
}

function deletePageRange() {
    const rangeStr = document.getElementById('delete-page-range').value.trim();
    if (!rangeStr) return;
    const indices = parsePageRange(rangeStr);
    // Sort descending to remove from end first
    const toRemove = indices.filter(i => i >= 0 && i < state.pageOrder.length).sort((a, b) => b - a);
    for (const i of toRemove) {
        state.pageOrder.splice(i, 1);
    }
    document.getElementById('delete-page-range').value = '';
    loadPageThumbnails();
}

function parsePageRange(str) {
    const indices = [];
    for (const part of str.split(',')) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const [start, end] = trimmed.split('-').map(Number);
            for (let i = start; i <= end; i++) indices.push(i - 1); // 1-based to 0-based
        } else {
            indices.push(Number(trimmed) - 1);
        }
    }
    return indices;
}

// ===== Password Modal =====
function showPasswordModal(callback) {
    document.getElementById('password-modal').classList.remove('hidden');
    document.getElementById('pdf-password').value = '';
    document.getElementById('pdf-password').focus();
    state.passwordCallback = callback;
}

function closePasswordModal() {
    document.getElementById('password-modal').classList.add('hidden');
    state.passwordCallback = null;
}

function submitPassword() {
    const pwd = document.getElementById('pdf-password').value;
    if (state.passwordCallback) state.passwordCallback(pwd);
    closePasswordModal();
}

// ===== Feature Actions (stubs — implemented with backend in later tasks) =====

async function startPdfToWord() {
    if (state.files.pdf2word.length === 0) return alert('请先选择PDF文件');
    const progress = document.getElementById('progress-pdf2word');
    progress.classList.remove('hidden');
    setProgress('pdf2word', 0, '正在转换...');
    try {
        const result = await pywebview.api.pdf_to_word({
            files: state.files.pdf2word.map(f => f.path),
        });
        if (result.success) {
            setProgress('pdf2word', 100, '转换完成！');
        } else if (result.need_password) {
            showPasswordModal(async (pwd) => {
                const r2 = await pywebview.api.pdf_to_word({
                    files: state.files.pdf2word.map(f => f.path),
                    password: pwd,
                });
                setProgress('pdf2word', r2.success ? 100 : 0, r2.success ? '转换完成！' : r2.error);
            });
        } else {
            setProgress('pdf2word', 0, '错误：' + result.error);
        }
    } catch (e) {
        setProgress('pdf2word', 0, '错误：' + e.message);
    }
}

async function startPdfToImage() {
    if (state.files.pdf2img.length === 0) return alert('请先选择PDF文件');
    const format = document.getElementById('img-format').value;
    const dpi = parseInt(document.getElementById('img-dpi').value) || 150;
    const progress = document.getElementById('progress-pdf2img');
    progress.classList.remove('hidden');
    setProgress('pdf2img', 0, '正在转换...');
    try {
        const result = await pywebview.api.pdf_to_image({
            files: state.files.pdf2img.map(f => f.path),
            format: format,
            dpi: dpi,
        });
        setProgress('pdf2img', result.success ? 100 : 0, result.success ? '转换完成！' : result.error);
    } catch (e) {
        setProgress('pdf2img', 0, '错误：' + e.message);
    }
}

async function startImageToPdf() {
    if (state.files.img2pdf.length === 0) return alert('请先选择图片文件');
    const mode = document.getElementById('pdf-page-mode').value;
    const orientation = document.getElementById('a4-orientation')?.value || 'auto';
    const baseIndex = parseInt(document.getElementById('base-image-index')?.value || '0');
    const dpi = parseInt(document.getElementById('pdf-dpi').value) || 150;
    const progress = document.getElementById('progress-img2pdf');
    progress.classList.remove('hidden');
    setProgress('img2pdf', 0, '正在转换...');
    try {
        const result = await pywebview.api.image_to_pdf({
            files: state.files.img2pdf.map(f => f.path),
            page_mode: mode,
            a4_orientation: orientation,
            base_image_index: baseIndex,
            dpi: dpi,
        });
        setProgress('img2pdf', result.success ? 100 : 0, result.success ? '转换完成！' : result.error);
    } catch (e) {
        setProgress('img2pdf', 0, '错误：' + e.message);
    }
}

async function savePageManager() {
    if (state.pageOrder.length === 0) return alert('请先加载PDF文件');
    try {
        const result = await pywebview.api.reorder_pages({
            file_path: state.files.pagemgr[0].path,
            page_order: state.pageOrder,
            rotations: state.pageRotations,
        });
        if (result.success) {
            alert('保存成功：' + result.output_path);
        } else {
            alert('保存失败：' + result.error);
        }
    } catch (e) {
        alert('错误：' + e.message);
    }
}

async function startMergePdf() {
    if (state.files.merge.length < 2) return alert('请至少选择2个PDF文件');
    const mode = document.getElementById('merge-mode').value;
    const orientation = document.getElementById('merge-a4-orientation')?.value || 'auto';
    try {
        const result = await pywebview.api.merge_pdfs({
            files: state.files.merge.map(f => f.path),
            merge_mode: mode,
            a4_orientation: orientation,
        });
        if (result.success) {
            alert('合并成功：' + result.output_path);
        } else {
            alert('合并失败：' + result.error);
        }
    } catch (e) {
        alert('错误：' + e.message);
    }
}

// ===== Progress helpers =====
function setProgress(key, percent, text) {
    const fill = document.getElementById('progress-fill-' + key);
    const txt = document.getElementById('progress-text-' + key);
    if (fill) fill.style.width = percent + '%';
    if (txt) txt.textContent = text;
}

// ===== Init =====
window.addEventListener('pywebviewready', () => {
    console.log('PyWebView API ready');
});
```

- [ ] **Step 4: Test the app launches**

Run: `cd /home/mi/claude_czy/czy_pdf2word && python main.py`
Expected: Window opens with home page showing 5 feature cards, theme toggle works, clicking cards navigates to feature views

- [ ] **Step 5: Commit**

```bash
git add ui/index.html ui/css/style.css ui/js/app.js
git commit -m "feat: frontend shell with home page, routing, theme, and all view templates"
```

---

### Task 3: Core — PDF Engine (pdf_engine.py)

**Files:**
- Create: `core/pdf_engine.py`

This module wraps PyMuPDF for all PDF operations. It is the single source of truth for PDF reading, rendering, merging, page manipulation, and encryption handling.

- [ ] **Step 1: Create core/pdf_engine.py**

```python
import fitz  # PyMuPDF
import os
import base64
from utils.file_utils import get_output_path


class PdfEngine:
    """Core PDF operations using PyMuPDF."""

    @staticmethod
    def open_pdf(file_path, password=None):
        """Open a PDF, handling encryption. Returns (doc, needs_password, error)."""
        try:
            doc = fitz.open(file_path)
        except Exception as e:
            return None, False, str(e)

        if doc.is_encrypted:
            if password:
                if not doc.authenticate(password):
                    doc.close()
                    return None, True, "密码错误"
            else:
                doc.close()
                return None, True, "需要密码"

        return doc, False, None

    @staticmethod
    def get_page_count(file_path, password=None):
        doc, needs_pw, err = PdfEngine.open_pdf(file_path, password)
        if err:
            return 0, needs_pw, err
        count = doc.page_count
        doc.close()
        return count, False, None

    @staticmethod
    def render_page_to_image(file_path, page_index, dpi=150, fmt='png', password=None):
        """Render a single PDF page to image bytes."""
        doc, needs_pw, err = PdfEngine.open_pdf(file_path, password)
        if err:
            return None, needs_pw, err

        page = doc[page_index]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)

        if fmt == 'jpg':
            img_bytes = pix.tobytes('jpeg')
        else:
            img_bytes = pix.tobytes('png')

        doc.close()
        return img_bytes, False, None

    @staticmethod
    def render_page_thumbnail_base64(file_path, page_index, password=None, thumb_dpi=30):
        """Render a page as a small base64 PNG for thumbnail display."""
        doc, needs_pw, err = PdfEngine.open_pdf(file_path, password)
        if err:
            return None, needs_pw, err

        page = doc[page_index]
        zoom = thumb_dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        b64 = base64.b64encode(pix.tobytes('png')).decode('ascii')
        doc.close()
        return f'data:image/png;base64,{b64}', False, None

    @staticmethod
    def pdf_to_images(file_path, output_dir=None, dpi=150, fmt='png', password=None):
        """Convert all pages of a PDF to images. Returns list of output paths."""
        doc, needs_pw, err = PdfEngine.open_pdf(file_path, password)
        if err:
            return [], needs_pw, err

        output_paths = []
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        ext = 'jpg' if fmt == 'jpg' else 'png'

        for i in range(doc.page_count):
            page = doc[i]
            pix = page.get_pixmap(matrix=mat)
            out_path = get_output_path(file_path, f'_page{i+1}.{ext}', output_dir)
            pix.save(out_path)
            output_paths.append(out_path)

        doc.close()
        return output_paths, False, None

    @staticmethod
    def extract_text_and_images(file_path, password=None):
        """Extract text blocks and images from each page. Returns list of page dicts."""
        doc, needs_pw, err = PdfEngine.open_pdf(file_path, password)
        if err:
            return [], needs_pw, err

        pages = []
        for i in range(doc.page_count):
            page = doc[i]
            text = page.get_text('text')
            images = []
            img_list = page.get_images(full=True)
            for img_info in img_list:
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                if base_image:
                    images.append({
                        'bytes': base_image['image'],
                        'ext': base_image['ext'],
                        'width': base_image['width'],
                        'height': base_image['height'],
                    })
            pages.append({'text': text, 'images': images, 'page_num': i + 1})

        doc.close()
        return pages, False, None

    @staticmethod
    def is_page_scanned(text_content, min_chars=20):
        """Detect if a page is likely scanned (very little extractable text)."""
        return len(text_content.strip()) < min_chars

    @staticmethod
    def reorder_and_save(file_path, page_order, rotations=None, output_path=None, password=None):
        """Reorder, rotate pages, and save. page_order is list of 0-based original page indices.
        rotations is dict of page_index -> degrees (90, 180, 270)."""
        doc, needs_pw, err = PdfEngine.open_pdf(file_path, password)
        if err:
            return None, needs_pw, err

        new_doc = fitz.open()
        for idx in page_order:
            new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
        doc.close()

        # Apply rotations
        if rotations:
            for i, orig_idx in enumerate(page_order):
                rot = rotations.get(orig_idx, 0)
                if rot:
                    new_doc[i].set_rotation(rot)

        if not output_path:
            output_path = get_output_path(file_path, '_edited.pdf')
        new_doc.save(output_path)
        new_doc.close()
        return output_path, False, None

    @staticmethod
    def merge_pdfs(file_paths, merge_mode='original', a4_orientation='auto',
                   output_path=None, password=None):
        """Merge multiple PDFs.
        merge_mode: 'original' (keep sizes) or 'fit-a4' (scale to A4).
        a4_orientation: 'portrait', 'landscape', or 'auto'.
        """
        merged = fitz.open()

        A4_W, A4_H = 595.28, 841.89  # A4 in points

        for fpath in file_paths:
            doc, needs_pw, err = PdfEngine.open_pdf(fpath, password)
            if err:
                merged.close()
                return None, needs_pw, err

            if merge_mode == 'fit-a4':
                for i in range(doc.page_count):
                    page = doc[i]
                    pw, ph = page.rect.width, page.rect.height

                    # Determine A4 orientation
                    if a4_orientation == 'landscape':
                        aw, ah = A4_H, A4_W
                    elif a4_orientation == 'portrait':
                        aw, ah = A4_W, A4_H
                    else:  # auto
                        aw, ah = (A4_H, A4_W) if pw > ph else (A4_W, A4_H)

                    new_page = merged.new_page(width=aw, height=ah)
                    # Scale page to fit within A4, centered
                    scale = min(aw / pw, ah / ph)
                    x = (aw - pw * scale) / 2
                    y = (ah - ph * scale) / 2
                    rect = fitz.Rect(x, y, x + pw * scale, y + ph * scale)
                    new_page.show_pdf_page(rect, doc, i)
            else:
                merged.insert_pdf(doc)

            doc.close()

        if not output_path:
            output_path = get_output_path(file_paths[0], '_merged.pdf')
        merged.save(output_path)
        merged.close()
        return output_path, False, None

    @staticmethod
    def check_page_sizes_uniform(file_paths):
        """Check if all pages across PDFs have the same size. Returns (uniform, sizes)."""
        sizes = set()
        for fpath in file_paths:
            doc, needs_pw, err = PdfEngine.open_pdf(fpath)
            if err:
                continue
            for i in range(doc.page_count):
                page = doc[i]
                sizes.add((round(page.rect.width, 1), round(page.rect.height, 1)))
            doc.close()
        return len(sizes) <= 1, list(sizes)

    @staticmethod
    def get_page_sizes(file_path, password=None):
        """Get width, height (in points) for each page."""
        doc, needs_pw, err = PdfEngine.open_pdf(file_path, password)
        if err:
            return [], needs_pw, err
        sizes = [(doc[i].rect.width, doc[i].rect.height) for i in range(doc.page_count)]
        doc.close()
        return sizes, False, None
```

- [ ] **Step 2: Commit**

```bash
git add core/pdf_engine.py
git commit -m "feat: PDF engine with render, extract, merge, reorder, and encryption support"
```

---

### Task 4: Core — Image Engine (image_engine.py)

**Files:**
- Create: `core/image_engine.py`

- [ ] **Step 1: Create core/image_engine.py**

```python
import fitz  # PyMuPDF
from PIL import Image
import os
from utils.file_utils import get_output_path


class ImageEngine:
    """Image-to-PDF and image processing operations."""

    A4_WIDTH = 595.28   # A4 width in points (72 pts/inch)
    A4_HEIGHT = 841.89  # A4 height in points

    @staticmethod
    def images_to_pdf(image_paths, output_path=None, page_mode='original',
                      a4_orientation='auto', base_image_index=0, dpi=150):
        """Convert a list of images to a single PDF.

        page_mode: 'original' (page size = image aspect ratio) or 'a4'
        a4_orientation: 'portrait', 'landscape', 'auto'
        base_image_index: which image to use as size reference in 'original' mode
        dpi: DPI for determining page size from image pixels
        """
        if not image_paths:
            return None, "没有选择图片"

        doc = fitz.open()

        # Load all images and get dimensions
        pil_images = []
        for path in image_paths:
            img = Image.open(path)
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            elif img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            pil_images.append(img)

        # Determine reference dimensions for 'original' mode
        if page_mode == 'original' and base_image_index < len(pil_images):
            ref_img = pil_images[base_image_index]
            ref_w, ref_h = ref_img.size
            # Convert pixels to points at given DPI
            ref_pw = ref_w * 72.0 / dpi
            ref_ph = ref_h * 72.0 / dpi
        else:
            ref_pw, ref_ph = ImageEngine.A4_WIDTH, ImageEngine.A4_HEIGHT

        for img in pil_images:
            iw, ih = img.size
            img_pw = iw * 72.0 / dpi
            img_ph = ih * 72.0 / dpi

            if page_mode == 'a4':
                # Determine A4 orientation
                if a4_orientation == 'landscape':
                    page_w, page_h = ImageEngine.A4_HEIGHT, ImageEngine.A4_WIDTH
                elif a4_orientation == 'portrait':
                    page_w, page_h = ImageEngine.A4_WIDTH, ImageEngine.A4_HEIGHT
                else:  # auto
                    page_w, page_h = (ImageEngine.A4_HEIGHT, ImageEngine.A4_WIDTH) if iw > ih else (ImageEngine.A4_WIDTH, ImageEngine.A4_HEIGHT)

                page = doc.new_page(width=page_w, height=page_h)
                # Scale image to fit, centered
                scale = min(page_w / img_pw, page_h / img_ph)
                disp_w = img_pw * scale
                disp_h = img_ph * scale
                x = (page_w - disp_w) / 2
                y = (page_h - disp_h) / 2
                rect = fitz.Rect(x, y, x + disp_w, y + disp_h)
            else:
                # Original ratio mode: use reference page size
                page_w, page_h = ref_pw, ref_ph
                page = doc.new_page(width=page_w, height=page_h)
                # Scale image to fit reference, centered, keeping aspect ratio
                scale = min(page_w / img_pw, page_h / img_ph)
                disp_w = img_pw * scale
                disp_h = img_ph * scale
                x = (page_w - disp_w) / 2
                y = (page_h - disp_h) / 2
                rect = fitz.Rect(x, y, x + disp_w, y + disp_h)

            # Insert image: save to temp, insert from file (PyMuPDF requirement)
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                img.save(tmp, format='PNG')
                tmp_path = tmp.name

            page.insert_image(rect, filename=tmp_path)
            os.unlink(tmp_path)

        if not output_path:
            output_path = get_output_path(image_paths[0], '.pdf')
        doc.save(output_path)
        doc.close()
        return output_path, None
```

- [ ] **Step 2: Commit**

```bash
git add core/image_engine.py
git commit -m "feat: image engine with A4/original page modes and DPI control"
```

---

### Task 5: Core — Word Engine (word_engine.py)

**Files:**
- Create: `core/word_engine.py`

- [ ] **Step 1: Create core/word_engine.py**

```python
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os
import tempfile
from utils.file_utils import get_output_path


class WordEngine:
    """Generate Word documents from extracted PDF content."""

    @staticmethod
    def create_from_pages(pages, output_path=None, input_path=None, ocr_texts=None):
        """Create a Word document from extracted page data.

        pages: list of dicts with 'text', 'images', 'page_num' from PdfEngine.extract_text_and_images
        ocr_texts: optional dict mapping page_num -> OCR text (for scanned pages)
        """
        doc = Document()

        for i, page in enumerate(pages):
            page_num = page['page_num']
            text = page['text']

            # Use OCR text if available and original text is empty
            if (not text or len(text.strip()) < 20) and ocr_texts and page_num in ocr_texts:
                text = ocr_texts[page_num]

            # Add text content
            if text and text.strip():
                paragraphs = text.split('\n')
                for para_text in paragraphs:
                    if para_text.strip():
                        p = doc.add_paragraph(para_text.strip())

            # Add images
            for img_data in page.get('images', []):
                try:
                    ext = img_data['ext']
                    img_bytes = img_data['bytes']
                    with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as tmp:
                        tmp.write(img_bytes)
                        tmp_path = tmp.name
                    # Add image with reasonable max width
                    doc.add_picture(tmp_path, width=Inches(5.5))
                    os.unlink(tmp_path)
                except Exception:
                    pass

            # Add page break between pages (not after last)
            if i < len(pages) - 1:
                doc.add_page_break()

        if not output_path:
            output_path = get_output_path(input_path or 'output', '.docx')
        doc.save(output_path)
        return output_path
```

- [ ] **Step 2: Commit**

```bash
git add core/word_engine.py
git commit -m "feat: Word engine for generating docx from extracted PDF content"
```

---

### Task 6: Core — OCR Engine (ocr_engine.py)

**Files:**
- Create: `core/ocr_engine.py`

- [ ] **Step 1: Create core/ocr_engine.py**

```python
import pytesseract
from PIL import Image
import fitz
import tempfile
import os
from utils.config import get_tesseract_cmd, get_tessdata_prefix


class OcrEngine:
    """Tesseract OCR wrapper for scanned PDF pages."""

    _available = None

    @staticmethod
    def is_available():
        """Check if Tesseract is available."""
        if OcrEngine._available is not None:
            return OcrEngine._available
        try:
            cmd = get_tesseract_cmd()
            pytesseract.pytesseract.tesseract_cmd = cmd
            if get_tessdata_prefix():
                os.environ['TESSDATA_PREFIX'] = get_tessdata_prefix()
            pytesseract.get_tesseract_version()
            OcrEngine._available = True
        except Exception:
            OcrEngine._available = False
        return OcrEngine._available

    @staticmethod
    def ocr_image(image_path_or_pil, lang='chi_sim+eng'):
        """Run OCR on an image. Accepts file path or PIL Image. Returns extracted text."""
        if not OcrEngine.is_available():
            return ''

        cmd = get_tesseract_cmd()
        pytesseract.pytesseract.tesseract_cmd = cmd
        if get_tessdata_prefix():
            os.environ['TESSDATA_PREFIX'] = get_tessdata_prefix()

        if isinstance(image_path_or_pil, str):
            img = Image.open(image_path_or_pil)
        else:
            img = image_path_or_pil

        try:
            text = pytesseract.image_to_string(img, lang=lang)
            return text.strip()
        except Exception:
            return ''

    @staticmethod
    def ocr_pdf_page(file_path, page_index, dpi=200, password=None, lang='chi_sim+eng'):
        """Render a PDF page and run OCR on it."""
        doc, needs_pw, err = fitz.open(file_path), False, None
        try:
            doc = fitz.open(file_path)
        except Exception as e:
            return '', True, str(e)

        if doc.is_encrypted:
            if password:
                if not doc.authenticate(password):
                    doc.close()
                    return '', True, "密码错误"
            else:
                doc.close()
                return '', True, "需要密码"

        page = doc[page_index]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)

        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            pix.save(tmp)
            tmp_path = tmp.name

        doc.close()

        text = OcrEngine.ocr_image(tmp_path, lang=lang)
        os.unlink(tmp_path)
        return text, False, None
```

- [ ] **Step 2: Commit**

```bash
git add core/ocr_engine.py
git commit -m "feat: OCR engine with Tesseract integration for scanned PDF pages"
```

---

### Task 7: API Bridge — Wire All Backend Functions

**Files:**
- Modify: `api.py`

Replace the stub methods in api.py with real implementations that delegate to core modules.

- [ ] **Step 1: Rewrite api.py with full implementations**

```python
import webview
from core.pdf_engine import PdfEngine
from core.image_engine import ImageEngine
from core.word_engine import WordEngine
from core.ocr_engine import OcrEngine
from utils.file_utils import get_output_path, ensure_output_dir


class Api:
    """PyWebView API bridge. All methods callable from JS via pywebview.api.*."""

    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    # --- File dialogs ---

    def select_files(self, file_types):
        if not self._window:
            return []
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=(f'Files ({" ".join(f"*.{ft}" for ft in file_types)})',)
        )
        return list(result) if result else []

    def select_folder(self):
        if not self._window:
            return ''
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        return result[0] if result else ''

    def save_file(self, default_name, file_types):
        if not self._window:
            return ''
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=(f'Files ({" ".join(f"*.{ft}" for ft in file_types)})',)
        )
        return result if result else ''

    # --- PDF to Word ---

    def pdf_to_word(self, params):
        """params: {files: [str], password: str|null, output_dir: str|null}"""
        files = params.get('files', [])
        password = params.get('password')
        output_dir = params.get('output_dir')

        results = []
        for fpath in files:
            pages, needs_pw, err = PdfEngine.extract_text_and_images(fpath, password)
            if needs_pw:
                return {'success': False, 'need_password': True, 'error': err}

            # Check for scanned pages and OCR them
            ocr_texts = {}
            if OcrEngine.is_available():
                for page in pages:
                    if PdfEngine.is_page_scanned(page['text']):
                        text, _, _ = OcrEngine.ocr_pdf_page(fpath, page['page_num'] - 1, password=password)
                        if text:
                            ocr_texts[page['page_num']] = text

            try:
                out = WordEngine.create_from_pages(pages, input_path=fpath, output_dir=output_dir, ocr_texts=ocr_texts)
                results.append(out)
            except Exception as e:
                return {'success': False, 'error': str(e)}

        return {'success': True, 'output_paths': results}

    # --- PDF to Image ---

    def pdf_to_image(self, params):
        """params: {files: [str], format: str, dpi: int, password: str|null, output_dir: str|null}"""
        files = params.get('files', [])
        fmt = params.get('format', 'png')
        dpi = params.get('dpi', 150)
        password = params.get('password')
        output_dir = params.get('output_dir')

        all_outputs = []
        for fpath in files:
            paths, needs_pw, err = PdfEngine.pdf_to_images(fpath, output_dir, dpi, fmt, password)
            if needs_pw:
                return {'success': False, 'need_password': True, 'error': err}
            if err:
                return {'success': False, 'error': err}
            all_outputs.extend(paths)

        return {'success': True, 'output_paths': all_outputs}

    # --- Image to PDF ---

    def image_to_pdf(self, params):
        """params: {files: [str], page_mode: str, a4_orientation: str, base_image_index: int, dpi: int, output_dir: str|null}"""
        files = params.get('files', [])
        page_mode = params.get('page_mode', 'original')
        a4_orientation = params.get('a4_orientation', 'auto')
        base_image_index = params.get('base_image_index', 0)
        dpi = params.get('dpi', 150)
        output_dir = params.get('output_dir')

        output_path = get_output_path(files[0], '.pdf', output_dir) if output_dir else None
        result, err = ImageEngine.images_to_pdf(
            files, output_path, page_mode, a4_orientation, base_image_index, dpi
        )
        if err:
            return {'success': False, 'error': err}
        return {'success': True, 'output_path': result}

    # --- Page Manager ---

    def get_pdf_page_thumbnails(self, params):
        """params: {file_path: str, password: str|null}"""
        fpath = params.get('file_path')
        password = params.get('password')

        count, needs_pw, err = PdfEngine.get_page_count(fpath, password)
        if needs_pw:
            return {'success': False, 'need_password': True, 'error': err}
        if err:
            return {'success': False, 'error': err}

        thumbnails = []
        for i in range(count):
            b64, _, _ = PdfEngine.render_page_thumbnail_base64(fpath, i, password)
            thumbnails.append(b64)

        return {
            'success': True,
            'thumbnails': thumbnails,
            'page_order': list(range(count)),
            'rotations': {},
        }

    def reorder_pages(self, params):
        """params: {file_path: str, page_order: [int], rotations: {int: int}, password: str|null}"""
        fpath = params.get('file_path')
        page_order = params.get('page_order', [])
        rotations = params.get('rotations', {})
        password = params.get('password')

        out, needs_pw, err = PdfEngine.reorder_and_save(fpath, page_order, rotations, password=password)
        if needs_pw:
            return {'success': False, 'need_password': True, 'error': err}
        if err:
            return {'success': False, 'error': err}
        return {'success': True, 'output_path': out}

    def rotate_pages(self, params):
        """params: {file_path: str, page_indices: [int], rotation: int, password: str|null}"""
        # Rotation is handled client-side in page_order/rotations, saved via reorder_pages
        return {'success': True}

    def delete_pages(self, params):
        """params: {file_path: str, page_indices: [int], password: str|null}"""
        # Deletion is handled client-side by removing from page_order, saved via reorder_pages
        return {'success': True}

    # --- Merge PDF ---

    def check_merge_page_sizes(self, file_paths):
        """Check if PDFs have uniform page sizes."""
        uniform, sizes = PdfEngine.check_page_sizes_uniform(file_paths)
        return {'uniform': uniform, 'sizes': sizes}

    def merge_pdfs(self, params):
        """params: {files: [str], merge_mode: str, a4_orientation: str, password: str|null}"""
        files = params.get('files', [])
        merge_mode = params.get('merge_mode', 'original')
        a4_orientation = params.get('a4_orientation', 'auto')
        password = params.get('password')

        out, needs_pw, err = PdfEngine.merge_pdfs(files, merge_mode, a4_orientation, password=password)
        if needs_pw:
            return {'success': False, 'need_password': True, 'error': err}
        if err:
            return {'success': False, 'error': err}
        return {'success': True, 'output_path': out}

    # --- Encryption ---

    def check_pdf_encrypted(self, params):
        """params: {file_path: str}"""
        fpath = params.get('file_path')
        doc, needs_pw, err = PdfEngine.open_pdf(fpath)
        if doc:
            doc.close()
        return {'encrypted': needs_pw}

    def unlock_pdf(self, params):
        """params: {file_path: str, password: str}"""
        fpath = params.get('file_path')
        password = params.get('password')
        doc, needs_pw, err = PdfEngine.open_pdf(fpath, password)
        if doc:
            doc.close()
        return {'success': not needs_pw and not err, 'error': err}
```

- [ ] **Step 2: Test end-to-end: launch app and test a feature**

Run: `cd /home/mi/claude_czy/czy_pdf2word && python main.py`
Expected: App launches, can navigate to features, file dialogs work

- [ ] **Step 3: Commit**

```bash
git add api.py
git commit -m "feat: wire all backend API methods to core engines"
```

---

### Task 8: Frontend Polish — Progress Updates, Error Handling, UX Refinements

**Files:**
- Modify: `ui/js/app.js`
- Modify: `ui/css/style.css`
- Modify: `ui/index.html`

- [ ] **Step 1: Add async progress polling to app.js**

Add a polling mechanism to update progress during long operations. Since pywebview.api calls are blocking on the JS side, we use a simple approach: show a spinner during operations.

Add to app.js:

```javascript
// ===== Loading overlay =====
function showLoading(message) {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div><p id="loading-text"></p>';
        document.body.appendChild(overlay);
    }
    document.getElementById('loading-text').textContent = message || '处理中...';
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}
```

- [ ] **Step 2: Update feature action functions to use loading overlay**

Wrap each `startXxx()` function with `showLoading` / `hideLoading` calls. Example for `startPdfToWord`:

```javascript
async function startPdfToWord() {
    if (state.files.pdf2word.length === 0) return alert('请先选择PDF文件');
    showLoading('正在转换PDF为Word...');
    try {
        const result = await pywebview.api.pdf_to_word({
            files: state.files.pdf2word.map(f => f.path),
        });
        hideLoading();
        if (result.need_password) {
            showPasswordModal(async (pwd) => {
                showLoading('正在转换...');
                const r2 = await pywebview.api.pdf_to_word({
                    files: state.files.pdf2word.map(f => f.path),
                    password: pwd,
                });
                hideLoading();
                if (r2.success) {
                    showSuccess('转换完成！输出：' + r2.output_paths.join(', '));
                } else {
                    alert('错误：' + r2.error);
                }
            });
        } else if (result.success) {
            showSuccess('转换完成！输出：' + result.output_paths.join(', '));
        } else {
            alert('错误：' + result.error);
        }
    } catch (e) {
        hideLoading();
        alert('错误：' + e.message);
    }
}
```

Apply similar pattern to `startPdfToImage`, `startImageToPdf`, `savePageManager`, `startMergePdf`.

- [ ] **Step 3: Add success notification and loading overlay CSS**

Add to style.css:

```css
/* Loading overlay */
.loading-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.3);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 300;
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s;
}
.loading-overlay.active { opacity: 1; pointer-events: all; }

.spinner {
    width: 40px; height: 40px;
    border: 4px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.loading-overlay p { margin-top: 12px; color: white; font-size: 14px; }

/* Success toast */
.toast {
    position: fixed; bottom: 24px; right: 24px;
    background: var(--success); color: white;
    padding: 12px 20px; border-radius: var(--radius-sm);
    font-size: 14px; box-shadow: var(--shadow);
    z-index: 400;
    animation: slideIn 0.3s ease;
}
@keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
```

Add to app.js:

```javascript
function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/
git commit -m "feat: loading overlay, success toast, and polished UX for all features"
```

---

### Task 9: Build & Package — PyInstaller Configuration

**Files:**
- Create: `build.spec`

- [ ] **Step 1: Create build.spec**

```python
# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Collect PyMuPDF data
fitz_datas = collect_data_files('fitz')

# Collect all UI files
ui_datas = [
    ('ui/index.html', 'ui'),
    ('ui/css/style.css', 'ui/css'),
    ('ui/js/app.js', 'ui/js'),
]

# Tesseract bundling (platform-specific)
tesseract_datas = []
tesseract_binaries = []

if sys.platform == 'win32':
    # Windows: user must place tesseract/ folder with tesseract.exe and tessdata/ alongside
    tesseract_path = os.environ.get('TESSERACT_PATH', 'C:\\Program Files\\Tesseract-OCR')
    if os.path.exists(tesseract_path):
        tesseract_datas.append((os.path.join(tesseract_path, 'tesseract.exe'), 'tesseract'))
        tessdata_dir = os.path.join(tesseract_path, 'tessdata')
        if os.path.exists(tessdata_dir):
            tesseract_datas.append((tessdata_dir, 'tesseract/tessdata'))
else:
    # Linux: user must specify Tesseract path
    tesseract_path = os.environ.get('TESSERACT_PATH', '/usr/bin/tesseract')
    tessdata_path = os.environ.get('TESSDATA_PATH', '/usr/share/tesseract-ocr/4.00/tessdata')
    if os.path.exists(tesseract_path):
        tesseract_binaries.append((tesseract_path, 'tesseract'))
        tesseract_datas.append((tesseract_path, 'tesseract/tesseract'))
    if os.path.exists(tessdata_path):
        tesseract_datas.append((tessdata_path, 'tesseract/tessdata'))

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=tesseract_binaries,
    datas=fitz_datas + ui_datas + tesseract_datas,
    hiddenimports=['fitz', 'pytesseract', 'docx', 'PIL', 'webview'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zlib_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PDF工具箱',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
```

- [ ] **Step 2: Test build**

Run: `cd /home/mi/claude_czy/czy_pdf2word && pyinstaller build.spec`
Expected: Single executable `dist/PDF工具箱` created

- [ ] **Step 3: Test the built executable**

Run: `./dist/PDF工具箱`
Expected: App launches with full functionality

- [ ] **Step 4: Commit**

```bash
git add build.spec
git commit -m "feat: PyInstaller build spec for single-file executable"
```

---

### Task 10: Final Integration Testing & Cleanup

**Files:**
- All files

- [ ] **Step 1: Test PDF to Word conversion**

Run the app, select a PDF with text, convert to Word. Verify the .docx is created and contains text/images.

- [ ] **Step 2: Test PDF to Image conversion**

Run the app, select a PDF, convert with different DPIs (72, 150, 300) and formats (PNG, JPG). Verify image quality and file size scale with DPI.

- [ ] **Step 3: Test Image to PDF conversion**

Run the app, select multiple images with different sizes. Test both A4 mode and original ratio mode. Verify images are centered and aspect ratios preserved.

- [ ] **Step 4: Test Page Manager**

Run the app, load a multi-page PDF. Reorder pages via drag, rotate a page, delete a page. Save and verify the output PDF reflects changes.

- [ ] **Step 5: Test Merge PDF**

Run the app, select 2+ PDFs with different page sizes. Verify the merge mode selector appears. Test both modes (original size and fit-A4).

- [ ] **Step 6: Test encrypted PDF handling**

Run the app, attempt to process an encrypted PDF. Verify the password modal appears and correct password unlocks the file.

- [ ] **Step 7: Test theme toggle**

Run the app, toggle dark/light theme. Verify all views render correctly in both themes.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: PDF全能工具箱 v1.0.0 complete"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| PDF转Word | Task 5 (WordEngine) + Task 7 (API) |
| PDF转图片 (PNG/JPG, DPI) | Task 3 (PdfEngine) + Task 7 (API) |
| 图片转PDF A4模式 | Task 4 (ImageEngine) |
| 图片转PDF 原始比例模式 | Task 4 (ImageEngine) |
| 图片转PDF 多图不一致居中 | Task 4 (ImageEngine) |
| 页面操作-缩略图 | Task 2 (frontend) + Task 3 + Task 7 |
| 页面操作-拖拽排序 | Task 2 (frontend JS) |
| 页面操作-旋转 | Task 3 (PdfEngine) + Task 2 (frontend) |
| 页面操作-删除(含区间) | Task 2 (frontend) |
| 合并PDF-拖拽排序 | Task 2 (frontend) |
| 合并PDF-原始大小拼接 | Task 3 (PdfEngine.merge_pdfs) |
| 合并PDF-统一缩放A4 | Task 3 (PdfEngine.merge_pdfs) |
| 批量处理 | Task 7 (API loops over files) |
| 密码解锁 | Task 3 (PdfEngine) + Task 2 (modal) |
| OCR中英文 | Task 6 (OcrEngine) |
| 深色主题 | Task 2 (CSS variables) |
| HTML+CSS界面 | Task 2 (PyWebView + HTML/CSS) |
| 单文件可执行 | Task 9 (PyInstaller) |
| 原始比例-基准图选择 | Task 2 (frontend) + Task 4 (ImageEngine) |
