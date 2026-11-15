/* ============================================================================
   DRAG BIKE 3D — js/bike.mjs
   Model motor drag dari primitif Three.js (Box, Cylinder, Torus, Sphere).
   Tanpa model/tekstur download. Motor menghadap -Z (arah finis).
   Upgrade mengubah tampilan: knalpot makin besar, ban makin tebal,
   mesin makin besar + aksen, nitro muncul botolnya.
   ============================================================================ */
import * as THREE from 'three';

function std(color, rough = 0.65, metal = 0.25) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

/* Bangun satu motor. upgrades: {mesin, knalpot, ban, nitro} (0-5). */
export function buildBike(colorHex, upgrades) {
  const up = upgrades || { mesin: 0, knalpot: 0, ban: 0, nitro: 0 };
  const color = new THREE.Color(colorHex);
  const group = new THREE.Group(); // origin: tanah, tengah-tengah roda
  const tilt = new THREE.Group(); // pivot di as roda belakang (wheelie)
  tilt.position.set(0, 0.32, 0.55);
  group.add(tilt);
  const put = (mesh, x, y, z) => { mesh.position.set(x, y - 0.32, z - 0.55); tilt.add(mesh); return mesh; };

  const tireTube = 0.085 + up.ban * 0.008;
  const wheels = [];
  [-0.55, 0.55].forEach((z) => {
    const spin = new THREE.Group();
    spin.position.set(0, 0.32 - 0.32, z - 0.55);
    tilt.add(spin);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, tireTube, 10, 20), std(0x141414, 0.9, 0.05));
    tire.rotation.y = Math.PI / 2;
    spin.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 12), std(0xdddddd, 0.35, 0.8));
    rim.rotation.z = Math.PI / 2;
    spin.add(rim);
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.03), std(0x888888, 0.4, 0.7));
      spoke.rotation.x = (s * Math.PI) / 3;
      spin.add(spoke);
    }
    wheels.push(spin);
  });

  // Rangka + mesin (membesar ikut level mesin)
  const engineSize = 1 + up.mesin * 0.08;
  const engine = put(new THREE.Mesh(new THREE.BoxGeometry(0.34 * engineSize, 0.3, 0.55), std(0x333944, 0.5, 0.6)), 0, 0.55, 0.05);
  engine.castShadow = false;
  // Tangki
  const tank = put(new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), std(colorHex, 0.35, 0.5)), 0, 0.82, -0.12);
  tank.scale.set(0.85, 0.62, 1.25);
  // Aksen warna mesin di tangki
  if (up.mesin >= 3) {
    const stripe = put(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.5), std(0xffd54f, 0.3, 0.7)), 0, 0.98, -0.12);
    stripe.rotation.x = 0;
  }
  // Jok
  put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.5), std(0x181818, 0.9, 0.05)), 0, 0.78, 0.42);
  // Garpu depan
  [-0.09, 0.09].forEach((x) => {
    const fork = put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), std(0xbbbbbb, 0.3, 0.85)), x, 0.62, -0.5);
    fork.rotation.x = 0.35;
  });
  // Setang
  const bar = put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.56, 8), std(0x222222, 0.5, 0.6)), 0, 0.98, -0.42);
  bar.rotation.z = Math.PI / 2;
  [-0.28, 0.28].forEach((x) => {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), std(0x111111, 0.9, 0.1)), x, 0.98, -0.42).rotation.z = Math.PI / 2;
  });
  // Spatbor depan (tipis di atas roda depan)
  const fender = put(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.42), std(colorHex, 0.5, 0.4)), 0, 0.68, -0.55);
  fender.rotation.x = 0.15;

  // Knalpot (membesar + berubah warna ikut level)
  const exR = 0.055 + up.knalpot * 0.012;
  const exLen = 0.5 + up.knalpot * 0.05;
  const exColor = up.knalpot >= 4 ? 0xd4af37 : up.knalpot >= 2 ? 0xaaaaaa : 0x777777;
  const exhaust = put(new THREE.Mesh(new THREE.CylinderGeometry(exR, exR * 1.15, exLen, 10), std(exColor, 0.3, 0.85)), 0.2, 0.42, 0.42);
  exhaust.rotation.x = Math.PI / 2;
  // Ujung knalpot
  put(new THREE.Mesh(new THREE.CylinderGeometry(exR * 1.1, exR * 1.1, 0.05, 10), std(0x222222, 0.6, 0.5)), 0.2, 0.42, 0.42 + exLen / 2).rotation.x = Math.PI / 2;

  // Botol nitro (muncul kalau level nitro > 0, membesar ikut level)
  if (up.nitro > 0) {
    const bottle = put(new THREE.Mesh(new THREE.CylinderGeometry(0.05 + up.nitro * 0.008, 0.05 + up.nitro * 0.008, 0.22 + up.nitro * 0.04, 10), std(0x00bcd4, 0.3, 0.6)), -0.2, 0.55, 0.3);
    bottle.rotation.x = Math.PI / 2;
  }

  // Rider sederhana: badan + helm + lengan + kaki
  const suit = std(0x222831, 0.8, 0.05);
  const torso = put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.24), suit), 0, 1.02, 0.18);
  torso.rotation.x = 0.55; // membungkuk ke depan
  const helmet = put(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), std(colorHex, 0.3, 0.4)), 0, 1.28, -0.02);
  const visor = put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.05), std(0x111111, 0.2, 0.8)), 0, 1.27, -0.15);
  visor.rotation.x = 0.2;
  [-0.19, 0.19].forEach((x) => {
    const arm = put(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), suit), x, 1.08, -0.18);
    arm.rotation.x = 1.1;
    const leg = put(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 8), suit), x, 0.62, 0.3);
    leg.rotation.x = 1.35;
  });

  // Api nitro di ujung knalpot (cone, emissive)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 10), flameMat);
  flame.position.set(0.2, 0.42 - 0.32, 0.42 + exLen / 2 + 0.25 - 0.55);
  flame.rotation.x = Math.PI / 2; // mengarah ke belakang (+Z)
  flame.visible = false;
  tilt.add(flame);

  const bike = {
    group, tilt, wheels, flame,
    /* Dipanggil tiap frame dengan state racer. */
    update(racer, dt) {
      // Putar roda sesuai kecepatan
      const w = racer.speed / 0.32;
      wheels.forEach((wh) => { wh.rotation.x -= w * dt; });
      // Wheelie saat launch: gas + kecepatan rendah
      const target = racer.gas && racer.speed < 12 && !racer.finished ? 0.16 : 0;
      tilt.rotation.x += (target - tilt.rotation.x) * Math.min(1, dt * 6);
      // Getaran halus di RPM tinggi
      const vib = racer.gas ? (racer.rpm / 12000) * 0.012 : 0;
      tilt.position.y = 0.32 + (vib ? (Math.random() - 0.5) * vib : 0);
      // Api nitro
      flame.visible = !!racer.nitroActive && racer.nitroLeft > 0;
      if (flame.visible) {
        const s = 0.8 + Math.random() * 0.5;
        flame.scale.set(s, s, 0.8 + Math.random() * 0.6);
      }
    }
  };
  return bike;
}

