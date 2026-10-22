import { useEffect, useRef, Suspense, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import * as THREE from "three";
import { useTankStore } from "../../store/tankStore";
import { getPart, ChassisPart, WeaponPart } from "../../data/parts";
import {
  game,
  spawnEffect,
  spawnProjectile,
  useBattleStore,
} from "../../game/battleState";
import { activateAbility, tickAbility } from "../../game/abilities";
import { MAP_LIMIT, sampleHull, slopeAlong, terrainHeight } from "../../game/terrain";
import { makeTrackTexture } from "../../game/visuals";
import { WeaponMount } from "./TankVisuals";
import { ModelChassis } from "./ModelChassis";
import { playFireSfx, playAbilitySfx, playSfx } from "../../audio/sounds";

const SPEED_SCALE = 0.85;
const TURN_RATE = 1.3;
const MOUSE_YAW_SENS = 0.0024;
const MOUSE_PITCH_SENS = 0.0018;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

/** Walk a camera ray against terrain height field to find aim point */
function aimPointOnTerrain(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  out: THREE.Vector3,
  maxDist = 180
) {
  let prevX = origin.x;
  let prevY = origin.y;
  let prevZ = origin.z;
  const step = 2.5;
  for (let d = step; d <= maxDist; d += step) {
    const x = origin.x + dir.x * d;
    const y = origin.y + dir.y * d;
    const z = origin.z + dir.z * d;
    const ground = terrainHeight(x, z);
    if (y <= ground + 0.15) {
      // interpolate
      const t =
        prevY > terrainHeight(prevX, prevZ) + 0.15
          ? (prevY - (terrainHeight(prevX, prevZ) + 0.15)) /
            (prevY - y + ground + 0.15 - (terrainHeight(prevX, prevZ) + 0.15) + 1e-6)
          : 0.5;
      out.set(
        prevX + (x - prevX) * Math.min(1, Math.max(0, t)),
        ground,
        prevZ + (z - prevZ) * Math.min(1, Math.max(0, t))
      );
      return true;
    }
    prevX = x;
    prevY = y;
    prevZ = z;
  }
  out.copy(origin).addScaledVector(dir, 60);
  out.y = terrainHeight(out.x, out.z);
  return false;
}

export function PlayerTank() {
  const blueprint = useTankStore((s) => s.blueprint);
  const stats = useTankStore((s) => s.stats);
  const [, getKeys] = useKeyboardControls();

  const chassis = getPart<ChassisPart>(blueprint.chassisId)!;
  const weapon = getPart<WeaponPart>(blueprint.weaponId)!;
  const [w, h, l] = chassis.size;
  const chassisColor =
    chassis.id === "chassis_wasp"
      ? "#556B4F"
      : chassis.id === "chassis_crabber"
        ? "#4a5c42"
        : chassis.id === "chassis_doomshock"
          ? "#5C5D4A"
          : chassis.id === "chassis_oblivion"
            ? "#424D45"
            : chassis.id === "chassis_morrow"
              ? "#424D45"
              : "#66745a";

  const groupRef = useRef<THREE.Group>(null);
  const turretRef = useRef<THREE.Group>(null);
  const barrelRef = useRef<THREE.Mesh>(null);
  const muzzleRef = useRef<THREE.Object3D>(null);
  const trackMatL = useRef<THREE.MeshStandardMaterial>(null);
  const fieldMesh = useRef<THREE.Mesh>(null);
  const trackMatR = useRef<THREE.MeshStandardMaterial>(null);
  const wheelSpin = useRef(0);
  const wheelRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trackTex = useRef<THREE.CanvasTexture | null>(null);
  const [roofY, setRoofY] = useState(0.7);
  const onRoofY = useCallback((y: number) => setRoofY(y), []);
  if (!trackTex.current) trackTex.current = makeTrackTexture();

  const speed = useRef(0);
  const lastShot = useRef(-10);
  const recoil = useRef(0);
  const deadFx = useRef(false);
  const camReady = useRef(false);
  const ammo = useRef(weapon.magazine > 0 ? weapon.magazine : 999);
  const reloading = useRef(false);
  const reloadT = useRef(0);

  const tmp = useRef({
    target: new THREE.Quaternion(),
    yawQ: new THREE.Quaternion(),
    local: new THREE.Quaternion(),
    tilt: new THREE.Quaternion(),
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    aim: new THREE.Vector3(),
  }).current;

  // Pointer-lock mouse → turret only
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement == null) return;
      const maxPitch = weapon.arc * (Math.PI / 180);
      game.player.turretYaw -= e.movementX * MOUSE_YAW_SENS;
      // Front hemisphere only (±90°)
      game.player.turretYaw = THREE.MathUtils.clamp(
        game.player.turretYaw,
        -Math.PI / 2,
        Math.PI / 2
      );
      game.player.pitch = THREE.MathUtils.clamp(
        game.player.pitch - e.movementY * MOUSE_PITCH_SENS,
        -0.15,
        maxPitch
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [weapon.arc]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (game.paused) return;
    const dt = Math.min(delta, 0.05);
    const pl = game.player;
    const alive = useBattleStore.getState().hp > 0;
    pl.alive = alive;
    pl.radius = Math.max(w, l) / 2 + 0.3;
    const now = state.clock.elapsedTime;
    const nowMs = performance.now();

    const { forward, backward, left, right, ability } = getKeys();

    // ---------- Ability (duration → then CD) ----------
    if (alive && ability && !pl.abilityActive && useBattleStore.getState().abilityCd <= 0) {
      const d = activateAbility(chassis, nowMs);
      if (d > 0) playAbilitySfx(chassis.abilityId);
    }
    tickAbility(chassis, dt, nowMs);

    // ---------- Driving ----------
    if (alive) {
      pl.yaw += ((left ? 1 : 0) - (right ? 1 : 0)) * TURN_RATE * dt;

      const uphill =
        Math.max(0, slopeAlong(pl.pos.x, pl.pos.z, pl.yaw)) * (speed.current >= 0 ? 1 : -1);
      const climb = 150 / (stats.powerToWeight + 50);
      const slopeFactor = THREE.MathUtils.clamp(1 - Math.max(0, uphill) * 3 * climb, 0.25, 1);

      const maxSpeed = stats.topSpeed * SPEED_SCALE * slopeFactor * pl.speedMul;
      const accel = 2 + stats.powerToWeight * 0.025;
      let target = 0;
      if (forward) target = maxSpeed;
      else if (backward) target = -maxSpeed * 0.5;
      speed.current = approach(speed.current, target, (target === 0 ? 6 : accel) * dt);
    } else {
      speed.current = approach(speed.current, 0, 8 * dt);
    }

    pl.speed = speed.current;
    pl.pos.x += -Math.sin(pl.yaw) * speed.current * dt;
    pl.pos.z += -Math.cos(pl.yaw) * speed.current * dt;
    if (Math.abs(pl.pos.x) > MAP_LIMIT || Math.abs(pl.pos.z) > MAP_LIMIT) {
      pl.pos.x = THREE.MathUtils.clamp(pl.pos.x, -MAP_LIMIT, MAP_LIMIT);
      pl.pos.z = THREE.MathUtils.clamp(pl.pos.z, -MAP_LIMIT, MAP_LIMIT);
      speed.current = 0;
    }

    pl.pos.y = sampleHull(pl.pos.x, pl.pos.z, pl.yaw, w, l, tmp.target);
    tmp.yawQ.setFromAxisAngle(Y_AXIS, pl.yaw);
    tmp.local.copy(tmp.yawQ).invert().multiply(tmp.target);
    tmp.tilt.slerp(tmp.local, 1 - Math.exp(-8 * dt));
    g.quaternion.copy(tmp.yawQ).multiply(tmp.tilt);
    g.position.set(pl.pos.x, pl.pos.y, pl.pos.z); // GLB origin is ground

    if (turretRef.current) {
      turretRef.current.rotation.order = "YXZ";
      turretRef.current.rotation.y = pl.turretYaw;
      turretRef.current.rotation.x = pl.pitch;
    }

    recoil.current = Math.max(0, recoil.current - dt * 4);
    if (barrelRef.current) barrelRef.current.position.z = -l * 0.32 + recoil.current * 0.4;
    g.updateMatrixWorld(true);

    // ---------- Reload ----------
    const magSize = weapon.magazine > 0 ? weapon.magazine : 999;
    if (reloading.current) {
      reloadT.current += dt;
      const p = Math.min(1, reloadT.current / weapon.reload);
      useBattleStore.getState().setAmmo(0, true, p);
      if (reloadT.current >= weapon.reload) {
        reloading.current = false;
        ammo.current = magSize;
        reloadT.current = 0;
        useBattleStore.getState().setAmmo(ammo.current, false, 0);
        useBattleStore.getState().setWarning("");
      }
    } else {
      useBattleStore.getState().setAmmo(ammo.current, false, 0);
    }
    if (alive && !reloading.current && weapon.magazine > 0 && ammo.current <= 0) {
      reloading.current = true;
      reloadT.current = 0;
      useBattleStore.getState().setWarning("RELOADING");
    }

    // ---------- Camera: fixed height, follows turret facing ----------
    const cam = state.camera;
    const aimYaw = pl.yaw + pl.turretYaw;
    const sinA = Math.sin(aimYaw);
    const cosA = Math.cos(aimYaw);
    const back = 12;
    const camHeight = h + 2.4;
    tmp.v1.set(
      pl.pos.x + sinA * back,
      pl.pos.y + camHeight,
      pl.pos.z + cosA * back
    );
    tmp.v1.y = Math.max(tmp.v1.y, terrainHeight(tmp.v1.x, tmp.v1.z) + 2);
    if (!camReady.current) {
      cam.position.copy(tmp.v1);
      camReady.current = true;
    } else {
      cam.position.lerp(tmp.v1, 1 - Math.exp(-10 * dt));
    }
    // Look ahead along turret aim so crosshair (center) matches gun direction
    const lookDist = 40;
    cam.lookAt(
      pl.pos.x - sinA * lookDist,
      pl.pos.y + h * 0.5 + Math.sin(pl.pitch) * lookDist,
      pl.pos.z - cosA * lookDist
    );

    // ---------- Fire LMB: from muzzle toward terrain point under screen center ----------
    const fireInterval = weapon.rpm > 0 ? 60 / weapon.rpm : 0.2;
    const canFire =
      alive &&
      game.input.fire &&
      muzzleRef.current &&
      !reloading.current &&
      ammo.current > 0 &&
      now - lastShot.current > fireInterval &&
      !weapon.isCharge;

    if (canFire) {
      lastShot.current = now;
      ammo.current -= 1;
      muzzleRef.current!.getWorldPosition(tmp.v1);

      // Screen-center ray = exact crosshair direction (elevation included)
      tmp.v2.set(0, 0, 0.5).unproject(cam);
      tmp.v2.sub(cam.position).normalize();
      const rayDir = tmp.v2.clone();
      const isMortar = weapon.weaponType === "mortar";
      const isDump = (weapon.volleyCount ?? 0) >= 4 && weapon.id === "weapon_craterfall";
      const spd = Math.max(25, weapon.projectileSpeed);
      aimPointOnTerrain(cam.position, rayDir, tmp.aim, 220);
      const aimDist = cam.position.distanceTo(tmp.aim);
      const inRange = aimDist <= weapon.range * 1.05;
      useBattleStore.getState().setWarning(inRange ? "IN RANGE" : "OUT OF RANGE");

      const fireOne = (spread = 0, ballistic = false) => {
        const origin = tmp.v1.clone();
        let vel: THREE.Vector3;
        if (ballistic) {
          const target = tmp.aim.clone();
          target.x += (Math.random() - 0.5) * spread;
          target.z += (Math.random() - 0.5) * spread;
          const toAim = target.sub(origin);
          const distAim = Math.max(8, toAim.length());
          const flight = Math.max(0.55, distAim / spd);
          toAim.y += 0.5 * 9.8 * flight * flight;
          vel = toAim.normalize().multiplyScalar(spd);
        } else {
          vel = rayDir.clone();
          if (spread > 0) {
            vel.x += (Math.random() - 0.5) * spread * 0.02;
            vel.y += (Math.random() - 0.5) * spread * 0.01;
            vel.z += (Math.random() - 0.5) * spread * 0.02;
            vel.normalize();
          }
          vel.multiplyScalar(spd);
        }
        spawnProjectile({
          pos: origin,
          vel,
          damage: weapon.damage,
          owner: "player",
          life: Math.max(2.5, (weapon.range / Math.max(1, weapon.projectileSpeed)) * 1.6),
          splash: weapon.splashRadius
            ? weapon.splashRadius * 0.15
            : 0.9 + weapon.damage / 200,
          ballistic,
          maxRange: weapon.range,
          origin: origin.clone(),
        });
      };

      if (isMortar) {
        // Artillery: loft high, drop onto target area with high speed
        const n = Math.max(5, weapon.volleyCount ?? 6);
        const spread = (weapon.splashRadius ?? 14) * 1.4;
        aimPointOnTerrain(cam.position, rayDir, tmp.aim, 220);
        for (let i = 0; i < n; i++) {
          const origin = tmp.v1.clone();
          const target = tmp.aim.clone();
          target.x += (Math.random() - 0.5) * spread;
          target.z += (Math.random() - 0.5) * spread;
          // High arc: strong upward component + long flight
          const to = target.clone().sub(origin);
          const dist = Math.hypot(to.x, to.z);
          const flight = Math.max(1.2, dist / 35);
          const loft = 28 + dist * 0.15;
          const vx = to.x / flight;
          const vz = to.z / flight;
          const vy = loft;
          spawnProjectile({
            pos: origin,
            vel: new THREE.Vector3(vx, vy, vz),
            damage: weapon.damage,
            owner: "player",
            life: flight + 2,
            splash: (weapon.splashRadius ?? 14) * 0.2,
            ballistic: true,
            maxRange: weapon.range * 1.2,
            origin: origin.clone(),
          });
        }
        ammo.current = Math.max(0, ammo.current - 1);
        playFireSfx("mortar");
      } else if (isDump) {
        // Craterfall: dump entire magazine in one click
        const n = ammo.current;
        for (let i = 0; i < n; i++) fireOne(3 + i * 0.5, false);
        ammo.current = 0;
      } else {
        fireOne(0, false);
        ammo.current -= 1;
      }

      if (!isMortar) playFireSfx(weapon.weaponType, weapon.id);
      spawnEffect(tmp.v1, 0.8, 0.12);
      recoil.current = 1;
      speed.current -= weapon.recoil * 0.0006;
      useBattleStore.getState().setAmmo(ammo.current, false, 0);
    }

    if (fieldMesh.current) {
      fieldMesh.current.visible = game.player.fieldActive;
      const r = game.player.fieldRadius || 16;
      fieldMesh.current.scale.set(r, 1, r);
    }

    // Track scroll + wheel spin
    const scroll = speed.current * dt * 0.32;
    if (trackMatL.current?.map) trackMatL.current.map.offset.y -= scroll;
    if (trackMatR.current?.map) trackMatR.current.map.offset.y -= scroll;
    wheelSpin.current -= speed.current * dt * 1.7;
    for (const wh of wheelRefs.current) {
      if (wh) wh.rotation.x = wheelSpin.current;
    }

    if (!alive && !deadFx.current) {
      deadFx.current = true;
      spawnEffect(tmp.v1.set(pl.pos.x, pl.pos.y + 1, pl.pos.z), 4, 1);
    }
  });

  const trackMap = trackTex.current!;

  return (
    <group ref={groupRef}>
      <mesh ref={fieldMesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} visible={false}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial color="#6bcf8e" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
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
