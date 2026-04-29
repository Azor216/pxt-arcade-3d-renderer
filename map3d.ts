// ============================================================
// Map3D - 3D Map system for MakeCode Arcade
// Uses tilemap image as a top-down city layout
// Each pixel color = building type
// ============================================================

class BuildingType {
    public height: number
    public color: number
    public texId: number
    public hasRoof: boolean
    public roofColor: number

    constructor(height: number, color: number) {
        this.height = height
        this.color = color
        this.texId = -1
        this.hasRoof = false
        this.roofColor = 12
    }
}

//% color="#e6562a" weight=90 icon="\uf279"
//% groups="['Map', 'Building Types', 'Map Editor']"
namespace Map3D {

    const MAX_TYPES = 16  // matches palette colors 0-15
    let _types: BuildingType[] = []
    let _mapW = 0
    let _mapH = 0
    let _mapData: number[] = []
    let _cellSize = 2.0
    let _meshes: Mesh3D[] = []
    let _groundMesh: Mesh3D = null

    function _ensureTypes(): void {
        if (_types.length > 0) return
        for (let i = 0; i < MAX_TYPES; i++) {
            _types.push(new BuildingType(0, i))
        }
    }

    // ===================== BUILDING TYPES =====================

    //% blockId=m3d_def_building block="define building type $colorIndex height $height color $wallColor"
    //% group="Building Types" weight=100
    //% colorIndex.defl=2 height.defl=2
    //% wallColor.shadow=colorindexpicker
    export function defineBuilding(colorIndex: number, height: number, wallColor: number): void {
        _ensureTypes()
        if (colorIndex < 0 || colorIndex >= MAX_TYPES) return
        _types[colorIndex].height = height
        _types[colorIndex].color = wallColor
    }

    //% blockId=m3d_def_building_tex block="set building type $colorIndex texture $texId"
    //% group="Building Types" weight=95
    //% colorIndex.defl=2
    export function setBuildingTexture(colorIndex: number, texId: number): void {
        _ensureTypes()
        if (colorIndex < 0 || colorIndex >= MAX_TYPES) return
        _types[colorIndex].texId = texId
    }

    //% blockId=m3d_def_building_roof block="set building type $colorIndex roof $hasRoof color $roofColor"
    //% group="Building Types" weight=90
    //% colorIndex.defl=2 hasRoof.defl=true
    //% roofColor.shadow=colorindexpicker
    export function setBuildingRoof(colorIndex: number, hasRoof: boolean, roofColor: number): void {
        _ensureTypes()
        if (colorIndex < 0 || colorIndex >= MAX_TYPES) return
        _types[colorIndex].hasRoof = hasRoof
        _types[colorIndex].roofColor = roofColor
    }

    // ===================== MAP =====================

    //% blockId=m3d_load_map block="load 3D map from image $img||cell size $cs"
    //% group="Map" weight=100
    //% img.shadow=screen_image_picker
    //% cs.defl=2
    //% expandableArgumentMode="toggle"
    export function loadMap(img: Image, cs: number = 2): void {
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
    }

