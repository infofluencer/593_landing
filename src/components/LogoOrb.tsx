"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Off+Brand-style liquid orb: mouse-driven surface overflow / warp.
 * Ref: https://www.itsoffbrand.com/
 */
const LOGO_URL = "/icon512ai.png?v=9fix2";

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uHover;
uniform vec2 uPointer;
uniform vec2 uVelocity;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vBulge;
varying float vWater;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

// Expanding ripple rings from a center (su dalgası)
float ripple(vec3 n, vec2 center, float t, float speed, float width) {
  float d = length(n.xy - center);
  float phase = d * 9.0 - t * speed;
  float crest = exp(-pow(sin(phase) * 0.5 + 0.5 - 0.85, 2.0) * 40.0);
  float falloff = exp(-d * d * 1.4);
  float envelope = smoothstep(1.4, 0.15, d);
  return crest * falloff * envelope * width;
}

void main() {
  vUv = uv;

  vec3 n = normalize(normal);
  vec3 pos = n;

  // Rolling swells — stronger ocean waves
  float swell1 = sin(n.x * 4.2 + n.y * 2.1 + uTime * 1.45) * 0.032;
  float swell2 = sin(n.y * 5.0 - n.x * 2.8 - uTime * 1.15) * 0.026;
  float swell3 = sin((n.x + n.y) * 6.5 + uTime * 1.95) * 0.018;
  float swell4 = cos(n.x * 3.0 - n.y * 4.5 + uTime * 0.85) * 0.022;

  // Fine surface chop
  float n1 = noise(n * 2.2 + vec3(uTime * 0.5, uTime * 0.32, -uTime * 0.25));
  float n2 = noise(n * 4.8 + vec3(-uTime * 0.7, uTime * 0.45, uTime * 0.35));
  float chop = (n1 - 0.5) * 0.028 + (n2 - 0.5) * 0.016;

  // Softer on logo face so strokes stay readable — but still wave
  float frontFace = smoothstep(0.1, 0.6, n.z);
  float waterAmp = mix(1.15, 0.55, frontFace);

  float water = (swell1 + swell2 + swell3 + swell4 + chop) * waterAmp;

  // Mouse ripples — stronger concentric waves
  vec2 pn = uPointer;
  float d = length(n.xy - pn);
  float influence = exp(-d * d * 1.9);
  float speed = min(length(uVelocity), 2.2);

  float rip = 0.0;
  rip += ripple(n, pn, uTime, 3.6, 0.045);
  rip += ripple(n, pn, uTime + 1.7, 2.8, 0.032) * 0.85;
  water += rip * (0.65 + uHover * 1.1) * waterAmp;

  // Liquid push under cursor
  float bulge =
    influence * (0.022 + uHover * 0.06) +
    influence * speed * 0.055 +
    sin(d * 12.0 - uTime * 4.5) * influence * uHover * 0.02;

  float radial = 1.0 + water + bulge;
  radial = min(radial, 1.12);
  pos = n * radial;

  // Stronger wavy normal for wet look
  float eps = 0.035;
  float wx =
    sin((n.x + eps) * 4.2 + n.y * 2.1 + uTime * 1.45) * 0.032 -
    sin((n.x - eps) * 4.2 + n.y * 2.1 + uTime * 1.45) * 0.032;
  float wy =
    sin(n.x * 4.2 + (n.y + eps) * 2.1 + uTime * 1.45) * 0.032 -
    sin(n.x * 4.2 + (n.y - eps) * 2.1 + uTime * 1.45) * 0.032;
  vec3 wavy = normalize(n + vec3(wx, wy, 0.0) * 3.8 * waterAmp);

  vWater = water;
  vBulge = bulge + rip * 0.5;
  vNormal = normalize(normalMatrix * wavy);
  vec4 world = modelMatrix * vec4(pos * 1.6, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uLogo;
uniform float uTime;
uniform float uHover;
uniform vec3 uTint;
uniform vec3 uRim;
uniform vec2 uPointer;
uniform vec2 uVelocity;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vBulge;
varying float vWater;

float hash1(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash1(i), hash1(i + vec3(1,0,0)), f.x),
        mix(hash1(i + vec3(0,1,0)), hash1(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash1(i + vec3(0,0,1)), hash1(i + vec3(1,0,1)), f.x),
        mix(hash1(i + vec3(0,1,1)), hash1(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  float facing = max(N.z, 0.0);

  vec3 brand = vec3(233.0, 24.0, 37.0) / 255.0;

  float h = smoothstep(0.0, 0.65, clamp(uHover, 0.0, 1.0));
  // Solid opaque body color — less wash-out
  vec3 body = mix(brand, uTint, h * 0.95);
  body = mix(body, uRim, fresnel * h * 0.18);

  float dist = length(N.xy - uPointer);
  float prox = exp(-dist * 1.2) * h;
  body = mix(body, uRim, prox * 0.15);

  vec2 logoUv = N.xy * 0.48 + 0.5;
  logoUv += uPointer * (0.005 + uHover * 0.008);
  logoUv += uVelocity * 0.008;
  logoUv += vec2(
    sin(uTime * 1.2 + N.y * 5.0 + vWater * 14.0),
    cos(uTime * 1.0 + N.x * 5.0 - vWater * 12.0)
  ) * (0.0025 + abs(vWater) * 0.14);

  float decalR = length(logoUv - 0.5);
  float circleMask = smoothstep(0.50, 0.46, decalR);
  float front = smoothstep(0.0, 0.28, facing);

  vec4 logo = texture2D(uLogo, clamp(logoUv, 0.0, 1.0));
  float logoVis = logo.a * circleMask * front;
  float luma = (logo.r + logo.g + logo.b) / 3.0;
  // 5/9/3 — more opaque pure white
  float isWhite = smoothstep(0.45, 0.72, luma);
  vec3 logoMapped = mix(body, vec3(1.0), isWhite);

  vec3 base = body;
  base = mix(base, logoMapped, logoVis);
  // Force opaque white mark (no translucent bleed)
  base = mix(base, vec3(1.0), isWhite * logoVis * 0.92);

  // Stronger wave crest shimmer + troughs
  float crest = smoothstep(0.006, 0.028, vWater);
  float trough = smoothstep(-0.028, -0.006, vWater);
  float spark = crest * (0.5 + 0.5 * abs(sin(vWater * 55.0 + uTime * 3.2)));
  base += vec3(1.0) * spark * 0.2 * (1.0 - isWhite * logoVis);
  base *= 1.0 - trough * 0.1 * (1.0 - isWhite * logoVis);

  vec3 lightDir = normalize(vec3(
    0.2 + uPointer.x * 0.55 + sin(uTime * 0.7) * 0.2,
    0.45 + uPointer.y * 0.4 + cos(uTime * 0.55) * 0.1,
    1.0
  ));
  float spec = pow(max(dot(reflect(-V, N), lightDir), 0.0), 36.0);
  float specWide = pow(max(dot(reflect(-V, N), lightDir), 0.0), 10.0);
  float specSharp = pow(max(dot(reflect(-V, N), lightDir), 0.0), 80.0);

  vec3 color = base;
  color += uRim * fresnel * (0.15 + abs(vWater) * 3.2) * (0.4 + h * 0.7) * (1.0 - isWhite * logoVis);
  color += vec3(1.0) * spec * (0.07 + uHover * 0.1 + spark * 0.28);
  color += vec3(1.0) * specSharp * 0.08 * (1.0 - isWhite * logoVis);
  color += body * specWide * 0.08 * (1.0 - isWhite * logoVis);
  color += vec3(1.0) * fresnel * 0.055;

  // Stronger caustic flicker on body
  float caustic = noise(vec3(N.xy * 7.0 + uPointer * 0.6, uTime * 0.75));
  float caustic2 = noise(vec3(N.yx * 11.0 - uPointer * 0.4, uTime * 1.1 + 2.0));
  color += body * (caustic * 0.07 + caustic2 * 0.04) * (1.0 - isWhite * logoVis) * (0.55 + h * 0.55);

  // Re-assert opaque white 5/9/3
  color = mix(color, vec3(1.0), isWhite * logoVis);

  gl_FragColor = vec4(color, 1.0);
}
`;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function LogoOrb() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = prefersReducedMotion();
    // Phones run this shader over a near-fullscreen sphere; render below native
    // density and let the browser upscale rather than burn fill rate.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const dprCap = Math.min(window.devicePixelRatio || 1, touch ? 1.15 : 1.5);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: dprCap < 1.5,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(dprCap);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 5;

    const pointer = new THREE.Vector2(0, 0);
    const pointerTarget = new THREE.Vector2(0, 0);
    const colorPointer = new THREE.Vector2(0, 0);
    const velocity = new THREE.Vector2(0, 0);
    const prevPointer = new THREE.Vector2(0, 0);
    const velSample = new THREE.Vector2(0, 0);
    const tint = new THREE.Color(0xe91825);
    const tintTarget = new THREE.Color(0xe91825);
    const rim = new THREE.Color(0xff9ec8);
    const rimTarget = new THREE.Color(0xff9ec8);
    let hover = 0;
    let hoverTarget = 0;
    let raf = 0;
    let disposed = false;
    let tabVisible = true;
    let onScreen = true;
    let visible = true;
    const start = performance.now();
    let last = start;

    // Vivid stops — one dominates at a time (no muddy average)
    const palette = [
      new THREE.Color(0xe91825), // brand red
      new THREE.Color(0xc6f28a), // fıstık yeşili
      new THREE.Color(0xa855f7), // mor
      new THREE.Color(0xff9ec8), // açık pembe
      new THREE.Color(0xffe566), // sarı
      new THREE.Color(0xff4fb8), // hot pink
      new THREE.Color(0x5ec8ff), // mavi
      new THREE.Color(0xd4a5ff), // lila
    ];
    const rimPalette = [
      new THREE.Color(0xff5a65),
      new THREE.Color(0xd4f5a0),
      new THREE.Color(0xc084fc),
      new THREE.Color(0xffc0dd),
      new THREE.Color(0xfff0a0),
      new THREE.Color(0xff7ad0),
      new THREE.Color(0x8fdfff),
      new THREE.Color(0xe0c4ff),
    ];

    const uniforms = {
      uLogo: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uTint: { value: new THREE.Color(0xe91825) },
      uRim: { value: new THREE.Color(0xff9ec8) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uVelocity: { value: new THREE.Vector2(0, 0) },
    };

    // 64 segs is smooth enough; 160 was crushing the GPU
    const segments = touch ? 48 : 64;
    const geometry = new THREE.SphereGeometry(1, segments, segments);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const loader = new THREE.TextureLoader();
    loader.load(LOGO_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      uniforms.uLogo.value = tex;
      material.needsUpdate = true;
    });

    const setSize = () => {
      const { clientWidth: w, clientHeight: h } = wrap;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    setSize();

    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    const onMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      pointerTarget.set(
        THREE.MathUtils.clamp(x, -1.35, 1.35),
        THREE.MathUtils.clamp(y, -1.35, 1.35),
      );

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width * 0.55);
      const dy = (e.clientY - cy) / (rect.height * 0.55);
      const dist = Math.hypot(dx, dy);
      hoverTarget = THREE.MathUtils.clamp(1.15 - dist * 0.75, 0, 1);
    };

    const onLeave = () => {
      hoverTarget = 0;
    };

    const sync = () => {
      const next = tabVisible && onScreen;
      if (next === visible) return;
      visible = next;
      if (visible && !disposed && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const onVisibility = () => {
      tabVisible = document.visibilityState === "visible";
      sync();
    };

    // The orb is parked far off-viewport whenever the page choreography fades
    // it out, so this also stops the shader while it is invisible.
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { rootMargin: "20% 0px" },
    );
    io.observe(wrap);

    // Pointer tracking measures the wrapper on every move; on touch that fires
    // during scroll and forces a reflow per frame for an effect nobody sees.
    if (!touch) {
      window.addEventListener("pointermove", onMove, { passive: true });
      wrap.addEventListener("pointerleave", onLeave);
    }
    document.addEventListener("visibilitychange", onVisibility);

    const tick = () => {
      if (disposed) return;
      if (!visible) {
        raf = 0;
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - start) / 1000;

      // No pointer on touch, so drive the colour sweep on a slow orbit instead.
      if (touch && !reduced) {
        pointerTarget.set(Math.cos(t * 0.22) * 0.72, Math.sin(t * 0.17) * 0.62);
        hoverTarget = 0.38;
      }

      pointer.lerp(pointerTarget, 1 - Math.exp(-4.0 * dt));
      colorPointer.lerp(pointerTarget, 1 - Math.exp(-2.0 * dt));
      velSample.set(
        (pointer.x - prevPointer.x) / Math.max(dt, 0.001),
        (pointer.y - prevPointer.y) / Math.max(dt, 0.001),
      );
      velocity.lerp(velSample, 0.15);
      velocity.multiplyScalar(0.94);
      prevPointer.copy(pointer);
      hover += (hoverTarget - hover) * (1 - Math.exp(-2.4 * dt));

      const n = palette.length;
      const ang = Math.atan2(colorPointer.y, colorPointer.x);
      const slot = ((ang / (Math.PI * 2) + 0.5) * n + n) % n;
      const i0 = Math.floor(slot) % n;
      const i1 = (i0 + 1) % n;
      const f = slot - Math.floor(slot);
      const blend = f * f * f * (f * (f * 6 - 15) + 10);
      tintTarget.copy(palette[i0]).lerp(palette[i1], blend);
      const rSlot = (slot + 0.5) % n;
      const r0 = Math.floor(rSlot) % n;
      const r1 = (r0 + 1) % n;
      const rf = rSlot - Math.floor(rSlot);
      const rBlend = rf * rf * rf * (rf * (rf * 6 - 15) + 10);
      rimTarget.copy(rimPalette[r0]).lerp(rimPalette[r1], rBlend);

      tint.lerp(tintTarget, 1 - Math.exp(-1.8 * dt));
      rim.lerp(rimTarget, 1 - Math.exp(-1.8 * dt));

      uniforms.uTime.value = reduced ? 0 : t;
      uniforms.uHover.value = reduced ? 0 : hover;
      uniforms.uTint.value.copy(tint);
      uniforms.uRim.value.copy(rim);
      uniforms.uPointer.value.copy(pointer);
      uniforms.uVelocity.value.set(
        THREE.MathUtils.clamp(velocity.x, -2.5, 2.5),
        THREE.MathUtils.clamp(velocity.y, -2.5, 2.5),
      );

      if (!reduced) {
        mesh.rotation.y = THREE.MathUtils.damp(
          mesh.rotation.y,
          pointer.x * 0.35,
          3.2,
          dt,
        );
        mesh.rotation.x = THREE.MathUtils.damp(
          mesh.rotation.x,
          pointer.y * 0.28,
          3.2,
          dt,
        );
        mesh.position.y = Math.sin(t * 0.8) * 0.04;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      uniforms.uLogo.value?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="logo-orb relative mx-auto aspect-square h-full w-full"
    >
      <canvas
        ref={canvasRef}
        className="relative z-10 h-full w-full"
        aria-label="593 logo orb"
      />
    </div>
  );
}
