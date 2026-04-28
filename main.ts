// ============================================================
// Render3D - Real 3D Engine for MakeCode Arcade
// Public API with block definitions
// ============================================================

class Mesh3D {
    public vertices: Vec3[]
    public faces: Tri3D[]
    public position: Vec3
    public rotation: Vec3
    public _scale: number
    public _id: number
    public _collider: boolean
    public _bboxW: number
    public _bboxH: number
    public _bboxD: number
    private static _nextId: number = 0

    constructor() {
        this.vertices = []
        this.faces = []
        this.position = new Vec3(0, 0, 0)
        this.rotation = new Vec3(0, 0, 0)
        this._scale = 1
        this._id = Mesh3D._nextId++
        this._collider = false
        this._bboxW = 0
        this._bboxH = 0
        this._bboxD = 0
    }
}

class Camera3D {
    public position: Vec3
    public yaw: number
    public pitch: number
    public fov: number

    constructor() {
        this.position = new Vec3(0, 3, -8)
        this.yaw = 0
        this.pitch = 0.3
        this.fov = 60
    }
}

class Scene3D {
    public meshes: Mesh3D[]
    public camera: Camera3D
    public lightDir: Vec3
    public skyColor: number
    public groundColor: number

    constructor() {
        this.meshes = []
        this.camera = new Camera3D()
        this.lightDir = new Vec3(0.5, 0.8, -0.3)
        this.lightDir = this.lightDir.normalize()
        this.skyColor = 9
        this.groundColor = 15
    }
}

// ============================================================
// PUBLIC API
// ============================================================

//% color="#4b7bec" weight=100 icon="\uf1b2"
//% groups="['Scene', 'Camera', 'Objects', 'Transform', 'Texture', 'Light']"
namespace Render3D {
    const SW = 160
    const SH = 120
    const HW = 80
    const HH = 60
    const NEAR = 0.3

    let _scene: Scene3D = null

    function ensureScene(): Scene3D {
        if (!_scene) _scene = new Scene3D()
        return _scene
    }

    // ===================== SCENE =====================

    //% blockId=r3d_init block="initialize 3D scene"
    //% group="Scene" weight=100
    export function createScene(): void {
        _scene = new Scene3D()
    }

