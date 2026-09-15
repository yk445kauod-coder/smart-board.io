## 2026-09-15 - Incremental State Tracking in High-Frequency Canvas Render Loops

**Learning:** Running `Array.prototype.every()` or `Array.prototype.some()` inside `useMemo` hooks or event handlers connected to high-frequency pointer move events (`pointermove`) creates an O(N^2) cumulative performance bottleneck as drawing point count N grows.
**Action:** Use a React `useRef` to incrementally track boolean conditions (like presence of custom pressure data) on incoming new event points in O(1) time per frame, avoiding full array scans on every render frame while drawing.
