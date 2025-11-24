"use client";

import { useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  PointerLockControls,
} from "@react-three/drei";
import { RigidBody, Physics } from "@react-three/rapier";
import * as THREE from "three";
import { CarModel } from "./Car";
import {
  Fire,
  Smoke,
  Sparks,
  Rain,
  Snow,
  Stars,
  MagicSparkle,
  Confetti,
  ConfettiExplosion,
} from "./ParticleEffects";

type ShapeType =
  | "box"
  | "sphere"
  | "cylinder"
  | "cone"
  | "wedge"
  | "tube"
  | "pointLight"
  | "spotLight"
  | "directionalLight"
  | "fire"
  | "smoke"
  | "sparks"
  | "rain"
  | "snow"
  | "stars"
  | "magicSparkle"
  | "confetti"
  | "confettiExplosion";
type MaterialType =
  | "standard"
  | "basic"
  | "phong"
  | "toon"
  | "physical"
  | "lambert";

type ShapeData = {
  id: string;
  position: [number, number, number];
  size: [number, number, number]; // For box: [width, height, depth], sphere: [radius, _, _], cylinder/cone: [radiusTop, radiusBottom, height]
  rotation: [number, number, number];
  color: string;
  name: string;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  groupName: string;
  shapeType: ShapeType;
  materialType: MaterialType;
  emissive?: string;
  emissiveIntensity?: number;
  clearcoat?: number;
  reflectivity?: number;
  // Light properties
  lightIntensity?: number;
  lightDistance?: number;
  lightDecay?: number;
  lightAngle?: number;
  lightPenumbra?: number;
  castShadow?: boolean;
  showHelper?: boolean;
  lightTarget?: [number, number, number]; // Target position for spotlights/directional lights
  // Particle properties
  particleCount?: number;
  rotationSpeed?: number;
  confettiColors?: string[]; // Custom colors for confetti explosion
};

// Light helper component
function LightHelper({ shape }: { shape: ShapeData }) {
  const { scene } = useThree();
  const helperRef = useRef<
    | THREE.SpotLightHelper
    | THREE.PointLightHelper
    | THREE.DirectionalLightHelper
    | null
  >(null);
  const lightRef = useRef<
    THREE.SpotLight | THREE.PointLight | THREE.DirectionalLight | null
  >(null);

  useEffect(() => {
    if (!shape.showHelper || !lightRef.current) {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
      return;
    }

    // Create appropriate helper based on light type
    if (
      shape.shapeType === "spotLight" &&
      lightRef.current instanceof THREE.SpotLight
    ) {
      helperRef.current = new THREE.SpotLightHelper(lightRef.current);
    } else if (
      shape.shapeType === "pointLight" &&
      lightRef.current instanceof THREE.PointLight
    ) {
      helperRef.current = new THREE.PointLightHelper(lightRef.current, 0.5);
    } else if (
      shape.shapeType === "directionalLight" &&
      lightRef.current instanceof THREE.DirectionalLight
    ) {
      helperRef.current = new THREE.DirectionalLightHelper(lightRef.current, 1);
    }

    if (helperRef.current) {
      scene.add(helperRef.current);
    }

    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
    };
  }, [shape.showHelper, shape.shapeType, scene]);

  // Update helper when light properties change
  useEffect(() => {
    if (helperRef.current) {
      helperRef.current.update();
    }
  }, [
    shape.position,
    shape.rotation,
    shape.color,
    shape.lightIntensity,
    shape.lightDistance,
    shape.lightAngle,
  ]);

  // Set target if specified
  useEffect(() => {
    if (
      lightRef.current &&
      shape.lightTarget &&
      (shape.shapeType === "spotLight" ||
        shape.shapeType === "directionalLight")
    ) {
      const light = lightRef.current as
        | THREE.SpotLight
        | THREE.DirectionalLight;
      light.target.position.set(...shape.lightTarget);
      light.target.updateMatrixWorld();
    }
  }, [shape.lightTarget, shape.shapeType]);

  if (shape.shapeType === "pointLight") {
    return (
      <pointLight
        ref={lightRef}
        position={shape.position}
        color={shape.color}
        intensity={shape.lightIntensity || 1}
        distance={shape.lightDistance || 0}
        decay={shape.lightDecay || 2}
        castShadow={shape.castShadow}
      />
    );
  } else if (shape.shapeType === "spotLight") {
    return (
      <>
        <spotLight
          ref={lightRef}
          position={shape.position}
          color={shape.color}
          intensity={shape.lightIntensity || 1}
          distance={shape.lightDistance || 0}
          angle={shape.lightAngle || Math.PI / 4}
          penumbra={shape.lightPenumbra || 0}
          decay={shape.lightDecay || 2}
          castShadow={shape.castShadow}
          rotation={shape.rotation}
        />
      </>
    );
  } else if (shape.shapeType === "directionalLight") {
    return (
      <directionalLight
        ref={lightRef}
        position={shape.position}
        color={shape.color}
        intensity={shape.lightIntensity || 1}
        castShadow={shape.castShadow}
        rotation={shape.rotation}
      />
    );
  }
  return null;
}

