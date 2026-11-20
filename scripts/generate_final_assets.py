#!/usr/bin/env python3
"""
SkillVault Master Logo & Icon Suite Generator
Generates:
  - Vector SVG logo (full squircle and transparent mark)
  - Next.js and browser raster icons (icon.png, apple-icon.png, favicon.ico)
Built using Python Pillow and NumPy with 4x supersampling for flawless antialiasing.
"""

import os
import math
import numpy as np
from PIL import Image, ImageDraw

def render_master_logo(size=2048, transparent_bg=False):
    """
    Renders the SkillVault Monolithic Vault Mark (Interlocking S + V).
    Using supersampling at 2048x2048.
    """
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    pad = int(size * 0.05)
    r = int(size * 0.22)

    # 1. Background Container
    if not transparent_bg:
        bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        bg_draw = ImageDraw.Draw(bg)

        # Deep obsidian/slate squircle base
        bg_draw.rounded_rectangle(
            [pad, pad, size - pad, size - pad],
            radius=r,
            fill=(9, 12, 19, 255),
            outline=(255, 255, 255, 28),
            width=int(size * 0.007)
        )

        # Subtle secondary concentric rim for premium enterprise feel
        inner_pad = pad + int(size * 0.012)
        bg_draw.rounded_rectangle(
            [inner_pad, inner_pad, size - inner_pad, size - inner_pad],
            radius=r - int(size * 0.012),
            outline=(56, 189, 248, 16),
            width=int(size * 0.003)
        )
        canvas = Image.alpha_composite(canvas, bg)

    # 2. Geometry Parameters
    cx = size / 2
    cy = size / 2

    # Scale of mark inside squircle
    S = size * 0.40

    # Upper 'S' Ribbon Plate
    # A bold, geometric architectural ribbon:
    # Top-Left bar -> Top-Right shoulder -> Diagonal crossbar to lower-center
    poly_s = [
        (cx - S * 0.70, cy - S * 0.85),
        (cx + S * 0.65, cy - S * 0.85),
        (cx + S * 0.65, cy - S * 0.45),
        (cx - S * 0.10, cy - S * 0.45),
        (cx + S * 0.50, cy + S * 0.15),
        (cx + S * 0.50, cy + S * 0.50),
        (cx - S * 0.65, cy + S * 0.50),
        (cx - S * 0.65, cy + S * 0.15),
        (cx + S * 0.10, cy + S * 0.15),
        (cx - S * 0.45, cy - S * 0.45),
        (cx - S * 0.70, cy - S * 0.45),
    ]

    # Lower 'V' Vault Foundation Plate
    # A solid, decisive chevron anchoring the base of the vault:
    poly_v = [
        (cx - S * 0.80, cy - S * 0.10),
        (cx - S * 0.45, cy - S * 0.10),
        (cx, cy + S * 0.55),
        (cx + S * 0.45, cy - S * 0.10),
        (cx + S * 0.80, cy - S * 0.10),
        (cx, cy + S * 0.95),
    ]

    # Cryptographic Vault Core (Rhombus/Diamond)
    poly_core = [
        (cx, cy - S * 0.10),
        (cx + S * 0.10, cy),
        (cx, cy + S * 0.10),
        (cx - S * 0.10, cy),
    ]

    def render_poly_gradient(points, c1, c2, angle_deg=45):
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).polygon([(int(x), int(y)) for x, y in points], fill=255)

        xs = np.linspace(0, 1, size)
        ys = np.linspace(0, 1, size)
        xx, yy = np.meshgrid(xs, ys)

        rad = math.radians(angle_deg)
        proj = xx * math.cos(rad) + yy * math.sin(rad)
        proj = (proj - proj.min()) / (proj.max() - proj.min() + 1e-6)

        c_start = np.array(c1, dtype=float)
        c_end = np.array(c2, dtype=float)

        arr = np.zeros((size, size, 4), dtype=np.uint8)
        for c in range(4):
            arr[:, :, c] = np.clip(c_start[c] + (c_end[c] - c_start[c]) * proj, 0, 255).astype(np.uint8)

        grad_img = Image.fromarray(arr, 'RGBA')
        res = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        res.paste(grad_img, (0, 0), mask)
        return res

    # Render plates with refined directional lighting
    # Lower V: Deep Cobalt to Vibrant Royal
    plate_v = render_poly_gradient(
        poly_v,
        c1=(29, 78, 216, 255),    # #1d4ed8
        c2=(37, 99, 235, 255),    # #2563eb
        angle_deg=60
    )

    # Upper S: Vibrant Electric Sky to Cobalt Blue
    plate_s = render_poly_gradient(
        poly_s,
        c1=(56, 189, 248, 255),   # #38bdf8
        c2=(37, 99, 235, 255),    # #2563eb
        angle_deg=35
    )

    # Core Diamond: Electric Cyan to Emerald Core
    plate_core = render_poly_gradient(
        poly_core,
        c1=(56, 189, 248, 255),   # #38bdf8
        c2=(16, 185, 129, 255),   # #10b981
        angle_deg=45
    )

    canvas = Image.alpha_composite(canvas, plate_v)
    canvas = Image.alpha_composite(canvas, plate_s)
    canvas = Image.alpha_composite(canvas, plate_core)

    return canvas

