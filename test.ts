// ============================================================
// TEST / DEMO - 3D Město
// Ukázkové městečko s budovami, střechami a podlahou
// Šipky = pohyb a otáčení, A/B = nahoru/dolů
// ============================================================

Render3D.createScene()
Render3D.setSkyColor(9)
Render3D.setGroundColor(12)
Render3D.setLightDirection(0.5, 0.8, -0.3)

// Podlaha
Render3D.addGround(0, 40, 6)

// ----- Ulice: střední řada budov -----

// Modrá budova vlevo
let b1 = Render3D.addBox(0, 1.5, 5, 2, 3, 2, 8)
// Střecha
Render3D.addPyramid(0, 3, 5, 2.5, 1, 12)

// Červená budova vpravo
let b2 = Render3D.addBox(5, 1, 5, 2, 2, 2, 2)
// Střecha (šikmá)
Render3D.addWedge(5, 2, 5, 2, 0.8, 2, 14)

// Zelená budova - výšková
let b3 = Render3D.addBox(-4, 2, 8, 2, 4, 2, 7)
Render3D.addPyramid(-4, 4, 8, 2.5, 1.2, 6)

// ----- Zadní řada budov -----

// Žlutý dům
Render3D.addBox(3, 0.75, 12, 1.5, 1.5, 1.5, 5)

// Fialová věž
Render3D.addBox(-2, 2.5, 14, 1.5, 5, 1.5, 11)
Render3D.addPyramid(-2, 5, 14, 2, 1.5, 10)

// Oranžový dům
Render3D.addBox(7, 1, 10, 3, 2, 2, 4)
Render3D.addWedge(7, 2, 10, 3, 1, 2, 14)

// Malý červený domek
Render3D.addBox(-6, 0.5, 5, 1, 1, 1, 2)
Render3D.addPyramid(-6, 1, 5, 1.3, 0.5, 14)

// ----- Přední řada budov -----
Render3D.addBox(4, 1.25, 0, 2.5, 2.5, 2, 9)
Render3D.addBox(-5, 0.75, -2, 1.5, 1.5, 1.5, 3)

// ----- Kamera -----
Render3D.setCameraPosition(0, 2.5, -8)
Render3D.setCameraRotation(0, 0.2)
Render3D.setFieldOfView(60)

// ----- Ovládání -----
game.onUpdate(function () {
    // Pohyb dopředu/dozadu
    if (controller.up.isPressed()) {
        Render3D.moveCameraForward(0.12)
    }
    if (controller.down.isPressed()) {
        Render3D.moveCameraForward(-0.12)
    }
    // Otáčení
    if (controller.left.isPressed()) {
        Render3D.rotateCamera(-0.04, 0)
    }
    if (controller.right.isPressed()) {
        Render3D.rotateCamera(0.04, 0)
    }
    // Nahoru/dolů (A/B tlačítka)
    if (controller.A.isPressed()) {
        Render3D.moveCameraUp(0.08)
    }
    if (controller.B.isPressed()) {
        Render3D.moveCameraUp(-0.08)
    }

    // Animace: pomalu rotuj modrou budovu
    Render3D.rotateMeshBy(b1, 0, 0.01, 0)

    // Renderuj scénu
    Render3D.render()
})
