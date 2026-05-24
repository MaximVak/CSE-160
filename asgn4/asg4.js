"use strict";

const VSHADER_SOURCE = `
  precision mediump float;

  attribute vec4 a_Position;
  attribute vec4 a_Color;
  attribute vec3 a_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat3 u_NormalMatrix;
  uniform mat4 u_ViewProjMatrix;
  uniform vec3 u_LightPosition;
  uniform vec3 u_SpotLightPosition;
  uniform vec3 u_CameraPosition;

  varying vec4 v_Color;
  varying vec3 v_NormalDir;
  varying vec3 v_LightDir;
  varying vec3 v_SpotLightDir;
  varying vec3 v_WorldPosition;
  varying vec3 v_ViewDir;

  void main() {
    vec4 worldPosition = u_ModelMatrix * a_Position;
    gl_Position = u_ViewProjMatrix * worldPosition;
    v_Color = a_Color;
    v_NormalDir = normalize(u_NormalMatrix * a_Normal);
    v_LightDir = u_LightPosition - worldPosition.xyz;
    v_SpotLightDir = u_SpotLightPosition - worldPosition.xyz;
    v_WorldPosition = worldPosition.xyz;
    v_ViewDir = u_CameraPosition - worldPosition.xyz;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;

  uniform bool u_ShowNormals;
  uniform bool u_IsLightMarker;
  uniform bool u_LightingEnabled;
  uniform bool u_SpotLightEnabled;
  uniform vec3 u_LightColor;
  uniform vec3 u_MarkerColor;
  uniform vec3 u_SpotLightPosition;
  uniform vec3 u_SpotLightDirection;
  uniform vec3 u_SpotLightColor;
  uniform float u_SpotLightCutoff;
  uniform float u_SpotLightOuterCutoff;

  varying vec4 v_Color;
  varying vec3 v_NormalDir;
  varying vec3 v_LightDir;
  varying vec3 v_SpotLightDir;
  varying vec3 v_WorldPosition;
  varying vec3 v_ViewDir;

  void main() {
    if (u_ShowNormals) {
      gl_FragColor = vec4(normalize(v_NormalDir) * 0.5 + 0.5, 1.0);
    } else if (u_IsLightMarker) {
      gl_FragColor = vec4(u_MarkerColor, 1.0);
    } else if (!u_LightingEnabled) {
      gl_FragColor = v_Color;
    } else {
      vec3 normal = normalize(v_NormalDir);
      vec3 lightDir = normalize(v_LightDir);
      vec3 spotLightDir = normalize(v_SpotLightDir);
      vec3 viewDir = normalize(v_ViewDir);
      float nDotL = max(dot(normal, lightDir), 0.0);
      float nDotSpot = max(dot(normal, spotLightDir), 0.0);

      vec3 ambient = 0.18 * v_Color.rgb;
      vec3 diffuse = nDotL * v_Color.rgb * u_LightColor;

      vec3 reflectDir = reflect(-lightDir, normal);
      float specularStrength = nDotL > 0.0
        ? pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * 0.55
        : 0.0;
      vec3 specular = specularStrength * u_LightColor;

      vec3 fromSpotToSurface = normalize(v_WorldPosition - u_SpotLightPosition);
      float theta = dot(fromSpotToSurface, normalize(u_SpotLightDirection));
      float epsilon = u_SpotLightCutoff - u_SpotLightOuterCutoff;
      float spotIntensity = clamp((theta - u_SpotLightOuterCutoff) / epsilon, 0.0, 1.0);
      if (!u_SpotLightEnabled) {
        spotIntensity = 0.0;
      }

      vec3 spotReflectDir = reflect(-spotLightDir, normal);
      float spotSpecularStrength = nDotSpot > 0.0
        ? pow(max(dot(viewDir, spotReflectDir), 0.0), 40.0) * 0.75
        : 0.0;
      vec3 spotDiffuse = nDotSpot * v_Color.rgb * u_SpotLightColor * spotIntensity;
      vec3 spotSpecular = spotSpecularStrength * u_SpotLightColor * spotIntensity;

      gl_FragColor = vec4(min(ambient + diffuse + specular + spotDiffuse + spotSpecular, vec3(1.0)), v_Color.a);
    }
  }
`;

