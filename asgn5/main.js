import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const canvas = document.querySelector('#c');
const loadingElem = document.querySelector('#loading');
const scoreElem = document.querySelector('#score');
const timerElem = document.querySelector('#timer');
const messageElem = document.querySelector('#message');
const flashMessageElem = document.querySelector('#flash-message');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  120
);
camera.position.set(0, 8, -12);

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = true;
controls.enablePan = true;
controls.target.set(0, 0.6, -6);

const loadManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadManager);
const exrLoader = new EXRLoader(loadManager);
const mtlLoader = new MTLLoader(loadManager);

loadManager.onLoad = () => {
  loadingElem.style.display = 'none';
};

exrLoader.load('kloppenheim_06_puresky_4k.exr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
});

const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(0xbfdcff, 0x3d2e1d, 0.9);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(-4, 8, -3);
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffcc88, 4, 16);
pointLight.position.set(3.5, 3, -2);
scene.add(pointLight);

class ColorGUIHelper {
  constructor(object, prop) {
    this.object = object;
    this.prop = prop;
  }

  get value() {
    return `#${this.object[this.prop].getHexString()}`;
  }

  set value(hexString) {
    this.object[this.prop].set(hexString);
  }
}

function addPositionControls(folder, object) {
  folder.add(object.position, 'x', -10, 10, 0.1);
  folder.add(object.position, 'y', -1, 12, 0.1);
  folder.add(object.position, 'z', -18, 20, 0.1);
}

const gui = new GUI({ title: 'Light Controls' });

const ambientFolder = gui.addFolder('Ambient Light');
ambientFolder.addColor(new ColorGUIHelper(ambientLight, 'color'), 'value').name('color');
ambientFolder.add(ambientLight, 'intensity', 0, 3, 0.01);

const hemisphereFolder = gui.addFolder('Hemisphere Light');
hemisphereFolder.addColor(new ColorGUIHelper(hemisphereLight, 'color'), 'value').name('sky color');
hemisphereFolder.addColor(new ColorGUIHelper(hemisphereLight, 'groundColor'), 'value').name('ground color');
hemisphereFolder.add(hemisphereLight, 'intensity', 0, 3, 0.01);

const directionalFolder = gui.addFolder('Directional Light');
directionalFolder.addColor(new ColorGUIHelper(directionalLight, 'color'), 'value').name('color');
directionalFolder.add(directionalLight, 'intensity', 0, 5, 0.01);
addPositionControls(directionalFolder, directionalLight);

const pointFolder = gui.addFolder('Point Light');
pointFolder.addColor(new ColorGUIHelper(pointLight, 'color'), 'value').name('color');
pointFolder.add(pointLight, 'intensity', 0, 8, 0.01);
pointFolder.add(pointLight, 'distance', 0, 25, 0.1);
addPositionControls(pointFolder, pointLight);

const keys = new Set();
const chickens = [];
const wheat = [];
const staticBlockers = [];
const animatedWheels = [];
const playerStart = new THREE.Vector3(0, 0, -11.5);
const finishZ = 13.9;
const gameState = {
  score: 0,
  total: 12,
  timeLeft: 90,
  isOver: false,
  lastCrashAt: -10
};

let playerCar;
let windmillModel;

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.6,
    metalness: options.metalness ?? 0.05,
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function addMesh(parent, geometry, material, position, rotation = new THREE.Euler()) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.copy(rotation);
  parent.add(mesh);
  return mesh;
}

function createLane(z, material, height = 1.75) {
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, height),
    material
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0, z);
  scene.add(lane);
}

function createWorld() {
  const grassMaterial = makeMaterial(0x6d8f45, { roughness: 0.9 });
  const roadMaterial = makeMaterial(0x2a2d31, { roughness: 0.82 });
  const fieldMaterial = makeMaterial(0xb89545, { roughness: 0.95 });
  const stripeMaterial = makeMaterial(0xf1e4ba, { roughness: 0.65 });

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 29),
    makeMaterial(0x4f6f3a, { roughness: 0.95 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.02, 1.4);
  scene.add(base);

  for (let z = -11.5; z <= 13.5; z += 1.75) {
    const isRoad = [-8, -4.5, -1, 2.5, 6, 9.5].some((roadZ) => Math.abs(z - roadZ) < 0.2);
    const isField = [-6.25, 0.75, 7.75].some((fieldZ) => Math.abs(z - fieldZ) < 0.2);
    createLane(z, isRoad ? roadMaterial : isField ? fieldMaterial : grassMaterial);

    if (isRoad) {
      for (let x = -3.6; x <= 3.6; x += 1.2) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.06), stripeMaterial);
        stripe.position.set(x, 0.025, z);
        scene.add(stripe);
      }
    }
  }
}