def generate_svg_string():
    """
    Generates scalable SVG markup of the SkillVault logo.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="svBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f1422" />
      <stop offset="100%" stop-color="#070a10" />
    </linearGradient>

    <!-- Border Subtle Rim -->
    <linearGradient id="svRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.04)" />
    </linearGradient>

    <!-- S-Ribbon Gradient: Electric Sky to Cobalt -->
    <linearGradient id="sGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>

    <!-- V-Foundation Gradient: Royal Blue to Cobalt -->
    <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>

    <!-- Core Diamond: Cyan to Emerald -->
    <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>

  <!-- Container Squircle -->
  <rect x="25" y="25" width="462" height="462" rx="112" fill="url(#svBg)" stroke="url(#svRim)" stroke-width="2.5" />
  <rect x="31" y="31" width="450" height="450" rx="106" fill="none" stroke="rgba(56,189,248,0.08)" stroke-width="1.5" />

  <!-- Monolithic Mark: S + V Geometry -->
  <g id="skillvault-mark">
    <!-- Lower V Foundation Plate -->
    <polygon points="
      92, 235
      164, 235
      256, 368
      348, 235
      420, 235
      256, 450
    " fill="url(#vGrad)" />

    <!-- Upper S Ribbon Plate -->
    <polygon points="
      112, 82
      389, 82
      389, 164
      235, 164
      358, 287
      358, 358
      123, 358
      123, 287
      276, 287
      164, 164
      112, 164
    " fill="url(#sGrad)" />

    <!-- Center Vault Cryptographic Core -->
    <polygon points="
      256, 235
      276, 256
      256, 276
      236, 256
    " fill="url(#coreGrad)" />
  </g>
</svg>'''

def main():
    workspace = '/Users/ganeshpirikirala/Desktop/Projects/SkillVault-website'
    frontend_dir = os.path.join(workspace, 'frontend')

    print('[1/5] Generating 2048x2048 master supersampled icon...')
    master_icon = render_master_logo(size=2048, transparent_bg=False)

    # 1. 512x512 Master App Icon (for public/icon.png and src/app/icon.png)
    print('[2/5] Resampling 512x512 App Icon...')
    icon_512 = master_icon.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(frontend_dir, 'public', 'icon.png'), 'PNG')
    icon_512.save(os.path.join(frontend_dir, 'src', 'app', 'icon.png'), 'PNG')

    # 2. 180x180 Apple Touch Icon (for public/apple-icon.png and src/app/apple-icon.png)
    print('[3/5] Resampling 180x180 Apple Touch Icon...')
    icon_180 = master_icon.resize((180, 180), Image.Resampling.LANCZOS)
    icon_180.save(os.path.join(frontend_dir, 'public', 'apple-icon.png'), 'PNG')
    icon_180.save(os.path.join(frontend_dir, 'src', 'app', 'apple-icon.png'), 'PNG')

    # 3. Multi-resolution ICO (16x16, 32x32, 48x48, 64x64) for favicon.ico
    print('[4/5] Building multi-resolution favicon.ico...')
    icon_16 = master_icon.resize((16, 16), Image.Resampling.LANCZOS)
    icon_32 = master_icon.resize((32, 32), Image.Resampling.LANCZOS)
    icon_48 = master_icon.resize((48, 48), Image.Resampling.LANCZOS)
    icon_64 = master_icon.resize((64, 64), Image.Resampling.LANCZOS)

    public_ico_path = os.path.join(frontend_dir, 'public', 'favicon.ico')
    app_ico_path = os.path.join(frontend_dir, 'src', 'app', 'favicon.ico')

    icon_64.save(
        public_ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
        append_images=[icon_48, icon_32, icon_16]
    )
    icon_64.save(
        app_ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
        append_images=[icon_48, icon_32, icon_16]
    )

    # 4. Generate Vector SVGs
    print('[5/5] Generating vector SVG assets...')
    svg_content = generate_svg_string()
    svg_path = os.path.join(frontend_dir, 'public', 'logo.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)

    print('All SkillVault logo & icon assets successfully generated!')

if __name__ == '__main__':
    main()
