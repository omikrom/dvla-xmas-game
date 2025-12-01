"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";

export type PenguinProps = {
  id?: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
  wanderRadius?: number;
};

export function Penguin({
  id,
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
  wanderRadius = 8,
}: PenguinProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;

  const groupRef = useRef<THREE.Group | null>(null);
  const waddleRef = useRef<THREE.Group | null>(null);
  const leftWingRef = useRef<THREE.Group | null>(null);
  const rightWingRef = useRef<THREE.Group | null>(null);
  const leftFootRef = useRef<THREE.Mesh | null>(null);
  const rightFootRef = useRef<THREE.Mesh | null>(null);
  
  // Launch state - penguin gets thrown when hit
  const launchState = useRef({
    isLaunched: false,
    vx: 0,
    vy: 0,
    vz: 0,
    x: position[0],
    y: 0,
    z: position[2],
    rotX: 0,
    rotZ: 0,
    spinX: 0,
    spinZ: 0,
    landedAt: 0,
    lastHitTime: 0,
  });
  
  // Movement state for waddling
  const moveState = useRef({
    startX: position[0],
    startZ: position[2],
    targetX: position[0],
    targetZ: position[2],
    currentX: position[0],
    currentZ: position[2],
    angle: Math.random() * Math.PI * 2,
    speed: 0.8 + Math.random() * 0.4,
    nextMoveTime: 0,
    isMoving: false,
    pauseDuration: 1 + Math.random() * 2,
  });

  // Penguin colors
  const bodyColor = useMemo(() => {
    if (integrity > 0.7) return "#1a1a2e";
    if (integrity > 0.4) return "#2a2a3e";
    return "#3a3a4e";
  }, [integrity]);
  
  const bellyColor = useMemo(() => {
    if (integrity > 0.7) return "#ffffff";
    if (integrity > 0.4) return "#e8e8e8";
    return "#d0d0d0";
  }, [integrity]);

  const beakColor = "#ff8c00";
  const feetColor = "#ff8c00";

  // Handle being hit - launch the penguin!
  useEffect(() => {
    if (!lastHitAt) return;
    const ls = launchState.current;
    
    // Only launch if this is a new hit
    if (lastHitAt <= ls.lastHitTime) return;
    ls.lastHitTime = lastHitAt;
    
    // Launch the penguin!
    ls.isLaunched = true;
    ls.landedAt = 0;
    
    // Random launch direction (away from impact)
    const launchAngle = Math.random() * Math.PI * 2;
    const launchPower = 8 + Math.random() * 6;
    
    ls.vx = Math.cos(launchAngle) * launchPower;
    ls.vz = Math.sin(launchAngle) * launchPower;
    ls.vy = 6 + Math.random() * 4; // Up!
    
    // Random spin
    ls.spinX = (Math.random() - 0.5) * 15;
    ls.spinZ = (Math.random() - 0.5) * 15;
    
  }, [lastHitAt]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const ls = launchState.current;
    const ms = moveState.current;
    
    // Handle launched state
    if (ls.isLaunched) {
      // Apply gravity
      ls.vy -= 25 * delta;
      
      // Update position
      ls.x += ls.vx * delta;
      ls.y += ls.vy * delta;
      ls.z += ls.vz * delta;
      
      // Spin in the air
      ls.rotX += ls.spinX * delta;
      ls.rotZ += ls.spinZ * delta;
      
      // Apply air resistance
      ls.vx *= 0.99;
      ls.vz *= 0.99;
      
      // Check for ground collision
      if (ls.y <= 0 && ls.vy < 0) {
        ls.y = 0;
        
        // Bounce or stop
        if (Math.abs(ls.vy) > 2) {
          // Bounce!
          ls.vy = -ls.vy * 0.4;
          ls.vx *= 0.7;
          ls.vz *= 0.7;
          ls.spinX *= 0.5;
          ls.spinZ *= 0.5;
        } else {
          // Landed - recover after a moment
          if (ls.landedAt === 0) {
            ls.landedAt = t;
          }
          
          ls.vy = 0;
          ls.vx *= 0.9;
          ls.vz *= 0.9;
          
          // Gradually right itself
          ls.rotX *= 0.95;
          ls.rotZ *= 0.95;
          ls.spinX *= 0.9;
          ls.spinZ *= 0.9;
          
          // After 1.5 seconds on ground, resume waddling
          if (t - ls.landedAt > 1.5) {
            ls.isLaunched = false;
            // Update wander center to new position
            ms.startX = ls.x;
            ms.startZ = ls.z;
            ms.currentX = ls.x;
            ms.currentZ = ls.z;
            ms.targetX = ls.x;
            ms.targetZ = ls.z;
            ms.nextMoveTime = t + 0.5;
            ls.rotX = 0;
            ls.rotZ = 0;
          }
        }
      }
      
      // Keep within bounds
      const BOUND = 95;
      if (ls.x < -BOUND) { ls.x = -BOUND; ls.vx = Math.abs(ls.vx) * 0.5; }
      if (ls.x > BOUND) { ls.x = BOUND; ls.vx = -Math.abs(ls.vx) * 0.5; }
      if (ls.z < -BOUND) { ls.z = -BOUND; ls.vz = Math.abs(ls.vz) * 0.5; }
      if (ls.z > BOUND) { ls.z = BOUND; ls.vz = -Math.abs(ls.vz) * 0.5; }
      
      // Update group position and rotation
      groupRef.current.position.set(ls.x, ls.y, ls.z);
      groupRef.current.rotation.set(ls.rotX, ms.angle, ls.rotZ);
      
      // Flap wings frantically while in air!
      if (ls.y > 0.1) {
        const flapSpeed = 25;
        if (leftWingRef.current) {
          leftWingRef.current.rotation.z = 0.3 + Math.sin(t * flapSpeed) * 0.8;
        }
        if (rightWingRef.current) {
          rightWingRef.current.rotation.z = -(0.3 + Math.sin(t * flapSpeed) * 0.8);
        }
      }
      
      return;
    }
    
    // Normal waddling behavior
    // Decide when to move
    if (t > ms.nextMoveTime) {
      if (!ms.isMoving) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * wanderRadius;
        ms.targetX = ms.startX + Math.cos(angle) * dist;
        ms.targetZ = ms.startZ + Math.sin(angle) * dist;
        ms.isMoving = true;
      }
    }
    
    // Move towards target
    if (ms.isMoving) {
      const dx = ms.targetX - ms.currentX;
      const dz = ms.targetZ - ms.currentZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist > 0.1) {
        ms.angle = Math.atan2(dx, dz);
        const step = ms.speed * delta;
        ms.currentX += (dx / dist) * step;
        ms.currentZ += (dz / dist) * step;
      } else {
        ms.isMoving = false;
        ms.nextMoveTime = t + ms.pauseDuration + Math.random() * 2;
      }
    }
    
    // Update position
    groupRef.current.position.set(ms.currentX, 0, ms.currentZ);
    groupRef.current.rotation.set(0, ms.angle, 0);
    
    // Waddle animation
    const waddleSpeed = ms.isMoving ? 8 : 2;
    const waddleAmount = ms.isMoving ? 0.15 : 0.03;
    
    if (waddleRef.current) {
      waddleRef.current.rotation.z = Math.sin(t * waddleSpeed) * waddleAmount;
      waddleRef.current.position.y = Math.abs(Math.sin(t * waddleSpeed)) * 0.05;
    }
    
    // Wing animation
    const wingFlap = Math.sin(t * 12) * 0.1;
    const wingBase = 0.3;
    if (leftWingRef.current) {
      leftWingRef.current.rotation.z = wingBase + (ms.isMoving ? wingFlap : Math.sin(t * 0.5) * 0.05);
    }
    if (rightWingRef.current) {
      rightWingRef.current.rotation.z = -(wingBase + (ms.isMoving ? wingFlap : Math.sin(t * 0.5) * 0.05));
    }
    
    // Foot animation
    if (leftFootRef.current && rightFootRef.current) {
      const footAngle = Math.sin(t * waddleSpeed) * 0.2;
      leftFootRef.current.rotation.x = ms.isMoving ? footAngle : 0;
      rightFootRef.current.rotation.x = ms.isMoving ? -footAngle : 0;
    }
  });

  function idToAngle(id?: string) {
    if (!id) return 0;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return ((h % 360) * Math.PI) / 180;
  }

  const initialAngle = idToAngle(id);
  
  // Initialize moveState angle
  useEffect(() => {
    moveState.current.angle = initialAngle;
  }, [initialAngle]);

  const penguinModel = (
    <group 
      ref={groupRef} 
      position={[position[0], 0, position[2]]}
      rotation={[0, initialAngle, 0]}
    >
      <group ref={waddleRef}>
        {/* Body - egg shaped */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
        
        {/* White belly patch */}
        <mesh position={[0, 0.65, 0.15]} castShadow>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color={bellyColor} roughness={0.7} />
        </mesh>
        
        {/* Head */}
        <mesh position={[0, 1.1, 0.05]} castShadow>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
        
        {/* White face patches */}
        <mesh position={[-0.12, 1.15, 0.12]} castShadow>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={bellyColor} roughness={0.7} />
        </mesh>
        <mesh position={[0.12, 1.15, 0.12]} castShadow>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={bellyColor} roughness={0.7} />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[-0.08, 1.18, 0.2]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        <mesh position={[0.08, 1.18, 0.2]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        
        {/* Eye shine */}
        <mesh position={[-0.07, 1.19, 0.23]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.09, 1.19, 0.23]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
        
        {/* Beak */}
        <mesh position={[0, 1.08, 0.28]} rotation={[0.3, 0, 0]} castShadow>
          <coneGeometry args={[0.06, 0.15, 8]} />
          <meshStandardMaterial color={beakColor} roughness={0.6} />
        </mesh>
        
        {/* Left Wing */}
        <group ref={leftWingRef} position={[-0.35, 0.75, 0]}>
          <mesh rotation={[0, 0, 0.3]} castShadow>
            <capsuleGeometry args={[0.08, 0.35, 4, 8]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} />
          </mesh>
        </group>
        
        {/* Right Wing */}
        <group ref={rightWingRef} position={[0.35, 0.75, 0]}>
          <mesh rotation={[0, 0, -0.3]} castShadow>
            <capsuleGeometry args={[0.08, 0.35, 4, 8]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} />
          </mesh>
        </group>
        
        {/* Left Foot */}
        <mesh 
          ref={leftFootRef}
          position={[-0.12, 0.08, 0.1]} 
          rotation={[-0.2, 0.2, 0]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.04, 0.18]} />
          <meshStandardMaterial color={feetColor} roughness={0.6} />
        </mesh>
        
        {/* Right Foot */}
        <mesh 
          ref={rightFootRef}
          position={[0.12, 0.08, 0.1]} 
          rotation={[-0.2, -0.2, 0]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.04, 0.18]} />
          <meshStandardMaterial color={feetColor} roughness={0.6} />
        </mesh>
        
        {/* Tail - small bump */}
        <mesh position={[0, 0.45, -0.32]} rotation={[0.5, 0, 0]} castShadow>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );

  if (!physics) {
    return penguinModel;
  }

  // Note: We don't use RigidBody for physics anymore since we handle it ourselves
  // This allows the penguin to be launched and land smoothly
  return penguinModel;
}