function createCar() {
  const car = new THREE.Group();
  car.position.copy(playerStart);
  scene.add(car);

  const bodyMaterial = makeMaterial(0xc91f1f, {
    roughness: 0.24,
    metalness: 0.78
  });
  const cabinMaterial = makeMaterial(0x8fbad1, { roughness: 0.25, metalness: 0.1 });
  const tireMaterial = makeMaterial(0x111111, { roughness: 0.8 });
  const hubMaterial = makeMaterial(0xd8d8d8, { roughness: 0.35, metalness: 0.2 });
  const headlightMaterial = makeMaterial(0xfff0a8, { emissive: 0x775000, emissiveIntensity: 0.3 });

  addMesh(car, new THREE.BoxGeometry(0.8, 0.36, 1.15), bodyMaterial, new THREE.Vector3(0, 0.42, 0));
  addMesh(car, new THREE.BoxGeometry(0.62, 0.38, 0.55), cabinMaterial, new THREE.Vector3(0, 0.72, -0.08));
  addMesh(car, new THREE.BoxGeometry(0.84, 0.1, 0.14), headlightMaterial, new THREE.Vector3(0, 0.44, 0.61));

  [
    [-0.48, 0.28, -0.38],
    [0.48, 0.28, -0.38],
    [-0.48, 0.28, 0.38],
    [0.48, 0.28, 0.38]
  ].forEach(([x, y, z]) => {
    const wheel = addMesh(
      car,
      new THREE.TorusGeometry(0.16, 0.045, 12, 24),
      tireMaterial,
      new THREE.Vector3(x, y, z),
      new THREE.Euler(0, Math.PI / 2, 0)
    );
    addMesh(
      car,
      new THREE.CylinderGeometry(0.075, 0.075, 0.04, 18),
      hubMaterial,
      new THREE.Vector3(x, y, z),
      new THREE.Euler(0, Math.PI / 2, 0)
    );
    animatedWheels.push(wheel);
  });

  playerCar = car;
}

function addChickenParts(parent, scale, offsetZ = 0) {
  const bodyMaterial = makeMaterial(scale < 1 ? 0xffd84f : 0xf4f0de, { roughness: 0.7 });
  const wingMaterial = makeMaterial(scale < 1 ? 0xffec87 : 0xf6ead7, { roughness: 0.8 });
  const beakMaterial = makeMaterial(0xe89b31, { roughness: 0.5 });
  const combMaterial = makeMaterial(0xd64035, { roughness: 0.55 });
  const legMaterial = makeMaterial(0xd8903f, { roughness: 0.5 });
  const group = new THREE.Group();
  group.position.z = offsetZ;
  group.scale.setScalar(scale);
  parent.add(group);

  addMesh(group, new THREE.BoxGeometry(0.48, 0.42, 0.56), bodyMaterial, new THREE.Vector3(0, 0.48, 0));
  addMesh(group, new THREE.BoxGeometry(0.34, 0.32, 0.34), bodyMaterial, new THREE.Vector3(0, 0.82, 0.18));
  addMesh(group, new THREE.BoxGeometry(0.12, 0.12, 0.2), beakMaterial, new THREE.Vector3(0, 0.82, 0.48));
  addMesh(group, new THREE.BoxGeometry(0.16, 0.12, 0.08), combMaterial, new THREE.Vector3(0, 1.03, 0.18));
  addMesh(group, new THREE.BoxGeometry(0.08, 0.22, 0.08), legMaterial, new THREE.Vector3(-0.12, 0.18, 0.02));
  addMesh(group, new THREE.BoxGeometry(0.08, 0.22, 0.08), legMaterial, new THREE.Vector3(0.12, 0.18, 0.02));
  addMesh(group, new THREE.BoxGeometry(0.1, 0.26, 0.38), wingMaterial, new THREE.Vector3(-0.3, 0.48, 0), new THREE.Euler(0, 0, 0.18));
  addMesh(group, new THREE.BoxGeometry(0.1, 0.26, 0.38), wingMaterial, new THREE.Vector3(0.3, 0.48, 0), new THREE.Euler(0, 0, -0.18));
}

