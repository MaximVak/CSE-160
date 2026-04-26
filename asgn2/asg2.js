// asg2.js

// Vertex shader
var VSHADER_SOURCE =
    'attribute vec4 a_Position;\n' +
    'uniform mat4 u_GlobalRotation;\n' +
    'uniform mat4 u_ModelMatrix;\n' +
    'void main() {\n' +
    '  gl_Position = u_GlobalRotation * u_ModelMatrix * a_Position;\n' +
    '}\n';

// Fragment shader
var FSHADER_SOURCE =
    'precision mediump float;\n' +
    'uniform vec4 u_Color;\n' +
    'void main() {\n' +
    '  gl_FragColor = u_Color;\n' +
    '}\n';

// ── Global state ─────────────────────────────────────────────────────────────
var gl, canvas;
var a_Position, u_Color, u_ModelMatrix;
var isMouseDown = false;
var gAnimalGlobalRotation = 0;
var u_GlobalRotation;
var gFrontLegAngle = 0;
var gBackLegAngle = 0;
var gTailAngle = 0;
var gFrontLowerLegAngle = 0;
var gBackLowerLegAngle = 0;
var g_time = 0;
var gAnimation = false;
var gBodyBob = 0;
var gFrontPawAngle = 0;
var gBackPawAngle = 0;

var gMouseDown = false;
var gLastMouseX = 0;
var gLastMouseY = 0;
var gRotX = 0;
var gRotY = 0;

var gPoke = false;
var gPokeTime = 0;

// ── Init ─────────────────────────────────────────────────────────────────────
function main() {
    canvas = document.getElementById('webgl');

    gl = getWebGLContext(canvas);
    if (!gl) { console.log('Failed to get WebGL context'); return; }

    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to initialize shaders'); return;
    }

    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    u_Color = gl.getUniformLocation(gl.program, 'u_Color');
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_GlobalRotation = gl.getUniformLocation(gl.program, 'u_GlobalRotation');



    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //gl.enable(gl.BLEND);
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    canvas.addEventListener('mousedown', function (ev) { isMouseDown = true; addShape(ev); });
    canvas.addEventListener('mousemove', function (ev) { if (isMouseDown) addShape(ev); });
    canvas.addEventListener('mouseup', function () { isMouseDown = false; });
    canvas.addEventListener('mouseleave', function () { isMouseDown = false; });

    tick(); // replaces renderScene()

    canvas.addEventListener('mousedown', function (ev) {
        if (ev.shiftKey) {
            gPoke = true;
            gPokeTime = g_time;
        } else {
            gMouseDown = true;
            gLastMouseX = ev.clientX;
            gLastMouseY = ev.clientY;
        }
    });
    canvas.addEventListener('mousemove', function (ev) {
        if (!gMouseDown) return;
        var dx = ev.clientX - gLastMouseX;
        var dy = ev.clientY - gLastMouseY;
        gRotY -= dx * 0.5;
        gRotX -= dy * 0.5;
        gLastMouseX = ev.clientX;
        gLastMouseY = ev.clientY;
        renderScene();
    });
    canvas.addEventListener('mouseup', function () { gMouseDown = false; });
    canvas.addEventListener('mouseleave', function () { gMouseDown = false; });
}

function updateRotation(val) {
    gAnimalGlobalRotation = parseFloat(val);
    renderScene();
}

function updateFrontLeg(val) {
    gFrontLegAngle = parseFloat(val);
    renderScene();
}
function updateBackLeg(val) {
    gBackLegAngle = parseFloat(val);
    renderScene();
}
function updateTail(val) {
    gTailAngle = parseFloat(val);
    renderScene();
}

function updateFrontLowerLeg(val) {
    gFrontLowerLegAngle = parseFloat(val);
    renderScene();
}

function updateBackLowerLeg(val) {
    gBackLowerLegAngle = parseFloat(val);
    renderScene();
}

var gLastTime = 0;
function tick() {
    var now = performance.now();
    var elapsed = now - gLastTime;
    gLastTime = now;
    var fps = Math.round(1000 / elapsed);
    document.getElementById('fps').innerText = fps;

    g_time = now / 1000;
    updateAnimationAngles();
    renderScene();
    requestAnimationFrame(tick);
}

function toggleAnimation() {
    gAnimation = !gAnimation;
}