const lightPosition = [0.0, 1.8, 1.4];
const lightColor = [1.0, 0.8, 0.25];
const spotLightPosition = [0.45, 2.35, 2.15];
const spotLightTarget = [0.25, -0.15, 0.0];
const spotLightDirection = [0.0, -1.0, 0.0];
const spotLightColor = [0.45, 0.82, 1.0];
const defaultMarkerColor = [1.0, 1.0, 1.0];
const objModelColor = [0.82, 0.72, 1.0];
const FALLBACK_CRYSTAL_OBJ = `
o FacetedCrystal
v 0.000 1.000 0.000
v -0.650 0.250 0.000
v 0.000 0.250 0.650
v 0.650 0.250 0.000
v 0.000 0.250 -0.650
v -0.420 -0.700 0.000
v 0.000 -0.700 0.420
v 0.420 -0.700 0.000
v 0.000 -0.700 -0.420
v 0.000 -1.000 0.000
f 1 2 3
f 1 3 4
f 1 4 5
f 1 5 2
f 2 6 7 3
f 3 7 8 4
f 4 8 9 5
f 5 9 6 2
f 10 7 6
f 10 8 7
f 10 9 8
f 10 6 9
`;

const state = {
  cameraAngle: 35,
  lightAngle: 35,
  lightHue: 48,
  isLightSliderActive: false,
  lastTickTime: 0,
  elapsedTime: 0,
  showNormals: false,
  lightingEnabled: true,
  spotLightEnabled: true,
  isDragging: false,
  lastPointerX: 0,
};

let gl = null;
let program = null;
let sceneMeshes = {};
let attribs = {};
let uniforms = {};

function main() {
  const canvas = document.getElementById("webgl");
  try {
    gl = canvas.getContext("webgl", { antialias: true });

    if (!gl) {
      showCanvasMessage(canvas, "Unable to initialize WebGL.");
      return;
    }

    program = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    gl.useProgram(program);

    attribs = {
      position: gl.getAttribLocation(program, "a_Position"),
      color: gl.getAttribLocation(program, "a_Color"),
      normal: gl.getAttribLocation(program, "a_Normal"),
    };
    uniforms = {
      modelMatrix: gl.getUniformLocation(program, "u_ModelMatrix"),
      normalMatrix: gl.getUniformLocation(program, "u_NormalMatrix"),
      viewProjMatrix: gl.getUniformLocation(program, "u_ViewProjMatrix"),
      lightPosition: gl.getUniformLocation(program, "u_LightPosition"),
      spotLightPosition: gl.getUniformLocation(program, "u_SpotLightPosition"),
      spotLightDirection: gl.getUniformLocation(program, "u_SpotLightDirection"),
      spotLightColor: gl.getUniformLocation(program, "u_SpotLightColor"),
      spotLightCutoff: gl.getUniformLocation(program, "u_SpotLightCutoff"),
      spotLightOuterCutoff: gl.getUniformLocation(program, "u_SpotLightOuterCutoff"),
      spotLightEnabled: gl.getUniformLocation(program, "u_SpotLightEnabled"),
      cameraPosition: gl.getUniformLocation(program, "u_CameraPosition"),
      lightColor: gl.getUniformLocation(program, "u_LightColor"),
      markerColor: gl.getUniformLocation(program, "u_MarkerColor"),
      isLightMarker: gl.getUniformLocation(program, "u_IsLightMarker"),
      lightingEnabled: gl.getUniformLocation(program, "u_LightingEnabled"),
      showNormals: gl.getUniformLocation(program, "u_ShowNormals"),
    };

    initSceneMeshes();
    initControls(canvas);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.03, 0.04, 0.06, 1.0);

    updateLightPosition();
    updateLightColor();
    updateSpotLightDirection();
    loadObjModel("models/crystal.obj");
    render();
    requestAnimationFrame(tick);
  } catch (error) {
    console.error(error);
    showCanvasMessage(canvas, error.message);
  }
}