    //% blockId=m3d_build block="build 3D city"
    //% group="Map" weight=90
    export function buildCity(): void {
        _ensureTypes()

        // Remove previously built meshes
        for (let i = 0; i < _meshes.length; i++) {
            Render3D.removeMesh(_meshes[i])
        }
        _meshes = []

        if (_groundMesh) {
            Render3D.removeMesh(_groundMesh)
            _groundMesh = null
        }

        if (_mapW === 0 || _mapH === 0) return

        const totalW = _mapW * _cellSize
        const totalH = _mapH * _cellSize

        // Add ground
        _groundMesh = Render3D.addGround(0, Math.max(totalW, totalH) + 4, 7)

        // Build each cell
        for (let my = 0; my < _mapH; my++) {
            for (let mx = 0; mx < _mapW; mx++) {
                const ci = _mapData[my * _mapW + mx]
                if (ci <= 0 || ci >= MAX_TYPES) continue

                const bt = _types[ci]
                if (bt.height <= 0) continue

                // World position: center the map at origin
                const wx = (mx - _mapW / 2.0 + 0.5) * _cellSize
                const wz = (my - _mapH / 2.0 + 0.5) * _cellSize
                const wy = bt.height / 2.0

                const box = Render3D.addBox(
                    wx, wy, wz,
                    _cellSize * 0.95,
                    bt.height,
                    _cellSize * 0.95,
                    bt.color
                )

                if (bt.texId >= 0) {
                    Render3D.setMeshTexture(box, bt.texId)
                }

                // Roof
                if (bt.hasRoof) {
                    const roof = Render3D.addPyramid(
                        wx, bt.height, wz,
                        _cellSize,
                        _cellSize * 0.4,
                        bt.roofColor
                    )
                    _meshes.push(roof)
                }

                _meshes.push(box)
            }
        }
    }

    //% blockId=m3d_set_ground_tex block="set ground texture $texId"
    //% group="Map" weight=85
    export function setGroundTexture(texId: number): void {
        if (_groundMesh) {
            Render3D.setMeshTexture(_groundMesh, texId)
        }
    }

    //% blockId=m3d_set_ground_color block="set ground color $color"
    //% group="Map" weight=84
    //% color.shadow=colorindexpicker
    export function setGroundColor(color: number): void {
        if (_groundMesh) {
            Render3D.setMeshColor(_groundMesh, color)
        }
    }

    //% blockId=m3d_get_cell block="get map cell at x $mx y $my"
    //% group="Map" weight=70
    export function getCell(mx: number, my: number): number {
        if (mx < 0 || mx >= _mapW || my < 0 || my >= _mapH) return 0
        return _mapData[my * _mapW + mx]
    }

    //% blockId=m3d_set_cell block="set map cell at x $mx y $my to $value"
    //% group="Map" weight=69
    export function setCell(mx: number, my: number, value: number): void {
        if (mx < 0 || mx >= _mapW || my < 0 || my >= _mapH) return
        _mapData[my * _mapW + mx] = value
    }

    //% blockId=m3d_map_width block="map width"
    //% group="Map" weight=65
    export function mapWidth(): number {
        return _mapW
    }

    //% blockId=m3d_map_height block="map height"
    //% group="Map" weight=64
    export function mapHeight(): number {
        return _mapH
    }

    //% blockId=m3d_cell_size block="cell size"
    //% group="Map" weight=63
    export function cellSize(): number {
        return _cellSize
    }

    //% blockId=m3d_world_x block="world X for map column $mx"
    //% group="Map" weight=60
    export function worldX(mx: number): number {
        return (mx - _mapW / 2.0 + 0.5) * _cellSize
    }

    //% blockId=m3d_world_z block="world Z for map row $my"
    //% group="Map" weight=59
    export function worldZ(my: number): number {
        return (my - _mapH / 2.0 + 0.5) * _cellSize
    }

    //% blockId=m3d_cam_to_cell block="place camera at map x $mx y $my||height $h"
    //% group="Map" weight=55
    //% mx.defl=0 my.defl=0 h.defl=2.5
    //% expandableArgumentMode="toggle"
    export function placeCameraAt(mx: number, my: number, h: number = 2.5): void {
        Render3D.setCameraPosition(worldX(mx), h, worldZ(my))
    }

    // ===================== MAP EDITOR =====================

