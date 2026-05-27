# PDF全能工具箱 - 设计文档

## 概述

一个无依赖、单文件可执行的PDF工具箱，支持Windows和Ubuntu，提供PDF转Word、PDF转图片、图片转PDF、PDF页面操作、PDF合并等功能，集成Tesseract OCR中英文识别。

## 技术栈

| 层次 | 技术 | 理由 |
|------|------|------|
| GUI | PyWebView (HTML+CSS+JS前端 + Python后端) | 美观现代，HTML/CSS自由设计UI |
| PDF核心 | PyMuPDF (fitz) | 功能全面，性能好，MIT协议 |
| Word生成 | python-docx | 成熟稳定的docx库 |
| OCR | Tesseract + pytesseract | 中英文支持，离线可用 |
| 图片处理 | Pillow | 图片缩放、格式转换 |
| 打包 | PyInstaller --onefile | 单文件exe/bin，无依赖运行 |

## 前端架构：PyWebView + HTML/CSS/JS

采用PyWebView将本地HTML页面嵌入原生窗口，前端用HTML+CSS+JS实现美观界面，后端Python处理业务逻辑，通过JS-Python桥接通信。

### 通信方式
- JS调用Python：`pywebview.api.method_name(args)`
- Python返回结果：方法直接return，JS端Promise接收
- 事件通知：`window.pywebview.api.on_event(event_name, data)` 用于进度推送

## 功能设计

### 1. PDF转Word
- 提取文字、图片、表格，尽量还原可编辑内容
- 扫描件PDF自动检测并启用OCR
- 支持批量转换
- 输出.docx格式

### 2. PDF转图片
- 输出格式：PNG / JPG
- 自定义DPI数值（72-600），默认150
- 每页生成一张图片
- 支持批量转换

### 3. 图片转PDF
- **A4模式**：页面固定A4，图片等比缩放至A4内，上下左右居中留白
- **原始比例模式（默认）**：页面尺寸按图片比例生成，无留白
- A4模式下方向选择：纵向 / 横向 / 自动（按图片长宽比自动选择）
- 原始比例模式下方支持选择以第几张图片为基准，默认为第一张即可
- 多图尺寸不一致时：以第一张图为基准，其余图片等比resize到相同尺寸，长宽比不变，居中放置
- 支持批量处理

### 4. PDF页面操作
- 缩略图预览所有页面
- 拖拽排序重新排列页面
- 右键/按钮旋转页面（90°/180°/270°）
- 删除指定页面或指定区间页面
- 支持加密PDF密码解锁

### 5. 合并PDF
- 拖拽排序多个PDF文件
- 页面尺寸不一致时提供两种模式：
  - **原始大小拼接**：每页保持原尺寸直接拼接，最终PDF页面大小不统一
  - **统一缩放到A4**：所有页面等比缩放至A4内，居中放置，保持长宽比，空白留白
- A4模式下支持纵向/横向/自动方向选择
- 支持加密PDF密码解锁

### 6. 批量处理
- 多文件统一设置参数后批量转换
- 进度条显示整体和单个文件进度

### 7. 密码解锁
- 遇到加密PDF弹出密码输入框
- 密码正确后解锁继续操作

### 8. OCR识别
- Tesseract引擎，中英文识别（chi_sim + eng）
- 自动检测扫描件页面并启用OCR
- OCR结果用于PDF转Word时提取文字

## UI设计

### 设计风格
- 现代简洁，圆角卡片，柔和阴影
- 浅色主题为主，支持深色主题切换
- 色调：主色#4A90D9（蓝），辅助#F5A623（橙），背景#F7F8FA
- 字体：系统默认，标题加粗

### 页面结构

**主页：**
- 顶部：应用标题 + 深色模式切换
- 中部：6个功能卡片网格（2行3列），图标+标题+简述
- 底部：版本信息

**功能页统一布局：**
- 顶部导航栏：返回按钮 + 功能标题
- 文件选择区：拖拽上传框 + 选择文件按钮，显示文件列表（可删除）
- 参数设置区：根据功能不同展示对应设置项
- 操作区：开始按钮 + 进度条 + 状态提示
- 加密PDF时弹出密码输入模态框

**页面操作页特殊：**
- 缩略图网格展示所有页面
- 拖拽排序
- 每页缩略图上显示操作按钮（旋转/删除）

**合并PDF页特殊：**
- 文件列表可拖拽排序
- 检测到尺寸不一致时弹出模式选择框

### 前端技术
- HTML5 + CSS3（CSS变量管理主题色）
- 原生JavaScript（无框架依赖，保持轻量）
- CSS Grid/Flexbox布局
- CSS动画过渡效果
- 拖拽使用原生HTML5 Drag & Drop API

## 项目结构

```
czy_pdf2word/
├── main.py                    # 入口，创建PyWebView窗口
├── api.py                     # PyWebView API桥接层
├── core/
│   ├── pdf_engine.py          # PDF核心操作(PyMuPDF封装)
│   ├── word_engine.py         # Word生成(python-docx封装)
│   ├── ocr_engine.py          # OCR引擎(Tesseract封装)
│   └── image_engine.py        # 图片处理(Pillow封装)
├── ui/
│   ├── index.html             # 主页
│   ├── pdf_to_word.html       # PDF转Word
│   ├── pdf_to_image.html      # PDF转图片
│   ├── image_to_pdf.html      # 图片转PDF
│   ├── page_manager.html      # 页面操作
│   ├── merge_pdf.html         # 合并PDF
│   ├── css/
│   │   ├── main.css           # 全局样式+CSS变量
│   │   ├── components.css     # 共用组件样式
│   │   └── dark.css           # 深色主题
│   └── js/
│       ├── app.js             # 全局逻辑+PyWebView桥接
│       ├── dragdrop.js        # 拖拽功能
│       └── utils.js           # 前端工具函数
├── assets/                    # 图标资源
├── utils/
│   ├── file_utils.py          # 文件工具
│   └── config.py              # 配置管理
├── requirements.txt
└── build.spec                 # PyInstaller配置
```

## 核心依赖

```
PyMuPDF>=1.23.0        # PDF读写、渲染
python-docx>=0.8.11     # Word生成
Pillow>=10.0            # 图片处理
pytesseract>=0.3.10     # OCR接口
pywebview>=4.0          # GUI窗口（HTML+CSS+JS前端）
```

Tesseract运行时：打包时内嵌tesseract.exe(Windows)和tesseract二进制(Ubuntu)，附带中英文语言数据包(chi_sim + eng)

## 打包策略

- **Windows：** PyInstaller --onefile，内嵌tesseract.exe + 语言数据 + HTML/CSS/JS资源，预计120-180MB
- **Ubuntu：** PyInstaller --onefile，内嵌tesseract二进制 + 语言数据 + HTML/CSS/JS资源，预计100-150MB
- 两个平台分别打包，各自生成单文件可执行

## 错误处理

- 加密PDF → 弹出密码输入模态框
- 扫描件PDF → 自动检测并启用OCR
- 损坏文件 → 前端提示具体错误信息
- 内存不足 → 大文件分页处理
- Tesseract缺失 → 检测并提示OCR不可用，非OCR功能正常使用

## 预估打包体积

| 组件 | 预估大小 |
|------|----------|
| Python运行时 + 库 | ~40MB |
| PyMuPDF | ~15MB |
| Tesseract + 中英语言包 | ~50-80MB |
| HTML/CSS/JS前端 | ~1MB |
| python-docx + Pillow | ~5MB |
| PyWebView | ~5MB |
| **总计** | **~120-150MB** |
