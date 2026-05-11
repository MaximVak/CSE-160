import { Camera } from "./camera.js";

const VERTEX_SHADER_SOURCE = `
attribute vec4 a_Position;
attribute vec2 a_TexCoord;
attribute vec3 a_Color;

uniform mat4 u_ModelMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjectionMatrix;

varying vec2 v_TexCoord;
varying vec3 v_Color;

void main() {
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
  v_TexCoord = a_TexCoord;
  v_Color = a_Color;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_Sampler0;
uniform sampler2D u_Sampler1;
uniform sampler2D u_Sampler2;
uniform sampler2D u_Sampler3;
uniform sampler2D u_Sampler4;
uniform sampler2D u_Sampler5;
uniform sampler2D u_Sampler6;
uniform sampler2D u_Sampler7;
uniform vec4 u_BaseColor;
uniform float u_TexColorWeight;
uniform int u_TextureIndex;

varying vec2 v_TexCoord;
varying vec3 v_Color;

void main() {
  float t = clamp(u_TexColorWeight, 0.0, 1.0);
  vec4 baseColor = vec4(v_Color, 1.0) * u_BaseColor;
  vec4 textureColor = texture2D(u_Sampler0, v_TexCoord);

  if (u_TextureIndex == 1) {
    textureColor = texture2D(u_Sampler1, v_TexCoord);
  } else if (u_TextureIndex == 2) {
    textureColor = texture2D(u_Sampler2, v_TexCoord);
  } else if (u_TextureIndex == 3) {
    textureColor = texture2D(u_Sampler3, v_TexCoord);
  } else if (u_TextureIndex == 4) {
    textureColor = texture2D(u_Sampler4, v_TexCoord);
  } else if (u_TextureIndex == 5) {
    textureColor = texture2D(u_Sampler5, v_TexCoord);
  } else if (u_TextureIndex == 6) {
    textureColor = texture2D(u_Sampler6, v_TexCoord);
  } else if (u_TextureIndex == 7) {
    textureColor = texture2D(u_Sampler7, v_TexCoord);
  }

  gl_FragColor = (1.0 - t) * baseColor + t * textureColor;
}
`;

const canvas = document.querySelector("#webgl");
const statusEl = document.querySelector("#texture-status");
const fpsEl = document.querySelector("#fps-status");
const TEXTURE_BRICK = 0;
const TEXTURE_SKY = 1;
const TEXTURE_GRASS = 2;
const TEXTURE_STONE = 3;
const TEXTURE_CLOUDS = 4;
const TEXTURE_SIGN = 5;
const TEXTURE_WOOD = 6;
const TEXTURE_HEDGE = 7;
const TEXTURE_SOURCES = [
  "assets/wall.png",
  "assets/sky.png",
  "assets/grass.png",
  "assets/stone.png",
  "assets/clouds.svg",
  "assets/sign.svg",
  "assets/wood.svg",
  "assets/hedge.svg",
];
const WORLD_MAP_SIZE = 32;
const MAP_CENTER_OFFSET = (WORLD_MAP_SIZE - 1) / 2;
const WORLD_MAP_ROWS = [
  "22222222 22222222 22222222 22222222",
  "20000000 00000000 00000000 00000002",
  "20111110 11111101 11111011 11111002",
  "20100010 10000101 00001010 00001002",
  "20101110 10110101 01101010 11001002",
  "20101000 10000100 00100010 01001002",
  "20101011 11110111 10111110 01011002",
  "20100000 00010000 00100000 00001002",
  "20111101 11110101 11101111 10111002",
  "20000101 00000100 00101000 10000002",
  "21110101 01111111 10101110 10111112",
  "20010100 01000000 10000100 10000002",
  "20110111 11011111 11110101 11110102",
  "20100000 00010000 00000100 00000102",
  "20111111 11010000 00001101 01110102",
  "20000000 00000100 00000001 00000102",
  "20101000 00000100 00000001 00000102",
  "20101011 11011111 01111101 11110102",
  "20101000 01000001 00000100 00000102",
  "20101111 01011101 11110101 11110102",
  "20100001 00000100 00000101 00000102",
  "20111010 11110111 11110101 01111102",
  "20001010 00000100 00000100 00000002",
  "21101011 11101101 11111111 01111112",
  "20001000 00100001 00000000 01000002",
  "20111110 10111111 01111111 11011002",
  "20100000 10000000 01000000 00010002",
  "20101111 11110111 10111111 01110002",
  "20101000 00000100 00100001 00000002",
  "20101011 11111101 11110110 11111002",
  "20000000 00000000 00000000 00000002",
  "22222222 22222222 22222222 22222222",
];
const WORLD_MAP = WORLD_MAP_ROWS.map(mapRow);
if (WORLD_MAP.length !== WORLD_MAP_SIZE) {
  throw new Error(`World map has ${WORLD_MAP.length} rows instead of ${WORLD_MAP_SIZE}.`);
}
const CAMERA_RADIUS = 0.28;
const JUMP_SPEED = 3.25;
const JUMP_GRAVITY = 9.8;
const MAX_EDIT_HEIGHT = 5;
const ANIMALS = [
  makeAnimal("cat", 15, 18, [0.92, 0.55, 0.22, 1], [0.18, 0.12, 0.08, 1]),
  makeAnimal("dog", 8, 6, [0.55, 0.34, 0.18, 1], [0.23, 0.14, 0.08, 1]),
  makeAnimal("pig", 24, 5, [1, 0.58, 0.68, 1], [0.82, 0.34, 0.48, 1]),
  makeAnimal("cow", 6, 24, [0.95, 0.92, 0.82, 1], [0.08, 0.08, 0.08, 1]),
  makeAnimal("sheep", 27, 28, [0.92, 0.9, 0.78, 1], [0.1, 0.1, 0.1, 1]),
];
const EXIT_MARKER = { row: 1, col: 30 };
const COLLECT_DISTANCE = 1.15;
const WOOD_COLOR = [0.42, 0.23, 0.11, 1];
const MISSION_COMPLETE_TEXT = "Mission complete, end of game";
let hudMessage = "";
let hudOverrideUntil = 0;
let gameWon = false;
let camera;
let wallBoxes = [];

