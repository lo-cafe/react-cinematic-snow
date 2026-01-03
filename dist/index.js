"use strict";Object.defineProperties(exports,{__esModule:{value:!0},[Symbol.toStringTag]:{value:"Module"}});const V=require("react/jsx-runtime"),d=require("react"),ie=`
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
`,ae=`
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
`;function Z(r,n,u){const s=r.createShader(n);return s?(r.shaderSource(s,u),r.compileShader(s),r.getShaderParameter(s,r.COMPILE_STATUS)?s:(console.error("Shader compile error:",r.getShaderInfoLog(s)),r.deleteShader(s),null)):null}function se(r){const n=Z(r,r.VERTEX_SHADER,ie),u=Z(r,r.FRAGMENT_SHADER,ae);if(!n||!u)return null;const s=r.createProgram();return s?(r.attachShader(s,n),r.attachShader(s,u),r.linkProgram(s),r.getProgramParameter(s,r.LINK_STATUS)?s:(console.error("Program link error:",r.getProgramInfoLog(s)),r.deleteProgram(s),null)):null}function ce(){if(typeof window>"u"||typeof navigator>"u")return!1;const r="ontouchstart"in window||navigator.maxTouchPoints>0,n=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),u=window.innerWidth<=768;return r&&(n||u)}function q(r){const n=r.getContext("webgl",{alpha:!0,premultipliedAlpha:!1,antialias:!0});if(!n)return null;const u=se(n);if(!u)return null;const s=n.getAttribLocation(u,"a_position"),E=n.getAttribLocation(u,"a_size"),_=n.getAttribLocation(u,"a_opacity"),w=n.getAttribLocation(u,"a_seed"),x=n.getAttribLocation(u,"a_rotation"),L=n.getUniformLocation(u,"u_resolution"),e=n.getUniformLocation(u,"u_color"),D=n.getUniformLocation(u,"u_roughness"),a=n.getUniformLocation(u,"u_layer"),A=n.getUniformLocation(u,"u_isMobile");if(!L||!e||!D||!a||!A)return null;const M=n.createBuffer(),R=n.createBuffer(),F=n.createBuffer(),g=n.createBuffer(),C=n.createBuffer();if(!M||!R||!F||!g||!C)return null;const p=ce();return{gl:n,program:u,positionBuffer:M,sizeBuffer:R,opacityBuffer:F,seedBuffer:g,rotationBuffer:C,isMobile:p,locations:{position:s,size:E,opacity:_,seed:w,rotation:x,resolution:L,color:e,roughness:D,layer:a,isMobile:A}}}function le(r){const n=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(r);return n?[parseInt(n[1],16)/255,parseInt(n[2],16)/255,parseInt(n[3],16)/255]:[1,1,1]}function $(r,n,u,s,E,_,w,x,L){const{gl:e,program:D,locations:a}=r;if(n.length===0)return;e.viewport(0,0,u,s),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.useProgram(D),e.uniform2f(a.resolution,u,s);const[A,M,R]=le(E);e.uniform3f(a.color,A,M,R),e.uniform1f(a.roughness,x),e.uniform1f(a.layer,L),e.uniform1f(a.isMobile,r.isMobile?1:0);const F=new Float32Array(n.length*2),g=new Float32Array(n.length),C=new Float32Array(n.length),p=new Float32Array(n.length),v=new Float32Array(n.length);for(let y=0;y<n.length;y++){const h=n[y];if(F[y*2]=h.x,F[y*2+1]=h.y,r.isMobile){const B=h.radius<1?3:h.radius<1.5?2.5:2;g[y]=Math.max(2,h.radius*B)}else{const B=h.radius<1?5.5:h.radius<1.5?4.5:3.5;g[y]=Math.max(5,h.radius*B)}const T=r.isMobile?h.radius<1?1.5:h.radius<1.5?1.3:1.1:h.radius<1?2.2:h.radius<1.5?1.8:1.4;C[y]=Math.min(1,h.opacity*w*_*T),p[y]=h.shapeSeed,v[y]=Math.sin(h.wobble)}e.bindBuffer(e.ARRAY_BUFFER,r.positionBuffer),e.bufferData(e.ARRAY_BUFFER,F,e.DYNAMIC_DRAW),e.enableVertexAttribArray(a.position),e.vertexAttribPointer(a.position,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,r.sizeBuffer),e.bufferData(e.ARRAY_BUFFER,g,e.DYNAMIC_DRAW),e.enableVertexAttribArray(a.size),e.vertexAttribPointer(a.size,1,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,r.opacityBuffer),e.bufferData(e.ARRAY_BUFFER,C,e.DYNAMIC_DRAW),e.enableVertexAttribArray(a.opacity),e.vertexAttribPointer(a.opacity,1,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,r.seedBuffer),e.bufferData(e.ARRAY_BUFFER,p,e.DYNAMIC_DRAW),e.enableVertexAttribArray(a.seed),e.vertexAttribPointer(a.seed,1,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,r.rotationBuffer),e.bufferData(e.ARRAY_BUFFER,v,e.DYNAMIC_DRAW),e.enableVertexAttribArray(a.rotation),e.vertexAttribPointer(a.rotation,1,e.FLOAT,!1,0,0),e.drawArrays(e.POINTS,0,n.length)}function ue(){try{const r=document.createElement("canvas");return!!(r.getContext("webgl")||r.getContext("experimental-webgl"))}catch{return!1}}const fe={position:"absolute",top:0,right:0,bottom:0,left:0,width:"100%",height:"100%",pointerEvents:"none"},ee={position:"absolute",top:0,right:0,bottom:0,left:0,display:"block"},te=({density:r=1200,speed:n=1.2,wind:u=.2,color:s="#ffffff",minRadius:E=.2,maxRadius:_=2.3,roughness:w=.9,opacity:x=1,renderer:L="auto",className:e="",style:D})=>{const a=d.useRef(null),A=d.useRef(null),M=d.useRef(null),R=d.useRef(null),F=d.useRef(0),g=d.useRef({back:null,mid:null,front:null}),C=d.useMemo(()=>ue(),[]),p=d.useMemo(()=>L==="canvas"?!1:C,[L,C]),v=d.useRef({back:[],mid:[],front:[]}),y=d.useRef({time:0,gustTime:0,gustStrength:0,gustDirection:1}),h=d.useRef({width:0,height:0}),T=d.useRef(null),B=d.useRef(!1),k=d.useRef(null),I=d.useRef(null),z=d.useCallback(()=>{if(typeof window>"u"||typeof navigator>"u")return!1;const o="ontouchstart"in window||navigator.maxTouchPoints>0,i=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),m=window.innerWidth<=768;return o&&(i||m)},[]),U=(o,i)=>Math.random()*(i-o)+o,W=d.useCallback(()=>{z()&&(B.current=!0,k.current&&clearTimeout(k.current),k.current=setTimeout(()=>{B.current=!1},150))},[z]),K=d.useCallback(o=>{const i=y.current;i.time+=.016;const m=Math.sin(i.time*.05)*.7,c=Math.sin(i.time*.15)*.3,f=Math.sin(i.time*.8)*.1;i.gustTime-=.016,i.gustTime<=0&&Math.random()<5e-4&&(i.gustStrength=.5+Math.random()*1.5,i.gustDirection=Math.random()>.5?1:-1,i.gustTime=2+Math.random()*3);const t=i.gustTime>0?Math.sin(i.gustTime/3*Math.PI)*i.gustStrength*i.gustDirection:0,l=1+m+c+f+t;return o*l},[]),X=d.useCallback((o,i)=>{const m=5+Math.floor(Math.random()*4),c=[];for(let f=0;f<m;f++){const t=f/m*Math.PI*2,l=1+(Math.random()-.5)*i;c.push({x:Math.cos(t)*o*l,y:Math.sin(t)*o*l})}return c},[]),O=d.useCallback((o,i,m,c,f,t)=>{const l=[];for(let b=0;b<m;b++){const P=U(c,f);let j=.1+(P-c)/(f-c||1)*.7+(Math.random()*.6-.3);j=Math.max(.1,Math.min(1,j));const ne=P/2.5*t,oe=U(.85,1.15),Q=Math.max(.5,P/2.5);l.push({x:Math.random()*o,y:Math.random()*i,radius:P,opacity:j,vx:U(-.1,.1)*Q,vy:ne*oe,wobble:Math.random()*Math.PI*2,wobbleSpeed:U(.005,.03),swayAmplitude:U(.3,.8)*Q,shapeOffsets:X(P,w),shapeSeed:Math.random()*1e3})}return l},[w,X]),J=d.useCallback((o,i)=>{v.current.back=O(o,i,Math.floor(r*.8),E*.5,_*.6,.6),v.current.mid=O(o,i,Math.floor(r*.5),E,_,1);const m=O(o,i,Math.max(5,Math.floor(r*.1)),Math.max(_,2),_*1.8,1.4),c=O(o,i,Math.max(2,Math.floor(r*.004)),_*3.5,_*5.5,2);v.current.front=[...m,...c]},[r,E,_,O]),N=d.useCallback((o,i,m,c,f)=>{o.forEach(t=>{t.wobble+=t.wobbleSpeed;const l=Math.sin(t.wobble)*t.swayAmplitude,b=Math.cos(t.wobble*1.8+t.y*.01)*(t.swayAmplitude*.2);t.x+=f*c+t.vx+l+b,t.y+=n*t.vy,t.y>m+t.radius&&(t.y=-t.radius,t.x=Math.random()*i),t.x>i+t.radius?t.x=-t.radius:t.x<-t.radius&&(t.x=i+t.radius)})},[n]),Y=d.useCallback((o,i,m,c,f)=>{o.clearRect(0,0,m,c),o.fillStyle=s,i.forEach(t=>{if(o.globalAlpha=Math.max(0,Math.min(1,t.opacity*f*x)),o.save(),o.translate(t.x,t.y),o.rotate(Math.sin(t.wobble)),o.beginPath(),t.shapeOffsets.length>0){o.moveTo(t.shapeOffsets[0].x,t.shapeOffsets[0].y);for(let l=1;l<t.shapeOffsets.length;l++)o.lineTo(t.shapeOffsets[l].x,t.shapeOffsets[l].y);o.closePath()}else o.arc(0,0,t.radius,0,Math.PI*2);o.fill(),o.restore()})},[s,x]),G=p?"webgl":"canvas";d.useEffect(()=>{p||(g.current={back:null,mid:null,front:null});const o=(c,f)=>{!a.current||!A.current||!M.current||!R.current||(h.current={width:c,height:f},[A,M,R].forEach(t=>{t.current&&(t.current.width=c,t.current.height=f)}),p?(g.current.back=q(A.current),g.current.mid=q(M.current),g.current.front=q(R.current),g.current.back&&g.current.mid&&g.current.front?console.log("Snowfall: Using WebGL renderer"):console.log("Snowfall: WebGL init failed, using Canvas fallback")):console.log("Snowfall: Using Canvas 2D renderer"),J(c,f))},i=()=>{if(!a.current||B.current&&z())return;const{clientWidth:c,clientHeight:f}=a.current,t=h.current,l=Math.abs(c-t.width),b=Math.abs(f-t.height);if(t.width===0||t.height===0){o(c,f);return}l<50&&b<50||(T.current&&clearTimeout(T.current),T.current=setTimeout(()=>{if(!a.current||B.current&&z())return;const{clientWidth:P,clientHeight:S}=a.current;o(P,S)},300))};if(a.current){const{clientWidth:c,clientHeight:f}=a.current;h.current={width:c,height:f},o(c,f)}a.current&&typeof ResizeObserver<"u"?(I.current=new ResizeObserver(()=>{i()}),I.current.observe(a.current)):window.addEventListener("resize",i),window.addEventListener("scroll",W,{passive:!0}),document.addEventListener("scroll",W,{passive:!0});const m=()=>{if(!a.current)return;const{width:c,height:f}=h.current,t=c>0?c:a.current.clientWidth,l=f>0?f:a.current.clientHeight,b=g.current,P=K(u);if(N(v.current.back,t,l,.5,P),p&&b.back)$(b.back,v.current.back,t,l,s,x,.3,w,0);else if(A.current){const S=A.current.getContext("2d");S&&Y(S,v.current.back,t,l,.3)}if(N(v.current.mid,t,l,1,P),p&&b.mid)$(b.mid,v.current.mid,t,l,s,x,.6,w,1);else if(M.current){const S=M.current.getContext("2d");S&&Y(S,v.current.mid,t,l,.6)}if(N(v.current.front,t,l,1.5,P),p&&b.front)$(b.front,v.current.front,t,l,s,x,.8,w,2);else if(R.current){const S=R.current.getContext("2d");S&&Y(S,v.current.front,t,l,.8)}F.current=requestAnimationFrame(m)};return F.current=requestAnimationFrame(m),()=>{I.current&&a.current?(I.current.unobserve(a.current),I.current.disconnect()):window.removeEventListener("resize",i),window.removeEventListener("scroll",W),document.removeEventListener("scroll",W),T.current&&clearTimeout(T.current),k.current&&clearTimeout(k.current),cancelAnimationFrame(F.current)}},[J,N,Y,p,s,x,w,u,K,W,z]);const re=["rrs-snowfall-container",e].filter(Boolean).join(" "),H={style:ee};return V.jsxs("div",{ref:a,className:re,style:{...fe,...D},children:[V.jsx("canvas",{ref:A,...H},`back-${G}`),V.jsx("canvas",{ref:M,...H},`mid-${G}`),V.jsx("canvas",{ref:R,...H,style:{...ee,filter:"blur(3px)"}},`front-${G}`)]})};exports.Snowfall=te;exports.default=te;
