function drawSphere(M, radius) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);

    var latBands = 12;
    var lonBands = 12;
    var verts = [];

    for (var lat = 0; lat <= latBands; lat++) {
        var theta = (lat / latBands) * Math.PI;
        for (var lon = 0; lon <= lonBands; lon++) {
            var phi = (lon / lonBands) * 2 * Math.PI;
            var x = radius * Math.sin(theta) * Math.cos(phi);
            var y = radius * Math.cos(theta);
            var z = radius * Math.sin(theta) * Math.sin(phi);
            verts.push(x, y, z);
        }
    }

    var indices = [];
    for (var lat = 0; lat < latBands; lat++) {
        for (var lon = 0; lon < lonBands; lon++) {
            var first = lat * (lonBands + 1) + lon;
            var second = first + lonBands + 1;
            // triangle 1
            indices.push(first, second, first + 1);
            // triangle 2
            indices.push(second, second + 1, first + 1);
        }
    }

    // flatten using indices
    var finalVerts = [];
    for (var i = 0; i < indices.length; i++) {
        var idx = indices[i];
        finalVerts.push(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]);
    }

    var vertsArray = new Float32Array(finalVerts);
    sendBuffer3D(vertsArray);
    gl.drawArrays(gl.TRIANGLES, 0, finalVerts.length / 3);
}