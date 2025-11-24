export type PlayerCar = {
  id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  angle: number;
  speed: number;
  color: string;
  damage?: number;
  missingParts?: string[];
  destroyed?: boolean;
  lastCollisionSpeed?: number;
  score?: number;
  carryingDeliveryId?: string;
  hidden?: boolean;
  activePowerUps?: Array<{
    type: string;
    expiresAt: number;
  }>;
};

export type DebrisState = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  size: number;
  color: string;
  persistent?: boolean;
  ttl?: number;
};

export type DestructibleState = {
  id: string;
  type: "tree" | "building";
  x: number;
  y: number;
  radius: number;
  height: number;
  width?: number;
  depth?: number;
  color?: string;
  health: number;
  maxHealth: number;
  destroyed: boolean;
  debris?: DebrisState[];
  lastHitAt?: number;
};

export type TimerState = {
  startedAt: number;
  endsAt: number;
  durationMs: number;
  timeRemainingMs: number;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  color: string;
};

export type DeliveryItemState = "waiting" | "carried" | "cooldown";

export type DeliveryItem = {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  targetIndex?: number;
  carrierId?: string;
  previousCarrierId?: string;
  state: DeliveryItemState;
};

export type MatchEvent = {
  id: string;
  playerId: string;
  playerName: string;
  description: string;
  points: number;
  timestamp: number;
  matchTimeMs: number;
};

// Re-export powerup types
export type {
  PowerUpType,
  PowerUpItem,
  ActivePowerUp,
  PowerUpConfig,
} from "./types/powerup";
export { POWERUP_CONFIGS } from "./types/powerup";
