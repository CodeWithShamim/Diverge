/** Landing hero — the Fork rendered as a living instrument.
 *  A single bright node splits into two energy paths (amber / teal) held in
 *  perfect mirror; validator motes drift undecided between them; a star field
 *  and instrument grid give the scene depth. All motion is ambient — the fork
 *  never resolves here. Resolution belongs to the product, not the poster. */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { prefersReducedMotion } from "../../design/motion";

const COLOR = {
  a: new THREE.Color("#E0894A"),
  b: new THREE.Color("#4FB0C9"),
  wins: new THREE.Color("#E9EDF2"),
  signal: new THREE.Color("#5B8BF0"),
  faint: new THREE.Color("#5B6570"),
};

/* Soft radial glow texture, built once. */
function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function forkCurve(dir: 1 | -1): THREE.CubicBezierCurve3 {
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 1.35, 0),
    new THREE.Vector3(0, 0.35, 0.25),
    new THREE.Vector3(dir * 1.25, -0.15, -0.15),
    new THREE.Vector3(dir * 3.4, -1.7, -0.9)
  );
}

const stemCurve = new THREE.LineCurve3(
  new THREE.Vector3(0, 3.4, -0.4),
  new THREE.Vector3(0, 1.35, 0)
);

/** One glowing path: bright core tube + wide halo tube, gently breathing. */
function ForkPath({ side, glow }: { side: "A" | "B"; glow: THREE.Texture }) {
  const dir = side === "A" ? -1 : 1;
  const color = side === "A" ? COLOR.a : COLOR.b;
  const curve = useMemo(() => forkCurve(dir as 1 | -1), [dir]);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null!);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null!);

  const core = useMemo(() => new THREE.TubeGeometry(curve, 90, 0.022, 10), [curve]);
  const halo = useMemo(() => new THREE.TubeGeometry(curve, 90, 0.09, 10), [curve]);

  useFrame(({ clock }) => {
    // both sides breathe on the same phase — the symmetry rule holds in 3D too
    const breathe = 0.85 + Math.sin(clock.elapsedTime * 1.1) * 0.15;
    if (coreMat.current) coreMat.current.opacity = 0.95 * breathe;
    if (haloMat.current) haloMat.current.opacity = 0.16 * breathe;
  });

  return (
    <group>
      <mesh geometry={core}>
        <meshBasicMaterial
          ref={coreMat}
          color={color}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={halo}>
        <meshBasicMaterial
          ref={haloMat}
          color={color}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <FlowParticles curve={curve} color={color} count={46} glow={glow} />
    </group>
  );
}

/** Energy motes streaming along a curve. */
function FlowParticles({
  curve,
  color,
  count,
  glow,
  speed = 0.12,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  color: THREE.Color;
  count: number;
  glow: THREE.Texture;
  speed?: number;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const offsets = useMemo(
    () => Array.from({ length: count }, () => Math.random()),
    [count]
  );

  useFrame(({ clock }) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const t = (clock.elapsedTime * speed + offsets[i]) % 1;
      const p = curve.getPoint(t);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points geometry={geo}>
      <pointsMaterial
        map={glow}
        color={color}
        size={0.16}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/** The split node — a pulsing core with two counter-rotating instrument rings. */
function SplitNode({ glow }: { glow: THREE.Texture }) {
  const sprite = useRef<THREE.Sprite>(null!);
  const ringA = useRef<THREE.Mesh>(null!);
  const ringB = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 2.2) * 0.18;
    if (sprite.current) sprite.current.scale.setScalar(1.5 * pulse);
    if (ringA.current) {
      ringA.current.rotation.x = t * 0.6;
      ringA.current.rotation.y = t * 0.25;
    }
    if (ringB.current) {
      ringB.current.rotation.x = -t * 0.4;
      ringB.current.rotation.z = t * 0.3;
    }
  });

  return (
    <group position={[0, 1.35, 0]}>
      <sprite ref={sprite}>
        <spriteMaterial
          map={glow}
          color={COLOR.wins}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <mesh>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color={COLOR.wins} />
      </mesh>
      <mesh ref={ringA}>
        <torusGeometry args={[0.34, 0.006, 8, 64]} />
        <meshBasicMaterial
          color={COLOR.signal}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[0.52, 0.004, 8, 64]} />
        <meshBasicMaterial
          color={COLOR.faint}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Validator motes — undecided, drifting in a slow orbit between the sides. */
function Validators({ glow }: { glow: THREE.Texture }) {
  const group = useRef<THREE.Group>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        r: 1.1 + (i % 4) * 0.45,
        phase: (i / 11) * Math.PI * 2,
        vy: -0.2 - (i % 3) * 0.35,
        speed: 0.25 + (i % 5) * 0.06,
      })),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((m, i) => {
      const s = seeds[i];
      m.position.set(
        Math.cos(t * s.speed + s.phase) * s.r,
        s.vy + Math.sin(t * 0.8 + s.phase * 3) * 0.18,
        Math.sin(t * s.speed + s.phase) * s.r * 0.5 - 0.4
      );
    });
  });

  return (
    <group ref={group}>
      {seeds.map((_, i) => (
        <sprite key={i} scale={[0.22, 0.22, 0.22]}>
          <spriteMaterial
            map={glow}
            color={i % 2 ? COLOR.a : COLOR.b}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Deep star field in the three brand hues, slowly rotating. */
function StarField() {
  const ref = useRef<THREE.Points>(null!);
  const { positions, colors } = useMemo(() => {
    const n = 1600;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const palette = [COLOR.faint, COLOR.faint, COLOR.faint, COLOR.a, COLOR.b, COLOR.signal];
    for (let i = 0; i < n; i++) {
      const r = 6 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 4;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.008;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        vertexColors
        transparent
        opacity={0.75}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/** Parallax rig — the whole scene leans gently toward the pointer. */
function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ pointer, clock }) => {
    if (!ref.current) return;
    const g = ref.current;
    g.rotation.y += (pointer.x * 0.16 - g.rotation.y) * 0.04;
    g.rotation.x += (-pointer.y * 0.08 - g.rotation.x) * 0.04;
    g.position.y = Math.sin(clock.elapsedTime * 0.4) * 0.05;
  });
  return <group ref={ref}>{children}</group>;
}

export function HeroScene() {
  const reduced = prefersReducedMotion();
  const glow = useMemo(() => makeGlowTexture(), []);

  return (
    <Canvas
      camera={{ fov: 42, position: [0, 0.15, 5.4] }}
      dpr={[1, 2]}
      frameloop={reduced ? "demand" : "always"}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <fog attach="fog" args={["#0E1116", 7.5, 16]} />
      <Rig>
        <StarField />
        <gridHelper
          args={[36, 72, "#5A6675", "#2E3843"]}
          position={[0, -2.6, -2]}
        />
        {/* stem — the undisputed fact arriving at the split */}
        <mesh geometry={useMemo(() => new THREE.TubeGeometry(stemCurve, 12, 0.016, 8), [])}>
          <meshBasicMaterial
            color={COLOR.wins}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <FlowParticles curve={stemCurve} color={COLOR.wins} count={16} glow={glow} speed={0.18} />
        <SplitNode glow={glow} />
        <ForkPath side="A" glow={glow} />
        <ForkPath side="B" glow={glow} />
        <Validators glow={glow} />
      </Rig>
    </Canvas>
  );
}
