# PowerUp System

## Overview

The PowerUp system adds collectible power-ups throughout the race track that provide temporary or instant benefits to players.

## PowerUp Types

### 1. Speed Boost ⚡

- **Color**: Blue (#3b82f6)
- **Duration**: 15 seconds
- **Effect**: Increases speed by 50%
- **Respawn Time**: 30 seconds
- **Visual**: Blue ring around car + trailing sparks

### 2. Repair Kit 🔧

- **Color**: Green (#10b981)
- **Duration**: Instant
- **Effect**: Heals 50% of damage
- **Respawn Time**: 25 seconds
- **Visual**: Green flash on collection

### 3. Shield 🛡️

- **Color**: Purple (#8b5cf6)
- **Duration**: 10 seconds
- **Effect**: Protects from all damage
- **Respawn Time**: 35 seconds
- **Visual**: Purple wireframe sphere around car

### 4. Delivery Magnet 🧲

- **Color**: Amber (#f59e0b)
- **Duration**: 12 seconds
- **Effect**: Attracts nearby deliveries within 8 units
- **Respawn Time**: 30 seconds
- **Visual**: Amber glow effect

## Implementation

### File Structure

```
app/race/
├── types/
│   └── powerup.ts          # PowerUp types and configurations
├── assets/
│   └── PowerUp.tsx         # PowerUp 3D model component
└── page.tsx                # Game integration
```

### Adding New PowerUp Types

1. Add the type to `PowerUpType` in `types/powerup.ts`:

```typescript
export type PowerUpType =
  | "speed"
  | "heal"
  | "shield"
  | "magnet"
  | "YOUR_NEW_TYPE";
```

2. Add configuration to `POWERUP_CONFIGS`:

```typescript
YOUR_NEW_TYPE: {
  type: "YOUR_NEW_TYPE",
  name: "Display Name",
  description: "What it does",
  duration: 15000, // ms, or 0 for instant
  baseColor: "#hexcolor",
  accentColor: "#hexcolor",
  icon: "🎯",
  effect: {
    // Your custom effect properties
    customValue: 1.5,
  },
  respawnTime: 30000,
}
```

3. Handle the effect in `page.tsx` powerup collection logic:

```typescript
if (powerUp.type === "YOUR_NEW_TYPE") {
  // Apply your effect
}
```

## Game Integration

### Collection

- PowerUps are collected automatically when a player gets within 3 units
- Collection radius can be adjusted in the collection logic
- Visual feedback shows when powerup is active

### Respawn System

- PowerUps disappear when collected
- Automatically respawn after their configured respawn time
- Respawn at the same location

### Visual Feedback

1. **3D Model**: Rotating box with glowing elements
2. **Active UI**: Top-right panel shows active powerups with countdown
3. **In-Game Effects**: Visual effects on the player's car
4. **Legend**: Bottom-right shows all available powerups

## Spawn Locations

PowerUps spawn at 8 strategic locations around the track:

- 4 corners: (±30, ±30)
- 4 edges: (0, ±40) and (±40, 0)

Locations can be customized in the powerup initialization effect.

## Performance Considerations

- PowerUps use efficient particle systems
- Visual effects are conditionally rendered
- Expired powerups are automatically cleaned up
- Collection checks only run when game is in "racing" state

## Future Enhancements

Potential additions:

- Weapon powerups (rockets, mines)
- Super jump
- Ghost mode (pass through objects)
- Double points
- Time slow
- Teleport
