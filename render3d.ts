// ============================================================
// Triangle rasterizer and color shading
// ============================================================

class Tri3D {
    public i0: number
    public i1: number
    public i2: number
    public color: number

    constructor(i0: number, i1: number, i2: number, color: number) {
        this.i0 = i0
        this.i1 = i1
        this.i2 = i2
        this.color = color
    }
}

class RenderFace {
    public sx0: number
    public sy0: number
    public sx1: number
    public sy1: number
    public sx2: number
    public sy2: number
    public color: number
    public depth: number

    constructor() {
        this.sx0 = 0; this.sy0 = 0
        this.sx1 = 0; this.sy1 = 0
        this.sx2 = 0; this.sy2 = 0
        this.color = 0
        this.depth = 0
    }
}

namespace Rasterizer {
    // Darken lookup: maps color index to a darker shade
    const DARK: number[] = [
        0,   // 0 transparent
        12,  // 1 white -> dark gray
        14,  // 2 red -> brown
        2,   // 3 pink -> red
        2,   // 4 orange -> red
        4,   // 5 yellow -> orange
        15,  // 6 teal -> black
        6,   // 7 green -> teal
        12,  // 8 blue -> dark purple
        8,   // 9 light blue -> blue
        12,  // 10 purple -> dark purple
        8,   // 11 light purple -> blue
        15,  // 12 dark gray -> black
        4,   // 13 tan -> orange
        15,  // 14 brown -> black
        15   // 15 black -> black
    ]

    export function shadeColor(col: number, light: number): number {
        if (col <= 0 || col > 15) return col
        if (light > 0.3) return col
        if (light > -0.2) return DARK[col]
        return DARK[DARK[col]]
    }

    export function fillTriangle(
        img: Image,
        x0: number, y0: number,
        x1: number, y1: number,
        x2: number, y2: number,
        col: number
    ): void {
        // Round to integers
        x0 = Math.round(x0); y0 = Math.round(y0)
        x1 = Math.round(x1); y1 = Math.round(y1)
        x2 = Math.round(x2); y2 = Math.round(y2)

        // Sort vertices by Y ascending
        let tmp: number
        if (y0 > y1) {
            tmp = x0; x0 = x1; x1 = tmp
            tmp = y0; y0 = y1; y1 = tmp
        }
        if (y0 > y2) {
            tmp = x0; x0 = x2; x2 = tmp
            tmp = y0; y0 = y2; y2 = tmp
        }
        if (y1 > y2) {
            tmp = x1; x1 = x2; x2 = tmp
            tmp = y1; y1 = y2; y2 = tmp
        }

        const dy20 = y2 - y0
        if (dy20 === 0) return

        const dy10 = y1 - y0
        const dy21 = y2 - y1

        // Upper half (y0 to y1)
        const yStart0 = Math.max(0, y0)
        const yEnd0 = Math.min(119, y1)
        for (let y = yStart0; y <= yEnd0; y++) {
            const a = (y - y0) / dy20
            const b = dy10 > 0 ? (y - y0) / dy10 : 1
            let xa = x0 + (x2 - x0) * a
            let xb = x0 + (x1 - x0) * b
            if (xa > xb) { tmp = xa; xa = xb; xb = tmp }
            const ixa = Math.max(0, Math.ceil(xa))
            const ixb = Math.min(159, Math.floor(xb))
            if (ixa <= ixb) {
                img.fillRect(ixa, y, ixb - ixa + 1, 1, col)
            }
        }

        // Lower half (y1+1 to y2)
        const yStart1 = Math.max(0, y1 + 1)
        const yEnd1 = Math.min(119, y2)
        for (let y = yStart1; y <= yEnd1; y++) {
            const a = (y - y0) / dy20
            const b = dy21 > 0 ? (y - y1) / dy21 : 1
            let xa = x0 + (x2 - x0) * a
            let xb = x1 + (x2 - x1) * b
            if (xa > xb) { tmp = xa; xa = xb; xb = tmp }
            const ixa = Math.max(0, Math.ceil(xa))
            const ixb = Math.min(159, Math.floor(xb))
            if (ixa <= ixb) {
                img.fillRect(ixa, y, ixb - ixa + 1, 1, col)
            }
        }
    }
}
