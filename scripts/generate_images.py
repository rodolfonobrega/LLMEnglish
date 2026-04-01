"""
Generate flat minimalist illustrations for SpeakLab.
Uses OpenAI-compatible API for image generation.
"""

import base64
import os
import sys

import openai

client = openai.OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY", ""),
    base_url=os.environ.get("IMAGE_API_BASE_URL", "https://api.openai.com/v1"),
)

BASE_STYLE = "Flat minimalist illustration, simple geometric shapes, limited color palette with muted teal and slate tones, editorial style, clean white background, no text, no people faces, icon-like composition"

THEMES = {
    "food": "a plate with fork and knife, steam rising, restaurant table setting",
    "travel": "a suitcase with airplane silhouette and passport",
    "shopping": "shopping bags with price tags and gift boxes",
    "work": "a laptop with briefcase and coffee cup on desk",
    "health": "a stethoscope with heart and medical cross symbol",
    "social": "speech bubbles with handshake gesture",
    "transport": "a car with abstract road signs (no text, no words on signs) and map pin markers",
    "entertainment": "a blank movie clapperboard (no text, no labels, no writing) with popcorn bowl and musical notes floating nearby",
    "education": "an open book with graduation cap and pencil",
    "custom": "a sparkle star shape with lightbulb and question mark, centered composition, pure white background with no border or frame",
}

MODES = {
    "phrases": "a speech bubble with quote marks and sound waves",
    "texts": "a document page with lines of text and a pen",
    "situations": "a theater mask with stage curtain",
    "scripts": "a screenplay document page with indented line blocks and visual formatting structure, absolutely no text, no words, no letters — only colored line shapes representing layout",
    "simulation": "a microphone with conversation arrows going back and forth",
    "interview": "two people silhouettes facing each other across a table",
    "visual": "an eye looking at a framed picture with magnifying glass",
}

BACKGROUNDS = {
    "discovery": "Abstract minimal pattern with very subtle teal geometric shapes on pure white, extremely light and airy",
    "exercises": "Abstract minimal pattern with faint circles and lines in light teal, barely visible on white",
    "live": "Abstract minimal pattern with soft sound wave shapes in very light teal on white",
}


def generate_image(item_id: str, description: str, output_dir: str, size: str = "512x512") -> str:
    prompt = f"{BASE_STYLE}, depicting {description}"
    print(f"  Generating {item_id}... ", end="", flush=True)

    response = client.images.generate(
        model="gemini/gemini-3.1-flash-image-preview",
        prompt=prompt,
        n=1,
        size=size,  # type: ignore[arg-type]
    )

    data = response.data
    assert data is not None, f"No data returned for {item_id}"
    b64 = data[0].b64_json
    assert b64 is not None, f"No b64_json returned for {item_id}"
    image_data = base64.b64decode(b64)
    output_path = os.path.join(output_dir, f"{item_id}.png")
    with open(output_path, "wb") as f:
        f.write(image_data)

    print(f"saved ({len(image_data)} bytes)")
    return output_path


def main():
    base_dir = os.path.join(os.path.dirname(__file__), "..", "public", "images")

    if len(sys.argv) < 2:
        print("Usage: python generate_images.py [themes|modes|backgrounds] [optional: specific_id]")
        sys.exit(1)

    category = sys.argv[1]
    specific_id = sys.argv[2] if len(sys.argv) > 2 else None

    if category == "themes":
        output_dir = os.path.join(base_dir, "themes")
        items = THEMES
        size = "512x512"
    elif category == "modes":
        output_dir = os.path.join(base_dir, "modes")
        items = MODES
        size = "512x512"
    elif category == "backgrounds":
        output_dir = os.path.join(base_dir, "backgrounds")
        items = BACKGROUNDS
        size = "1024x1024"
    else:
        print(f"Unknown category: {category}. Use: themes, modes, backgrounds")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    if specific_id:
        if specific_id not in items:
            print(f"Unknown {category} id: {specific_id}. Available: {', '.join(items.keys())}")
            sys.exit(1)
        generate_image(specific_id, items[specific_id], output_dir, size)
    else:
        print(f"Generating {len(items)} {category}:")
        for item_id, desc in items.items():
            generate_image(item_id, desc, output_dir, size)

    print("Done!")


if __name__ == "__main__":
    main()