main();

function main() {
  const gl = canvas.getContext("webgl", { antialias: true });

  if (!gl) {
    setStatus("WebGL is not available in this browser.");
    return;
  }

  const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
  gl.useProgram(program);

  const locations = {
    a_Position: gl.getAttribLocation(program, "a_Position"),
    a_TexCoord: gl.getAttribLocation(program, "a_TexCoord"),
    a_Color: gl.getAttribLocation(program, "a_Color"),
    u_ModelMatrix: gl.getUniformLocation(program, "u_ModelMatrix"),
    u_ViewMatrix: gl.getUniformLocation(program, "u_ViewMatrix"),
    u_ProjectionMatrix: gl.getUniformLocation(program, "u_ProjectionMatrix"),
    u_Samplers: [
      gl.getUniformLocation(program, "u_Sampler0"),
      gl.getUniformLocation(program, "u_Sampler1"),
      gl.getUniformLocation(program, "u_Sampler2"),
      gl.getUniformLocation(program, "u_Sampler3"),
      gl.getUniformLocation(program, "u_Sampler4"),
      gl.getUniformLocation(program, "u_Sampler5"),
      gl.getUniformLocation(program, "u_Sampler6"),
      gl.getUniformLocation(program, "u_Sampler7"),
    ],
    u_BaseColor: gl.getUniformLocation(program, "u_BaseColor"),
    u_TexColorWeight: gl.getUniformLocation(program, "u_TexColorWeight"),
    u_TextureIndex: gl.getUniformLocation(program, "u_TextureIndex"),
  };

  initTextures(gl, locations, TEXTURE_SOURCES);

  const box = createMesh(gl, makeCube());
  const cloudPlane = createMesh(gl, makeCloudPlane());
  const signPlane = createMesh(gl, makeSignPlane());
  const terrainSections = createTerrainSections(gl);
  resizeCanvasToDisplaySize(gl, canvas);
  camera = new Camera(canvas);
  const cameraControls = setupCameraControls(canvas);
  wallBoxes = makeWallBoxes();

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.55, 0.86, 1.0, 1.0);

  let lastFrameTime = 0;
  let fpsFrameCount = 0;
  let fpsLastUpdate = 0;

  function render(now) {
    const time = now * 0.001;
    const deltaTime = lastFrameTime ? Math.min(time - lastFrameTime, 0.05) : 0;
    lastFrameTime = time;
    fpsFrameCount += 1;
    if (time - fpsLastUpdate >= 1) {
      setFps(Math.round(fpsFrameCount / (time - fpsLastUpdate)));
      fpsFrameCount = 0;
      fpsLastUpdate = time;
    }

    cameraControls.update(deltaTime);
    updateGameState(time);
    const allAnimalsCollected = countCollectedAnimals() === ANIMALS.length;
    resizeCanvasToDisplaySize(gl, canvas);
    camera.updateProjectionMatrix(canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(locations.u_ProjectionMatrix, false, camera.projectionMatrix.elements);
    gl.uniformMatrix4fv(locations.u_ViewMatrix, false, camera.viewMatrix.elements);

    gl.depthMask(false);
    drawMesh(gl, locations, box, {
      modelMatrix: makeSkyBoxModelMatrix(),
      baseColor: [0.55, 0.86, 1, 1],
      texColorWeight: 0,
      textureIndex: TEXTURE_SKY,
    });
    drawClouds(gl, locations, cloudPlane, time);
    gl.depthMask(true);

    drawGroundSections(gl, locations, terrainSections);

    drawSpawnSign(gl, locations, box, signPlane);

    for (const wallBox of wallBoxes) {
      drawMesh(gl, locations, box, {
        modelMatrix: multiply(translation(wallBox.x, wallBox.y, wallBox.z), scaling(0.5, 0.5, 0.5)),
        baseColor: wallBox.baseColor,
        texColorWeight: 1,
        textureIndex: wallBox.textureIndex,
      });
    }

    gl.depthMask(false);
    if (allAnimalsCollected) {
      drawGateBeacon(gl, locations, box, time);
      drawExitPortal(gl, locations, box, time);
    }
    gl.depthMask(true);

    for (const animal of ANIMALS) {
      if (animal.collected) continue;

      drawAnimal(gl, locations, box, animal, time);
    }

    if (allAnimalsCollected) {
      drawMesh(gl, locations, box, {
        modelMatrix: multiply(
          translation(EXIT_MARKER.col - MAP_CENTER_OFFSET, -0.35, EXIT_MARKER.row - MAP_CENTER_OFFSET),
          multiply(rotationY(time), scaling(0.28, gameWon ? 1.1 : 0.45, 0.28)),
        ),
        baseColor: gameWon ? [1, 0.9, 0.25, 1] : [0.1, 0.65, 1, 1],
        texColorWeight: 0,
        textureIndex: TEXTURE_SKY,
      });
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function setStatus(message) {
  if (hudMessage === message) return;
  hudMessage = message;
  statusEl.textContent = message;
}

function setFps(fps) {
  fpsEl.textContent = `FPS ${fps}`;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown program link error";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function createMesh(gl, data) {
  return {
    positionBuffer: makeArrayBuffer(gl, data.positions),
    texCoordBuffer: makeArrayBuffer(gl, data.texCoords),
    colorBuffer: makeArrayBuffer(gl, data.colors),
    indexBuffer: makeElementBuffer(gl, data.indices),
    indexCount: data.indices.length,
  };
}

function makeArrayBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  return buffer;
}

function makeElementBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
  return buffer;
}

function drawMesh(gl, locations, mesh, { modelMatrix, baseColor, texColorWeight, textureIndex }) {
  bindAttribute(gl, locations.a_Position, mesh.positionBuffer, 3);
  bindAttribute(gl, locations.a_TexCoord, mesh.texCoordBuffer, 2);
  bindAttribute(gl, locations.a_Color, mesh.colorBuffer, 3);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.uniformMatrix4fv(locations.u_ModelMatrix, false, modelMatrix);
  gl.uniform4fv(locations.u_BaseColor, new Float32Array(baseColor));
  gl.uniform1f(locations.u_TexColorWeight, texColorWeight);
  gl.uniform1i(locations.u_TextureIndex, textureIndex);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
}

function bindAttribute(gl, location, buffer, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function initTextures(gl, locations, sources) {
  return sources.map((src, textureUnit) => {
    const texture = createTexture(gl, locations, textureUnit);
    const image = new Image();

    image.addEventListener("load", () => {
      loadTexture(gl, texture, image, src, textureUnit);
    });
    image.addEventListener("error", () => console.warn(`Could not load texture: ${src}`));
    image.src = src;

    return texture;
  });
}

function createTexture(gl, locations, textureUnit) {
  const texture = gl.createTexture();

  if (!texture) {
    setStatus("Could not create texture object.");
    return null;
  }

  gl.activeTexture(gl.TEXTURE0 + textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(locations.u_Samplers[textureUnit], textureUnit);

  return texture;
}

function loadTexture(gl, texture, image, src, textureUnit) {
  const { naturalWidth: width, naturalHeight: height } = image;
  const isSquarePowerOfTwo = width === height && isPowerOfTwo(width);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.activeTexture(gl.TEXTURE0 + textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  if (isSquarePowerOfTwo) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  if (!isSquarePowerOfTwo) {
    console.warn(`Loaded ${src}, but expected square power-of-two size. Got ${width}x${height}.`);
  }
}

function isPowerOfTwo(value) {
  return (value & (value - 1)) === 0;
}

function makeCube() {
  const positions = [
    -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
    1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1,
    -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1,
    -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,
    -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
  ];

  const texCoords = [
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ];

  const colors = Array.from({ length: 24 }, () => [1, 1, 1]).flat();
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ];

  return { positions, texCoords, colors, indices };
}

function makeCloudPlane() {
  return {
    positions: [
      -1, 0, -1,
      1, 0, -1,
      1, 0, 1,
      -1, 0, 1,
    ],
    texCoords: [
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ],
    colors: Array.from({ length: 4 }, () => [1, 1, 1]).flat(),
    indices: [0, 1, 2, 0, 2, 3],
  };
}

function makeSignPlane() {
  return {
    positions: [
      -1, -1, 0,
      1, -1, 0,
      1, 1, 0,
      -1, 1, 0,
    ],
    texCoords: [
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ],
    colors: Array.from({ length: 4 }, () => [1, 1, 1]).flat(),
    indices: [0, 1, 2, 0, 2, 3],
  };
}

function makeWallBoxes() {
  const boxes = [];

  for (let row = 0; row < WORLD_MAP.length; row += 1) {
    for (let col = 0; col < WORLD_MAP[row].length; col += 1) {
      const mapHeight = WORLD_MAP[row][col];
      const height = themedWallHeight(mapHeight, row, col);

      for (let level = 0; level < height; level += 1) {
        boxes.push({
          x: col - MAP_CENTER_OFFSET,
          y: -0.5 + level,
          z: row - MAP_CENTER_OFFSET,
          textureIndex: textureForWallCell(row, col, level),
          baseColor: themeForCell(row, col).tint,
        });
      }
    }
  }

  return boxes;
}

function themedWallHeight(height, row, col) {
  if (height === 0) return 0;

  const theme = themeForCell(row, col).name;

  if (theme === "stone") return Math.min(MAX_EDIT_HEIGHT, height + 1);
  if (theme === "hedge") return Math.min(MAX_EDIT_HEIGHT, height + ((row + col) % 2));
  if (theme === "wood") return Math.max(1, height);
  return height;
}

function textureForWallCell(row, col, level) {
  const theme = themeForCell(row, col);

  if (theme.name === "stone") return TEXTURE_STONE;
  if (theme.name === "wood") return TEXTURE_WOOD;
  if (theme.name === "hedge") return TEXTURE_HEDGE;
  if ((row + col + level) % 8 === 0) return TEXTURE_STONE;
  return TEXTURE_BRICK;
}

function themeForCell(row, col) {
  if (row < WORLD_MAP_SIZE / 2 && col < WORLD_MAP_SIZE / 2) {
    return { name: "stone", tint: [0.92, 0.94, 1, 1] };
  }

  if (row < WORLD_MAP_SIZE / 2 && col >= WORLD_MAP_SIZE / 2) {
    return { name: "brick", tint: [1, 0.94, 0.9, 1] };
  }

  if (row >= WORLD_MAP_SIZE / 2 && col < WORLD_MAP_SIZE / 2) {
    return { name: "wood", tint: [1, 0.94, 0.86, 1] };
  }

  return { name: "hedge", tint: [0.9, 1, 0.9, 1] };
}

function createTerrainSections(gl) {
  const sections = [
    { minX: -16, maxX: 0, minZ: -16, maxZ: 0, color: [0.78, 0.82, 0.88, 1], weight: 0.82, textureIndex: TEXTURE_STONE },
    { minX: 0, maxX: 16, minZ: -16, maxZ: 0, color: [0.98, 0.72, 0.55, 1], weight: 0.68, textureIndex: TEXTURE_BRICK },
    { minX: -16, maxX: 0, minZ: 0, maxZ: 16, color: [0.76, 0.5, 0.28, 1], weight: 0.86, textureIndex: TEXTURE_WOOD },
    { minX: 0, maxX: 16, minZ: 0, maxZ: 16, color: [0.62, 0.9, 0.52, 1], weight: 0.9, textureIndex: TEXTURE_GRASS },
  ];

  return sections.map((section) => ({
    ...section,
    mesh: createMesh(gl, makeTerrainSection(section)),
  }));
}

function makeTerrainSection(section) {
  const positions = [];
  const texCoords = [];
  const colors = [];
  const indices = [];
  const steps = 16;
  const textureRepeats = 5;

  for (let zStep = 0; zStep <= steps; zStep += 1) {
    const zT = zStep / steps;
    const z = section.minZ + (section.maxZ - section.minZ) * zT;

    for (let xStep = 0; xStep <= steps; xStep += 1) {
      const xT = xStep / steps;
      const x = section.minX + (section.maxX - section.minX) * xT;

      positions.push(x, terrainHeightAt(x, z), z);
      texCoords.push(xT * textureRepeats, zT * textureRepeats);
      colors.push(1, 1, 1);
    }
  }

  for (let zStep = 0; zStep < steps; zStep += 1) {
    for (let xStep = 0; xStep < steps; xStep += 1) {
      const a = zStep * (steps + 1) + xStep;
      const b = a + 1;
      const c = a + steps + 1;
      const d = c + 1;

      indices.push(a, b, d, a, d, c);
    }
  }

  return { positions, texCoords, colors, indices };
}

function terrainHeightAt(x, z) {
  const rolling = Math.sin(x * 0.42) * 0.075 + Math.cos(z * 0.36) * 0.07;
  const diagonal = Math.sin((x + z) * 0.23) * 0.055;
  const smallDip = Math.cos((x - z) * 0.31) * 0.035;

  return -1.04 + rolling + diagonal + smallDip;
}

function drawGroundSections(gl, locations, terrainSections) {
  for (const section of terrainSections) {
    drawMesh(gl, locations, section.mesh, {
      modelMatrix: identity(),
      baseColor: section.color,
      texColorWeight: section.weight,
      textureIndex: section.textureIndex,
    });
  }
}

function drawSpawnSign(gl, locations, box, signPlane) {
  const x = 0;
  const z = -2.55;
  const yOffset = terrainHeightAt(x, z) + 1;
  const y = -0.28 + yOffset;

  drawMesh(gl, locations, box, {
    modelMatrix: multiply(translation(x, y, z - 0.06), scaling(0.58, 0.34, 0.04)),
    baseColor: WOOD_COLOR,
    texColorWeight: 0.9,
    textureIndex: TEXTURE_WOOD,
  });

  for (const postOffset of [-0.3, 0.3]) {
    drawMesh(gl, locations, box, {
      modelMatrix: multiply(translation(x + postOffset, -0.74 + yOffset, z - 0.09), scaling(0.04, 0.34, 0.04)),
      baseColor: WOOD_COLOR,
      texColorWeight: 0.9,
      textureIndex: TEXTURE_WOOD,
    });
  }

  drawMesh(gl, locations, signPlane, {
    modelMatrix: multiply(translation(x, y, z), scaling(0.52, 0.29, 1)),
    baseColor: [1, 1, 1, 1],
    texColorWeight: 1,
    textureIndex: TEXTURE_SIGN,
  });
}

function drawClouds(gl, locations, cloudPlane, time) {
  const eye = camera.eye.elements;
  const cloudPatches = [
    { x: -8.5, y: 7.0, z: -9.5, sx: 4.8, sz: 1.35, rot: 0.18, phase: 0 },
    { x: 0.5, y: 8.1, z: -12.0, sx: 5.8, sz: 1.6, rot: -0.1, phase: 1.9 },
    { x: 8.8, y: 7.3, z: -8.0, sx: 4.2, sz: 1.25, rot: 0.34, phase: 3.4 },
    { x: -3.5, y: 6.7, z: -4.5, sx: 3.4, sz: 1.0, rot: -0.28, phase: 5.1 },
  ];

  for (const cloud of cloudPatches) {
    const drift = Math.sin(time * 0.18 + cloud.phase) * 0.55;
    const rise = Math.sin(time * 0.24 + cloud.phase) * 0.08;

    drawMesh(gl, locations, cloudPlane, {
      modelMatrix: multiply(
        translation(eye[0] + cloud.x + drift, eye[1] + cloud.y + rise, eye[2] + cloud.z),
        multiply(rotationY(cloud.rot), scaling(cloud.sx, 0.018, cloud.sz)),
      ),
      baseColor: [1, 1, 1, 1],
      texColorWeight: 1,
      textureIndex: TEXTURE_CLOUDS,
    });
  }
}

function drawExitPortal(gl, locations, box, time) {
  const exitX = EXIT_MARKER.col - MAP_CENTER_OFFSET;
  const exitZ = EXIT_MARKER.row - MAP_CENTER_OFFSET;
  const active = countCollectedAnimals() === ANIMALS.length;
  const radius = active ? 0.72 : 0.46;
  const portalColor = active ? [1, 0.85, 0.22, 0.82] : [0.1, 0.7, 1, 0.5];

  for (let segment = 0; segment < 8; segment += 1) {
    const angle = time * (active ? 1.6 : 0.65) + segment * ((Math.PI * 2) / 8);
    const x = exitX + Math.cos(angle) * radius;
    const z = exitZ + Math.sin(angle) * radius;
    const y = -0.24 + segment * 0.08;

    drawMesh(gl, locations, box, {
      modelMatrix: multiply(
        translation(x, y, z),
        multiply(rotationY(angle), scaling(0.06, active ? 0.46 : 0.28, 0.06)),
      ),
      baseColor: portalColor,
      texColorWeight: 0,
      textureIndex: TEXTURE_SKY,
    });
  }
}

function drawGateBeacon(gl, locations, box, time) {
  const exitX = EXIT_MARKER.col - MAP_CENTER_OFFSET;
  const exitZ = EXIT_MARKER.row - MAP_CENTER_OFFSET;
  const baseY = terrainHeightAt(exitX, exitZ) + 0.25;
  const beamHalfHeight = 48;
  const pulse = (Math.sin(time * 3.4) + 1) * 0.035;
  const layers = [
    { radius: 0.14 + pulse, alpha: 0.52 },
    { radius: 0.34 + pulse, alpha: 0.2 },
    { radius: 0.62 + pulse, alpha: 0.08 },
  ];

  for (const layer of layers) {
    drawMesh(gl, locations, box, {
      modelMatrix: multiply(
        translation(exitX, baseY + beamHalfHeight, exitZ),
        scaling(layer.radius, beamHalfHeight, layer.radius),
      ),
      baseColor: [1, 0.78, 0.08, layer.alpha],
      texColorWeight: 0,
      textureIndex: TEXTURE_SKY,
    });
  }
}

function drawAnimal(gl, locations, box, animal, time) {
  const bob = Math.sin(time * 2.2 + animal.row) * 0.025;
  const facing = Math.sin(time * 0.85 + animal.col) * 0.08;

  drawAnimalPart(gl, locations, box, animal, facing, 0, -0.82 + bob, 0, 0.27, 0.16, 0.16, animal.color);
  drawAnimalPart(gl, locations, box, animal, facing, 0, -0.68 + bob, -0.2, 0.15, 0.13, 0.12, animal.color);

  if (animal.kind === "cat") {
    drawAnimalPart(gl, locations, box, animal, facing, -0.09, -0.5 + bob, -0.24, 0.045, 0.07, 0.035, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, 0.09, -0.5 + bob, -0.24, 0.045, 0.07, 0.035, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, 0, -0.74 + bob, 0.24, 0.035, 0.04, 0.18, animal.accent);
  } else if (animal.kind === "dog") {
    drawAnimalPart(gl, locations, box, animal, facing, -0.13, -0.68 + bob, -0.2, 0.045, 0.12, 0.035, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, 0.13, -0.68 + bob, -0.2, 0.045, 0.12, 0.035, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, 0, -0.74 + bob, 0.25, 0.04, 0.04, 0.17, animal.accent);
  } else if (animal.kind === "pig") {
    drawAnimalPart(gl, locations, box, animal, facing, 0, -0.68 + bob, -0.33, 0.08, 0.055, 0.035, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, -0.11, -0.5 + bob, -0.2, 0.04, 0.055, 0.035, animal.color);
    drawAnimalPart(gl, locations, box, animal, facing, 0.11, -0.5 + bob, -0.2, 0.04, 0.055, 0.035, animal.color);
  } else if (animal.kind === "cow") {
    drawAnimalPart(gl, locations, box, animal, facing, -0.13, -0.76 + bob, -0.02, 0.075, 0.09, 0.025, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, 0.12, -0.85 + bob, 0.08, 0.08, 0.07, 0.025, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, -0.07, -0.54 + bob, -0.25, 0.035, 0.055, 0.025, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, 0.07, -0.54 + bob, -0.25, 0.035, 0.055, 0.025, animal.accent);
  } else if (animal.kind === "sheep") {
    drawAnimalPart(gl, locations, box, animal, facing, 0, -0.66 + bob, -0.25, 0.11, 0.1, 0.09, animal.accent);
    drawAnimalPart(gl, locations, box, animal, facing, -0.18, -0.64 + bob, 0, 0.08, 0.13, 0.11, animal.color);
    drawAnimalPart(gl, locations, box, animal, facing, 0.18, -0.64 + bob, 0, 0.08, 0.13, 0.11, animal.color);
  }

  for (const legX of [-0.17, 0.17]) {
    for (const legZ of [-0.09, 0.1]) {
      drawAnimalPart(gl, locations, box, animal, facing, legX, -1 + bob, legZ, 0.04, 0.09, 0.04, animal.accent);
    }
  }
}

function drawAnimalPart(gl, locations, box, animal, facing, x, y, z, sx, sy, sz, color) {
  const yOffset = terrainHeightAt(animal.x, animal.z) + 1;

  drawMesh(gl, locations, box, {
    modelMatrix: multiply(
      translation(animal.x, 0, animal.z),
      multiply(rotationY(facing), multiply(translation(x, y + yOffset, z), scaling(sx, sy, sz))),
    ),
    baseColor: color,
    texColorWeight: 0,
    textureIndex: TEXTURE_BRICK,
  });
}

function makeAnimal(kind, row, col, color, accent) {
  return {
    kind,
    row,
    col,
    x: col - MAP_CENTER_OFFSET,
    z: row - MAP_CENTER_OFFSET,
    color,
    accent,
    collected: false,
  };
}

function updateGameState(time) {
  const eye = camera.eye.elements;

  for (const animal of ANIMALS) {
    if (animal.collected) continue;

    if (distance2D(eye[0], eye[2], animal.x, animal.z) < COLLECT_DISTANCE) {
      animal.collected = true;
      const collectedCount = countCollectedAnimals();
      showHudMessage(animalProgressText(), time, collectedCount === ANIMALS.length ? 2.8 : 1.8);
    }
  }

  const allAnimalsCollected = countCollectedAnimals() === ANIMALS.length;
  const exitX = EXIT_MARKER.col - MAP_CENTER_OFFSET;
  const exitZ = EXIT_MARKER.row - MAP_CENTER_OFFSET;

  if (!gameWon && allAnimalsCollected && distance2D(eye[0], eye[2], exitX, exitZ) < 1.4) {
    gameWon = true;
    showHudMessage(gameStatusText(), time, 999);
  }

  if (time >= hudOverrideUntil) {
    setStatus(gameStatusText());
  }
}

function countCollectedAnimals() {
  return ANIMALS.filter((animal) => animal.collected).length;
}

function animalProgressText() {
  const collectedCount = countCollectedAnimals();

  if (collectedCount === ANIMALS.length) {
    return `Animals ${collectedCount}/${ANIMALS.length} - All animals found. Follow golden beam to deliver animals.`;
  }

  return `Animals ${collectedCount}/${ANIMALS.length}`;
}

function gameStatusText() {
  return gameWon ? MISSION_COMPLETE_TEXT : animalProgressText();
}

function distance2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function showHudMessage(message, time, duration) {
  hudOverrideUntil = time + duration;
  setStatus(message);
}

function editBlockInFront(delta) {
  const cell = getMapCellInFront();

  if (!cell) {
    showHudMessage("No editable map cell in front of camera.", performance.now() * 0.001, 1.4);
    return;
  }

  const currentHeight = WORLD_MAP[cell.row][cell.col];
  const nextHeight = Math.min(MAX_EDIT_HEIGHT, Math.max(0, currentHeight + delta));

  if (nextHeight === currentHeight) {
    showHudMessage(`Block stack already ${delta > 0 ? "maxed" : "empty"} at (${cell.col}, ${cell.row}).`, performance.now() * 0.001, 1.4);
    return;
  }

  WORLD_MAP[cell.row][cell.col] = nextHeight;
  wallBoxes = makeWallBoxes();
  showHudMessage(`${delta > 0 ? "Added" : "Deleted"} block at (${cell.col}, ${cell.row}); height ${nextHeight}.`, performance.now() * 0.001, 1.4);
}

function getMapCellInFront() {
  const eye = camera.eye.elements;
  const at = camera.at.elements;
  const forwardX = at[0] - eye[0];
  const forwardZ = at[2] - eye[2];
  const length = Math.hypot(forwardX, forwardZ);

  if (length === 0) return null;

  const targetDistance = 2;
  const targetX = eye[0] + (forwardX / length) * targetDistance;
  const targetZ = eye[2] + (forwardZ / length) * targetDistance;
  const col = Math.round(targetX + MAP_CENTER_OFFSET);
  const row = Math.round(targetZ + MAP_CENTER_OFFSET);

  if (row < 0 || row >= WORLD_MAP_SIZE || col < 0 || col >= WORLD_MAP_SIZE) {
    return null;
  }

  return { row, col };
}

function mapRow(pattern) {
  const row = pattern.replaceAll(" ", "").split("").map(Number);

  if (row.length !== WORLD_MAP_SIZE) {
    throw new Error(`Map row has ${row.length} cells instead of ${WORLD_MAP_SIZE}.`);
  }

  if (row.some(Number.isNaN)) {
    throw new Error("Map rows can only contain numeric wall heights.");
  }

  return row;
}

function makeSkyBoxModelMatrix() {
  const eye = camera.eye.elements;
  return multiply(translation(eye[0], eye[1], eye[2]), scaling(500, 500, 500));
}

function setupCameraControls(target) {
  const keys = new Set();
  const state = { dragging: false, lastX: 0, lastY: 0, jumpHeight: 0, jumpVelocity: 0 };

  window.addEventListener("keydown", (event) => {
    if (isCameraKey(event.code)) {
      event.preventDefault();
      keys.add(event.code);

      if (!event.repeat) {
        handleCameraKey(event.code, state);
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  target.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    target.setPointerCapture(event.pointerId);
  });

  target.addEventListener("pointermove", (event) => onMove(event, state));

  target.addEventListener("pointerup", (event) => {
    state.dragging = false;
    target.releasePointerCapture(event.pointerId);
  });

  target.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.deltaY < 0) moveCameraWithCollision(() => camera.moveForward(0.35));
    if (event.deltaY > 0) moveCameraWithCollision(() => camera.moveBackwards(0.35));
  }, { passive: false });

  return {
    update(deltaTime) {
      const moveSpeed = 3.2;
      const moveStep = moveSpeed * deltaTime;
      const turnStep = 90 * deltaTime;

      if (keys.has("KeyQ") || keys.has("ArrowLeft")) camera.panLeft(turnStep);
      if (keys.has("KeyE") || keys.has("ArrowRight")) camera.panRight(turnStep);
      if (keys.has("PageUp")) camera.panUp(turnStep);
      if (keys.has("PageDown")) camera.panDown(turnStep);
      if (keys.has("KeyW") || keys.has("ArrowUp")) moveCameraWithCollision(() => camera.moveForward(moveStep));
      if (keys.has("KeyS") || keys.has("ArrowDown")) moveCameraWithCollision(() => camera.moveBackwards(moveStep));
      if (keys.has("KeyA")) moveCameraWithCollision(() => camera.moveLeft(moveStep));
      if (keys.has("KeyD")) moveCameraWithCollision(() => camera.moveRight(moveStep));
      updateJump(state, deltaTime);
    },
  };
}

function onMove(event, state) {
  if (!state.dragging) return;

  const dx = event.clientX - state.lastX;
  const dy = event.clientY - state.lastY;
  state.lastX = event.clientX;
  state.lastY = event.clientY;

  if (dx < 0) camera.panLeft(Math.abs(dx) * 0.2);
  if (dx > 0) camera.panRight(dx * 0.2);
  if (dy < 0) camera.panUp(Math.abs(dy) * 0.16);
  if (dy > 0) camera.panDown(dy * 0.16);
}

function handleCameraKey(code, state) {
  if (code === "KeyW" || code === "ArrowUp") moveCameraWithCollision(() => camera.moveForward());
  if (code === "KeyS" || code === "ArrowDown") moveCameraWithCollision(() => camera.moveBackwards());
  if (code === "KeyA") moveCameraWithCollision(() => camera.moveLeft());
  if (code === "KeyD") moveCameraWithCollision(() => camera.moveRight());
  if (code === "KeyQ" || code === "ArrowLeft") camera.panLeft();
  if (code === "KeyE" || code === "ArrowRight") camera.panRight();
  if (code === "PageUp") camera.panUp();
  if (code === "PageDown") camera.panDown();
  if (code === "Space") startJump(state);
  if (code === "KeyF") editBlockInFront(1);
  if (code === "KeyR") editBlockInFront(-1);
}

function isCameraKey(code) {
  return [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyQ",
    "KeyE",
    "KeyF",
    "KeyR",
    "Space",
    "PageUp",
    "PageDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
  ].includes(code);
}

function startJump(state) {
  if (state.jumpHeight > 0.02) return;

  state.jumpVelocity = JUMP_SPEED;
}

function updateJump(state, deltaTime) {
  if (state.jumpVelocity === 0 && state.jumpHeight === 0) return;

  const previousHeight = state.jumpHeight;
  state.jumpVelocity -= JUMP_GRAVITY * deltaTime;
  state.jumpHeight += state.jumpVelocity * deltaTime;

  if (state.jumpHeight <= 0) {
    state.jumpHeight = 0;
    state.jumpVelocity = 0;
  }

  camera.moveBy(0, state.jumpHeight - previousHeight, 0);
}

function moveCameraWithCollision(moveCamera) {
  const oldEye = Array.from(camera.eye.elements);
  const oldAt = Array.from(camera.at.elements);

  moveCamera();

  const newEye = Array.from(camera.eye.elements);
  const dx = newEye[0] - oldEye[0];
  const dz = newEye[2] - oldEye[2];

  if (!isCameraBlockedAt(newEye[0], newEye[2])) {
    return;
  }

  restoreCameraPose(oldEye, oldAt);

  if (dx !== 0 && !isCameraBlockedAt(oldEye[0] + dx, oldEye[2])) {
    camera.moveBy(dx, 0, 0);
  }

  if (dz !== 0 && !isCameraBlockedAt(camera.eye.elements[0], oldEye[2] + dz)) {
    camera.moveBy(0, 0, dz);
  }
}

function restoreCameraPose(eye, at) {
  camera.eye.elements.set(eye);
  camera.at.elements.set(at);
  camera.updateViewMatrix();
}

function isCameraBlockedAt(x, z) {
  const radius = CAMERA_RADIUS;
  const probes = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
    [radius, radius],
    [radius, -radius],
    [-radius, radius],
    [-radius, -radius],
  ];

  return probes.some(([offsetX, offsetZ]) => isWallAt(x + offsetX, z + offsetZ));
}

function isWallAt(x, z) {
  const cell = worldToMapCell(x, z);

  if (!cell) return true;

  return WORLD_MAP[cell.row][cell.col] > 0;
}

function worldToMapCell(x, z) {
  const col = Math.floor(x + MAP_CENTER_OFFSET + 0.5);
  const row = Math.floor(z + MAP_CENTER_OFFSET + 0.5);

  if (row < 0 || row >= WORLD_MAP_SIZE || col < 0 || col >= WORLD_MAP_SIZE) {
    return null;
  }

  return { row, col };
}

function resizeCanvasToDisplaySize(gl, target) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(target.clientWidth * dpr));
  const height = Math.max(1, Math.floor(target.clientHeight * dpr));

  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
}

function identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function multiply(a, b) {
  const out = new Float32Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }

  return out;
}

function translation(x, y, z) {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function scaling(x, y, z) {
  const out = identity();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function rotationX(radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);

  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
}

function rotationY(radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);

  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}