function createChicken(laneZ, startX, direction, speed, hasChicks = false) {
  const chicken = new THREE.Group();
  chicken.position.set(startX, 0, laneZ);
  chicken.userData.direction = direction;
  chicken.userData.speed = speed;
  chicken.userData.minX = -5.4;
  chicken.userData.maxX = 5.4;
  chicken.userData.radius = hasChicks ? 1.0 : 0.72;
  scene.add(chicken);

  addChickenParts(chicken, 1);

  if (hasChicks) {
    addChickenParts(chicken, 0.55, -0.62);
    addChickenParts(chicken, 0.5, -1.05);
  }

  chickens.push(chicken);
}

function createChickens() {
  const lanes = [
    [-8, -4.7, 1, 2.0],
    [-8, 1.4, 1, 2.0],
    [-4.5, 4.8, -1, 2.4],
    [-4.5, -1.4, -1, 2.4],
    [-1, -5.1, 1, 2.7],
    [-1, 0.6, 1, 2.7],
    [2.5, 5, -1, 2.2],
    [2.5, -0.8, -1, 2.2],
    [6, -4.8, 1, 2.9],
    [6, 1.8, 1, 2.9],
    [9.5, 5.1, -1, 2.5],
    [9.5, -1.8, -1, 2.5]
  ];

  lanes.forEach(([z, x, direction, speed], index) => {
    createChicken(z, x, direction, speed, [1, 4, 8, 10].includes(index));
  });
}

function createWheat(position, index) {
  const wheatGroup = new THREE.Group();
  wheatGroup.position.copy(position);
  wheatGroup.userData.baseY = position.y;
  wheatGroup.userData.index = index;
  scene.add(wheatGroup);

  const stemMaterial = makeMaterial(0xd5ad42, { roughness: 0.7 });
  const grainMaterial = makeMaterial(0xf2d36b, {
    roughness: 0.45,
    emissive: 0x4a3300,
    emissiveIntensity: 0.25
  });
  const bandMaterial = makeMaterial(0x7a4a1f, { roughness: 0.6 });

  for (let i = 0; i < 7; i += 1) {
    const x = (i - 3) * 0.055;
    const rotation = new THREE.Euler(0.12 * (i - 3), 0, 0.12 * (i - 3));
    addMesh(wheatGroup, new THREE.CylinderGeometry(0.022, 0.022, 0.62, 10), stemMaterial, new THREE.Vector3(x, 0.32, 0), rotation);
    addMesh(wheatGroup, new THREE.ConeGeometry(0.07, 0.16, 12), grainMaterial, new THREE.Vector3(x, 0.68, 0), rotation);
  }

  addMesh(wheatGroup, new THREE.BoxGeometry(0.46, 0.08, 0.18), bandMaterial, new THREE.Vector3(0, 0.34, 0));

  wheat.push(wheatGroup);
}

function createTree(position, scale = 1) {
  const tree = new THREE.Group();
  tree.position.copy(position);
  tree.scale.setScalar(scale);
  scene.add(tree);

  addMesh(tree, new THREE.CylinderGeometry(0.18, 0.24, 0.82, 12), makeMaterial(0x7a4f2b, { roughness: 0.8 }), new THREE.Vector3(0, 0.42, 0));
  addMesh(tree, new THREE.ConeGeometry(0.72, 1.0, 18), makeMaterial(0x2f6f3a, { roughness: 0.85 }), new THREE.Vector3(0, 1.2, 0));
  addMesh(tree, new THREE.ConeGeometry(0.55, 0.82, 18), makeMaterial(0x3c8b45, { roughness: 0.85 }), new THREE.Vector3(0, 1.68, 0));

  staticBlockers.push({ object: tree, radius: 0.68 * scale, label: 'tree' });
}

