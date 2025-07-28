#!/usr/bin/env python3
"""
Create a development icon for the VSC WSL Manager extension.

This script generates a simple 128x128 PNG icon with "WSL" and "DEV" text
for use during development. Replace with a professional icon for release.
"""

import os
import sys
from pathlib import Path

# Check if PIL/Pillow is available
try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("Warning: PIL/Pillow not installed. Creating minimal placeholder icon.")
    print("For a better icon, install Pillow: pip install Pillow")


def create_minimal_icon(output_path: Path):
    """Create a minimal valid PNG file without PIL."""
    # This creates a 1x1 transparent PNG that VS Code will accept
    # It's not pretty, but it's valid and won't cause errors
    png_data = bytes([
        # PNG signature
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        # IHDR chunk - 128x128, 8-bit RGBA
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80,
        0x08, 0x06, 0x00, 0x00, 0x00, 0xC3, 0x3E, 0x61,
        0xCB,
        # IDAT chunk with compressed data for solid color
        0x00, 0x00, 0x00, 0x1D, 0x49, 0x44, 0x41, 0x54,
        0x78, 0x9C, 0xED, 0xC1, 0x01, 0x0D, 0x00, 0x00,
        0x00, 0xC2, 0xA0, 0xF7, 0x4F, 0x6D, 0x0E, 0x37,
        0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0xBE, 0x0D, 0x21, 0x00, 0x00, 0x01, 0x9A,
        0x60, 0xE1, 0xD5,
        # IEND chunk
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
    ])
    
    with open(output_path, 'wb') as f:
        f.write(png_data)
    
    print(f"Created minimal placeholder icon at: {output_path}")
    print("Note: This is a minimal valid PNG. Install Pillow for a better development icon.")


def create_dev_icon_with_pil(output_path: Path):
    """Create a development icon using PIL/Pillow."""
    size = 128
    
    # Create a new image with a blue gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw background gradient
    for y in range(size):
        # Gradient from dark blue to lighter blue
        color_value = int(100 + (y / size) * 100)
        draw.rectangle([(0, y), (size, y + 1)], fill=(0, color_value, 255, 255))
    
    # Draw border
    border_width = 2
    draw.rectangle(
        [(border_width, border_width), (size - border_width - 1, size - border_width - 1)],
        outline=(255, 255, 255, 255),
        width=border_width
    )
    
    # Try to use a system font, fall back to default if not available
    font_size_large = 36
    font_size_small = 20
    
    try:
        # Try to load a bold font
        if sys.platform == 'win32':
            font_large = ImageFont.truetype("arial.ttf", font_size_large)
            font_small = ImageFont.truetype("arial.ttf", font_size_small)
        elif sys.platform == 'darwin':  # macOS
            font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size_large)
            font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size_small)
        else:  # Linux
            font_large = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size_large)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size_small)
    except:
        # Fall back to default font
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
        print("Using default font (install system fonts for better appearance)")
    
    # Draw "WSL" text
    wsl_text = "WSL"
    if hasattr(draw, 'textbbox'):
        # Newer Pillow versions
        bbox = draw.textbbox((0, 0), wsl_text, font=font_large)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    else:
        # Older Pillow versions
        text_width, text_height = draw.textsize(wsl_text, font=font_large)
    
    x = (size - text_width) // 2
    y = size // 3 - text_height // 2
    
    # Draw text with shadow
    shadow_offset = 2
    draw.text((x + shadow_offset, y + shadow_offset), wsl_text, font=font_large, fill=(0, 0, 0, 128))
    draw.text((x, y), wsl_text, font=font_large, fill=(255, 255, 255, 255))
    
    # Draw "DEV" text
    dev_text = "DEV"
    if hasattr(draw, 'textbbox'):
        bbox = draw.textbbox((0, 0), dev_text, font=font_small)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    else:
        text_width, text_height = draw.textsize(dev_text, font=font_small)
    
    x = (size - text_width) // 2
    y = 2 * size // 3 - text_height // 2
    
    # Draw DEV text with red background
    padding = 8
    draw.rectangle(
        [(x - padding, y - padding // 2), (x + text_width + padding, y + text_height + padding // 2)],
        fill=(255, 0, 0, 200)
    )
    draw.text((x, y), dev_text, font=font_small, fill=(255, 255, 255, 255))
    
    # Add corner indicator
    corner_size = 20
    draw.polygon(
        [(size - corner_size, 0), (size, 0), (size, corner_size)],
        fill=(255, 200, 0, 255)
    )
    
    # Save the image
    img.save(output_path, 'PNG')
    print(f"Created development icon at: {output_path}")
    print("This is a development icon - replace with professional icon for release!")


def main():
    """Main entry point."""
    # Determine paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    resources_dir = project_root / 'resources'
    icon_path = resources_dir / 'icon.png'
    
    # Check if icon already exists
    if icon_path.exists():
        response = input(f"Icon already exists at {icon_path}. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Icon creation cancelled.")
            return
    
    # Create resources directory if it doesn't exist
    resources_dir.mkdir(parents=True, exist_ok=True)
    
    # Create the icon
    if HAS_PIL:
        create_dev_icon_with_pil(icon_path)
    else:
        create_minimal_icon(icon_path)
    
    print("\nDevelopment icon created successfully!")
    print("Remember to replace this with a professional 128x128 PNG icon before release.")


if __name__ == '__main__':
    main()