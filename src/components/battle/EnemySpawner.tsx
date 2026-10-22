import { useEffect, useMemo, useRef, useState, Suspense, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  aimWithDrop,
  enemiesForWave,
  EnemyState,
  game,
  spawnEffect,
  spawnProjectile,
  useBattleStore,
} from "../../game/battleState";
import { useTankStore } from "../../store/tankStore";
import { CHASSIS, WEAPONS, getPart, ChassisPart, WeaponPart } from "../../data/parts";
import { WeaponMount } from "../tank/TankVisuals";
import { ModelChassis } from "../tank/ModelChassis";
import { makeTrackTexture } from "../../game/visuals";
import { playSfx } from "../../audio/sounds";
import { MAP_LIMIT, sampleHull, slopeAlong, terrainHeight } from "../../game/terrain";

type Archetype = "grunt" | "heavy" | "arty" | "scout";

interface EnemySpawn {
  id: number;
  x: number;
  z: number;
  maxHp: number;
  archetype: Archetype;
  chassisId: string;
  weaponId: string;
}

const ARCH: Record<
  Archetype,
  { speed: number; damage: number; shellSpeed: number; fireCd: number; color: string; hpMul: number }
> = {
  grunt: { speed: 7, damage: 90, shellSpeed: 55, fireCd: 2.2, color: "#5c4038", hpMul: 1 },
  heavy: { speed: 4.5, damage: 180, shellSpeed: 50, fireCd: 3.5, color: "#3a3030", hpMul: 1.6 },
  arty: { speed: 5, damage: 140, shellSpeed: 35, fireCd: 4.0, color: "#4a4535", hpMul: 0.9 },
  scout: { speed: 9, damage: 55, shellSpeed: 65, fireCd: 1.6, color: "#6b5048", hpMul: 0.7 },
};

function pickArchetype(wave: number): Archetype {
  const tier = useTankStore.getState().unlockedTier;
  const r = Math.random();
  // Cap enemy threat to player's unlocked tier
  if (tier <= 1) {
    return r < 0.75 ? "grunt" : "scout";
  }
  if (tier === 2) {
    if (wave <= 2) return r < 0.7 ? "grunt" : "scout";
    if (r < 0.45) return "grunt";
    if (r < 0.7) return "scout";
    if (r < 0.9) return "heavy";
    return "arty";
  }
  // tier 3+
  if (wave <= 2) return r < 0.85 ? "grunt" : "scout";
  if (wave <= 4) {
    if (r < 0.4) return "grunt";
    if (r < 0.65) return "scout";
    if (r < 0.85) return "heavy";
    return "arty";
  }
  if (r < 0.3) return "grunt";
  if (r < 0.5) return "scout";
  if (r < 0.78) return "heavy";
  return "arty";
}

const clampMap = (v: number) => THREE.MathUtils.clamp(v, -MAP_LIMIT, MAP_LIMIT);

function randomSpawn(
  id: number,
  cx: number,
  cz: number,
  minD: number,
  maxD: number,
  wave: number
): EnemySpawn {
  const angle = Math.random() * Math.PI * 2;
  const dist = minD + Math.random() * (maxD - minD);
  const arch = pickArchetype(wave);
  const base = 800 + Math.random() * 400;
  const scale = 1 + wave * 0.08;
  const tier = useTankStore.getState().unlockedTier;
  const chassisPool = CHASSIS.filter((c) => c.tier <= Math.min(3, tier));
  const weaponPool = WEAPONS.filter((w) => w.tier <= Math.min(3, tier));
  const chassisId = chassisPool[Math.floor(Math.random() * chassisPool.length)]?.id ?? "chassis_wasp";
  const weaponId = weaponPool[Math.floor(Math.random() * weaponPool.length)]?.id ?? "weapon_rattlejack";
  const chassis = getPart<ChassisPart>(chassisId);
  const hp = chassis ? chassis.hp * (0.55 + wave * 0.04) : base * ARCH[arch].hpMul * scale;

  return {
    id,
    x: clampMap(cx + Math.cos(angle) * dist),
    z: clampMap(cz + Math.sin(angle) * dist),
    maxHp: Math.round(hp),
    archetype: arch,
    chassisId,
    weaponId,
  };
}

