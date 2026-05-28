# PDF全能工具箱

一款零依赖、单文件可执行的 PDF 处理工具，支持 Windows 和 Ubuntu。基于 PyWebView + HTML/CSS 构建，界面美观现代，无需安装即可使用。

## 功能一览

| 功能 | 说明 |
|------|------|
| PDF转Word | 提取文字、图片、表格，生成可编辑 .docx；扫描件自动 OCR 识别 |
| PDF转图片 | 每页导出为 PNG 或 JPG，自定义 DPI（72-600）控制清晰度与文件大小 |
| 图片转PDF | 多图合并为 PDF，支持 A4 模式（居中留白）和原始比例模式（按图片比例生成页面） |
| 页面操作 | 缩略图预览、拖拽排序、旋转（90°/180°/270°）、删除单页或指定区间 |
| 拆分PDF | 按页码范围将 PDF 拆分为多个独立文件 |
| 合并PDF | 拖拽排序多个 PDF，支持原始大小拼接和统一缩放到 A4 两种模式 |
| 自定义输出目录 | 每个功能均可选择输出目录，不选则默认输出到源文件同目录 |
| 批量处理 | 多文件统一参数后批量转换 |
| 密码解锁 | 遇到加密 PDF 弹出密码输入框解锁 |
| OCR识别 | 集成 Tesseract，支持中文+英文扫描件文字识别 |
| 深色主题 | 浅色/深色主题一键切换 |

## 环境要求

### Python 版本

- Python 3.8+

### 系统依赖

**Ubuntu：**

```bash
# PyWebView GTK 后端（二选一）
sudo apt-get install python3-gi python3-gi-cairo gir1.2-webkit2-4.0

# 或使用 Qt 后端
pip install PyQt5

# Tesseract OCR（可选，不安装时 OCR 功能不可用，其他功能正常）
sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng
```

**Windows：**

```powershell
# Tesseract OCR（可选）
# 下载安装：https://github.com/UB-Mannheim/tesseract/wiki
# 安装时勾选中文和英文语言包
```

### Python 依赖

```
PyMuPDF==1.24.11
python-docx==1.1.2
Pillow==10.4.0
pytesseract==0.3.13
pywebview==6.2.1
pyinstaller==6.20.0
```

## 快速开始

### 1. 克隆项目

```bash
git clone <repo-url>
cd czy_pdf2word
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 运行

```bash
python main.py
```

## 使用教程

### PDF转Word

1. 在主页点击「PDF转Word」卡片
2. 拖拽 PDF 文件到上传区，或点击选择文件（支持多文件）
3. （可选）点击「选择」按钮指定输出目录，不选则默认输出到源文件同目录
4. 点击「开始转换」
5. 转换完成后，.docx 文件生成在指定目录（或 PDF 同目录）下
6. 若 PDF 为扫描件，将自动启用 OCR 识别文字

### PDF转图片

1. 点击「PDF转图片」
2. 添加 PDF 文件
3. 设置参数：
   - **输出格式**：PNG（无损）或 JPG（有压缩，体积更小）
   - **DPI**：72（低清晰度小文件）~ 600（高清晰度大文件），默认 200
   - **输出目录**：点击「选择」指定，不选则默认输出到源文件同目录
4. 点击「开始转换」，每页生成一张图片

### 图片转PDF

1. 点击「图片转PDF」
2. 拖拽图片文件（支持 JPG/PNG），可拖拽调整顺序
3. 选择页面模式：
   - **原始比例**（默认）：按图片比例生成页面，可选择以第几张图片为基准
   - **A4标准页**：固定 A4 页面，图片等比缩放居中，可选纵向/横向/自动
4. 设置 DPI（影响图片在 PDF 中的显示尺寸）
5. （可选）点击「选择」按钮指定输出目录，不选则默认输出到源文件同目录
6. 点击「开始转换」

> 当多张图片尺寸不一致时，会以基准图片为参考，其余图片等比缩放居中放置，长宽比不变。

### 页面操作

1. 点击「页面操作」
2. 拖拽**单个** PDF 文件
3. 加载后显示所有页面缩略图，可：
   - **拖拽排序**：拖动缩略图重新排列页面顺序
   - **旋转**：悬停缩略图点击旋转按钮，每次旋转 90°
   - **删除单页**：悬停缩略图点击删除按钮
   - **删除区间**：在输入框中填写页码范围（如 `1-3,5,8-10`），点击删除
   - **移动页面**：输入原始页码和目标位置，点击移动
4. 点击「保存修改」，编辑后的 PDF 生成在同目录下

### 拆分PDF

1. 点击「拆分PDF」
2. 拖拽**单个** PDF 文件
3. 在「拆分范围」输入框中填写页码范围（如 `1-3, 4-6, 7-10`），每段范围生成一个独立 PDF
4. （可选）点击「选择」按钮指定输出目录，不选则默认输出到源文件同目录
5. 点击「开始拆分」

> 每段范围用逗号分隔。单个页码也可以，如 `1, 3-5, 8` 会生成3个文件。

### 合并PDF

1. 点击「合并PDF」
2. 拖拽多个 PDF 文件，可拖拽调整合并顺序
3. 若检测到页面尺寸不一致，出现合并模式选择：
   - **原始大小拼接**：每页保持原尺寸，最终 PDF 页面大小不统一
   - **统一缩放到A4**：所有页面等比缩放至 A4 内，居中放置，保持长宽比
4. A4 模式下可选择纵向/横向/自动方向
5. （可选）点击「选择」按钮指定输出目录，不选则默认输出到源文件同目录
6. 点击「开始合并」

### 加密PDF处理

当操作加密 PDF 时，会自动弹出密码输入框。输入正确密码后即可正常处理。

### 深色模式

点击右上角太阳/月亮图标切换浅色/深色主题，设置自动保存。

## 打包为可执行文件

### Ubuntu

```bash
# 安装 Tesseract（如需 OCR 打包进可执行文件）
sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng

