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

// Expanding ring that blooms then pops (idle water bubbles)
float bubblePop(vec3 n, vec3 center, float t, float speed, float size) {
  float phase = fract(t * speed + hash(center) * 7.13);
  // grow 0→1, snap-fade near end
  float life = smoothstep(0.0, 0.25, phase) * (1.0 - smoothstep(0.55, 0.92, phase));
  float pop = exp(-pow((phase - 0.72) * 12.0, 2.0)); // sharp pop kick
  float dist = length(n - normalize(center));
  float radius = phase * size;
  float ring = exp(-pow((dist - radius) * 14.0, 2.0));
  float mound = exp(-dist * dist * (8.0 / max(size, 0.2))) * life;
  return (mound * 0.65 + ring * (0.45 + pop * 1.2)) * life;
}

void main() {
  vUv = uv;

  vec3 n = normalize(normal);
  vec3 pos = n;

  // Continuous water field (always on)
  float n1 = noise(n * 1.6 + vec3(uTime * 0.55, uTime * 0.32, -uTime * 0.28));
  float n2 = noise(n * 3.2 + vec3(-uTime * 0.7, uTime * 0.48, uTime * 0.35));
  float n3 = noise(n * 6.5 + vec3(uTime * 1.1, -uTime * 0.9, uTime * 0.6));
  float swell = sin(uTime * 1.15 + n.x * 3.0 + n.y * 2.4) * 0.01;
  // Quiet water on the front face so logo strokes stay continuous
  float frontFace = smoothstep(0.15, 0.55, n.z);
  float water =
    (n1 * 0.028 +
    n2 * 0.014 +
    n3 * 0.007 +
    swell) * mix(1.0, 0.35, frontFace);

  // Idle bubble pops across the surface
  float idle = 1.0 - uHover * 0.35; // still present on hover, stronger when idle
  float pops = 0.0;
  pops += bubblePop(n, vec3( 0.7,  0.4,  0.55), uTime, 0.22, 0.55);
  pops += bubblePop(n, vec3(-0.65, 0.2,  0.7), uTime, 0.18, 0.48);
  pops += bubblePop(n, vec3( 0.15,-0.75, 0.55), uTime, 0.26, 0.42);
  pops += bubblePop(n, vec3(-0.3,  0.6, -0.55), uTime, 0.2, 0.5);
  pops += bubblePop(n, vec3( 0.55,-0.35,-0.65), uTime, 0.24, 0.45);
  pops += bubblePop(n, vec3(-0.1, -0.15, 0.95), uTime, 0.16, 0.6);
  water += pops * 0.045 * idle * mix(1.0, 0.25, frontFace);

  // Pointer taşma (radial only)
  vec2 pn = uPointer;
  float d = length(n.xy - pn);
  float influence = exp(-d * d * 2.8);
  float speed = min(length(uVelocity), 1.8);
  float bulge =
    influence * (0.02 + uHover * 0.05) +
    influence * speed * 0.035;

  float radial = 1.0 + water + bulge;
  radial = min(radial, 1.09);
  pos = n * radial;

  vWater = water;
  vBulge = bulge + pops * 0.04 * idle;
  vNormal = normalize(normalMatrix * n);
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

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  float facing = max(N.z, 0.0);

  vec3 brand = vec3(233.0, 24.0, 37.0) / 255.0;

  // Soft hover tint — eases in gently
  float h = smoothstep(0.0, 0.65, clamp(uHover, 0.0, 1.0));
  vec3 body = mix(brand, uTint, h * 0.92);
  body = mix(body, uRim, fresnel * h * 0.28);

  float dist = length(N.xy - uPointer);
  float prox = exp(-dist * 1.2) * h;
  body = mix(body, uRim, prox * 0.22);

  vec2 logoUv = N.xy * 0.48 + 0.5;
  // Keep logo strokes sharp — minimal UV warp so thin whites don't tear
  logoUv += uPointer * (0.006 + uHover * 0.012);
  logoUv += uVelocity * 0.012;
  logoUv += vec2(
    sin(uTime * 1.1 + N.y * 6.0 + vWater * 30.0),
    cos(uTime * 0.95 + N.x * 6.0 - vWater * 28.0)
  ) * (0.002 + abs(vWater) * 0.12 + uHover * 0.002);

  float decalR = length(logoUv - 0.5);
  float circleMask = smoothstep(0.50, 0.46, decalR);
  float front = smoothstep(0.0, 0.28, facing);

  vec4 logo = texture2D(uLogo, clamp(logoUv, 0.0, 1.0));
  float logoVis = logo.a * circleMask * front;
  float luma = (logo.r + logo.g + logo.b) / 3.0;
  // Catch near-white AA so thin 9 strokes don't tear into body color
  float isWhite = smoothstep(0.55, 0.82, luma);
  vec3 logoMapped = mix(body, vec3(1.0), isWhite);

  vec3 base = body;
  base = mix(base, logoMapped, logoVis);

  float spark = smoothstep(0.014, 0.03, abs(vWater)) * (1.0 - uHover * 0.35);
  base += vec3(1.0) * spark * 0.05 * (1.0 - isWhite * logoVis);

  float spec = pow(
    max(dot(reflect(-V, N), normalize(vec3(0.15 + uPointer.x * 0.5, 0.4 + uPointer.y * 0.5, 1.0))), 0.0),
    40.0
  );

  vec3 color = base;
  color += uRim * fresnel * abs(vWater) * 0.25 * h * (1.0 - isWhite * logoVis);
  color += vec3(1.0) * spec * (0.03 + uHover * 0.07 + spark * 0.1);

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
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 5;

    const pointer = new THREE.Vector2(0, 0);
    const pointerTarget = new THREE.Vector2(0, 0);
    const colorPointer = new THREE.Vector2(0, 0);
    const velocity = new THREE.Vector2(0, 0);
    const prevPointer = new THREE.Vector2(0, 0);
    const tint = new THREE.Color(0xe91825);
    const tintTarget = new THREE.Color(0xe91825);
    const rim = new THREE.Color(0xff9ec8);
    const rimTarget = new THREE.Color(0xff9ec8);
    let hover = 0;
    let hoverTarget = 0;
    let raf = 0;
    let disposed = false;

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

    const geometry = new THREE.SphereGeometry(1, 160, 160);
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
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
      // Normalize against orb bounds; still react a bit outside (hero feel)
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
      // Soft hover: full when over orb, fades as you leave
      hoverTarget = THREE.MathUtils.clamp(1.15 - dist * 0.75, 0, 1);
    };

    const onLeave = () => {
      hoverTarget = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave);

    const clock = new THREE.Clock();
    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Motion follow
      pointer.lerp(pointerTarget, 1 - Math.exp(-4.0 * dt));
      // Soft color follow — slower so hues ease, don't snap
      colorPointer.lerp(pointerTarget, 1 - Math.exp(-2.0 * dt));
      velocity.lerp(
        new THREE.Vector2(
          (pointer.x - prevPointer.x) / Math.max(dt, 0.001),
          (pointer.y - prevPointer.y) / Math.max(dt, 0.001),
        ),
        0.15,
      );
      velocity.multiplyScalar(0.94);
      prevPointer.copy(pointer);
      hover += (hoverTarget - hover) * (1 - Math.exp(-2.4 * dt));

      // Neighbor blend with smootherstep — soft handoff between hues
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
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      geometry.dispose();
      material.dispose();
      uniforms.uLogo.value?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="logo-orb relative mx-auto aspect-square w-full max-w-[min(82vw,38rem)]"
    >
      <canvas
        ref={canvasRef}
        className="relative z-10 h-full w-full"
        aria-label="593 logo orb"
      />
    </div>
  );
}
