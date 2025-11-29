export const SERVER_PERIODIC_PHYSICS_MS = 50;
export const MIN_PHYSICS_STEP_MS = 16;
export const BASE_MAX_SPEED = 25;
export const BASE_ACCELERATION = 20;
export const BASE_DECELERATION = 15;
export const BASE_TURN_SPEED = 3.0;
export const GROUND_HEIGHT = 0.3;
export const CLIENT_CORRECTION_DURATION_MS = 120;
export const CLIENT_MAX_EXTRAPOLATION_MS = 200; // how far to extrapolate remote players
// How many substeps the client uses when replaying pending inputs. Higher = smoother but more CPU.
export const CLIENT_REPLAY_SUBSTEPS = Number(process.env.CLIENT_REPLAY_SUBSTEPS || 6);
// Distance (units) above which corrections are treated as "big" — duration will scale up instead of snapping.
export const CLIENT_BIG_CORRECTION_DIST = Number(process.env.CLIENT_BIG_CORRECTION_DIST || 1.5);
// Maximum smoothing time for large corrections (ms)
export const CLIENT_BIG_CORRECTION_MAX_MS = Number(process.env.CLIENT_BIG_CORRECTION_MAX_MS || 300);
// Position smoothing time constant for remote players (ms). Lower = more reactive, higher = smoother.
export const CLIENT_POS_SMOOTH_TAU_MS = Number(process.env.CLIENT_POS_SMOOTH_TAU_MS || 80);
