import { useMemo, useRef, useState, useCallback, Suspense } from "react";
import * as THREE from "three";
import { TankBlueprint, getPart, ChassisPart, WeaponPart } from "../../data/parts";
import { WeaponMount } from "./TankVisuals";
import { ModelChassis } from "./ModelChassis";

interface Props {
  blueprint: TankBlueprint;
}

export function TankPreview({ blueprint }: Props) {
  const chassis = getPart<ChassisPart>(blueprint.chassisId)!;
  const weapon = getPart<WeaponPart>(blueprint.weaponId)!;
  const turretRef = useRef<THREE.Group>(null);
  const barrelRef = useRef<THREE.Mesh>(null);
  const muzzleRef = useRef<THREE.Object3D>(null);
  const [roofY, setRoofY] = useState(0.7);
  const onRoofY = useCallback((y: number) => setRoofY(y), []);

  return (
    <group position={[0, 0, 0]}>
      <Suspense fallback={null}>
        <ModelChassis chassis={chassis} onRoofY={onRoofY} />
      </Suspense>
      <WeaponMount
        weapon={weapon}
        chassis={chassis}
        mountY={roofY}
        turretRef={turretRef}
        barrelRef={barrelRef}
        muzzleRef={muzzleRef}
      />
    </group>
  );
}
