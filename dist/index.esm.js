import { jsxs as ae, jsx as $ } from "react/jsx-runtime";
import { useRef as b, useMemo as ee, useCallback as T, useEffect as se } from "react";
const ce = `
attribute vec2 a_position;
attribute float a_size;
attribute float a_opacity;
attribute float a_seed;
attribute float a_rotation;

uniform vec2 u_resolution;

varying float v_opacity;
varying float v_seed;
varying float v_rotation;
varying float v_size;

void main() {
  // Convert pixel coordinates to clip space (-1 to 1)
  vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
  clipSpace.y *= -1.0; // Flip Y axis
  
  gl_Position = vec4(clipSpace, 0.0, 1.0);
  gl_PointSize = a_size;
  v_opacity = a_opacity;
  v_seed = a_seed;
  v_rotation = a_rotation;
  v_size = a_size;
}
`, le = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif

uniform vec3 u_color;
uniform float u_roughness;
uniform float u_layer; // 0 = back (dots), 1 = mid, 2 = front (polygons)
uniform float u_isMobile; // 1.0 for mobile, 0.0 for desktop

varying float v_opacity;
varying float v_seed;
varying float v_rotation;
varying float v_size;

// Hash function matching the randomness pattern
float hash(float n) {
  return fract(sin(n * 12.9898) * 43758.5453123);
}

