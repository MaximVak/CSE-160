export class Vector3 {
  constructor(elements = [0, 0, 0]) {
    this.elements = new Float32Array(elements);
  }

  set(vector) {
    this.elements.set(vector.elements);
    return this;
  }

  add(vector) {
    this.elements[0] += vector.elements[0];
    this.elements[1] += vector.elements[1];
    this.elements[2] += vector.elements[2];
    return this;
  }

  sub(vector) {
    this.elements[0] -= vector.elements[0];
    this.elements[1] -= vector.elements[1];
    this.elements[2] -= vector.elements[2];
    return this;
  }

  mul(scalar) {
    this.elements[0] *= scalar;
    this.elements[1] *= scalar;
    this.elements[2] *= scalar;
    return this;
  }

  normalize() {
    const [x, y, z] = this.elements;
    const length = Math.hypot(x, y, z) || 1;
    return this.mul(1 / length);
  }

  static cross(a, b) {
    const ae = a.elements;
    const be = b.elements;

    return new Vector3([
      ae[1] * be[2] - ae[2] * be[1],
      ae[2] * be[0] - ae[0] * be[2],
      ae[0] * be[1] - ae[1] * be[0],
    ]);
  }
}

export class Matrix4 {
  constructor() {
    this.elements = new Float32Array(16);
    this.setIdentity();
  }

  setIdentity() {
    const e = this.elements;
    e[0] = 1;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;
    e[4] = 0;
    e[5] = 1;
    e[6] = 0;
    e[7] = 0;
    e[8] = 0;
    e[9] = 0;
    e[10] = 1;
    e[11] = 0;
    e[12] = 0;
    e[13] = 0;
    e[14] = 0;
    e[15] = 1;
    return this;
  }

  setLookAt(ex, ey, ez, ax, ay, az, ux, uy, uz) {
    let fx = ax - ex;
    let fy = ay - ey;
    let fz = az - ez;
    let length = Math.hypot(fx, fy, fz) || 1;
    fx /= length;
    fy /= length;
    fz /= length;

    let sx = fy * uz - fz * uy;
    let sy = fz * ux - fx * uz;
    let sz = fx * uy - fy * ux;
    length = Math.hypot(sx, sy, sz) || 1;
    sx /= length;
    sy /= length;
    sz /= length;

    const ux2 = sy * fz - sz * fy;
    const uy2 = sz * fx - sx * fz;
    const uz2 = sx * fy - sy * fx;

    const e = this.elements;
    e[0] = sx;
    e[1] = ux2;
    e[2] = -fx;
    e[3] = 0;
    e[4] = sy;
    e[5] = uy2;
    e[6] = -fy;
    e[7] = 0;
    e[8] = sz;
    e[9] = uz2;
    e[10] = -fz;
    e[11] = 0;
    e[12] = -(sx * ex + sy * ey + sz * ez);
    e[13] = -(ux2 * ex + uy2 * ey + uz2 * ez);
    e[14] = fx * ex + fy * ey + fz * ez;
    e[15] = 1;
    return this;
  }

  setPerspective(fov, aspect, near, far) {
    const f = 1 / Math.tan((Math.PI * fov) / 360);
    const nf = 1 / (near - far);
    const e = this.elements;

    e[0] = f / aspect;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;
    e[4] = 0;
    e[5] = f;
    e[6] = 0;
    e[7] = 0;
    e[8] = 0;
    e[9] = 0;
    e[10] = (far + near) * nf;
    e[11] = -1;
    e[12] = 0;
    e[13] = 0;
    e[14] = 2 * far * near * nf;
    e[15] = 0;
    return this;
  }

  setRotate(angle, x, y, z) {
    const radians = (Math.PI * angle) / 180;
    const s = Math.sin(radians);
    const c = Math.cos(radians);
    const nc = 1 - c;
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    const e = this.elements;

    e[0] = nx * nx * nc + c;
    e[1] = ny * nx * nc + nz * s;
    e[2] = nz * nx * nc - ny * s;
    e[3] = 0;
    e[4] = nx * ny * nc - nz * s;
    e[5] = ny * ny * nc + c;
    e[6] = nz * ny * nc + nx * s;
    e[7] = 0;
    e[8] = nx * nz * nc + ny * s;
    e[9] = ny * nz * nc - nx * s;
    e[10] = nz * nz * nc + c;
    e[11] = 0;
    e[12] = 0;
    e[13] = 0;
    e[14] = 0;
    e[15] = 1;
    return this;
  }

