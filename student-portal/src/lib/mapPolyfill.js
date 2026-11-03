// pdf.js 6 uses Map/WeakMap.prototype.getOrInsert(Computed), which only the newest browsers ship.
// Add them where missing so PDFs open in every supported browser (and inside the pdf.js worker).
for (const C of [Map, WeakMap]) {
  if (!C.prototype.getOrInsert) {
    Object.defineProperty(C.prototype, 'getOrInsert', {
      configurable: true, writable: true,
      value(key, value) { if (!this.has(key)) this.set(key, value); return this.get(key) },
    })
  }
  if (!C.prototype.getOrInsertComputed) {
    Object.defineProperty(C.prototype, 'getOrInsertComputed', {
      configurable: true, writable: true,
      value(key, fn) { if (!this.has(key)) this.set(key, fn(key)); return this.get(key) },
    })
  }
}
