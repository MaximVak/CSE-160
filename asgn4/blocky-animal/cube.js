function drawCube(s, M) {
    // Send matrix to shader
    gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);

    var d = s.size / 100;
    var verts = new Float32Array([
        // Front
        -d, -d, d, d, -d, d, d, d, d,
        -d, -d, d, d, d, d, -d, d, d,
        // Back
        -d, -d, -d, -d, d, -d, d, d, -d,
        -d, -d, -d, d, d, -d, d, -d, -d,
        // Top
        -d, d, -d, -d, d, d, d, d, d,
        -d, d, -d, d, d, d, d, d, -d,
        // Bottom
        -d, -d, -d, d, -d, -d, d, -d, d,
        -d, -d, -d, d, -d, d, -d, -d, d,
        // Right
        d, -d, -d, d, d, -d, d, d, d,
        d, -d, -d, d, d, d, d, -d, d,
        // Left
        -d, -d, -d, -d, -d, d, -d, d, d,
        -d, -d, -d, -d, d, d, -d, d, -d,
    ]);

    sendBuffer3D(verts);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function sendBuffer3D(verts) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
}