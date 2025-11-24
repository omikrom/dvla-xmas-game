"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import * as THREE from "three";
import ChristmasPresentModel from "./ChristmasPresent";
import type { DeliveryItem, PlayerCar } from "../types";

type DeliveryDropZonesProps = {
  deliveries: DeliveryItem[];
  cars?: PlayerCar[];
};

type DeliveryTokensProps = {
  deliveries: DeliveryItem[];
  carrierElevations?: Record<string, number>;
  interpolatedPositionsRef?: React.RefObject<
    Map<string, { x: number; y: number }>
  >;
  cars?: PlayerCar[];
};

function DeliveryDropZonesBase({ deliveries, cars }: DeliveryDropZonesProps) {
  if (!deliveries.length) return null;

  const zonesMap = new Map<
    string,
    { id: string; x: number; y: number; radius: number }
  >();

  deliveries.forEach((delivery) => {
    if (delivery.state !== "carried") return;
    const key = `${Math.round(delivery.targetX * 10)}:${Math.round(
      delivery.targetY * 10
    )}`;
    if (!zonesMap.has(key)) {
      zonesMap.set(key, {
        id: key,
        x: delivery.targetX,
        y: delivery.targetY,
        radius: delivery.targetRadius || 6.5,
      });
    }
  });

  const zones = Array.from(zonesMap.values());
  if (!zones.length) return null;

  const carsMap = new Map<string, string | undefined>(
    (cars || []).map((c) => [c.id, c.color])
  );

  return (
    <>
      {zones.map((zone) => {
        // find a delivery mapped to this zone that is currently carried
        const match = deliveries.find(
          (d) =>
            d.state === "carried" &&
            `${Math.round(d.targetX * 10)}:${Math.round(d.targetY * 10)}` ===
              zone.id
        );
        const carrierColor =
          match && match.carrierId ? carsMap.get(match.carrierId) : undefined;
        const ringColor = carrierColor || "#38bdf8";
        const fillColor = carrierColor
          ? (() => {
              try {
                const c = new THREE.Color(carrierColor!);
                c.offsetHSL(0, 0, 0.35);
                return `#${c.getHexString()}`;
              } catch (e) {
                return "#e0f2fe";
              }
            })()
          : "#e0f2fe";
        const coneEmissive = carrierColor || "#0ea5e9";

        return (
          <group key={zone.id} position={[zone.x, 0.05, zone.y]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <ringGeometry
                args={[Math.max(zone.radius - 0.8, 1), zone.radius, 48]}
              />
              <meshStandardMaterial
                color={ringColor}
                opacity={0.75}
                transparent
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <circleGeometry args={[Math.max(zone.radius - 2, 0.5), 48]} />
              <meshStandardMaterial
                color={fillColor}
                opacity={0.25}
                transparent
              />
            </mesh>
            <mesh position={[0, 2.2, 0]}>
              <coneGeometry args={[1.2, 3.2, 6]} />
              <meshStandardMaterial
                color={ringColor}
                emissive={coneEmissive}
                emissiveIntensity={0.7}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export const DeliveryDropZones = memo(DeliveryDropZonesBase);

const DEFAULT_GROUND_ELEVATION = 0.3;
const CARRIED_PRESENT_OFFSET = 1.4;

function CarriedDelivery({
  delivery,
  carrierElevation,
  interpolatedPositionsRef,
}: {
  delivery: DeliveryItem;
  carrierElevation: number;
  interpolatedPositionsRef: React.RefObject<
    Map<string, { x: number; y: number }>
  >;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current || !delivery.carrierId) return;
    const interpolatedPos = interpolatedPositionsRef.current?.get(
      delivery.carrierId
    );
    if (interpolatedPos) {
      groupRef.current.position.x = interpolatedPos.x;
      groupRef.current.position.z = interpolatedPos.y;
    }
  });

  const height =
    (carrierElevation ?? DEFAULT_GROUND_ELEVATION) + CARRIED_PRESENT_OFFSET;
  const baseColor = "#f43f5e";
  const accentColor = "#fde047";
  return (
    <group ref={groupRef} position={[delivery.x, height, delivery.y]}>
      <Float speed={2} floatIntensity={0.4} rotationIntensity={0.3}>
        <ChristmasPresentModel
          size={0.9}
          baseColor={baseColor}
          accentColor={accentColor}
          glow={1}
        />
      </Float>
    </group>
  );
}

function DeliveryTokensBase({
  deliveries,
  carrierElevations,
  interpolatedPositionsRef,
  cars,
}: DeliveryTokensProps) {
  if (!deliveries.length) return null;

  const carsMap = new Map<string, string | undefined>(
    (cars || []).map((c) => [c.id, c.color])
  );

  return (
    <>
      {deliveries.map((delivery) => {
        if (delivery.state === "cooldown") return null;
        const isCarried = Boolean(delivery.carrierId);
        const carrierId = delivery.carrierId;
        const carrierElevation = carrierId
          ? carrierElevations?.[carrierId]
          : undefined;
        // Keep presents red/gold as before. Drop zone will be colored by carrier.
        const height = isCarried
          ? (carrierElevation ?? DEFAULT_GROUND_ELEVATION) +
            CARRIED_PRESENT_OFFSET
          : 0.5;

        const baseColor = isCarried ? "#f43f5e" : "#dc2626";
        const accentColor = isCarried ? "#fde047" : "#facc15";

        if (isCarried && interpolatedPositionsRef) {
          return (
            <CarriedDelivery
              key={delivery.id}
              delivery={delivery}
              carrierElevation={carrierElevation ?? DEFAULT_GROUND_ELEVATION}
              interpolatedPositionsRef={interpolatedPositionsRef}
            />
          );
        }

        return (
          <group key={delivery.id} position={[delivery.x, height, delivery.y]}>
            <Float
              speed={isCarried ? 2 : 1}
              floatIntensity={isCarried ? 0.4 : 0.2}
              rotationIntensity={0.3}
            >
              <ChristmasPresentModel
                size={0.9}
                baseColor={baseColor}
                accentColor={accentColor}
                glow={isCarried ? 1 : 0.4}
              />
            </Float>
            {!isCarried && (
              <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.5, 0.8, 24]} />
                <meshStandardMaterial
                  color="#facc15"
                  opacity={0.4}
                  transparent
                />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

export const DeliveryTokens = memo(DeliveryTokensBase);