    //% blockId=m3d_create_map block="create empty map width $w height $h||cell size $cs"
    //% group="Map Editor" weight=100
    //% w.defl=8 h.defl=8 cs.defl=2
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
    }

    //% blockId=m3d_fill_rect block="fill map rect x $x1 y $y1 to x2 $x2 y2 $y2 with $value"
    //% group="Map Editor" weight=90
    //% inlineInputMode=inline
    export function fillRect(x1: number, y1: number, x2: number, y2: number, value: number): void {
        const minX = Math.max(0, Math.min(x1, x2))
        const maxX = Math.min(_mapW - 1, Math.max(x1, x2))
        const minY = Math.max(0, Math.min(y1, y2))
        const maxY = Math.min(_mapH - 1, Math.max(y1, y2))
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                _mapData[y * _mapW + x] = value
            }
        }
    }

    //% blockId=m3d_fill_border block="fill map border with $value"
    //% group="Map Editor" weight=85
    export function fillBorder(value: number): void {
        for (let x = 0; x < _mapW; x++) {
            _mapData[x] = value
            _mapData[(_mapH - 1) * _mapW + x] = value
        }
        for (let y = 0; y < _mapH; y++) {
            _mapData[y * _mapW] = value
            _mapData[y * _mapW + _mapW - 1] = value
        }
    }

    //% blockId=m3d_place_building block="place building $type at map x $mx y $my"
    //% group="Map Editor" weight=80
    export function placeBuilding(type: number, mx: number, my: number): void {
        setCell(mx, my, type)
    }

    //% blockId=m3d_place_building_rect block="place $type building block from x $x1 y $y1 to x2 $x2 y2 $y2"
    //% group="Map Editor" weight=75
    //% inlineInputMode=inline
    export function placeBuildingBlock(type: number, x1: number, y1: number, x2: number, y2: number): void {
        fillRect(x1, y1, x2, y2, type)
    }

    //% blockId=m3d_add_street_h block="add horizontal street at row $y from $x1 to $x2"
    //% group="Map Editor" weight=70
    export function addStreetH(y: number, x1: number, x2: number): void {
        fillRect(x1, y, x2, y, 0)
    }

    //% blockId=m3d_add_street_v block="add vertical street at column $x from $y1 to $y2"
    //% group="Map Editor" weight=69
    export function addStreetV(x: number, y1: number, y2: number): void {
        fillRect(x, y1, x, y2, 0)
    }

    // ===================== PRESETS =====================

    //% blockId=m3d_preset_city block="generate preset city width $w height $h"
    //% group="Map Editor" weight=50
    //% w.defl=12 h.defl=12
    export function presetCity(w: number, h: number): void {
        createMap(w, h, 2)

        // Define standard building types
        defineBuilding(1, 1, 12)    // 1: low wall (dark gray)
        defineBuilding(2, 2, 2)     // 2: red house
        setBuildingRoof(2, true, 14)
        defineBuilding(3, 3, 8)     // 3: blue office
        defineBuilding(4, 4, 1)     // 4: white tower
        defineBuilding(5, 1.5, 5)   // 5: yellow shop
        setBuildingRoof(5, true, 4)
        defineBuilding(6, 1, 7)     // 6: green park hedge
        defineBuilding(7, 5, 11)    // 7: purple skyscraper

        // Fill with border walls
        fillBorder(1)

        // Place buildings in city blocks
        // Block 1 (top-left)
        placeBuildingBlock(2, 2, 2, 3, 3)
        // Block 2 (top-right)
        placeBuildingBlock(3, 6, 2, 7, 3)
        // Block 3 (center)
        placeBuilding(7, 5, 5)
        placeBuilding(4, 5, 6)
        // Block 4 (bottom-left)
        placeBuildingBlock(5, 2, 7, 3, 7)
        placeBuildingBlock(6, 2, 8, 3, 9)
        // Block 5 (bottom-right)
        placeBuildingBlock(2, 7, 7, 8, 8)
        placeBuilding(3, 9, 8)

        // Streets (clear paths)
        addStreetH(1, 1, w - 2)
        addStreetV(1, 1, h - 2)
        addStreetH(4, 1, w - 2)
        addStreetV(4, 1, h - 2)
        addStreetV(9, 1, h - 2)
        addStreetH(h - 2, 1, w - 2)
    }
}
