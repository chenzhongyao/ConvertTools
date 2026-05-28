import os
import tempfile
import shutil

def ensure_output_dir(output_dir=None):
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        return output_dir
    return os.getcwd()

def get_output_path(input_path, suffix, output_dir=None):
    basename = os.path.splitext(os.path.basename(input_path))[0]
    directory = output_dir or os.path.dirname(input_path) or os.getcwd()
    # If no explicit output_dir and the derived directory is a temp location
    # (drag-and-drop files saved via save_temp_file), fall back to cwd
    if not output_dir and directory and directory.startswith(tempfile.gettempdir()):
        directory = os.getcwd()
    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, f"{basename}{suffix}")

def create_temp_dir():
    return tempfile.mkdtemp(prefix='pdf_toolbox_')

def cleanup_temp_dir(path):
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass
