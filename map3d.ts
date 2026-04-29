// ============================================================
// Map3D - General 3D map/level system for MakeCode Arcade
// Heightmap + color map → 3D terrain, walls, floors
// Each cell has: height, floor color, wall color, wall texture
// ============================================================

class CellType {
    public height: number
    public wallColor: number
    public topColor: number
    public wallTexId: number
    public topTexId: number
    public solid: boolean

    constructor() {
        this.height = 0
        this.wallColor = 1
        this.topColor = 7
        this.wallTexId = -1
        this.topTexId = -1
        this.solid = false
    }
}

//% color="#e6562a" weight=90 icon="\uf279"
//% groups="['Map', 'Cell Types', 'Editor', 'Query']"
namespace Map3D {

    const MAX_TYPES = 16
    let _types: CellType[] = []
    let _mapW = 0
    let _mapH = 0
    let _mapData: number[] = []  // cell type index per cell
    let _cellSize = 2.0
    let _meshes: Mesh3D[] = []
    let _built = false

    function _ensureTypes(): void {
        if (_types.length > 0) return
        for (let i = 0; i < MAX_TYPES; i++) {
            _types.push(new CellType())
        }
        // Default: 0 = empty ground (walkable)
        _types[0].height = 0
        _types[0].topColor = 7  // green ground
        _types[0].solid = false
    }

    // ===================== CELL TYPES =====================

    //% blockId=m3d_def_cell block="define cell type $index height $h wall color $wc top color $tc"
    //% group="Cell Types" weight=100
    //% index.defl=1 h.defl=2
    //% wc.shadow=colorindexpicker
    //% tc.shadow=colorindexpicker
    //% inlineInputMode=inline
    export function defineCellType(index: number, h: number, wc: number, tc: number): void {
        _ensureTypes()
        if (index < 0 || index >= MAX_TYPES) return
        _types[index].height = h
        _types[index].wallColor = wc
        _types[index].topColor = tc
        _types[index].solid = h > 0
    }

    //% blockId=m3d_cell_wall_tex block="set cell type $index wall texture $texId"
    //% group="Cell Types" weight=90
    export function setCellWallTexture(index: number, texId: number): void {
        _ensureTypes()
        if (index < 0 || index >= MAX_TYPES) return
        _types[index].wallTexId = texId
    }

    //% blockId=m3d_cell_top_tex block="set cell type $index top texture $texId"
    //% group="Cell Types" weight=89
    export function setCellTopTexture(index: number, texId: number): void {
        _ensureTypes()
        if (index < 0 || index >= MAX_TYPES) return
        _types[index].topTexId = texId
    }

    //% blockId=m3d_cell_solid block="set cell type $index solid $solid"
    //% group="Cell Types" weight=85
    //% solid.defl=true
    export function setCellSolid(index: number, solid: boolean): void {
        _ensureTypes()
        if (index < 0 || index >= MAX_TYPES) return
        _types[index].solid = solid
    }

    // ===================== MAP =====================

    //% blockId=m3d_create_map block="create map width $w height $h||cell size $cs"
    //% group="Map" weight=100
    //% w.defl=16 h.defl=16 cs.defl=2
    //% expandableArgumentMode="toggle"
    export function createMap(w: number, h: number, cs: number = 2): void {
        _ensureTypes()
        _mapW = w
        _mapH = h
        _cellSize = cs
        _mapData = []
        for (let i = 0; i < w * h; i++) {
            _mapData.push(0)
        }
        _built = false
    }

    //% blockId=m3d_load_map block="load map from image $img||cell size $cs"
    //% group="Map" weight=99
    //% img.shadow=screen_image_picker
    //% cs.defl=2
    //% expandableArgumentMode="toggle"
    export function loadFromImage(img: Image, cs: number = 2): void {
        _ensureTypes()
        _mapW = img.width
        _mapH = img.height
        _cellSize = cs
        _mapData = []
        for (let y = 0; y < _mapH; y++) {
            for (let x = 0; x < _mapW; x++) {
                _mapData.push(img.getPixel(x, y))
            }
        }
        _built = false
    }

    //% blockId=m3d_build block="build 3D map"
    //% group="Map" weight=90
    export function build(): void {
        _ensureTypes()
        // Remove old meshes
        for (let i = 0; i < _meshes.length; i++) {
            Render3D.removeMesh(_meshes[i])
        }
        _meshes = []
        if (_mapW === 0 || _mapH === 0) return

        for (let my = 0; my < _mapH; my++) {
            for (let mx = 0; mx < _mapW; mx++) {
                const ci = _mapData[my * _mapW + mx]
                if (ci < 0 || ci >= MAX_TYPES) continue
                const ct = _types[ci]

                const wx = (mx - _mapW / 2.0 + 0.5) * _cellSize
                const wz = (my - _mapH / 2.0 + 0.5) * _cellSize

                if (ct.height > 0) {
                    // Solid block: add box
                    const wy = ct.height / 2.0
                    const box = Render3D.addBox(
                        wx, wy, wz,
                        _cellSize, ct.height, _cellSize,
                        ct.wallColor
                    )
                    // Set wall faces texture (faces 0-7 are walls, 8-11 are top/bottom)
                    if (ct.wallTexId >= 0) {
                        for (let fi = 0; fi < 8; fi++) {
                            Render3D.setFaceTexture(box, fi, ct.wallTexId)
                        }
                    }
                    // Set top face texture
                    if (ct.topTexId >= 0) {
                        Render3D.setFaceTexture(box, 8, ct.topTexId)
                        Render3D.setFaceTexture(box, 9, ct.topTexId)
                    } else {
                        // Color top differently
                        box.faces[8].color = ct.topColor
                        box.faces[9].color = ct.topColor
                    }
                    _meshes.push(box)
                } else {
                    // Floor tile: flat colored quad at y=0
                    const floor = Render3D.addGround(0.01, _cellSize * 0.99, ct.topColor)
                    Render3D.moveMesh(floor, wx, 0, wz)
                    if (ct.topTexId >= 0) {
                        Render3D.setMeshTexture(floor, ct.topTexId)
                    }
                    // Floor is not a collider
                    Render3D.setCollider(floor, false)
                    _meshes.push(floor)
                }
            }
        }
        _built = true
    }

    // ===================== EDITOR =====================

    //% blockId=m3d_set_cell block="set cell at x $mx y $my to type $type"
    //% group="Editor" weight=100
    export function setCell(mx: number, my: number, type: number): void {
        if (mx < 0 || mx >= _mapW || my < 0 || my >= _mapH) return
        _mapData[my * _mapW + mx] = type
    }