    //% blockId=r3d_render block="render 3D scene"
    //% group="Scene" weight=90
    export function render(): void {
        const sc = ensureScene()

        // Push camera out if a moving mesh pushed into it
        _pushOut(sc)

        const img = scene.backgroundImage()
        img.fill(0)

        // Sky gradient
        img.fillRect(0, 0, SW, 15, 6)
        img.fillRect(0, 15, SW, HH - 15, sc.skyColor)

        // Ground
        img.fillRect(0, HH, SW, HH, sc.groundColor)

        const cam = sc.camera
        const focalLen = HW / Math.tan(cam.fov * Math.PI / 360)

        // Precompute camera rotation
        const cosY = Math.cos(-cam.yaw)
        const sinY = Math.sin(-cam.yaw)
        const cosP = Math.cos(-cam.pitch)
        const sinP = Math.sin(-cam.pitch)

        // Collect renderable faces
        const renderList: RenderFace[] = []

        for (let mi = 0; mi < sc.meshes.length; mi++) {
            const mesh = sc.meshes[mi]

            // Transform all vertices to camera space
            const cvs: Vec3[] = []
            for (let vi = 0; vi < mesh.vertices.length; vi++) {
                let p = mesh.vertices[vi].scale(mesh._scale)

                // Apply mesh rotation (Y → X → Z)
                if (mesh.rotation.y !== 0) p = Math3D.rotateY(p, mesh.rotation.y)
                if (mesh.rotation.x !== 0) p = Math3D.rotateX(p, mesh.rotation.x)
                if (mesh.rotation.z !== 0) p = Math3D.rotateZ(p, mesh.rotation.z)

                // Translate to world position
                p = p.add(mesh.position)

                // Camera transform: translate
                p = p.sub(cam.position)

                // Camera transform: rotate by -yaw around Y
                const rx = p.x * cosY + p.z * sinY
                const rz1 = -p.x * sinY + p.z * cosY

                // Camera transform: rotate by -pitch around X
                const ry = p.y * cosP - rz1 * sinP
                const rz = p.y * sinP + rz1 * cosP

                cvs.push(new Vec3(rx, ry, rz))
            }

            // Process each face
            for (let fi = 0; fi < mesh.faces.length; fi++) {
                const face = mesh.faces[fi]
                const v0 = cvs[face.i0]
                const v1 = cvs[face.i1]
                const v2 = cvs[face.i2]

                // Count vertices behind near plane
                const b0 = v0.z < NEAR ? 1 : 0
                const b1 = v1.z < NEAR ? 1 : 0
                const b2 = v2.z < NEAR ? 1 : 0
                const behind = b0 + b1 + b2

                // All behind → skip
                if (behind === 3) continue

                // Compute face normal in world space for lighting
                const e1 = mesh.vertices[face.i1].sub(mesh.vertices[face.i0])
                const e2 = mesh.vertices[face.i2].sub(mesh.vertices[face.i0])
                let normal = e1.cross(e2).normalize()
                if (mesh.rotation.y !== 0) normal = Math3D.rotateY(normal, mesh.rotation.y)
                if (mesh.rotation.x !== 0) normal = Math3D.rotateX(normal, mesh.rotation.x)
                if (mesh.rotation.z !== 0) normal = Math3D.rotateZ(normal, mesh.rotation.z)
                const light = normal.dot(sc.lightDir)
                const shadedColor = Rasterizer.shadeColor(face.color, light)
                const shadeL = Rasterizer.shadeLevel(light)

                // Collect clipped triangles (camera-space vertices + UVs)
                const clipped: Vec3[] = []
                const clippedUV: number[] = []  // u0,v0, u1,v1, u2,v2 per triangle

                if (behind === 0) {
                    // No clipping needed
                    clipped.push(v0); clipped.push(v1); clipped.push(v2)
                    clippedUV.push(face.u0); clippedUV.push(face.v0)
                    clippedUV.push(face.u1); clippedUV.push(face.v1)
                    clippedUV.push(face.u2); clippedUV.push(face.v2)
                } else {
                    // Near-plane clip: put all 3 verts in array, in/out classification
                    const verts = [v0, v1, v2]
                    const inside: boolean[] = [!b0, !b1, !b2]
                    const uvs = [face.u0, face.v0, face.u1, face.v1, face.u2, face.v2]

                    if (behind === 1) {
                        // 1 vertex behind → clip to 2 triangles (quad)
                        let bi = 0
                        if (!inside[0]) bi = 0
                        else if (!inside[1]) bi = 1
                        else bi = 2
                        const ai = (bi + 1) % 3
                        const ci = (bi + 2) % 3
                        const va = verts[ai]
                        const vb = verts[bi]
                        const vc = verts[ci]
                        // Clip edge vb→va and vb→vc
                        const ta = (NEAR - vb.z) / (va.z - vb.z)
                        const tc = (NEAR - vb.z) / (vc.z - vb.z)
                        const na = new Vec3(
                            vb.x + (va.x - vb.x) * ta,
                            vb.y + (va.y - vb.y) * ta,
                            NEAR
                        )
                        const nc = new Vec3(
                            vb.x + (vc.x - vb.x) * tc,
                            vb.y + (vc.y - vb.y) * tc,
                            NEAR
                        )
                        // Interpolate UVs
                        const uva = [uvs[bi * 2] + (uvs[ai * 2] - uvs[bi * 2]) * ta,
                                     uvs[bi * 2 + 1] + (uvs[ai * 2 + 1] - uvs[bi * 2 + 1]) * ta]
                        const uvc = [uvs[bi * 2] + (uvs[ci * 2] - uvs[bi * 2]) * tc,
                                     uvs[bi * 2 + 1] + (uvs[ci * 2 + 1] - uvs[bi * 2 + 1]) * tc]
                        // Triangle 1: va, na, vc
                        clipped.push(va); clipped.push(na); clipped.push(vc)
                        clippedUV.push(uvs[ai * 2]); clippedUV.push(uvs[ai * 2 + 1])
                        clippedUV.push(uva[0]); clippedUV.push(uva[1])
                        clippedUV.push(uvs[ci * 2]); clippedUV.push(uvs[ci * 2 + 1])
                        // Triangle 2: na, nc, vc
                        clipped.push(na); clipped.push(nc); clipped.push(vc)
                        clippedUV.push(uva[0]); clippedUV.push(uva[1])
                        clippedUV.push(uvc[0]); clippedUV.push(uvc[1])
                        clippedUV.push(uvs[ci * 2]); clippedUV.push(uvs[ci * 2 + 1])
                    } else {
                        // 2 vertices behind → clip to 1 triangle
                        let fi2 = 0
                        if (inside[0]) fi2 = 0
                        else if (inside[1]) fi2 = 1
                        else fi2 = 2
                        const vf = verts[fi2]
                        const vl = verts[(fi2 + 1) % 3]
                        const vr = verts[(fi2 + 2) % 3]
                        const li = (fi2 + 1) % 3
                        const ri = (fi2 + 2) % 3
                        const tl = (NEAR - vf.z) / (vl.z - vf.z)
                        const tr = (NEAR - vf.z) / (vr.z - vf.z)
                        const nl = new Vec3(
                            vf.x + (vl.x - vf.x) * tl,
                            vf.y + (vl.y - vf.y) * tl,
                            NEAR
                        )
                        const nr = new Vec3(
                            vf.x + (vr.x - vf.x) * tr,
                            vf.y + (vr.y - vf.y) * tr,
                            NEAR
                        )
                        const uvl0 = uvs[fi2 * 2] + (uvs[li * 2] - uvs[fi2 * 2]) * tl
                        const uvl1 = uvs[fi2 * 2 + 1] + (uvs[li * 2 + 1] - uvs[fi2 * 2 + 1]) * tl
                        const uvr0 = uvs[fi2 * 2] + (uvs[ri * 2] - uvs[fi2 * 2]) * tr
                        const uvr1 = uvs[fi2 * 2 + 1] + (uvs[ri * 2 + 1] - uvs[fi2 * 2 + 1]) * tr
                        clipped.push(vf); clipped.push(nl); clipped.push(nr)
                        clippedUV.push(uvs[fi2 * 2]); clippedUV.push(uvs[fi2 * 2 + 1])
                        clippedUV.push(uvl0); clippedUV.push(uvl1)
                        clippedUV.push(uvr0); clippedUV.push(uvr1)
                    }
                }

                // Project and emit clipped triangles
                for (let ti = 0; ti < clipped.length; ti += 3) {
                    const cv0 = clipped[ti]
                    const cv1 = clipped[ti + 1]
                    const cv2 = clipped[ti + 2]
                    const uvi = ti * 2  // 6 UV values per triangle: u0,v0,u1,v1,u2,v2

                    const sx0 = cv0.x * focalLen / cv0.z + HW
                    const sy0 = -cv0.y * focalLen / cv0.z + HH
                    const sx1 = cv1.x * focalLen / cv1.z + HW
                    const sy1 = -cv1.y * focalLen / cv1.z + HH
                    const sx2 = cv2.x * focalLen / cv2.z + HW
                    const sy2 = -cv2.y * focalLen / cv2.z + HH

                    // Backface culling
                    const area = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0)
                    if (area >= 0) continue

                    // Off-screen rejection
                    const minSx = Math.min(sx0, Math.min(sx1, sx2))
                    const maxSx = Math.max(sx0, Math.max(sx1, sx2))
                    const minSy = Math.min(sy0, Math.min(sy1, sy2))
                    const maxSy = Math.max(sy0, Math.max(sy1, sy2))
                    if (maxSx < 0 || minSx >= SW || maxSy < 0 || minSy >= SH) continue

                    const avgZ = (cv0.z + cv1.z + cv2.z) / 3
                    const rf = new RenderFace()
                    rf.sx0 = sx0; rf.sy0 = sy0
                    rf.sx1 = sx1; rf.sy1 = sy1
                    rf.sx2 = sx2; rf.sy2 = sy2
                    rf.color = shadedColor
                    rf.depth = avgZ
                    rf.texId = face.texId
                    rf.shade = shadeL
                    // Perspective-correct UV: store u/z, v/z, 1/z
                    if (face.texId >= 0) {
                        const rz0 = 1 / cv0.z, rz1 = 1 / cv1.z, rz2 = 1 / cv2.z
                        rf.uz0 = clippedUV[uvi] * rz0
                        rf.vz0 = clippedUV[uvi + 1] * rz0
                        rf.iz0 = rz0
                        rf.uz1 = clippedUV[uvi + 2] * rz1
                        rf.vz1 = clippedUV[uvi + 3] * rz1
                        rf.iz1 = rz1
                        rf.uz2 = clippedUV[uvi + 4] * rz2
                        rf.vz2 = clippedUV[uvi + 5] * rz2
                        rf.iz2 = rz2
                    }
                    renderList.push(rf)
                }
            }
        }

