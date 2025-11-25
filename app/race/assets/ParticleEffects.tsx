"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Lightweight runtime diagnostics for particle systems. Registers number
// of mounted particle systems and aggregates total particle count.
function useParticleDiagnostics(count: number) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__GAME_DIAGS = (window as any).__GAME_DIAGS || {
      particleSystems: 0,
      totalParticles: 0,
    };
    const d = (window as any).__GAME_DIAGS;
    d.particleSystems = (d.particleSystems || 0) + 1;
    d.totalParticles = (d.totalParticles || 0) + count;
    return () => {
      const dd = (window as any).__GAME_DIAGS;
      if (!dd) return;
      dd.particleSystems = Math.max(0, (dd.particleSystems || 0) - 1);
      dd.totalParticles = Math.max(0, (dd.totalParticles || 0) - count);
    };
  }, [count]);
}

/**
 * Fire Effect - Animated rising particles with glow
 * Usage: <Fire position={[0, 0, 0]} scale={1} />
 */
export function Fire({
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  count = 200,
  color = "#ff4500",
  rotationSpeed = 0,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Start at base, spread outward
      positions[i3] = (Math.random() - 0.5) * scale;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = (Math.random() - 0.5) * scale;

      // Upward velocity with slight randomness
      velocities[i3] = (Math.random() - 0.5) * 0.5 * scale;
      velocities[i3 + 1] = (2 + Math.random()) * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.5 * scale;

      lifetimes[i] = Math.random();
      sizes[i] = (0.2 + Math.random() * 0.3) * scale;
    }

    return { positions, velocities, lifetimes, sizes };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    // Rotate entire fire effect
    if (groupRef.current && rotationSpeed !== 0) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const { velocities, lifetimes } = particles;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Update lifetime
      lifetimes[i] -= delta * 0.5;

      if (lifetimes[i] <= 0) {
        // Respawn particle
        positions[i3] = (Math.random() - 0.5) * scale;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = (Math.random() - 0.5) * scale;
        lifetimes[i] = 1;
      } else {
        // Move particle
        positions[i3] += velocities[i3] * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta;
        positions[i3 + 2] += velocities[i3 + 2] * delta;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__GAME_DEBUG__) {
      console.log(
        `[Particle] Fire mounted pos=${JSON.stringify(position)} count=${count}`
      );
    }
    return () => {
      if (typeof window !== "undefined" && (window as any).__GAME_DEBUG__)
        console.log(
          `[Particle] Fire unmounted pos=${JSON.stringify(position)}`
        );
    };
  }, [position, count]);

  return (
    <group ref={groupRef} position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={particles.positions}
            itemSize={3}
            args={[particles.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            count={count}
            array={particles.sizes}
            itemSize={1}
            args={[particles.sizes, 1]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.3 * scale}
          color={color}
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

/**
 * Smoke Effect - Slow rising, expanding particles
 * Usage: <Smoke position={[0, 2, 0]} scale={1} />
 */
export function Smoke({
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  count = 100,
  color = "#555555",
  rotationSpeed = 0,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 0.5 * scale;
      positions[i3 + 1] = Math.random() * 2 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 0.5 * scale;

      velocities[i3] = (Math.random() - 0.5) * 0.3 * scale;
      velocities[i3 + 1] = (0.5 + Math.random() * 0.5) * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.3 * scale;

      lifetimes[i] = Math.random();
      sizes[i] = (0.5 + Math.random() * 1) * scale;
    }

    return { positions, velocities, lifetimes, sizes };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    // Rotate entire smoke effect
    if (groupRef.current && rotationSpeed !== 0) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const sizes = pointsRef.current.geometry.attributes.size
      .array as Float32Array;
    const { velocities, lifetimes } = particles;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      lifetimes[i] -= delta * 0.3;

      if (lifetimes[i] <= 0) {
        positions[i3] = (Math.random() - 0.5) * 0.5 * scale;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.5 * scale;
        lifetimes[i] = 1;
        sizes[i] = (0.5 + Math.random() * 1) * scale;
      } else {
        positions[i3] += velocities[i3] * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta;
        positions[i3 + 2] += velocities[i3 + 2] * delta;
        // Smoke expands as it rises
        sizes[i] += delta * 0.5 * scale;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.size.needsUpdate = true;
  });

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__GAME_DEBUG__) {
      console.log(
        `[Particle] Smoke mounted pos=${JSON.stringify(
          position
        )} count=${count}`
      );
    }
    return () => {
      if (typeof window !== "undefined" && (window as any).__GAME_DEBUG__)
        console.log(
          `[Particle] Smoke unmounted pos=${JSON.stringify(position)}`
        );
    };
  }, [position, count]);

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={particles.sizes}
          itemSize={1}
          args={[particles.sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={1}
        color={color}
        transparent
        opacity={0.3}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Sparks Effect - Fast-moving bright particles
 * Usage: <Sparks position={[0, 0, 0]} scale={1} />
 */
export function Sparks({
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  count = 50,
  color = "#ffff00",
  rotationSpeed = 0,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;

      // Random directions with high speed
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = (2 + Math.random() * 3) * scale;

      velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i3 + 1] = Math.cos(phi) * speed;
      velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      lifetimes[i] = Math.random();
      opacities[i] = 1;
    }

    return { positions, velocities, lifetimes, opacities };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const opacitiesAttr = pointsRef.current.geometry.attributes.opacity
      .array as Float32Array;
    const { velocities, lifetimes, opacities } = particles;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      lifetimes[i] -= delta * 2;

      if (lifetimes[i] <= 0) {
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;
        lifetimes[i] = 1;
        opacities[i] = 1;
      } else {
        positions[i3] += velocities[i3] * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta - 5 * delta * delta; // gravity
        positions[i3 + 2] += velocities[i3 + 2] * delta;

        // Fade out as lifetime decreases
        opacities[i] = lifetimes[i];
      }

      opacitiesAttr[i] = opacities[i];
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.opacity.needsUpdate = true;
  });

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__GAME_DEBUG__) {
      console.log(
        `[Particle] Sparks mounted pos=${JSON.stringify(
          position
        )} count=${count}`
      );
    }
    return () => {
      if (typeof window !== "undefined" && (window as any).__GAME_DEBUG__)
        console.log(
          `[Particle] Sparks unmounted pos=${JSON.stringify(position)}`
        );
    };
  }, [position, count]);

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={count}
          array={particles.opacities}
          itemSize={1}
          args={[particles.opacities, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15 * scale}
        color={color}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        vertexColors
      />
    </points>
  );
}

