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
