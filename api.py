class Api:
    """PyWebView API bridge. All methods here are callable from JS via pywebview.api.*."""

    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

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
