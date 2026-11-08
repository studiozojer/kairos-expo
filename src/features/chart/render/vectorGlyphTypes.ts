export interface VectorGlyph {
  width: number;
  height: number;
  parts: {
    d: string;
    style: 'fill' | 'stroke';
    opacity: number;
    strokeWidth?: number;
    strokeCap?: 'butt' | 'round' | 'square';
    strokeJoin?: 'miter' | 'round' | 'bevel';
  }[];
}
