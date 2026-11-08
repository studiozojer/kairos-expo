#!/usr/bin/env python3
"""Compile the committed SVG catalog to tintable paths; fail on unsupported art.

Run after sync-chart-glyphs.mjs, or independently without the iOS checkout.
No SVG parsing or rasterization is needed by the browser at runtime.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RENDER = ROOT / 'src/features/chart/render'
ALLOWED = {
    'svg': {'width', 'height', 'viewBox', 'fill'},
    'path': {'d', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'},
    'line': {'x1', 'y1', 'x2', 'y2', 'transform', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap'},
    'circle': {'cx', 'cy', 'r', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width'},
    'rect': {'x', 'y', 'width', 'height', 'rx', 'fill', 'stroke', 'stroke-opacity', 'stroke-width'},
    'g': {'clip-path'}, 'defs': set(), 'clipPath': {'id'},
}


def compile_svg(source):
    root = ET.fromstring(source)
    for node in root.iter():
        node.tag = node.tag.split('}')[-1]
        if node.tag not in ALLOWED or set(node.attrib) - ALLOWED[node.tag]:
            raise ValueError(f'Unsupported SVG element/attributes: {node.tag} {node.attrib}')
    width, height = float(root.attrib['width']), float(root.attrib['height'])
    if width <= 0 or height <= 0 or list(map(float, root.attrib['viewBox'].split())) != [0, 0, width, height]:
        raise ValueError('Unsupported viewport')
    clips = {}
    for clip in root.iter('clipPath'):
        # The catalog's sole clip is exactly its viewport. The renderer clips
        # every glyph to that viewport, so no additional path is necessary.
        if len(clip) != 1 or clip[0].tag != 'rect':
            raise ValueError('Unsupported clipping shape')
        a = clip[0].attrib
        if any(float(a.get(k, 0)) != v for k, v in [('x', 0), ('y', 0), ('width', width), ('height', height), ('rx', 0)]):
            raise ValueError('Clip must match viewport')
        clips[clip.attrib['id']] = True
    parts = []

    def walk(node, inherited_fill):
        a = node.attrib
        if node.tag == 'defs':
            return
        if node.tag in ('svg', 'g'):
            if node.tag == 'g' and a.get('clip-path') not in {f'url(#{key})' for key in clips}:
                raise ValueError('Unknown clip reference')
            for child in node:
                walk(child, a.get('fill', inherited_fill))
            return
        def number(key, default=0):
            value = float(a.get(key, default))
            if not math.isfinite(value):
                raise ValueError('Non-finite geometry')
            return value
        scale = 1
        if node.tag == 'path':
            d = a['d']
        elif node.tag == 'line':
            x1, y1, x2, y2 = [number(k) for k in ('x1', 'y1', 'x2', 'y2')]
            if 'transform' in a:
                match = re.fullmatch(r'matrix\(([^)]+)\)', a['transform'])
                if not match:
                    raise ValueError('Unsupported line transform')
                aa, b, c, dd, e, f = map(float, match[1].replace(',', ' ').split())
                scale = math.hypot(aa, b)
                if scale == 0 or abs(scale - math.hypot(c, dd)) > 1e-5 or abs(aa*c+b*dd) > 1e-5:
                    raise ValueError('Only uniform rotation/reflection/scale supported for lines')
                x1, y1, x2, y2 = aa*x1+c*y1+e, b*x1+dd*y1+f, aa*x2+c*y2+e, b*x2+dd*y2+f
            d = f'M{x1} {y1}L{x2} {y2}'
        elif node.tag == 'circle':
            x, y, r = number('cx'), number('cy'), number('r')
            d = f'M{x-r} {y}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0Z'
        elif node.tag == 'rect':
            x, y, w, h = number('x'), number('y'), number('width'), number('height')
            r = min(number('rx'), w/2, h/2)
            d = f'M{x} {y}h{w}v{h}h{-w}Z'
            # SVG rounded rectangles use elliptical arcs, not quadratic corners.
            if r:
                d = f'M{x+r} {y}H{x+w-r}A{r} {r} 0 0 1 {x+w} {y+r}V{y+h-r}A{r} {r} 0 0 1 {x+w-r} {y+h}H{x+r}A{r} {r} 0 0 1 {x} {y+h-r}V{y+r}A{r} {r} 0 0 1 {x+r} {y}Z'
        else:
            raise ValueError(f'Unexpected drawable {node.tag}')
        for style in ('fill', 'stroke'):
            color = a.get(style, inherited_fill if style == 'fill' else 'none')
            if color == 'none' or (node.tag == 'line' and style == 'fill'):
                continue
            if not re.fullmatch(r'#[0-9a-fA-F]{6}|white|black', color):
                raise ValueError(f'Unsupported paint {color}')
            opacity = number(f'{style}-opacity', 1)
            if not 0 <= opacity <= 1:
                raise ValueError('Invalid opacity')
            part = {'d': d, 'style': style, 'opacity': opacity}
            if style == 'stroke':
                cap, join = a.get('stroke-linecap', 'butt'), a.get('stroke-linejoin', 'miter')
                if cap not in ('butt', 'round', 'square') or join not in ('miter', 'round', 'bevel'):
                    raise ValueError('Unsupported stroke geometry')
                part.update(strokeWidth=number('stroke-width', 1)*scale, strokeCap=cap, strokeJoin=join)
            parts.append(part)
    walk(root, 'black')
    return {'width': width, 'height': height, 'parts': parts}


def generate():
    mapping = (RENDER / 'glyph-map.gen.ts').read_text()
    entries = re.findall(r'  ("[^"\n]+"):\s*require\(("[^"\n]+")\)', mapping)
    if not entries:
        raise ValueError('No glyphs in generated map')
    digest = hashlib.sha256()
    vectors = {}
    for key, path in entries:
        name = json.loads(key)
        source = (RENDER / json.loads(path)).read_bytes()
        digest.update(name.encode() + b'\0' + source)
        try:
            vectors[name] = compile_svg(source)
        except Exception as error:
            raise ValueError(f'{name}: {error}') from error
    provenance = re.search(r'// Source: (.+)', mapping)[1]
    output = '// GENERATED by scripts/generate-glyph-vectors.py — do not edit.\n'
    output += f'// Source: {provenance}\n// Catalog SHA-256: {digest.hexdigest()}\n'
    output += "import type { GlyphName } from './glyph-map.gen';\nimport type { VectorGlyph } from './vectorGlyphTypes';\n\n"
    output += 'export const GLYPH_VECTORS: Record<GlyphName, VectorGlyph> = ' + json.dumps(vectors, indent=2) + ';\n'
    (RENDER / 'glyph-vectors.gen.ts').write_text(output)
    print(f'Generated {len(vectors)} vector glyphs')


if __name__ == '__main__':
    generate()