function DraggableShape({
  shape,
  isSelected,
  onSelect,
  onTransform,
  transformMode,
}: {
  shape: ShapeData;
  isSelected: boolean;
  onSelect: () => void;
  onTransform: (
    position: [number, number, number],
    rotation: [number, number, number],
    size: [number, number, number]
  ) => void;
  transformMode: "translate" | "rotate" | "scale";
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const renderGeometry = () => {
    switch (shape.shapeType) {
      case "sphere":
        return <sphereGeometry args={[shape.size[0], 32, 32]} />;
      case "cylinder":
        return (
          <cylinderGeometry
            args={[shape.size[0], shape.size[1], shape.size[2], 32]}
          />
        );
      case "cone":
        return <coneGeometry args={[shape.size[0], shape.size[1], 32]} />;
      case "wedge": {
        // Create triangular prism (wedge) - size[0]=width, size[1]=height, size[2]=depth
        const width = shape.size[0];
        const height = shape.size[1];
        const depth = shape.size[2];
        const vertices = new Float32Array([
          // Front face triangle
          -width / 2,
          0,
          depth / 2, // bottom left
          width / 2,
          0,
          depth / 2, // bottom right
          0,
          height,
          depth / 2, // top center
          // Back face triangle
          -width / 2,
          0,
          -depth / 2, // bottom left
          width / 2,
          0,
          -depth / 2, // bottom right
          0,
          height,
          -depth / 2, // top center
        ]);
        const indices = new Uint16Array([
          0,
          1,
          2,
          3,
          5,
          4, // front and back triangles
          0,
          3,
          4,
          0,
          4,
          1, // left bottom
          1,
          4,
          5,
          1,
          5,
          2, // right bottom
          0,
          2,
          5,
          0,
          5,
          3, // left slope
        ]);
        return (
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={6}
              array={vertices}
              itemSize={3}
              args={[vertices, 3]}
            />
            <bufferAttribute
              attach="index"
              count={indices.length}
              array={indices}
              itemSize={1}
              args={[indices, 1]}
            />
          </bufferGeometry>
        );
      }
      case "tube":
        return <torusGeometry args={[shape.size[0], shape.size[1], 16, 32]} />;
      case "box":
      default:
        return <boxGeometry args={shape.size} />;
    }
  };

  // Render lights instead of meshes for light types
  if (
    shape.shapeType === "pointLight" ||
    shape.shapeType === "spotLight" ||
    shape.shapeType === "directionalLight"
  ) {
    return (
      <group>
        <LightHelper shape={shape} />
        {/* Clickable sphere for selection - always visible when selected */}
        {isSelected && (
          <mesh
            position={shape.position}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color={shape.color} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  // Render particle effects
  if (
    shape.shapeType === "fire" ||
    shape.shapeType === "smoke" ||
    shape.shapeType === "sparks" ||
    shape.shapeType === "rain" ||
    shape.shapeType === "snow" ||
    shape.shapeType === "stars" ||
    shape.shapeType === "magicSparkle" ||
    shape.shapeType === "confetti" ||
    shape.shapeType === "confettiExplosion"
  ) {
    return (
      <group>
        {/* Actual particle effect */}
        {shape.shapeType === "fire" && (
          <Fire
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 200}
            color={shape.color}
            rotationSpeed={shape.rotationSpeed ?? 0}
          />
        )}
        {shape.shapeType === "smoke" && (
          <Smoke
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 100}
            color={shape.color}
            rotationSpeed={shape.rotationSpeed ?? 0}
          />
        )}
        {shape.shapeType === "sparks" && (
          <Sparks
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 50}
            color={shape.color}
            rotationSpeed={shape.rotationSpeed ?? 0}
          />
        )}
        {shape.shapeType === "rain" && (
          <Rain
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 500}
            area={20 * shape.size[0]}
            rotationSpeed={shape.rotationSpeed ?? 0}
          />
        )}
        {shape.shapeType === "snow" && (
          <Snow
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 300}
            area={20 * shape.size[0]}
            rotationSpeed={shape.rotationSpeed ?? 0}
          />
        )}
        {shape.shapeType === "stars" && (
          <Stars
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 50}
            color={shape.color}
            rotationSpeed={shape.rotationSpeed ?? 0.5}
          />
        )}
        {shape.shapeType === "magicSparkle" && (
          <MagicSparkle
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 100}
            color={shape.color}
            rotationSpeed={shape.rotationSpeed ?? 0}
          />
        )}
        {shape.shapeType === "confetti" && (
          <Confetti
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 200}
            rotationSpeed={shape.rotationSpeed ?? 0}
          />
        )}
        {shape.shapeType === "confettiExplosion" && (
          <ConfettiExplosion
            position={shape.position}
            scale={shape.size[0]}
            count={shape.particleCount || 150}
            rotationSpeed={shape.rotationSpeed ?? 0}
            colors={shape.confettiColors}
          />
        )}
        {/* Position marker when selected */}
        {isSelected ? (
          <mesh
            position={shape.position}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial
              color="#ffffff"
              opacity={0.7}
              transparent
              wireframe
            />
          </mesh>
        ) : null}
      </group>
    );
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={shape.position}
        rotation={shape.rotation}
        scale={1}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {renderGeometry()}
        {shape.materialType === "basic" && (
          <meshBasicMaterial
            color={shape.color}
            opacity={shape.opacity}
            transparent={shape.transparent}
          />
        )}
        {shape.materialType === "phong" && (
          <meshPhongMaterial
            color={shape.color}
            opacity={shape.opacity}
            transparent={shape.transparent}
            shininess={shape.metalness * 100}
            emissive={isSelected ? "#fbbf24" : shape.emissive || "#000000"}
            emissiveIntensity={isSelected ? 0.5 : shape.emissiveIntensity || 0}
            reflectivity={shape.reflectivity || 0.5}
          />
        )}
        {shape.materialType === "toon" && (
          <meshToonMaterial
            color={shape.color}
            opacity={shape.opacity}
            transparent={shape.transparent}
            emissive={isSelected ? "#fbbf24" : shape.emissive || "#000000"}
            emissiveIntensity={isSelected ? 0.5 : shape.emissiveIntensity || 0}
          />
        )}
        {shape.materialType === "lambert" && (
          <meshLambertMaterial
            color={shape.color}
            opacity={shape.opacity}
            transparent={shape.transparent}
            emissive={isSelected ? "#fbbf24" : shape.emissive || "#000000"}
            emissiveIntensity={isSelected ? 0.5 : shape.emissiveIntensity || 0}
            reflectivity={shape.reflectivity || 0.5}
          />
        )}
        {shape.materialType === "physical" && (
          <meshPhysicalMaterial
            color={shape.color}
            roughness={shape.roughness}
            metalness={shape.metalness}
            opacity={shape.opacity}
            transparent={shape.transparent}
            emissive={isSelected ? "#fbbf24" : shape.emissive || "#000000"}
            emissiveIntensity={isSelected ? 0.5 : shape.emissiveIntensity || 0}
            clearcoat={shape.clearcoat || 0}
            reflectivity={shape.reflectivity || 0.5}
          />
        )}
        {shape.materialType === "standard" && (
          <meshStandardMaterial
            color={shape.color}
            roughness={shape.roughness}
            metalness={shape.metalness}
            opacity={shape.opacity}
            transparent={shape.transparent}
            emissive={isSelected ? "#fbbf24" : shape.emissive || "#000000"}
            emissiveIntensity={isSelected ? 0.5 : shape.emissiveIntensity || 0}
          />
        )}
      </mesh>
      {isSelected && (
        <TransformControls
          object={meshRef.current!}
          mode={transformMode}
          onObjectChange={() => {
            if (meshRef.current) {
              const newSize = [
                shape.size[0] * meshRef.current.scale.x,
                shape.size[1] * meshRef.current.scale.y,
                shape.size[2] * meshRef.current.scale.z,
              ] as [number, number, number];
              meshRef.current.scale.set(1, 1, 1);
              onTransform(
                meshRef.current.position.toArray() as [number, number, number],
                meshRef.current.rotation.toArray().slice(0, 3) as [
                  number,
                  number,
                  number
                ],
                newSize
              );
            }
          }}
        />
      )}
    </group>
  );
}

