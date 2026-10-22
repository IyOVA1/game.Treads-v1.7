/**
 * Treads audio bus
 * Drop files into:
 *   public/sfx/*.mp3
 *   public/music/*.mp3
 * Paths below are relative to the site root (Vite public/).
 */

const SFX = {
  fire_assault: "sfx/fire_assault.mp3",
  fire_cannon: "sfx/fire_cannon.mp3",
  fire_mortar: "sfx/fire_mortar.mp3",
  fire_missile: "sfx/fire_missile.mp3",
  fire_plasma: "sfx/fire_plasma.mp3",
  fire_energy: "sfx/fire_energy.mp3",
  reload: "sfx/reload.mp3",
  hit_enemy: "sfx/hit_enemy.mp3",
  hit_player: "sfx/hit_player.mp3",
  explosion: "sfx/explosion.mp3",
  ability_afterburners: "sfx/ability_afterburners.mp3",
  ability_doomshock: "sfx/ability_doomshock.mp3",
  ability_shield: "sfx/ability_shield.mp3",
  ability_field: "sfx/ability_field.mp3",
  ability_jammer: "sfx/ability_jammer.mp3",
  wave_start: "sfx/wave_start.mp3",
  wave_clear: "sfx/wave_clear.mp3",
  ui_click: "sfx/ui_click.mp3",
  purchase: "sfx/purchase.mp3",
  destroy: "sfx/destroy.mp3",
} as const;

const MUSIC = {
  arsenal: "music/arsenal_loop.mp3",
  battle: "music/battle_loop.mp3",
} as const;

export type SfxId = keyof typeof SFX;
export type MusicId = keyof typeof MUSIC;

const cache = new Map<string, HTMLAudioElement>();
let musicEl: HTMLAudioElement | null = null;
let musicId: MusicId | null = null;
let muted = false;
let sfxVolume = 0.55;
let musicVolume = 0.35;

function resolve(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path}`.replace(/\/{2,}/g, "/").replace(":/", "://");
}

function getAudio(path: string) {
  let a = cache.get(path);
  if (!a) {
    a = new Audio(resolve(path));
    a.preload = "auto";
    cache.set(path, a);
  }
  return a;
}

export function playSfx(id: SfxId, opts?: { volume?: number; rate?: number }) {
  if (muted) return;
  const path = SFX[id];
  if (!path) return;
  try {
    const a = getAudio(path).cloneNode(true) as HTMLAudioElement;
    a.volume = Math.min(1, (opts?.volume ?? 1) * sfxVolume);
    if (opts?.rate) a.playbackRate = opts.rate;
    void a.play().catch(() => {
      /* autoplay blocked or missing file — silent */
    });
  } catch {
    /* missing file */
  }
}

export function playFireSfx(weaponType: string, weaponId?: string) {
  if (weaponId === "weapon_craterfall") {
    playSfx("fire_missile");
    return;
  }
  switch (weaponType) {
    case "assault":
      playSfx("fire_assault", { volume: 0.45 });
      break;
    case "mortar":
      playSfx("fire_mortar");
      break;
    case "plasma":
      playSfx("fire_plasma");
      break;
    case "energy":
      playSfx("fire_energy");
      break;
    case "cannon":
    default:
      playSfx("fire_cannon");
      break;
  }
}

export function playAbilitySfx(abilityId: string) {
  const map: Record<string, SfxId> = {
    afterburners: "ability_afterburners",
    doomshock: "ability_doomshock",
    personal_shield: "ability_shield",
    rejuvenation_field: "ability_field",
    radar_jammer: "ability_jammer",
  };
  const id = map[abilityId];
  if (id) playSfx(id);
}

export function playMusic(id: MusicId) {
  if (musicId === id && musicEl && !musicEl.paused) return;
  stopMusic();
  musicId = id;
  if (muted) return;
  try {
    musicEl = getAudio(MUSIC[id]);
    musicEl.loop = true;
    musicEl.volume = musicVolume;
    void musicEl.play().catch(() => {});
  } catch {
    /* missing */
  }
}

export function stopMusic() {
  if (musicEl) {
    musicEl.pause();
    musicEl.currentTime = 0;
  }
  musicEl = null;
  musicId = null;
}

export function setMuted(v: boolean) {
  muted = v;
  if (v) stopMusic();
}

export function setVolumes(sfx: number, music: number) {
  sfxVolume = sfx;
  musicVolume = music;
  if (musicEl) musicEl.volume = musicVolume;
}
