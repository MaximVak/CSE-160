// asg1.js

// Vertex shader
var VSHADER_SOURCE =
    'attribute vec4 a_Position;\n' +
    'void main() {\n' +
    '  gl_Position = a_Position;\n' +
    '  gl_PointSize = 10.0;\n' +
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
var a_Position, u_Color;
var shapes = [];          // stores every drawn shape
var currentBrush = 'square';
var isMouseDown = false;
var pictureDrawn = false;

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

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Mouse events
    canvas.addEventListener('mousedown', function (ev) {
        isMouseDown = true;
        addShape(ev);
    });
    canvas.addEventListener('mousemove', function (ev) {
        if (isMouseDown) addShape(ev);
    });
    canvas.addEventListener('mouseup', function () { isMouseDown = false; });
    canvas.addEventListener('mouseleave', function () { isMouseDown = false; });
}

// ── Convert mouse coords → WebGL clip space ──────────────────────────────────
function getWebGLCoords(ev) {
    var rect = canvas.getBoundingClientRect();
    var x = ((ev.clientX - rect.left) / canvas.width) * 2 - 1;
    var y = ((ev.clientY - rect.top) / canvas.height) * -2 + 1;
    return { x: x, y: y };
}

// ── Add a shape at mouse position ─────────────────────────────────────────────
function addShape(ev) {
    var pos = getWebGLCoords(ev);
    shapes.push({
        type: currentBrush,
        x: pos.x,
        y: pos.y,
        r: parseInt(document.getElementById('sliderR').value) / 255,
        g: parseInt(document.getElementById('sliderG').value) / 255,
        b: parseInt(document.getElementById('sliderB').value) / 255,
        a: parseInt(document.getElementById('sliderA').value) / 255,
        size: parseInt(document.getElementById('sliderSize').value),
        segments: parseInt(document.getElementById('sliderSegments').value)
    });
    render();
}

// ── Render all shapes ─────────────────────────────────────────────────────────
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (pictureDrawn) drawPictureShapes();  // picture first (bottom layer)
    for (var i = 0; i < shapes.length; i++) {  // user shapes on top
        var s = shapes[i];
        gl.uniform4f(u_Color, s.r, s.g, s.b, s.a);
        if (s.type === 'square') drawSquare(s);
        else if (s.type === 'triangle') drawTriangle(s);
        else if (s.type === 'circle') drawCircle(s);
    }
}

// ── Draw a square (two triangles) ─────────────────────────────────────────────
function drawSquare(s) {
    var hw = s.size / canvas.width;
    var hh = s.size / canvas.height;
    var verts = new Float32Array([
        s.x - hw, s.y + hh,   // top-left
        s.x + hw, s.y + hh,   // top-right
        s.x - hw, s.y - hh,   // bottom-left
        s.x + hw, s.y - hh    // bottom-right
    ]);
    sendBuffer(verts);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ── Draw an equilateral triangle ──────────────────────────────────────────────
function drawTriangle(s) {
    var hw = s.size / canvas.width;
    var hh = s.size / canvas.height;
    var verts = new Float32Array([
        s.x, s.y + hh * 1.2,   // top
        s.x - hw, s.y - hh * 0.8,   // bottom-left
        s.x + hw, s.y - hh * 0.8    // bottom-right
    ]);
    sendBuffer(verts);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ── Draw a circle (triangle fan) ──────────────────────────────────────────────
function drawCircle(s) {
    var segs = s.segments;
    var rx = s.size / canvas.width;
    var ry = s.size / canvas.height;
    var verts = new Float32Array((segs + 2) * 2);
    verts[0] = s.x;
    verts[1] = s.y;
    for (var j = 0; j <= segs; j++) {
        var angle = (j / segs) * Math.PI * 2;
        verts[(j + 1) * 2] = s.x + rx * Math.cos(angle);
        verts[(j + 1) * 2 + 1] = s.y + ry * Math.sin(angle);
    }
    sendBuffer(verts);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, segs + 2);
}

// ── Upload vertex buffer ──────────────────────────────────────────────────────
function sendBuffer(verts) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
}

