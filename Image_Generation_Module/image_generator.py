import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

# Nano Banana
MODEL_NAME = "gemini-2.5-flash-image"

# Supported garment image formats
SUPPORTED_EXTENSIONS = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}


# ============================================================
# GEMINI CLIENT
# ============================================================

_client = None


def _get_gemini_client():
    """Create the Gemini client on first use so imports succeed without a key."""
    global _client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        raise ValueError(
            "GEMINI_API_KEY is missing. "
            "Please add your Gemini API key to the .env file."
        )
    if _client is None:
        _client = genai.Client(api_key=api_key)
    return _client


# ============================================================
# MAIN IMAGE GENERATION FUNCTION
# ============================================================

def generate_garment_image(
    garment_image_path: Optional[str] = None,
    output_path: str = "output/generated_image.png",
    background: str = (
        "a premium, bright and elegant children's fashion studio "
        "with soft natural lighting and a clean neutral background"
    ),
    age: str = "2 to 4 years old",
    gender: str = "a child",
    custom_prompt: Optional[str] = None,
    aspect_ratio: str = "1:1",
) -> str:
    """
    Generate a professional children's fashion image.

    MODE 1:
        Garment image + text
        -> child wearing the exact garment
        -> new background

    MODE 2:
        Text only
        -> normal AI image generation

    Parameters
    ----------
    garment_image_path:
        Path to the garment image.
        Supported formats: JPG, JPEG, PNG.

    output_path:
        Location where the generated image will be saved.

    background:
        Description of the desired new background.

    age:
        Approximate age of the child model.

    gender:
        Optional gender/model description.

    custom_prompt:
        Additional instructions from the website/admin.

    aspect_ratio:
        Output aspect ratio.
        Examples:
            "1:1"
            "4:5"
            "3:4"
            "16:9"

    Returns
    -------
    str
        Path to the generated image.
    """

    # --------------------------------------------------------
    # Validate garment image
    # --------------------------------------------------------

    garment_path = None

    if garment_image_path:
        garment_path = Path(garment_image_path)

        if not garment_path.exists():
            raise FileNotFoundError(
                f"Garment image not found: {garment_image_path}"
            )

        if not garment_path.is_file():
            raise ValueError(
                f"The provided garment path is not a file: "
                f"{garment_image_path}"
            )

        extension = garment_path.suffix.lower()

        if extension not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                "Unsupported image format. "
                "Please use JPG, JPEG, or PNG."
            )

        mime_type = SUPPORTED_EXTENSIONS[extension]

        # Read image bytes
        image_bytes = garment_path.read_bytes()

    else:
        image_bytes = None
        mime_type = None

    # --------------------------------------------------------
    # Build the prompt
    # --------------------------------------------------------

    if garment_path:

        prompt = f"""
Create a highly realistic professional children's fashion photograph.

The uploaded image is the ORIGINAL GARMENT PRODUCT.

The primary objective is to make {gender}, approximately {age},
naturally wear the EXACT garment shown in the uploaded image.

============================================================
GARMENT FIDELITY — EXTREMELY IMPORTANT
============================================================

Treat the uploaded garment as the authoritative product reference.

Preserve the garment as accurately as possible:

- exact original color
- exact fabric/material appearance
- exact texture
- exact pattern
- exact print
- exact embroidery
- exact stitching
- exact collar
- exact neckline
- exact sleeves
- exact cuffs
- exact buttons
- exact pockets
- exact seams
- exact trims
- exact visible design elements
- exact overall garment style

Do NOT redesign the garment.

Do NOT replace it with a similar garment.

Do NOT invent additional patterns.

Do NOT change its primary color.

Do NOT remove important garment details.

Do NOT add logos, text or decorations that are not present
on the original garment.

The garment must remain recognizable as the SAME PRODUCT
shown in the uploaded image.

============================================================
CHILD MODEL
============================================================

Create a realistic {gender}, approximately {age}.

The child should:

- look natural and age-appropriate
- have realistic skin and hair
- have realistic body proportions
- have a natural facial expression
- have a natural pose
- wear the garment correctly
- have realistic interaction between the body and clothing

The garment should fit naturally on the child.

Generate realistic:

- fabric folds
- wrinkles
- stitching
- shadows
- highlights
- cloth tension
- contact shadows

============================================================
BACKGROUND
============================================================

Completely replace the original product-photo background.

Create this new background:

{background}

The background should look like a professional
children's fashion photoshoot.

The background must NOT distract from the garment.

============================================================
PHOTOGRAPHY STYLE
============================================================

Create a photorealistic commercial fashion photograph.

Use:

- professional children's fashion photography
- realistic studio lighting
- soft natural shadows
- realistic skin texture
- realistic fabric texture
- professional composition
- clean photography
- premium e-commerce quality
- sharp garment details
- natural depth of field

The garment must remain the main visual focus.

============================================================
CUSTOM USER INSTRUCTIONS
============================================================
"""

        if custom_prompt:
            prompt += f"""

The website/admin has provided these additional instructions:

{custom_prompt}

Follow these instructions while still preserving
the original garment accurately.
"""

        prompt += """

============================================================
STRICT NEGATIVE REQUIREMENTS
============================================================

Do NOT:

- redesign the garment
- change the garment's color
- replace the garment
- distort the garment
- remove important garment details
- add unrelated clothing
- add unnecessary accessories
- add text
- add captions
- add watermarks
- add product labels
- add artificial-looking skin
- create cartoon/anime styling
- create an illustration
- create an obviously AI-generated appearance

The final result should look like a REAL professional
children's fashion photograph for an online clothing store.
"""

        contents = [
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type,
            ),
            prompt,
        ]

    else:

        # ----------------------------------------------------
        # TEXT-ONLY MODE
        # ----------------------------------------------------

        if not custom_prompt:
            raise ValueError(
                "Either provide a garment_image_path "
                "or provide a custom_prompt for text-only generation."
            )

        prompt = f"""
Create a highly realistic professional children's fashion photograph.

Create:

{custom_prompt}

Model age:
{age}

Model description:
{gender}

Background:
{background}

Photography requirements:

- photorealistic
- professional children's fashion photography
- realistic skin
- realistic hair
- realistic clothing
- realistic lighting
- realistic shadows
- premium e-commerce photography
- natural pose
- clean composition

Do NOT add:
- text
- captions
- watermarks
- logos unless explicitly requested
- cartoon styling
- anime styling
- artificial-looking skin
"""

        contents = [prompt]

    # --------------------------------------------------------
    # Generate image with Nano Banana
    # --------------------------------------------------------

    try:

        response = _get_gemini_client().models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                response_format={
                    "image": {
                        "aspect_ratio": aspect_ratio
                    }
                },
            ),
        )

    except Exception as error:

        raise RuntimeError(
            f"Gemini image generation failed: {error}"
        ) from error

    # --------------------------------------------------------
    # Prepare output directory
    # --------------------------------------------------------

    output_file = Path(output_path)

    output_file.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Extract generated image
    # --------------------------------------------------------

    if not response.parts:
        raise RuntimeError(
            "Gemini returned an empty response. "
            "Check your API key, model access and quota."
        )

    for part in response.parts:

        if part.inline_data is not None:

            generated_image = part.as_image()

            generated_image.save(output_file)

            return str(output_file.resolve())

    # --------------------------------------------------------
    # No image found
    # --------------------------------------------------------

    raise RuntimeError(
        "Gemini completed the request but did not return "
        "an image. Check model access, quota and API response."
    )