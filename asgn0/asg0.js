function drawVector(v, color) {
    var canvas = document.getElementById('example');
    var ctx = canvas.getContext('2d');

    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + v.elements[0] * 20, centerY - v.elements[1] * 20);
    ctx.stroke();
}

function handleDrawEvent() {
    var canvas = document.getElementById('example');
    var ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var v1 = new Vector3([
        parseFloat(document.getElementById('v1x').value),
        parseFloat(document.getElementById('v1y').value),
        0
    ]);
    drawVector(v1, "red");

    var v2 = new Vector3([
        parseFloat(document.getElementById('v2x').value),
        parseFloat(document.getElementById('v2y').value),
        0
    ]);
    drawVector(v2, "blue");
}

function handleDrawOperationEvent() {
    var canvas = document.getElementById('example');
    var ctx = canvas.getContext('2d');

    // 1. Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw v1 in red
    var v1 = new Vector3([
        parseFloat(document.getElementById('v1x').value),
        parseFloat(document.getElementById('v1y').value),
        0
    ]);
    drawVector(v1, "red");

    // 3. Draw v2 in blue
    var v2 = new Vector3([
        parseFloat(document.getElementById('v2x').value),
        parseFloat(document.getElementById('v2y').value),
        0
    ]);
    drawVector(v2, "blue");

    // 4. Perform the selected operation
    var op = document.getElementById('operation').value;
    var s = parseFloat(document.getElementById('scalar').value);

    if (op === 'add') {
        var v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
        v3.add(v2);
        drawVector(v3, "green");

    } else if (op === 'sub') {
        var v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
        v3.sub(v2);
        drawVector(v3, "green");

    } else if (op === 'mul') {
        var v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
        v3.mul(s);
        drawVector(v3, "green");

        var v4 = new Vector3([v2.elements[0], v2.elements[1], 0]);
        v4.mul(s);
        drawVector(v4, "green");

    } else if (op === 'div') {
        var v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
        v3.div(s);
        drawVector(v3, "green");

        var v4 = new Vector3([v2.elements[0], v2.elements[1], 0]);
        v4.div(s);
        drawVector(v4, "green");


    } else if (op === 'magnitude') {
        // Print magnitudes to console
        console.log("Magnitude v1: " + v1.magnitude());
        console.log("Magnitude v2: " + v2.magnitude());

    } else if (op === 'normalize') {
        var v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
        v3.normalize();
        drawVector(v3, "green");

        var v4 = new Vector3([v2.elements[0], v2.elements[1], 0]);
        v4.normalize();
        drawVector(v4, "green");

    } else if (op === 'angle') {
        var angle = angleBetween(v1, v2);
        console.log("Angle: " + angle);

    } else if (op === 'area') {
        var area = areaTriangle(v1, v2);
        console.log("Area of the triangle: " + area);
    }
}

function angleBetween(v1, v2) {
    var dot = Vector3.dot(v1, v2);
    var mag1 = v1.magnitude();
    var mag2 = v2.magnitude();

    // cos(alpha) = dot(v1,v2) / (||v1|| * ||v2||)
    var cosAlpha = dot / (mag1 * mag2);

    // Clamp to [-1, 1] to avoid floating point errors with Math.acos
    cosAlpha = Math.max(-1, Math.min(1, cosAlpha));

    // Convert from radians to degrees
    var angleRad = Math.acos(cosAlpha);
    var angleDeg = angleRad * (180 / Math.PI);

    return angleDeg;
}

function areaTriangle(v1, v2) {
    var cross = Vector3.cross(v1, v2);
    // Area of triangle = half the magnitude of the cross product
    return cross.magnitude() / 2;
}

function main() {
    var canvas = document.getElementById('example');
    if (!canvas) {
        console.log('Failed to retrieve the <canvas> element');
        return;
    }

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var v1 = new Vector3([2.25, 2.25, 0]);
    drawVector(v1, "red");
}