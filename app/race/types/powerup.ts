export type PowerUpType =
  | "speed"
  | "heal"
  | "shield"
  | "magnet"
  | "doublePoints"
  | "repel"
  | "invisibility"
  | "teleport";

export type PowerUpItem = {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  z?: number;
  collected: boolean;
  collectedBy?: string;
  collectedAt?: number;
  respawnAt?: number;
};

export type ActivePowerUp = {
  type: PowerUpType;
  activatedAt: number;
  expiresAt: number;
  value?: number; // For heal amount, speed multiplier, etc.
};

export type PowerUpConfig = {
  type: PowerUpType;
  name: string;
  description: string;
  duration: number; // milliseconds, 0 for instant effects
  baseColor: string;
  accentColor: string;
  icon: string;
  effect: {
    speedMultiplier?: number;
    healAmount?: number;
    shieldDuration?: number;
    magnetRadius?: number;
    repelRadius?: number;
  };
  respawnTime: number; // milliseconds
};

export const POWERUP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  speed: {
    type: "speed",
    name: "Speed Boost",
    description: "Increases your speed by 50% for 15 seconds",
    duration: 15000,
    baseColor: "#3b82f6", // blue
    accentColor: "#60a5fa",
    icon: "⚡",
    effect: {
      speedMultiplier: 1.5,
    },
    respawnTime: 30000,
  },
  heal: {
    type: "heal",
    name: "Repair Kit",
    description: "Instantly repairs 50% damage",
    duration: 0, // instant
    baseColor: "#10b981", // green
    accentColor: "#34d399",
    icon: "🔧",
    effect: {
      healAmount: 50,
    },
    respawnTime: 25000,
  },
  shield: {
    type: "shield",
    name: "Shield",
    description: "Protects from damage for 10 seconds",
    duration: 10000,
    baseColor: "#8b5cf6", // purple
    accentColor: "#a78bfa",
    icon: "🛡️",
    effect: {
      shieldDuration: 10000,
    },
    respawnTime: 35000,
  },
  magnet: {
    type: "magnet",
    name: "Delivery Magnet",
    description: "Attracts nearby deliveries for 12 seconds",
    duration: 12000,
    baseColor: "#f59e0b", // amber
    accentColor: "#fbbf24",
    icon: "🧲",
    effect: {
      magnetRadius: 8,
    },
    respawnTime: 30000,
  },
  doublePoints: {
    type: "doublePoints",
    name: "Double Points",
    description: "Earn double points for 10 seconds",
    duration: 10000,
    baseColor: "#f43f5e", // pink
    accentColor: "#fb7185",
    icon: "💎",
    effect: {},
    respawnTime: 35000,
  },
  invisibility: {
    type: "invisibility",
    name: "Invisibility",
    description: "Become invisible to other players for 8 seconds",
    duration: 8000,
    baseColor: "#64748b", // slate
    accentColor: "#a1a1aa",
    icon: "👻",
    effect: {},
    respawnTime: 35000,
  },
  teleport: {
    type: "teleport",
    name: "Teleport",
    description: "Teleport to a random location",
    duration: 0,
    baseColor: "#6366f1", // indigo
    accentColor: "#818cf8",
    icon: "🌀",
    effect: {},
    respawnTime: 35000,
  },
  repel: {
    type: "repel",
    name: "Repel Burst",
    description: "Pushes nearby players away for 8 seconds",
    duration: 8000,
    baseColor: "#ef4444", // red
    accentColor: "#fb7185",
    icon: "📤",
    effect: {
      // client-side hint for visuals
      repelRadius: 8,
    },
    respawnTime: 30000,
  },
};