function initSceneMeshes() {
  sceneMeshes = {
    cube: createMesh(createCubeGeometry()),
    lightCube: createMesh(createCubeGeometry([1.0, 0.95, 0.35])),
    spotLightCube: createMesh(createCubeGeometry([0.45, 0.82, 1.0])),
    sphere: createMesh(createSphereGeometry(0.85, 32, 16)),
    dogBodyCube: createMesh(createCubeGeometry([0.6, 0.4, 0.2])),
    dogDarkCube: createMesh(createCubeGeometry([0.5, 0.3, 0.1])),
    dogLegCube: createMesh(createCubeGeometry([0.55, 0.35, 0.15])),
    dogPawCube: createMesh(createCubeGeometry([0.4, 0.25, 0.1])),
    dogSnoutCube: createMesh(createCubeGeometry([0.7, 0.5, 0.3])),
    dogBlackCube: createMesh(createCubeGeometry([0.03, 0.03, 0.03])),
    dogHeadSphere: createMesh(createSphereGeometry(0.18, 24, 12, [0.6, 0.4, 0.2])),
    objModel: createMesh(createObjGeometry(FALLBACK_CRYSTAL_OBJ, objModelColor)),
  };
}

async function loadObjModel(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Unable to load ${path}: ${response.status}`);
    }
    const objText = await response.text();
    sceneMeshes.objModel = createMesh(createObjGeometry(objText, objModelColor));
    render();
  } catch (error) {
    console.warn(`Using fallback OBJ model. ${error.message}`);
  }
}

function createMesh(geometry) {
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

  return {
    vertexBuffer,
    normalBuffer,
    indexBuffer,
    indexCount: geometry.indices.length,
  };
}

function createObjGeometry(objText, color) {
  const positions = [];
  const objNormals = [];
  const vertexData = [];
  const normalData = [];
  const indexData = [];

  for (const rawLine of objText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    if (parts[0] === "v") {
      positions.push(parts.slice(1, 4).map(Number));
    } else if (parts[0] === "vn") {
      objNormals.push(normalize(parts.slice(1, 4).map(Number)));
    } else if (parts[0] === "f") {
      const face = parts.slice(1).map((token) => parseObjFaceVertex(token, positions.length, objNormals.length));
      for (let i = 1; i < face.length - 1; i++) {
        appendObjTriangle(face[0], face[i], face[i + 1], positions, objNormals, color, vertexData, normalData, indexData);
      }
    }
  }

  if (vertexData.length === 0) {
    throw new Error("OBJ model did not contain drawable faces.");
  }

  return {
    vertices: new Float32Array(vertexData),
    normals: new Float32Array(normalData),
    indices: new Uint16Array(indexData),
  };
}

function parseObjFaceVertex(token, positionCount, normalCount) {
  const parts = token.split("/");
  return {
    positionIndex: resolveObjIndex(Number(parts[0]), positionCount),
    normalIndex: parts[2] ? resolveObjIndex(Number(parts[2]), normalCount) : null,
  };
}

function resolveObjIndex(index, count) {
  return index < 0 ? count + index : index - 1;
}

function appendObjTriangle(a, b, c, positions, objNormals, color, vertexData, normalData, indexData) {
  const p0 = positions[a.positionIndex];
  const p1 = positions[b.positionIndex];
  const p2 = positions[c.positionIndex];
  const faceNormal = calculateFaceNormal(p0, p1, p2);

  for (const vertex of [a, b, c]) {
    const position = positions[vertex.positionIndex];
    const normal = vertex.normalIndex === null ? faceNormal : objNormals[vertex.normalIndex];
    vertexData.push(position[0], position[1], position[2], color[0], color[1], color[2]);
    normalData.push(normal[0], normal[1], normal[2]);
    indexData.push(indexData.length);
  }
}

function calculateFaceNormal(a, b, c) {
  const edge1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const edge2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return normalize(cross(edge1, edge2));
}

function createCubeGeometry(solidColor = null) {
  const color = solidColor || [0, 0, 0];
  const vertices = new Float32Array([
    // x, y, z,       r, g, b
    // front
    -0.8, -0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.35, solidColor ? color[2] : 0.32,
     0.8, -0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.57, solidColor ? color[2] : 0.30,
     0.8,  0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.83, solidColor ? color[2] : 0.36,
    -0.8,  0.8,  0.8,  solidColor ? color[0] : 0.68, solidColor ? color[1] : 0.90, solidColor ? color[2] : 0.42,
    // right
     0.8, -0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.57, solidColor ? color[2] : 0.30,
     0.8, -0.8, -0.8,  solidColor ? color[0] : 0.38, solidColor ? color[1] : 0.87, solidColor ? color[2] : 0.88,
     0.8,  0.8, -0.8,  solidColor ? color[0] : 0.58, solidColor ? color[1] : 0.47, solidColor ? color[2] : 1.0,
     0.8,  0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.83, solidColor ? color[2] : 0.36,
    // back
     0.8, -0.8, -0.8,  solidColor ? color[0] : 0.38, solidColor ? color[1] : 0.87, solidColor ? color[2] : 0.88,
    -0.8, -0.8, -0.8,  solidColor ? color[0] : 0.23, solidColor ? color[1] : 0.66, solidColor ? color[2] : 1.0,
    -0.8,  0.8, -0.8,  solidColor ? color[0] : 0.92, solidColor ? color[1] : 0.48, solidColor ? color[2] : 0.92,
     0.8,  0.8, -0.8,  solidColor ? color[0] : 0.58, solidColor ? color[1] : 0.47, solidColor ? color[2] : 1.0,
    // left
    -0.8, -0.8, -0.8,  solidColor ? color[0] : 0.23, solidColor ? color[1] : 0.66, solidColor ? color[2] : 1.0,
    -0.8, -0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.35, solidColor ? color[2] : 0.32,
    -0.8,  0.8,  0.8,  solidColor ? color[0] : 0.68, solidColor ? color[1] : 0.90, solidColor ? color[2] : 0.42,
    -0.8,  0.8, -0.8,  solidColor ? color[0] : 0.92, solidColor ? color[1] : 0.48, solidColor ? color[2] : 0.92,
    // top
    -0.8,  0.8,  0.8,  solidColor ? color[0] : 0.68, solidColor ? color[1] : 0.90, solidColor ? color[2] : 0.42,
     0.8,  0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.83, solidColor ? color[2] : 0.36,
     0.8,  0.8, -0.8,  solidColor ? color[0] : 0.58, solidColor ? color[1] : 0.47, solidColor ? color[2] : 1.0,
    -0.8,  0.8, -0.8,  solidColor ? color[0] : 0.92, solidColor ? color[1] : 0.48, solidColor ? color[2] : 0.92,
    // bottom
    -0.8, -0.8, -0.8,  solidColor ? color[0] : 0.23, solidColor ? color[1] : 0.66, solidColor ? color[2] : 1.0,
     0.8, -0.8, -0.8,  solidColor ? color[0] : 0.38, solidColor ? color[1] : 0.87, solidColor ? color[2] : 0.88,
     0.8, -0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.57, solidColor ? color[2] : 0.30,
    -0.8, -0.8,  0.8,  solidColor ? color[0] : 1.0, solidColor ? color[1] : 0.35, solidColor ? color[2] : 0.32,
  ]);

  const normals = new Float32Array([
    // front
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    // right
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    // back
    0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
    // left
    -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
    // top
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    // bottom
    0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
  ]);

  const indices = new Uint16Array([
     0,  1,  2,  0,  2,  3,
     4,  5,  6,  4,  6,  7,
     8,  9, 10,  8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  return { vertices, normals, indices };
}

function createSphereGeometry(radius, longitudeBands, latitudeBands, color = [0.35, 0.74, 1.0]) {
  const vertexData = [];
  const normalData = [];
  const indexData = [];

  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = lat * Math.PI / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longitudeBands; lon++) {
      const phi = lon * 2 * Math.PI / longitudeBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const normalX = cosPhi * sinTheta;
      const normalY = cosTheta;
      const normalZ = sinPhi * sinTheta;

      vertexData.push(
        radius * normalX, radius * normalY, radius * normalZ,
        color[0], color[1], color[2],
      );
      normalData.push(normalX, normalY, normalZ);
    }
  }

  for (let lat = 0; lat < latitudeBands; lat++) {
    for (let lon = 0; lon < longitudeBands; lon++) {
      const first = lat * (longitudeBands + 1) + lon;
      const second = first + longitudeBands + 1;

      indexData.push(first, second, first + 1);
      indexData.push(second, second + 1, first + 1);
    }
  }

  return {
    vertices: new Float32Array(vertexData),
    normals: new Float32Array(normalData),
    indices: new Uint16Array(indexData),
  };
}

function initControls(canvas) {
  const cameraSlider = document.getElementById("cameraAngle");
  const cameraOutput = document.getElementById("cameraAngleValue");
  const lightSlider = document.getElementById("lightAngle");
  const lightOutput = document.getElementById("lightAngleValue");
  const lightHueSlider = document.getElementById("lightHue");
  const lightHueOutput = document.getElementById("lightHueValue");
  const normalToggle = document.getElementById("normalToggle");
  const lightingToggle = document.getElementById("lightingToggle");
  const spotlightToggle = document.getElementById("spotlightToggle");

  function setCameraAngle(angle) {
    state.cameraAngle = clamp(Number(angle), -180, 180);
    cameraSlider.value = String(state.cameraAngle);
    cameraOutput.value = `${Math.round(state.cameraAngle)} deg`;
    render();
  }

  function setLightAngle(angle) {
    state.lightAngle = wrapDegrees(Number(angle));
    lightSlider.value = String(Math.round(state.lightAngle));
    lightOutput.value = `${Math.round(state.lightAngle)} deg`;
    updateLightPosition();
    render();
  }

  function setLightHue(hue) {
    state.lightHue = wrapDegrees(Number(hue));
    lightHueSlider.value = String(Math.round(state.lightHue));
    lightHueOutput.value = `${Math.round(state.lightHue)} deg`;
    updateLightColor();
    render();
  }

  cameraSlider.addEventListener("input", () => setCameraAngle(cameraSlider.value));
  lightSlider.addEventListener("input", () => setLightAngle(lightSlider.value));
  lightHueSlider.addEventListener("input", () => setLightHue(lightHueSlider.value));
  lightSlider.addEventListener("pointerdown", () => {
    state.isLightSliderActive = true;
  });
  lightSlider.addEventListener("pointerup", () => {
    state.isLightSliderActive = false;
  });
  lightSlider.addEventListener("pointercancel", () => {
    state.isLightSliderActive = false;
  });

  normalToggle.addEventListener("click", () => {
    state.showNormals = !state.showNormals;
    normalToggle.setAttribute("aria-pressed", String(state.showNormals));
    normalToggle.textContent = `Normal Visualization: ${state.showNormals ? "On" : "Off"}`;
    render();
  });

  lightingToggle.addEventListener("click", () => {
    state.lightingEnabled = !state.lightingEnabled;
    lightingToggle.setAttribute("aria-pressed", String(state.lightingEnabled));
    lightingToggle.textContent = `Lighting: ${state.lightingEnabled ? "On" : "Off"}`;
    render();
  });

  spotlightToggle.addEventListener("click", () => {
    state.spotLightEnabled = !state.spotLightEnabled;
    spotlightToggle.setAttribute("aria-pressed", String(state.spotLightEnabled));
    spotlightToggle.textContent = `Spotlight: ${state.spotLightEnabled ? "On" : "Off"}`;
    render();
  });

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setCameraAngle(state.cameraAngle - 5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setCameraAngle(state.cameraAngle + 5);
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    state.isDragging = true;
    state.lastPointerX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.isDragging) return;
    const deltaX = event.clientX - state.lastPointerX;
    state.lastPointerX = event.clientX;
    setCameraAngle(state.cameraAngle + deltaX * 0.4);
  });

  canvas.addEventListener("pointerup", (event) => {
    state.isDragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointercancel", () => {
    state.isDragging = false;
  });

  setCameraAngle(state.cameraAngle);
  setLightAngle(state.lightAngle);
  setLightHue(state.lightHue);
}

function tick(currentTime) {
  try {
    if (state.lastTickTime === 0) {
      state.lastTickTime = currentTime;
    }

    const elapsedSeconds = (currentTime - state.lastTickTime) / 1000;
    state.lastTickTime = currentTime;
    state.elapsedTime += elapsedSeconds;

    if (!state.isLightSliderActive) {
      state.lightAngle = wrapDegrees(state.lightAngle + elapsedSeconds * 35);
      updateLightControl();
    }

    updateLightPosition();
    render();
    requestAnimationFrame(tick);
  } catch (error) {
    console.error(error);
    showCanvasMessage(gl.canvas, error.message);
  }
}

function updateLightPosition() {
  const lightRadius = 2.4;
  const angleRad = degToRad(state.lightAngle);
  lightPosition[0] = Math.cos(angleRad) * lightRadius;
  lightPosition[1] = 1.8;
  lightPosition[2] = Math.sin(angleRad) * lightRadius;
}

function updateLightControl() {
  const lightSlider = document.getElementById("lightAngle");
  const lightOutput = document.getElementById("lightAngleValue");

  lightSlider.value = String(Math.round(state.lightAngle));
  lightOutput.value = `${Math.round(state.lightAngle)} deg`;
}

function updateLightColor() {
  const color = hsvToRgb(state.lightHue, 0.8, 1.0);
  lightColor[0] = color[0];
  lightColor[1] = color[1];
  lightColor[2] = color[2];
}

function updateSpotLightDirection() {
  const direction = normalize([
    spotLightTarget[0] - spotLightPosition[0],
    spotLightTarget[1] - spotLightPosition[1],
    spotLightTarget[2] - spotLightPosition[2],
  ]);
  spotLightDirection[0] = direction[0];
  spotLightDirection[1] = direction[1];
  spotLightDirection[2] = direction[2];
}

function render() {
  if (!gl) return;

  resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = gl.canvas.width / gl.canvas.height;
  const projection = mat4Perspective(degToRad(55), aspect, 0.1, 100);

  const angleRad = degToRad(state.cameraAngle);
  const radius = 6.3;
  const eye = [
    Math.sin(angleRad) * radius,
    2.1,
    Math.cos(angleRad) * radius,
  ];
  const view = mat4LookAt(eye, [0, 0, 0], [0, 1, 0]);
  const viewProj = mat4Multiply(projection, view);

  gl.uniformMatrix4fv(uniforms.viewProjMatrix, false, viewProj);
  gl.uniform3fv(uniforms.lightPosition, lightPosition);
  gl.uniform3fv(uniforms.spotLightPosition, spotLightPosition);
  gl.uniform3fv(uniforms.spotLightDirection, spotLightDirection);
  gl.uniform3fv(uniforms.spotLightColor, spotLightColor);
  gl.uniform1f(uniforms.spotLightCutoff, Math.cos(degToRad(14)));
  gl.uniform1f(uniforms.spotLightOuterCutoff, Math.cos(degToRad(24)));
  gl.uniform1i(uniforms.spotLightEnabled, state.spotLightEnabled ? 1 : 0);
  gl.uniform3fv(uniforms.cameraPosition, eye);
  gl.uniform3fv(uniforms.lightColor, lightColor);
  gl.uniform1i(uniforms.showNormals, state.showNormals ? 1 : 0);
  gl.uniform1i(uniforms.lightingEnabled, state.lightingEnabled ? 1 : 0);

  drawMesh(
    sceneMeshes.cube,
    mat4Multiply(mat4Translation(-2.45, 0, 0), mat4RotationY(degToRad(28))),
  );
  drawMesh(sceneMeshes.sphere, mat4Translation(0.25, 0, 0));
  drawMesh(
    sceneMeshes.objModel,
    mat4Multiply(
      mat4Translation(-1.1, -0.18, 1.2),
      mat4Multiply(mat4RotationY(degToRad(-22)), mat4Scale(0.55, 0.55, 0.55)),
    ),
  );
  drawAnimal(state.elapsedTime);
  drawMesh(
    sceneMeshes.lightCube,
    mat4Multiply(
      mat4Translation(lightPosition[0], lightPosition[1], lightPosition[2]),
      mat4Scale(0.16, 0.16, 0.16),
    ),
    { isLightMarker: true, markerColor: lightColor },
  );
  drawMesh(
    sceneMeshes.spotLightCube,
    mat4Multiply(
      mat4Translation(spotLightPosition[0], spotLightPosition[1], spotLightPosition[2]),
      mat4Scale(0.18, 0.18, 0.18),
    ),
    { isLightMarker: true, markerColor: spotLightColor },
  );
}

function drawAnimal(timeSeconds) {
  const walk = Math.sin(timeSeconds * 3.2);
  const oppositeWalk = Math.sin(timeSeconds * 3.2 + Math.PI);
  const bodyBob = 0.025 * Math.abs(Math.sin(timeSeconds * 6.4));
  const frontLegAngle = 24 * walk;
  const backLegAngle = 24 * oppositeWalk;
  const lowerLegAngle = 16 * Math.sin(timeSeconds * 3.2 + Math.PI / 2);
  const pawAngle = 10 * oppositeWalk;
  const tailAngle = 22 * Math.sin(timeSeconds * 5.5);
  const root = mat4Multiply(
    mat4Translation(2.45, -0.38, -0.15),
    mat4Scale(1.68, 1.68, 1.68),
  );

  drawAnimalCube(sceneMeshes.dogBodyCube, root, mat4Translation(0.0, bodyBob, 0.0), 0.5, 0.3, 0.8);
  drawMesh(sceneMeshes.dogHeadSphere, mat4Multiply(root, mat4Translation(0.0, 0.25 + bodyBob, 0.5)));

  drawAnimalCube(sceneMeshes.dogBlackCube, root, mat4Translation(-0.08, 0.28 + bodyBob, 0.66), 0.04, 0.04, 0.04);
  drawAnimalCube(sceneMeshes.dogBlackCube, root, mat4Translation(0.08, 0.28 + bodyBob, 0.66), 0.04, 0.04, 0.04);
  drawAnimalCube(sceneMeshes.dogBlackCube, root, mat4Translation(0.0, 0.22 + bodyBob, 0.74), 0.05, 0.04, 0.04);

  drawAnimalCube(
    sceneMeshes.dogDarkCube,
    root,
    mat4Multiply(mat4Translation(-0.2, 0.28 + bodyBob, 0.5), mat4RotationZ(degToRad(-20))),
    0.06, 0.18, 0.05,
  );
  drawAnimalCube(
    sceneMeshes.dogDarkCube,
    root,
    mat4Multiply(mat4Translation(0.2, 0.28 + bodyBob, 0.5), mat4RotationZ(degToRad(20))),
    0.06, 0.18, 0.05,
  );
  drawAnimalCube(sceneMeshes.dogSnoutCube, root, mat4Translation(0.0, 0.18 + bodyBob, 0.68), 0.18, 0.15, 0.15);

  drawAnimalCube(
    sceneMeshes.dogBodyCube,
    root,
    mat4Multiply(mat4Translation(0.0, 0.2 + bodyBob, -0.38), mat4RotationX(degToRad(tailAngle))),
    0.08, 0.25, 0.08,
  );

  drawAnimalLeg(root, -0.22, 0.3, frontLegAngle, lowerLegAngle, pawAngle);
  drawAnimalLeg(root, 0.22, 0.3, frontLegAngle, lowerLegAngle, pawAngle);
  drawAnimalLeg(root, -0.22, -0.3, backLegAngle, lowerLegAngle, pawAngle);
  drawAnimalLeg(root, 0.22, -0.3, backLegAngle, lowerLegAngle, pawAngle);
}

function drawAnimalLeg(root, x, z, upperAngle, lowerAngle, pawAngle) {
  const upperBase = mat4Multiply(mat4Translation(x, -0.2, z), mat4RotationX(degToRad(upperAngle)));
  drawAnimalCube(sceneMeshes.dogLegCube, root, upperBase, 0.1, 0.25, 0.1);

  const lowerBase = mat4Multiply(
    mat4Multiply(upperBase, mat4Translation(0.0, -0.22, 0.0)),
    mat4RotationX(degToRad(lowerAngle)),
  );
  drawAnimalCube(sceneMeshes.dogDarkCube, root, lowerBase, 0.08, 0.2, 0.08);

  const pawBase = mat4Multiply(
    mat4Multiply(lowerBase, mat4Translation(0.0, -0.14, 0.0)),
    mat4RotationX(degToRad(pawAngle)),
  );
  drawAnimalCube(sceneMeshes.dogPawCube, root, pawBase, 0.1, 0.08, 0.12);
}

function drawAnimalCube(mesh, rootMatrix, localMatrix, scaleX, scaleY, scaleZ) {
  const cubeScaleFactor = 0.625;
  const localWithScale = mat4Multiply(
    localMatrix,
    mat4Scale(scaleX * cubeScaleFactor, scaleY * cubeScaleFactor, scaleZ * cubeScaleFactor),
  );
  drawMesh(mesh, mat4Multiply(rootMatrix, localWithScale));
}

function drawMesh(mesh, modelMatrix, options = {}) {
  const bytesPerElement = Float32Array.BYTES_PER_ELEMENT;
  const stride = 6 * bytesPerElement;

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(attribs.position);

  gl.vertexAttribPointer(attribs.color, 3, gl.FLOAT, false, stride, 3 * bytesPerElement);
  gl.enableVertexAttribArray(attribs.color);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(attribs.normal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.uniformMatrix4fv(uniforms.modelMatrix, false, modelMatrix);
  gl.uniformMatrix3fv(uniforms.normalMatrix, false, mat3NormalFromMat4(modelMatrix));
  gl.uniform1i(uniforms.isLightMarker, options.isLightMarker ? 1 : 0);
  gl.uniform3fv(uniforms.markerColor, options.markerColor || defaultMarkerColor);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
}

function createProgram(glContext, vertexSource, fragmentSource) {
  const vertexShader = loadShader(glContext, glContext.VERTEX_SHADER, vertexSource);
  const fragmentShader = loadShader(glContext, glContext.FRAGMENT_SHADER, fragmentSource);
  const shaderProgram = glContext.createProgram();

  glContext.attachShader(shaderProgram, vertexShader);
  glContext.attachShader(shaderProgram, fragmentShader);
  glContext.linkProgram(shaderProgram);

  if (!glContext.getProgramParameter(shaderProgram, glContext.LINK_STATUS)) {
    const message = glContext.getProgramInfoLog(shaderProgram);
    glContext.deleteProgram(shaderProgram);
    throw new Error(`Unable to link shader program: ${message}`);
  }

  return shaderProgram;
}

function loadShader(glContext, type, source) {
  const shader = glContext.createShader(type);
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);

  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    const message = glContext.getShaderInfoLog(shader);
    glContext.deleteShader(shader);
    throw new Error(`Unable to compile shader: ${message}`);
  }

  return shader;
}

function resizeCanvasToDisplaySize(canvas) {
  const displayWidth = Math.floor(canvas.clientWidth * window.devicePixelRatio);
  const displayHeight = Math.floor(canvas.clientHeight * window.devicePixelRatio);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function mat4Perspective(fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4LookAt(eye, center, up) {
  const zAxis = normalize([
    eye[0] - center[0],
    eye[1] - center[1],
    eye[2] - center[2],
  ]);
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ]);
}

function mat4RotationY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

function mat4RotationX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
}

function mat4RotationZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function mat4Translation(x, y, z) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

function mat4Scale(x, y, z) {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ]);
}

function mat3NormalFromMat4(matrix) {
  const a00 = matrix[0];
  const a01 = matrix[4];
  const a02 = matrix[8];
  const a10 = matrix[1];
  const a11 = matrix[5];
  const a12 = matrix[9];
  const a20 = matrix[2];
  const a21 = matrix[6];
  const a22 = matrix[10];

  const inv00 = a11 * a22 - a12 * a21;
  const inv01 = a02 * a21 - a01 * a22;
  const inv02 = a01 * a12 - a02 * a11;
  const inv10 = a12 * a20 - a10 * a22;
  const inv11 = a00 * a22 - a02 * a20;
  const inv12 = a02 * a10 - a00 * a12;
  const inv20 = a10 * a21 - a11 * a20;
  const inv21 = a01 * a20 - a00 * a21;
  const inv22 = a00 * a11 - a01 * a10;
  const determinant = a00 * inv00 + a01 * inv10 + a02 * inv20;

  if (Math.abs(determinant) < 0.00001) {
    return new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  }

  const scale = 1 / determinant;
  return new Float32Array([
    inv00 * scale, inv01 * scale, inv02 * scale,
    inv10 * scale, inv11 * scale, inv12 * scale,
    inv20 * scale, inv21 * scale, inv22 * scale,
  ]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);

  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }

  return out;
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  return length > 0.00001
    ? [v[0] / length, v[1] / length, v[2] / length]
    : [0, 0, 0];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wrapDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function hsvToRgb(hue, saturation, value) {
  const chroma = value * saturation;
  const huePrime = wrapDegrees(hue) / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return [red + match, green + match, blue + match];
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

function showCanvasMessage(canvas, message) {
  const context = canvas.getContext("2d");
  if (!context) {
    let errorBox = document.getElementById("webglError");
    if (!errorBox) {
      errorBox = document.createElement("pre");
      errorBox.id = "webglError";
      errorBox.style.color = "#ffb4b4";
      errorBox.style.whiteSpace = "pre-wrap";
      errorBox.style.padding = "12px";
      canvas.insertAdjacentElement("afterend", errorBox);
    }
    errorBox.textContent = message;
    return;
  }
  context.fillStyle = "#101318";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#eff4fb";
  context.font = "20px Arial";
  context.fillText(message, 32, 56);
}

window.addEventListener("load", main);
