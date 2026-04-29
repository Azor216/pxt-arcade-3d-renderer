// ============================================================
// Triangle rasterizer and color shading
// ============================================================

class Tri3D {
    public i0: number
    public i1: number
    public i2: number
    public color: number
    // UV coordinates per vertex (0.0 - 1.0)
    public u0: number; public v0: number
    public u1: number; public v1: number
    public u2: number; public v2: number
    public texId: number  // -1 = no texture

    constructor(i0: number, i1: number, i2: number, color: number) {
        this.i0 = i0
        this.i1 = i1
        this.i2 = i2
        this.color = color
        this.u0 = 0; this.v0 = 0
        this.u1 = 1; this.v1 = 0
        this.u2 = 0; this.v2 = 1
        this.texId = -1
    }
}

class RenderFace {
    public sx0: number; public sy0: number
    public sx1: number; public sy1: number
    public sx2: number; public sy2: number
    public color: number
    public depth: number
    // Perspective-correct UV: store u/z, v/z, 1/z per vertex
    public uz0: number; public vz0: number; public iz0: number
    public uz1: number; public vz1: number; public iz1: number
    public uz2: number; public vz2: number; public iz2: number
    public texId: number
    public shade: number  // 0=bright, 1=medium, 2=dark

    constructor() {
        this.sx0 = 0; this.sy0 = 0
        this.sx1 = 0; this.sy1 = 0
        this.sx2 = 0; this.sy2 = 0
        this.color = 0; this.depth = 0
        this.uz0 = 0; this.vz0 = 0; this.iz0 = 0
        this.uz1 = 0; this.vz1 = 0; this.iz1 = 0
        this.uz2 = 0; this.vz2 = 0; this.iz2 = 0
        this.texId = -1
        this.shade = 0
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
        return DARK[col]  // max 1 level darkening
    }

    export function shadeLevel(light: number): number {
        if (light > 0.3) return 0
        if (light > -0.2) return 1
        return 2
    }

    export function shadePixel(col: number, shade: number): number {
        if (col <= 0 || col > 15) return col
        if (shade === 0) return col
        return DARK[col]  // max 1 level of darkening for textures
    }

    // ---- Texture storage ----
    let _textures: Image[] = []

    export function registerTexture(img: Image): number {
        const id = _textures.length
        _textures.push(img)
        return id
    }