  multiplyVector3(vector) {
    const e = this.elements;
    const v = vector.elements;

    return new Vector3([
      e[0] * v[0] + e[4] * v[1] + e[8] * v[2],
      e[1] * v[0] + e[5] * v[1] + e[9] * v[2],
      e[2] * v[0] + e[6] * v[1] + e[10] * v[2],
    ]);
  }
}

export class Camera {
  constructor(canvas) {
    this.fov = 60;
    this.eye = new Vector3([0, 0, 0]);
    this.at = new Vector3([0, 0, -1]);
    this.up = new Vector3([0, 1, 0]);
    this.speed = 0.2;
    this.alpha = 5;
    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();

    this.updateViewMatrix();
    this.updateProjectionMatrix(canvas);
  }

  updateViewMatrix() {
    const e = this.eye.elements;
    const a = this.at.elements;
    const u = this.up.elements;

    this.viewMatrix.setLookAt(e[0], e[1], e[2], a[0], a[1], a[2], u[0], u[1], u[2]);
  }

  updateProjectionMatrix(canvas) {
    const aspect = canvas.height === 0 ? 1 : canvas.width / canvas.height;
    this.projectionMatrix.setPerspective(this.fov, aspect, 0.1, 1000);
  }

  moveForward(speed = this.speed) {
    const f = this.horizontalForward();
    f.mul(speed);
    this.eye.add(f);
    this.at.add(f);
    this.updateViewMatrix();
  }

  moveBackwards(speed = this.speed) {
    const b = this.horizontalForward();
    b.mul(-1);
    b.mul(speed);
    this.eye.add(b);
    this.at.add(b);
    this.updateViewMatrix();
  }

  moveLeft(speed = this.speed) {
    const f = this.horizontalForward();
    const s = Vector3.cross(this.up, f);
    s.normalize();
    s.mul(speed);
    this.eye.add(s);
    this.at.add(s);
    this.updateViewMatrix();
  }

  moveRight(speed = this.speed) {
    const f = this.horizontalForward();
    const s = Vector3.cross(f, this.up);
    s.normalize();
    s.mul(speed);
    this.eye.add(s);
    this.at.add(s);
    this.updateViewMatrix();
  }

  panLeft(alpha = this.alpha) {
    this.pan(alpha);
  }

  panRight(alpha = this.alpha) {
    this.pan(-alpha);
  }

  panUp(alpha = this.alpha) {
    this.pitch(alpha);
  }

  panDown(alpha = this.alpha) {
    this.pitch(-alpha);
  }

  pan(alpha) {
    const f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    const u = this.up.elements;
    const rotationMatrix = new Matrix4();
    rotationMatrix.setRotate(alpha, u[0], u[1], u[2]);
    const fPrime = rotationMatrix.multiplyVector3(f);
    this.at.set(this.eye);
    this.at.add(fPrime);
    this.updateViewMatrix();
  }

  pitch(alpha) {
    const f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    const right = Vector3.cross(f, this.up);
    right.normalize();

    const r = right.elements;
    const rotationMatrix = new Matrix4();
    rotationMatrix.setRotate(alpha, r[0], r[1], r[2]);
    const fPrime = rotationMatrix.multiplyVector3(f);
    const elements = fPrime.elements;
    const length = Math.hypot(elements[0], elements[1], elements[2]) || 1;
    const pitchRatio = Math.max(-1, Math.min(1, elements[1] / length));
    const pitchDegrees = (Math.asin(pitchRatio) * 180) / Math.PI;

    if (pitchDegrees < -65 || pitchDegrees > 72) {
      return;
    }

    this.at.set(this.eye);
    this.at.add(fPrime);
    this.updateViewMatrix();
  }

  moveBy(x, y, z) {
    const offset = new Vector3([x, y, z]);
    this.eye.add(offset);
    this.at.add(offset);
    this.updateViewMatrix();
  }

  horizontalForward() {
    const f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0;

    if (Math.hypot(f.elements[0], f.elements[2]) < 0.0001) {
      f.elements[2] = -1;
    }

    return f.normalize();
  }
}
