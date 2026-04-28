# arcade-3d-engine

Real 3D rendering engine extension for Microsoft MakeCode Arcade.

## Features

- **Perspective projection** with configurable FOV
- **Primitive meshes**: Cube, Box, Pyramid, Wedge, Ground plane
- **Custom meshes**: define your own vertices and triangles
- **Flat shading** with directional light (3 shade levels)
- **Backface culling** for performance
- **Painter's algorithm** depth sorting
- **Camera controls**: position, rotation, move forward/backward/strafe
- **MakeCode Blocks** – usable from both Block editor and TypeScript

## How to Use

### Import as Extension

1. Open [MakeCode Arcade](https://arcade.makecode.com/)
2. Create a new project
3. Click ⚙️ (gear) → **Extensions**
4. Paste the GitHub URL of this repository

### Quick Start (TypeScript)

```typescript
// Initialize
Render3D.createScene()

// Add objects
let building = Render3D.addBox(0, 1, 5, 2, 2, 2, 8)  // blue box
Render3D.addPyramid(0, 2, 5, 2.5, 1, 14)              // brown roof
Render3D.addGround(0, 20, 7)                            // green ground

// Camera
Render3D.setCameraPosition(0, 3, -5)
Render3D.setCameraRotation(0, 0.3)

// Game loop
game.onUpdate(function () {
    if (controller.up.isPressed()) Render3D.moveCameraForward(0.1)
    if (controller.down.isPressed()) Render3D.moveCameraForward(-0.1)
    if (controller.left.isPressed()) Render3D.rotateCamera(-0.04, 0)
    if (controller.right.isPressed()) Render3D.rotateCamera(0.04, 0)

    Render3D.render()
})
```

## Block Reference

### Scene
| Block | Description |
|---|---|
| `initialize 3D scene` | Create a new 3D scene |
| `render 3D scene` | Render the current frame |
| `set sky color` | Change sky color |
| `set ground color` | Change ground color |
| `clear all objects` | Remove all meshes |

### Camera
| Block | Description |
|---|---|
| `set camera position x y z` | Set absolute camera position |
| `set camera rotation yaw pitch` | Set camera rotation angles |
| `set field of view` | Set FOV in degrees (default 60) |
| `move camera forward by` | Move along look direction |
| `move camera right by` | Strafe sideways |
| `move camera up by` | Move vertically |
| `rotate camera yaw by pitch by` | Rotate camera incrementally |

### Objects
| Block | Description |
|---|---|
| `add cube at x y z size color` | Add a cube |
| `add box at x y z w h d color` | Add a box with custom dimensions |
| `add pyramid at x y z size height color` | Add a pyramid |
| `add wedge at x y z w h d color` | Add a wedge/ramp shape |
| `add ground at y size color` | Add a flat ground plane |
| `add custom mesh` | Create empty mesh for custom geometry |
| `mesh add vertex x y z` | Add vertex to custom mesh |
| `mesh add triangle i0 i1 i2 color` | Add triangle face to custom mesh |

### Transform
| Block | Description |
|---|---|
| `move mesh to x y z` | Set mesh position |
| `move mesh by dx dy dz` | Move mesh relative |
| `set mesh rotation x y z` | Set mesh rotation (radians) |
| `rotate mesh by dx dy dz` | Rotate mesh incrementally |
| `set mesh scale` | Uniform scale |
| `set mesh color` | Change all face colors |
| `remove mesh from scene` | Delete mesh from scene |

### Light
| Block | Description |
|---|---|
| `set light direction x y z` | Set directional light vector |

## Color Palette

MakeCode Arcade 16-color palette:

| Index | Color |
|---|---|
| 1 | White |
| 2 | Red |
| 3 | Pink |
| 4 | Orange |
| 5 | Yellow |
| 6 | Teal |
| 7 | Green |
| 8 | Blue |
| 9 | Light Blue |
| 10 | Purple |
| 11 | Light Purple |
| 12 | Dark Gray |
| 13 | Tan |
| 14 | Brown |
| 15 | Black |

## Technical Details

- **Rendering**: Scanline triangle rasterizer
- **Depth sorting**: Painter's algorithm (back-to-front)
- **Shading**: 3-level flat shading based on face normal · light direction
- **Culling**: Backface culling via screen-space signed area
- **Projection**: Perspective with configurable FOV
- **Coordinate system**: X = right, Y = up, Z = forward (left-handed)
