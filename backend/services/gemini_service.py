import os
import base64
from pathlib import Path
from google import genai
from google.genai import types
from google.genai.types import FinishReason
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

_client = None


def _get_client():
    global _client
    if _client is None:
        # Try GOOGLE_API_KEY first (takes precedence), then GEMINI_API_KEY
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            print(f"ERROR: API key not found. Looking for .env at: {env_path}")
            print(f"Make sure either GOOGLE_API_KEY or GEMINI_API_KEY is set in {env_path}")
            print(f"Current env vars: {list(os.environ.keys())}")
            raise RuntimeError("API key not set in environment. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your .env file.")
        
        print(f"Using API key (length: {len(api_key)}, starts with: {api_key[:4]}...)")
        try:
            _client = genai.Client(api_key=api_key)
            print("Gemini client initialized successfully")
        except Exception as e:
            print(f"Failed to initialize Gemini client: {e}")
            raise RuntimeError(f"Failed to initialize Gemini client: {e}")
    return _client


async def edit_frame(frame_path: Path, prompt: str) -> bytes:
    """Send a frame image + text prompt to Gemini and return the edited image bytes."""
    try:
        client = _get_client()

        # Read frame as bytes
        frame_bytes = frame_path.read_bytes()

        # Try the image generation model first
        try:
            response = client.models.generate_content(
                model="gemini-3.1-flash-image-preview",
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg"),
                            types.Part.from_text(
                                text=f"Edit this image: {prompt}. Return only the edited image, keep the same dimensions and aspect ratio."
                            ),
                        ]
                    )
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                ),
            )
        except Exception as e:
            # Fallback to regular flash model if image model doesn't work
            print(f"Image model failed, trying flash model: {str(e)}")
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg"),
                            types.Part.from_text(
                                text=f"Edit this image: {prompt}. Return only the edited image, keep the same dimensions and aspect ratio."
                            ),
                        ]
                    )
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                ),
            )

        # Check for errors in response
        if not response.candidates or len(response.candidates) == 0:
            error_msg = "No candidates in response"
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                error_msg += f": {response.prompt_feedback}"
            raise RuntimeError(error_msg)

        # Check for finish reason errors
        candidate = response.candidates[0]
        if hasattr(candidate, 'finish_reason') and candidate.finish_reason:
            finish_reason = candidate.finish_reason
            # STOP means success, other values indicate errors
            if finish_reason != FinishReason.STOP and finish_reason != 1:
                error_msg = f"Generation stopped with error: finish_reason={finish_reason}"
                if hasattr(candidate, 'safety_ratings') and candidate.safety_ratings:
                    error_msg += f", safety_ratings={candidate.safety_ratings}"
                raise RuntimeError(error_msg)

        # Extract image from response
        if not hasattr(candidate, 'content') or not candidate.content.parts:
            raise RuntimeError("No content parts in response")

        for part in candidate.content.parts:
            if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.mime_type.startswith("image/"):
                return part.inline_data.data

        raise RuntimeError("Gemini did not return an image in the response")
    except Exception as e:
        # Re-raise with more context
        error_str = str(e)
        if isinstance(e, RuntimeError):
            raise
        # Check for common API errors
        if "API key not valid" in error_str or "INVALID_ARGUMENT" in error_str:
            raise RuntimeError(f"Invalid API key. Please verify your GEMINI_API_KEY in .env file. Error: {error_str}")
        elif "quota" in error_str.lower() or "QUOTA_EXCEEDED" in error_str:
            raise RuntimeError(f"Quota exceeded. Image generation requires a paid API key with billing enabled. Error: {error_str}")
        elif "permission" in error_str.lower() or "PERMISSION_DENIED" in error_str:
            raise RuntimeError(f"Permission denied. Make sure your API key has access to image generation models. Error: {error_str}")
        else:
            raise RuntimeError(f"Gemini API error: {error_str}")


async def edit_frame_with_reference(frame_path: Path, prompt: str, reference_frame_path: Path | None = None) -> bytes:
    """Edit a frame using Gemini, optionally with a reference frame for style consistency.
    
    Args:
        frame_path: Path to the target frame to transform
        prompt: Edit instruction text
        reference_frame_path: Optional path to a reference frame to use as style guide
    
    Returns:
        Edited image bytes
    """
    try:
        client = _get_client()

        # Read target frame as bytes
        frame_bytes = frame_path.read_bytes()

        parts = [
            types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg"),
        ]

        # If reference frame is provided, include it with instruction to match style
        if reference_frame_path and reference_frame_path.exists():
            reference_bytes = reference_frame_path.read_bytes()
            parts.append(types.Part.from_bytes(data=reference_bytes, mime_type="image/jpeg"))
            parts.append(
                types.Part.from_text(
                    text=f"Apply the same transformation style from the reference image to this frame. "
                         f"Original edit instruction: {prompt}. "
                         f"Return only the edited image, keep the same dimensions and aspect ratio as the target frame."
                )
            )
        else:
            parts.append(
                types.Part.from_text(
                    text=f"Edit this image: {prompt}. Return only the edited image, keep the same dimensions and aspect ratio."
                )
            )

        # Try the image generation model first
        try:
            response = client.models.generate_content(
                model="gemini-3.1-flash-image-preview",
                contents=[
                    types.Content(parts=parts)
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                ),
            )
        except Exception as e:
            # Fallback to regular flash model if image model doesn't work
            print(f"Image model failed, trying flash model: {str(e)}")
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=[
                    types.Content(parts=parts)
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                ),
            )

        # Check for errors in response
        if not response.candidates or len(response.candidates) == 0:
            error_msg = "No candidates in response"
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                error_msg += f": {response.prompt_feedback}"
            raise RuntimeError(error_msg)

        # Check for finish reason errors
        candidate = response.candidates[0]
        if hasattr(candidate, 'finish_reason') and candidate.finish_reason:
            finish_reason = candidate.finish_reason
            # STOP means success, other values indicate errors
            if finish_reason != FinishReason.STOP and finish_reason != 1:
                error_msg = f"Generation stopped with error: finish_reason={finish_reason}"
                if hasattr(candidate, 'safety_ratings') and candidate.safety_ratings:
                    error_msg += f", safety_ratings={candidate.safety_ratings}"
                raise RuntimeError(error_msg)

        # Extract image from response
        if not hasattr(candidate, 'content') or not candidate.content.parts:
            raise RuntimeError("No content parts in response")

        for part in candidate.content.parts:
            if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.mime_type.startswith("image/"):
                return part.inline_data.data

        raise RuntimeError("Gemini did not return an image in the response")
    except Exception as e:
        # Re-raise with more context
        error_str = str(e)
        if isinstance(e, RuntimeError):
            raise
        # Check for common API errors
        if "API key not valid" in error_str or "INVALID_ARGUMENT" in error_str:
            raise RuntimeError(f"Invalid API key. Please verify your GEMINI_API_KEY in .env file. Error: {error_str}")
        elif "quota" in error_str.lower() or "QUOTA_EXCEEDED" in error_str:
            raise RuntimeError(f"Quota exceeded. Image generation requires a paid API key with billing enabled. Error: {error_str}")
        elif "permission" in error_str.lower() or "PERMISSION_DENIED" in error_str:
            raise RuntimeError(f"Permission denied. Make sure your API key has access to image generation models. Error: {error_str}")
        else:
            raise RuntimeError(f"Gemini API error: {error_str}")