    export function getTexture(id: number): Image {
        if (id >= 0 && id < _textures.length) return _textures[id]
        return null
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

    // Textured triangle rasterizer with perspective-correct UV
    // (no nested functions - MakeCode STS compatible)
    export function fillTriangleTex(
        img: Image, tex: Image, shade: number,
        x0: number, y0: number, uz0: number, vz0: number, iz0: number,
        x1: number, y1: number, uz1: number, vz1: number, iz1: number,
        x2: number, y2: number, uz2: number, vz2: number, iz2: number
    ): void {
        x0 = Math.round(x0); y0 = Math.round(y0)
        x1 = Math.round(x1); y1 = Math.round(y1)
        x2 = Math.round(x2); y2 = Math.round(y2)

        const tw = tex.width
        const th = tex.height
        let tmp: number

        // Sort by Y (carry UVZ along)
        if (y0 > y1) {
            tmp = x0; x0 = x1; x1 = tmp; tmp = y0; y0 = y1; y1 = tmp
            tmp = uz0; uz0 = uz1; uz1 = tmp; tmp = vz0; vz0 = vz1; vz1 = tmp
            tmp = iz0; iz0 = iz1; iz1 = tmp
        }
        if (y0 > y2) {
            tmp = x0; x0 = x2; x2 = tmp; tmp = y0; y0 = y2; y2 = tmp
            tmp = uz0; uz0 = uz2; uz2 = tmp; tmp = vz0; vz0 = vz2; vz2 = tmp
            tmp = iz0; iz0 = iz2; iz2 = tmp
        }
        if (y1 > y2) {
            tmp = x1; x1 = x2; x2 = tmp; tmp = y1; y1 = y2; y2 = tmp
            tmp = uz1; uz1 = uz2; uz2 = tmp; tmp = vz1; vz1 = vz2; vz2 = tmp
            tmp = iz1; iz1 = iz2; iz2 = tmp
        }

        const dy20 = y2 - y0
        if (dy20 === 0) return
        const dy10 = y1 - y0
        const dy21 = y2 - y1
        const idy20 = 1.0 / dy20

        // Upper half (y0 to y1)
        const yS0 = Math.max(0, y0)
        const yE0 = Math.min(119, y1)
        for (let y = yS0; y <= yE0; y++) {
            const a = (y - y0) * idy20
            const b = dy10 > 0 ? (y - y0) / dy10 : 1
            let xa = x0 + (x2 - x0) * a
            let xb = x0 + (x1 - x0) * b
            let uza = uz0 + (uz2 - uz0) * a
            let vza = vz0 + (vz2 - vz0) * a
            let iza = iz0 + (iz2 - iz0) * a
            let uzb = uz0 + (uz1 - uz0) * b
            let vzb = vz0 + (vz1 - vz0) * b
            let izb = iz0 + (iz1 - iz0) * b
            if (xa > xb) {
                tmp = xa; xa = xb; xb = tmp
                tmp = uza; uza = uzb; uzb = tmp
                tmp = vza; vza = vzb; vzb = tmp
                tmp = iza; iza = izb; izb = tmp
            }
            const ixa = Math.max(0, Math.ceil(xa))
            const ixb = Math.min(159, Math.floor(xb))
            if (ixa <= ixb) {
                const span = xb - xa
                const ispan = span > 0 ? 1.0 / span : 0
                for (let x = ixa; x <= ixb; x++) {
                    const t = (x - xa) * ispan
                    const iz = iza + (izb - iza) * t
                    if (iz < 0.0001) continue
                    const rz = 1.0 / iz
                    const u = (uza + (uzb - uza) * t) * rz
                    const v = (vza + (vzb - vza) * t) * rz
                    let tx = Math.floor(u * tw) % tw
                    let ty = Math.floor(v * th) % th
                    if (tx < 0) tx += tw
                    if (ty < 0) ty += th
                    let c = tex.getPixel(tx, ty)
                    if (c === 0) continue
                    c = shadePixel(c, shade)
                    img.setPixel(x, y, c)
                }
            }
        }

        // Lower half (y1+1 to y2)
        const yS1 = Math.max(0, y1 + 1)
        const yE1 = Math.min(119, y2)
        for (let y = yS1; y <= yE1; y++) {
            const a = (y - y0) * idy20
            const b = dy21 > 0 ? (y - y1) / dy21 : 1
            let xa = x0 + (x2 - x0) * a
            let xb = x1 + (x2 - x1) * b
            let uza = uz0 + (uz2 - uz0) * a
            let vza = vz0 + (vz2 - vz0) * a
            let iza = iz0 + (iz2 - iz0) * a
            let uzb = uz1 + (uz2 - uz1) * b
            let vzb = vz1 + (vz2 - vz1) * b
            let izb = iz1 + (iz2 - iz1) * b
            if (xa > xb) {
                tmp = xa; xa = xb; xb = tmp
                tmp = uza; uza = uzb; uzb = tmp
                tmp = vza; vza = vzb; vzb = tmp
                tmp = iza; iza = izb; izb = tmp
            }
            const ixa = Math.max(0, Math.ceil(xa))
            const ixb = Math.min(159, Math.floor(xb))
            if (ixa <= ixb) {
                const span = xb - xa
                const ispan = span > 0 ? 1.0 / span : 0
                for (let x = ixa; x <= ixb; x++) {
                    const t = (x - xa) * ispan
                    const iz = iza + (izb - iza) * t
                    if (iz < 0.0001) continue
                    const rz = 1.0 / iz
                    const u = (uza + (uzb - uza) * t) * rz
                    const v = (vza + (vzb - vza) * t) * rz
                    let tx = Math.floor(u * tw) % tw
                    let ty = Math.floor(v * th) % th
                    if (tx < 0) tx += tw
                    if (ty < 0) ty += th
                    let c = tex.getPixel(tx, ty)
                    if (c === 0) continue
                    c = shadePixel(c, shade)
                    img.setPixel(x, y, c)
                }
            }
        }
    }
}