/**
 * Rain Effect - Falling streaks
 * Usage: <Rain position={[0, 10, 0]} scale={1} />
 */
export function Rain({
  position = [0, 10, 0] as [number, number, number],
  scale = 1,
  count = 500,
  area = 20,
  rotationSpeed = 0,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * area * scale;
      positions[i3 + 1] = Math.random() * 10 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * area * scale;
      velocities[i] = -(10 + Math.random() * 5) * scale;
    }

    return { positions, velocities };
  }, [count, scale, area]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const { velocities } = particles;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3 + 1] += velocities[i] * delta;

      if (positions[i3 + 1] < 0) {
        positions[i3] = (Math.random() - 0.5) * area * scale;
        positions[i3 + 1] = 10 * scale;
        positions[i3 + 2] = (Math.random() - 0.5) * area * scale;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#a0d8f0"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Snow Effect - Gentle falling snowflakes with drift
 * Usage: <Snow position={[0, 10, 0]} scale={1} />
 */
export function Snow({
  position = [0, 10, 0] as [number, number, number],
  scale = 1,
  count = 300,
  area = 20,
  rotationSpeed = 0,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const driftPhases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * area * scale;
      positions[i3 + 1] = Math.random() * 20 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * area * scale;

      velocities[i3] = (Math.random() - 0.5) * 0.2 * scale;
      velocities[i3 + 1] = -(0.5 + Math.random() * 0.5) * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.2 * scale;

      driftPhases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, velocities, driftPhases };
  }, [count, scale, area]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const { velocities, driftPhases } = particles;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Falling with gentle drift
      positions[i3] +=
        (velocities[i3] + Math.sin(time + driftPhases[i]) * 0.3 * scale) *
        delta;
      positions[i3 + 1] += velocities[i3 + 1] * delta;
      positions[i3 + 2] +=
        (velocities[i3 + 2] + Math.cos(time + driftPhases[i]) * 0.3 * scale) *
        delta;

      // Reset when below ground
      if (positions[i3 + 1] < 0) {
        positions[i3] = (Math.random() - 0.5) * area * scale;
        positions[i3 + 1] = 20 * scale;
        positions[i3 + 2] = (Math.random() - 0.5) * area * scale;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#ffffff"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Stars/Twinkle Effect - Pulsing magical stars
 * Usage: <Stars position={[0, 5, 0]} scale={1} />
 */
export function Stars({
  position = [0, 5, 0] as [number, number, number],
  scale = 1,
  count = 50,
  color = "#ffeb3b",
  rotationSpeed = 0.5,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const radiuses = new Float32Array(count);
    const initialAngles = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Arrange in a sphere around position
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = (1 + Math.random() * 2) * scale;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.cos(phi);
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 1 + Math.random() * 2;
      radiuses[i] = radius;
      initialAngles[i] = theta;
    }

    return { positions, phases, speeds, radiuses, initialAngles };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current || !groupRef.current) return;

    const material = pointsRef.current.material as THREE.PointsMaterial;
    const time = state.clock.elapsedTime;

    // Pulsing effect on all stars
    material.opacity = 0.4 + Math.sin(time * 2) * 0.3;
    material.size = (0.3 + Math.sin(time * 3) * 0.1) * scale;

    // Rotate the entire group for orbiting effect
    groupRef.current.rotation.y += delta * rotationSpeed;

    // Individual star rotation and orbit
    if (rotationSpeed !== 0) {
      const positions = pointsRef.current.geometry.attributes.position
        .array as Float32Array;
      const { radiuses, initialAngles, phases } = particles;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const angle = initialAngles[i] + time * rotationSpeed * 0.3;
        const phi =
          Math.cos(time * 0.5 + phases[i]) * Math.PI * 0.5 + Math.PI * 0.5;
        const radius = radiuses[i];

        positions[i3] = radius * Math.sin(phi) * Math.cos(angle);
        positions[i3 + 1] = radius * Math.cos(phi);
        positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(angle);
      }

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <points ref={pointsRef}>
        // (debug) Rain mounted/unmounted
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={particles.positions}
            itemSize={3}
            args={[particles.positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.3 * scale}
          color={color}
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/**
 * Magic Sparkle Effect - Rising glittery particles
 * Usage: <MagicSparkle position={[0, 0, 0]} scale={1} />
 */
export function MagicSparkle({
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  count = 100,
  color = "#00ffff",
  rotationSpeed = 0,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2 * scale;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = (Math.random() - 0.5) * 2 * scale;

      velocities[i3] = (Math.random() - 0.5) * 0.5 * scale;
      velocities[i3 + 1] = (1 + Math.random() * 2) * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.5 * scale;

      lifetimes[i] = Math.random();
      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, velocities, lifetimes, phases };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const { velocities, lifetimes, phases } = particles;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      lifetimes[i] += delta * 0.3;

      if (lifetimes[i] > 1) {
        // Reset particle
        positions[i3] = (Math.random() - 0.5) * 2 * scale;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = (Math.random() - 0.5) * 2 * scale;
        lifetimes[i] = 0;
      } else {
        // Spiral upward
        const spiral = Math.sin(time * 3 + phases[i]) * scale;
        positions[i3] += (velocities[i3] + spiral * 0.5) * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta;
        positions[i3 + 2] +=
          (velocities[i3 + 2] + Math.cos(time * 3 + phases[i]) * scale * 0.5) *
          delta;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2 * scale}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Confetti Effect - Colorful falling celebration particles
 * Usage: <Confetti position={[0, 10, 0]} scale={1} />
 */
export function Confetti({
  position = [0, 10, 0] as [number, number, number],
  scale = 1,
  count = 200,
  rotationSpeed = 0,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const rotations = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const confettiColors = [
      [1, 0, 0], // red
      [0, 1, 0], // green
      [1, 0.84, 0], // gold
      [0, 0.5, 1], // blue
      [1, 1, 1], // white
      [1, 0.41, 0.71], // pink
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 5 * scale;
      positions[i3 + 1] = Math.random() * 15 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 5 * scale;

      velocities[i3] = (Math.random() - 0.5) * 2 * scale;
      velocities[i3 + 1] = -(1 + Math.random() * 2) * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 2 * scale;

      rotations[i] = Math.random() * Math.PI * 2;

      // Random confetti color
      const color =
        confettiColors[Math.floor(Math.random() * confettiColors.length)];
      colors[i3] = color[0];
      colors[i3 + 1] = color[1];
      colors[i3 + 2] = color[2];
    }

    return { positions, velocities, rotations, colors };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const { velocities, rotations } = particles;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Falling with air resistance and tumbling
      positions[i3] += velocities[i3] * delta * Math.cos(rotations[i]);
      positions[i3 + 1] += velocities[i3 + 1] * delta;
      positions[i3 + 2] += velocities[i3 + 2] * delta * Math.sin(rotations[i]);

      rotations[i] += delta * 5;

      // Reset when below ground
      if (positions[i3 + 1] < 0) {
        positions[i3] = (Math.random() - 0.5) * 5 * scale;
        positions[i3 + 1] = 15 * scale;
        positions[i3 + 2] = (Math.random() - 0.5) * 5 * scale;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.25 * scale}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Confetti Explosion - Colorful bursting celebration particles
 * Usage: <ConfettiExplosion position={[0, 5, 0]} scale={1} colors={['#ff0000', '#00ff00']} />
 */
export function ConfettiExplosion({
  position = [0, 5, 0] as [number, number, number],
  scale = 1,
  count = 150,
  rotationSpeed = 0,
  colors,
}: {
  position?: [number, number, number];
  scale?: number;
  count?: number;
  rotationSpeed?: number;
  colors?: string[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const colorArray = new Float32Array(count * 3);

    // Default confetti colors if none provided
    const defaultColors = [
      "#ff3352",
      "#ffe619",
      "#3366ff",
      "#33ff4d",
      "#ff66cc",
      "#ff9933",
      "#cc4dff",
    ];
    const colorPalette = (
      colors && colors.length > 0 ? colors : defaultColors
    ).map((hex) => {
      const color = new THREE.Color(hex);
      return [color.r, color.g, color.b];
    });

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Start at center
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;

      // Random directions with high speed (like sparks)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = (2 + Math.random() * 3) * scale;

      velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i3 + 1] = Math.cos(phi) * speed;
      velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      lifetimes[i] = Math.random();

      // Assign random color from palette
      const colorIndex = Math.floor(Math.random() * colorPalette.length);
      const color = colorPalette[colorIndex];
      colorArray[i3] = color[0];
      colorArray[i3 + 1] = color[1];
      colorArray[i3 + 2] = color[2];
    }

    return { positions, velocities, lifetimes, colors: colorArray };
  }, [count, scale, colors]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !groupRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const { velocities, lifetimes } = particles;

    // Apply group rotation
    groupRef.current.rotation.y += delta * rotationSpeed;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      lifetimes[i] -= delta * 2;

      if (lifetimes[i] <= 0) {
        // Reset to center
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;
        lifetimes[i] = 1;
      } else {
        // Update position with velocity and gravity (same as sparks)
        positions[i3] += velocities[i3] * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta - 5 * delta * delta; // gravity
        positions[i3 + 2] += velocities[i3 + 2] * delta;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group ref={groupRef} position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={particles.positions}
            itemSize={3}
            args={[particles.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            count={count}
            array={particles.colors}
            itemSize={3}
            args={[particles.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.3 * scale}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

/**
 * Christmas Lights Twinkle - Small colored sparkles that fade in/out like string lights
 * Usage: <ChristmasLightsTwinkle position={[0, 3, 0]} scale={1} />
 */
export function ChristmasLightsTwinkle({
  position = [0, 3, 0] as [number, number, number],
  scale = 1,
  count = 50,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    const lightColors = [
      [1, 0, 0], // red
      [0, 1, 0], // green
      [0, 0.5, 1], // blue
      [1, 1, 0], // yellow
      [1, 0, 1], // magenta
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 10 * scale;
      positions[i3 + 1] = (Math.random() - 0.5) * 2 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 10 * scale;

      const color = lightColors[Math.floor(Math.random() * lightColors.length)];
      colors[i3] = color[0];
      colors[i3 + 1] = color[1];
      colors[i3 + 2] = color[2];

      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, colors, phases };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const opacity = 0.3 + Math.sin(time * 2 + particles.phases[i]) * 0.7;
      (pointsRef.current.material as THREE.PointsMaterial).opacity =
        Math.abs(opacity);
    }
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2 * scale}
        vertexColors
        transparent
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Tree String Lights - arrange twinkles along horizontal rings to simulate
 * wrapped string lights on a tree. This produces a more natural 'string'
 * look than a diffuse cloud.
 * Usage: <TreeStringLights position={[0,2.2,0]} scale={0.6} tiers={[1.5,2.8,4]} counts={[8,8,6]} />
 */
export function TreeStringLights({
  position = [0, 2.2, 0] as [number, number, number],
  scale = 1.1,
  tiers = [1.5, 2.8, 8],
  counts = [8, 8, 6],
}: {
  position?: [number, number, number];
  scale?: number;
  tiers?: number[];
  counts?: number[];
}) {
  // compute total count
  const total = counts.reduce((a, b) => a + b, 0);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const phases = new Float32Array(total);
    const lightColors = [
      [1, 0.1, 0.1],
      [0.1, 1, 0.1],
      [0.1, 0.6, 1],
      [1, 0.9, 0.2],
      [1, 0.2, 0.9],
    ];

    let idx = 0;
    const topTier = Math.max(...tiers);
    for (let t = 0; t < tiers.length; t++) {
      const y = tiers[t] * scale - tiers[0] * scale * 0.2; // small offset
      // Make radius decrease towards the top so the tree is wider at the base
      const radius = ((topTier - tiers[t]) * 0.5 + 0.3) * scale;
      const n = counts[t] || 6;
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.06;
        const r = radius * (0.9 + Math.random() * 0.2);
        const x = Math.cos(angle) * r;
        // Flip Z so the ring wraps the tree in the expected direction
        const z = -Math.sin(angle) * r;
        const i3 = idx * 3;
        positions[i3] = x;
        positions[i3 + 1] = y + (Math.random() - 0.5) * 0.06;
        positions[i3 + 2] = z;
        const color =
          lightColors[Math.floor(Math.random() * lightColors.length)];
        colors[i3] = color[0];
        colors[i3 + 1] = color[1];
        colors[i3 + 2] = color[2];
        phases[idx] = Math.random() * Math.PI * 2;
        idx++;
      }
    }

    // copy base colors so we can modulate brightness per-frame
    const baseColors = new Float32Array(colors);
    return { positions, colors, phases, baseColors };
  }, [tiers.join("|"), counts.join("|"), scale, total]);

  useParticleDiagnostics(total);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.elapsedTime;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    // base size
    mat.size = 0.18 * scale;
    mat.opacity = 1.0;
    // per-point color brightness modulation using stored phases
    const cols = particles.colors;
    const base = (particles as any).baseColors as Float32Array | undefined;
    if (base) {
      for (let i = 0; i < total; i++) {
        const ph = particles.phases[i];
        const i3 = i * 3;
        // stronger sparkle: brightness range ~0.3 .. 1.8, faster frequency
        const b = 0.3 + 1.5 * ((Math.sin(time * 6 + ph) + 1) / 2);
        // mix towards white at peak to give a bright sparkle
        cols[i3] = Math.min(1, base[i3] * b + (1 - base[i3]) * (b - 1));
        cols[i3 + 1] = Math.min(1, base[i3 + 1] * b + (1 - base[i3 + 1]) * (b - 1));
        cols[i3 + 2] = Math.min(1, base[i3 + 2] * b + (1 - base[i3 + 2]) * (b - 1));
      }
      // mark attribute for update
      const geom = pointsRef.current.geometry as THREE.BufferGeometry;
      if (geom && geom.attributes && geom.attributes.color) {
        (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      }
    }
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={total}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={total}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.18 * scale}
        vertexColors
        transparent
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Holly Leaves - Falling green holly leaves with red berries
 * Usage: <HollyLeaves position={[0, 5, 0]} scale={1} />
 */
export function HollyLeaves({
  position = [0, 5, 0] as [number, number, number],
  scale = 1,
  count = 30,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 5 * scale;
      positions[i3 + 1] = Math.random() * 5 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 5 * scale;

      velocities[i3] = (Math.random() - 0.5) * 0.5 * scale;
      velocities[i3 + 1] = -0.5 * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.5 * scale;

      // 80% green leaves, 20% red berries
      if (Math.random() > 0.2) {
        colors[i3] = 0.1;
        colors[i3 + 1] = 0.5;
        colors[i3 + 2] = 0.1;
        sizes[i] = 0.3 * scale;
      } else {
        colors[i3] = 0.8;
        colors[i3 + 1] = 0.1;
        colors[i3 + 2] = 0.1;
        sizes[i] = 0.15 * scale;
      }
    }

    return { positions, velocities, colors, sizes };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] += particles.velocities[i3] * delta * 60;
      positions[i3 + 1] += particles.velocities[i3 + 1] * delta * 60;
      positions[i3 + 2] += particles.velocities[i3 + 2] * delta * 60;

      if (positions[i3 + 1] < -2 * scale) {
        positions[i3 + 1] = 5 * scale;
        positions[i3] = (Math.random() - 0.5) * 5 * scale;
        positions[i3 + 2] = (Math.random() - 0.5) * 5 * scale;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={particles.sizes}
          itemSize={1}
          args={[particles.sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial vertexColors transparent sizeAttenuation />
    </points>
  );
}

/**
 * Candy Canes - Rotating red/white striped particles
 * Usage: <CandyCanes position={[0, 3, 0]} scale={1} />
 */
export function CandyCanes({
  position = [0, 3, 0] as [number, number, number],
  scale = 1,
  count = 20,
}) {
  const groupRef = useRef<THREE.Group>(null);

  const candies = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8 * scale,
      y: Math.random() * 6 * scale,
      z: (Math.random() - 0.5) * 8 * scale,
      rotationSpeed: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.rotation.y =
        state.clock.elapsedTime * candies[i].rotationSpeed + candies[i].phase;
      child.position.y =
        candies[i].y +
        Math.sin(state.clock.elapsedTime + candies[i].phase) * 0.2 * scale;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {candies.map((candy, i) => (
        <group key={i} position={[candy.x, candy.y, candy.z]}>
          <mesh>
            <cylinderGeometry
              args={[0.05 * scale, 0.05 * scale, 0.5 * scale, 8]}
            />
            <meshStandardMaterial color="#ff0000" />
          </mesh>
          <mesh position={[0, 0.15 * scale, 0]}>
            <cylinderGeometry
              args={[0.05 * scale, 0.05 * scale, 0.1 * scale, 8]}
            />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, -0.15 * scale, 0]}>
            <cylinderGeometry
              args={[0.05 * scale, 0.05 * scale, 0.1 * scale, 8]}
            />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Ornament Sparkle - Glittery reflective particles like shiny baubles
 * Usage: <OrnamentSparkle position={[0, 3, 0]} scale={1} />
 */
export function OrnamentSparkle({
  position = [0, 3, 0] as [number, number, number],
  scale = 1,
  count = 40,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const ornamentColors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0.84, 0],
      [0.5, 0, 0.5],
      [1, 0.75, 0.8],
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 2 * scale;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.cos(phi);
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const color =
        ornamentColors[Math.floor(Math.random() * ornamentColors.length)];
      colors[i3] = color[0];
      colors[i3 + 1] = color[1];
      colors[i3 + 2] = color[2];

      sizes[i] = (0.2 + Math.random() * 0.3) * scale;
    }

    return { positions, colors, sizes };
  }, [count, scale]);

  useParticleDiagnostics(count);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.3;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={particles.sizes}
          itemSize={1}
          args={[particles.sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial vertexColors transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

/**
 * Gingerbread Cookies - Falling cookie shapes
 * Usage: <GingerbreadCookies position={[0, 5, 0]} scale={1} />
 */
export function GingerbreadCookies({
  position = [0, 5, 0] as [number, number, number],
  scale = 1,
  count = 15,
}) {
  const groupRef = useRef<THREE.Group>(null);

  const cookies = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 6 * scale,
      y: Math.random() * 8 * scale,
      z: (Math.random() - 0.5) * 6 * scale,
      fallSpeed: 0.5 + Math.random() * 0.5,
      rotationSpeed: (Math.random() - 0.5) * 2,
    }));
  }, [count, scale]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.position.y -= cookies[i].fallSpeed * delta;
      child.rotation.z += cookies[i].rotationSpeed * delta;

      if (child.position.y < -2 * scale) {
        child.position.y = 8 * scale;
        child.position.x = (Math.random() - 0.5) * 6 * scale;
        child.position.z = (Math.random() - 0.5) * 6 * scale;
      }
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {cookies.map((cookie, i) => (
        <mesh key={i} position={[cookie.x, cookie.y, cookie.z]}>
          <cylinderGeometry
            args={[0.15 * scale, 0.15 * scale, 0.05 * scale, 6]}
          />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Presents/Gift Boxes - Small colorful box particles
 * Usage: <Presents position={[0, 0, 0]} scale={1} />
 */
export function Presents({
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  count = 20,
}) {
  const groupRef = useRef<THREE.Group>(null);

  const presents = useMemo(() => {
    const colors = [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffff00",
      "#ff00ff",
      "#00ffff",
    ];
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 10 * scale,
      y: Math.random() * 2 * scale,
      z: (Math.random() - 0.5) * 10 * scale,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 0.2 + Math.random() * 0.3,
      bobPhase: Math.random() * Math.PI * 2,
    }));
  }, [count, scale]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.position.y =
        presents[i].y +
        Math.sin(state.clock.elapsedTime * 2 + presents[i].bobPhase) *
          0.1 *
          scale;
      child.rotation.y = state.clock.elapsedTime * 0.5;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {presents.map((present, i) => (
        <group key={i} position={[present.x, present.y, present.z]}>
          <mesh>
            <boxGeometry
              args={[
                present.size * scale,
                present.size * scale,
                present.size * scale,
              ]}
            />
            <meshStandardMaterial color={present.color} />
          </mesh>
          <mesh position={[0, (present.size * scale) / 2 + 0.01, 0]}>
            <boxGeometry
              args={[present.size * scale, 0.05 * scale, 0.05 * scale]}
            />
            <meshStandardMaterial color="#ffd700" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Tinsel Shimmer - Thin, reflective metallic strands that flutter
 * Usage: <TinselShimmer position={[0, 3, 0]} scale={1} />
 */
export function TinselShimmer({
  position = [0, 3, 0] as [number, number, number],
  scale = 1,
  count = 50,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 4 * scale;
      positions[i3 + 1] = Math.random() * 5 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 4 * scale;

      const brightness = 0.7 + Math.random() * 0.3;
      colors[i3] = brightness;
      colors[i3 + 1] = brightness * 0.9;
      colors[i3 + 2] = brightness;

      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, colors, phases };
  }, [count, scale]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] +=
        Math.sin(state.clock.elapsedTime * 2 + particles.phases[i]) *
        0.01 *
        scale;
      positions[i3 + 2] +=
        Math.cos(state.clock.elapsedTime * 2 + particles.phases[i]) *
        0.01 *
        scale;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1 * scale}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Jingle Bells - Small golden bell particles with slight swing motion
 * Usage: <JingleBells position={[0, 3, 0]} scale={1} />
 */
export function JingleBells({
  position = [0, 3, 0] as [number, number, number],
  scale = 1,
  count = 15,
}) {
  const groupRef = useRef<THREE.Group>(null);

  const bells = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 6 * scale,
      y: Math.random() * 4 * scale,
      z: (Math.random() - 0.5) * 6 * scale,
      swingPhase: Math.random() * Math.PI * 2,
      swingSpeed: 2 + Math.random() * 2,
    }));
  }, [count, scale]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.rotation.z =
        Math.sin(
          state.clock.elapsedTime * bells[i].swingSpeed + bells[i].swingPhase
        ) * 0.3;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {bells.map((bell, i) => (
        <mesh key={i} position={[bell.x, bell.y, bell.z]}>
          <sphereGeometry args={[0.1 * scale, 8, 8]} />
          <meshStandardMaterial
            color="#FFD700"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Pine Needles - Small green needle-like particles falling from trees
 * Usage: <PineNeedles position={[0, 5, 0]} scale={1} />
 */
export function PineNeedles({
  position = [0, 5, 0] as [number, number, number],
  scale = 1,
  count = 80,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 6 * scale;
      positions[i3 + 1] = Math.random() * 6 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 6 * scale;

      velocities[i3] = (Math.random() - 0.5) * 0.3 * scale;
      velocities[i3 + 1] = -0.3 * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.3 * scale;

      colors[i3] = 0.1 + Math.random() * 0.2;
      colors[i3 + 1] = 0.3 + Math.random() * 0.3;
      colors[i3 + 2] = 0.1 + Math.random() * 0.2;
    }

    return { positions, velocities, colors };
  }, [count, scale]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] += particles.velocities[i3] * delta * 60;
      positions[i3 + 1] += particles.velocities[i3 + 1] * delta * 60;
      positions[i3 + 2] += particles.velocities[i3 + 2] * delta * 60;

      if (positions[i3 + 1] < -1 * scale) {
        positions[i3 + 1] = 6 * scale;
        positions[i3] = (Math.random() - 0.5) * 6 * scale;
        positions[i3 + 2] = (Math.random() - 0.5) * 6 * scale;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05 * scale}
        vertexColors
        transparent
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Icicles - Downward-pointing crystal formations that grow/shrink
 * Usage: <Icicles position={[0, 3, 0]} scale={1} />
 */
export function Icicles({
  position = [0, 3, 0] as [number, number, number],
  scale = 1,
  count = 20,
}) {
  const groupRef = useRef<THREE.Group>(null);

  const icicles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8 * scale,
      y: -Math.random() * 2 * scale,
      z: (Math.random() - 0.5) * 8 * scale,
      length: 0.3 + Math.random() * 0.5,
      growPhase: Math.random() * Math.PI * 2,
    }));
  }, [count, scale]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const growFactor =
        0.8 +
        Math.sin(state.clock.elapsedTime * 0.5 + icicles[i].growPhase) * 0.2;
      child.scale.y = growFactor;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {icicles.map((icicle, i) => (
        <mesh key={i} position={[icicle.x, icicle.y, icicle.z]}>
          <coneGeometry args={[0.05 * scale, icicle.length * scale, 6]} />
          <meshPhysicalMaterial
            color="#b3e5fc"
            transparent
            opacity={0.7}
            transmission={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Aurora/Northern Lights - Wavy, flowing colored bands
 * Usage: <AuroraLights position={[0, 5, 0]} scale={1} />
 */
export function AuroraLights({
  position = [0, 5, 0] as [number, number, number],
  scale = 1,
  count = 100,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 15 * scale;
      positions[i3 + 1] = (Math.random() - 0.5) * 2 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 15 * scale;

      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        colors[i3] = 0.2;
        colors[i3 + 1] = 1;
        colors[i3 + 2] = 0.5; // Green
      } else if (colorChoice < 0.66) {
        colors[i3] = 0.4;
        colors[i3 + 1] = 0.6;
        colors[i3 + 2] = 1; // Blue
      } else {
        colors[i3] = 0.8;
        colors[i3 + 1] = 0.3;
        colors[i3 + 2] = 1; // Purple
      }

      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, colors, phases };
  }, [count, scale]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3 + 1] =
        (Math.random() - 0.5) * 2 * scale +
        Math.sin(state.clock.elapsedTime + particles.phases[i]) * scale;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.4 * scale}
        vertexColors
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Angel Dust/Heavenly Glow - Soft golden particles with bloom effect
 * Usage: <AngelDust position={[0, 3, 0]} scale={1} />
 */
export function AngelDust({
  position = [0, 3, 0] as [number, number, number],
  scale = 1,
  count = 80,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 2 * scale;
      const theta = Math.random() * Math.PI * 2;

      positions[i3] = radius * Math.cos(theta);
      positions[i3 + 1] = Math.random() * 4 * scale;
      positions[i3 + 2] = radius * Math.sin(theta);

      velocities[i3] = (Math.random() - 0.5) * 0.2 * scale;
      velocities[i3 + 1] = (0.2 + Math.random() * 0.3) * scale;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.2 * scale;

      lifetimes[i] = Math.random();
    }

    return { positions, velocities, lifetimes };
  }, [count, scale]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      particles.lifetimes[i] += delta * 0.3;

      if (particles.lifetimes[i] > 1) {
        particles.lifetimes[i] = 0;
        const radius = Math.random() * 2 * scale;
        const theta = Math.random() * Math.PI * 2;
        positions[i3] = radius * Math.cos(theta);
        positions[i3 + 1] = 0;
        positions[i3 + 2] = radius * Math.sin(theta);
      } else {
        positions[i3] += particles.velocities[i3] * delta * 60;
        positions[i3 + 1] += particles.velocities[i3 + 1] * delta * 60;
        positions[i3 + 2] += particles.velocities[i3 + 2] * delta * 60;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15 * scale}
        color="#FFD700"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Sleigh Trail - Speed lines with sparkles
 * Usage: <SleighTrail position={[0, 1, 0]} scale={1} />
 */
export function SleighTrail({
  position = [0, 1, 0] as [number, number, number],
  scale = 1,
  count = 60,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = -i * 0.2 * scale;
      positions[i3 + 1] = (Math.random() - 0.5) * 0.5 * scale;
      positions[i3 + 2] = (Math.random() - 0.5) * 0.5 * scale;

      velocities[i3] = -2 * scale;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;

      const brightness = Math.random();
      colors[i3] = 1;
      colors[i3 + 1] = 0.8 + brightness * 0.2;
      colors[i3 + 2] = brightness * 0.5;
    }

    return { positions, velocities, colors };
  }, [count, scale]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] += particles.velocities[i3] * delta * 60;

      if (positions[i3] < -15 * scale) {
        positions[i3] = 2 * scale;
        positions[i3 + 1] = (Math.random() - 0.5) * 0.5 * scale;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.5 * scale;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15 * scale}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Frosted Breath - Misty puffs (like cold breath in winter)
 * Usage: <FrostedBreath position={[0, 1.5, 0]} scale={1} />
 */
export function FrostedBreath({
  position = [0, 1.5, 0] as [number, number, number],
  scale = 1,
  count = 40,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;

      velocities[i3] = (Math.random() - 0.5) * 0.5 * scale;
      velocities[i3 + 1] = (0.2 + Math.random() * 0.3) * scale;
      velocities[i3 + 2] = (0.5 + Math.random() * 0.5) * scale;

      lifetimes[i] = Math.random();
      sizes[i] = (0.1 + Math.random() * 0.2) * scale;
    }

    return { positions, velocities, lifetimes, sizes };
  }, [count, scale]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      particles.lifetimes[i] += delta * 0.5;

      if (particles.lifetimes[i] > 1) {
        particles.lifetimes[i] = 0;
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;
      } else {
        positions[i3] += particles.velocities[i3] * delta * 60;
        positions[i3 + 1] += particles.velocities[i3 + 1] * delta * 60;
        positions[i3 + 2] += particles.velocities[i3 + 2] * delta * 60;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={particles.sizes}
          itemSize={1}
          args={[particles.sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.3 * scale}
        color="#e3f2fd"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Christmas Tree Sparkles - Green triangle particles with colored lights
 * Usage: <ChristmasTreeSparkles position={[0, 2, 0]} scale={1} />
 */
export function ChristmasTreeSparkles({
  position = [0, 2, 0] as [number, number, number],
  scale = 1,
  count = 30,
}) {
  const groupRef = useRef<THREE.Group>(null);

  const trees = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 10 * scale,
      y: 0,
      z: (Math.random() - 0.5) * 10 * scale,
      size: 0.3 + Math.random() * 0.4,
      twinklePhase: Math.random() * Math.PI * 2,
    }));
  }, [count, scale]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.children[1].scale.setScalar(
        0.5 +
          Math.sin(state.clock.elapsedTime * 3 + trees[i].twinklePhase) * 0.5
      );
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, tree.y, tree.z]}>
          <mesh>
            <coneGeometry
              args={[tree.size * scale, tree.size * 2 * scale, 4]}
            />
            <meshStandardMaterial color="#1b5e20" />
          </mesh>
          <mesh position={[0, tree.size * scale, 0]}>
            <sphereGeometry args={[0.1 * scale, 8, 8]} />
            <meshStandardMaterial
              color={
                ["#ff0000", "#00ff00", "#0000ff", "#ffff00"][
                  Math.floor(Math.random() * 4)
                ]
              }
              emissive="#ffffff"
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Wreath Glow - Circular arrangement of particles
 * Usage: <WreathGlow position={[0, 2, 0]} scale={1} />
 */
export function WreathGlow({
  position = [0, 2, 0] as [number, number, number],
  scale = 1,
  count = 50,
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = (i / count) * Math.PI * 2;
      const radius = 1.5 * scale;

      positions[i3] = radius * Math.cos(angle);
      positions[i3 + 1] = 0;
      positions[i3 + 2] = radius * Math.sin(angle);

      if (Math.random() > 0.8) {
        colors[i3] = 1;
        colors[i3 + 1] = 0;
        colors[i3 + 2] = 0; // Red berries
      } else {
        colors[i3] = 0.1;
        colors[i3 + 1] = 0.5;
        colors[i3 + 2] = 0.1; // Green
      }
    }

    return { positions, colors };
  }, [count, scale]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.2;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.2 * scale} vertexColors sizeAttenuation />
    </points>
  );
}

/**
 * Poinsettia Petals - Red flower petals falling
 * Usage: <PoinsettiaPetals position={[0, 5, 0]} scale={1} />
 */
export function PoinsettiaPetals({
  position = [0, 5, 0] as [number, number, number],
  scale = 1,
  count = 40,
}) {
  const groupRef = useRef<THREE.Group>(null);

  const petals = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 6 * scale,
      y: Math.random() * 8 * scale,
      z: (Math.random() - 0.5) * 6 * scale,
      fallSpeed: 0.3 + Math.random() * 0.4,
      rotationSpeed: (Math.random() - 0.5) * 3,
      swayPhase: Math.random() * Math.PI * 2,
    }));
  }, [count, scale]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.position.y -= petals[i].fallSpeed * delta;
      child.position.x +=
        Math.sin(state.clock.elapsedTime * 2 + petals[i].swayPhase) *
        0.01 *
        scale;
      child.rotation.z += petals[i].rotationSpeed * delta;

      if (child.position.y < -2 * scale) {
        child.position.y = 8 * scale;
        child.position.x = (Math.random() - 0.5) * 6 * scale;
        child.position.z = (Math.random() - 0.5) * 6 * scale;
      }
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {petals.map((petal, i) => (
        <mesh key={i} position={[petal.x, petal.y, petal.z]}>
          <circleGeometry args={[0.15 * scale, 6]} />
          <meshStandardMaterial color="#c62828" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
