import subprocess
import shutil
from pathlib import Path

# Detect FFmpeg from system PATH
_FFMPEG = shutil.which("ffmpeg")
if _FFMPEG is None:
    # Fallback: try common installation paths
    import platform
    if platform.system() == "Windows":
        # Try common Windows locations
        possible_paths = [
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        ]
        for path in possible_paths:
            if Path(path).exists():
                _FFMPEG = path
                break
    elif platform.system() == "Darwin":  # macOS
        # Try Homebrew location
        brew_path = Path("/opt/homebrew/bin/ffmpeg")
        if brew_path.exists():
            _FFMPEG = str(brew_path)
        else:
            brew_path = Path("/usr/local/bin/ffmpeg")
            if brew_path.exists():
                _FFMPEG = str(brew_path)
    
    if _FFMPEG is None:
        raise RuntimeError(
            "FFmpeg not found. Please install FFmpeg:\n"
            "  macOS: brew install ffmpeg\n"
            "  Windows: winget install FFmpeg\n"
            "  Linux: sudo apt-get install ffmpeg"
        )


def extract_frames(video_path: Path, output_dir: Path, fps: int = 30) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        _FFMPEG, "-y",
        "-i", str(video_path),
        "-vf", f"fps={fps}",
        str(output_dir / "frame_%04d.jpg"),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return len(list(output_dir.glob("frame_*.jpg")))


def encode_video(frames_dir: Path, output_path: Path, fps: int = 30) -> Path:
    cmd = [
        _FFMPEG, "-y",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame_%04d.jpg"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
