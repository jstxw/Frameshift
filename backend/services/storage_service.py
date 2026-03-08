"""Supabase Storage service — uploads extracted frames for persistent access."""
import os
import asyncio
import httpx
from pathlib import Path

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "videos"
MAX_CONCURRENT = 20


async def _upload_one(client: httpx.AsyncClient, semaphore: asyncio.Semaphore,
                      project_id: str, frame_path: Path) -> bool:
    async with semaphore:
        path = f"{project_id}/{frame_path.name}"
        url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
        try:
            data = frame_path.read_bytes()
            resp = await client.post(
                url,
                content=data,
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "image/jpeg",
                },
                timeout=30.0,
            )
            return resp.status_code in (200, 201, 409)  # 409 = already exists, still ok
        except Exception as e:
            print(f"[storage] Upload failed for {frame_path.name}: {e}")
            return False


async def _upload_all(project_id: str, frames_dir: Path) -> str:
    frame_files = sorted(frames_dir.glob("frame_*.jpg"))
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    async with httpx.AsyncClient() as client:
        tasks = [_upload_one(client, semaphore, project_id, f) for f in frame_files]
        results = await asyncio.gather(*tasks)
    success = sum(results)
    print(f"[storage] Uploaded {success}/{len(frame_files)} frames for {project_id}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{project_id}"


def upload_frames(project_id: str, frames_dir: Path) -> str:
    """Sync wrapper — safe to call from FastAPI background task threads."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[storage] Supabase env vars not set — skipping frame upload")
        return ""
    return asyncio.run(_upload_all(project_id, frames_dir))