export function EnemySpawner() {
  const [enemies, setEnemies] = useState<EnemySpawn[]>([]);
  const nextId = useRef(1);
  const wave = useRef(1);
  const between = useRef(true);
  const betweenT = useRef(2); // start first wave after 2s
  const spawnedForWave = useRef(0);
  const need = useRef(enemiesForWave(1));
  const enemyCountRef = useRef(0);

  enemyCountRef.current = enemies.length;

  useFrame((_, delta) => {
    if (game.paused) return;
    const dt = Math.min(delta, 0.05);
    if (!game.player.alive) return;

    // Count living enemies registered in game map
    let living = 0;
    for (const e of game.enemies.values()) if (!e.dead) living++;

    if (between.current) {
      useBattleStore.getState().setWaveClearing(true);
      betweenT.current -= dt;
      if (betweenT.current <= 0) {
        between.current = false;
        spawnedForWave.current = 0;
        need.current = enemiesForWave(wave.current);
        useBattleStore.getState().setWave(wave.current, need.current);
        useBattleStore.getState().setWaveClearing(false);
        useBattleStore.getState().setWarning(`WAVE ${wave.current}`);
      }
      return;
    }

    // Spawn remaining for this wave (stagger)
    if (spawnedForWave.current < need.current && living < 10) {
      const p = game.player.pos;
      const spawn = randomSpawn(nextId.current++, p.x, p.z, 80, 130, wave.current);
      setEnemies((prev) => [...prev, spawn]);
      spawnedForWave.current++;
      useBattleStore
        .getState()
        .setWaveEnemiesLeft(need.current - spawnedForWave.current + living);
    }

    // Wave clear: must have finished spawning AND no living enemies in the map
    // (guards against false clear if the enemy map was wiped by a bug/reset)
    const stillSpawning = spawnedForWave.current < need.current;
    if (
      !stillSpawning &&
      need.current > 0 &&
      spawnedForWave.current >= need.current &&
      living === 0 &&
      enemyCountRef.current === 0
    ) {
      useTankStore.getState().reportWave(wave.current);
      const cleared = wave.current;
      wave.current += 1;
      between.current = true;
      betweenT.current = 4;
      setEnemies([]);
      useBattleStore.getState().setWarning("WAVE " + cleared + " CLEARED");
      playSfx("wave_clear");
    } else {
      useBattleStore
        .getState()
        .setWaveEnemiesLeft(living + Math.max(0, need.current - spawnedForWave.current));
    }
  });

  return (
    <>
      {enemies.map((e) => (
        <EnemyTank
          key={e.id}
          spawn={e}
          onGone={() => setEnemies((prev) => prev.filter((x) => x.id !== e.id))}
        />
      ))}
    </>
  );
}

const PREFERRED_MAX = 30;
const PREFERRED_MIN = 18;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));


