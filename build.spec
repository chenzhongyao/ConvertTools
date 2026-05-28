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
    tesseract_path = os.environ.get('TESSERACT_PATH', 'C:\\Program Files\\Tesseract-OCR')
    if os.path.exists(tesseract_path):
        tesseract_datas.append((os.path.join(tesseract_path, 'tesseract.exe'), 'tesseract'))
        tessdata_dir = os.path.join(tesseract_path, 'tessdata')
        if os.path.exists(tessdata_dir):
            for f in os.listdir(tessdata_dir):
                if f.endswith('.traineddata'):
                    tesseract_datas.append((os.path.join(tessdata_dir, f), 'tesseract/tessdata'))
else:
    tesseract_path = os.environ.get('TESSERACT_PATH', '/usr/bin/tesseract')
    tessdata_path = os.environ.get('TESSDATA_PATH', '/usr/share/tesseract-ocr/4.00/tessdata')
    if os.path.exists(tesseract_path):
        tesseract_binaries.append((tesseract_path, 'tesseract'))
        tesseract_datas.append((tesseract_path, 'tesseract/tesseract'))
    if os.path.exists(tessdata_path):
        for f in os.listdir(tessdata_path):
            if f.endswith('.traineddata'):
                tesseract_datas.append((os.path.join(tessdata_path, f), 'tesseract/tessdata'))

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=tesseract_binaries,
    datas=fitz_datas + ui_datas + tesseract_datas,
    hiddenimports=['fitz', 'pytesseract', 'docx', 'PIL', 'webview', 'pywebview'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, cipher=block_cipher)

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
