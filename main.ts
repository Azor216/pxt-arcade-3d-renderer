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
    private static _nextId: number = 0

    constructor() {
        this.vertices = []
        this.faces = []
        this.position = new Vec3(0, 0, 0)
        this.rotation = new Vec3(0, 0, 0)
        this._scale = 1
        this._id = Mesh3D._nextId++
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
//% groups="['Scene', 'Camera', 'Objects', 'Transform', 'Light']"
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

                // Near plane clipping
                if (v0.z < NEAR || v1.z < NEAR || v2.z < NEAR) continue

                // Perspective projection
                const sx0 = v0.x * focalLen / v0.z + HW
                const sy0 = -v0.y * focalLen / v0.z + HH
                const sx1 = v1.x * focalLen / v1.z + HW
                const sy1 = -v1.y * focalLen / v1.z + HH
                const sx2 = v2.x * focalLen / v2.z + HW
                const sy2 = -v2.y * focalLen / v2.z + HH

                // Backface culling (screen space signed area)
                const area = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0)
                if (area >= 0) continue

                // Off-screen rejection
                const minSx = Math.min(sx0, Math.min(sx1, sx2))
                const maxSx = Math.max(sx0, Math.max(sx1, sx2))
                const minSy = Math.min(sy0, Math.min(sy1, sy2))
                const maxSy = Math.max(sy0, Math.max(sy1, sy2))
                if (maxSx < 0 || minSx >= SW || maxSy < 0 || minSy >= SH) continue

                // Compute face normal in world space for lighting
                const e1 = mesh.vertices[face.i1].sub(mesh.vertices[face.i0])
                const e2 = mesh.vertices[face.i2].sub(mesh.vertices[face.i0])
                let normal = e1.cross(e2).normalize()

                // Apply mesh rotation to normal
                if (mesh.rotation.y !== 0) normal = Math3D.rotateY(normal, mesh.rotation.y)
                if (mesh.rotation.x !== 0) normal = Math3D.rotateX(normal, mesh.rotation.x)
                if (mesh.rotation.z !== 0) normal = Math3D.rotateZ(normal, mesh.rotation.z)

                // Lighting
                const light = normal.dot(sc.lightDir)
                const shadedColor = Rasterizer.shadeColor(face.color, light)

                // Average depth for painter's algorithm
                const avgZ = (v0.z + v1.z + v2.z) / 3

                const rf = new RenderFace()
                rf.sx0 = sx0; rf.sy0 = sy0
                rf.sx1 = sx1; rf.sy1 = sy1
                rf.sx2 = sx2; rf.sy2 = sy2
                rf.color = shadedColor
                rf.depth = avgZ
                renderList.push(rf)
            }
        }

        // Sort back-to-front (painter's algorithm)
        renderList.sort((a: RenderFace, b: RenderFace) => b.depth - a.depth)

        // Rasterize all visible faces
        for (let i = 0; i < renderList.length; i++) {
            const f = renderList[i]
            Rasterizer.fillTriangle(
                img,
                f.sx0, f.sy0,
                f.sx1, f.sy1,
                f.sx2, f.sy2,
                f.color
            )
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
        const cam = ensureScene().camera
        cam.position.x += Math.sin(cam.yaw) * amount
        cam.position.z += Math.cos(cam.yaw) * amount
    }

    //% blockId=r3d_cam_right block="move camera right by $amount"
    //% group="Camera" weight=69
    //% amount.defl=0.1
    export function moveCameraRight(amount: number): void {
        const cam = ensureScene().camera
        cam.position.x += Math.cos(cam.yaw) * amount
        cam.position.z += -Math.sin(cam.yaw) * amount
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
        mesh.faces = [
            // Front face (+Z): normal (0,0,1)
            new Tri3D(4, 5, 6, color),
            new Tri3D(4, 6, 7, color),
            // Back face (-Z): normal (0,0,-1)
            new Tri3D(0, 3, 2, color),
            new Tri3D(0, 2, 1, color),
            // Right face (+X): normal (1,0,0)
            new Tri3D(1, 2, 6, color),
            new Tri3D(1, 6, 5, color),
            // Left face (-X): normal (-1,0,0)
            new Tri3D(0, 4, 7, color),
            new Tri3D(0, 7, 3, color),
            // Top face (+Y): normal (0,1,0)
            new Tri3D(3, 7, 6, color),
            new Tri3D(3, 6, 2, color),
            // Bottom face (-Y): normal (0,-1,0)
            new Tri3D(0, 1, 5, color),
            new Tri3D(0, 5, 4, color),
        ]

        mesh.position = new Vec3(x, y, z)
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

    // ===================== LIGHT =====================

    //% blockId=r3d_set_light block="set light direction x $x y $y z $z"
    //% group="Light" weight=100
    //% x.defl=0.5 y.defl=0.8 z.defl=-0.3
    export function setLightDirection(x: number, y: number, z: number): void {
        ensureScene().lightDir = new Vec3(x, y, z).normalize()
    }
}