function createPond(position, scaleX = 1, scaleZ = 1) {
  const pond = new THREE.Group();
  pond.position.copy(position);
  scene.add(pond);

  const water = addMesh(
    pond,
    new THREE.CylinderGeometry(0.8, 0.8, 0.06, 32),
    makeMaterial(0x3f9dc7, { roughness: 0.28, metalness: 0.05, emissive: 0x082a36, emissiveIntensity: 0.15 }),
    new THREE.Vector3(0, 0.04, 0)
  );
  water.scale.set(scaleX, 1, scaleZ);

  const rim = addMesh(
    pond,
    new THREE.TorusGeometry(0.82, 0.045, 12, 32),
    makeMaterial(0x7c8a64, { roughness: 0.9 }),
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );
  rim.scale.set(scaleX, scaleZ, 1);

  staticBlockers.push({ object: pond, radius: 0.78 * Math.max(scaleX, scaleZ), label: 'pond' });
}

function createBlockers() {
  createPond(new THREE.Vector3(-2.7, 0, -3.05), 1.1, 0.62);
  createPond(new THREE.Vector3(2.7, 0, 4.35), 0.82, 1.15);
  createTree(new THREE.Vector3(3.7, 0, -9.6), 0.82);
  createTree(new THREE.Vector3(-3.8, 0, -0.2), 0.95);
  createTree(new THREE.Vector3(0.1, 0, 11.15), 0.8);
}

function createWheatField() {
  [
    [-3.8, 0.08, -9.65],
    [2.9, 0.08, -7.1],
    [-2.6, 0.08, -5.35],
    [3.6, 0.08, -2.75],
    [-0.6, 0.08, -0.1],
    [-4.1, 0.08, 1.55],
    [2.3, 0.08, 3.35],
    [-2.9, 0.08, 5.15],
    [3.8, 0.08, 7.0],
    [0.9, 0.08, 8.85],
    [-3.7, 0.08, 10.5],
    [2.8, 0.08, 12.15]
  ].forEach(([x, y, z], index) => {
    createWheat(new THREE.Vector3(x, y, z), index);
  });
}

function updateHud() {
  scoreElem.textContent = `${gameState.score}/${gameState.total}`;
  timerElem.textContent = Math.max(0, Math.ceil(gameState.timeLeft)).toString();
}

function setMessage(text) {
  messageElem.textContent = text;
}

function flashTryAgain() {
  flashMessageElem.classList.remove('show');
  void flashMessageElem.offsetWidth;
  flashMessageElem.textContent = 'TRY AGAIN';
  flashMessageElem.classList.add('show');
}

function flashWin() {
  flashMessageElem.classList.remove('show');
  void flashMessageElem.offsetWidth;
  flashMessageElem.textContent = 'YOU WIN';
  flashMessageElem.classList.add('show');
}

function resetWheat() {
  gameState.score = 0;
  wheat.forEach((grain) => {
    grain.visible = true;
  });
}

function resetPlayerAfterCollision(time) {
  if (time - gameState.lastCrashAt < 1.1) {
    return;
  }

  gameState.lastCrashAt = time;
  resetWheat();
  playerCar.position.copy(playerStart);
  playerCar.rotation.y = 0;
  setMessage('Chicken collision. Wheat reset. Try again.');
  flashTryAgain();
}

function updatePlayer(delta, time) {
  if (!playerCar || gameState.isOver) {
    return;
  }

  const previousPosition = playerCar.position.clone();
  const xInput = Number(keys.has('KeyA') || keys.has('ArrowLeft')) -
    Number(keys.has('KeyD') || keys.has('ArrowRight'));
  const zInput = Number(keys.has('KeyW') || keys.has('ArrowUp')) -
    Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const move = new THREE.Vector3(xInput, 0, zInput);

  if (move.lengthSq() > 0) {
    move.normalize();
    playerCar.position.addScaledVector(move, delta * 3.2);
    playerCar.rotation.y = Math.atan2(move.x, move.z);
  }

  playerCar.position.x = THREE.MathUtils.clamp(playerCar.position.x, -4.45, 4.45);
  playerCar.position.z = THREE.MathUtils.clamp(playerCar.position.z, -11.8, 14.1);

  chickens.forEach((chicken) => {
    if (playerCar.position.distanceTo(chicken.position) < chicken.userData.radius) {
      resetPlayerAfterCollision(time);
    }
  });

  staticBlockers.forEach((blocker) => {
    if (playerCar.position.distanceTo(blocker.object.position) < blocker.radius) {
      playerCar.position.copy(previousPosition);
      setMessage(`${blocker.label === 'pond' ? 'Pond' : 'Tree'} blocks the path.`);
    }
  });

  wheat.forEach((grain) => {
    if (!grain.visible) {
      return;
    }

    if (playerCar.position.distanceTo(grain.position) < 0.62) {
      grain.visible = false;
      gameState.score += 1;
      setMessage(gameState.score === gameState.total ? 'All wheat collected. Reach the windmill.' : 'Wheat collected.');
    }
  });

  if (playerCar.position.z >= finishZ) {
    if (gameState.score === gameState.total) {
      gameState.isOver = true;
      setMessage('You reached the windmill with all wheat. You win!');
      flashWin();
    } else {
      setMessage('Collect all wheat before reaching the windmill.');
    }
  }
}

