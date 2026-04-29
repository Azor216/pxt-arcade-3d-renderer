// ============================================================
// TEST / DEMO - 3D Město z mapy
// Šipky = pohyb a otáčení, A/B = nahoru/dolů
// ============================================================

Render3D.createScene()
Render3D.setSkyColor(9)
Render3D.setGroundColor(12)
Render3D.setLightDirection(0.5, 0.8, -0.3)

// Textury
let texBrick = Render3D.textureBrick()
let texWindow = Render3D.textureWindow()
let texGrass = Render3D.textureGrass()

// Vygeneruj preset město
Map3D.presetCity(12, 12)

// Nastav textury typům budov
Map3D.setBuildingTexture(2, texBrick)   // červené domy = cihla
Map3D.setBuildingTexture(3, texWindow)  // modré kanceláře = okna
Map3D.setBuildingTexture(7, texWindow)  // mrakodrap = okna

// Postav město
Map3D.buildCity()
Map3D.setGroundTexture(texGrass)

// Kamera na ulici
Map3D.placeCameraAt(1, 1, 2.5)
Render3D.setCameraRotation(0.5, 0.2)
Render3D.setFieldOfView(60)

// Ovládání
game.onUpdate(function () {
    if (controller.up.isPressed()) {
        Render3D.moveCameraForward(0.12)
    }
    if (controller.down.isPressed()) {
        Render3D.moveCameraForward(-0.12)
    }
    if (controller.left.isPressed()) {
        Render3D.rotateCamera(-0.04, 0)
    }
    if (controller.right.isPressed()) {
        Render3D.rotateCamera(0.04, 0)
    }
    if (controller.A.isPressed()) {
        Render3D.moveCameraUp(0.08)
    }
    if (controller.B.isPressed()) {
        Render3D.moveCameraUp(-0.08)
    }
    Render3D.render()
})
