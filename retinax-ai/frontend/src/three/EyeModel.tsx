import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Procedural anatomical eye that reads as an eye even at oblique angles.
 *
 *  Scene composition (front to back, +Z is camera-facing):
 *      cornea highlight (small white disc)
 *      pupil (very dark sphere, glossy)
 *      iris (red striated disc embedded in the cornea)
 *      cornea (transparent dome that catches highlights)
 *      sclera (off-white sphere, faintly red-veined)
 *
 *  We tilt the eye 12° toward the camera so the iris/pupil are *always*
 *  visible — the previous version showed only the dark sclera.
 */

function buildIrisTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Radial base
  const grad = ctx.createRadialGradient(size / 2, size / 2, 30, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, "#000000");          // pupil core
  grad.addColorStop(0.18, "#000000");
  grad.addColorStop(0.22, "#1a0405");         // pupil edge → iris
  grad.addColorStop(0.45, "#7c1019");         // mid iris
  grad.addColorStop(0.85, "#dc2626");         // iris ring
  grad.addColorStop(0.97, "#5b0a10");         // limbus
  grad.addColorStop(1.0, "#FFFFFF");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Radial striations
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 240; i++) {
    const angle = (i / 240) * Math.PI * 2;
    const r1 = size * 0.11 + Math.random() * 4;
    const r2 = size * 0.45 + Math.random() * 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
    ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
    ctx.strokeStyle = `rgba(255, ${80 + Math.floor(Math.random() * 60)}, ${
      40 + Math.floor(Math.random() * 30)
    }, ${0.06 + Math.random() * 0.18})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.stroke();
  }
  ctx.restore();

  // Dark limbus ring
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.lineWidth = size * 0.018;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

function buildScleraTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Off-white base
  ctx.fillStyle = "#f4eded";
  ctx.fillRect(0, 0, size, size);

  // Faint pinkish wash near edges
  const wash = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.55);
  wash.addColorStop(0, "rgba(255,255,255,0)");
  wash.addColorStop(1, "rgba(220,38,38,0.12)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);

  // Veins (thin red squiggles)
  ctx.strokeStyle = "rgba(180, 30, 30, 0.45)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 60; i++) {
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let x = startX;
    let y = startY;
    for (let s = 0; s < 12; s++) {
      x += (Math.random() - 0.5) * 24;
      y += (Math.random() - 0.5) * 24;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function Eye({ scrollProgressRef }: { scrollProgressRef: React.MutableRefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const eyeball = useRef<THREE.Group>(null);
  const upperLid = useRef<THREE.Mesh>(null);
  const lowerLid = useRef<THREE.Mesh>(null);

  const irisTex = useMemo(() => buildIrisTexture(), []);
  const scleraTex = useMemo(() => buildScleraTexture(), []);

  // blink timer
  const blinkRef = useRef({ next: 3 + Math.random() * 4, t: 0 });

  useFrame((_, delta) => {
    if (!root.current || !eyeball.current) return;

    // Subtle floating yaw + pitch — makes it feel alive
    const t = performance.now() * 0.0008;
    eyeball.current.rotation.y = Math.sin(t) * 0.45;
    eyeball.current.rotation.x = Math.sin(t * 0.7) * 0.18;

    // Scale + bounce on scroll
    const p = scrollProgressRef.current;
    const targetScale = 1 + p * 0.45;
    root.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.06);
    root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, p * -0.35, 0.05);

    // Blink loop
    blinkRef.current.t += delta;
    if (blinkRef.current.t > blinkRef.current.next) {
      const phase = blinkRef.current.t - blinkRef.current.next;
      const closing = Math.min(1, phase / 0.12);
      const opening = Math.max(0, 1 - (phase - 0.12) / 0.16);
      const close = phase < 0.12 ? closing : opening;
      if (upperLid.current) upperLid.current.position.y = 0.95 - close * 0.95;
      if (lowerLid.current) lowerLid.current.position.y = -0.95 + close * 0.95;
      if (phase > 0.32) {
        blinkRef.current.t = 0;
        blinkRef.current.next = 3 + Math.random() * 4;
      }
    }
  });

  return (
    <group ref={root} rotation={[0, 0.18, 0]}>
      <group ref={eyeball}>
        {/* Sclera */}
        <mesh>
          <sphereGeometry args={[1.3, 96, 96]} />
          <meshStandardMaterial map={scleraTex} roughness={0.55} metalness={0.05} />
        </mesh>

        {/* Iris (textured disc embedded into the front of the cornea) */}
        <mesh position={[0, 0, 1.16]}>
          <circleGeometry args={[0.62, 96]} />
          <meshStandardMaterial
            map={irisTex}
            transparent
            roughness={0.35}
            metalness={0.15}
            emissive="#7a1119"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Pupil — small dark hemisphere for depth */}
        <mesh position={[0, 0, 1.18]}>
          <circleGeometry args={[0.2, 64]} />
          <meshBasicMaterial color="#000000" />
        </mesh>

        {/* Cornea — clear refractive dome */}
        <mesh position={[0, 0, 0.62]}>
          <sphereGeometry args={[0.8, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
          <meshPhysicalMaterial
            transmission={0.85}
            transparent
            roughness={0.05}
            thickness={0.4}
            ior={1.376}
            clearcoat={1}
            clearcoatRoughness={0.05}
            color="#ffffff"
            opacity={0.45}
          />
        </mesh>

        {/* Catchlight (the bright glint that sells the realism) */}
        <mesh position={[-0.18, 0.22, 1.21]}>
          <circleGeometry args={[0.07, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.1, 0.14, 1.205]}>
          <circleGeometry args={[0.03, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Upper lid (sliding lozenge) */}
      <mesh ref={upperLid} position={[0, 0.95, 0]}>
        <sphereGeometry args={[1.45, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
      {/* Lower lid */}
      <mesh ref={lowerLid} position={[0, -0.95, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[1.45, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>

      {/* Outer rim — the "limbus shadow" that frames the eye against black */}
      <mesh>
        <torusGeometry args={[1.3, 0.04, 24, 96]} />
        <meshStandardMaterial color="#1F1F1F" roughness={0.8} />
      </mesh>
    </group>
  );
}

interface Props {
  scrollProgressRef: React.MutableRefObject<number>;
}

export default function EyeModel({ scrollProgressRef }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <ambientLight intensity={0.55} />
      {/* Key light from upper-left, slightly red */}
      <pointLight position={[-3, 4, 4]} intensity={2.4} color="#ffffff" />
      {/* Rim light (DR red) */}
      <pointLight position={[4, -2, 3]} intensity={1.6} color="#dc2626" />
      {/* Fill */}
      <pointLight position={[0, 0, 5]} intensity={0.6} color="#ffffff" />
      <Eye scrollProgressRef={scrollProgressRef} />
    </Canvas>
  );
}
