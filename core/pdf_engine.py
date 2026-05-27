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

                    if a4_orientation == 'landscape':
                        aw, ah = A4_H, A4_W
                    elif a4_orientation == 'portrait':
                        aw, ah = A4_W, A4_H
                    else:  # auto
                        aw, ah = (A4_H, A4_W) if pw > ph else (A4_W, A4_H)

                    new_page = merged.new_page(width=aw, height=ah)
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