        // Sort back-to-front (painter's algorithm)
        renderList.sort((a: RenderFace, b: RenderFace) => b.depth - a.depth)

        // Rasterize all visible faces
        for (let i = 0; i < renderList.length; i++) {
            const f = renderList[i]
            const tex = f.texId >= 0 ? Rasterizer.getTexture(f.texId) : null
            if (tex) {
                Rasterizer.fillTriangleTex(
                    img, tex, f.shade,
                    f.sx0, f.sy0, f.uz0, f.vz0, f.iz0,
                    f.sx1, f.sy1, f.uz1, f.vz1, f.iz1,
                    f.sx2, f.sy2, f.uz2, f.vz2, f.iz2
                )
            } else {
                Rasterizer.fillTriangle(
                    img,
                    f.sx0, f.sy0,
                    f.sx1, f.sy1,
                    f.sx2, f.sy2,
                    f.color
                )
            }
        }
    }

    //% blockId=r3d_set_sky block="set sky color $color"
    //% group="Scene" weight=80
    //% color.shadow=colorindexpicker
    export function setSkyColor(color: number): void {
        ensureScene().skyColor = color
    }

    //% blockId=r3d_set_ground block="set ground color $color"
    //% group="Scene" weight=79
    //% color.shadow=colorindexpicker
    export function setGroundColor(color: number): void {
        ensureScene().groundColor = color
    }

    //% blockId=r3d_clear block="clear all objects from scene"
    //% group="Scene" weight=70
    export function clearScene(): void {
        ensureScene().meshes = []
    }

    // ===================== CAMERA =====================

    //% blockId=r3d_cam_pos block="set camera position x $x y $y z $z"
    //% group="Camera" weight=100
    //% x.defl=0 y.defl=3 z.defl=-8
    export function setCameraPosition(x: number, y: number, z: number): void {
        const cam = ensureScene().camera
        cam.position.x = x
        cam.position.y = y
        cam.position.z = z
    }

    //% blockId=r3d_cam_rot block="set camera rotation yaw $yaw pitch $pitch"
    //% group="Camera" weight=90
    //% yaw.defl=0 pitch.defl=0.3
    export function setCameraRotation(yaw: number, pitch: number): void {
        const cam = ensureScene().camera
        cam.yaw = yaw
        cam.pitch = pitch
    }

    //% blockId=r3d_cam_fov block="set field of view $fov"
    //% group="Camera" weight=80
    //% fov.defl=60
    export function setFieldOfView(fov: number): void {
        ensureScene().camera.fov = fov
    }

    //% blockId=r3d_cam_fwd block="move camera forward by $amount"
    //% group="Camera" weight=70
    //% amount.defl=0.1
    export function moveCameraForward(amount: number): void {
        const sc = ensureScene()
        const cam = sc.camera
        const dirX = Math.sin(cam.yaw)
        const dirZ = Math.cos(cam.yaw)
        _moveCamera(sc, dirX * amount, dirZ * amount)
    }

    //% blockId=r3d_cam_right block="move camera right by $amount"
    //% group="Camera" weight=69
    //% amount.defl=0.1
    export function moveCameraRight(amount: number): void {
        const sc = ensureScene()
        const cam = sc.camera
        const dirX = Math.cos(cam.yaw)
        const dirZ = -Math.sin(cam.yaw)
        _moveCamera(sc, dirX * amount, dirZ * amount)
    }

    // Core movement with sub-stepping and wall sliding
    function _moveCamera(sc: Scene3D, mx: number, mz: number): void {
        const cam = sc.camera
        const SUBSTEPS = 4
        const sx = mx / SUBSTEPS
        const sz = mz / SUBSTEPS

        for (let s = 0; s < SUBSTEPS; s++) {
            const nx = cam.position.x + sx
            const nz = cam.position.z + sz

            if (!_checkCollisionXZ(sc, nx, cam.position.y, nz)) {
                // No collision, move freely
                cam.position.x = nx
                cam.position.z = nz
            } else {
                // Try slide X only
                if (!_checkCollisionXZ(sc, nx, cam.position.y, cam.position.z)) {
                    cam.position.x = nx
                }
                // Try slide Z only (from current x, NOT nx)
                if (!_checkCollisionXZ(sc, cam.position.x, cam.position.y, nz)) {
                    cam.position.z = nz
                }
                // Hit a wall, stop sub-stepping
                break
            }
        }
        // Safety push-out
        _pushOut(sc)
    }

    //% blockId=r3d_cam_up block="move camera up by $amount"
    //% group="Camera" weight=68
    //% amount.defl=0.1
    export function moveCameraUp(amount: number): void {
        ensureScene().camera.position.y += amount
    }

    //% blockId=r3d_cam_rotate block="rotate camera yaw by $dyaw pitch by $dpitch"
    //% group="Camera" weight=60
    //% dyaw.defl=0.05 dpitch.defl=0
    export function rotateCamera(dyaw: number, dpitch: number): void {
        const cam = ensureScene().camera
        cam.yaw += dyaw
        cam.pitch += dpitch
        if (cam.pitch > 1.2) cam.pitch = 1.2
        if (cam.pitch < -1.2) cam.pitch = -1.2
    }

    // ===================== OBJECTS =====================

    //% blockId=r3d_add_cube block="add cube at x $x y $y z $z size $size color $color"
    //% group="Objects" weight=100
    //% x.defl=0 y.defl=0 z.defl=0 size.defl=1
    //% color.shadow=colorindexpicker
    export function addCube(x: number, y: number, z: number, size: number, color: number): Mesh3D {
        return addBox(x, y, z, size, size, size, color)
    }

    //% blockId=r3d_add_box block="add box at x $x y $y z $z||w $w h $h d $d color $color"
    //% group="Objects" weight=95
    //% x.defl=0 y.defl=0 z.defl=0 w.defl=1 h.defl=2 d.defl=1
    //% color.shadow=colorindexpicker
    //% inlineInputMode=inline
    export function addBox(x: number, y: number, z: number, w: number, h: number, d: number, color: number): Mesh3D {
        const mesh = new Mesh3D()
        const hw = w / 2, hh = h / 2, hd = d / 2

        //   3----2        7----6
        //   |back|        |front|
        //   0----1        4----5
        // Vertices of the box
        mesh.vertices = [
            new Vec3(-hw, -hh, -hd),  // 0: left-bottom-back
            new Vec3(hw, -hh, -hd),   // 1: right-bottom-back
            new Vec3(hw, hh, -hd),    // 2: right-top-back
            new Vec3(-hw, hh, -hd),   // 3: left-top-back
            new Vec3(-hw, -hh, hd),   // 4: left-bottom-front
            new Vec3(hw, -hh, hd),    // 5: right-bottom-front
            new Vec3(hw, hh, hd),     // 6: right-top-front
            new Vec3(-hw, hh, hd),    // 7: left-top-front
        ]

        // 12 triangles, correct CCW winding for outward normals
        // Each quad has 2 triangles with UVs: (0,0)-(1,0)-(1,1) and (0,0)-(1,1)-(0,1)
        const f0 = new Tri3D(4, 5, 6, color); f0.u0 = 0; f0.v0 = 1; f0.u1 = 1; f0.v1 = 1; f0.u2 = 1; f0.v2 = 0
        const f1 = new Tri3D(4, 6, 7, color); f1.u0 = 0; f1.v0 = 1; f1.u1 = 1; f1.v1 = 0; f1.u2 = 0; f1.v2 = 0
        const f2 = new Tri3D(0, 3, 2, color); f2.u0 = 1; f2.v0 = 1; f2.u1 = 1; f2.v1 = 0; f2.u2 = 0; f2.v2 = 0
        const f3 = new Tri3D(0, 2, 1, color); f3.u0 = 1; f3.v0 = 1; f3.u1 = 0; f3.v1 = 0; f3.u2 = 0; f3.v2 = 1
        const f4 = new Tri3D(1, 2, 6, color); f4.u0 = 0; f4.v0 = 1; f4.u1 = 0; f4.v1 = 0; f4.u2 = 1; f4.v2 = 0
        const f5 = new Tri3D(1, 6, 5, color); f5.u0 = 0; f5.v0 = 1; f5.u1 = 1; f5.v1 = 0; f5.u2 = 1; f5.v2 = 1
        const f6 = new Tri3D(0, 4, 7, color); f6.u0 = 1; f6.v0 = 1; f6.u1 = 0; f6.v1 = 1; f6.u2 = 0; f6.v2 = 0
        const f7 = new Tri3D(0, 7, 3, color); f7.u0 = 1; f7.v0 = 1; f7.u1 = 0; f7.v1 = 0; f7.u2 = 1; f7.v2 = 0
        const f8 = new Tri3D(3, 7, 6, color); f8.u0 = 0; f8.v0 = 0; f8.u1 = 0; f8.v1 = 1; f8.u2 = 1; f8.v2 = 1
        const f9 = new Tri3D(3, 6, 2, color); f9.u0 = 0; f9.v0 = 0; f9.u1 = 1; f9.v1 = 1; f9.u2 = 1; f9.v2 = 0
        const f10 = new Tri3D(0, 1, 5, color); f10.u0 = 0; f10.v0 = 0; f10.u1 = 1; f10.v1 = 0; f10.u2 = 1; f10.v2 = 1
        const f11 = new Tri3D(0, 5, 4, color); f11.u0 = 0; f11.v0 = 0; f11.u1 = 1; f11.v1 = 1; f11.u2 = 0; f11.v2 = 1
        mesh.faces = [f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11]

        mesh.position = new Vec3(x, y, z)
        mesh._collider = true
        mesh._bboxW = w
        mesh._bboxH = h
        mesh._bboxD = d
        ensureScene().meshes.push(mesh)
        return mesh
    }

    //% blockId=r3d_add_pyramid block="add pyramid at x $x y $y z $z||size $size height $height color $color"
    //% group="Objects" weight=90
    //% x.defl=0 y.defl=0 z.defl=0 size.defl=1 height.defl=1.5
    //% color.shadow=colorindexpicker
    //% inlineInputMode=inline
    export function addPyramid(x: number, y: number, z: number, size: number, height: number, color: number): Mesh3D {
        const mesh = new Mesh3D()
        const hs = size / 2

        //    4 (apex)
        //   /|\
        //  3---2
        //  |   |
        //  0---1
        mesh.vertices = [
            new Vec3(-hs, 0, -hs),  // 0: back-left
            new Vec3(hs, 0, -hs),   // 1: back-right
            new Vec3(hs, 0, hs),    // 2: front-right
            new Vec3(-hs, 0, hs),   // 3: front-left
            new Vec3(0, height, 0)  // 4: apex
        ]

        mesh.faces = [
            // Base (downward normal)
            new Tri3D(0, 1, 2, color),
            new Tri3D(0, 2, 3, color),
            // Front side
            new Tri3D(3, 2, 4, color),
            // Right side
            new Tri3D(2, 1, 4, color),
            // Back side
            new Tri3D(1, 0, 4, color),
            // Left side
            new Tri3D(0, 3, 4, color),
        ]

        mesh.position = new Vec3(x, y, z)
        ensureScene().meshes.push(mesh)
        return mesh
    }

    //% blockId=r3d_add_wedge block="add wedge at x $x y $y z $z||w $w h $h d $d color $color"
    //% group="Objects" weight=85
    //% x.defl=0 y.defl=0 z.defl=0 w.defl=1 h.defl=1 d.defl=2
    //% color.shadow=colorindexpicker
    //% inlineInputMode=inline
    export function addWedge(x: number, y: number, z: number, w: number, h: number, d: number, color: number): Mesh3D {
        const mesh = new Mesh3D()
        const hw = w / 2, hd = d / 2

        //  4-----5  (front-top)
        //  |    /|
        //  |  /  |
        //  3/----2  (front-bottom)
        //  0-----1  (back-bottom)
        mesh.vertices = [
            new Vec3(-hw, 0, -hd),  // 0: back-left bottom
            new Vec3(hw, 0, -hd),   // 1: back-right bottom
            new Vec3(hw, 0, hd),    // 2: front-right bottom
            new Vec3(-hw, 0, hd),   // 3: front-left bottom
            new Vec3(-hw, h, hd),   // 4: front-left top
            new Vec3(hw, h, hd),    // 5: front-right top
        ]

        mesh.faces = [
            // Bottom
            new Tri3D(0, 1, 2, color),
            new Tri3D(0, 2, 3, color),
            // Front (vertical)
            new Tri3D(3, 2, 5, color),
            new Tri3D(3, 5, 4, color),
            // Slope (back ramp)
            new Tri3D(0, 4, 5, color),
            new Tri3D(0, 5, 1, color),
            // Left triangle
            new Tri3D(0, 3, 4, color),
            // Right triangle
            new Tri3D(2, 1, 5, color),
        ]

        mesh.position = new Vec3(x, y, z)
        ensureScene().meshes.push(mesh)
        return mesh
    }

    //% blockId=r3d_add_ground block="add ground at y $y size $size color $color"
    //% group="Objects" weight=80
    //% y.defl=0 size.defl=20
    //% color.shadow=colorindexpicker
    export function addGround(y: number, size: number, color: number): Mesh3D {
        const mesh = new Mesh3D()
        const hs = size / 2

        mesh.vertices = [
            new Vec3(-hs, 0, -hs),
            new Vec3(hs, 0, -hs),
            new Vec3(hs, 0, hs),
            new Vec3(-hs, 0, hs),
        ]

        // Normal pointing up (0, 1, 0)
        mesh.faces = [
            new Tri3D(0, 3, 2, color),
            new Tri3D(0, 2, 1, color),
        ]

        mesh.position = new Vec3(0, y, 0)
        ensureScene().meshes.push(mesh)
        return mesh
    }

    //% blockId=r3d_add_custom block="add custom mesh"
    //% group="Objects" weight=70
    export function addCustomMesh(): Mesh3D {
        const mesh = new Mesh3D()
        ensureScene().meshes.push(mesh)
        return mesh
    }

    //% blockId=r3d_mesh_add_vertex block="$mesh add vertex x $x y $y z $z"
    //% group="Objects" weight=65
    //% mesh.shadow=variables_get
    export function addVertex(mesh: Mesh3D, x: number, y: number, z: number): void {
        if (!mesh) return
        mesh.vertices.push(new Vec3(x, y, z))
    }

    //% blockId=r3d_mesh_add_face block="$mesh add triangle $i0 $i1 $i2 color $color"
    //% group="Objects" weight=64
    //% mesh.shadow=variables_get
    //% color.shadow=colorindexpicker
    export function addFace(mesh: Mesh3D, i0: number, i1: number, i2: number, color: number): void {
        if (!mesh) return
        mesh.faces.push(new Tri3D(i0, i1, i2, color))
    }

    // ===================== TRANSFORM =====================

    //% blockId=r3d_move_to block="move $mesh to x $x y $y z $z"
    //% group="Transform" weight=100
    //% mesh.shadow=variables_get
    export function moveMesh(mesh: Mesh3D, x: number, y: number, z: number): void {
        if (!mesh) return
        mesh.position.x = x
        mesh.position.y = y
        mesh.position.z = z
    }

    //% blockId=r3d_move_by block="move $mesh by dx $dx dy $dy dz $dz"
    //% group="Transform" weight=95
    //% mesh.shadow=variables_get
    //% dx.defl=0 dy.defl=0 dz.defl=0
    export function moveMeshBy(mesh: Mesh3D, dx: number, dy: number, dz: number): void {
        if (!mesh) return
        mesh.position.x += dx
        mesh.position.y += dy
        mesh.position.z += dz
    }

    //% blockId=r3d_set_rotation block="set $mesh rotation x $rx y $ry z $rz"
    //% group="Transform" weight=90
    //% mesh.shadow=variables_get
    //% rx.defl=0 ry.defl=0 rz.defl=0
    export function setMeshRotation(mesh: Mesh3D, rx: number, ry: number, rz: number): void {
        if (!mesh) return
        mesh.rotation.x = rx
        mesh.rotation.y = ry
        mesh.rotation.z = rz
    }

    //% blockId=r3d_rotate_by block="rotate $mesh by dx $drx dy $dry dz $drz"
    //% group="Transform" weight=85
    //% mesh.shadow=variables_get
    //% drx.defl=0 dry.defl=0 drz.defl=0
    export function rotateMeshBy(mesh: Mesh3D, drx: number, dry: number, drz: number): void {
        if (!mesh) return
        mesh.rotation.x += drx
        mesh.rotation.y += dry
        mesh.rotation.z += drz
    }

    //% blockId=r3d_set_scale block="set $mesh scale $s"
    //% group="Transform" weight=80
    //% mesh.shadow=variables_get
    //% s.defl=1
    export function setMeshScale(mesh: Mesh3D, s: number): void {
        if (!mesh) return
        mesh._scale = s
    }

    //% blockId=r3d_set_color block="set $mesh color $color"
    //% group="Transform" weight=70
    //% mesh.shadow=variables_get
    //% color.shadow=colorindexpicker
    export function setMeshColor(mesh: Mesh3D, color: number): void {
        if (!mesh) return
        for (let i = 0; i < mesh.faces.length; i++) {
            mesh.faces[i].color = color
        }
    }

    //% blockId=r3d_remove block="remove $mesh from scene"
    //% group="Transform" weight=60
    //% mesh.shadow=variables_get
    export function removeMesh(mesh: Mesh3D): void {
        if (!mesh) return
        const sc = ensureScene()
        for (let i = sc.meshes.length - 1; i >= 0; i--) {
            if (sc.meshes[i]._id === mesh._id) {
                sc.meshes.splice(i, 1)
                break
            }
        }
    }

    // ===================== COLLISION =====================

    const CAM_RADIUS = 0.8
    const CAM_HEIGHT = 2.0  // výška těla kamery (od nohou k očím)

    function _checkCollisionXZ(sc: Scene3D, cx: number, cy: number, cz: number): boolean {
        const camBottom = cy - CAM_HEIGHT
        for (let i = 0; i < sc.meshes.length; i++) {
            const m = sc.meshes[i]
            if (!m._collider) continue
            const hw = m._bboxW * m._scale / 2 + CAM_RADIUS
            const hh = m._bboxH * m._scale / 2
            const hd = m._bboxD * m._scale / 2 + CAM_RADIUS
            const dx = cx - m.position.x
            const dz = cz - m.position.z
            const boxTop = m.position.y + hh
            const boxBottom = m.position.y - hh
            // XZ overlap + Y overlap (camera body vs box)
            if (dx > -hw && dx < hw && dz > -hd && dz < hd &&
                camBottom < boxTop && cy > boxBottom) {
                return true
            }
        }
        return false
    }

    // Push camera out of any colliding object (iterate for safety)
    function _pushOut(sc: Scene3D): void {
        const cam = sc.camera
        for (let iter = 0; iter < 3; iter++) {
            let pushed = false
            const camBottom = cam.position.y - CAM_HEIGHT
            for (let i = 0; i < sc.meshes.length; i++) {
                const m = sc.meshes[i]
                if (!m._collider) continue
                const hw = m._bboxW * m._scale / 2 + CAM_RADIUS
                const hh = m._bboxH * m._scale / 2
                const hd = m._bboxD * m._scale / 2 + CAM_RADIUS
                const dx = cam.position.x - m.position.x
                const dz = cam.position.z - m.position.z
                const boxTop = m.position.y + hh
                const boxBottom = m.position.y - hh
                if (dx > -hw && dx < hw && dz > -hd && dz < hd &&
                    camBottom < boxTop && cam.position.y > boxBottom) {
                    // Camera is inside – push out on shortest XZ axis
                    const pushXp = hw - dx
                    const pushXn = hw + dx
                    const pushZp = hd - dz
                    const pushZn = hd + dz
                    const minPush = Math.min(
                        Math.min(pushXp, pushXn),
                        Math.min(pushZp, pushZn)
                    )
                    if (minPush === pushXp) cam.position.x = m.position.x + hw + 0.01
                    else if (minPush === pushXn) cam.position.x = m.position.x - hw - 0.01
                    else if (minPush === pushZp) cam.position.z = m.position.z + hd + 0.01
                    else cam.position.z = m.position.z - hd - 0.01
                    pushed = true
                }
            }
            if (!pushed) break
        }
    }

    //% blockId=r3d_set_collider block="set $mesh collider $enabled"
    //% group="Transform" weight=55
    //% mesh.shadow=variables_get
    //% enabled.defl=true
    export function setCollider(mesh: Mesh3D, enabled: boolean): void {
        if (!mesh) return
        mesh._collider = enabled
    }

    //% blockId=r3d_set_bbox block="set $mesh bounding box w $w h $h d $d"
    //% group="Transform" weight=54
    //% mesh.shadow=variables_get
    export function setBoundingBox(mesh: Mesh3D, w: number, h: number, d: number): void {
        if (!mesh) return
        mesh._bboxW = w
        mesh._bboxH = h
        mesh._bboxD = d
        mesh._collider = true
    }

    // ===================== LIGHT =====================

    //% blockId=r3d_set_light block="set light direction x $x y $y z $z"
    //% group="Light" weight=100
    //% x.defl=0.5 y.defl=0.8 z.defl=-0.3
    export function setLightDirection(x: number, y: number, z: number): void {
        ensureScene().lightDir = new Vec3(x, y, z).normalize()
    }

    // ===================== TEXTURE =====================

    //% blockId=r3d_create_tex block="create texture from image $img"
    //% group="Texture" weight=100
    //% img.shadow=screen_image_picker
    export function createTexture(img: Image): number {
        return Rasterizer.registerTexture(img)
    }

    //% blockId=r3d_set_mesh_tex block="set $mesh texture $texId"
    //% group="Texture" weight=90
    //% mesh.shadow=variables_get
    export function setMeshTexture(mesh: Mesh3D, texId: number): void {
        if (!mesh) return
        for (let i = 0; i < mesh.faces.length; i++) {
            mesh.faces[i].texId = texId
        }
    }

    //% blockId=r3d_set_face_tex block="set $mesh face $faceIndex texture $texId"
    //% group="Texture" weight=85
    //% mesh.shadow=variables_get
    export function setFaceTexture(mesh: Mesh3D, faceIndex: number, texId: number): void {
        if (!mesh || faceIndex < 0 || faceIndex >= mesh.faces.length) return
        mesh.faces[faceIndex].texId = texId
    }

    //% blockId=r3d_set_face_uv block="set $mesh face $faceIndex UV u0 $u0 v0 $v0 u1 $u1 v1 $v1 u2 $u2 v2 $v2"
    //% group="Texture" weight=80
    //% mesh.shadow=variables_get
    //% inlineInputMode=inline
    export function setFaceUV(mesh: Mesh3D, faceIndex: number,
        u0: number, v0: number, u1: number, v1: number, u2: number, v2: number): void {
        if (!mesh || faceIndex < 0 || faceIndex >= mesh.faces.length) return
        const f = mesh.faces[faceIndex]
        f.u0 = u0; f.v0 = v0
        f.u1 = u1; f.v1 = v1
        f.u2 = u2; f.v2 = v2
    }

    //% blockId=r3d_clear_mesh_tex block="clear $mesh texture"
    //% group="Texture" weight=70
    //% mesh.shadow=variables_get
    export function clearMeshTexture(mesh: Mesh3D): void {
        if (!mesh) return
        for (let i = 0; i < mesh.faces.length; i++) {
            mesh.faces[i].texId = -1
        }
    }

    // Built-in textures

    //% blockId=r3d_tex_brick block="brick texture"
    //% group="Texture" weight=60
    export function textureBrick(): number {
        const img = image.create(8, 8)
        // Row 0-2: brick row 1
        for (let x = 0; x < 8; x++) {
            img.setPixel(x, 0, 4)  // mortar line (orange)
            for (let y = 1; y <= 3; y++) {
                img.setPixel(x, y, 2) // red brick
            }
            img.setPixel(x, 4, 4)  // mortar line
            for (let y = 5; y <= 7; y++) {
                img.setPixel(x, y, 2) // red brick
            }
        }
        // Vertical mortar - offset rows
        img.setPixel(0, 1, 4); img.setPixel(0, 2, 4); img.setPixel(0, 3, 4)
        img.setPixel(4, 5, 4); img.setPixel(4, 6, 4); img.setPixel(4, 7, 4)
        return Rasterizer.registerTexture(img)
    }

    //% blockId=r3d_tex_window block="window wall texture"
    //% group="Texture" weight=59
    export function textureWindow(): number {
        const img = image.create(8, 8)
        // Wall background
        img.fill(12)  // dark gray concrete
        // Window pane (center)
        for (let y = 1; y <= 5; y++) {
            for (let x = 2; x <= 5; x++) {
                img.setPixel(x, y, 9) // light blue glass
            }
        }
        // Window frame
        img.setPixel(2, 3, 12); img.setPixel(3, 3, 12)
        img.setPixel(4, 3, 12); img.setPixel(5, 3, 12)
        img.setPixel(3, 1, 12); img.setPixel(3, 2, 12)
        img.setPixel(3, 4, 12); img.setPixel(3, 5, 12)
        return Rasterizer.registerTexture(img)
    }

    //% blockId=r3d_tex_stone block="stone texture"
    //% group="Texture" weight=58
    export function textureStone(): number {
        const img = image.create(8, 8)
        img.fill(12) // dark gray base
        // Stone pattern
        img.setPixel(0, 0, 1); img.setPixel(1, 0, 1)
        img.setPixel(2, 0, 12); img.setPixel(3, 0, 1)
        img.setPixel(4, 0, 1); img.setPixel(5, 0, 12)
        img.setPixel(6, 0, 1); img.setPixel(7, 0, 1)
        for (let y = 1; y <= 3; y++) {
            for (let x = 0; x < 8; x++) {
                img.setPixel(x, y, 1) // white stone
            }
            img.setPixel(2, y, 12) // gap
            img.setPixel(5, y, 12) // gap
        }
        img.fillRect(0, 4, 8, 1, 12) // mortar
        for (let y = 5; y <= 7; y++) {
            for (let x = 0; x < 8; x++) {
                img.setPixel(x, y, 1) // white stone
            }
            img.setPixel(0, y, 12) // gap
            img.setPixel(4, y, 12) // gap
            img.setPixel(7, y, 12) // gap
        }
        return Rasterizer.registerTexture(img)
    }

    //% blockId=r3d_tex_wood block="wood texture"
    //% group="Texture" weight=57
    export function textureWood(): number {
        const img = image.create(8, 8)
        img.fill(14) // brown base
        // Wood grain
        for (let y = 0; y < 8; y++) {
            img.setPixel(2, y, 4)  // orange grain
            img.setPixel(5, y, 4)  // orange grain
        }
        img.setPixel(1, 2, 4); img.setPixel(3, 5, 4)
        img.setPixel(6, 1, 4); img.setPixel(4, 6, 4)
        // Knot
        img.setPixel(6, 4, 15) // dark knot
        return Rasterizer.registerTexture(img)
    }

    //% blockId=r3d_tex_grass block="grass texture"
    //% group="Texture" weight=56
    export function textureGrass(): number {
        const img = image.create(8, 8)
        img.fill(7)  // green
        // Variation
        img.setPixel(1, 1, 6); img.setPixel(5, 3, 6)
        img.setPixel(3, 6, 6); img.setPixel(7, 0, 6)
        img.setPixel(0, 4, 6); img.setPixel(6, 7, 6)
        img.setPixel(2, 3, 5); img.setPixel(4, 1, 5) // yellow flowers
        img.setPixel(7, 5, 5)
        return Rasterizer.registerTexture(img)
    }

    //% blockId=r3d_tex_road block="road texture"
    //% group="Texture" weight=55
    export function textureRoad(): number {
        const img = image.create(8, 8)
        img.fill(15)  // black asphalt
        // Road marking (white dashed line in center)
        img.setPixel(3, 0, 1); img.setPixel(4, 0, 1)
        img.setPixel(3, 1, 1); img.setPixel(4, 1, 1)
        img.setPixel(3, 2, 1); img.setPixel(4, 2, 1)
        // Gray variation
        img.setPixel(1, 3, 12); img.setPixel(6, 5, 12)
        img.setPixel(0, 7, 12); img.setPixel(5, 1, 12)
        return Rasterizer.registerTexture(img)
    }
}
