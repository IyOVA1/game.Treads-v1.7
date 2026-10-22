import { type RefObject, type MutableRefObject } from "react";
import * as THREE from "three";
import { ChassisPart, WeaponPart } from "../../data/parts";

const HULL: Record<string, string> = {
  chassis_wasp: "#556B4F",
  chassis_crabber: "#556B45",
  chassis_doomshock: "#5C5D4A",
  chassis_oblivion: "#424D45",
  chassis_morrow: "#3d4a3a",
};

/** Chassis only — basic silhouette from concept sheets + scrolling tracks */
export function ChassisHull({
  chassis,
  trackMatL,
  trackMatR,
  trackTex,
  wheelRefs,
}: {
  chassis: ChassisPart;
  trackMatL: RefObject<THREE.MeshStandardMaterial | null>;
  trackMatR: RefObject<THREE.MeshStandardMaterial | null>;
  trackTex: THREE.CanvasTexture;
  wheelRefs: MutableRefObject<(THREE.Mesh | null)[]>;
}) {
  const id = chassis.id;
  const color = HULL[id] ?? "#556B4F";
  const dark = "#2a2e28";

  // --- Distinct body proportions (concept-inspired, not detailed replicas) ---
  if (id === "chassis_wasp") {
    // Small, light, short, raised rear, pointy nose
    return (
      <group>
        <mesh position={[0, 0.15, -0.15]} castShadow>
          <boxGeometry args={[1.6, 0.55, 2.4]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.28, 0.85]} rotation={[-0.35, 0, 0]} castShadow>
          <boxGeometry args={[1.45, 0.4, 1.0]} />
          <meshStandardMaterial color={color} roughness={0.88} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.05, 1.35]} castShadow>
          <boxGeometry args={[1.2, 0.25, 0.45]} />
          <meshStandardMaterial color={dark} roughness={0.9} />
        </mesh>
        <TrackPair
          trackMatL={trackMatL}
          trackMatR={trackMatR}
          trackTex={trackTex}
          wheelRefs={wheelRefs}
          halfWidth={1.05}
          length={2.9}
          height={0.55}
          y={-0.15}
          wheels={4}
        />
      </group>
    );
  }

  if (id === "chassis_crabber") {
    // Wide dual-track, boxy, tall, short overhang
    return (
      <group>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[2.4, 0.9, 2.8]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.55, 1.1]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[2.2, 0.55, 1.1]} />
          <meshStandardMaterial color={color} roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.75, -0.9]} castShadow>
          <boxGeometry args={[1.8, 0.35, 0.9]} />
          <meshStandardMaterial color={dark} roughness={0.9} />
        </mesh>
        <TrackPair
          trackMatL={trackMatL}
          trackMatR={trackMatR}
          trackTex={trackTex}
          wheelRefs={wheelRefs}
          halfWidth={1.55}
          length={3.2}
          height={0.7}
          y={-0.1}
          wheels={6}
          thick
        />
      </group>
    );
  }

  if (id === "chassis_doomshock") {
    // Very wide, low wedge, massive tracks, almost no superstructure
    return (
      <group>
        <mesh position={[0, 0.12, 0.2]} rotation={[-0.22, 0, 0]} castShadow>
          <boxGeometry args={[3.2, 0.45, 3.8]} />
          <meshStandardMaterial color={color} roughness={0.88} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.28, -0.6]} castShadow>
          <boxGeometry args={[2.4, 0.35, 1.8]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.05, 1.6]} rotation={[-0.4, 0, 0]} castShadow>
          <boxGeometry args={[2.8, 0.3, 1.2]} />
          <meshStandardMaterial color={dark} roughness={0.9} />
        </mesh>
        <TrackPair
          trackMatL={trackMatL}
          trackMatR={trackMatR}
          trackTex={trackTex}
          wheelRefs={wheelRefs}
          halfWidth={1.9}
          length={4.2}
          height={0.65}
          y={-0.2}
          wheels={7}
          thick
        />
      </group>
    );
  }

  if (id === "chassis_oblivion") {
    // Long, angular, faceted mid-body, low
    return (
      <group>
        <mesh position={[0, 0.25, -0.3]} castShadow>
          <boxGeometry args={[2.0, 0.55, 3.6]} />
          <meshStandardMaterial color={color} roughness={0.82} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.35, 1.0]} rotation={[-0.2, 0, 0]} castShadow>
          <boxGeometry args={[1.85, 0.4, 1.4]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.42, -1.4]} castShadow>
          <boxGeometry args={[1.6, 0.35, 1.2]} />
          <meshStandardMaterial color={dark} roughness={0.8} metalness={0.2} />
        </mesh>
        {/* side skirts / facets */}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 1.05, 0.2, 0]} castShadow>
            <boxGeometry args={[0.25, 0.45, 3.2]} />
            <meshStandardMaterial color={color} roughness={0.88} />
          </mesh>
        ))}
        <TrackPair
          trackMatL={trackMatL}
          trackMatR={trackMatR}
          trackTex={trackTex}
          wheelRefs={wheelRefs}
          halfWidth={1.25}
          length={3.8}
          height={0.5}
          y={-0.15}
          wheels={6}
        />
      </group>
    );
  }

  if (id === "chassis_morrow") {
    // Boxy support van on tracks + white cross
    return (
      <group>
        <mesh position={[0, 0.55, -0.1]} castShadow>
          <boxGeometry args={[2.1, 1.1, 3.0]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.35, 1.35]} rotation={[-0.1, 0, 0]} castShadow>
          <boxGeometry args={[1.9, 0.7, 0.9]} />
          <meshStandardMaterial color={color} roughness={0.88} />
        </mesh>
        {/* Medical cross */}
        <mesh position={[0.55, 0.7, 0.2]} castShadow>
          <boxGeometry args={[0.55, 0.08, 0.18]} />
          <meshStandardMaterial color="#e8e4d4" />
        </mesh>
        <mesh position={[0.55, 0.7, 0.2]} castShadow>
          <boxGeometry args={[0.18, 0.08, 0.55]} />
          <meshStandardMaterial color="#e8e4d4" />
        </mesh>
        <TrackPair
          trackMatL={trackMatL}
          trackMatR={trackMatR}
          trackTex={trackTex}
          wheelRefs={wheelRefs}
          halfWidth={1.3}
          length={3.3}
          height={0.55}
          y={-0.12}
          wheels={5}
        />
      </group>
    );
  }

  // fallback
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[2.2, 0.8, 3.2]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <TrackPair
        trackMatL={trackMatL}
        trackMatR={trackMatR}
        trackTex={trackTex}
        wheelRefs={wheelRefs}
        halfWidth={1.3}
        length={3.2}
        height={0.5}
        y={-0.15}
        wheels={5}
      />
    </group>
  );
}

