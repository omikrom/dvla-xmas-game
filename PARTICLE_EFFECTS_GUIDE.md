# Particle Effects Guide

## Using Particle Effects in Model Builder

The ModelBuilder now supports **lights** and **particle effects** for creating dynamic, visually appealing scenes.

## Available Particle Effects

Import from `app/race/assets/ParticleEffects.tsx`:

```tsx
import { Fire, Smoke, Sparks, Rain } from "./ParticleEffects";
```

### 1. Fire Effect 🔥

Animated rising particles with glow, perfect for fireplaces, torches, explosions.

```tsx
<Fire
  position={[0, 0, 0]}
  scale={1}
  count={200} // number of particles
  color="#ff4500" // fire color
/>
```

### 2. Smoke Effect 💨

Slow rising, expanding particles for chimneys, exhaust, fog.

```tsx
<Smoke
  position={[0, 2, 0]}
  scale={1}
  count={100}
  color="#555555" // smoke color (gray/black)
/>
```

### 3. Sparks Effect ⚡

Fast-moving bright particles for welding, electrical effects, magic.

```tsx
<Sparks
  position={[0, 0, 0]}
  scale={1}
  count={50}
  color="#ffff00" // spark color (yellow/orange)
/>
```

### 4. Rain Effect 🌧️

Falling streaks for weather effects.

```tsx
<Rain
  position={[0, 10, 0]} // high above scene
  scale={1}
  count={500}
  area={20} // coverage area
/>
```

## Light Types in Model Builder

### Point Light 💡

Emits light in all directions from a point (like a lightbulb).

**Properties:**

- Intensity: 0-10 (brightness)
- Distance: 0-100 (0 = infinite range)
- Decay: 0-3 (light falloff rate, 2 = physically accurate)
- Color: Any hex color
- Cast Shadows: Enable/disable

**Use cases:** Lamps, candles, glowing objects

### Spot Light 🔦

Cone-shaped beam (like a flashlight or stage light).

**Properties:**

- Intensity, Distance, Decay (same as Point Light)
- Cone Angle: 0-1.57 radians (beam width)
- Penumbra: 0-1 (edge softness)
- Color & Shadows

**Use cases:** Flashlights, car headlights, stage lighting, focused beams

### Directional Light ☀️

Parallel rays (like sunlight).

**Properties:**

- Intensity: 0-10
- Color
- Cast Shadows
- Rotation: Defines light direction

**Use cases:** Sunlight, moonlight, ambient outdoor lighting

## Combining Effects

### Campfire Example

```tsx
<group position={[0, 0, 0]}>
  {/* Fire at base */}
  <Fire position={[0, 0.5, 0]} scale={0.8} color="#ff6600" />

  {/* Smoke rising above */}
  <Smoke position={[0, 1.5, 0]} scale={0.5} color="#333333" />

  {/* Occasional sparks */}
  <Sparks position={[0, 0.5, 0]} scale={0.3} count={20} />

  {/* Point light for illumination */}
  <pointLight
    position={[0, 1, 0]}
    color="#ff8800"
    intensity={3}
    distance={10}
    decay={2}
  />
</group>
```

### Torch Example

```tsx
<group position={[5, 2, 0]}>
  {/* Spot light pointing down */}
  <spotLight
    position={[0, 0, 0]}
    rotation={[Math.PI / 2, 0, 0]}
    color="#ffaa00"
    intensity={5}
    angle={Math.PI / 6}
    penumbra={0.5}
    distance={15}
    castShadow
  />

  {/* Fire effect */}
  <Fire position={[0, 0, 0]} scale={0.4} count={100} />
</group>
```

### Explosion Effect

```tsx
<group position={[0, 0, 0]}>
  <Fire position={[0, 0, 0]} scale={2} count={300} color="#ff3300" />
  <Sparks position={[0, 0, 0]} scale={2} count={100} color="#ffff00" />
  <Smoke position={[0, 1, 0]} scale={1.5} count={150} color="#222222" />
</group>
```

## Performance Tips

1. **Particle Count**: Lower counts (50-200) for multiple effects, higher (300-500) for focal points
2. **Shadows**: Only enable on 1-2 lights max (expensive)
3. **Distance**: Set reasonable light distance to avoid unnecessary calculations
4. **Scale**: Use `scale` prop instead of increasing particle count when possible
5. **Additive Blending**: Fire and sparks use additive blending for glow (more expensive than normal)

## Custom Colors

### Fire Variations

- Orange Fire: `#ff4500`
- Blue Fire: `#0080ff`
- Green Fire: `#00ff80`
- Purple Fire: `#ff00ff`

### Smoke Variations

- Gray Smoke: `#555555`
- Black Smoke: `#222222`
- White Steam: `#eeeeee`

## Advanced: Creating Custom Particle Effects

Base template for custom effects:

```tsx
export function CustomEffect({ position, scale = 1, count = 100 }) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    // Initialize particle positions
    return { positions };
  }, [count, scale]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position.array;

    // Update particle logic here

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
        size={0.3}
        color="#ffffff"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}
```

## Additional Features in Model Builder

### Other capabilities:

- **Material Types**: Standard, Physical, Phong, Toon, Lambert, Basic
- **Shape Types**: Box, Sphere, Cylinder, Cone, Wedge, Tube
- **Material Properties**: Roughness, Metalness, Clearcoat, Emissive, Reflectivity
- **Transform Controls**: Translate, Rotate, Scale
- **Multi-part Models**: Group shapes with same `groupName` for single RigidBody
- **Code Export**: Generate JSX code for your entire model

## What Else Could Be Added?

### Future Ideas:

1. **Environment Maps**: HDR skyboxes and reflections
2. **Post-Processing**: Bloom, depth of field, motion blur
3. **Texture Support**: Upload and apply image textures
4. **Animation Paths**: Define movement keyframes
5. **Sound Sources**: Positional audio markers
6. **Trigger Volumes**: Invisible collision zones
7. **Water Shader**: Animated water surfaces
8. **Wind Effect**: Particle drift and object sway
9. **Lens Flare**: For bright lights
10. **Fog**: Distance-based atmospheric fog
