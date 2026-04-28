// ============================================================
// 3D Math - Vectors and rotation functions
// ============================================================

class Vec3 {
    public x: number
    public y: number
    public z: number

    constructor(x: number, y: number, z: number) {
        this.x = x
        this.y = y
        this.z = z
    }

    add(v: Vec3): Vec3 {
        return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z)
    }

    sub(v: Vec3): Vec3 {
        return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z)
    }

    scale(s: number): Vec3 {
        return new Vec3(this.x * s, this.y * s, this.z * s)
    }

    dot(v: Vec3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z
    }

    cross(v: Vec3): Vec3 {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        )
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
    }

    normalize(): Vec3 {
        const l = this.length()
        if (l < 0.0001) return new Vec3(0, 0, 0)
        return new Vec3(this.x / l, this.y / l, this.z / l)
    }

    clone(): Vec3 {
        return new Vec3(this.x, this.y, this.z)
    }
}

namespace Math3D {
    export function vec(x: number, y: number, z: number): Vec3 {
        return new Vec3(x, y, z)
    }

    export function rotateX(v: Vec3, a: number): Vec3 {
        const c = Math.cos(a)
        const s = Math.sin(a)
        return new Vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c)
    }

    export function rotateY(v: Vec3, a: number): Vec3 {
        const c = Math.cos(a)
        const s = Math.sin(a)
        return new Vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c)
    }

    export function rotateZ(v: Vec3, a: number): Vec3 {
        const c = Math.cos(a)
        const s = Math.sin(a)
        return new Vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z)
    }
}
