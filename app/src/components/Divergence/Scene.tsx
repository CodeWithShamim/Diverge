import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Supports, Winner } from "../../lib/types";

const COLOR = {
  a: new THREE.Color("#E0894A"),
  b: new THREE.Color("#4FB0C9"),
  wins: new THREE.Color("#E9EDF2"),
  closed: new THREE.Color("#414A54"),
  unresolved: new THREE.Color("#8A6D3B"),
  node: new THREE.Color("#9AA3AD"),
};

const DUR = 1.8; // --dur-diverge

function curveFor(side: "A" | "B") {
  const dir = side === "A" ? -1 : 1;
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0.9, 0),
    new THREE.Vector3(dir * 0.5, 0.1, 0),
    new THREE.Vector3(dir * 2.1, -1.1, 0)
  );
}

const snap = (t: number) => t * t * (3 - 2 * t); // decisive ease approximation

function Path({
  side,
  winner,
  vector,
  startAt,
}: {
  side: "A" | "B";
  winner: Winner;
  vector: Supports[];
  startAt: number;
}) {
  const lineRef = useRef<THREE.Line>(null!);
  const matRef = useRef<THREE.LineBasicMaterial>(null!);
  const markersRef = useRef<THREE.Group>(null!);

  const curve = useMemo(() => curveFor(side), [side]);
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),
    [curve]
  );
  const baseColor = side === "A" ? COLOR.a : COLOR.b;
  const won = winner === (side === "A" ? "A_WINS" : "B_WINS");
  const unresolved = winner === "UNRESOLVED";
  const myTicks = vector.filter((v) => v === side).length;

  useFrame(({ clock }) => {
    const t = Math.min((clock.elapsedTime - startAt) / DUR, 1);
    const mat = matRef.current;
    const line = lineRef.current;
    if (!mat || !line) return;

    // 1. Balance (0–0.28): both paths trace out in perfect mirror
    const trace = Math.min(t / 0.28, 1);
    geometry.setDrawRange(0, Math.max(2, Math.floor(65 * trace)));
    mat.color.copy(baseColor);
    mat.opacity = 0.9;

    // 2. Weighing (0.28–0.61): brightness shifts with accumulated supports
    if (t > 0.28) {
      const w = Math.min((t - 0.28) / 0.33, 1);
      const share = vector.length ? myTicks / vector.length : 0;
      mat.color.copy(baseColor).lerp(COLOR.wins, w * share * 0.5);
      if (markersRef.current) {
        markersRef.current.children.forEach((m, i) => {
          const active = i < Math.floor(w * myTicks + 0.001);
          const progress = active ? Math.min(w * 1.6, 1) : 0.12 + i * 0.08;
          const p = curve.getPoint(0.15 + progress * 0.8);
          m.position.copy(p);
          (m as THREE.Mesh).visible = i < myTicks || !active;
          ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = active ? 0.95 : 0.25;
        });
      }
    }

    // 3. The choice (0.61–0.83): snap — winner to wins, loser collapses
    if (t > 0.61) {
      const c = snap(Math.min((t - 0.61) / 0.22, 1));
      if (unresolved) {
        mat.color.copy(baseColor).lerp(COLOR.unresolved, c);
        mat.opacity = 0.9 - c * 0.45;
      } else if (won) {
        mat.color.lerp(COLOR.wins, c);
        line.scale.setZ(1);
      } else {
        mat.color.lerp(COLOR.closed, c);
        mat.opacity = 0.9 - c * 0.55;
        line.position.z = -c * 0.6; // recede in depth
      }
    }
  });

  return (
    <group>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive
        object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ transparent: true }))}
        ref={(obj: THREE.Line) => {
          lineRef.current = obj;
          if (obj) matRef.current = obj.material as THREE.LineBasicMaterial;
        }}
      />
      <group ref={markersRef}>
        {Array.from({ length: Math.max(myTicks, 3) }).map((_, i) => (
          <mesh key={i} position={curve.getPoint(0.2 + i * 0.15)}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color={COLOR.node} transparent opacity={0.25} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SplitNode({ winner, startAt }: { winner: Winner; startAt: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = Math.min((clock.elapsedTime - startAt) / DUR, 1);
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    if (winner === "UNRESOLVED" && t > 0.61) {
      mat.opacity = Math.max(0.15, 1 - (t - 0.61) * 3);
    } else {
      mat.opacity = 1;
    }
    const pulse = 1 + Math.sin(clock.elapsedTime * 2) * 0.06;
    ref.current.scale.setScalar(t < 0.28 ? pulse : 1);
  });
  return (
    <mesh ref={ref} position={[0, 0.9, 0]}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshBasicMaterial color={COLOR.wins} transparent />
    </mesh>
  );
}

/** §7 — the Divergence: balance → weighing → the choice → reading. */
export function DivergenceScene({
  winner,
  vector,
}: {
  winner: Winner;
  vector: Supports[];
}) {
  const startAt = useMemo(() => 0, []);
  return (
    <Canvas
      orthographic
      camera={{ zoom: 110, position: [0, 0, 5] }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      {/* stem above the split */}
      <primitive
        object={new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 1.6, 0),
            new THREE.Vector3(0, 0.9, 0),
          ]),
          new THREE.LineBasicMaterial({ color: COLOR.wins, transparent: true, opacity: 0.7 })
        )}
      />
      <SplitNode winner={winner} startAt={startAt} />
      <Path side="A" winner={winner} vector={vector} startAt={startAt} />
      <Path side="B" winner={winner} vector={vector} startAt={startAt} />
    </Canvas>
  );
}