function loadColorTexture(path) {
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadDataTexture(path) {
  return textureLoader.load(path);
}

const windmillMaterials = {
  lopatky: new THREE.MeshStandardMaterial({
    map: loadColorTexture('textures/windmill_001_lopatky_COL.jpg'),
    normalMap: loadDataTexture('textures/windmill_001_lopatky_NOR.jpg'),
    roughness: 0.8,
    metalness: 0.05,
    side: THREE.DoubleSide
  }),
  mlyn: new THREE.MeshStandardMaterial({
    map: loadColorTexture('textures/windmill_001_base_COL.jpg'),
    normalMap: loadDataTexture('textures/windmill_001_base_NOR.jpg'),
    roughness: 0.75,
    metalness: 0.05
  }),
  default: makeMaterial(0xc7c7c7, { roughness: 0.75 })
};

function fitWindmillToScene(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const scale = 2.0 / maxSize;

  model.scale.setScalar(scale);
  model.position.set(
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale + 15.25
  );
  model.rotation.y = Math.PI;
}

function prepWindmill(root) {
  windmillModel = root;

  windmillModel.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const name = child.name.toLowerCase();
    if (name.includes('lopatky')) {
      child.material = child.material || windmillMaterials.lopatky;
      child.material.side = THREE.DoubleSide;
    } else if (name.includes('mlyn')) {
      child.material = child.material || windmillMaterials.mlyn;
    } else {
      child.material = child.material || windmillMaterials.default;
    }
  });

  fitWindmillToScene(windmillModel);
  scene.add(windmillModel);
  document.body.dataset.windmillLoaded = 'true';
}

mtlLoader.load('windmill_001.mtl', (materials) => {
  materials.preload();

  const objLoader = new OBJLoader(loadManager);
  objLoader.setMaterials(materials);
  objLoader.load('windmill_001.obj', prepWindmill, undefined, (error) => {
    document.body.dataset.objLoadError = error.message || String(error);
  });
}, undefined, (error) => {
  document.body.dataset.objLoadError = error.message || String(error);
});

createWorld();
createCar();
createChickens();
createWheatField();
createBlockers();
updateHud();

window.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

function resizeRenderer() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resizeRenderer);

let previousTime = 0;

function render(time) {
  time *= 0.001;
  const delta = Math.min(time - previousTime, 0.05);
  previousTime = time;

  if (!gameState.isOver) {
    gameState.timeLeft -= delta;
    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      gameState.isOver = true;
      setMessage('Time is up. Refresh to try again.');
    }
  }

  chickens.forEach((chicken, index) => {
    chicken.position.x += chicken.userData.direction * chicken.userData.speed * delta;
    if (chicken.position.x > chicken.userData.maxX) {
      chicken.position.x = chicken.userData.minX;
    }
    if (chicken.position.x < chicken.userData.minX) {
      chicken.position.x = chicken.userData.maxX;
    }
    chicken.rotation.y = chicken.userData.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    chicken.position.y = Math.sin(time * 8 + index) * 0.035;
  });

  updatePlayer(delta, time);

  animatedWheels.forEach((wheel) => {
    wheel.rotation.z = time * 5;
  });

  wheat.forEach((grain, index) => {
    if (!grain.visible) {
      return;
    }
    grain.rotation.y = time * 1.6 + index;
    grain.position.y = grain.userData.baseY + Math.sin(time * 2 + index) * 0.05;
  });

  if (playerCar) {
    const target = playerCar.position.clone();
    target.y += 0.65;
    controls.target.lerp(target, 0.08);
  }

  updateHud();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
