from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pydantic import BaseModel
import shutil

from services import cloudinary_service, project_manager, ffmpeg_service, yolo_service

load_dotenv()
cloudinary_service.configure()

app = FastAPI(title="FrameShift AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# --- Upload ---

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    project = project_manager.create_project()
    project_dir = project_manager.get_project_dir(project["project_id"])

    video_path = project_dir / "original.mp4"
    with open(video_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    result = cloudinary_service.upload_file(str(video_path), resource_type="video")

    return {
        "project_id": project["project_id"],
        "video_url": result["url"],
        "public_id": result["public_id"],
    }


# --- Extract ---

class ExtractRequest(BaseModel):
    project_id: str

@app.post("/extract")
async def extract_frames(req: ExtractRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    video_path = project_dir / "original.mp4"
    frames_dir = project_dir / "frames"

    frame_count = ffmpeg_service.extract_frames(video_path, frames_dir)

    return {"project_id": req.project_id, "frame_count": frame_count}


@app.get("/frame/{project_id}/{frame_index}")
async def get_frame(project_id: str, frame_index: int):
    project_dir = project_manager.get_project_dir(project_id)
    frame_path = project_dir / "frames" / f"frame_{frame_index:04d}.jpg"
    if not frame_path.exists():
        return {"error": "Frame not found"}
    return FileResponse(frame_path, media_type="image/jpeg")


# --- Detect ---

class DetectRequest(BaseModel):
    project_id: str
    frame_index: int

@app.post("/detect")
async def detect_objects(req: DetectRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    frame_path = project_dir / "frames" / f"frame_{req.frame_index:04d}.jpg"

    if not frame_path.exists():
        return {"error": "Frame not found"}

    detections = yolo_service.detect(frame_path)
    return {"project_id": req.project_id, "frame_index": req.frame_index, "objects": detections}
