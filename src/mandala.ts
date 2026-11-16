// Ported from the My Sanatan app (the_scroll_app/src/art.ts): procedural mandala as SVG.
// Colour keys: a=accent2 (red) g=accent (gold) m=accent2 p=bg.
type Layer = (string | number | null)[];

export function mandalaSvg(layers: Layer[], colors: { a: string; g: string; m: string; p: string }) {
  const col = (k: unknown) => (k === 'none' ? 'none' : (colors as Record<string, string>)[k as string] ?? String(k));
  let out = '';
  for (const L of layers) {
    const type = L[0];
    if (type === 'ring') {
      out += `<circle r="${L[1]}" fill="none" stroke="${col(L[2])}" stroke-width="${L[3]}"${L[4] ? ` stroke-dasharray="${L[4]}"` : ''}/>`;
    } else if (type === 'circ') {
      out += `<circle r="${L[1]}" fill="${col(L[2])}"${L[3] ? ` stroke="${col(L[3])}" stroke-width="${L[4]}"` : ''}${L[5] ? ` opacity="${L[5]}"` : ''}/>`;
    } else if (type === 'dots') {
      const [, n, r, s, c, off = 0] = L as [string, number, number, number, string, number?];
      for (let i = 0; i < n; i++) {
        const t = ((i + off) * 2 * Math.PI) / n;
        out += `<circle cx="${(r * Math.sin(t)).toFixed(2)}" cy="${(-r * Math.cos(t)).toFixed(2)}" r="${s}" fill="${col(c)}"/>`;
      }
    } else if (type === 'petal') {
      const [, n, r1, r2, w, fill, op = 1, st, sw = 0, off = 0] = L as [string, number, number, number, number, string, number?, string?, number?, number?];
      const m = (r1 + r2) / 2;
      const d = `M0,${-r1} Q${w},${-m} 0,${-r2} Q${-w},${-m} 0,${-r1}Z`;
      for (let i = 0; i < n; i++) {
        out += `<path d="${d}" transform="rotate(${(((i + off) * 360) / n).toFixed(2)})" fill="${col(fill)}" fill-opacity="${op}"${st ? ` stroke="${col(st)}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">${out}</svg>`;
}

// The app's landing mandala.
export const LANDING: Layer[] = [['ring', 98, 'g', 1], ['dots', 64, 94, 1.3, 'g'], ['petal', 32, 70, 90, 5, 'a', 0.4], ['ring', 70, 'g', 1], ['petal', 16, 44, 72, 14, 'a', 0.14, 'a', 1.1], ['petal', 16, 48, 66, 8, 'none', 1, 'g', 1, 0.5], ['ring', 44, 'a', 1.1], ['dots', 16, 38, 1.8, 'g', 0.5], ['petal', 8, 16, 40, 12, 'a', 0.85], ['petal', 8, 18, 32, 6, 'g', 0.9, null, 0, 0.5], ['circ', 12, 'p', 'g', 1.4], ['circ', 5.5, 'm']];
