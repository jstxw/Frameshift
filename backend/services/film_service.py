"""FILM (Frame Interpolation for Large Motion) service for high-quality frame interpolation.
Uses TensorFlow Hub to load the FILM model."""
import numpy as np
from pathlib import Path
from PIL import Image

_model = None

def _load_image(path: Path) -> np.ndarray:
    """Load image as numpy array [H, W, 3] uint8."""
    img = Image.open(path).convert("RGB")
    return np.array(img)

def _save_image(array: np.ndarray, path: Path):
    """Save numpy array [H, W, 3] uint8 to image file."""
    Image.fromarray(array).save(str(path), quality=95)

def _get_model():
    """Load FILM model from TensorFlow Hub."""
    global _model
    if _model is not None:
        return _model
    
    try:
        import tensorflow as tf
        import tensorflow_hub as hub
        
        # Load FILM model from TensorFlow Hub
        # Model URL: https://tfhub.dev/google/film/1
        print("[FILM] Loading model from TensorFlow Hub...")
        _model = hub.load("https://tfhub.dev/google/film/1")
        print("[FILM] Model loaded successfully")
        return _model
    except ImportError:
        print("[FILM] TensorFlow or tensorflow_hub not installed.")
        print("[FILM] Install with: pip install tensorflow tensorflow-hub")
        print("[FILM] Falling back to simple interpolation")
        return None
    except Exception as e:
        print(f"[FILM] Error loading model: {e}")
        print("[FILM] Falling back to simple interpolation")
        return None

def _interpolate_with_film(img1: np.ndarray, img2: np.ndarray, timestep: float) -> np.ndarray:
    """Interpolate a single frame at timestep using FILM model."""
    model = _get_model()
    if model is None:
        # Fallback to linear interpolation
        return ((1 - timestep) * img1.astype(np.float32) + timestep * img2.astype(np.float32)).clip(0, 255).astype(np.uint8)
    
    try:
        import tensorflow as tf
        
        # Convert to float32 and normalize to [0, 1]
        img1_tf = tf.image.convert_image_dtype(img1, tf.float32)
        img2_tf = tf.image.convert_image_dtype(img2, tf.float32)
        
        # Add batch dimension: [1, H, W, 3]
        img1_tf = tf.expand_dims(img1_tf, 0)
        img2_tf = tf.expand_dims(img2_tf, 0)
        
        # FILM expects timestep as a tensor
        time = tf.constant([timestep], dtype=tf.float32)
        
        # Run inference
        result = model([img1_tf, img2_tf, time])
        
        # Convert back to numpy
        interpolated = result.numpy()[0]
        interpolated = (interpolated * 255).clip(0, 255).astype(np.uint8)
        
        return interpolated
    except Exception as e:
        print(f"[FILM] Error during interpolation: {e}")
        # Fallback to linear interpolation
        return ((1 - timestep) * img1.astype(np.float32) + timestep * img2.astype(np.float32)).clip(0, 255).astype(np.uint8)

def interpolate_pair(frame1_path: Path, frame2_path: Path, output_paths: list[Path]):
    """Generate N intermediate frames between frame1 and frame2 using FILM.
    
    Args:
        frame1_path: Path to first frame
        frame2_path: Path to second frame  
        output_paths: List of paths where interpolated frames should be saved.
                     For example, if frame1=10 and frame2=25, output_paths would be paths for frames 11-24.
    """
    n = len(output_paths)
    if n == 0:
        return
    
    # Load images
    img1 = _load_image(frame1_path)
    img2 = _load_image(frame2_path)
    
    # Check which method we're using
    model = _get_model()
    method = "FILM (TensorFlow Hub)" if model is not None else "Linear interpolation (fallback)"
    print(f"[FILM] Interpolating {n} frames between {frame1_path.name} and {frame2_path.name} using {method}")
    
    # Generate interpolated frames
    for i, out_path in enumerate(output_paths):
        # timestep: evenly spaced between 0 and 1 (exclusive)
        t = (i + 1) / (n + 1)
        interpolated = _interpolate_with_film(img1, img2, t)
        _save_image(interpolated, out_path)
    
    print(f"[FILM] Completed interpolation of {n} frames using {method}")
