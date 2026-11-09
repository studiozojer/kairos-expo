import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('glyph_vectors', Path(__file__).with_name('generate-glyph-vectors.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def svg(body, fill='none'):
    return f'<svg width="20" height="20" viewBox="0 0 20 20" fill="{fill}">{body}</svg>'


class GlyphVectorTests(unittest.TestCase):
    def test_transformed_line_preserves_endpoints_and_stroke(self):
        part = module.compile_svg(svg('<line x1="1" y1="2" x2="3" y2="4" transform="matrix(0 1 -1 0 10 5)" stroke="#123456" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.9"/>'))['parts'][0]
        self.assertEqual(part['d'], 'M8.0 6.0L6.0 8.0')
        self.assertEqual((part['strokeWidth'], part['strokeCap'], part['opacity']), (1.5, 'round', 0.9))

    def test_fill_and_stroke_remain_separate_paints(self):
        parts = module.compile_svg(svg('<circle cx="10" cy="10" r="3" fill="#123456" fill-opacity="0.4" stroke="#123456" stroke-width="2"/>'))['parts']
        self.assertEqual([p['style'] for p in parts], ['fill', 'stroke'])
        self.assertEqual([p['opacity'] for p in parts], [0.4, 1])
        self.assertIn('a3.0 3.0', parts[0]['d'])

    def test_rounded_rectangle_uses_circular_arcs(self):
        path = module.compile_svg(svg('<rect x="5" y="5" width="10" height="10" rx="1" stroke="#000000"/>'))['parts'][0]['d']
        self.assertEqual(path.count('A1.0 1.0'), 4)
        self.assertNotIn('Q', path)

    def test_viewport_clip_is_validated(self):
        body = '<g clip-path="url(#clip)"><path d="M0 0L20 20" stroke="#000000"/></g><defs><clipPath id="clip"><rect width="20" height="20"/></clipPath></defs>'
        self.assertEqual(len(module.compile_svg(svg(body))['parts']), 1)
        with self.assertRaises(ValueError):
            module.compile_svg(svg(body.replace('width="20" height="20"/>', 'width="10" height="20"/>')))

    def test_unsupported_art_fails_instead_of_disappearing(self):
        for body in ['<text>Hi</text>', '<path d="M0 0L2 2" filter="url(#blur)"/>', '<path d="M0 0L2 2" fill="url(#gradient)"/>']:
            with self.subTest(body=body), self.assertRaises(ValueError):
                module.compile_svg(svg(body))


if __name__ == '__main__':
    unittest.main()
