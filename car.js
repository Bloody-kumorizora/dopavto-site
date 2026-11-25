// 3D-машина для DopAvto. Модель: «Car Concept» (Khronos Group, на основе модели Unity Fan, CC BY 4.0),
// окраска «Torched Graphite». Поверх модели в коде добавлены узлы услуг: экран, динамики, камеры, датчики и т. д.
// Координаты модели: X — ширина, Y — вверх, Z — вперёд. На сцене машина повёрнута носом в +X.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const box = document.getElementById("car");
const loading = document.getElementById("carLoading");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const AMBER = new THREE.Color("#F5A623");
const MODEL_URL = "carconcept.glb?v=1";

let arrived = false;
const markArrived = () => { if (arrived) return; arrived = true; window.dispatchEvent(new Event("car:arrived")); };
function fallback(msg) {
  markArrived();
  loading?.remove();
  const img = document.createElement("img");
  img.className = "car-fallback"; img.src = "img/work-1.webp"; img.alt = "Android-магнитола в Nissan";
  box.appendChild(img);
  console.warn("3D недоступно:", msg);
}

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
catch (e) { fallback(e); throw e; }
const SMALL = Math.min(innerWidth, innerHeight) < 700;   // телефон: без зеркального пола, полегче
renderer.setPixelRatio(Math.min(devicePixelRatio, SMALL ? 1.75 : 2));
renderer.setClearColor("#121821");
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;
const trunkClip = new THREE.Plane();   // всё, что за передней стенкой багажника (задние сиденья), не рисуем
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
box.appendChild(renderer.domElement);
renderer.domElement.setAttribute("aria-label", "3D-модель машины. Тяните, чтобы покрутить");
renderer.domElement.setAttribute("role", "img");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#121821");
scene.fog = new THREE.Fog("#121821", 10, 24);   // пол растворяется вдали, без видимого края

// ---------- студийное окружение: софтбоксы над машиной и по бокам — дают «автомобильные» блики
const pmrem = new THREE.PMREMGenerator(renderer);
function studio() {
  const s = new THREE.Scene();
  s.background = new THREE.Color("#0c1016");
  const panel = (w, h, pos, k, tint = "#ffffff") => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(10, 2.2, [0, 7, 0], 5);                 // длинный софтбокс сверху — полоса по капоту и крыше
  panel(2.5, 5, [7, 2.5, 3], 2.2);              // боковые
  panel(2.5, 5, [-7, 2.5, -3], 2.2);
  panel(6, 1.2, [0, 1.5, 8], 1.4, "#cfe0ff");   // холодный контровой
  panel(6, 1.2, [0, 1.5, -8], 1.2, "#ffe7c7");  // тёплый
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: "#1a222c" }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1; s.add(floor);
  return pmrem.fromScene(s, 0.03).texture;
}
scene.environment = studio();

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
camera.layers.enable(1);   // слой эффектов (лучи, конусы): видит только основная камера, не отражение в полу
let HOME = { pos: [4.3, 1.5, -4.3], target: [0.25, 0.45, 0] };
const HOME_WIDE = { pos: [6.0, 1.95, -6.0], target: [0.25, 0.4, 0] };
camera.position.set(...HOME.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...HOME.target);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false; controls.enableZoom = true; controls.zoomSpeed = 0.8;
controls.minDistance = 2.3; controls.maxDistance = 12;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.47;
controls.rotateSpeed = 1.05;
controls.autoRotate = false;
renderer.domElement.style.touchAction = "pan-y";

const hemi = new THREE.HemisphereLight("#d6e0ee", "#0b0f14", 0.35); scene.add(hemi);
const key = new THREE.DirectionalLight("#fff3e3", 1.6); key.position.set(2.5, 8, -2);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
scene.add(key);

// пол: мягкое пятно + тень
const radial = (stops) => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
// глянцевый пол шоурума: зеркало под полупрозрачным «бетоном», к краям уходит в темноту
let mirror = null;
if (!SMALL) {
  mirror = new Reflector(new THREE.PlaneGeometry(40, 40), { clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: new THREE.Color("#7d8894") });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.001; scene.add(mirror);
}
const floorTop = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({
  map: radial([[0, "rgba(18,24,33,.74)"], [.18, "rgba(18,24,33,.86)"], [.42, "rgba(18,24,33,1)"], [1, "rgba(18,24,33,1)"]]),
  transparent: true, depthWrite: false, fog: false }));
floorTop.rotation.x = -Math.PI / 2; floorTop.position.y = 0.0005; floorTop.renderOrder = -1; scene.add(floorTop);
const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(130,160,195,.34)"], [.55, "rgba(60,80,105,.14)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.001; scene.add(pool);
const ao = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.7), new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(0,0,0,.75)"], [.6, "rgba(0,0,0,.35)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }));
ao.rotation.x = -Math.PI / 2; ao.position.set(0.24, 0.002, 0); scene.add(ao);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.45 }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.003; shadow.receiveShadow = true; scene.add(shadow);

// постобработка: мягкое свечение у фар, экрана, подсветки и лучей
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.3, 0.45, 0.93);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- машина
const car = new THREE.Group(); scene.add(car);
let model = null;
const N = {};                          // детали модели по имени
const shellMats = new Set(), glassMats = new Set();
const pivots = {};                     // двери, задняя крышка, передняя часть
const svc = {};                        // id услуги → массив мешей-узлов
let cabinLight = null, cabinLight2 = null, screenPos = null, trunkLed = null, trunkLight = null;
const struts = [];
const roofMats = new Set();
let wheels = []; const headMats = new Set();
const INTRO_DIST = 5.5, WHEEL_R = 0.38;
const intro = { on: false, t: 0, dur: 3.6, pitch: 0, pitchV: 0 };
const qSpin = new THREE.Quaternion();
// ось колеса = самый тонкий размер шины (передние колёса в модели собраны повёрнутыми, ось X им не подходит)
function wheelAxis(g, axleWorld) {
  let tire = null; g.traverse((o) => { if (!tire && o.isMesh && /Tire/i.test(o.material?.name || "")) tire = o; });
  if (!tire) g.traverse((o) => { if (!tire && o.isMesh) tire = o; });
  tire.geometry.computeBoundingBox(); const sz = tire.geometry.boundingBox.getSize(new THREE.Vector3());
  const local = sz.x <= sz.y && sz.x <= sz.z ? new THREE.Vector3(1, 0, 0) : sz.y <= sz.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  // из системы шины в систему группы колеса
  const q = new THREE.Quaternion(); for (let o = tire; o && o !== g; o = o.parent) q.premultiply(o.quaternion);
  const axis = local.applyQuaternion(q).normalize();
  const world = axis.clone().applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
  if (world.dot(axleWorld) < 0) axis.negate();          // крутим всегда «вперёд»
  return axis;
}
// в исходной модели передние колёса вывернуты (руль повёрнут) — для езды по прямой ставим их ровно
function straightenFrontWheels(axleWorld) {
  for (const n of ["WheelFrontL", "WheelFrontR"]) {
    const g = N[n]; if (!g) continue;
    const ax = wheelAxis(g, axleWorld).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
    ax.y = 0; ax.normalize();
    const target = axleWorld.clone(); target.y = 0; target.normalize();
    const qY = new THREE.Quaternion().setFromUnitVectors(ax, target);
    const newWorld = qY.multiply(g.getWorldQuaternion(new THREE.Quaternion()));
    g.quaternion.copy(g.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(newWorld));
    g.updateMatrixWorld(true);
  }
}
function rollWheels(dist) {
  const a = dist / WHEEL_R;
  for (const w of wheels) { qSpin.setFromAxisAngle(w.axis, a); for (const c of w.spin) { c.position.applyQuaternion(qSpin); c.quaternion.premultiply(qSpin); } }
}
const add = (id, mesh) => { (svc[id] ||= []).push(mesh); mesh.userData.svc = id; model.add(mesh); return mesh; };

