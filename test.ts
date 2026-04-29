// ============================================================
// TEST / DEMO - 3D Mapa (dungeon / level)
// Šipky = pohyb a otáčení, A/B = nahoru/dolů
// ============================================================

Render3D.createScene()
Render3D.setSkyColor(15)
Render3D.setGroundColor(15)
Render3D.setLightDirection(0.3, 1, 0.2)

// Textury
let texBrick = Render3D.textureBrick()
let texStone = Render3D.textureStone()
let texWood = Render3D.textureWood()
let texGrass = Render3D.textureGrass()

// --- Definuj typy buněk ---
// 0 = prázdná podlaha (default)
Map3D.defineCellType(0, 0, 7, 12)       // podlaha: šedá
Map3D.setCellTopTexture(0, texStone)

Map3D.defineCellType(1, 3, 12, 12)      // zeď: vysoká, šedá
Map3D.setCellWallTexture(1, texStone)

Map3D.defineCellType(2, 2, 2, 14)       // cihlová zeď
Map3D.setCellWallTexture(2, texBrick)

Map3D.defineCellType(3, 1, 14, 7)       // nízký dřevěný blok
Map3D.setCellWallTexture(3, texWood)
Map3D.setCellTopTexture(3, texWood)

Map3D.defineCellType(4, 0, 7, 7)        // travnatá podlaha
Map3D.setCellTopTexture(4, texGrass)

Map3D.defineCellType(5, 4, 8, 12)       // vysoká modrá věž
Map3D.setCellWallTexture(5, texStone)

// --- Vytvoř mapu ---
Map3D.createMap(16, 16, 2)

// Okrajové zdi
Map3D.fillBorder(1)

// Místnosti
Map3D.fillRect(2, 2, 6, 6, 4)           // místnost 1: tráva
Map3D.fillRect(8, 2, 13, 6, 0)          // místnost 2: kámen
Map3D.fillRect(2, 8, 6, 13, 0)          // místnost 3
Map3D.fillRect(8, 8, 13, 13, 4)         // místnost 4: tráva

// Příčky mezi místnostmi
Map3D.drawLine(7, 2, 7, 6, 2)           // cihlová příčka
Map3D.drawLine(2, 7, 13, 7, 1)          // kamenná příčka
Map3D.drawLine(7, 8, 7, 13, 2)          // cihlová příčka

// Dveře (mezery v příčkách)
Map3D.setCell(7, 4, 0)
Map3D.setCell(5, 7, 0)
Map3D.setCell(10, 7, 0)
Map3D.setCell(7, 10, 0)

// Sloupy / dekorace
Map3D.setCell(4, 4, 3)
Map3D.setCell(10, 4, 3)
Map3D.setCell(4, 11, 5)

// Rozházené bloky
Map3D.scatter(3, 5, 8, 8, 13, 13)

// --- Postav mapu ---
Map3D.build()

// Kamera
Map3D.placeCameraAt(3, 3, 1.5)
Render3D.setCameraRotation(0.8, 0.1)
Render3D.setFieldOfView(70)

// Ovládání
game.onUpdate(function () {
    if (controller.up.isPressed()) Render3D.moveCameraForward(0.1)
    if (controller.down.isPressed()) Render3D.moveCameraForward(-0.1)
    if (controller.left.isPressed()) Render3D.rotateCamera(-0.04, 0)
    if (controller.right.isPressed()) Render3D.rotateCamera(0.04, 0)
    if (controller.A.isPressed()) Render3D.moveCameraUp(0.06)
    if (controller.B.isPressed()) Render3D.moveCameraUp(-0.06)
    Render3D.render()
})