/* ---------------- Pool asap ban (sprite) ---------------- */
export function createSmokePool(scene, count = 48) {
  // Tekstur bulat lembut digambar lokal via canvas (bukan download).
  let texture = null;
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    texture = new THREE.CanvasTexture(cv);
  }
  const pool = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, color: 0xcccccc });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(0.5, 0.5, 1);
    spr.visible = false;
    scene.add(spr);
    pool.push({ spr, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  let idx = 0;
  return {
    spawn(x, y, z) {
      const p = pool[idx]; idx = (idx + 1) % pool.length;
      p.spr.position.set(x, y, z);
      p.spr.visible = true;
      p.spr.material.opacity = 0.55;
      p.spr.scale.set(0.6, 0.6, 1);
      p.life = 1;
      p.vx = (Math.random() - 0.5) * 0.6;
      p.vy = 0.8 + Math.random() * 0.7;
      p.vz = 0.5 + Math.random() * 0.5; // asap tertinggal ke belakang (+Z)
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt * 1.3;
        if (p.life <= 0) { p.spr.visible = false; continue; }
        p.spr.position.x += p.vx * dt;
        p.spr.position.y += p.vy * dt;
        p.spr.position.z += p.vz * dt;
        const s = p.spr.scale.x + dt * 1.8;
        p.spr.scale.set(s, s, 1);
        p.spr.material.opacity = Math.max(0, p.life) * 0.55;
      }
    }
  };
}
