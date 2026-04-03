"""
Generate cohesive UI illustrations for LLMEnglish.
Uses OpenAI-compatible API (LiteLLM proxy) with Gemini image model.
"""

import base64
import os
import sys

import openai

client = openai.OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY") or os.environ.get("LITELLM_API_KEY", ""),
    base_url=os.environ.get("IMAGE_API_BASE_URL", "https://api.openai.com/v1"),
)

BASE_STYLE = "Warm, inviting illustration in a soft anime/cartoon style inspired by Studio Ghibli. Cozy atmosphere with soft natural lighting, warm but NOT amber or sepia-toned. Color palette includes wood browns, leafy greens, warm cream, soft pink, muted teal, and gentle orange accents. Maintain natural color variety -- each object should have its own distinct color. Gentle bokeh effects in the background. Visible but soft linework, no detailed faces on people. Clean composition suitable as a UI card thumbnail, no text overlays"

THEMES = {
    "food": "a close-up of a beautifully plated meal on a restaurant table, warm lighting",
    "travel": "a suitcase with passport and boarding pass, world map in background",
    "shopping": "colorful shopping bags arranged together, storefront display windows behind",
    "work": "a laptop on a desk with coffee cup, modern office backdrop with windows",
    "health": "a stethoscope and medical chart, clean clinical setting with soft lighting",
    "social": "group of friends chatting at an outdoor cafe, string lights overhead",
    "transport": "a taxi and bus at a city bus stop, urban street scene",
    "entertainment": "movie theater seats with a big screen, popcorn bucket in foreground",
    "education": "stack of textbooks with an apple on top, classroom blackboard behind",
    "custom": "a magic wand with sparkles, blank canvas suggesting creativity and possibility",
}

MODES = {
    "phrases": "a person speaking into a speech bubble with English text fragments, notebook nearby",
    "texts": "an open book with highlighted paragraphs, microphone beside it",
    "situations": "a theater stage with two characters in a roleplay scenario, spotlight",
    "scripts": "a movie clapperboard with a dialogue script page, spotlight beam",
    "simulation": "two people having a conversation in a cozy cafe, speech bubbles above",
    "visual": "a camera viewfinder framing a colorful scene, magnifying glass nearby",
    "trails": "a winding path through diverse landmarks like airport, restaurant, and office",
}

TRAILS = {
    "travel": "an airport terminal with departure boards, planes visible through large windows, travelers with luggage, warm interior lighting",
    "food": "a cozy restaurant interior with warm lighting, beautifully set tables, and a welcoming kitchen in background",
    "shopping": "a colorful shopping street with inviting storefronts, display windows, and shopping bags",
    "work": "a modern open-plan office with meeting rooms, whiteboards, and a professional atmosphere",
    "health": "a clean, welcoming clinic lobby with a reception desk, plants, and a calming atmosphere",
}

BACKGROUNDS = {
    "discovery": "Abstract minimal pattern with very subtle teal geometric shapes on pure white, extremely light and airy",
    "exercises": "Abstract minimal pattern with faint circles and lines in light teal, barely visible on white",
    "live": "Abstract minimal pattern with soft sound wave shapes in very light teal on white",
}


def generate_image(item_id: str, description: str, output_dir: str, size: str = "512x512", force: bool = False) -> str:
    output_path = os.path.join(output_dir, f"{item_id}.png")
    if os.path.exists(output_path) and not force:
        print(f"  Skipping {item_id} (already exists, use --force to regenerate)")
        return output_path

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
    with open(output_path, "wb") as f:
        f.write(image_data)

    print(f"saved ({len(image_data)} bytes)")
    return output_path


def main():
    base_dir = os.path.join(os.path.dirname(__file__), "..", "public", "images")
    force = "--force" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--force"]

    if len(args) < 1:
        print("Usage: python generate_images.py [themes|modes|trails|backgrounds] [optional: specific_id] [--force]")
        sys.exit(1)

    category = args[0]
    specific_id = args[1] if len(args) > 1 else None

    if category == "themes":
        output_dir = os.path.join(base_dir, "themes")
        items = THEMES
        size = "512x512"
    elif category == "modes":
        output_dir = os.path.join(base_dir, "modes")
        items = MODES
        size = "512x512"
    elif category == "trails":
        output_dir = os.path.join(base_dir, "trails")
        items = TRAILS
        size = "1024x1024"
    elif category == "backgrounds":
        output_dir = os.path.join(base_dir, "backgrounds")
        items = BACKGROUNDS
        size = "1024x1024"
    else:
        print(f"Unknown category: {category}. Use: themes, modes, trails, backgrounds")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    if specific_id:
        if specific_id not in items:
            print(f"Unknown {category} id: {specific_id}. Available: {', '.join(items.keys())}")
            sys.exit(1)
        generate_image(specific_id, items[specific_id], output_dir, size, force)
    else:
        print(f"Generating {len(items)} {category}:")
        for item_id, desc in items.items():
            generate_image(item_id, desc, output_dir, size, force)

    print("Done!")


if __name__ == "__main__":
    main()
