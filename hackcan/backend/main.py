from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pydantic import BaseModel
import shutil

from services import cloudinary_service, project_manager

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