function TrackPair({
  trackMatL,
  trackMatR,
  trackTex,
  wheelRefs,
  halfWidth,
  length,
  height,
  y,
  wheels,
  thick,
}: {
  trackMatL: RefObject<THREE.MeshStandardMaterial | null>;
  trackMatR: RefObject<THREE.MeshStandardMaterial | null>;
  trackTex: THREE.CanvasTexture;
  wheelRefs: MutableRefObject<(THREE.Mesh | null)[]>;
  halfWidth: number;
  length: number;
  height: number;
  y: number;
  wheels: number;
  thick?: boolean;
}) {
  const tw = thick ? 0.55 : 0.4;
  return (
    <>
      {([-1, 1] as const).map((side, si) => (
        <group key={side} position={[side * halfWidth, y, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[tw, height, length]} />
            <meshStandardMaterial
              ref={si === 0 ? trackMatL : trackMatR}
              map={trackTex}
              color="#c8c8c8"
              roughness={0.95}
              metalness={0.08}
            />
          </mesh>
          {/* inner well */}
          <mesh position={[side * -0.12, 0.05, 0]}>
            <boxGeometry args={[tw * 0.45, height * 0.7, length * 0.9]} />
            <meshStandardMaterial color="#141614" roughness={1} />
          </mesh>
          {Array.from({ length: wheels }, (_, i) => {
            const z = -length * 0.4 + (i * (length * 0.8)) / Math.max(1, wheels - 1);
            return (
              <mesh
                key={i}
                ref={(el) => {
                  wheelRefs.current[si * 10 + i] = el;
                }}
                position={[side * 0.05, -height * 0.15, z]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[height * 0.28, height * 0.28, tw * 0.5, 10]} />
                <meshStandardMaterial color="#2a2c28" roughness={0.8} metalness={0.3} />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}

/** Top of hull where weapon sits (local Y) */
export function chassisRoofY(chassis: ChassisPart): number {
  switch (chassis.id) {
    case "chassis_wasp":
      return 0.48;
    case "chassis_crabber":
      return 0.85;
    case "chassis_doomshock":
      return 0.48;
    case "chassis_oblivion":
      return 0.58;
    case "chassis_morrow":
      return 1.15;
    default:
      return Math.max(0.55, chassis.size[1] * 0.55 + 0.2);
  }
}

function family(w: WeaponPart): "assault" | "missile" | "sniper" | "mortar" | "cannon" {
  if (w.weaponType === "mortar") return "mortar";
  if (w.id === "weapon_craterfall") return "missile";
  if (w.weaponType === "assault") return "assault";
  if (
    w.id === "weapon_ionthread" ||
    w.id === "weapon_starweft" ||
    w.id === "weapon_stonebreaker" ||
    (w.weaponType === "plasma" && (w.range ?? 0) >= 140)
  )
    return "sniper";
  return "cannon";
}

/**
 * Weapon owns the turret holder + barrel.
 * Chassis has no cylindrical gun ring.
 */
export function WeaponMount({
  weapon,
  chassis,
  mountY,
  turretRef,
  barrelRef,
  muzzleRef,
}: {
  weapon: WeaponPart;
  chassis: ChassisPart;
  /** override roof height (from fitted GLB); falls back to table */
  mountY?: number;
  turretRef: RefObject<THREE.Group | null>;
  barrelRef: RefObject<THREE.Mesh | null>;
  muzzleRef: RefObject<THREE.Object3D | null>;
}) {
  const fam = family(weapon);
  const steel = "#3a4038";
  const gun = "#1e221e";
  const y = mountY && mountY > 0.2 ? mountY : chassisRoofY(chassis);

  if (fam === "assault") {
    // Dual cuboid barrels from cuboid holder, joined by cylinder muzzle
    return (
      <group ref={turretRef} position={[0, y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.45, 0.9]} />
          <meshStandardMaterial color={steel} roughness={0.7} metalness={0.25} />
        </mesh>
        {([-1, 1] as const).map((s) => (
          <mesh
            key={s}
            position={[s * 0.2, 0.05, -0.85]}
            castShadow
          >
            <boxGeometry args={[0.14, 0.14, 1.5]} />
            <meshStandardMaterial color={gun} roughness={0.5} metalness={0.4} />
          </mesh>
        ))}
        <mesh
          ref={barrelRef}
          position={[0, 0.05, -1.65]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.12, 0.14, 0.35, 12]} />
          <meshStandardMaterial color="#111" roughness={0.4} metalness={0.5} />
        </mesh>
        <object3D ref={muzzleRef} position={[0, 0.05, -1.9]} />
      </group>
    );
  }

  if (fam === "missile") {
    // Large holder + elongated octagon pod
    return (
      <group ref={turretRef} position={[0, y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.35, 0.55, 1.2]} />
          <meshStandardMaterial color={steel} roughness={0.75} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.2, -0.55]} scale={[1.3, 0.9, 1.6]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.5, 8]} />
          <meshStandardMaterial color="#2f342f" roughness={0.65} metalness={0.3} />
        </mesh>
        <mesh ref={barrelRef} position={[0, 0.2, -1.15]} scale={[1.15, 0.85, 1]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.55, 8]} />
          <meshStandardMaterial color={gun} roughness={0.6} metalness={0.35} />
        </mesh>
        {([-0.22, 0.22] as const).flatMap((x, i) =>
          ([-0.15, 0.15] as const).map((y, j) => (
            <mesh key={`${i}-${j}`} position={[x, 0.2 + y, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.08, 0.4, 6]} />
              <meshStandardMaterial color="#151515" />
            </mesh>
          ))
        )}
        <object3D ref={muzzleRef} position={[0, 0.2, -1.75]} />
      </group>
    );
  }

  if (fam === "sniper") {
    // Long single barrel
    return (
      <group ref={turretRef} position={[0, y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.4, 1.0]} />
          <meshStandardMaterial color={steel} roughness={0.7} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0.15, 0.2]} castShadow>
          <boxGeometry args={[0.35, 0.22, 0.45]} />
          <meshStandardMaterial color="#5a6352" />
        </mesh>
        <mesh
          ref={barrelRef}
          position={[0, 0.05, -1.6]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.06, 0.09, 2.8, 12]} />
          <meshStandardMaterial color={gun} roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.05, -3.0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.25, 8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <object3D ref={muzzleRef} position={[0, 0.05, -3.2]} />
      </group>
    );
  }

  if (fam === "mortar") {
    // Artillery rack — tubes angled up
    return (
      <group ref={turretRef} position={[0, y, 0.1]}>
        <mesh castShadow>
          <boxGeometry args={[1.4, 0.35, 1.2]} />
          <meshStandardMaterial color={steel} roughness={0.8} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.35, 0.15]} rotation={[-0.45, 0, 0]} castShadow>
          <boxGeometry args={[1.2, 0.22, 1.0]} />
          <meshStandardMaterial color="#3a4038" />
        </mesh>
        {([-0.4, 0, 0.4] as const).map((x, i) => (
          <mesh
            key={i}
            ref={i === 1 ? barrelRef : undefined}
            position={[x, 0.65, -0.2]}
            rotation={[-1.0, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.11, 0.13, 1.4, 10]} />
            <meshStandardMaterial color={gun} roughness={0.5} metalness={0.4} />
          </mesh>
        ))}
        <object3D ref={muzzleRef} position={[0, 1.25, -0.95]} />
      </group>
    );
  }

  // Default cannon — single stout barrel + box holder
  return (
    <group ref={turretRef} position={[0, y, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.15, 0.5, 1.25]} />
        <meshStandardMaterial color={steel} roughness={0.72} metalness={0.22} />
      </mesh>
      <mesh position={[0, 0.05, -0.55]} castShadow>
        <boxGeometry args={[0.55, 0.4, 0.35]} />
        <meshStandardMaterial color="#4a5344" />
      </mesh>
      <mesh
        ref={barrelRef}
        position={[0, 0.05, -1.3]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.1, 0.14, 1.6, 12]} />
        <meshStandardMaterial color={gun} roughness={0.45} metalness={0.45} />
      </mesh>
      <object3D ref={muzzleRef} position={[0, 0.05, -2.15]} />
    </group>
  );
}