// Rotate a 2D point
vec2 rotate2D(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Get vertex position for polygon (matching Canvas createIrregularShape logic)
vec2 getVertex(int i, int numPoints, float seed) {
  float fi = float(i);
  float fn = float(numPoints);
  float angle = (fi / fn) * 6.28318530718; // 2 * PI
  
  // Generate per-vertex random variance using seed + vertex index
  float randomVal = hash(seed + fi * 7.31);
  float variance = 1.0 + (randomVal - 0.5) * u_roughness;
  
  return vec2(cos(angle) * 0.38 * variance, sin(angle) * 0.38 * variance);
}

// Check if point is inside polygon using ray casting
bool pointInPolygon(vec2 p, int numPoints, float seed) {
  int crossings = 0;
  
  for (int i = 0; i < 8; i++) {
    if (i >= numPoints) break;
    
    int nextI = i + 1;
    if (nextI >= numPoints) nextI = 0;
    
    vec2 v1 = getVertex(i, numPoints, seed);
    vec2 v2 = getVertex(nextI, numPoints, seed);
    
    if (((v1.y > p.y) != (v2.y > p.y)) &&
        (p.x < (v2.x - v1.x) * (p.y - v1.y) / (v2.y - v1.y) + v1.x)) {
      crossings++;
    }
  }
  
  return mod(float(crossings), 2.0) > 0.5;
}

// Calculate distance to polygon edge for soft edges
float distToPolygonEdge(vec2 p, int numPoints, float seed) {
  float minDist = 1.0;
  
  for (int i = 0; i < 8; i++) {
    if (i >= numPoints) break;
    
    int nextI = i + 1;
    if (nextI >= numPoints) nextI = 0;
    
    vec2 v1 = getVertex(i, numPoints, seed);
    vec2 v2 = getVertex(nextI, numPoints, seed);
    
    vec2 edge = v2 - v1;
    float t = clamp(dot(p - v1, edge) / dot(edge, edge), 0.0, 1.0);
    vec2 closest = v1 + t * edge;
    float dist = length(p - closest);
    minDist = min(minDist, dist);
  }
  
  return minDist;
}

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  // Back layer (u_layer == 0): Always use smooth dots for performance
  // These are far away, so detail isn't visible anyway
  if (u_layer < 0.5) {
    // Soft circular shape with gentle falloff
    float alpha = 1.0 - smoothstep(0.25, 0.5, dist);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(u_color, alpha * v_opacity);
    return;
  }
  
  // Mobile devices: use simpler irregular shapes (distorted circles)
  // This avoids the complex polygon ray-casting that fails on some mobile GPUs
  if (u_isMobile > 0.5) {
    // Create irregular shape by varying the radius based on angle
    float angle = atan(coord.y, coord.x);
    float irregularity = 0.0;
    
    // Add multiple harmonics for irregular shape (like a bumpy circle)
    irregularity += sin(angle * 5.0 + v_seed) * 0.08 * u_roughness;
    irregularity += sin(angle * 7.0 + v_seed * 2.3) * 0.05 * u_roughness;
    irregularity += sin(angle * 3.0 + v_seed * 0.7) * 0.06 * u_roughness;
    
    float threshold = 0.35 + irregularity;
    float alpha = 1.0 - smoothstep(threshold - 0.05, threshold + 0.05, dist);
    
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(u_color, alpha * v_opacity);
    return;
  }
  
  // Desktop: Use polygon shapes for visible detail
  // But still use circles for very small particles
  if (v_size < 6.0) {
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(u_color, alpha * v_opacity);
    return;
  }
  
  // Polygon rendering for larger mid/front particles (desktop only)
  vec2 rotatedCoord = rotate2D(coord, v_rotation);
  
  int numPoints = 5 + int(hash(v_seed * 3.7) * 4.0);
  
  bool inside = pointInPolygon(rotatedCoord, numPoints, v_seed);
  
  if (!inside) {
    discard;
  }
  
  float edgeDist = distToPolygonEdge(rotatedCoord, numPoints, v_seed);
  float alpha = smoothstep(0.0, 0.04, edgeDist);
  
  gl_FragColor = vec4(u_color, alpha * v_opacity);
}
`;
function te(r, n, u) {
  const s = r.createShader(n);
  return s ? (r.shaderSource(s, u), r.compileShader(s), r.getShaderParameter(s, r.COMPILE_STATUS) ? s : (console.error("Shader compile error:", r.getShaderInfoLog(s)), r.deleteShader(s), null)) : null;
}
function ue(r) {
  const n = te(r, r.VERTEX_SHADER, ce), u = te(r, r.FRAGMENT_SHADER, le);
  if (!n || !u) return null;
  const s = r.createProgram();
  return s ? (r.attachShader(s, n), r.attachShader(s, u), r.linkProgram(s), r.getProgramParameter(s, r.LINK_STATUS) ? s : (console.error("Program link error:", r.getProgramInfoLog(s)), r.deleteProgram(s), null)) : null;
}
function fe() {
  if (typeof window > "u" || typeof navigator > "u") return !1;
  const r = "ontouchstart" in window || navigator.maxTouchPoints > 0, n = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), u = window.innerWidth <= 768;
  return r && (n || u);
}
function j(r) {
  const n = r.getContext("webgl", {
    alpha: !0,
    premultipliedAlpha: !1,
    antialias: !0
  });
  if (!n) return null;
  const u = ue(n);
  if (!u) return null;
  const s = n.getAttribLocation(u, "a_position"), C = n.getAttribLocation(u, "a_size"), _ = n.getAttribLocation(u, "a_opacity"), R = n.getAttribLocation(u, "a_seed"), x = n.getAttribLocation(u, "a_rotation"), B = n.getUniformLocation(u, "u_resolution"), e = n.getUniformLocation(u, "u_color"), I = n.getUniformLocation(u, "u_roughness"), a = n.getUniformLocation(u, "u_layer"), A = n.getUniformLocation(u, "u_isMobile");
  if (!B || !e || !I || !a || !A) return null;
  const M = n.createBuffer(), P = n.createBuffer(), F = n.createBuffer(), m = n.createBuffer(), L = n.createBuffer();
  if (!M || !P || !F || !m || !L) return null;
  const p = fe();
  return {
    gl: n,
    program: u,
    positionBuffer: M,
    sizeBuffer: P,
    opacityBuffer: F,
    seedBuffer: m,
    rotationBuffer: L,
    isMobile: p,
    locations: {
      position: s,
      size: C,
      opacity: _,
      seed: R,
      rotation: x,
      resolution: B,
      color: e,
      roughness: I,
      layer: a,
      isMobile: A
    }
  };
}
function de(r) {
  const n = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(r);
  return n ? [
    parseInt(n[1], 16) / 255,
    parseInt(n[2], 16) / 255,
    parseInt(n[3], 16) / 255
  ] : [1, 1, 1];
}
function K(r, n, u, s, C, _, R, x, B) {
  const { gl: e, program: I, locations: a } = r;
  if (n.length === 0) return;
  e.viewport(0, 0, u, s), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.SRC_ALPHA, e.ONE_MINUS_SRC_ALPHA), e.useProgram(I), e.uniform2f(a.resolution, u, s);
  const [A, M, P] = de(C);
  e.uniform3f(a.color, A, M, P), e.uniform1f(a.roughness, x), e.uniform1f(a.layer, B), e.uniform1f(a.isMobile, r.isMobile ? 1 : 0);
  const F = new Float32Array(n.length * 2), m = new Float32Array(n.length), L = new Float32Array(n.length), p = new Float32Array(n.length), g = new Float32Array(n.length);
  for (let y = 0; y < n.length; y++) {
    const d = n[y];
    if (F[y * 2] = d.x, F[y * 2 + 1] = d.y, r.isMobile) {
      const E = d.radius < 1 ? 3 : d.radius < 1.5 ? 2.5 : 2;
      m[y] = Math.max(2, d.radius * E);
    } else {
      const E = d.radius < 1 ? 5.5 : d.radius < 1.5 ? 4.5 : 3.5;
      m[y] = Math.max(5, d.radius * E);
    }
    const D = r.isMobile ? d.radius < 1 ? 1.5 : d.radius < 1.5 ? 1.3 : 1.1 : d.radius < 1 ? 2.2 : d.radius < 1.5 ? 1.8 : 1.4;
    L[y] = Math.min(1, d.opacity * R * _ * D), p[y] = d.shapeSeed, g[y] = Math.sin(d.wobble);
  }
  e.bindBuffer(e.ARRAY_BUFFER, r.positionBuffer), e.bufferData(e.ARRAY_BUFFER, F, e.DYNAMIC_DRAW), e.enableVertexAttribArray(a.position), e.vertexAttribPointer(a.position, 2, e.FLOAT, !1, 0, 0), e.bindBuffer(e.ARRAY_BUFFER, r.sizeBuffer), e.bufferData(e.ARRAY_BUFFER, m, e.DYNAMIC_DRAW), e.enableVertexAttribArray(a.size), e.vertexAttribPointer(a.size, 1, e.FLOAT, !1, 0, 0), e.bindBuffer(e.ARRAY_BUFFER, r.opacityBuffer), e.bufferData(e.ARRAY_BUFFER, L, e.DYNAMIC_DRAW), e.enableVertexAttribArray(a.opacity), e.vertexAttribPointer(a.opacity, 1, e.FLOAT, !1, 0, 0), e.bindBuffer(e.ARRAY_BUFFER, r.seedBuffer), e.bufferData(e.ARRAY_BUFFER, p, e.DYNAMIC_DRAW), e.enableVertexAttribArray(a.seed), e.vertexAttribPointer(a.seed, 1, e.FLOAT, !1, 0, 0), e.bindBuffer(e.ARRAY_BUFFER, r.rotationBuffer), e.bufferData(e.ARRAY_BUFFER, g, e.DYNAMIC_DRAW), e.enableVertexAttribArray(a.rotation), e.vertexAttribPointer(a.rotation, 1, e.FLOAT, !1, 0, 0), e.drawArrays(e.POINTS, 0, n.length);
}
function he() {
  try {
    const r = document.createElement("canvas");
    return !!(r.getContext("webgl") || r.getContext("experimental-webgl"));
  } catch {
    return !1;
  }
}
const me = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none"
}, re = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  display: "block"
}, be = ({
  density: r = 1200,
  speed: n = 1.2,
  wind: u = 0.2,
  color: s = "#ffffff",
  minRadius: C = 0.2,
  maxRadius: _ = 2.3,
  roughness: R = 0.9,
  opacity: x = 1,
  renderer: B = "auto",
  className: e = "",
  style: I
}) => {
  const a = b(null), A = b(null), M = b(null), P = b(null), F = b(0), m = b({ back: null, mid: null, front: null }), L = ee(() => he(), []), p = ee(() => B === "canvas" ? !1 : L, [B, L]), g = b({ back: [], mid: [], front: [] }), y = b({
    time: 0,
    gustTime: 0,
    gustStrength: 0,
    gustDirection: 1
  }), d = b({ width: 0, height: 0 }), D = b(null), E = b(!1), k = b(null), z = b(null), U = T(() => {
    if (typeof window > "u" || typeof navigator > "u") return !1;
    const o = "ontouchstart" in window || navigator.maxTouchPoints > 0, i = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), h = window.innerWidth <= 768;
    return o && (i || h);
  }, []), W = (o, i) => Math.random() * (i - o) + o, O = T(() => {
    U() && (E.current = !0, k.current && clearTimeout(k.current), k.current = setTimeout(() => {
      E.current = !1;
    }, 150));
  }, [U]), X = T((o) => {
    const i = y.current;
    i.time += 0.016;
    const h = Math.sin(i.time * 0.05) * 0.7, c = Math.sin(i.time * 0.15) * 0.3, f = Math.sin(i.time * 0.8) * 0.1;
    i.gustTime -= 0.016, i.gustTime <= 0 && Math.random() < 5e-4 && (i.gustStrength = 0.5 + Math.random() * 1.5, i.gustDirection = Math.random() > 0.5 ? 1 : -1, i.gustTime = 2 + Math.random() * 3);
    const t = i.gustTime > 0 ? Math.sin(i.gustTime / 3 * Math.PI) * i.gustStrength * i.gustDirection : 0, l = 1 + h + c + f + t;
    return o * l;
  }, []), J = T((o, i) => {
    const h = 5 + Math.floor(Math.random() * 4), c = [];
    for (let f = 0; f < h; f++) {
      const t = f / h * Math.PI * 2, l = 1 + (Math.random() - 0.5) * i;
      c.push({
        x: Math.cos(t) * o * l,
        y: Math.sin(t) * o * l
      });
    }
    return c;
  }, []), N = T((o, i, h, c, f, t) => {
    const l = [];
    for (let v = 0; v < h; v++) {
      const S = W(c, f);
      let q = 0.1 + (S - c) / (f - c || 1) * 0.7 + (Math.random() * 0.6 - 0.3);
      q = Math.max(0.1, Math.min(1, q));
      const oe = S / 2.5 * t, ie = W(0.85, 1.15), Z = Math.max(0.5, S / 2.5);
      l.push({
        x: Math.random() * o,
        y: Math.random() * i,
        radius: S,
        opacity: q,
        vx: W(-0.1, 0.1) * Z,
        // Scale drift with size 
        vy: oe * ie,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: W(5e-3, 0.03),
        swayAmplitude: W(0.3, 0.8) * Z,
        // Scale sway with size
        shapeOffsets: J(S, R),
        shapeSeed: Math.random() * 1e3
        // Stable seed for WebGL shape
      });
    }
    return l;
  }, [R, J]), Q = T((o, i) => {
    g.current.back = N(
      o,
      i,
      Math.floor(r * 0.8),
      C * 0.5,
      _ * 0.6,
      0.6
      // Speed multiplier (Slow)
    ), g.current.mid = N(
      o,
      i,
      Math.floor(r * 0.5),
      C,
      _,
      1
      // Speed multiplier (Normal)
    );
    const h = N(
      o,
      i,
      Math.max(5, Math.floor(r * 0.1)),
      Math.max(_, 2),
      // Start at max of mid layer
      _ * 1.8,
      1.4
      // Speed multiplier (Fast)
    ), c = N(
      o,
      i,
      Math.max(2, Math.floor(r * 4e-3)),
      // Very few (e.g., 2-4 flakes)
      _ * 3.5,
      // 3.5x to 5.5x larger than normal max
      _ * 5.5,
      2
      // Very fast (Reduced from 2.5)
    );
    g.current.front = [...h, ...c];
  }, [r, C, _, N]), Y = T((o, i, h, c, f) => {
    o.forEach((t) => {
      t.wobble += t.wobbleSpeed;
      const l = Math.sin(t.wobble) * t.swayAmplitude, v = Math.cos(t.wobble * 1.8 + t.y * 0.01) * (t.swayAmplitude * 0.2);
      t.x += f * c + t.vx + l + v, t.y += n * t.vy, t.y > h + t.radius && (t.y = -t.radius, t.x = Math.random() * i), t.x > i + t.radius ? t.x = -t.radius : t.x < -t.radius && (t.x = i + t.radius);
    });
  }, [n]), V = T((o, i, h, c, f) => {
    o.clearRect(0, 0, h, c), o.fillStyle = s, i.forEach((t) => {
      if (o.globalAlpha = Math.max(0, Math.min(1, t.opacity * f * x)), o.save(), o.translate(t.x, t.y), o.rotate(Math.sin(t.wobble)), o.beginPath(), t.shapeOffsets.length > 0) {
        o.moveTo(t.shapeOffsets[0].x, t.shapeOffsets[0].y);
        for (let l = 1; l < t.shapeOffsets.length; l++)
          o.lineTo(t.shapeOffsets[l].x, t.shapeOffsets[l].y);
        o.closePath();
      } else
        o.arc(0, 0, t.radius, 0, Math.PI * 2);
      o.fill(), o.restore();
    });
  }, [s, x]), G = p ? "webgl" : "canvas";
  se(() => {
    p || (m.current = { back: null, mid: null, front: null });
    const o = (c, f) => {
      !a.current || !A.current || !M.current || !P.current || (d.current = { width: c, height: f }, [A, M, P].forEach((t) => {
        t.current && (t.current.width = c, t.current.height = f);
      }), p ? (m.current.back = j(A.current), m.current.mid = j(M.current), m.current.front = j(P.current), m.current.back && m.current.mid && m.current.front ? console.log("Snowfall: Using WebGL renderer") : console.log("Snowfall: WebGL init failed, using Canvas fallback")) : console.log("Snowfall: Using Canvas 2D renderer"), Q(c, f));
    }, i = () => {
      if (!a.current || E.current && U()) return;
      const { clientWidth: c, clientHeight: f } = a.current, t = d.current, l = Math.abs(c - t.width), v = Math.abs(f - t.height);
      if (t.width === 0 || t.height === 0) {
        o(c, f);
        return;
      }
      l < 50 && v < 50 || (D.current && clearTimeout(D.current), D.current = setTimeout(() => {
        if (!a.current || E.current && U())
          return;
        const { clientWidth: S, clientHeight: w } = a.current;
        o(S, w);
      }, 300));
    };
    if (a.current) {
      const { clientWidth: c, clientHeight: f } = a.current;
      d.current = { width: c, height: f }, o(c, f);
    }
    a.current && typeof ResizeObserver < "u" ? (z.current = new ResizeObserver(() => {
      i();
    }), z.current.observe(a.current)) : window.addEventListener("resize", i), window.addEventListener("scroll", O, { passive: !0 }), document.addEventListener("scroll", O, { passive: !0 });
    const h = () => {
      if (!a.current) return;
      const { width: c, height: f } = d.current, t = c > 0 ? c : a.current.clientWidth, l = f > 0 ? f : a.current.clientHeight, v = m.current, S = X(u);
      if (Y(g.current.back, t, l, 0.5, S), p && v.back)
        K(v.back, g.current.back, t, l, s, x, 0.3, R, 0);
      else if (A.current) {
        const w = A.current.getContext("2d");
        w && V(w, g.current.back, t, l, 0.3);
      }
      if (Y(g.current.mid, t, l, 1, S), p && v.mid)
        K(v.mid, g.current.mid, t, l, s, x, 0.6, R, 1);
      else if (M.current) {
        const w = M.current.getContext("2d");
        w && V(w, g.current.mid, t, l, 0.6);
      }
      if (Y(g.current.front, t, l, 1.5, S), p && v.front)
        K(v.front, g.current.front, t, l, s, x, 0.8, R, 2);
      else if (P.current) {
        const w = P.current.getContext("2d");
        w && V(w, g.current.front, t, l, 0.8);
      }
      F.current = requestAnimationFrame(h);
    };
    return F.current = requestAnimationFrame(h), () => {
      z.current && a.current ? (z.current.unobserve(a.current), z.current.disconnect()) : window.removeEventListener("resize", i), window.removeEventListener("scroll", O), document.removeEventListener("scroll", O), D.current && clearTimeout(D.current), k.current && clearTimeout(k.current), cancelAnimationFrame(F.current);
    };
  }, [Q, Y, V, p, s, x, R, u, X, O, U]);
  const ne = ["rrs-snowfall-container", e].filter(Boolean).join(" "), H = { style: re };
  return /* @__PURE__ */ ae("div", { ref: a, className: ne, style: { ...me, ...I }, children: [
    /* @__PURE__ */ $("canvas", { ref: A, ...H }, `back-${G}`),
    /* @__PURE__ */ $("canvas", { ref: M, ...H }, `mid-${G}`),
    /* @__PURE__ */ $(
      "canvas",
      {
        ref: P,
        ...H,
        style: { ...re, filter: "blur(3px)" }
      },
      `front-${G}`
    )
  ] });
};
export {
  be as Snowfall,
  be as default
};
