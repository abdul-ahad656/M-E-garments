"""Thin CLI so the Node API can spawn the existing garment generator."""

from __future__ import annotations

import argparse
import json
import sys

from image_generator import generate_garment_image


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a garment fashion image")
    parser.add_argument("--config", required=True, help="Path to JSON config")
    args = parser.parse_args()

    with open(args.config, encoding="utf-8") as handle:
        config = json.load(handle)

    kwargs = {
        "garment_image_path": config.get("garment_image_path") or None,
        "output_path": config["output_path"],
    }
    if config.get("background"):
        kwargs["background"] = config["background"]
    if config.get("age"):
        kwargs["age"] = config["age"]
    if config.get("gender"):
        kwargs["gender"] = config["gender"]
    if config.get("custom_prompt"):
        kwargs["custom_prompt"] = config["custom_prompt"]
    if config.get("aspect_ratio"):
        kwargs["aspect_ratio"] = config["aspect_ratio"]

    result = generate_garment_image(**kwargs)
    print(result)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
