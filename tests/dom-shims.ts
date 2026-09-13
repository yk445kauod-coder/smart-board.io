// Preload: provide browser globals pdfjs-dist needs before the app module
// graph is imported in a Node (non-browser) test environment.
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor() {}
    multiplySelf() { return this; }
    toJSON() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
  };
}
if (typeof (globalThis as any).DOMPoint === 'undefined') {
  (globalThis as any).DOMPoint = class DOMPoint {
    x = 0; y = 0; z = 0; w = 1;
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  };
}
if (typeof (globalThis as any).Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {};
}