const maxAniso = renderer.capabilities.getMaxAnisotropy();
const loader = new GLTFLoader();
loader.load(MODEL_URL, async (gltf) => {
  model = gltf.scene; car.add(model);
  model.traverse((o) => { if (o.name) N[o.name] = o; });
  await paint(gltf, 2);                // 0 — красный, 1 — перламутр, 2 — графит (как на референсе)
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    dressMaterial(o.material);
    const m = o.material; const part = partName(o);
    for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "clearcoatNormalMap"]) if (m[k]) { m[k].anisotropy = maxAniso; m[k].needsUpdate = true; }
    if (/^Paint 1/.test(m.name)) {   // серый металлик, как на референсе
      m.color.set("#8d949b"); m.metalness = 0.7; m.roughness = 0.3; m.envMapIntensity = 1.45;
      m.clearcoat = 1; m.clearcoatRoughness = 0.04;
    }
    if (m.name === "Glass") { glassMats.add(m); m.userData.op = m.opacity; o.castShadow = false; }
    if (/^Body/.test(part) && (/^Paint|Mechanical|Mirror/.test(m.name) || m.name === "")) shellMats.add(m);
  });
  model.traverse((o) => { if (/^License/i.test(o.name)) o.visible = false; });   // на номере надпись-товарный знак Khronos — не показываем
  makePivots();
  // задние сиденья 2+2 оказались бы внутри багажника — отрезаем их по передней стенке отсека
  model.traverse((o) => {
    if (!o.isMesh || !/^(InteriorSeats|InteriorPillar)/.test(partName(o))) return;
    o.material = o.material.clone(); o.material.clippingPlanes = [trunkClip]; o.material.clipShadows = true;
  });
  // свои материалы у крыши и стёкол — чтобы показать салон сверху, не трогая остальной кузов
  model.traverse((o) => {
    if (!o.isMesh || !SEE_THROUGH.test(partName(o))) return;
    o.material = o.material.clone(); o.material.userData.op = o.material.opacity; roofMats.add(o.material); glassMats.delete(o.material);
  });
  buildServices();
  car.rotation.y = Math.PI / 2;        // носом в +X
  car.updateMatrixWorld(true);
  const axleWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion())).normalize();
  straightenFrontWheels(axleWorld);
  wheels = ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"].map((n) => N[n]).filter(Boolean).map((g) => ({
    axis: wheelAxis(g, axleWorld),                                                                              // ось из геометрии шины
    spin: g.children.filter((c) => !/BrakePad/i.test(c.name)),                                                  // суппорт стоит на месте
  }));
  model.traverse((o) => { if (o.isMesh && o.material?.name === "Headlight") { headMats.add(o.material); o.material.emissiveIntensity = (o.material.emissiveIntensity ?? 1) * 0.55; o.material.userData.e = o.material.emissiveIntensity; } });
  if (!reduce) { intro.on = true; intro.t = 0; car.position.x = -INTRO_DIST; controls.autoRotate = false; camera.position.set(3.4, 1.0, -5.2); camGoal = { pos: new THREE.Vector3(...HOME.pos), target: new THREE.Vector3(...HOME.target), slow: true }; }
  loading.remove();
  window.dispatchEvent(new Event("car:ready"));
  if (reduce) markArrived();
  resize(); start();
}, (p) => { if (p.total) loading.textContent = `Загружаем машину… ${Math.round(p.loaded / p.total * 100)}%`; }, (e) => fallback(e));