    //% blockId=m3d_fill_rect block="fill rect x1 $x1 y1 $y1 x2 $x2 y2 $y2 type $type"
    //% group="Editor" weight=95
    //% inlineInputMode=inline
    export function fillRect(x1: number, y1: number, x2: number, y2: number, type: number): void {
        const minX = Math.max(0, Math.min(x1, x2))
        const maxX = Math.min(_mapW - 1, Math.max(x1, x2))
        const minY = Math.max(0, Math.min(y1, y2))
        const maxY = Math.min(_mapH - 1, Math.max(y1, y2))
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                _mapData[y * _mapW + x] = type
            }
        }
    }

    //% blockId=m3d_fill_border block="fill border with type $type"
    //% group="Editor" weight=90
    export function fillBorder(type: number): void {
        for (let x = 0; x < _mapW; x++) {
            _mapData[x] = type
            _mapData[(_mapH - 1) * _mapW + x] = type
        }
        for (let y = 0; y < _mapH; y++) {
            _mapData[y * _mapW] = type
            _mapData[y * _mapW + _mapW - 1] = type
        }
    }

    //% blockId=m3d_fill_all block="fill entire map with type $type"
    //% group="Editor" weight=89
    export function fillAll(type: number): void {
        for (let i = 0; i < _mapData.length; i++) {
            _mapData[i] = type
        }
    }

    //% blockId=m3d_draw_line block="draw line from x1 $x1 y1 $y1 to x2 $x2 y2 $y2 type $type"
    //% group="Editor" weight=85
    //% inlineInputMode=inline
    export function drawLine(x1: number, y1: number, x2: number, y2: number, type: number): void {
        // Bresenham
        let dx = Math.abs(x2 - x1)
        let dy = Math.abs(y2 - y1)
        const sx = x1 < x2 ? 1 : -1
        const sy = y1 < y2 ? 1 : -1
        let err = dx - dy
        while (true) {
            setCell(x1, y1, type)
            if (x1 === x2 && y1 === y2) break
            const e2 = 2 * err
            if (e2 > -dy) { err -= dy; x1 += sx }
            if (e2 < dx) { err += dx; y1 += sy }
        }
    }

    //% blockId=m3d_draw_circle block="draw circle cx $cx cy $cy radius $r type $type"
    //% group="Editor" weight=80
    //% inlineInputMode=inline
    export function drawCircle(cx: number, cy: number, r: number, type: number): void {
        for (let y = cy - r; y <= cy + r; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
                const dx = x - cx
                const dy = y - cy
                if (dx * dx + dy * dy <= r * r) {
                    setCell(x, y, type)
                }
            }
        }
    }

    //% blockId=m3d_random_scatter block="scatter type $type count $count in area x1 $x1 y1 $y1 x2 $x2 y2 $y2"
    //% group="Editor" weight=70
    //% inlineInputMode=inline
    export function scatter(type: number, count: number, x1: number, y1: number, x2: number, y2: number): void {
        for (let i = 0; i < count; i++) {
            const rx = Math.randomRange(x1, x2)
            const ry = Math.randomRange(y1, y2)
            if (getCell(rx, ry) === 0) {
                setCell(rx, ry, type)
            }
        }
    }

    // ===================== QUERY =====================

    //% blockId=m3d_get_cell block="get cell at x $mx y $my"
    //% group="Query" weight=100
    export function getCell(mx: number, my: number): number {
        if (mx < 0 || mx >= _mapW || my < 0 || my >= _mapH) return -1
        return _mapData[my * _mapW + mx]
    }

    //% blockId=m3d_is_solid block="is cell solid at x $mx y $my"
    //% group="Query" weight=95
    export function isSolid(mx: number, my: number): boolean {
        const ci = getCell(mx, my)
        if (ci < 0 || ci >= MAX_TYPES) return true
        return _types[ci].solid
    }

    //% blockId=m3d_cell_height block="cell height at x $mx y $my"
    //% group="Query" weight=90
    export function cellHeight(mx: number, my: number): number {
        const ci = getCell(mx, my)
        if (ci < 0 || ci >= MAX_TYPES) return 0
        return _types[ci].height
    }

    //% blockId=m3d_map_width block="map width"
    //% group="Query" weight=80
    export function mapWidth(): number { return _mapW }

    //% blockId=m3d_map_height block="map height"
    //% group="Query" weight=79
    export function mapHeight(): number { return _mapH }

    //% blockId=m3d_world_x block="world X for column $mx"
    //% group="Query" weight=75
    export function worldX(mx: number): number {
        return (mx - _mapW / 2.0 + 0.5) * _cellSize
    }

    //% blockId=m3d_world_z block="world Z for row $my"
    //% group="Query" weight=74
    export function worldZ(my: number): number {
        return (my - _mapH / 2.0 + 0.5) * _cellSize
    }

    //% blockId=m3d_map_col block="map column for world X $wx"
    //% group="Query" weight=70
    export function mapCol(wx: number): number {
        return Math.floor(wx / _cellSize + _mapW / 2.0)
    }

    //% blockId=m3d_map_row block="map row for world Z $wz"
    //% group="Query" weight=69
    export function mapRow(wz: number): number {
        return Math.floor(wz / _cellSize + _mapH / 2.0)
    }

    //% blockId=m3d_cam_to_cell block="place camera at map x $mx y $my||height $h"
    //% group="Query" weight=60
    //% mx.defl=1 my.defl=1 h.defl=1.5
    //% expandableArgumentMode="toggle"
    export function placeCameraAt(mx: number, my: number, h: number = 1.5): void {
        Render3D.setCameraPosition(worldX(mx), h, worldZ(my))
    }
}
