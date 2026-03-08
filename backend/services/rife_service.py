"""RIFE frame interpolation service using vladmandic/rife vendor."""
import sys
import torch
import numpy as np
from pathlib import Path
from PIL import Image

# Add vendor to path
RIFE_DIR = Path(__file__).resolve().parent.parent / "rife_vendor" / "model"
sys.path.insert(0, str(RIFE_DIR))

_model = None
_device = None


def _get_model():
    global _model, _device
    if _model is not None:
        return _model, _device

    if torch.backends.mps.is_available():
        _device = torch.device("mps")
    elif torch.cuda.is_available():
        _device = torch.device("cuda")
    else:
        _device = torch.device("cpu")

    # Import warplayer and patch its device variable to match our device
    # This is needed because warplayer uses a global device that doesn't account for MPS
    import warplayer
    warplayer.device = _device
    # Clear the cached grid to ensure it's recreated with the correct device
    warplayer.backwarp_tenGrid = {}
    
    from RIFE_HDv3 import Model
    _model = Model()
    weights_path = Path(__file__).resolve().parent.parent / "rife_vendor" / "model" / "flownet-v46.pkl"
    _model.load_model(str(weights_path), -1)
    _model.eval()
    
    # Move model to the correct device (the device() method uses a global device variable
    # that doesn't account for MPS, so we need to manually move it)
    _model.flownet.to(_device)

    return _model, _device


def _load_image(path: Path) -> torch.Tensor:
    """Load image as torch tensor [1, 3, H, W] float32 0-1."""
    img = np.array(Image.open(path).convert("RGB")).astype(np.float32) / 255.0
    img = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0)
    return img


def _save_image(tensor: torch.Tensor, path: Path):
    """Save torch tensor [1, 3, H, W] to image file."""
    img = tensor.squeeze(0).permute(1, 2, 0).clamp(0, 1).cpu().numpy()
    img = (img * 255).astype(np.uint8)
    Image.fromarray(img).save(str(path), quality=95)


def _pad_to_multiple(img: torch.Tensor, multiple: int = 32):
    """Pad image to be divisible by multiple."""
    _, _, h, w = img.shape
    ph = (multiple - h % multiple) % multiple
    pw = (multiple - w % multiple) % multiple
    if ph > 0 or pw > 0:
        img = torch.nn.functional.pad(img, (0, pw, 0, ph))
    return img, h, w


def _frame_index_from_path(path: Path) -> int:
    """Extract frame number from path like frame_0011.jpg. Default 0 if unparseable."""
    import re
    name = path.stem
    m = re.search(r"frame_(\d+)", name, re.IGNORECASE)
    return int(m.group(1)) if m else 0


def interpolate_pair(frame1_path: Path, frame2_path: Path, output_paths: list[Path]):
    """Generate N intermediate frames between frame1 and frame2.

    frame1_path: earlier key frame (e.g. frame_0010.jpg).
    frame2_path: later key frame (e.g. frame_0025.jpg).
    output_paths: paths for in-between frames, in ascending temporal order (e.g. 11-24).
                  Sorted by frame index before use so the i-th blend is written to the correct file.
    """
    model, device = _get_model()
    # Ensure temporal order: first path = frame right after frame1, last = frame right before frame2
    output_paths = sorted(output_paths, key=_frame_index_from_path)
    n = len(output_paths)
    if n == 0:
        return

    img1 = _load_image(frame1_path).to(device)
    img2 = _load_image(frame2_path).to(device)

    # Pad to multiple of 32
    img1_padded, orig_h, orig_w = _pad_to_multiple(img1)
    img2_padded, _, _ = _pad_to_multiple(img2)

    with torch.no_grad():
        for i, out_path in enumerate(output_paths):
            # timestep: evenly spaced between 0 and 1 (exclusive)
            t = (i + 1) / (n + 1)
            result = model.inference(img1_padded, img2_padded, timestep=t)
            # Crop back to original size
            result = result[:, :, :orig_h, :orig_w]
            _save_image(result, out_path)