function EnemyTank({ spawn, onGone }: { spawn: EnemySpawn; onGone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const turretRef = useRef<THREE.Group>(null);
  const barrelRef = useRef<THREE.Mesh>(null);
  const muzzleRef = useRef<THREE.Object3D>(null);
  const hullMat = useRef<THREE.MeshStandardMaterial>(null);
  const trackMatL = useRef<THREE.MeshStandardMaterial>(null);
  const trackMatR = useRef<THREE.MeshStandardMaterial>(null);
  const wheelRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trackTex = useRef<THREE.CanvasTexture | null>(null);
  if (!trackTex.current) trackTex.current = makeTrackTexture();

  const chassis = getPart<ChassisPart>(spawn.chassisId) ?? getPart<ChassisPart>("chassis_wasp")!;
  const weapon = getPart<WeaponPart>(spawn.weaponId) ?? getPart<WeaponPart>("weapon_rattlejack")!;
  const arch = ARCH[spawn.archetype];
  const [w, h, l] = chassis.size;

  const state = useMemo<EnemyState>(
    () => ({
      id: spawn.id,
      pos: new THREE.Vector3(spawn.x, terrainHeight(spawn.x, spawn.z), spawn.z),
      hp: spawn.maxHp,
      maxHp: spawn.maxHp,
      radius: Math.max(2.0, w * 0.55),
      dead: false,
      jammed: false,
      archetype: spawn.archetype,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const yaw = useRef(Math.random() * Math.PI * 2);
  const speed = useRef(0);
  const cooldown = useRef(1.5 + Math.random() * 2);
  const goneSent = useRef(false);
  const wheelSpin = useRef(0);
  const [roofY, setRoofY] = useState(0.7);
  const onRoofY = useCallback((y: number) => setRoofY(y), []);

  const tmp = useRef({
    target: new THREE.Quaternion(),
    yawQ: new THREE.Quaternion(),
    local: new THREE.Quaternion(),
    tilt: new THREE.Quaternion(),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    dir: new THREE.Vector3(),
  }).current;

  useEffect(() => {
    game.enemies.set(spawn.id, state);
    return () => {
      game.enemies.delete(spawn.id);
    };
  }, [spawn.id, state]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (game.paused) return;
    const dt = Math.min(delta, 0.05);

    if (state.dead) {
      if (!goneSent.current) {
        goneSent.current = true;
        spawnEffect(tmp.from.set(state.pos.x, state.pos.y + 1, state.pos.z), 3.5, 0.8);
        playSfx("destroy");
        onGone();
      }
      return;
    }

    const pl = game.player;
    const dx = pl.pos.x - state.pos.x;
    const dz = pl.pos.z - state.pos.z;
    const dist = Math.hypot(dx, dz);

    if (pl.alive) {
      const desired = Math.atan2(-dx, -dz);
      let diff = wrapAngle(desired - yaw.current);
      yaw.current += THREE.MathUtils.clamp(diff, -0.9 * dt, 0.9 * dt);

      const uphill = Math.max(0, slopeAlong(state.pos.x, state.pos.z, yaw.current));
      const slopeFactor = THREE.MathUtils.clamp(1 - uphill * 2.5, 0.3, 1);
      let target = 0;
      if (dist > PREFERRED_MAX) target = arch.speed * slopeFactor * 0.85;
      else if (dist < PREFERRED_MIN) target = -arch.speed * 0.4;
      speed.current =
        speed.current < target
          ? Math.min(speed.current + 3 * dt, target)
          : Math.max(speed.current - 6 * dt, target);
    } else {
      speed.current = Math.max(0, speed.current - 6 * dt);
    }

    state.pos.x += -Math.sin(yaw.current) * speed.current * dt;
    state.pos.z += -Math.cos(yaw.current) * speed.current * dt;
    state.pos.x = THREE.MathUtils.clamp(state.pos.x, -MAP_LIMIT, MAP_LIMIT);
    state.pos.z = THREE.MathUtils.clamp(state.pos.z, -MAP_LIMIT, MAP_LIMIT);
    state.pos.y = sampleHull(state.pos.x, state.pos.z, yaw.current, w, l, tmp.target);

    tmp.yawQ.setFromAxisAngle(Y_AXIS, yaw.current);
    tmp.local.copy(tmp.yawQ).invert().multiply(tmp.target);
    tmp.tilt.slerp(tmp.local, 1 - Math.exp(-8 * dt));
    g.quaternion.copy(tmp.yawQ).multiply(tmp.tilt);
    g.position.set(state.pos.x, state.pos.y + 0.55, state.pos.z);

    // Aim turret at player (world-relative)
    if (turretRef.current && pl.alive) {
      const aimYaw = Math.atan2(-(pl.pos.x - state.pos.x), -(pl.pos.z - state.pos.z));
      let rel = wrapAngle(aimYaw - yaw.current);
      rel = THREE.MathUtils.clamp(rel, -Math.PI * 0.5, Math.PI * 0.5);
      turretRef.current.rotation.order = "YXZ";
      turretRef.current.rotation.y = THREE.MathUtils.lerp(
        turretRef.current.rotation.y,
        rel,
        1 - Math.exp(-5 * dt)
      );
      const pitch = THREE.MathUtils.clamp(
        Math.atan2(pl.pos.y - state.pos.y, dist) * 0.5,
        -0.25,
        0.35
      );
      turretRef.current.rotation.x = THREE.MathUtils.lerp(
        turretRef.current.rotation.x,
        pitch,
        1 - Math.exp(-4 * dt)
      );
    }

    wheelSpin.current -= speed.current * dt * 1.7;
    for (const wh of wheelRefs.current) {
      if (wh) wh.rotation.x = wheelSpin.current;
    }
    if (trackMatL.current?.map) trackMatL.current.map.offset.y -= speed.current * dt * 0.32;
    if (trackMatR.current?.map) trackMatR.current.map.offset.y -= speed.current * dt * 0.32;

    cooldown.current -= dt;
    const range = Math.min(75, weapon.range * 0.85);
    if (
      pl.alive &&
      !state.jammed &&
      dist < range &&
      cooldown.current <= 0 &&
      muzzleRef.current
    ) {
      const fireCd = weapon.rpm > 0 ? 60 / weapon.rpm : arch.fireCd;
      cooldown.current = fireCd * (0.9 + Math.random() * 0.3);
      muzzleRef.current.getWorldPosition(tmp.from);

      const wave = useBattleStore.getState().wave;
      const skill = Math.min(1, 0.25 + wave * 0.08);
      const shellSpeed = Math.max(25, weapon.projectileSpeed * 0.9);
      const lead = (dist / shellSpeed) * skill;
      const spread = (1 - skill) * 6;

      tmp.to.set(
        pl.pos.x + (-Math.sin(pl.yaw) * pl.speed) * lead + (Math.random() - 0.5) * spread,
        pl.pos.y + 1.2,
        pl.pos.z + (-Math.cos(pl.yaw) * pl.speed) * lead + (Math.random() - 0.5) * spread
      );

      const isMortar = weapon.weaponType === "mortar";
      if (isMortar) {
        const to = tmp.to.clone().sub(tmp.from);
        const flat = Math.hypot(to.x, to.z);
        const flight = Math.max(1.2, flat / 35);
        spawnProjectile({
          pos: tmp.from.clone(),
          vel: new THREE.Vector3(to.x / flight, 28 + flat * 0.12, to.z / flight),
          damage: weapon.damage * 0.7,
          owner: "enemy",
          life: flight + 2,
          splash: 2.5,
          ballistic: true,
        });
      } else {
        aimWithDrop(tmp.from, tmp.to, shellSpeed, tmp.dir);
        spawnProjectile({
          pos: tmp.from.clone(),
          vel: tmp.dir.multiplyScalar(shellSpeed),
          damage: weapon.damage * 0.65,
          owner: "enemy",
          life: 4,
          splash: 1.2,
          ballistic: false,
        });
      }
    }
  });

  return (
    <group ref={groupRef}>
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
