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
        # Rotation is handled client-side in page_order/rotations, saved via reorder_pages
        return {'success': True}

    def delete_pages(self, params):
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
