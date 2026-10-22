import { useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ChassisPart } from "../../data/parts";

/** Concept-sheet palettes (GLBs have no materials) */
const PALETTE: Record<string, { body: string; metal: number; rough: number }> = {
  chassis_wasp: { body: "#556B4F", metal: 0.18, rough: 0.82 },
  chassis_crabber: { body: "#556B45", metal: 0.15, rough: 0.88 },
  chassis_doomshock: { body: "#5C5D4A", metal: 0.2, rough: 0.85 },
  chassis_morrow: { body: "#3d4a3a", metal: 0.12, rough: 0.88 },
  chassis_oblivion: { body: "#424D45", metal: 0.22, rough: 0.8 },
};

const CHASSIS_URLS = [
  "chassis_wasp",
  "chassis_crabber",
  "chassis_doomshock",
  "chassis_morrow",
  "chassis_oblivion",
] as const;

function modelUrl(id: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}models/${id}.glb`.replace(/\/{2,}/g, "/").replace(":/", "://");
}

/** Roof Y in local space after auto-fit (for weapon mount) */
export function chassisRoofYFromFit(chassis: ChassisPart, fittedHeight: number): number {
  // sit weapon slightly above the fitted hull top
  return fittedHeight * 0.92;
}

export function ModelChassis({
  chassis,
  onRoofY,
}: {
  chassis: ChassisPart;
  /** reports computed roof height for weapon placement */
  onRoofY?: (y: number) => void;
}) {
  const url = modelUrl(chassis.id);
  const gltf = useGLTF(url);

  const { root, roofY } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const pal = PALETTE[chassis.id] ?? { body: "#556B4F", metal: 0.15, rough: 0.85 };

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Always paint — source GLBs ship with empty materials
      mesh.material = new THREE.MeshStandardMaterial({
        color: pal.body,
        metalness: pal.metal,
        roughness: pal.rough,
      });
    });

    // Auto-fit to design length (chassis.size[2])
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetLen = chassis.size[2] || 3.5;
    const targetW = chassis.size[0] || 2.5;
    const sx = size.x > 0.01 ? targetW / size.x : 1;
    const sz = size.z > 0.01 ? targetLen / size.z : 1;
    const s = Math.min(sx, sz) * 1.05; // slight presence boost
    root.scale.setScalar(s);

    // Ground the model (min Y → 0) and center XZ
    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;

    root.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(root);
    const roofY = box3.max.y;

    return { root, roofY };
  }, [gltf.scene, chassis.id, chassis.size]);

  useEffect(() => {
    onRoofY?.(roofY);
  }, [roofY, onRoofY]);

  return <primitive object={root} />;
}

// Preload all chassis so Arsenal swaps are instant
CHASSIS_URLS.forEach((id) => {
  useGLTF.preload(modelUrl(id));
});