function updateAnimationAngles() {
    if (gPoke) {
        var elapsed = g_time - gPokeTime;
        // dog jump and wag tail like crazy!
        gTailAngle = 60 * Math.sin(elapsed * 15);
        gFrontLegAngle = 40 * Math.sin(elapsed * 10);
        gBackLegAngle = 40 * Math.sin(elapsed * 10 + Math.PI);
        gFrontLowerLegAngle = 30 * Math.sin(elapsed * 10);
        gBackLowerLegAngle = 30 * Math.sin(elapsed * 10);
        gBodyBob = 0.05 * Math.abs(Math.sin(elapsed * 8));
        if (elapsed > 3.0) gPoke = false; // stop after 3 seconds
        return;
    }
    if (gAnimation) {
        gFrontLegAngle = 30 * Math.sin(g_time * 3);
        gBackLegAngle = 30 * Math.sin(g_time * 3 + Math.PI);
        gFrontLowerLegAngle = 20 * Math.sin(g_time * 3 + Math.PI / 2);
        gBackLowerLegAngle = 20 * Math.sin(g_time * 3 + Math.PI / 2);
        gTailAngle = 30 * Math.sin(g_time * 6);
        gBodyBob = 0.02 * Math.sin(g_time * 6);
        gFrontPawAngle = 15 * Math.sin(g_time * 3 + Math.PI);
        gBackPawAngle = 15 * Math.sin(g_time * 3 + Math.PI);
    }
}

function updateFrontPaw(val) {
    gFrontPawAngle = parseFloat(val);
    renderScene();
}

function updateBackPaw(val) {
    gBackPawAngle = parseFloat(val);
    renderScene();
}

function renderScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var globalRot = new Matrix4();
    globalRot.setRotate(gAnimalGlobalRotation, 0, 1, 0);
    globalRot.rotate(gRotX, 1, 0, 0); // up/down
    globalRot.rotate(gRotY, 0, 1, 0); // left/right
    gl.uniformMatrix4fv(u_GlobalRotation, false, globalRot.elements);

    var M = new Matrix4();

    // BODY
    gl.uniform4f(u_Color, 0.6, 0.4, 0.2, 1.0);
    M = new Matrix4();
    M.setTranslate(0.0, gBodyBob, 0.0);
    M.scale(0.5, 0.3, 0.8);
    drawCube({ size: 50 }, M);

    // HEAD - sphere now!
    gl.uniform4f(u_Color, 0.6, 0.4, 0.2, 1.0);
    M = new Matrix4();
    M.setTranslate(0.0, 0.25 + gBodyBob, 0.5);
    M.scale(1, 1, 1);
    drawSphere(M, 0.18);

    // LEFT EYE
    gl.uniform4f(u_Color, 0.0, 0.0, 0.0, 1.0); // black
    M = new Matrix4();
    M.setTranslate(-0.08, 0.28 + gBodyBob, 0.66);
    M.scale(0.04, 0.04, 0.04);
    drawCube({ size: 50 }, M);

    // RIGHT EYE
    gl.uniform4f(u_Color, 0.0, 0.0, 0.0, 1.0); // black
    M = new Matrix4();
    M.setTranslate(0.08, 0.28 + gBodyBob, 0.66);
    M.scale(0.04, 0.04, 0.04);
    drawCube({ size: 50 }, M);

    // NOSE
    gl.uniform4f(u_Color, 0.1, 0.1, 0.1, 1.0); // dark
    M = new Matrix4();
    M.setTranslate(0.0, 0.22 + gBodyBob, 0.74);
    M.scale(0.05, 0.04, 0.04);
    drawCube({ size: 50 }, M);

    // LEFT EAR - floppy down
    gl.uniform4f(u_Color, 0.5, 0.3, 0.1, 1.0);
    M = new Matrix4();
    M.setTranslate(-0.2, 0.28 + gBodyBob, 0.5);
    M.rotate(-20, 0, 0, 1); // tilt outward
    M.scale(0.06, 0.18, 0.05);
    drawCube({ size: 50 }, M);

    // RIGHT EAR - floppy down
    gl.uniform4f(u_Color, 0.5, 0.3, 0.1, 1.0);
    M = new Matrix4();
    M.setTranslate(0.2, 0.28 + gBodyBob, 0.5);
    M.rotate(20, 0, 0, 1); // tilt outward other side
    M.scale(0.06, 0.18, 0.05);
    drawCube({ size: 50 }, M);

    // SNOUT
    gl.uniform4f(u_Color, 0.7, 0.5, 0.3, 1.0);
    M = new Matrix4();
    M.setTranslate(0.0, 0.18 + gBodyBob, 0.68);
    M.scale(0.18, 0.15, 0.15);
    drawCube({ size: 50 }, M);

    // TAIL
    gl.uniform4f(u_Color, 0.6, 0.4, 0.2, 1.0);
    M = new Matrix4();
    M.setTranslate(0.0, 0.2 + gBodyBob, -0.38);
    M.rotate(gTailAngle, 1, 0, 0);
    M.scale(0.08, 0.25, 0.08);
    drawCube({ size: 50 }, M);

    // FRONT LEFT UPPER LEG
    gl.uniform4f(u_Color, 0.55, 0.35, 0.15, 1.0);
    var upperLegL = new Matrix4();
    upperLegL.setTranslate(-0.22, -0.2, 0.3);
    upperLegL.rotate(gFrontLegAngle, 1, 0, 0);
    M = new Matrix4(upperLegL); // copy
    M.scale(0.1, 0.25, 0.1);
    drawCube({ size: 50 }, M);

    // FRONT RIGHT UPPER LEG
    gl.uniform4f(u_Color, 0.55, 0.35, 0.15, 1.0);
    var upperLegR = new Matrix4();
    upperLegR.setTranslate(0.22, -0.2, 0.3);
    upperLegR.rotate(gFrontLegAngle, 1, 0, 0);
    M = new Matrix4(upperLegR);
    M.scale(0.1, 0.25, 0.1);
    drawCube({ size: 50 }, M);

    // BACK LEFT UPPER LEG
    gl.uniform4f(u_Color, 0.55, 0.35, 0.15, 1.0);
    var upperBackLegL = new Matrix4();
    upperBackLegL.setTranslate(-0.22, -0.2, -0.3);
    upperBackLegL.rotate(gBackLegAngle, 1, 0, 0);
    M = new Matrix4(upperBackLegL);
    M.scale(0.1, 0.25, 0.1);
    drawCube({ size: 50 }, M);

    // BACK RIGHT UPPER LEG
    gl.uniform4f(u_Color, 0.55, 0.35, 0.15, 1.0);
    var upperBackLegR = new Matrix4();
    upperBackLegR.setTranslate(0.22, -0.2, -0.3);
    upperBackLegR.rotate(gBackLegAngle, 1, 0, 0);
    M = new Matrix4(upperBackLegR);
    M.scale(0.1, 0.25, 0.1);
    drawCube({ size: 50 }, M);

    // FRONT LEFT LOWER LEG
    gl.uniform4f(u_Color, 0.5, 0.3, 0.1, 1.0);
    var lowerLegL = new Matrix4(upperLegL);
    lowerLegL.translate(0.0, -0.22, 0.0);
    lowerLegL.rotate(gFrontLowerLegAngle, 1, 0, 0);
    M = new Matrix4(lowerLegL);
    M.scale(0.08, 0.2, 0.08);
    drawCube({ size: 50 }, M);

    // FRONT LEFT PAW - inherits lower leg!
    gl.uniform4f(u_Color, 0.4, 0.25, 0.1, 1.0);
    M = new Matrix4(lowerLegL);
    M.translate(0.0, -0.14, 0.0);
    M.rotate(gFrontPawAngle, 1, 0, 0);
    M.scale(0.1, 0.08, 0.12);
    drawCube({ size: 50 }, M);

    // FRONT RIGHT LOWER LEG
    gl.uniform4f(u_Color, 0.5, 0.3, 0.1, 1.0);
    var lowerLegR = new Matrix4(upperLegR);
    lowerLegR.translate(0.0, -0.22, 0.0);
    lowerLegR.rotate(gFrontLowerLegAngle, 1, 0, 0);
    M = new Matrix4(lowerLegR);
    M.scale(0.08, 0.2, 0.08);
    drawCube({ size: 50 }, M);

    // FRONT RIGHT PAW - inherits lower leg!
    gl.uniform4f(u_Color, 0.4, 0.25, 0.1, 1.0);
    M = new Matrix4(lowerLegR);
    M.translate(0.0, -0.14, 0.0);
    M.rotate(gFrontPawAngle, 1, 0, 0);
    M.scale(0.1, 0.08, 0.12);
    drawCube({ size: 50 }, M);

    // BACK LEFT LOWER LEG
    gl.uniform4f(u_Color, 0.5, 0.3, 0.1, 1.0);
    var lowerBackLegL = new Matrix4(upperBackLegL);
    lowerBackLegL.translate(0.0, -0.22, 0.0);
    lowerBackLegL.rotate(gBackLowerLegAngle, 1, 0, 0);
    M = new Matrix4(lowerBackLegL);
    M.scale(0.08, 0.2, 0.08);
    drawCube({ size: 50 }, M);

    // BACK LEFT PAW
    gl.uniform4f(u_Color, 0.4, 0.25, 0.1, 1.0);
    M = new Matrix4(lowerBackLegL);
    M.translate(0.0, -0.14, 0.0);
    M.rotate(gBackPawAngle, 1, 0, 0);
    M.scale(0.1, 0.08, 0.12);
    drawCube({ size: 50 }, M);

    // BACK RIGHT LOWER LEG
    gl.uniform4f(u_Color, 0.5, 0.3, 0.1, 1.0);
    var lowerBackLegR = new Matrix4(upperBackLegR);
    lowerBackLegR.translate(0.0, -0.22, 0.0);
    lowerBackLegR.rotate(gBackLowerLegAngle, 1, 0, 0);
    M = new Matrix4(lowerBackLegR);
    M.scale(0.08, 0.2, 0.08);
    drawCube({ size: 50 }, M);

    // BACK RIGHT PAW
    gl.uniform4f(u_Color, 0.4, 0.25, 0.1, 1.0);
    M = new Matrix4(lowerBackLegR);
    M.translate(0.0, -0.14, 0.0);
    M.rotate(gBackPawAngle, 1, 0, 0);
    M.scale(0.1, 0.08, 0.12);
    drawCube({ size: 50 }, M);
}