import * as THREE from 'three';

/**
 * createRocket()
 * High-fidelity procedural rocket using smooth geometries and MeshStandardMaterials.
 * Features: True conical nose, bevel-edged engine cone, aerodynamic fin sweeps.
 */
export function createRocket() {
    const group = new THREE.Group();

    // ── PREMIUM MATERIALS ─────────────────────────────────────────────────────
    const matWhite = new THREE.MeshStandardMaterial({
        color: 0xfafafa,
        roughness: 0.2,
        metalness: 0.1
    });

    const matRed = new THREE.MeshStandardMaterial({
        color: 0xd32f2f,
        roughness: 0.3,
        metalness: 0.2
    });

    // Uses MeshPhysicalMaterial for beautiful glass rendering if renderer supports it
    const matGlass = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        transmission: 0.9,
        opacity: 1,
        metalness: 0.1,
        roughness: 0.05,
        ior: 1.5,
        thickness: 0.2
    });

    const matSteel = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.4,
        metalness: 0.8
    });

    const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        group.add(m);
        return m;
    };

    // ── FUSELAGE — Smoother tapered cylinder ──────────────────────────────
    // radiusTop, radiusBottom, height, radialSegs
    add(new THREE.CylinderGeometry(0.9, 1.25, 2.8, 32), matWhite, 0, 1.4, 0);

    // ── NOSE CONE — Smooth parabolic illusion ─────────────────────────────
    // Cylinder geometry with top radius 0.05 gives a slightly blunted nose cone
    add(new THREE.CylinderGeometry(0.05, 0.9, 1.4, 32), matWhite, 0, 3.5, 0);

    // ── RED HORIZONTAL BANDS (Stripes inset/outset) ───────────────────────
    add(new THREE.CylinderGeometry(1.04, 1.15, 0.2, 32), matRed, 0, 2.2, 0);
    // Upper stripe on the nose base
    add(new THREE.CylinderGeometry(0.72, 0.85, 0.15, 32), matRed, 0, 3.2, 0);

    // ── PORTHOLES ──────────────────────────────────────────────────────────
    const portY1 = 2.6;
    const portY2 = 1.3;

    [portY1, portY2].forEach((py, idx) => {
        const r = idx === 0 ? 0.98 : 1.18; // offset to match fuselage taper

        // Dark interior backing for depth
        const backing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 32), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        backing.rotation.z = Math.PI / 2;
        backing.position.set(r - 0.05, py, 0);
        group.add(backing);

        // Thick glass dome instead of flat disc for 3D reflections
        const glass = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.5), matGlass);
        glass.rotation.z = -Math.PI / 2;
        glass.position.set(r - 0.08, py, 0);
        group.add(glass);

        // Swept metallic/red rim
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 16, 32), matRed);
        rim.rotation.y = Math.PI / 2;
        rim.position.set(r + 0.02, py, 0);
        group.add(rim);
    });

    // ── ANTENNA SPIKE ──────────────────────────────────────────────────────
    add(new THREE.CylinderGeometry(0.02, 0.05, 0.8, 16), matSteel, 0, 4.5, 0);
    add(new THREE.SphereGeometry(0.08, 16, 16), matRed, 0, 4.9, 0);

    // ── AERODYNAMIC FINS (4 evenly spaced) ─────────────────────────────────
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const finGroup = new THREE.Group();

        // High-fidelity swept fin using ExtrudeGeometry for proper rounded edges
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 1.2);
        finShape.quadraticCurveTo(0.6, 1.0, 1.0, -0.2); // Outer sweep
        finShape.lineTo(1.2, -0.6); // Tip drop
        finShape.lineTo(0.2, -0.6); // Flat base
        finShape.lineTo(0, -0.2); // Inner notch
        finShape.lineTo(0, 1.2);

        const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
        const finBody = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, extrudeSettings), matRed);

        // Center the extrusion roughly around Z axis for rotations
        finBody.position.set(0.8, 0, -0.05);
        finGroup.add(finBody);

        // Stabilizer thruster/foot box
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), matSteel);
        foot.position.set(1.15, -0.6, 0);
        finGroup.add(foot);

        finGroup.rotation.y = angle;
        group.add(finGroup);
    }

    // ── MAIN ENGINE BELL (Nozzle) ──────────────────────────────────────────
    // Multiple stepped flairs for engine realism
    add(new THREE.CylinderGeometry(0.8, 0.6, 0.3, 32), matSteel, 0, -0.15, 0);
    add(new THREE.CylinderGeometry(0.5, 0.55, 0.2, 32), matRed, 0, -0.4, 0);
    add(new THREE.CylinderGeometry(0.55, 0.85, 0.5, 32), matSteel, 0, -0.75, 0);

    // Internal exhaust cone to prevent seeing inside the engine block
    const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    exhaust.position.set(0, -0.9, 0);
    exhaust.rotation.x = Math.PI;
    group.add(exhaust);

    // ── CAST SHADOWS ──────────────────────────────────────────────────────
    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return group;
}