# 设置环境变量指向 Tesseract 路径
export TESSERACT_PATH=/usr/bin/tesseract
export TESSDATA_PATH=/usr/share/tesseract-ocr/4.00/tessdata

# 打包
pyinstaller build.spec

# 生成的可执行文件在
./dist/PDF工具箱
```

### Windows

```powershell
# 安装 Tesseract 到默认路径（如需 OCR）
# 下载：https://github.com/UB-Mannheim/tesseract/wiki

# 设置环境变量
set TESSERACT_PATH=C:\Program Files\Tesseract-OCR

# 打包
pyinstaller build.spec

# 生成的可执行文件在
.\dist\PDF工具箱.exe
```

> 打包后为单文件可执行，无需安装 Python 或任何依赖即可运行。

## 项目结构

```
czy_pdf2word/
├── main.py                  # 入口：创建 PyWebView 窗口
├── api.py                   # JS↔Python API 桥接层
├── core/
│   ├── pdf_engine.py        # PDF 引擎（PyMuPDF：读写/渲染/合并/拆分/页面操作/加密）
│   ├── image_engine.py      # 图片引擎（图片转PDF：A4/原始比例/居中/DPI）
│   ├── word_engine.py       # Word 引擎（python-docx 生成 .docx）
│   └── ocr_engine.py        # OCR 引擎（Tesseract 中英文识别）
├── ui/
│   ├── index.html           # 单页应用 HTML
│   ├── css/style.css        # 完整样式（浅色/深色主题）
│   └── js/app.js            # 前端逻辑（路由/拖拽/排序/API调用）
├── utils/
│   ├── config.py            # 配置（Tesseract路径/窗口尺寸）
│   └── file_utils.py        # 文件工具（输出路径/临时目录）
├── build.spec               # PyInstaller 打包配置
├── requirements.txt         # Python 依赖
└── README.md
```

## 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| GUI | PyWebView + HTML/CSS/JS | 美观现代的图形界面 |
| PDF核心 | PyMuPDF (fitz) | PDF 读写、渲染、合并、拆分、页面操作 |
| Word生成 | python-docx | 生成可编辑 .docx 文件 |
| 图片处理 | Pillow | 图片缩放、格式转换 |
| OCR | Tesseract + pytesseract | 扫描件文字识别（中英文） |
| 打包 | PyInstaller | 打包为单文件可执行 |

## 常见问题

**Q: 启动报错 "You must have either QT or GTK with Python extensions installed"**

A: PyWebView 需要系统 GUI 后端。Ubuntu 安装 `sudo apt-get install python3-gi python3-gi-cairo gir1.2-webkit2-4.0`，或 `pip install PyQt5`。

**Q: OCR 不可用？**

A: 需要安装 Tesseract。Ubuntu: `sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng`。Windows: 从 [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki) 下载安装。OCR 不可用时不影响其他功能。

**Q: PDF转Word后排版与原文不同？**

A: PDF转Word尽量还原可编辑内容，但由于 PDF 和 Word 格式差异，排版无法 100% 还原。复杂排版建议使用 PDF转图片功能。

**Q: 打包后体积多大？**

A: 约 120-180MB（含 Tesseract 和语言包）。不含 OCR 约 60-80MB。

## License

MIT
