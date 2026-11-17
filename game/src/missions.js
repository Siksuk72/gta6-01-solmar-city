// The story: six missions for Jax Marlowe, from Lena's garage to the top of
// Solmar City. A small step engine drives each mission's objectives, markers,
// spawns and rewards.
import { MISSIONS } from './config.js';
import { distance2D } from './random.js';
import { makePersonMesh } from './models.js';

const NPC_POSITIONS = {
  lena: { x: -87, z: 145, palette: { shirt: 0xc22a2a, pants: 0x222222, skin: 0xe8b88a, hair: 0x1a1a1a } },
  eddie: { x: 87, z: -145, palette: { shirt: 0xe8c84a, pants: 0x333333, skin: 0xc98e6a, hair: 0x000000 } },
};

export class MissionManager {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.stepState = {};
    this.active = false;
    this.storyComplete = false;
    this.events = [];
    this.marker = null;
    this.npcs = {};
    this.missionCar = null;
    this.raceTimeLeft = 0;
    this.createNpcs();
  }

  createNpcs() {
    for (const [name, def] of Object.entries(NPC_POSITIONS)) {
      const mesh = makePersonMesh(def.palette);
      mesh.position.set(def.x, 0, def.z);
      if (name === 'eddie') mesh.scale.setScalar(1.18);
      this.scene.add(mesh);
      this.npcs[name] = { mesh, x: def.x, z: def.z };
    }
  }

  currentMission() {
    return MISSIONS[this.missionIndex] || null;
  }

  currentStep() {
    const mission = this.currentMission();
    if (!mission) return null;
    return mission.steps[this.stepIndex] || null;
  }

  startMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.stepState = {};
    this.active = true;
    const mission = this.currentMission();
    if (!mission) {
      this.active = false;
      this.storyComplete = true;
      return;
    }
    this.events.push({ type: 'message', text: `New mission: ${mission.name}` });
    this.events.push({ type: 'message', text: mission.briefing });
    this.startStep();
  }

  startStep() {
    const step = this.currentStep();
    this.stepState = { collected: 0, killed: 0, gateIndex: 0, holdTime: 0, raceTime: 0 };
    if (!step) {
      this.completeMission();
      return;
    }
    if (step.wanted !== undefined && this.onSetWanted) this.onSetWanted(step.wanted);
    if (step.type === 'collect') this.spawnMissionDrops(step.count);
    if (step.type === 'kill') this.spawnGuards(step.count);
    if (step.type === 'race') this.raceTimeLeft = 150;
    if (step.type === 'enterCar' && step.carType === 'sports' && !this.missionCar) this.spawnMissionCar();
    this.updateMarker();
  }

  spawnMissionCar() {
    if (!this.onSpawnMissionCar) return;
    this.missionCar = this.onSpawnMissionCar();
  }

  spawnMissionDrops(count) {
    if (!this.onSpawnMissionDrops) return;
    this.onSpawnMissionDrops(count);
  }

  spawnGuards(count) {
    if (!this.onSpawnGuards) return;
    this.onSpawnGuards(count);
  }

  updateMarker() {
    const step = this.currentStep();
    if (!step || !this.active) {
      this.marker = null;
      this.effects.clearBeacon();
      return;
    }
    let pos = null;
    if (step.pos) pos = { x: step.pos[0], z: step.pos[1] };
    else if (step.gates) pos = { x: step.gates[this.stepState.gateIndex][0], z: step.gates[this.stepState.gateIndex][1] };
    else if (step.type === 'collect') pos = this.nextDropPosition();
    this.marker = pos;
    if (pos) this.effects.setBeacon(pos.x, pos.z, 0xffd800);
    else this.effects.clearBeacon();
  }

  nextDropPosition() {
    if (this.onNextDropPosition) return this.onNextDropPosition();
    return null;
  }

  stepLabel(step) {
    if (!step) return '';
    let label = step.label || '';
    if (step.type === 'collect') label = label.replace(/\(\d+\/\d+\)/, `(${this.stepState.collected}/${step.count})`);
    if (step.type === 'kill') label = label.replace(/\(\d+\/\d+\)/, `(${this.stepState.killed}/${step.count})`);
    if (step.type === 'hold' && this.stepState.holdTime > 0) {
      label += ` — ${Math.ceil(step.seconds - this.stepState.holdTime)}s`;
    }
    if (step.type === 'race') {
      label = `Hit the checkpoints (${this.stepState.gateIndex}/${step.gates.length}) — ${Math.ceil(this.raceTimeLeft)}s left`;
    }
    return label;
  }

  objectiveText() {
    const mission = this.currentMission();
    if (!mission || !this.active) return { title: 'Free roam', text: '' };
    const step = this.currentStep();
    return { title: `${mission.name} — $${mission.reward}`, text: this.stepLabel(step) };
  }

  onMissionDropCollected() {
    const step = this.currentStep();
    if (!step || step.type !== 'collect') return;
    this.stepState.collected += 1;
    this.audio.cashSound();
    this.updateMarker();
    if (this.stepState.collected >= step.count) this.advanceStep();
  }

  onEnemyKilled() {
    const step = this.currentStep();
    if (!step || step.type !== 'kill') return;
    this.stepState.killed += 1;
    if (this.stepState.killed >= step.count) this.advanceStep();
  }

  advanceStep() {
    this.stepIndex += 1;
    this.audio.pickup();
    this.events.push({ type: 'step' });
    this.startStep();
  }

  completeMission() {
    const mission = this.currentMission();
    this.active = false;
    this.effects.clearBeacon();
    this.marker = null;
    this.events.push({ type: 'complete', mission });
    this.missionIndex += 1;
    if (this.missionIndex >= MISSIONS.length) {
      this.storyComplete = true;
      this.events.push({ type: 'storyComplete' });
    }
  }

  failMission(reason) {
    this.events.push({ type: 'failed', reason: reason || 'Mission failed' });
    this.audio.missionFailed();
    this.active = false;
    this.effects.clearBeacon();
    this.marker = null;
  }

  restartMission() {
    if (this.missionIndex < MISSIONS.length) this.startMission(this.missionIndex);
  }

  update(dt, ctx) {
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    const px = ctx.playerCar ? ctx.playerCar.x : ctx.player.x;
    const pz = ctx.playerCar ? ctx.playerCar.z : ctx.player.z;
    const distTo = (pos) => distance2D(px, pz, pos[0], pos[1]);
    switch (step.type) {
      case 'goto':
      case 'driveTo':
      case 'escape':
        if (distTo(step.pos) < step.radius) this.advanceStep();
        break;
      case 'talk': {
        const npc = this.npcs[step.npc];
        if (npc && distance2D(ctx.player.x, ctx.player.z, npc.x, npc.z) < step.radius && ctx.interactPressed) {
          this.advanceStep();
        }
        break;
      }
      case 'enterCar':
        if (ctx.playerCar && (!step.carType || ctx.playerCar.type === step.carType)) this.advanceStep();
        break;
      case 'hold':
        if (distTo(step.pos) < step.radius && ctx.holdingInteract) {
          this.stepState.holdTime += dt;
          if (this.stepState.holdTime >= step.seconds) this.advanceStep();
        } else {
          this.stepState.holdTime = Math.max(0, this.stepState.holdTime - dt * 2);
        }
        break;
      case 'race': {
        this.raceTimeLeft -= dt;
        if (this.raceTimeLeft <= 0) {
          this.failMission('Out of time — the cops got away with the win.');
          break;
        }
        const gate = step.gates[this.stepState.gateIndex];
        if (gate && distTo(gate) < 12) {
          this.stepState.gateIndex += 1;
          this.audio.pickup();
          if (this.stepState.gateIndex >= step.gates.length) this.advanceStep();
          else this.updateMarker();
        }
        break;
      }
      default:
        break;
    }
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
