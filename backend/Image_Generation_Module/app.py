from image_generator import generate_garment_image


# ============================================================
# TEST CONFIGURATION
# ============================================================

GARMENT_IMAGE = "input/garment.jpeg"

OUTPUT_IMAGE = "output/generated_image.png"

BACKGROUND = """
a premium children's fashion studio,
bright neutral interior,
soft beige and cream tones,
natural window lighting,
clean elegant setting,
professional e-commerce fashion photography
"""

AGE = "2 to 4 years old"

GENDER = "a realistic toddler"

CUSTOM_PROMPT = """
Create a realistic professional children's fashion photograph.

The toddler should naturally wear the garment from the
uploaded product image.

The garment must remain exactly the same as the original
product, including its color, fabric, pattern, collar,
buttons, pockets, sleeves, cuffs, stitching and all other
visible details.

Make the child look natural and realistic.

Use a new clean premium children's fashion background.

The final image should look like a real professional
clothing-store photoshoot.
"""


# ============================================================
# RUN IMAGE GENERATION
# ============================================================

if __name__ == "__main__":

    print("Starting AI image generation...")
    print("Please wait...")

    try:

        result = generate_garment_image(
            garment_image_path=GARMENT_IMAGE,
            output_path=OUTPUT_IMAGE,
            background=BACKGROUND,
            age=AGE,
            gender=GENDER,
            custom_prompt=CUSTOM_PROMPT,
            aspect_ratio="1:1",
        )

        print()
        print("SUCCESS!")
        print(f"Generated image saved at:")
        print(result)

    except Exception as error:

        print()
        print("IMAGE GENERATION FAILED")
        print(f"Error: {error}")