// ── UI callbacks ──────────────────────────────────────────────────────────────
function setBrush(type) {
    currentBrush = type;
}

function clearCanvas() {
    shapes = [];
    pictureDrawn = false;
    gl.clear(gl.COLOR_BUFFER_BIT);
}

//Draw Picture with Triangles:
function drawPicture() {
    pictureDrawn = true;
    render();
}
function drawPictureShapes() {
    // RED HULL - nose cone (upside-down V)
    // Paper: (0,9)(-3,5)(3,5)
    gl.uniform4f(u_Color, 0.85, 0.1, 0.1, 1.0);
    drawHardcodedTriangle(0.0, 0.9, -0.3, 0.5, 0.3, 0.5);

    // GREY inner nose tip (small bright triangle inside red)
    gl.uniform4f(u_Color, 0.6, 0.6, 0.6, 1.0);
    drawHardcodedTriangle(-.15, .5, 0, 0.75, .15, .5);

    // GREY LEFT body (left arm of M)
    // Paper: (-3,-3)(-3,5)(0,5)
    gl.uniform4f(u_Color, 0.6, 0.6, 0.6, 1.0);
    drawHardcodedTriangle(-0.3, -0.3, -0.3, 0.5, 0.0, 0.5);

    // GREY RIGHT body (right arm of M)
    // Paper: (3,-3)(3,5)(0,5)
    gl.uniform4f(u_Color, 0.6, 0.6, 0.6, 1.0);
    drawHardcodedTriangle(0.3, -0.3, 0.3, 0.5, 0.0, 0.5);

    // DARK GREY main body center fill
    // Paper: (-3,-3)(0,5)(3,-3)
    gl.uniform4f(u_Color, 0.4, 0.4, 0.4, 1.0);
    drawHardcodedTriangle(-0.3, -0.3, 0.0, 0.5, 0.3, -0.3);

    // RED left fin
    gl.uniform4f(u_Color, 0.8, 0.1, 0.1, 1.0);
    drawHardcodedTriangle(-0.3, -0.1, -0.55, -0.45, -0.3, -0.45);

    // RED right fin
    gl.uniform4f(u_Color, 0.8, 0.1, 0.1, 1.0);
    drawHardcodedTriangle(0.3, -0.1, 0.55, -0.45, 0.3, -0.45);

    // RED Door
    gl.uniform4f(u_Color, 0.8, 0.1, 0.1, 1.0);
    drawHardcodedTriangle(-0.1, 0.2, -0.1, -0.3, 0, 0.2);
    drawHardcodedTriangle(0.1, 0.2, 0.1, -0.3, 0, 0.2);
    drawHardcodedTriangle(-0.1, -0.3, 0.1, -0.3, 0, 0.2);

    // ORANGE outer flames
    gl.uniform4f(u_Color, 1.0, 0.4, 0.0, 1.0);
    drawHardcodedTriangle(-0.3, -0.3, -0.1, -0.3, -0.22, -0.78);
    drawHardcodedTriangle(0.1, -0.3, 0.3, -0.3, 0.22, -0.78);
    drawHardcodedTriangle(-0.11, -0.3, 0.11, -0.3, 0.0, -0.68);

    // YELLOW inner flames
    gl.uniform4f(u_Color, 1.0, 0.88, 0.0, 1.0);
    drawHardcodedTriangle(-0.26, -0.3, -0.14, -0.3, -0.21, -0.6);
    drawHardcodedTriangle(0.14, -0.3, 0.26, -0.3, 0.21, -0.6);
    drawHardcodedTriangle(-0.07, -0.3, 0.07, -0.3, 0.0, -0.56);


    // WHITE window (6 triangles from your notes)
    gl.uniform4f(u_Color, 1, 1, 1, 1);
    // Paper window coords scaled /10:
    // (0.5,6.5)(-0.5,6.5)(0,5.75) → (0.05,0.65)(-0.05,0.65)(0,0.575)
    drawHardcodedTriangle(0.05, 0.65, -0.05, 0.65, 0.0, 0.575); // top mid
    // (-0.5,5)(0.5,5)(0,5.75) → (-0.05,0.5)(0.05,0.5)(0,0.575)
    drawHardcodedTriangle(-0.05, 0.5, -0.1, 0.575, 0.0, 0.575);//bottom left
    drawHardcodedTriangle(0.05, 0.5, 0.1, 0.575, 0.0, 0.575); //bottom right

    gl.uniform4f(u_Color, 1, 0, 0, 1.0);
    // (-0.5,5)(-1,5.75)(0,5.75) → (-0.05,0.5)(-0.1,0.575)(0,0.575)
    drawHardcodedTriangle(-0.1, 0.575, -0.05, 0.65, 0.0, 0.575); //top left
    // (1,5.75)(0.5,6.5)(0,5.75) → (0.1,0.575)(0.05,0.65)(0,0.575)
    drawHardcodedTriangle(0.1, 0.575, 0.05, 0.65, 0.0, 0.575); //top right
    // (0.5,5)(1,5.75)(0,5.75) → (0.05,0.5)(0.1,0.575)(0,0.575)

    drawHardcodedTriangle(-0.05, 0.5, 0.05, 0.5, 0.0, 0.575);  // bottom mid

    //White Moon
    gl.uniform4f(u_Color, 1, 1, 1, 1);
    drawHardcodedTriangle(0.6, 0.6, 0.8, 0.6, 0.8, 0.7);
    drawHardcodedTriangle(0.6, 0.8, 0.8, 0.8, 0.8, 0.7);
    drawHardcodedTriangle(0.75, 0.65, 0.75, 0.75, 0.8, 0.7);

    // WHITE tiny triangle stars (smaller, randomly rotated)
    gl.uniform4f(u_Color, 1, 1, 1, 1);

    // Top left - tilted right
    drawHardcodedTriangle(-0.8, 0.8, -0.785, 0.815, -0.77, 0.8);

    // Top middle-left - tilted left
    drawHardcodedTriangle(-0.5, 0.7, -0.515, 0.715, -0.5, 0.7);
    drawHardcodedTriangle(-0.5, 0.7, -0.515, 0.715, -0.485, 0.7);

    // Top right - pointing down-right
    drawHardcodedTriangle(0.5, 0.9, 0.508, 0.915, 0.516, 0.9);

    // Far right middle - tilted up-left
    drawHardcodedTriangle(0.75, 0.3, 0.758, 0.312, 0.742, 0.308);

    // Bottom right - pointing left
    drawHardcodedTriangle(0.6, -0.5, 0.615, -0.492, 0.615, -0.508);

    // Bottom left - tilted up-right
    drawHardcodedTriangle(-0.7, -0.6, -0.688, -0.592, -0.692, -0.608);

    // Far left middle - pointing down
    drawHardcodedTriangle(-0.85, 0.1, -0.842, 0.1, -0.858, 0.115);

    // Bottom middle-right - tilted left
    drawHardcodedTriangle(0.4, -0.75, 0.408, -0.738, 0.392, -0.742);

    // Upper far left - tilted down-right
    drawHardcodedTriangle(-0.9, 0.5, -0.885, 0.508, -0.888, 0.492);

    // Upper middle - pointing left
    drawHardcodedTriangle(-0.2, 0.85, -0.208, 0.858, -0.208, 0.842);

    // Right side upper - tilted down-left
    drawHardcodedTriangle(0.82, 0.65, 0.808, 0.658, 0.812, 0.642);

    // Lower far left - pointing up-right
    drawHardcodedTriangle(-0.88, -0.3, -0.872, -0.292, -0.868, -0.308);

    // Lower middle-left - tilted right
    drawHardcodedTriangle(-0.45, -0.7, -0.438, -0.692, -0.435, -0.708);

}

function drawHardcodedTriangle(x1, y1, x2, y2, x3, y3) {
    var verts = new Float32Array([x1, y1, x2, y2, x3, y3]);
    sendBuffer(verts);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}