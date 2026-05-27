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
