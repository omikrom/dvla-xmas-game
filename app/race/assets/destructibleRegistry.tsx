"use client";

import MyBuilding from "./MyBuilding";
import DVLABuildingDestructible from "./DVLABuildingDestructible";

// Registry of custom destructible components.
// Add your components here keyed by a short identifier you will use in the
// destructible data (either `item.model`, `item.type` or the `id` prefix).
export const destructibleRegistry: Record<string, any> = {
  // Example: when a destructible has `id: 'mybuilding-1'` or `type: 'mybuilding'`
  // the `MyBuilding` component will be used to render it.
  mybuilding: MyBuilding,
  // DVLA building - large destructible landmark
  dvla: DVLABuildingDestructible,
  dvlab: DVLABuildingDestructible,
};

export function resolveDestructibleComponent(key?: string) {
  if (!key) return undefined;
  return destructibleRegistry[key];
}

export default destructibleRegistry;