export default function ModelBuilder() {
  // Navigation mode: 'orbit' uses OrbitControls, 'walk' enables pointer-lock WASD movement
  const [navMode, setNavMode] = useState<"orbit" | "walk">("orbit");

  // Walk controls component: handles keyboard movement while pointer is locked
  function WalkControls({ enabled }: { enabled: boolean }) {
    const { camera, gl } = useThree();
    const velocity = useRef({ x: 0, y: 0, z: 0 });
    const keys = useRef({
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
    });

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "w" || e.key === "ArrowUp") keys.current.forward = true;
        if (e.key === "s" || e.key === "ArrowDown") keys.current.back = true;
        if (e.key === "a" || e.key === "ArrowLeft") keys.current.left = true;
        if (e.key === "d" || e.key === "ArrowRight") keys.current.right = true;
        if (e.key === "Shift") keys.current.sprint = true;
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.key === "w" || e.key === "ArrowUp") keys.current.forward = false;
        if (e.key === "s" || e.key === "ArrowDown") keys.current.back = false;
        if (e.key === "a" || e.key === "ArrowLeft") keys.current.left = false;
        if (e.key === "d" || e.key === "ArrowRight") keys.current.right = false;
        if (e.key === "Shift") keys.current.sprint = false;
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    }, []);

    useFrame((_, delta) => {
      if (!enabled) return;
      const speed = keys.current.sprint ? 16 : 6; // units per second
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      const right = new THREE.Vector3();
      right.crossVectors(dir, camera.up).normalize();

      const moveVec = new THREE.Vector3();
      if (keys.current.forward) moveVec.add(dir);
      if (keys.current.back) moveVec.sub(dir);
      if (keys.current.left) moveVec.sub(right);
      if (keys.current.right) moveVec.add(right);

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize().multiplyScalar(speed * delta);
        camera.position.add(moveVec);
      }
    });

    return <PointerLockControls />;
  }
  const [shapes, setShapes] = useState<ShapeData[]>([
    {
      id: "1",
      position: [0, 1, 0],
      size: [2, 2, 2],
      rotation: [0, 0, 0],
      color: "#4f46e5",
      name: "Box 1",
      roughness: 0.5,
      metalness: 0,
      opacity: 1,
      transparent: false,
      groupName: "main",
      shapeType: "box",
      materialType: "standard",
    },
  ]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [transformMode, setTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");
  const [showCode, setShowCode] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [history, setHistory] = useState<ShapeData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save state to history when shapes change
  const saveToHistory = (newShapes: ShapeData[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newShapes)));
      return newHistory.slice(-20); // Keep last 20 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 19));
  };

  // Undo function
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setShapes(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  // Redo function
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setShapes(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // Track Ctrl/Shift key for multi-select and handle Ctrl+Z/Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.shiftKey || e.metaKey) {
        setIsCtrlPressed(true);
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
        setIsCtrlPressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [historyIndex, history]);

  // Initialize history with initial shapes
  useEffect(() => {
    if (history.length === 0) {
      setHistory([JSON.parse(JSON.stringify(shapes))]);
      setHistoryIndex(0);
    }
  }, []);

  // Recent colors (last 8) persisted to localStorage
  const [recentColors, setRecentColors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mb:recentColors");
      if (raw) setRecentColors(JSON.parse(raw));
    } catch (err) {
      // ignore
    }
  }, []);

  const pushRecentColor = (color: string) => {
    setRecentColors((prev) => {
      const list = [color, ...prev.filter((c) => c !== color)].slice(0, 8);
      try {
        localStorage.setItem("mb:recentColors", JSON.stringify(list));
      } catch (err) {
        // ignore
      }
      return list;
    });
  };

  // Expose a small global API so other pages (map editor / game) can
  // read/write the current model layout and export it as JSON. This keeps
  // the heavy editor in-place while allowing the runtime to load saved
  // layouts or download them for inclusion in the game.
  useEffect(() => {
    try {
      (window as any).__MODEL_BUILDER_API = {
        getShapes: () => JSON.parse(JSON.stringify(shapes)),
        setShapes: (newShapes: any[]) => {
          // Replace shapes and save to history
          setShapes(newShapes);
          saveToHistory(newShapes);
        },
        exportJSON: () => JSON.stringify(shapes, null, 2),
        downloadJSON: (filename = "map-layout.json") => {
          const blob = new Blob([JSON.stringify(shapes, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
      };
    } catch (err) {
      // ignore in non-browser environments
    }
    return () => {
      try {
        if ((window as any).__MODEL_BUILDER_API)
          delete (window as any).__MODEL_BUILDER_API;
      } catch (err) {}
    };
  }, [shapes]);

  // On mount, check for an imported shapes payload in localStorage.
  // This allows the Map Editor to save JSON to localStorage and have
  // the ModelBuilder apply it when opened.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mb:shapes:import");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setShapes(parsed as ShapeData[]);
          saveToHistory(parsed as ShapeData[]);
        }
        // Remove the import entry after applying it once
        localStorage.removeItem("mb:shapes:import");
      }
    } catch (err) {
      // ignore malformed import
    }
  }, []);

  const selectedShape = shapes.find((s) => s.id === selectedShapeIds[0]);
  const selectedShapes = shapes.filter((s) => selectedShapeIds.includes(s.id));

  // Helper to update shapes and save to history
  const updateShapesWithHistory = (newShapes: ShapeData[]) => {
    setShapes(newShapes);
    saveToHistory(newShapes);
  };

  const addShape = () => {
    const newShape: ShapeData = {
      id: Date.now().toString(),
      position: [0, 1, 0],
      size: [2, 2, 2],
      rotation: [0, 0, 0],
      color: "#" + Math.floor(Math.random() * 16777215).toString(16),
      name: `Shape ${shapes.length + 1}`,
      roughness: 0.5,
      metalness: 0,
      opacity: 1,
      transparent: false,
      groupName: selectedShape?.groupName || "main",
      shapeType: "box",
      materialType: "standard",
    };
    updateShapesWithHistory([...shapes, newShape]);
    setSelectedShapeIds([newShape.id]);
  };

  const importCarModel = () => {
    // Define the car model structure based on Car2.tsx
    const carShapes: ShapeData[] = [
      // Main Chassis
      {
        id: `car-chassis-${Date.now()}`,
        position: [0, 0.2, 0],
        size: [1.45, 0.35, 2.3],
        rotation: [0, 0, 0],
        color: "#ef4444",
        name: "Chassis",
        roughness: 0.4,
        metalness: 0.65,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Lower Trim/Skirts
      {
        id: `car-trim-${Date.now() + 1}`,
        position: [0, 0.22, 0],
        size: [1.46, 0.1, 2.32],
        rotation: [0, 0, 0],
        color: "#111827",
        name: "Lower Trim",
        roughness: 0.8,
        metalness: 0.3,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Mid Body Block
      {
        id: `car-midbody-${Date.now() + 2}`,
        position: [0, 0.45, 0],
        size: [1.25, 0.3, 1.4],
        rotation: [0, 0, 0],
        color: "#ef4444",
        name: "Mid Body",
        roughness: 0.55,
        metalness: 0,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Front Engine Bay
      {
        id: `car-engine-${Date.now() + 3}`,
        position: [0, 0.33, 0.7],
        size: [1.15, 0.2, 0.9],
        rotation: [0, 0, 0],
        color: "#ef4444",
        name: "Engine Bay",
        roughness: 0.4,
        metalness: 0.75,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Glass Cabin
      {
        id: `car-glass-${Date.now() + 4}`,
        position: [0, 0.55, -0.1],
        size: [0.95, 0.35, 1.1],
        rotation: [0, 0, 0],
        color: "#e5e7eb",
        name: "Glass Cabin",
        roughness: 0.15,
        metalness: 0.2,
        opacity: 0.7,
        transparent: true,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Roof Accent
      {
        id: `car-roof-${Date.now() + 5}`,
        position: [0, 0.765, -0.1],
        size: [1.02, 0.08, 1.2],
        rotation: [0, 0, 0],
        color: "#111827",
        name: "Roof Accent",
        roughness: 0.4,
        metalness: 0.8,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Hood
      {
        id: `car-hood-${Date.now() + 6}`,
        position: [0, 0.55, 0.85],
        size: [0.95, 0.15, 0.8],
        rotation: [Math.PI * 0.01, 0, 0],
        color: "#ef4444",
        name: "Hood",
        roughness: 0.3,
        metalness: 0.5,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Trunk
      {
        id: `car-trunk-${Date.now() + 7}`,
        position: [0, 0.5, -0.95],
        size: [0.9, 0.16, 0.65],
        rotation: [-Math.PI * 0.01, 0, 0],
        color: "#ef4444",
        name: "Trunk",
        roughness: 0.45,
        metalness: 0,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Left Door
      {
        id: `car-leftdoor-${Date.now() + 8}`,
        position: [-0.7, 0.25, -0.05],
        size: [0.08, 0.65, 1.4],
        rotation: [0, 0, 0],
        color: "#ef4444",
        name: "Left Door",
        roughness: 0.6,
        metalness: 0.4,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Right Door
      {
        id: `car-rightdoor-${Date.now() + 9}`,
        position: [0.7, 0.25, -0.05],
        size: [0.08, 0.65, 1.4],
        rotation: [0, 0, 0],
        color: "#ef4444",
        name: "Right Door",
        roughness: 0.6,
        metalness: 0.4,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Front Bumper
      {
        id: `car-frontbumper-${Date.now() + 10}`,
        position: [0, 0.12, 1.15],
        size: [1.05, 0.22, 0.35],
        rotation: [0, 0, 0],
        color: "#111827",
        name: "Front Bumper",
        roughness: 0.6,
        metalness: 0,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Rear Bumper
      {
        id: `car-rearbumper-${Date.now() + 11}`,
        position: [0, 0.12, -1.15],
        size: [1.05, 0.22, 0.35],
        rotation: [0, 0, 0],
        color: "#111827",
        name: "Rear Bumper",
        roughness: 0.6,
        metalness: 0,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
      },
      // Wheels (4 tires as tubes)
      {
        id: `car-wheel-fl-tire-${Date.now() + 12}`,
        position: [-0.62, 0, 0.95],
        size: [0.3, 0.08, 0],
        rotation: [0, Math.PI / 2, 0],
        color: "#020617",
        name: "Front Left Tire",
        roughness: 0.7,
        metalness: 0.25,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "tube",
        materialType: "standard",
      },
      {
        id: `car-wheel-fr-tire-${Date.now() + 13}`,
        position: [0.62, 0, 0.95],
        size: [0.3, 0.08, 0],
        rotation: [0, Math.PI / 2, 0],
        color: "#020617",
        name: "Front Right Tire",
        roughness: 0.7,
        metalness: 0.25,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "tube",
        materialType: "standard",
      },
      {
        id: `car-wheel-rl-tire-${Date.now() + 14}`,
        position: [-0.62, 0, -0.95],
        size: [0.3, 0.08, 0],
        rotation: [0, Math.PI / 2, 0],
        color: "#020617",
        name: "Rear Left Tire",
        roughness: 0.7,
        metalness: 0.25,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "tube",
        materialType: "standard",
      },
      {
        id: `car-wheel-rr-tire-${Date.now() + 15}`,
        position: [0.62, 0, -0.95],
        size: [0.3, 0.08, 0],
        rotation: [0, Math.PI / 2, 0],
        color: "#020617",
        name: "Rear Right Tire",
        roughness: 0.7,
        metalness: 0.25,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "tube",
        materialType: "standard",
      },
      // Wheel Rims (4 cylinders)
      {
        id: `car-wheel-fl-rim-${Date.now() + 16}`,
        position: [-0.62, 0, 0.95],
        size: [0.15, 0.15, 0.25],
        rotation: [0, 0, Math.PI / 2],
        color: "#e5e7eb",
        name: "Front Left Rim",
        roughness: 0.2,
        metalness: 0.9,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "cylinder",
        materialType: "standard",
      },
      {
        id: `car-wheel-fr-rim-${Date.now() + 17}`,
        position: [0.62, 0, 0.95],
        size: [0.15, 0.15, 0.25],
        rotation: [0, 0, Math.PI / 2],
        color: "#e5e7eb",
        name: "Front Right Rim",
        roughness: 0.2,
        metalness: 0.9,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "cylinder",
        materialType: "standard",
      },
      {
        id: `car-wheel-rl-rim-${Date.now() + 18}`,
        position: [-0.62, 0, -0.95],
        size: [0.15, 0.15, 0.25],
        rotation: [0, 0, Math.PI / 2],
        color: "#e5e7eb",
        name: "Rear Left Rim",
        roughness: 0.2,
        metalness: 0.9,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "cylinder",
        materialType: "standard",
      },
      {
        id: `car-wheel-rr-rim-${Date.now() + 19}`,
        position: [0.62, 0, -0.95],
        size: [0.15, 0.15, 0.25],
        rotation: [0, 0, Math.PI / 2],
        color: "#e5e7eb",
        name: "Rear Right Rim",
        roughness: 0.2,
        metalness: 0.9,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "cylinder",
        materialType: "standard",
      },
      // Headlights (2 boxes with emissive)
      {
        id: `car-headlight-left-${Date.now() + 20}`,
        position: [-0.25, 0.35, 1.3],
        size: [0.25, 0.15, 0.08],
        rotation: [0, 0, 0],
        color: "#f9fafb",
        name: "Left Headlight",
        roughness: 0.3,
        metalness: 0.1,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
        emissive: "#fef9c3",
        emissiveIntensity: 0.8,
      },
      {
        id: `car-headlight-right-${Date.now() + 21}`,
        position: [0.25, 0.35, 1.3],
        size: [0.25, 0.15, 0.08],
        rotation: [0, 0, 0],
        color: "#f9fafb",
        name: "Right Headlight",
        roughness: 0.3,
        metalness: 0.1,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
        emissive: "#fef9c3",
        emissiveIntensity: 0.8,
      },
      // Tail Lights (2 boxes with emissive)
      {
        id: `car-taillight-left-${Date.now() + 22}`,
        position: [-0.2, 0.35, -1.3],
        size: [0.15, 0.15, 0.08],
        rotation: [0, 0, 0],
        color: "#fee2e2",
        name: "Left Tail Light",
        roughness: 0.3,
        metalness: 0.1,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
        emissive: "#dc2626",
        emissiveIntensity: 0.5,
      },
      {
        id: `car-taillight-right-${Date.now() + 23}`,
        position: [0.2, 0.35, -1.3],
        size: [0.15, 0.15, 0.08],
        rotation: [0, 0, 0],
        color: "#fee2e2",
        name: "Right Tail Light",
        roughness: 0.3,
        metalness: 0.1,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "box",
        materialType: "standard",
        emissive: "#dc2626",
        emissiveIntensity: 0.5,
      },
      // Headlight spotlights (2 spot lights pointing forward)
      {
        id: `car-spotlight-left-${Date.now() + 24}`,
        position: [-0.25, 0.35, 1.4],
        size: [1, 1, 1],
        rotation: [0, 0, 0],
        color: "#fef9c3",
        name: "Left Headlight",
        roughness: 0.5,
        metalness: 0,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "spotLight",
        materialType: "standard",
        lightIntensity: 5,
        lightDistance: 30,
        lightAngle: Math.PI / 3,
        lightPenumbra: 0.5,
        lightDecay: 2,
        castShadow: false,
        lightTarget: [-0.25, 0, 10], // Point forward (positive Z)
      },
      {
        id: `car-spotlight-right-${Date.now() + 25}`,
        position: [0.25, 0.35, 1.4],
        size: [1, 1, 1],
        rotation: [0, 0, 0],
        color: "#fef9c3",
        name: "Right Headlight",
        roughness: 0.5,
        metalness: 0,
        opacity: 1,
        transparent: false,
        groupName: "Car",
        shapeType: "spotLight",
        materialType: "standard",
        lightIntensity: 5,
        lightDistance: 30,
        lightAngle: Math.PI / 3,
        lightPenumbra: 0.5,
        lightDecay: 2,
        castShadow: false,
        lightTarget: [0.25, 0, 10], // Point forward (positive Z)
      },
    ];

    updateShapesWithHistory([...shapes, ...carShapes]);
    alert(`Imported car model with ${carShapes.length} parts!`);
  };

  const deleteShape = (id: string) => {
    updateShapesWithHistory(shapes.filter((s) => s.id !== id));
    if (selectedShapeIds.includes(id)) {
      setSelectedShapeIds((prev) => prev.filter((sid) => sid !== id));
    }
  };

  const duplicateShape = (id: string) => {
    const shapeToDuplicate = shapes.find((s) => s.id === id);
    if (!shapeToDuplicate) return;

    const newShape: ShapeData = {
      ...shapeToDuplicate,
      id: Date.now().toString() + Math.random(),
      name: shapeToDuplicate.name + " (Copy)",
      position: [
        shapeToDuplicate.position[0] + 1,
        shapeToDuplicate.position[1],
        shapeToDuplicate.position[2],
      ] as [number, number, number],
    };

    updateShapesWithHistory([...shapes, newShape]);
    setSelectedShapeIds([newShape.id]);
  };

  const duplicateSelectedShapes = () => {
    if (selectedShapes.length === 0) return;

    const newShapes = selectedShapes.map((shape) => ({
      ...shape,
      id: Date.now().toString() + Math.random(),
      name: shape.name + " (Copy)",
      position: [
        shape.position[0] + 1,
        shape.position[1],
        shape.position[2],
      ] as [number, number, number],
    }));

    updateShapesWithHistory([...shapes, ...newShapes]);
    setSelectedShapeIds(newShapes.map((s) => s.id));
  };

  const updateShape = (id: string, updates: Partial<ShapeData>) => {
    updateShapesWithHistory(
      shapes.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const generateCode = () => {
    const hasParticles = shapes.some((s) =>
      [
        "fire",
        "smoke",
        "sparks",
        "rain",
        "snow",
        "stars",
        "magicSparkle",
        "confetti",
        "confettiExplosion",
      ].includes(s.shapeType)
    );
    const hasLights = shapes.some((s) =>
      ["pointLight", "spotLight", "directionalLight"].includes(s.shapeType)
    );

    const header =
      '"use client";\n\n' +
      'import { RigidBody } from "@react-three/rapier";\n' +
      'import type { ThreeElements } from "@react-three/fiber";\n' +
      (hasParticles
        ? 'import { Fire, Smoke, Sparks, Rain, Snow, Stars, MagicSparkle, Confetti, ConfettiExplosion } from "./ParticleEffects";\n'
        : "") +
      "\n" +
      "export default function MyBuilding(props: ThreeElements['group']) {\n" +
      "  return (\n" +
      "    <group {...props}>";

    // Filter out lights and particles from mesh generation
    const meshShapes = shapes.filter(
      (s) =>
        ![
          "pointLight",
          "spotLight",
          "directionalLight",
          "fire",
          "smoke",
          "sparks",
          "rain",
          "snow",
          "stars",
          "magicSparkle",
          "confetti",
          "confettiExplosion",
        ].includes(s.shapeType)
    );

    const lightShapes = shapes.filter((s) =>
      ["pointLight", "spotLight", "directionalLight"].includes(s.shapeType)
    );
    const particleShapes = shapes.filter((s) =>
      [
        "fire",
        "smoke",
        "sparks",
        "rain",
        "snow",
        "stars",
        "magicSparkle",
        "confetti",
        "confettiExplosion",
      ].includes(s.shapeType)
    );

    // Group shapes by groupName
    const groups = meshShapes.reduce(
      (acc: Record<string, ShapeData[]>, shape: ShapeData) => {
        if (!acc[shape.groupName]) acc[shape.groupName] = [];
        acc[shape.groupName].push(shape);
        return acc;
      },
      {} as Record<string, ShapeData[]>
    );

    const meshes = Object.entries(groups)
      .map(([groupName, groupShapes]) => {
        const groupContent = groupShapes
          .map((shape: ShapeData) => {
            const materialProps = [
              'color={"' + shape.color + '"}',
              shape.opacity !== 1 ? "opacity={" + shape.opacity + "}" : null,
              shape.transparent ? "transparent" : null,
            ];

            // Add material-specific properties
            if (
              shape.materialType === "standard" ||
              shape.materialType === "physical"
            ) {
              if (shape.roughness !== 0.5)
                materialProps.push("roughness={" + shape.roughness + "}");
              if (shape.metalness !== 0)
                materialProps.push("metalness={" + shape.metalness + "}");
            }
            if (shape.materialType === "physical" && shape.clearcoat) {
              materialProps.push("clearcoat={" + shape.clearcoat + "}");
            }
            if (
              (shape.materialType === "phong" ||
                shape.materialType === "lambert") &&
              shape.reflectivity !== undefined &&
              shape.reflectivity !== 0.5
            ) {
              materialProps.push("reflectivity={" + shape.reflectivity + "}");
            }
            if (shape.materialType === "phong" && shape.metalness) {
              materialProps.push("shininess={" + shape.metalness * 100 + "}");
            }
            if (
              shape.materialType !== "basic" &&
              shape.emissive &&
              shape.emissive !== "#000000"
            ) {
              materialProps.push('emissive={"' + shape.emissive + '"}');
            }
            if (shape.materialType !== "basic" && shape.emissiveIntensity) {
              materialProps.push(
                "emissiveIntensity={" + shape.emissiveIntensity + "}"
              );
            }

            const materialPropsStr = materialProps.filter(Boolean).join(" ");

            const posStr =
              "[" +
              shape.position.map((v: number) => v.toFixed(2)).join(", ") +
              "]";
            const rotStr =
              "[" +
              shape.rotation.map((v: number) => v.toFixed(2)).join(", ") +
              "]";
            const sizeStr =
              "[" +
              shape.size.map((v: number) => v.toFixed(2)).join(", ") +
              "]";

            let geometryCode = "";
            switch (shape.shapeType) {
              case "sphere":
                geometryCode =
                  "<sphereGeometry args={[" + shape.size[0] + ", 32, 32]} />";
                break;
              case "cylinder":
                geometryCode =
                  "<cylinderGeometry args={[" +
                  shape.size[0] +
                  ", " +
                  shape.size[1] +
                  ", " +
                  shape.size[2] +
                  ", 32]} />";
                break;
              case "cone":
                geometryCode =
                  "<coneGeometry args={[" +
                  shape.size[0] +
                  ", " +
                  shape.size[1] +
                  ", 32]} />";
                break;
              case "wedge":
                const w = shape.size[0],
                  h = shape.size[1],
                  d = shape.size[2];
                geometryCode =
                  "<bufferGeometry>\n            <bufferAttribute attach='attributes-position' count={6} array={new Float32Array([" +
                  "" +
                  -w / 2 +
                  ",0," +
                  d / 2 +
                  ", " +
                  w / 2 +
                  ",0," +
                  d / 2 +
                  ", 0," +
                  h +
                  "," +
                  d / 2 +
                  ", " +
                  "" +
                  -w / 2 +
                  ",0," +
                  -d / 2 +
                  ", " +
                  w / 2 +
                  ",0," +
                  -d / 2 +
                  ", 0," +
                  h +
                  "," +
                  -d / 2 +
                  "])} itemSize={3} />\n            <bufferAttribute attach='index' count={24} array={new Uint16Array([0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2,0,2,5,0,5,3])} itemSize={1} />\n          </bufferGeometry>";
                break;
              case "tube":
                geometryCode =
                  "<torusGeometry args={[" +
                  shape.size[0] +
                  ", " +
                  shape.size[1] +
                  ", 16, 32]} />";
                break;
              default:
                geometryCode = "<boxGeometry args={" + sizeStr + "} />";
            }

            const materialTag =
              shape.materialType === "basic"
                ? "meshBasicMaterial"
                : shape.materialType === "phong"
                ? "meshPhongMaterial"
                : shape.materialType === "toon"
                ? "meshToonMaterial"
                : shape.materialType === "lambert"
                ? "meshLambertMaterial"
                : shape.materialType === "physical"
                ? "meshPhysicalMaterial"
                : "meshStandardMaterial";

            return (
              "        <mesh position={" +
              posStr +
              "} rotation={" +
              rotStr +
              "} castShadow receiveShadow>\n" +
              "          " +
              geometryCode +
              "\n" +
              "          <" +
              materialTag +
              " " +
              materialPropsStr +
              " />\n" +
              "        </mesh>"
            );
          })
          .join("\n\n");

        return (
          "      {/* " +
          groupName +
          " group */}\n" +
          '      <RigidBody type="fixed" colliders="cuboid">\n' +
          groupContent +
          "\n" +
          "      </RigidBody>"
        );
      })
      .join("\n\n");

    // Generate light code
    const lights = lightShapes
      .map((shape: ShapeData) => {
        const posStr =
          "[" +
          shape.position.map((v: number) => v.toFixed(2)).join(", ") +
          "]";
        const rotStr =
          "[" +
          shape.rotation.map((v: number) => v.toFixed(2)).join(", ") +
          "]";
        const colorStr = '"' + shape.color + '"';

        if (shape.shapeType === "pointLight") {
          return (
            "      <pointLight\n" +
            "        position={" +
            posStr +
            "}\n" +
            "        color={" +
            colorStr +
            "}\n" +
            "        intensity={" +
            (shape.lightIntensity || 1) +
            "}\n" +
            (shape.lightDistance
              ? "        distance={" + shape.lightDistance + "}\n"
              : "") +
            (shape.lightDecay !== 2
              ? "        decay={" + shape.lightDecay + "}\n"
              : "") +
            (shape.castShadow ? "        castShadow\n" : "") +
            "      />"
          );
        } else if (shape.shapeType === "spotLight") {
          const targetComment = shape.lightTarget
            ? "\n      {/* Light target: [" +
              shape.lightTarget.map((v: number) => v.toFixed(2)).join(", ") +
              "] - Use ref to set light.target.position.set(...) if needed */}"
            : "";

          return (
            targetComment +
            (targetComment ? "\n" : "") +
            "      <spotLight\n" +
            "        position={" +
            posStr +
            "}\n" +
            "        rotation={" +
            rotStr +
            "}\n" +
            "        color={" +
            colorStr +
            "}\n" +
            "        intensity={" +
            (shape.lightIntensity || 1) +
            "}\n" +
            (shape.lightDistance
              ? "        distance={" + shape.lightDistance + "}\n"
              : "") +
            (shape.lightAngle !== Math.PI / 4
              ? "        angle={" + shape.lightAngle?.toFixed(2) + "}\n"
              : "") +
            (shape.lightPenumbra
              ? "        penumbra={" + shape.lightPenumbra + "}\n"
              : "") +
            (shape.lightDecay !== 2
              ? "        decay={" + shape.lightDecay + "}\n"
              : "") +
            (shape.castShadow ? "        castShadow\n" : "") +
            "      />"
          );
        } else if (shape.shapeType === "directionalLight") {
          return (
            "      <directionalLight\n" +
            "        position={" +
            posStr +
            "}\n" +
            "        rotation={" +
            rotStr +
            "}\n" +
            "        color={" +
            colorStr +
            "}\n" +
            "        intensity={" +
            (shape.lightIntensity || 1) +
            "}\n" +
            (shape.castShadow ? "        castShadow\n" : "") +
            "      />"
          );
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");

    // Generate particle effect code
    const particles = particleShapes
      .map((shape: ShapeData) => {
        const posStr =
          "[" +
          shape.position.map((v: number) => v.toFixed(2)).join(", ") +
          "]";
        const effectName =
          shape.shapeType.charAt(0).toUpperCase() + shape.shapeType.slice(1);
        const scaleStr =
          shape.size[0] !== 1
            ? " scale={" + shape.size[0].toFixed(2) + "}"
            : "";
        const countStr = shape.particleCount
          ? " count={" + shape.particleCount + "}"
          : "";
        const rotationStr = shape.rotationSpeed
          ? " rotationSpeed={" + shape.rotationSpeed.toFixed(1) + "}"
          : "";

        // Default colors for each effect
        const defaultColors: Record<string, string> = {
          fire: "#ff4500",
          smoke: "#555555",
          sparks: "#ffff00",
          rain: "#a0d8f0",
          snow: "#ffffff",
          stars: "#ffeb3b",
          magicSparkle: "#00ffff",
          confetti: "#ffffff",
          confettiExplosion: "#ffffff",
        };
        const colorStr =
          shape.color !== defaultColors[shape.shapeType] &&
          ["stars", "magicSparkle"].includes(shape.shapeType)
            ? ' color="' + shape.color + '"'
            : "";
        const areaStr =
          ["rain", "snow"].includes(shape.shapeType) && shape.size[0] !== 1
            ? " area={" + (20 * shape.size[0]).toFixed(0) + "}"
            : "";

        // Confetti colors array
        const confettiColorsStr =
          shape.shapeType === "confettiExplosion" && shape.confettiColors
            ? " colors={[" +
              shape.confettiColors.map((c) => '"' + c + '"').join(", ") +
              "]}"
            : "";

        return (
          "      <" +
          effectName +
          " position={" +
          posStr +
          "}" +
          scaleStr +
          countStr +
          colorStr +
          areaStr +
          rotationStr +
          confettiColorsStr +
          " />"
        );
      })
      .join("\n");

    const footer = "\n    </group>\n" + "  );\n" + "}";

    let code = header + "\n\n" + meshes;
    if (lights) code += "\n\n      {/* Lights */}\n" + lights;
    if (particles) code += "\n\n      {/* Particle Effects */}\n" + particles;
    code += footer;

    return code;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateCode());
    alert("Code copied to clipboard!");
  };

  return (
    <div className="h-screen flex">
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas
          id="mb-canvas"
          camera={{ position: [15, 15, 15], fov: 50 }}
          shadows
        >
          <color attach="background" args={["#020617"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          <gridHelper args={[100, 100]} />

          <Physics gravity={[0, -15, 0]}>
            {/* Ground plane */}
            <RigidBody type="fixed" colliders="cuboid">
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
                position={[0, 0, 0]}
              >
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.8} />
              </mesh>
            </RigidBody>

            {/* Reference car for scale */}
            <group position={[15, 0.3, 0]}>
              <CarModel
                bodyColor="#ef4444"
                trimColor="#111827"
                isReversing={false}
              />
            </group>
          </Physics>

          {shapes.map((shape) => (
            <DraggableShape
              key={shape.id}
              shape={shape}
              isSelected={selectedShapeIds.includes(shape.id)}
              onSelect={() => {
                if (isCtrlPressed) {
                  // Multi-select with Ctrl/Shift
                  setSelectedShapeIds((prev) =>
                    prev.includes(shape.id)
                      ? prev.filter((id) => id !== shape.id)
                      : [...prev, shape.id]
                  );
                } else {
                  // Single select
                  setSelectedShapeIds([shape.id]);
                }
              }}
              transformMode={transformMode}
              onTransform={(
                position: [number, number, number],
                rotation: [number, number, number],
                size: [number, number, number]
              ) => {
                // Calculate offset from original position
                const offset = [
                  position[0] - shape.position[0],
                  position[1] - shape.position[1],
                  position[2] - shape.position[2],
                ] as [number, number, number];

                // Update all selected shapes
                selectedShapes.forEach((s) => {
                  if (s.id === shape.id) {
                    updateShape(s.id, { position, rotation, size });
                  } else {
                    // Move other selected shapes by the same offset
                    const newPos = [
                      s.position[0] + offset[0],
                      s.position[1] + offset[1],
                      s.position[2] + offset[2],
                    ] as [number, number, number];
                    updateShape(s.id, { position: newPos });
                  }
                });
              }}
            />
          ))}

          {navMode === "orbit" ? (
            <OrbitControls makeDefault />
          ) : (
            <>
              <WalkControls enabled={true} />
            </>
          )}
        </Canvas>

        {/* Mode selector and undo/redo overlay */}
        <div className="absolute top-4 left-4 flex gap-3">
          <div className="bg-slate-800 p-3 rounded-lg shadow-lg">
            <div className="text-white text-sm font-semibold mb-2">
              Transform Mode
            </div>
            <div className="flex gap-2">
              {(["translate", "rotate", "scale"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTransformMode(mode)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    transformMode === mode
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="absolute top-4 left-56 flex gap-3">
            <div className="bg-slate-800 p-3 rounded-lg shadow-lg">
              <div className="text-white text-sm font-semibold mb-2">
                Navigation Mode
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setNavMode("orbit")}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    navMode === "orbit"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  Orbit
                </button>
                <button
                  onClick={() => setNavMode("walk")}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    navMode === "walk"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  Walk (WASD)
                </button>
              </div>
              {navMode === "walk" && (
                <div className="text-xs text-slate-300 mt-2">
                  Click the canvas and press W/A/S/D to move. Hold Shift to
                  sprint. Press Esc to release pointer lock.
                </div>
              )}
              {navMode === "walk" && (
                <div className="mt-2">
                  <button
                    onClick={() => {
                      try {
                        const canvas = document.getElementById(
                          "mb-canvas"
                        ) as HTMLCanvasElement | null;
                        if (
                          canvas &&
                          typeof canvas.requestPointerLock === "function"
                        ) {
                          canvas.requestPointerLock();
                        } else {
                          alert("Pointer lock not supported in this browser.");
                        }
                      } catch (err) {
                        // ignore
                      }
                    }}
                    className="mt-2 w-full bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs"
                  >
                    Click canvas to enter Walk mode
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800 p-3 rounded-lg shadow-lg">
            <div className="text-white text-sm font-semibold mb-2">History</div>
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  historyIndex <= 0
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
                title="Undo (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  historyIndex >= history.length - 1
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
                title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
              >
                ↷ Redo
              </button>
            </div>
          </div>
        </div>

        {/* Polygon counter */}
        <div className="absolute top-4 right-4 bg-slate-800 p-3 rounded-lg shadow-lg">
          <div className="text-white text-sm">
            <span className="font-semibold">Polygons:</span> ~
            {shapes.reduce((sum, s) => {
              const polyCount =
                s.shapeType === "sphere"
                  ? 2048
                  : s.shapeType === "cylinder"
                  ? 128
                  : s.shapeType === "cone"
                  ? 64
                  : s.shapeType === "wedge"
                  ? 8
                  : s.shapeType === "tube"
                  ? 1024
                  : 12;
              return sum + polyCount;
            }, 0)}
            <div className="text-xs text-slate-400 mt-1">
              {shapes.length} shapes
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-96 bg-slate-900 text-white p-4 overflow-y-auto">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">Model Builder</h2>
            <button
              onClick={addShape}
              className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded text-sm font-medium"
            >
              + Add Shape
            </button>
          </div>
          <button
            onClick={importCarModel}
            className="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-medium mb-2"
          >
            🚗 Import Car Model
          </button>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setSelectedShapeIds(shapes.map((s) => s.id))}
              className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-xs font-medium"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedShapeIds([])}
              className="flex-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs font-medium"
            >
              Deselect All
            </button>
          </div>
          <div className="text-xs text-slate-400 bg-slate-800 p-2 rounded">
            💡 Hold <kbd className="bg-slate-700 px-1 rounded">Ctrl</kbd> or{" "}
            <kbd className="bg-slate-700 px-1 rounded">Shift</kbd> to select
            multiple shapes
          </div>
        </div>

        {/* Shapes List */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">
            OBJECTS ({shapes.length})
          </h3>
          <div className="space-y-2">
            {shapes.map((shape) => (
              <div
                key={shape.id}
                className={`p-3 rounded cursor-pointer ${
                  selectedShapeIds.includes(shape.id)
                    ? "bg-indigo-900/50 border border-indigo-600"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
                onClick={(e) => {
                  if (e.ctrlKey || e.shiftKey) {
                    setSelectedShapeIds((prev) =>
                      prev.includes(shape.id)
                        ? prev.filter((id) => id !== shape.id)
                        : [...prev, shape.id]
                    );
                  } else {
                    setSelectedShapeIds([shape.id]);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex-1">
                    {shape.name}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateShape(shape.id);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-2 py-1 rounded"
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteShape(shape.id);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm px-2 py-1 rounded"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Shape Properties */}
        {selectedShape && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-400">
                  PROPERTIES
                </h3>
                {selectedShapes.length > 1 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    {selectedShapes.length} selected
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {selectedShapes.length > 1 && (
                  <>
                    <button
                      onClick={duplicateSelectedShapes}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                      title="Duplicate All Selected"
                    >
                      📋 Duplicate All
                    </button>
                    <button
                      onClick={() => {
                        selectedShapeIds.forEach((id) => deleteShape(id));
                        setSelectedShapeIds([]);
                      }}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                    >
                      Delete All
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedShapeIds([])}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
                >
                  Deselect
                </button>
              </div>
            </div>

            {/* Name */}
            {selectedShapes.length === 1 && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-1 block">
                  Name
                </label>
                <input
                  type="text"
                  value={selectedShape.name}
                  onChange={(e) =>
                    updateShape(selectedShape.id, { name: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                />
              </div>
            )}

            {/* Position */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">
                Position
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["x", "y", "z"].map((axis, i) => (
                  <div key={axis}>
                    <label className="text-xs text-slate-500">
                      {axis.toUpperCase()}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedShape.position[i].toFixed(2)}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value) || 0;
                        const offset = newValue - selectedShape.position[i];

                        // Move all selected shapes by the same offset
                        selectedShapes.forEach((shape) => {
                          const newPos = [...shape.position] as [
                            number,
                            number,
                            number
                          ];
                          newPos[i] = shape.position[i] + offset;
                          updateShape(shape.id, { position: newPos });
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">
                Size (Width, Height, Depth)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["w", "h", "d"].map((axis, i) => (
                  <div key={axis}>
                    <label className="text-xs text-slate-500">
                      {axis.toUpperCase()}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedShape.size[i].toFixed(2)}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value) || 0.1;
                        const ratio = newValue / selectedShape.size[i];

                        // Scale all selected shapes by the same ratio
                        selectedShapes.forEach((shape) => {
                          const newSize = [...shape.size] as [
                            number,
                            number,
                            number
                          ];
                          newSize[i] = shape.size[i] * ratio;
                          updateShape(shape.id, { size: newSize });
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Rotation */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">
                Rotation (radians)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["x", "y", "z"].map((axis, i) => (
                  <div key={axis}>
                    <label className="text-xs text-slate-500">
                      {axis.toUpperCase()}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedShape.rotation[i].toFixed(2)}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value) || 0;
                        const offset = newValue - selectedShape.rotation[i];

                        // Rotate all selected shapes by the same offset
                        selectedShapes.forEach((shape) => {
                          const newRot = [...shape.rotation] as [
                            number,
                            number,
                            number
                          ];
                          newRot[i] = shape.rotation[i] + offset;
                          updateShape(shape.id, { rotation: newRot });
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Color</label>
              <input
                type="color"
                value={selectedShape.color}
                onChange={(e) => {
                  updateShape(selectedShape.id, { color: e.target.value });
                }}
                onBlur={(e) => {
                  pushRecentColor(e.target.value);
                }}
                className="w-full h-10 bg-slate-800 border border-slate-700 rounded cursor-pointer"
              />

              {/* Recent color swatches */}
              {recentColors.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {recentColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        updateShape(selectedShape.id, { color: c });
                        pushRecentColor(c);
                      }}
                      title={c}
                      className={`w-6 h-6 rounded-md border`}
                      style={{
                        background: c,
                        border:
                          selectedShape.color === c
                            ? "2px solid #fff"
                            : "1px solid rgba(255,255,255,0.08)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Shape Type */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">
                Shape Type
              </label>
              <select
                value={selectedShape.shapeType}
                onChange={(e) =>
                  updateShape(selectedShape.id, {
                    shapeType: e.target.value as ShapeType,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm"
              >
                <option value="box">Box</option>
                <option value="sphere">Sphere</option>
                <option value="cylinder">Cylinder</option>
                <option value="cone">Cone</option>
                <option value="wedge">Wedge (Roof/Ramp)</option>
                <option value="tube">Tube (Torus)</option>
                <option value="pointLight">Point Light</option>
                <option value="spotLight">Spot Light</option>
                <option value="directionalLight">Directional Light</option>
                <option disabled>──────────</option>
                <option value="fire">🔥 Fire Effect</option>
                <option value="smoke">💨 Smoke Effect</option>
                <option value="sparks">⚡ Sparks Effect</option>
                <option value="rain">🌧️ Rain Effect</option>
                <option disabled>──────────</option>
                <option value="snow">❄️ Snow Effect</option>
                <option value="stars">⭐ Twinkling Stars</option>
                <option value="magicSparkle">✨ Magic Sparkles</option>
                <option value="confetti">🎊 Confetti</option>
                <option value="confettiExplosion">💥 Confetti Explosion</option>
              </select>
            </div>

            {/* Light Properties */}
            {(selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight") && (
              <>
                <div className="mb-4">
                  <label className="flex items-center text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={selectedShape.showHelper || false}
                      onChange={(e) =>
                        updateShape(selectedShape.id, {
                          showHelper: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    Show Directional Helper
                  </label>
                  <div className="text-xs text-slate-500 mt-1">
                    Visual indicator (not included in generated code)
                  </div>
                </div>
              </>
            )}

            {(selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight") && (
              <>
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">
                    Light Intensity
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={selectedShape.lightIntensity || 1}
                    onChange={(e) =>
                      updateShape(selectedShape.id, {
                        lightIntensity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-slate-500 text-right">
                    {(selectedShape.lightIntensity || 1).toFixed(1)}
                  </div>
                </div>

                {(selectedShape.shapeType === "pointLight" ||
                  selectedShape.shapeType === "spotLight") && (
                  <>
                    <div className="mb-4">
                      <label className="text-xs text-slate-400 mb-1 block">
                        Distance (0 = infinite)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={selectedShape.lightDistance || 0}
                        onChange={(e) =>
                          updateShape(selectedShape.id, {
                            lightDistance: parseFloat(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <div className="text-xs text-slate-500 text-right">
                        {(selectedShape.lightDistance || 0).toFixed(0)}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="text-xs text-slate-400 mb-1 block">
                        Decay (Light Falloff)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={selectedShape.lightDecay || 2}
                        onChange={(e) =>
                          updateShape(selectedShape.id, {
                            lightDecay: parseFloat(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <div className="text-xs text-slate-500 text-right">
                        {(selectedShape.lightDecay || 2).toFixed(1)}
                      </div>
                    </div>
                  </>
                )}

                {selectedShape.shapeType === "spotLight" && (
                  <>
                    <div className="mb-4">
                      <label className="text-xs text-slate-400 mb-1 block">
                        Cone Angle (radians)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={Math.PI / 2}
                        step="0.01"
                        value={selectedShape.lightAngle || Math.PI / 4}
                        onChange={(e) =>
                          updateShape(selectedShape.id, {
                            lightAngle: parseFloat(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <div className="text-xs text-slate-500 text-right">
                        {(selectedShape.lightAngle || Math.PI / 4).toFixed(2)}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="text-xs text-slate-400 mb-1 block">
                        Penumbra (Edge Softness)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selectedShape.lightPenumbra || 0}
                        onChange={(e) =>
                          updateShape(selectedShape.id, {
                            lightPenumbra: parseFloat(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <div className="text-xs text-slate-500 text-right">
                        {(selectedShape.lightPenumbra || 0).toFixed(2)}
                      </div>
                    </div>
                  </>
                )}

                {(selectedShape.shapeType === "spotLight" ||
                  selectedShape.shapeType === "directionalLight") && (
                  <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-1 block">
                      Light Target Position (where light points)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["x", "y", "z"].map((axis, i) => (
                        <div key={axis}>
                          <label className="text-xs text-slate-500">
                            {axis.toUpperCase()}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={
                              selectedShape.lightTarget?.[i]?.toFixed(1) ||
                              (i === 2 ? "5.0" : "0.0")
                            }
                            onChange={(e) => {
                              const newTarget = selectedShape.lightTarget
                                ? [...selectedShape.lightTarget]
                                : [0, 0, 5];
                              newTarget[i] = parseFloat(e.target.value) || 0;
                              updateShape(selectedShape.id, {
                                lightTarget: newTarget as [
                                  number,
                                  number,
                                  number
                                ],
                              });
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      💡 Tip: For car headlights, use positive Z (forward). For
                      taillights, use negative Z (backward).
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="flex items-center text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={selectedShape.castShadow || false}
                      onChange={(e) =>
                        updateShape(selectedShape.id, {
                          castShadow: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    Cast Shadows (may impact performance)
                  </label>
                </div>
              </>
            )}

            {/* Particle Effect Properties */}
            {(selectedShape.shapeType === "fire" ||
              selectedShape.shapeType === "smoke" ||
              selectedShape.shapeType === "sparks" ||
              selectedShape.shapeType === "rain" ||
              selectedShape.shapeType === "snow" ||
              selectedShape.shapeType === "stars" ||
              selectedShape.shapeType === "magicSparkle" ||
              selectedShape.shapeType === "confetti" ||
              selectedShape.shapeType === "confettiExplosion") && (
              <>
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">
                    Particle Count
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    value={
                      selectedShape.particleCount ||
                      (selectedShape.shapeType === "fire"
                        ? 200
                        : selectedShape.shapeType === "smoke"
                        ? 100
                        : selectedShape.shapeType === "sparks"
                        ? 50
                        : selectedShape.shapeType === "rain"
                        ? 500
                        : selectedShape.shapeType === "snow"
                        ? 300
                        : selectedShape.shapeType === "stars"
                        ? 50
                        : selectedShape.shapeType === "magicSparkle"
                        ? 100
                        : selectedShape.shapeType === "confettiExplosion"
                        ? 150
                        : 200)
                    }
                    onChange={(e) =>
                      updateShape(selectedShape.id, {
                        particleCount: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-slate-500 text-right">
                    {selectedShape.particleCount ||
                      (selectedShape.shapeType === "fire"
                        ? 200
                        : selectedShape.shapeType === "smoke"
                        ? 100
                        : selectedShape.shapeType === "sparks"
                        ? 50
                        : selectedShape.shapeType === "rain"
                        ? 500
                        : selectedShape.shapeType === "snow"
                        ? 300
                        : selectedShape.shapeType === "stars"
                        ? 50
                        : selectedShape.shapeType === "magicSparkle"
                        ? 100
                        : selectedShape.shapeType === "confettiExplosion"
                        ? 150
                        : 200)}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">
                    Scale (Effect Size)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={selectedShape.size[0]}
                    onChange={(e) =>
                      updateShape(selectedShape.id, {
                        size: [
                          parseFloat(e.target.value),
                          parseFloat(e.target.value),
                          parseFloat(e.target.value),
                        ],
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-slate-500 text-right">
                    {selectedShape.size[0].toFixed(1)}x
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">
                    Rotation Speed
                  </label>
                  <input
                    type="range"
                    min="-3"
                    max="3"
                    step="0.1"
                    value={
                      selectedShape.rotationSpeed ??
                      (selectedShape.shapeType === "stars" ? 0.5 : 0)
                    }
                    onChange={(e) =>
                      updateShape(selectedShape.id, {
                        rotationSpeed: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-slate-500 text-right">
                    {(
                      selectedShape.rotationSpeed ??
                      (selectedShape.shapeType === "stars" ? 0.5 : 0)
                    ).toFixed(1)}{" "}
                    rad/s
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Negative = counter-clockwise
                  </div>
                </div>

                {/* Confetti Colors - only for confettiExplosion */}
                {selectedShape.shapeType === "confettiExplosion" && (
                  <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-2 block">
                      Confetti Colors (click to customize)
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(
                        selectedShape.confettiColors || [
                          "#ff3352",
                          "#ffe619",
                          "#3366ff",
                          "#33ff4d",
                          "#ff66cc",
                          "#ff9933",
                          "#cc4dff",
                        ]
                      ).map((color, idx) => (
                        <div key={idx} className="relative">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                              const newColors = [
                                ...(selectedShape.confettiColors || [
                                  "#ff3352",
                                  "#ffe619",
                                  "#3366ff",
                                  "#33ff4d",
                                  "#ff66cc",
                                  "#ff9933",
                                  "#cc4dff",
                                ]),
                              ];
                              newColors[idx] = e.target.value;
                              updateShape(selectedShape.id, {
                                confettiColors: newColors,
                              });
                            }}
                            className="w-10 h-10 rounded cursor-pointer border border-slate-600"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const currentColors =
                            selectedShape.confettiColors || [
                              "#ff3352",
                              "#ffe619",
                              "#3366ff",
                              "#33ff4d",
                              "#ff66cc",
                              "#ff9933",
                              "#cc4dff",
                            ];
                          if (currentColors.length < 10) {
                            updateShape(selectedShape.id, {
                              confettiColors: [...currentColors, "#ffffff"],
                            });
                          }
                        }}
                        className="w-10 h-10 rounded border border-dashed border-slate-600 flex items-center justify-center text-slate-400 hover:bg-slate-700"
                        title="Add color"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        updateShape(selectedShape.id, {
                          confettiColors: undefined,
                        });
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                      Reset to defaults
                    </button>
                  </div>
                )}

                <div className="text-xs text-slate-400 p-2 bg-slate-800 rounded">
                  <strong>Effect:</strong>{" "}
                  {selectedShape.shapeType === "fire"
                    ? "Rising glowing particles"
                    : selectedShape.shapeType === "smoke"
                    ? "Slow expanding fog"
                    : selectedShape.shapeType === "sparks"
                    ? "Fast projectiles with gravity"
                    : selectedShape.shapeType === "rain"
                    ? "Falling rain streaks"
                    : selectedShape.shapeType === "snow"
                    ? "Gentle drifting snowflakes"
                    : selectedShape.shapeType === "stars"
                    ? "Pulsing twinkling stars"
                    : selectedShape.shapeType === "magicSparkle"
                    ? "Rising spiraling sparkles"
                    : selectedShape.shapeType === "confettiExplosion"
                    ? "Bursting confetti explosion"
                    : "Colorful tumbling confetti"}
                </div>
              </>
            )}

            {/* Material Type - only show for mesh shapes */}
            {!(
              selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight" ||
              selectedShape.shapeType === "fire" ||
              selectedShape.shapeType === "smoke" ||
              selectedShape.shapeType === "sparks" ||
              selectedShape.shapeType === "rain" ||
              selectedShape.shapeType === "snow" ||
              selectedShape.shapeType === "stars" ||
              selectedShape.shapeType === "magicSparkle" ||
              selectedShape.shapeType === "confetti" ||
              selectedShape.shapeType === "confettiExplosion"
            ) && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-1 block">
                  Material Type
                </label>
                <select
                  value={selectedShape.materialType}
                  onChange={(e) =>
                    updateShape(selectedShape.id, {
                      materialType: e.target.value as MaterialType,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm"
                >
                  <option value="standard">Standard (PBR)</option>
                  <option value="physical">Physical (Advanced PBR)</option>
                  <option value="phong">Phong (Shiny)</option>
                  <option value="toon">Toon (Cartoon)</option>
                  <option value="lambert">Lambert (Matte)</option>
                  <option value="basic">Basic (Unlit)</option>
                </select>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedShape.materialType === "standard" &&
                    "Realistic with roughness/metalness"}
                  {selectedShape.materialType === "physical" &&
                    "Advanced with clearcoat"}
                  {selectedShape.materialType === "phong" &&
                    "Classic shiny/glossy look"}
                  {selectedShape.materialType === "toon" &&
                    "Cartoon/cel-shaded style"}
                  {selectedShape.materialType === "lambert" &&
                    "Soft matte finish"}
                  {selectedShape.materialType === "basic" &&
                    "No lighting, flat color"}
                </div>
              </div>
            )}

            {/* Material Properties - only show for mesh shapes */}
            {!(
              selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight" ||
              selectedShape.shapeType === "fire" ||
              selectedShape.shapeType === "smoke" ||
              selectedShape.shapeType === "sparks" ||
              selectedShape.shapeType === "rain" ||
              selectedShape.shapeType === "snow" ||
              selectedShape.shapeType === "stars" ||
              selectedShape.shapeType === "magicSparkle" ||
              selectedShape.shapeType === "confetti" ||
              selectedShape.shapeType === "confettiExplosion"
            ) &&
              (selectedShape.materialType === "standard" ||
                selectedShape.materialType === "physical") && (
                <>
                  <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-1 block">
                      Roughness
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedShape.roughness}
                      onChange={(e) =>
                        updateShape(selectedShape.id, {
                          roughness: parseFloat(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <div className="text-xs text-slate-500 text-right">
                      {selectedShape.roughness.toFixed(2)}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-1 block">
                      Metalness
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedShape.metalness}
                      onChange={(e) =>
                        updateShape(selectedShape.id, {
                          metalness: parseFloat(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <div className="text-xs text-slate-500 text-right">
                      {selectedShape.metalness.toFixed(2)}
                    </div>
                  </div>
                </>
              )}

            {!(
              selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight" ||
              selectedShape.shapeType === "fire" ||
              selectedShape.shapeType === "smoke" ||
              selectedShape.shapeType === "sparks" ||
              selectedShape.shapeType === "rain" ||
              selectedShape.shapeType === "snow" ||
              selectedShape.shapeType === "stars" ||
              selectedShape.shapeType === "magicSparkle" ||
              selectedShape.shapeType === "confetti" ||
              selectedShape.shapeType === "confettiExplosion"
            ) &&
              selectedShape.materialType === "physical" && (
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">
                    Clearcoat (Glass/Car Paint Effect)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedShape.clearcoat || 0}
                    onChange={(e) =>
                      updateShape(selectedShape.id, {
                        clearcoat: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-slate-500 text-right">
                    {(selectedShape.clearcoat || 0).toFixed(2)}
                  </div>
                </div>
              )}

            {!(
              selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight" ||
              selectedShape.shapeType === "fire" ||
              selectedShape.shapeType === "smoke" ||
              selectedShape.shapeType === "sparks" ||
              selectedShape.shapeType === "rain" ||
              selectedShape.shapeType === "snow" ||
              selectedShape.shapeType === "stars" ||
              selectedShape.shapeType === "magicSparkle" ||
              selectedShape.shapeType === "confetti" ||
              selectedShape.shapeType === "confettiExplosion"
            ) &&
              (selectedShape.materialType === "phong" ||
                selectedShape.materialType === "lambert") && (
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">
                    Reflectivity
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedShape.reflectivity || 0.5}
                    onChange={(e) =>
                      updateShape(selectedShape.id, {
                        reflectivity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-slate-500 text-right">
                    {(selectedShape.reflectivity || 0.5).toFixed(2)}
                  </div>
                </div>
              )}

            {!(
              selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight" ||
              selectedShape.shapeType === "fire" ||
              selectedShape.shapeType === "smoke" ||
              selectedShape.shapeType === "sparks" ||
              selectedShape.shapeType === "rain" ||
              selectedShape.shapeType === "snow" ||
              selectedShape.shapeType === "stars" ||
              selectedShape.shapeType === "magicSparkle" ||
              selectedShape.shapeType === "confetti" ||
              selectedShape.shapeType === "confettiExplosion"
            ) &&
              selectedShape.materialType !== "basic" && (
                <>
                  <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-1 block">
                      Emissive Color (Glow)
                    </label>
                    <input
                      type="color"
                      value={selectedShape.emissive || "#000000"}
                      onChange={(e) =>
                        updateShape(selectedShape.id, {
                          emissive: e.target.value,
                        })
                      }
                      className="w-full h-8 bg-slate-800 border border-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-1 block">
                      Emissive Intensity
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={selectedShape.emissiveIntensity || 0}
                      onChange={(e) =>
                        updateShape(selectedShape.id, {
                          emissiveIntensity: parseFloat(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <div className="text-xs text-slate-500 text-right">
                      {(selectedShape.emissiveIntensity || 0).toFixed(1)}
                    </div>
                  </div>
                </>
              )}

            {!(
              selectedShape.shapeType === "pointLight" ||
              selectedShape.shapeType === "spotLight" ||
              selectedShape.shapeType === "directionalLight" ||
              selectedShape.shapeType === "fire" ||
              selectedShape.shapeType === "smoke" ||
              selectedShape.shapeType === "sparks" ||
              selectedShape.shapeType === "rain"
            ) && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-1 block">
                  Opacity
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedShape.opacity}
                  onChange={(e) => {
                    const opacity = parseFloat(e.target.value);
                    updateShape(selectedShape.id, {
                      opacity,
                      transparent: opacity < 1,
                    });
                  }}
                  className="w-full"
                />
                <div className="text-xs text-slate-500 text-right">
                  {selectedShape.opacity.toFixed(2)}
                </div>
              </div>
            )}

            {/* Group Name */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">
                Group Name (for RigidBody)
              </label>
              <input
                type="text"
                value={selectedShape.groupName}
                onChange={(e) =>
                  updateShape(selectedShape.id, { groupName: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                placeholder="e.g., tower, base, windows"
              />
              <div className="text-xs text-slate-500 mt-1">
                Shapes with same group share one RigidBody
              </div>
            </div>
          </div>
        )}

        {/* Generate Code */}
        <div>
          <button
            onClick={() => setShowCode(!showCode)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded font-medium mb-2"
          >
            {showCode ? "Hide Code" : "Generate JSX Code"}
          </button>

          {showCode && (
            <div className="relative">
              <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto border border-slate-700">
                <code>{generateCode()}</code>
              </pre>
              <button
                onClick={copyToClipboard}
                className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
