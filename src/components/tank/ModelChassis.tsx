import { useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ChassisPart } from "../../data/parts";

/** Multi-stop palette per chassis (tracks / hull / trim) */
const PALETTE: Record<
  string,
  { track: string; hull: string; trim: string; metal: number; rough: number }
> = {
  chassis_wasp: {
    track: "#2A2C28",
    hull: "#556B4F",
    trim: "#6B7A5A",
    metal: 0.18,
    rough: 0.82,
  },
  chassis_crabber: {
    track: "#252722",
    hull: "#556B45",
    trim: "#6A7A52",
    metal: 0.15,
    rough: 0.88,
  },
  chassis_doomshock: {
    track: "#292B29",
    hull: "#5C5D4A",
    trim: "#85877E",
    metal: 0.22,
    rough: 0.85,
  },
  chassis_morrow: {
    track: "#252725",
    hull: "#3d4a3a",
    trim: "#E8E4D4",
    metal: 0.12,
    rough: 0.88,
  },
  chassis_oblivion: {
    track: "#252725",
    hull: "#424D45",
    trim: "#737D7D",
    metal: 0.22,
    rough: 0.8,
  },
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

function paintMesh(
  mesh: THREE.Mesh,
  pal: { track: string; hull: string; trim: string; metal: number; rough: number }
) {
  const geo = mesh.geometry.clone();
  mesh.geometry = geo;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const yMin = bb.min.y;
  const yMax = bb.max.y;
  const ySpan = Math.max(1e-4, yMax - yMin);

  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const cTrack = new THREE.Color(pal.track);
  const cHull = new THREE.Color(pal.hull);
  const cTrim = new THREE.Color(pal.trim);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y - yMin) / ySpan; // 0 bottom → 1 top
    if (t < 0.22) {
      // tracks / lower running gear
      tmp.copy(cTrack);
    } else if (t > 0.82) {
      // upper plates / trim
      tmp.copy(cHull).lerp(cTrim, 0.35);
    } else {
      // main hull with slight variation
      const n = (Math.sin(pos.getX(i) * 3.1 + pos.getZ(i) * 2.7) + 1) * 0.5;
      tmp.copy(cHull).offsetHSL(0, 0, (n - 0.5) * 0.06);
    }
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));

  mesh.material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: pal.metal,
    roughness: pal.rough,
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

export function ModelChassis({
  chassis,
  onRoofY,
}: {
  chassis: ChassisPart;
  onRoofY?: (y: number) => void;
}) {
  const url = modelUrl(chassis.id);
  const gltf = useGLTF(url);

  const { root, roofY } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const pal =
      PALETTE[chassis.id] ??
      ({
        track: "#2A2C28",
        hull: "#556B4F",
        trim: "#6B7A5A",
        metal: 0.15,
        rough: 0.85,
      } as const);

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) paintMesh(mesh, pal);
    });

    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetLen = chassis.size[2] || 3.5;
    const targetW = chassis.size[0] || 2.5;
    const sx = size.x > 0.01 ? targetW / size.x : 1;
    const sz = size.z > 0.01 ? targetLen / size.z : 1;
    const s = Math.min(sx, sz) * 1.02;
    root.scale.setScalar(s);

    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;

    root.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(root);
    return { root, roofY: box3.max.y };
  }, [gltf.scene, chassis.id, chassis.size]);

  useEffect(() => {
    onRoofY?.(roofY);
  }, [roofY, onRoofY]);

  return <primitive object={root} />;
}

CHASSIS_URLS.forEach((id) => {
  useGLTF.preload(modelUrl(id));
});
