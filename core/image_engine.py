import fitz  # PyMuPDF
from PIL import Image
import os
import tempfile
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
            ref_pw = ref_w * 72.0 / dpi
            ref_ph = ref_h * 72.0 / dpi
        else:
            ref_pw, ref_ph = ImageEngine.A4_WIDTH, ImageEngine.A4_HEIGHT

        for img in pil_images:
            iw, ih = img.size
            img_pw = iw * 72.0 / dpi
            img_ph = ih * 72.0 / dpi

            if page_mode == 'a4':
                if a4_orientation == 'landscape':
                    page_w, page_h = ImageEngine.A4_HEIGHT, ImageEngine.A4_WIDTH
                elif a4_orientation == 'portrait':
                    page_w, page_h = ImageEngine.A4_WIDTH, ImageEngine.A4_HEIGHT
                else:  # auto
                    page_w, page_h = (ImageEngine.A4_HEIGHT, ImageEngine.A4_WIDTH) if iw > ih else (ImageEngine.A4_WIDTH, ImageEngine.A4_HEIGHT)

                page = doc.new_page(width=page_w, height=page_h)
                scale = min(page_w / img_pw, page_h / img_ph)
                disp_w = img_pw * scale
                disp_h = img_ph * scale
                x = (page_w - disp_w) / 2
                y = (page_h - disp_h) / 2
                rect = fitz.Rect(x, y, x + disp_w, y + disp_h)
            else:
                page_w, page_h = ref_pw, ref_ph
                page = doc.new_page(width=page_w, height=page_h)
                scale = min(page_w / img_pw, page_h / img_ph)
                disp_w = img_pw * scale
                disp_h = img_ph * scale
                x = (page_w - disp_w) / 2
                y = (page_h - disp_h) / 2
                rect = fitz.Rect(x, y, x + disp_w, y + disp_h)

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