// ---------- процедурные текстуры: карбон, перфорированная кожа, металлическая искра
function canvasTex(size, draw, repeat, srgb = false) {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const carbon = (rep) => canvasTex(128, (g, n) => {   // саржевое плетение 2×2: волокна то вдоль, то поперёк
  const k = n / 8;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const along = ((i + j) >> 1) % 2 === 0;
    const gr = along ? g.createLinearGradient(i * k, 0, i * k + k, 0) : g.createLinearGradient(0, j * k, 0, j * k + k);
    gr.addColorStop(0, "#2a2a2a"); gr.addColorStop(0.5, "#9c9c9c"); gr.addColorStop(1, "#2a2a2a");
    g.fillStyle = gr; g.fillRect(i * k, j * k, k, k);
  }
}, rep, true);
const perforation = (rep) => canvasTex(128, (g, n) => {  // кожа: шершавая база и ряды дырочек
  g.fillStyle = "#8c8c8c"; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},.06)`; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
  g.fillStyle = "#ffffff"; for (let y = 8; y < n; y += 16) for (let x = (y / 16) % 2 ? 16 : 8; x < n; x += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
}, rep);
const flakes = (rep) => canvasTex(256, (g, n) => {      // нормали «искры» в краске
  const d = g.createImageData(n, n);
  for (let i = 0; i < d.data.length; i += 4) { d.data[i] = 128 + (Math.random() - .5) * 120; d.data[i + 1] = 128 + (Math.random() - .5) * 120; d.data[i + 2] = 255; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
}, rep);
// карта нормалей из карты высот (рельеф для света и бликов)
function normalTex(size, drawHeight, repeat, strength = 2.5) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
  drawHeight(g, size); const h = g.getImageData(0, 0, size, size).data;
  const out = g.createImageData(size, size), H = (x, y) => h[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = maxAniso; return t;
}
// стёганая кожа: подушки-ромбы, утопленные швы, строчка и перфорация в центре ромба
const quiltHeight = (g, n) => {
  g.fillStyle = "#000"; g.fillRect(0, 0, n, n);
  const cell = n / 4;
  for (let i = -1; i <= 4; i++) for (let j = -1; j <= 4; j++) {
    const cx = i * cell + (j % 2 ? cell / 2 : 0), cy = j * cell / 2;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, cell * 0.62);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.75, "#9a9a9a"); gr.addColorStop(1, "#000");
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy - cell / 2); g.lineTo(cx + cell / 2, cy); g.lineTo(cx, cy + cell / 2); g.lineTo(cx - cell / 2, cy); g.closePath(); g.fill();
    g.fillStyle = "#555"; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { g.beginPath(); g.arc(cx - 9 + a * 6, cy - 9 + b * 6, 1.2, 0, 7); g.fill(); }
  }
  g.strokeStyle = "#cfcfcf"; g.lineWidth = 1.2; g.setLineDash([4, 4]);   // строчка вдоль швов
  for (let k = -n; k < 2 * n; k += cell / 2) { g.beginPath(); g.moveTo(k + 3, 0); g.lineTo(k + n + 3, n); g.stroke(); g.beginPath(); g.moveTo(k - 3, n); g.lineTo(k + n - 3, 0); g.stroke(); }
  g.setLineDash([]);
};
// карбон с рельефом: волокна чуть выпуклые, переплетение утоплено
const carbonHeight = (g, n) => {
  const k = n / 8;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const along = ((i + j) >> 1) % 2 === 0;
    const gr = along ? g.createLinearGradient(0, j * k, 0, j * k + k) : g.createLinearGradient(i * k, 0, i * k + k, 0);
    gr.addColorStop(0, "#222"); gr.addColorStop(0.5, "#eee"); gr.addColorStop(1, "#222");
    g.fillStyle = gr; g.fillRect(i * k, j * k, k, k);
  }
};
const TEX = {};
// мягкий шум (зерно кожи, шагрень лака, ворс) — масштабированный случайный холст
function softNoise(g, n, cells, alpha = 1) {
  const c = document.createElement("canvas"); c.width = c.height = cells; const x = c.getContext("2d"); const d = x.createImageData(cells, cells);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); g.globalAlpha = alpha; g.imageSmoothingEnabled = true;
  for (const ox of [-n, 0]) for (const oy of [-n, 0]) g.drawImage(c, ox + n, oy + n, n, n);   // без шва при повторе
  g.drawImage(c, 0, 0, n, n); g.globalAlpha = 1;
}
const leatherHeight = (g, n) => {            // стёжка ромбом + натуральное зерно кожи
  g.fillStyle = "#8c8c8c"; g.fillRect(0, 0, n, n);
  softNoise(g, n, 96, 0.35); softNoise(g, n, 256, 0.25);
  const cell = n / 2;
  g.lineCap = "round";
  for (const sgn of [1, -1]) for (let k = -n; k <= 2 * n; k += cell) {
    const line = (off, w, col, dash) => { g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(k + off, sgn > 0 ? 0 : n); g.lineTo(k + off + n, sgn > 0 ? n : 0); g.stroke(); };
    line(0, 7, "#2a2a2a", []);              // утопленный шов
    line(-9, 2, "#d8d8d8", [6, 5]);          // строчка по обе стороны
    line(9, 2, "#d8d8d8", [6, 5]);
  }
  g.setLineDash([]);
};
const grainRough = (g, n) => { g.fillStyle = "#909090"; g.fillRect(0, 0, n, n); softNoise(g, n, 128, 0.3); };
const brushed = (g, n) => {                  // шлифованный металл: тонкие продольные риски
  g.fillStyle = "#5a5a5a"; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 900; i++) { const v = 60 + Math.random() * 120; g.fillStyle = `rgb(${v},${v},${v})`; g.globalAlpha = 0.35; g.fillRect(0, Math.random() * n, n, Math.random() * 1.6); }
  g.globalAlpha = 1;
};
const peelHeight = (g, n) => { g.fillStyle = "#808080"; g.fillRect(0, 0, n, n); softNoise(g, n, 48, 0.6); };   // «шагрень» лака
const fiberHeight = (g, n) => { g.fillStyle = "#808080"; g.fillRect(0, 0, n, n); softNoise(g, n, 256, 0.9); softNoise(g, n, 512, 0.6); }; // ворс
const roughTex = (size, draw, rep) => canvasTex(size, draw, rep);
function dressMaterial(m) {
  if (m.userData.dressed) return; m.userData.dressed = true;
  const n = m.name || "";
  // --- кузов
  if (/^Paint 1/.test(n)) {
    m.normalMap = (TEX.flake ||= flakes(40)); m.normalScale = new THREE.Vector2(0.06, 0.06);
    if ("clearcoatNormalMap" in m) { m.clearcoatNormalMap = (TEX.peel ||= normalTex(256, peelHeight, 6, 1.2)); m.clearcoatNormalScale = new THREE.Vector2(0.12, 0.12); }
  }
  if (/^Paint 2/.test(n)) {
    m.color.set("#121417"); m.metalness = 0.2; m.roughness = 0.22; m.clearcoat = 1; m.clearcoatRoughness = 0.03; m.envMapIntensity = 1.3;
    if ("clearcoatNormalMap" in m) { m.clearcoatNormalMap = (TEX.peel ||= normalTex(256, peelHeight, 6, 1.2)); m.clearcoatNormalScale = new THREE.Vector2(0.12, 0.12); }
  }
  if (n === "Mirror") { m.metalness = 1; m.roughness = 0.02; m.envMapIntensity = 2; }
  if (n === "Glass") {   // тонированное стекло: в основном отражает небо и софтбоксы, салон виден еле-еле
    m.roughness = 0; m.metalness = 0; m.envMapIntensity = 2.2; if (m.color) m.color.set("#1a2026");
    if ("transmission" in m) { m.transmission = 0.22; m.thickness = 0.01; m.ior = 1.5; }
    if ("clearcoat" in m) { m.clearcoat = 1; m.clearcoatRoughness = 0; }
  }
  // --- колёса
  if (n === "Tiretread" || n === "Tireside") { m.color.set(n === "Tiretread" ? "#111214" : "#16171a"); m.roughness = 0.88; m.metalness = 0; if (m.normalScale) m.normalScale.set(1.6, 1.6); m.envMapIntensity = 0.6; }
  if (n === "Rim1") { m.color.set("#0b0c0e"); m.metalness = 0.6; m.roughness = 0.18; if ("clearcoat" in m) { m.clearcoat = 1; m.clearcoatRoughness = 0.04; } }
  if (n === "Rim2") { m.color.set("#d9dde1"); m.metalness = 1; m.roughness = 0.2; m.roughnessMap = (TEX.brushed ||= roughTex(256, brushed, 3)); m.envMapIntensity = 1.6; }
  if (n === "Brake") { m.color.set("#F5A623"); m.metalness = 0.1; m.roughness = 0.25; if ("clearcoat" in m) { m.clearcoat = 1; m.clearcoatRoughness = 0.06; } }   // суппорты — цвет DopAvto
  if (n === "Disc") { m.color.set("#8d9298"); m.metalness = 1; m.roughness = 0.38; m.roughnessMap = (TEX.brushed ||= roughTex(256, brushed, 3)); }
  if (n === "Hardware") { m.color.set("#b9bec4"); m.metalness = 1; m.roughness = 0.25; m.roughnessMap = (TEX.brushed ||= roughTex(256, brushed, 3)); }
  // --- салон
  if (/^Interior 3/.test(n)) {   // сиденья и вставки — коньячная кожа: стёжка ромбом и зерно
    m.color.set("#8f5530"); m.roughness = 0.6; m.metalness = 0;
    m.normalMap = (TEX.leather ||= normalTex(512, leatherHeight, 9, 3.5)); m.normalScale = new THREE.Vector2(1.2, 1.2);
    m.roughnessMap = (TEX.grain ||= roughTex(256, grainRough, 9));
    if ("sheen" in m) { m.sheen = 0.4; m.sheenRoughness = 0.55; m.sheenColor = new THREE.Color("#e0ad86"); }
  }
  if (/^(Interior 1|Interior 2)$/.test(n)) {  // торпедо и консоль — карбон под лаком
    m.map = (TEX.carbonIn ||= carbon(22)); m.color.set("#353a41"); m.roughness = 0.32; m.metalness = 0.25;
    m.normalMap = (TEX.carbonN ||= normalTex(128, carbonHeight, 22, 2.2)); m.normalScale = new THREE.Vector2(0.35, 0.35);
    if ("clearcoat" in m) { m.clearcoat = 0.8; m.clearcoatRoughness = 0.12; }
  }
  if (n === "Panel Sides") {   // боковины — замша
    m.color.set("#202227"); m.roughness = 0.97; m.metalness = 0;
    m.normalMap = (TEX.fiber ||= normalTex(256, fiberHeight, 10, 1.5)); m.normalScale = new THREE.Vector2(0.5, 0.5);
  }
  if (n === "Floormat") {      // ворсистые коврики
    m.color.set("#18191c"); m.roughness = 1; m.metalness = 0;
    m.normalMap = (TEX.carpet ||= normalTex(256, fiberHeight, 14, 3)); m.normalScale = new THREE.Vector2(1, 1);
  }
  // --- фары и фонари: глянцевое стекло, насыщенный цвет светодиодов
  if (n === "Brakelight") { m.color.set("#2a0003"); m.emissive.set("#ff0a12"); m.emissiveIntensity = 4.2; m.roughness = 0.08; m.metalness = 0; }
  if (n === "Signallight") { m.color.set("#1a0d00"); m.emissive.set("#ff8a00"); m.emissiveIntensity = 2.6; m.roughness = 0.08; }
  if (n === "Headlight") { m.color.set("#0a0c10"); m.emissive.set("#dfeeff"); m.emissiveIntensity = 7; m.roughness = 0.06; }
  m.needsUpdate = true;
}
function partName(o) { let n = o; while (n && n !== model) { if (n.name && !/^Mesh|^node/.test(n.name)) return n.name; n = n.parent; } return ""; }

// варианты окраски из KHR_materials_variants
async function paint(gltf, variant) {
  const parser = gltf.parser, jobs = [];
  gltf.scene.traverse((o) => {
    const ext = o.isMesh && o.userData.gltfExtensions?.KHR_materials_variants; if (!ext) return;
    const map = ext.mappings.find((m) => m.variants.includes(variant)); if (!map) return;
    jobs.push(parser.getDependency("material", map.material).then((mat) => { o.material = mat; parser.assignFinalMaterial(o); }));
  });
  await Promise.all(jobs);
}

// петли: двери, задняя стеклянная крышка, передняя часть
function makePivots() {
  const hinge = (name, parts, pos) => {
    const g = new THREE.Group(); g.position.set(...pos); model.add(g); g.updateMatrixWorld();
    parts.forEach((p) => N[p] && g.attach(N[p])); pivots[name] = g; return g;
  };
  hinge("hatch", ["BodyRearwindow", "InteriorRearHatch"], [0, 1.14, -0.43]);
  if (N.BodyDoorLColor1) pivots.doorL = N.BodyDoorLColor1;
  if (N.BodyDoorRColor1) pivots.doorR = N.BodyDoorRColor1;
  if (N.BodyHood) pivots.front = N.BodyHood;
  for (const k in pivots) pivots[k].userData.rest = { pos: pivots[k].position.clone(), rot: pivots[k].rotation.clone(), q: pivots[k].quaternion.clone() };
  // двери «ламбо»: подъём вокруг поперечной оси машины (X модели) у передней петли + лёгкий наклон наружу
  for (const [k, side] of [["doorL", 1], ["doorR", -1]]) {
    const d = pivots[k]; if (!d) continue;
    const toParent = d.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    d.userData.axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(toParent).normalize();
    d.userData.axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(toParent).normalize();
    d.userData.side = side;
  }
}

// ---------- узлы услуг (создаются в коде и садятся на поверхность модели лучом)
const ray = new THREE.Raycaster();
const SEE_THROUGH = /Glass|Windshield|Window|Rearwindow|Cage|RoofPanel|Gasket|Wiper/i;
function surface(from, dir, skipGlass = false, only = null) {
  ray.set(new THREE.Vector3(...from), new THREE.Vector3(...dir).normalize());
  const hit = ray.intersectObject(model, true).find((h) => h.object.visible && !h.object.userData.svc
    && !(skipGlass && (SEE_THROUGH.test(partName(h.object)) || h.object.material?.name === "Glass"))
    && (!only || only.test(partName(h.object))));
  return hit ? hit : null;
}
const std = (col, extra = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2, ...extra });
function onSurface(id, geo, mat, from, dir, depth = 0.01, axis = new THREE.Vector3(0, 1, 0)) {
  const h = surface(from, dir); if (!h || !h.face) return null;
  const nrm = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
  if (nrm.dot(new THREE.Vector3(...dir)) > 0) nrm.negate();          // нормаль наружу, к нам
  const m = add(id, new THREE.Mesh(geo, mat));
  m.quaternion.setFromUnitVectors(axis, nrm);                        // ось детали — по нормали кузова
  m.position.copy(h.point).addScaledVector(nrm, -depth / 2 + 0.0012); // утоплена, снаружи ~1 мм
  return m;
}
function buildServices() {
  model.updateMatrixWorld(true);
  // магнитола: экран над центральной консолью, смотрит на водителя
  const ui = screenTexture();
  // руль в этой модели по центру, поэтому экран — на торпедо справа от приборов, развёрнут к водителю
  // экран — второй «заводской» дисплей сразу справа от приборной панели: тот же наклон и высота,
  // в глянцевой рамке, утопленной в торпедо
  const eye = new THREE.Vector3(0, 0.9, 0.45);
  const clusterBox = N.InteriorSteeringDash ? new THREE.Box3().setFromObject(N.InteriorSteeringDash) : null;
  const cc = clusterBox ? clusterBox.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0.74, 1.39);
  const ch = surface(eye.toArray(), cc.clone().sub(eye).normalize().toArray(), true, /SteeringDash/i);
  let nrm = ch?.face ? ch.face.normal.clone().transformDirection(ch.object.matrixWorld) : new THREE.Vector3(0, 0.55, -0.83);
  if (nrm.dot(eye.clone().sub(cc)) < 0) nrm.negate(); nrm.normalize();
  const W = 0.22, Hs = 0.13;
  const left = clusterBox ? clusterBox.min.x : -0.21;
  const target = new THREE.Vector3(left - 0.02 - W / 2, cc.y + 0.015, cc.z);
  const th = surface(eye.toArray(), target.clone().sub(eye).normalize().toArray(), true, /Dash/i);
  const base = th ? th.point.clone() : target.clone();                    // точка крепления на торпедо
  // планшет «парит» перед торпедо на ножке и чуть развёрнут к водителю (руль по центру)
  const holder = new THREE.Group(); holder.position.copy(base).addScaledVector(nrm, 0.04);
  holder.lookAt(holder.position.clone().add(nrm)); holder.rotateY(0.12); model.add(holder);
  // подбор места: между экраном и водителем не должно быть ни стекла, ни торпедо.
  // Если перекрывает верх (стекло/уплотнитель) — опускаем; если низ или бок (торпедо) — выдвигаем на ножке.
  const ray2 = new THREE.Raycaster(); ray2.far = 0.35;
  const blockedCorners = () => {
    holder.updateMatrixWorld(true);
    const toViewer = new THREE.Vector3(0, 0, 1).transformDirection(holder.matrixWorld);
    const res = { top: false, low: false };
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const c = holder.localToWorld(new THREE.Vector3(cx * (W / 2 + 0.008), cy * (Hs / 2 + 0.008), 0.004));
      ray2.set(c, toViewer);
      const hit = ray2.intersectObject(model, true).find((h) => h.object.visible && !h.object.userData.svc && !/Seat/i.test(partName(h.object)));
      if (hit) { if (cy > 0 || /Windshield|Gasket|Wiper/i.test(partName(hit.object))) res.top = true; else res.low = true; }
    }
    return res;
  };
  const down = new THREE.Vector3(0, -1, 0);
  for (let k = 0; k < 40; k++) {
    const b = blockedCorners(); if (!b.top && !b.low) break;
    if (b.top) holder.position.addScaledVector(down, 0.008); else holder.position.addScaledVector(nrm, 0.008);
  }
  base.copy(surface(holder.position.toArray(), nrm.clone().negate().toArray(), true, /Dash|Interior/i)?.point || base);   // ножка — до торпедо за экраном
  const tabletMat = new THREE.MeshPhysicalMaterial({ color: "#0a0b0d", roughness: 0.2, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.04 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(W + 0.014, Hs + 0.014, 0.01, 4, 0.006), tabletMat); holder.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, Hs), new THREE.MeshPhysicalMaterial({ color: "#020304", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0 }));
  scr.position.z = 0.0052; holder.add(scr);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.004, Hs - 0.004), new THREE.MeshBasicMaterial({ map: ui, transparent: true, opacity: 0, toneMapped: false }));
  face.position.z = 0.0056; holder.add(face);
  // держатель: шарнир за планшетом, тонкая ножка и круглое основание на торпедо
  holder.updateMatrixWorld(true);
  const joint = holder.localToWorld(new THREE.Vector3(0, -0.01, -0.012));
  const stemLen = Math.max(0.02, joint.distanceTo(base));
  const stemDir = base.clone().sub(joint).normalize();
  const metal = new THREE.MeshStandardMaterial({ color: "#1b1d21", roughness: 0.3, metalness: 0.8 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, stemLen, 20), metal);
  stem.position.copy(joint).addScaledVector(stemDir, stemLen / 2); stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stemDir); model.add(stem);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.015, 20, 14), metal); ball.position.copy(joint); model.add(ball);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.008, 32), metal);
  foot.position.copy(base).addScaledVector(nrm, 0.002); foot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm); model.add(foot);
  for (const m of [body, scr, stem, ball, foot]) { m.userData.svc = "android"; m.userData.noGlow = true; }
  scr.userData.face = face;
  (svc.android ||= []).unshift(scr, body, stem, ball, foot);
  screenPos = scr.position.clone();
  // динамики: в дверях и в задних боковинах
  const spk = () => new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 40), std("#2c3137", { roughness: 0.7 }));
  const putSpeaker = (from, dir, door) => {
    const h = surface(from, dir, true, /Door|InteriorMid|RearPanels|Pillar/i); if (!h) return;
    const m = spk(); m.rotation.z = Math.PI / 2;
    m.position.copy(h.point).addScaledVector(new THREE.Vector3(...dir), -0.012); model.add(m);
    door?.attach(m); m.userData.svc = "sound"; (svc.sound ||= []).push(m);
  };
  putSpeaker([0, 0.38, 0.45], [1, 0, 0], pivots.doorL);  putSpeaker([0, 0.38, 0.45], [-1, 0, 0], pivots.doorR);
  putSpeaker([0, 0.5, -0.95], [1, 0, 0], null);           putSpeaker([0, 0.5, -0.95], [-1, 0, 0], null);
  const sub = add("sound", new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.3), std("#1f2328", { roughness: 0.8 })));
  sub.position.set(0.2, 0.42 + 0.17, -1.38);
  const cone = add("sound", new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 40), std("#3a4048")));
  cone.rotation.x = Math.PI / 2; cone.position.set(0.2, 0.42 + 0.17, -1.22); cone.userData.pulse = true;
  const amp = add("sound", new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.24), std("#30363d", { metalness: 0.6 })));
  amp.position.set(-0.4, 0.42 + 0.04, -1.38);
  // камеры
  const camGeo = () => new THREE.CylinderGeometry(0.014, 0.016, 0.02, 24);
  const camMat = () => std("#121518", { roughness: 0.25 });
  const rc = onSurface("rearcam", camGeo(), camMat(), [0, 0.44, -4], [0, 0, 1], 0.02); rc && (rc.name = "cam_rear");
  const front = onSurface("cam360", camGeo(), camMat(), [0, 0.4, 5], [0, 0, -1], 0.02); front && (front.name = "cam_front");
  const rear = svc.rearcam?.[0]; if (rear) (svc.cam360 ||= []).push(rear);
  [[1.05, 1], [-1.05, -1]].forEach(([x, s]) => {
    const p = surface([x, 0.2, 0.42], [0, 1, 0])?.point; if (!p) return;
    const m = add("cam360", new THREE.Mesh(camGeo(), camMat())); m.position.copy(p).add(new THREE.Vector3(0, -0.003, 0)); m.rotation.x = Math.PI; m.name = s > 0 ? "cam_mirror_L" : "cam_mirror_R";
    (s > 0 ? pivots.doorL : pivots.doorR)?.attach(m);
  });
  // парктроники: по четыре в задний и передний бампер
  const sGeo = () => new THREE.CylinderGeometry(0.017, 0.017, 0.008, 24), sMat = () => std("#8d949b", { roughness: 0.3, metalness: 0.6 });   // датчики в цвет кузова
  [-0.68, -0.25, 0.25, 0.68].forEach((x) => {
    onSurface("park", sGeo(), sMat(), [x, 0.42, -4], [0, 0, 1], 0.008);
    onSurface("park", sGeo(), sMat(), [x * 0.85, 0.36, 5], [0, 0, -1], 0.008);
  });
  // противотуманки
  [0.62, -0.62].forEach((x) => {
    const m = onSurface("fog", new THREE.CylinderGeometry(0.036, 0.036, 0.012, 40), std("#1d2126", { roughness: 0.05, metalness: 0.5 }), [x, 0.36, 5], [0, 0, -1], 0.012);
    if (m) pivots.front?.attach(m);
  });
  // видеорегистратор у верхнего края лобового и провод, спрятанный в обшивку
  const dc = add("dashcam", new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.05), std("#121518", { roughness: 0.3 })));
  dc.position.set(0.05, 1.06, 0.2);
  const path = new THREE.CatmullRomCurve3([[0.05, 1.07, 0.18], [-0.5, 1.09, 0.12], [-0.78, 1.04, 0.3], [-0.86, 0.86, 0.95], [-0.8, 0.6, 1.25], [-0.6, 0.45, 1.35]].map((p) => new THREE.Vector3(...p)));
  const wire = add("dashcam", new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.007, 8), std("#2a2f35")));
  wire.visible = false; wire.name = "wire";
  // контурная подсветка: двери и панель
  const strip = (points, parent) => {
    if (points.length < 3) return;
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 6, 0.006, 8), std("#30363d"));
    model.add(m); parent?.attach(m); m.userData.svc = "ambient"; (svc.ambient ||= []).push(m);
  };
  for (const [s, door] of [[1, pivots.doorL], [-1, pivots.doorR]]) {
    const pts = [];
    for (let z = -0.45; z <= 0.75; z += 0.1) { const h = surface([0, 0.66, z], [s, 0, 0], true, /Door/i); if (h && Math.abs(h.point.x) > 0.6) pts.push(h.point.clone().add(new THREE.Vector3(-s * 0.012, 0, 0))); }
    strip(pts, door);
  }
  const dpts = [];
  for (let x = -0.85; x <= 0.85; x += 0.1) { if (Math.abs(x) < 0.25) continue; const h = surface([x, 0.66, 0.6], [0, 0, 1], true, /Dash/i); if (h) dpts.push(h.point.clone().add(new THREE.Vector3(0, 0, -0.012))); }
  strip(dpts.filter((p) => p.x > 0), null); strip(dpts.filter((p) => p.x < 0), null);
  // свет в салоне: заливает пол и двери цветом подсветки
  cabinLight = new THREE.PointLight("#ff4fd8", 0, 2.6, 1.6); cabinLight.position.set(0, 0.55, 0.2); model.add(cabinLight);
  cabinLight2 = new THREE.PointLight("#4fc3ff", 0, 2.2, 1.6); cabinLight2.position.set(0, 0.5, -0.6); model.add(cabinLight2);
  // ---------- задние фонари перенесены в задний бампер: красная светодиодная полоса в тёмной окантовке,
  // янтарные поворотники по краям; штатные верхние фонари погашены
  model.traverse((o) => { if (o.isMesh && /^(Brakelight|Signallight)$/.test(o.material?.name || "")) o.visible = false; });
  const LY = 0.6, rearPts = (x0, x1, y, step = 0.03) => {
    const pts = [];
    for (let x = x0; x <= x1 + 1e-6; x += step) { const h = surface([x, y, -4], [0, 0, 1], false, /Rear|Panels/i); if (h) pts.push(h.point.clone()); }
    return pts;
  };
  const tube = (pts, r, mat, out) => {
    if (pts.length < 3) return null;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(new THREE.Vector3(0, 0, -out))));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 5, r, 10), mat); model.add(m); return m;
  };
  const housingMat = new THREE.MeshPhysicalMaterial({ color: "#07080a", roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 });
  const redMat = new THREE.MeshStandardMaterial({ color: "#2a0003", emissive: new THREE.Color("#ff0a12"), emissiveIntensity: 4.2, roughness: 0.08 });
  const amberMat = new THREE.MeshStandardMaterial({ color: "#1a0d00", emissive: new THREE.Color("#ff8a00"), emissiveIntensity: 2.6, roughness: 0.08 });
  tube(rearPts(-0.8, 0.8, LY), 0.017, housingMat, 0.004);                       // тёмная окантовка
  tube(rearPts(-0.64, 0.64, LY), 0.0065, redMat, 0.016);                        // красная полоса через весь бампер
  for (const sx of [1, -1]) {
    tube(rearPts(sx > 0 ? 0.52 : -0.78, sx > 0 ? 0.78 : -0.52, LY + 0.022, 0.02), 0.0055, redMat, 0.014);   // верхняя грань фонаря
    tube(rearPts(sx > 0 ? 0.68 : -0.79, sx > 0 ? 0.79 : -0.68, LY - 0.02, 0.015), 0.006, amberMat, 0.015); // поворотник
  }
  // ---------- багажник: отсек под задней крышкой, подсветка и два электропривода
  const FLOOR = 0.42, TOP = 0.97, X = 0.7, Z0 = -0.7, Z1 = -1.66;
  const carpetMat = new THREE.MeshStandardMaterial({ color: "#1c1d21", roughness: 1, metalness: 0,
    normalMap: (TEX.carpet ||= normalTex(256, fiberHeight, 14, 3)), normalScale: new THREE.Vector2(1, 1) });
  const tub = new THREE.Group(); tub.name = "trunkTub"; model.add(tub);
  const panel = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), carpetMat); m.position.set(x, y, z); m.receiveShadow = true; tub.add(m); return m; };
  panel(2 * X, 0.02, Z0 - Z1, 0, FLOOR, (Z0 + Z1) / 2);                       // пол
  panel(2 * X, TOP - FLOOR, 0.02, 0, (FLOOR + TOP) / 2, Z0);                  // стенка за сиденьями
  panel(2 * X, TOP - FLOOR, 0.02, 0, (FLOOR + TOP) / 2, Z1);                  // задняя стенка
  panel(0.02, TOP - FLOOR, Z0 - Z1, X, (FLOOR + TOP) / 2, (Z0 + Z1) / 2);     // боковины
  panel(0.02, TOP - FLOOR, Z0 - Z1, -X, (FLOOR + TOP) / 2, (Z0 + Z1) / 2);
  // светодиодный контур по верху отсека
  const rim = new THREE.CatmullRomCurve3([[-X, TOP, Z0], [X, TOP, Z0], [X, TOP, Z1], [-X, TOP, Z1]].map((p) => new THREE.Vector3(...p)), true, "catmullrom", 0.01);
  trunkLed = new THREE.Mesh(new THREE.TubeGeometry(rim, 120, 0.006, 8, true), new THREE.MeshStandardMaterial({ color: "#2a2d33", emissive: new THREE.Color("#fff1d6"), emissiveIntensity: 0 }));
  tub.add(trunkLed);
  trunkLight = new THREE.PointLight("#ffe9c9", 0, 2.2, 1.5); trunkLight.position.set(0, TOP - 0.05, (Z0 + Z1) / 2); tub.add(trunkLight);
  // электроприводы: корпус на кузове, шток уходит к крышке; длина пересчитывается каждый кадр
  const strutBodyMat = new THREE.MeshPhysicalMaterial({ color: "#121316", roughness: 0.3, metalness: 0.4, clearcoat: 1 });
  const strutRodMat = new THREE.MeshStandardMaterial({ color: "#d7dbe0", roughness: 0.15, metalness: 1 });
  for (const sx of [1, -1]) {
    const a = new THREE.Vector3(sx * (X - 0.06), TOP - 0.06, Z0 - 0.06);
    const marker = new THREE.Object3D(); marker.position.set(sx * (X - 0.08), 1.04, -1.02); model.add(marker); pivots.hatch?.attach(marker);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 20), strutBodyMat);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 16), strutRodMat);
    model.add(body); model.add(rod);
    body.userData.svc = rod.userData.svc = "trunk"; (svc.trunk ||= []).push(body, rod);
    struts.push({ a, marker, body, rod });
  }
  // крышка багажника и передняя часть — сами детали модели
  svc.trunk ||= []; pivots.hatch?.traverse((o) => o.isMesh && svc.trunk.push(o));
  svc.bumper = []; N.BodyHoodUnder?.traverse((o) => o.isMesh && svc.bumper.push(o));
  // у каждого узла свой материал, чтобы подсвечивать по отдельности
  for (const id in svc) svc[id].forEach((m) => { m.material = m.material.clone(); m.material.userData.glow = 0; m.material.userData.target = 0; m.castShadow = true; });
}

function screenTexture() {
  const c = document.createElement("canvas"); c.width = 640; c.height = 360; const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 640, 360); bg.addColorStop(0, "#0d2238"); bg.addColorStop(1, "#2a1446");
  g.fillStyle = bg; g.fillRect(0, 0, 640, 360);
  const tile = (x, y, w, h, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill(); };
  tile(20, 20, 380, 220, "#1f5fa8");
  g.strokeStyle = "#9fd0ff"; g.lineWidth = 7; g.beginPath(); g.moveTo(50, 210); g.bezierCurveTo(140, 120, 230, 190, 360, 60); g.stroke();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(360, 60, 11, 0, 7); g.fill();
  tile(416, 20, 204, 104, "#e0457b"); tile(416, 136, 204, 104, "#f5a623");
  g.fillStyle = "rgba(255,255,255,.92)"; g.font = "600 38px sans-serif"; g.fillText("12:30", 440, 88); g.font = "600 30px sans-serif"; g.fillText("FM 101.2", 436, 200);
  ["#34c759", "#0a84ff", "#ff9f0a", "#bf5af2", "#ff375f", "#64d2ff", "#30d158"].forEach((col, i) => tile(20 + i * 87, 262, 72, 72, col));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- эффекты поверх
const fx = new THREE.Group(); scene.add(fx);
const fxItems = [];
function clearFx() { fxItems.length = 0; while (fx.children.length) { const c = fx.children.pop(); c.geometry?.dispose(); c.material?.dispose(); } }
const FX_LAYER = 1;
const addFx = (mesh, tick) => { mesh.layers.set(FX_LAYER); fx.add(mesh); fxItems.push({ mesh, tick }); return mesh; };
const glowMat = (color, opacity = 0.2) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const W = (o) => o.getWorldPosition(new THREE.Vector3());
// объёмный луч фары: круглый, ярче у источника, края и даль плавно растворяются
const beamMat = (color, strength) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
  vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV; varying float vY;
    void main() { vT = uv.y; vec4 wp = modelMatrix * vec4(position, 1.0); vY = wp.y;
      vec4 mv = viewMatrix * wp; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vT; varying vec3 vN; varying vec3 vV; varying float vY;
    void main() {
      float along = pow(vT, 1.8) * smoothstep(1.0, 0.94, vT);       // ярко у фары, но без резкого начала
      float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); // края луча растворяются
      float floorFade = smoothstep(0.0, 0.22, vY);                   // у пола луч плавно гаснет, без линии среза
      gl_FragColor = vec4(uColor * uStrength * along * edge * floorFade, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function lightBeam(from, dir, len, radius, color) {
  const g = new THREE.CylinderGeometry(0.025, radius, len, 64, 8, true); g.translate(0, -len / 2, 0);   // uv.y: 1 у фары → 0 вдали
  const m = new THREE.Mesh(g, beamMat(color, 0.32));
  m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  addFx(m, () => {});
  // мягкое световое пятно на полу перед фарой
  const hitDist = Math.min(len, from.y / Math.max(0.05, -dir.clone().normalize().y));
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: (TEX.pool ||= radial([[0, "rgba(255,240,205,.55)"], [.5, "rgba(255,232,190,.18)"], [1, "rgba(0,0,0,0)"]])), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const c = from.clone().addScaledVector(dir.clone().normalize(), hitDist * 0.75); c.y = 0.004;
  spot.position.copy(c); spot.rotation.x = -Math.PI / 2; spot.rotation.z = Math.atan2(dir.z, dir.x);
  spot.scale.set(hitDist * 1.2, radius * 1.3, 1); addFx(spot, () => {});
}
function viewCone(from, dir, len, spread, color = "#7fd1ff") {
  const g = new THREE.ConeGeometry(spread, len, 4, 1, true); g.translate(0, -len / 2, 0); g.rotateY(Math.PI / 4);
  const m = new THREE.Mesh(g, glowMat(color, 0.12));
  m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  return addFx(m, (t) => { m.material.opacity = 0.09 + 0.05 * Math.sin(t * 3); });
}
function waves(x, dir) {
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.735, 64, 1, -Math.PI / 2.6, Math.PI / 1.3), glowMat("#F5A623", 0.5));
    r.rotation.x = -Math.PI / 2; if (dir < 0) r.rotation.z = Math.PI; r.position.set(x, 0.04, 0);
    addFx(r, (t) => { const k = (t * 0.6 + i / 3) % 1; r.scale.setScalar(0.5 + k * 1.7); r.material.opacity = 0.55 * (1 - k); });
  }
}
function extraFx(id) {
  const byName = (n) => (svc.cam360 || []).concat(svc.rearcam || []).find((m) => m.name === n);
  const fw = new THREE.Vector3(1, 0, 0);
  if (id === "rearcam") { const c = byName("cam_rear"); c && viewCone(W(c), new THREE.Vector3(-1, -0.4, 0), 2.6, 1.5); }
  if (id === "cam360") {
    [["cam_front", [1, -0.45, 0]], ["cam_rear", [-1, -0.45, 0]], ["cam_mirror_L", [0, -0.7, -1]], ["cam_mirror_R", [0, -0.7, 1]]].forEach(([n, d]) => {
      const c = byName(n); c && viewCone(W(c), new THREE.Vector3(...d), 2.0, 1.6);
    });
    const ring = addFx(new THREE.Mesh(new THREE.RingGeometry(2.75, 2.8, 128), glowMat("#7fd1ff", 0.35)), (t) => { ring.material.opacity = 0.22 + 0.13 * Math.sin(t * 2); });
    ring.rotation.x = -Math.PI / 2; ring.position.set(0.24, 0.02, 0);
  }
  if (id === "park") { waves(-1.98, -1); waves(2.45, 1); }
  if (id === "fog") (svc.fog || []).forEach((m) => lightBeam(W(m), fw.clone().add(new THREE.Vector3(0, -0.09, 0)), 3.4, 0.75, "#fff1cf"));
  if (id === "sound") (svc.sound || []).filter((m) => m.geometry.type === "CylinderGeometry" && !m.userData.pulse).forEach((m) => {
    const p = W(m); const out = Math.sign(p.z) || 1;
    for (let i = 0; i < 2; i++) {
      const r = addFx(new THREE.Mesh(new THREE.RingGeometry(0.09, 0.105, 40), glowMat("#F5A623", 0.6)), (t) => { const k = (t * 1.1 + i / 2) % 1; r.scale.setScalar(1 + k * 3); r.material.opacity = 0.6 * (1 - k); });
      r.position.copy(p); r.position.z -= out * 0.06;
    }
  });
}

// ---------- состояние
let manualDoors = false;
let active = null, t0 = 0, touched = false, camGoal = null, dragging = false, idleAt = 0, limitsAfter = null;
const sA = new THREE.Spherical(), sB = new THREE.Spherical(), tmpV = new THREE.Vector3();
const qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion();
const vB = new THREE.Vector3(), vD = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const anim = { xray: 0, night: 0, hatch: 0, doors: 0, screen: 0, front: 0, roof: 0 };
const goal = { ...anim };
function setService(s) {
  active = s ? s.id : null; t0 = performance.now() / 1000;
  clearFx();
  for (const id in svc) svc[id].forEach((m) => (m.material.userData.target = 0));
  (svc[active] || []).forEach((m) => (m.material.userData.target = 1));
  (svc.dashcam || []).forEach((m) => { if (m.name === "wire") m.visible = active === "dashcam"; });
  Object.assign(goal, { xray: s?.xray ? 1 : 0, night: s?.night ? 1 : 0, hatch: active === "trunk" ? 1 : 0, doors: active === "ambient" || manualDoors ? 1 : 0, screen: active === "android" ? 1 : 0, roof: active === "android" || active === "ambient" ? 1 : 0 });
  idleAt = performance.now();
  const inside = s?.id === "android";
  controls.minDistance = inside ? 0.3 : 2.3;
  manualDoors = false;
  controls.rotateSpeed = inside ? 0.45 : 1.05;
  if (inside) {   // в салоне можно только оглядеться, без вылета сквозь кузов
    const v0 = new THREE.Spherical().setFromVector3(new THREE.Vector3(...s.view.pos).sub(new THREE.Vector3(...s.view.target)));
    controls.minPolarAngle = 0.2; controls.maxPolarAngle = 2.2;   // на время перелёта не ограничиваем
    limitsAfter = { minAz: v0.theta - 0.5, maxAz: v0.theta + 0.5, minPol: Math.max(0.2, v0.phi - 0.25), maxPol: Math.min(2.2, v0.phi + 0.25) };
  } else { limitsAfter = null; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.47; }
  const v = s ? s.view : HOME;
  camGoal = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
  // на широком экране машина делит кадр с текстом и панелью — снаружи смотрим чуть дальше
  if (s && s.id !== "android" && box.clientWidth > 980) camGoal.pos.sub(camGoal.target).multiplyScalar(1.12).add(camGoal.target);
  if (s) extraFx(s.id);
  if (reduce) { camera.position.copy(camGoal.pos); controls.target.copy(camGoal.target); camGoal = null; }
}
window.addEventListener("svc:select", (e) => setService(e.detail));

// колесо мыши: листает страницу, пока по машине не кликнули; после клика — приближает (до ухода курсора с машины).
// Ctrl/Cmd + колесо приближает всегда. На телефоне — щипок двумя пальцами.
let engaged = false;
renderer.domElement.addEventListener("wheel", (e) => {
  if (engaged || e.ctrlKey || e.metaKey) { camGoal = null; return; }
  e.stopImmediatePropagation();                       // OrbitControls не получит событие — страница прокрутится
}, { capture: true });
renderer.domElement.addEventListener("pointerdown", () => { engaged = true; box.classList.add("engaged"); });
renderer.domElement.addEventListener("pointerleave", () => { engaged = false; box.classList.remove("engaged"); });
function zoomBy(f) {
  const off = camera.position.clone().sub(controls.target);
  const d = THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance);
  camGoal = { pos: controls.target.clone().add(off.setLength(d)), target: controls.target.clone() };
}
const SERVICES_VIEW = (id) => (window.SERVICES || []).find((x) => x.id === id)?.view || HOME;
document.getElementById("zoomIn")?.addEventListener("click", () => zoomBy(0.78));
document.getElementById("zoomOut")?.addEventListener("click", () => zoomBy(1.28));
document.getElementById("zoomReset")?.addEventListener("click", () => {
  manualDoors = false; goal.doors = active === "ambient" ? 1 : 0;
  const v = active ? SERVICES_VIEW(active) : HOME; camGoal = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
});

// клик по узлу на машине
const ndc = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
controls.addEventListener("start", () => { if (camGoal && limitsAfter) { Object.assign(controls, { minAzimuthAngle: limitsAfter.minAz, maxAzimuthAngle: limitsAfter.maxAz, minPolarAngle: limitsAfter.minPol, maxPolarAngle: limitsAfter.maxPol }); limitsAfter = null; } camGoal = null; touched = true; dragging = true; box.classList.add("touched"); });
controls.addEventListener("end", () => { dragging = false; idleAt = performance.now(); box.closest(".stage")?.classList.remove("dragging"); });
controls.addEventListener("start", () => box.closest(".stage")?.classList.add("dragging"));
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  if (!arrived) return;
  const id = pickAt(e); if (!id) return;
  if (id === "door") { manualDoors = !manualDoors; goal.doors = manualDoors || active === "ambient" ? 1 : 0; return; }
  window.dispatchEvent(new CustomEvent("car:pick", { detail: id }));
});
renderer.domElement.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && !e.buttons && model) renderer.domElement.style.cursor = pickAt(e) ? "pointer" : ""; });
function pickAt(e) {
  if (!model) return null;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(car, true).find((x) => x.object.visible);
  if (!h) return null;
  let o = h.object; while (o && o !== car) { if (o.userData.svc) return o.userData.svc; o = o.parent; }
  for (const id of ["trunk", "bumper"]) if ((svc[id] || []).includes(h.object)) return id;
  if (/^BodyDoor/.test(partName(h.object)) && active !== "ambient") return "door";   // клик по двери — открыть/закрыть
  return null;
}

// ---------- кадр
const clock = new THREE.Clock(); let running = false, visible = true;
const ease = (cur, tgt, dt, k = 7) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
const tmpC = new THREE.Color();
function frame() {
  if (!running) return;
  requestAnimationFrame(frame);
  if (visible) draw();
}
let simT = 0, scrollTurn = 0;
function draw(fixedDt) {
  const real = clock.getDelta(); const dt = fixedDt || Math.min(real, 0.05); if (fixedDt) simT += fixedDt;
  const t = performance.now() / 1000 - t0 + simT;
  for (const k in anim) anim[k] = ease(anim[k], goal[k], dt, k === "hatch" || k === "doors" ? 2.6 : 6);
  if (intro.on) {
    intro.t += dt; const p = Math.min(intro.t / intro.dur, 1);
    const e = 1 - Math.pow(1 - p, 4);                      // накат и мягкое торможение
    const x = -INTRO_DIST * (1 - e); const dx = x - car.position.x; car.position.x = x;
    rollWheels(dx);                                        // колесо проходит ровно столько, сколько машина
    // торможение: нос чуть клюёт и кузов возвращается на пружинах
    const decel = p < 1 ? 4 * Math.pow(1 - p, 3) * INTRO_DIST / intro.dur / intro.dur : 0;
    intro.pitchV += (-intro.pitch * 60 - intro.pitchV * 9 + decel * 0.42) * dt; intro.pitch += intro.pitchV * dt;
    car.rotation.z = -intro.pitch;
    const lights = Math.max(0, Math.min(1, (p - 0.82) / 0.18));
    headMats.forEach((m) => { m.emissiveIntensity = (m.userData.e || 1) * (lights < 1 ? lights * (0.55 + 0.45 * Math.sin(intro.t * 38)) : 1); });
    if (p >= 1 && Math.abs(intro.pitch) < 0.0004 && Math.abs(intro.pitchV) < 0.002) { intro.on = false; car.rotation.z = 0; idleAt = performance.now(); markArrived(); }
  }
  // камера облетает машину по дуге, а не летит по прямой сквозь кузов
  if (camGoal) {
    const k = 1 - Math.exp(-(camGoal.slow ? 1.3 : 3.0) * dt);
    sA.setFromVector3(tmpV.subVectors(camera.position, controls.target));
    sB.setFromVector3(tmpV.subVectors(camGoal.pos, camGoal.target));
    let dTh = sB.theta - sA.theta; dTh = Math.atan2(Math.sin(dTh), Math.cos(dTh));
    sA.theta += dTh * k; sA.phi += (sB.phi - sA.phi) * k; sA.radius += (sB.radius - sA.radius) * k;
    controls.target.lerp(camGoal.target, k);
    camera.position.copy(controls.target).add(tmpV.setFromSpherical(sA));
    if (Math.abs(dTh) < 0.002 && Math.abs(sB.phi - sA.phi) < 0.002 && Math.abs(sB.radius - sA.radius) < 0.01 && controls.target.distanceTo(camGoal.target) < 0.01) {
      camGoal = null;
      if (limitsAfter) { Object.assign(controls, { minAzimuthAngle: limitsAfter.minAz, maxAzimuthAngle: limitsAfter.maxAz, minPolarAngle: limitsAfter.minPol, maxPolarAngle: limitsAfter.maxPol }); limitsAfter = null; }
    }
  }
  // без действий 6 секунд и без выбранной услуги — снова медленно вращаем
  controls.autoRotate = false;   // машина крутится только когда её тянут мышью или пальцем
  // рентген кузова
  const op = THREE.MathUtils.lerp(1, 0.1, anim.xray);
  shellMats.forEach((m) => { m.transparent = op < 0.999; m.opacity = op; m.depthWrite = op > 0.5; });
  const rf = Math.max(anim.roof, anim.xray);
  roofMats.forEach((m) => { const base = m.userData.op ?? 1; m.opacity = THREE.MathUtils.lerp(base, 0.04, rf); m.transparent = m.opacity < 0.999 || m.name === "Glass"; m.depthWrite = m.opacity > 0.5; });
  glassMats.forEach((m) => { m.opacity = THREE.MathUtils.lerp(m.userData.op ?? 1, 0.15, anim.xray); m.transparent = true; });
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.4, anim.night);
  hemi.intensity = THREE.MathUtils.lerp(0.35, 0.08, anim.night);
  key.intensity = THREE.MathUtils.lerp(1.6, 0.25, anim.night);
  // двери, крышка, передняя часть
  for (const k of ["doorL", "doorR"]) {
    const d = pivots[k]; if (!d) continue; const u = d.userData, a = anim.doors;
    const lift = 1.22 * a, tilt = -0.14 * u.side * Math.sin(a * Math.PI / 2);
    d.quaternion.copy(u.rest.q)
      .premultiply(qTmp.setFromAxisAngle(u.axisZ, tilt))   // чуть наружу
      .premultiply(qTmp2.setFromAxisAngle(u.axisX, lift)); // вверх, как у ламбо
  }
  if (pivots.hatch) pivots.hatch.rotation.x = 0.95 * anim.hatch;
  if (model) {   // плоскость среза следует за машиной (въезд, поворот)
    const nrm = vD.set(0, 0, 1).transformDirection(model.matrixWorld);
    trunkClip.setFromNormalAndCoplanarPoint(nrm, model.localToWorld(vB.set(0, 0, -0.71)));
  }
  if (struts.length) {
    model.updateMatrixWorld();
    for (const st of struts) {
      const b = model.worldToLocal(st.marker.getWorldPosition(vB)), a = st.a;
      const dir = vD.subVectors(b, a); const len = dir.length(); dir.normalize();
      const bodyLen = 0.26, rodLen = Math.max(0.02, len - bodyLen + 0.04);
      qTmp.setFromUnitVectors(UP, dir);
      st.body.quaternion.copy(qTmp); st.body.scale.set(1, bodyLen, 1); st.body.position.copy(a).addScaledVector(dir, bodyLen / 2);
      st.rod.quaternion.copy(qTmp); st.rod.scale.set(1, rodLen, 1); st.rod.position.copy(b).addScaledVector(dir, -rodLen / 2);
    }
  }
  if (trunkLed) { trunkLed.material.emissiveIntensity = 2.2 * anim.hatch; trunkLight.intensity = 3 * anim.hatch; }
  if (pivots.front) {
    const on = active === "bumper" ? Math.sin(t * 1.5 - 1.2) * 0.5 + 0.5 : 0; anim.front = ease(anim.front, on, dt, 6);
    pivots.front.position.z = pivots.front.userData.rest.pos.z + 0.38 * anim.front;
  }
  // подсветка узлов
  for (const id in svc) for (const m of svc[id]) {
    const ud = m.material.userData; ud.glow = ease(ud.glow, ud.target, dt, 8);
    if (!m.material.emissive || m.userData.noGlow) continue;
    let col = AMBER, k = ud.glow * (1.2 + 0.6 * Math.sin(t * 4));
    if (id === "ambient") { col = tmpC.setHSL((t * 0.12) % 1, 0.9, 0.55); k = ud.glow * 4; }
    if (id === "fog") { col = tmpC.set("#fff6d8"); k = ud.glow * 6; }
    if (id === "android") { col = tmpC.set("#7fb8ff"); k = ud.glow * 0.4; }
    if (id === "trunk" || id === "bumper") k = ud.glow * 0.35;
    if (m.userData.pulse || (id === "sound" && m.geometry.type === "CylinderGeometry")) m.scale.setScalar(1 + ud.glow * 0.08 * Math.max(0, Math.sin(t * 14)));
    m.material.emissive.copy(col); m.material.emissiveIntensity = k;
  }
  if (cabinLight) {
    const on = (svc.ambient?.[0]?.material.userData.glow || 0);
    cabinLight.color.setHSL((t * 0.12) % 1, 0.9, 0.55); cabinLight2.color.setHSL((t * 0.12 + 0.5) % 1, 0.9, 0.55);
    const sc = anim.screen;   // показ магнитолы: тёплый мягкий свет в салоне, чтобы его было видно сверху
    if (sc > on) { cabinLight.color.set("#fff1dd"); cabinLight2.color.set("#dfe9ff"); }
    cabinLight.intensity = Math.max(on * 6, sc * 4); cabinLight2.intensity = Math.max(on * 4, sc * 2.5);
  }
  const face = svc.android?.[0]?.userData.face; if (face) face.material.opacity = anim.screen;
  for (const id of ["android", "ambient", "sound"]) (svc[id] || []).forEach((m) => (m.visible = (m.material.userData.glow > 0.02) || active === id));
  for (const f of fxItems) f.tick(t);
  if (box.clientWidth > 980) {
    view.offYGoal = active && active !== "android" ? 0.05 : -0.06;
    const prev = view.offY; view.offY = ease(view.offY, view.offYGoal, dt, 4);
    if (Math.abs(view.offY - prev) > 1e-5) { applyOffset(); camera.updateProjectionMatrix(); }
  }
  controls.update();
  composer.render();
}
function start() { if (!running) { running = true; clock.getDelta(); frame(); } }
// сдвиг картинки на широком экране: вправо — панель, сверху — заголовок.
// Когда выбрана услуга, заголовок уходит, и машина плавно поднимается в центр.
const view = { offY: -0.06, offYGoal: -0.06 };
function applyOffset() {
  const w = box.clientWidth, h = box.clientHeight; if (w <= 980) return;
  camera.setViewOffset(w, h, Math.min(200, w * 0.12), h * view.offY, w, h);
}
function resize() {
  const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w / 2, h / 2); camera.aspect = w / h;
  if (mirror) { const pr = renderer.getPixelRatio(); mirror.getRenderTarget().setSize(Math.round(w * pr * 0.6), Math.round(h * pr * 0.6)); }
  camera.fov = w < 600 ? 38 : 30;
  // широкий экран: машина в нижней половине, левее панели
  if (w > 980) { applyOffset(); if (HOME !== HOME_WIDE) { HOME = HOME_WIDE; if (!active && !touched) camGoal = { pos: new THREE.Vector3(...HOME.pos), target: new THREE.Vector3(...HOME.target) }; } }
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(box);
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 }).observe(box);
