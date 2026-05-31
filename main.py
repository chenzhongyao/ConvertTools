import os
import webview
from api import Api
from utils.config import APP_TITLE, WINDOW_WIDTH, WINDOW_HEIGHT

os.environ['GI_TYPELIB_PATH'] = '/usr/lib/x86_64-linux-gnu/girepository-1.0'

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
    webview.start(debug=False, gui='qt')

if __name__ == '__main__':
    main()
