/* ============================================================================
   DRAG BIKE 3D — js/track.mjs
   Sirkuit drag 402m: aspal, garis start/finis, gantry lampu countdown 3D,
   pembatas, tribun + penonton, pohon, gedung jauh, langit senja + matahari.
   1 directional light + 1 hemisphere, tanpa shadow map (hemat HP).
   ============================================================================ */
import * as THREE from 'three';
import { TRACK_M } from './physics.mjs';

export const LANE_GAP = 3; // jarak antar lane (meter)

/* Posisi X lane ke-i dari total n lane. */
export function laneX(i, n) {
  return (i - (n - 1) / 2) * LANE_GAP;
}

function std(color, rough = 0.85, metal = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

export function buildTrack(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const add = (mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };

  // Langit senja + kabut (objek jauh memudar)
  scene.background = new THREE.Color(0x1c2440);
  scene.fog = new THREE.Fog(0x1c2440, 70, 340);

  // Cahaya: 1 directional (matahari terbenam) + 1 hemisphere
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.25);
  sun.position.set(-50, 70, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a7bff, 0x201510, 0.85));

  // Matahari (bola emissive di cakrawala)
  const sunBall = add(new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff9d00, fog: false })
  ), -90, 26, -330);

  // Tanah rumput
  add(new THREE.Mesh(new THREE.PlaneGeometry(700, 700), std(0x1d3a24, 1, 0)), 0, -0.05, -180)
    .rotation.x = -Math.PI / 2;

  // Aspal: lebar 18m, dari z=+18 sampai z=-424
  const asphalt = add(new THREE.Mesh(new THREE.BoxGeometry(18, 0.1, 442), std(0x232838, 0.95, 0)), 0, 0.02, -203);

  // Garis tepi aspal (kontinu)
  [-9.2, 9.2].forEach((x) => {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 442), std(0xeeeeee, 0.8, 0)), x, 0.03, -203);
  });

  // Garis putus-putus antar lane (4 lane: batas di x = -4.5, -1.5, 1.5, 4.5)
  [-4.5, -1.5, 1.5, 4.5].forEach((x) => {
    for (let z = 14; z > -420; z -= 8) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 4), std(0xffd54f, 0.8, 0)), x, 0.03, z);
    }
  });

  // Garis start (putih) di z=0
  add(new THREE.Mesh(new THREE.BoxGeometry(17, 0.12, 0.8), std(0xffffff, 0.7, 0)), 0, 0.04, 0);

  // Garis finis kotak-kotak di z=-402
  for (let ix = 0; ix < 16; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      const white = (ix + iz) % 2 === 0;
      add(new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.12, 1.05),
        std(white ? 0xffffff : 0x111111, 0.7, 0)
      ), -8 + ix * 1.07, 0.04, -TRACK_M - iz * 1.07);
    }
  }

  // Patok jarak tiap 50m (tiang + bendera warna)
  for (let m = 50; m < TRACK_M; m += 50) {
    const z = -m;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), std(0xbbbbbb, 0.6, 0.4)), -10, 0.8, z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), std(m % 100 === 0 ? 0xff5252 : 0x40c4ff, 0.6, 0.1)), -9.6, 1.4, z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), std(0xbbbbbb, 0.6, 0.4)), 10, 0.8, z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), std(m % 100 === 0 ? 0xff5252 : 0x40c4ff, 0.6, 0.1)), 9.6, 1.4, z);
  }

  // ---- Gantry lampu countdown di garis start ----
  const gantry = new THREE.Group();
  g.add(gantry);
  const postMat = std(0x39415c, 0.6, 0.5);
  [-7.5, 7.5].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.5), postMat);
    post.position.set(x, 3.2, 0);
    gantry.add(post);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.9, 0.6), postMat);
  beam.position.set(0, 6.2, 0);
  gantry.add(beam);
  // Pelat nama
  const plate = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.7, 0.1), std(0x111111, 0.6, 0.2));
  plate.position.set(0, 6.2, 0.35);
  gantry.add(plate);

  // 3 lampu merah + 1 hijau GO
  const lampGeo = new THREE.SphereGeometry(0.34, 14, 10);
  const lampMats = [];
  const lampPos = [-1.3, 0, 1.3];
  lampPos.forEach((x, i) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0.06, roughness: 0.4 });
    const lamp = new THREE.Mesh(lampGeo, m);
    lamp.position.set(x, 5.3, 0.35);
    gantry.add(lamp);
    lampMats.push(m);
  });
  const goMat = new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x00ff44, emissiveIntensity: 0.06, roughness: 0.4 });
  const goLamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), goMat);
  goLamp.position.set(3.4, 5.3, 0.35);
  gantry.add(goLamp);

  /* step: -1 mati semua, 0/1/2 = lampu merah ke-1/2/3 menyala, 3 = GO hijau. */
  function setLights(step) {
    lampMats.forEach((m, i) => {
      const on = step >= 0 && step <= 2 && i <= step;
      m.emissiveIntensity = on ? 2.2 : 0.06;
      m.color.setHex(on ? 0x550000 : 0x330000);
    });
    const goOn = step === 3;
    goMat.emissiveIntensity = goOn ? 2.6 : 0.06;
    goMat.color.setHex(goOn ? 0x005511 : 0x003300);
  }
  setLights(-1);

  // ---- Tribun + penonton (dekat garis start) ----
  function grandstand(side) { // side: -1 kiri, +1 kanan
    const st = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, 34), std(0x2c3350, 0.9, 0.05));
    base.position.set(0, 2.1, 0);
    st.add(base);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 34), std(0x1a2036, 0.8, 0.1));
    roof.position.set(0, 4.5, 0);
    st.add(roof);
    // Penonton: titik-titik warna-warni (InstancedMesh, murah)
    const dotGeo = new THREE.SphereGeometry(0.16, 6, 5);
    const dotMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const rows = 3, cols = 26;
    const dots = new THREE.InstancedMesh(dotGeo, dotMat, rows * cols);
    const dummy = new THREE.Object3D();
    const palette = [0xff5252, 0xffd54f, 0x40c4ff, 0x69f0ae, 0xff80ab, 0xffffff];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Baris makin tinggi = makin jauh dari lintasan (tangga tribun)
        dummy.position.set(
          side * (11 + r * 1.2) + (Math.random() - 0.5) * 0.5,
          3.1 + r * 0.6,
          -15 + c * 1.2 + (Math.random() - 0.5) * 0.4
        );
        dummy.updateMatrix();
        dots.setMatrixAt(k, dummy.matrix);
        dots.setColorAt(k, new THREE.Color(palette[(r * cols + c) % palette.length]));
        k++;
      }
    }
    dots.instanceMatrix.needsUpdate = true;
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    st.add(dots);
    st.position.set(side * 14, 0, -6);
    g.add(st);
  }
  grandstand(-1);
  grandstand(1);

  // ---- Pohon (batang + tajuk) ----
  const trunkMat = std(0x4a3220, 1, 0);
  const leafMat = std(0x1e5c2e, 1, 0);
  const leafMat2 = std(0x2a7a35, 1, 0);
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (16 + Math.random() * 42);
    const z = 30 - Math.random() * 460;
    if (Math.abs(z + 6) < 24 && Math.abs(x) < 20) continue; // jangan menutupi tribun
    const h = 2.2 + Math.random() * 1.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, h, 6), trunkMat);
    trunk.position.set(x, h / 2, z);
    g.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.4 + Math.random(), 3 + Math.random() * 1.5, 7), i % 2 ? leafMat : leafMat2);
    crown.position.set(x, h + 1.6, z);
    g.add(crown);
  }

  // ---- Gedung jauh (siluet kota) ----
  const buildMat = std(0x131728, 1, 0);
  const buildMat2 = std(0x1b2340, 1, 0);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const w = 8 + Math.random() * 10;
    const h = 8 + Math.random() * 20;
    const d = 8 + Math.random() * 8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i % 2 ? buildMat : buildMat2);
    b.position.set(side * (28 + Math.random() * 55), h / 2 - 0.1, -40 - Math.random() * 360);
    g.add(b);
    // Jendela menyala (strip emissive tipis)
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, 0.25, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffca28 })
    );
    win.position.set(b.position.x, h * (0.4 + Math.random() * 0.4), b.position.z + d / 2 + 0.06);
    g.add(win);
  }

  // Pembatas (barrier) di sepanjang lintasan, kiri-kanan
  const barMat = std(0x8a94a6, 0.7, 0.3);
  const barMat2 = std(0xd23c3c, 0.7, 0.2);
  for (let z = 16; z > -420; z -= 12) {
    const m = (Math.round(z / 12) % 2 === 0) ? barMat : barMat2;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 5), m);
    b1.position.set(-10.5, 0.45, z);
    g.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 5), m);
    b2.position.set(10.5, 0.45, z);
    g.add(b2);
  }

  return { group: g, setLights, sunBall };
}
