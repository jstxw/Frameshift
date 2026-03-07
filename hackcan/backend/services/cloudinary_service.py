import os
import cloudinary
import cloudinary.uploader
import cloudinary.api

def configure():
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )

def upload_file(file_path: str, folder: str = "frameshift", resource_type: str = "image") -> dict:
    result = cloudinary.uploader.upload(
        file_path,
        folder=folder,
        resource_type=resource_type,
    )
    return {
        "public_id": result["public_id"],
        "url": result["secure_url"],
        "width": result.get("width"),
        "height": result.get("height"),
    }

def get_url(public_id: str, transformations: list = None, resource_type: str = "image") -> str:
    options = {"secure": True}
    if transformations:
        options["transformation"] = transformations
    return cloudinary.CloudinaryImage(public_id).build_url(**options)
