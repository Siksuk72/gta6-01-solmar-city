// Solmar City — the game itself. Owns the renderer, the loop and every system,
// and wires them together: driving, stealing cars, police, missions, combat,
// activities, HUD, save and the title/pause/wasted screens.
import { MISSIONS, PLAYER_START, SHOPS, WEAPONS, ACTIVITIES } from './config.js';
import { distance2D } from './random.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { TrafficManager } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { WantedSystem, PoliceManager } from './police.js';
import { CombatSystem } from './combat.js';
import { Effects } from './effects.js';
import { SoundEngine } from './audio.js';
import { InputManager } from './input.js';
import { ThirdPersonCamera } from './camera.js';
import { Hud } from './hud.js';
import { MissionManager } from './missions.js';
import { ActivityManager } from './activities.js';
import { loadSave, writeSave, clearSave, buildSaveData } from './save.js';

const THREE = window.THREE;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.city = buildCity(this.scene);
    this.effects = new Effects(this.scene);
    this.audio = new SoundEngine();
    this.input = new InputManager(canvas);
    this.input.attach();
    this.input.onFirstGesture = () => this.audio.ensure();
    this.player = new Player(this.scene, PLAYER_START.x, PLAYER_START.z);
    this.traffic = new TrafficManager(this.scene, this.city);
    this.peds = new PedestrianManager(this.scene, this.city);
    this.wanted = new WantedSystem(this.audio);
    this.police = new PoliceManager(this.scene, this.city, this.effects, this.audio);
    this.combat = new CombatSystem(this.scene, this.effects, this.audio);
    this.missions = new MissionManager(this.scene, this.city, this.effects, this.audio);
    this.activities = new ActivityManager(this.scene, this.city, this.effects, this.audio);
    this.hud = new Hud(this.city);
    this.cam = new ThirdPersonCamera(this.camera);
    this.state = 'title';
    this.vistaMode = false;
    this.autoDrive = false; // Screenshot staging: the car drives itself.
    this.playerCar = null;
    this.ownedWeapons = new Set(['pistol']);
    this.collectiblesTaken = new Set();
    this.playTimeSeconds = 0;
    this.clockMinutes = 17 * 60 + 30; // Golden hour.
    this.time = 0;
    this.lastSave = 0;
    this.saveData = loadSave();
    this.stats = { kills: 0, carsStolen: 0, missionsDone: 0 };
    this.crimeFlash = 0;
    this.respawnTimer = 0;
    this.autosaveTimer = 0;
    this.wireHud();
    this.wireMissions();
    this.setupWorld();
    window.addEventListener('resize', () => this.onResize());
    window.__game = this;
  }

  setupWorld() {
    this.traffic.spawnInitial(16, null);
    this.peds.spawnInitial(26);
    // Parked cars around the city, including a taxi and the mission sports car spot.
    const parked = [
      ['sedan', -80, 152, Math.PI / 2], ['van', -58, -80, 0], ['sports', 152, 36, -Math.PI / 2],
      ['sedan', 94, -152, Math.PI], ['taxi', -152, 94, Math.PI / 2], ['sedan', 36, -94, 0],
      ['truck', -94, -36, Math.PI / 2], ['sports', 36, 152, -Math.PI / 2],
    ];
    for (const [type, x, z, heading] of parked) this.traffic.spawnParked(type, x, z, heading);
    // The hotel sports car for mission 2 (steal it later).
    this.hotelCar = this.traffic.spawnParked('sports', 145, 29, Math.PI / 2, 0xd4202a);
    // Collectible cash bundles.
    const spots = this.activities.spawnCollectibles(ACTIVITIES.collectibleCount, []);
    this.activities.buildCollectibleMeshes(spots, this.combat);
    for (const pickup of this.combat.pickups) pickup.collectibleId = spots[this.combat.pickups.indexOf(pickup)]?.id;
    this.collectibleSpots = spots;
    // A health pickup at the clinic and ammo at the gun store.
    this.combat.spawnPickup('health', -145, -29, 50);
    this.combat.spawnPickup('ammo', 58, 145, 0);
  }

  wireHud() {
    this.hud.onNewGame = () => {
      clearSave();
      this.saveData = null;
      this.resetProgress();
      this.startPlaying();
    };
    this.hud.onContinue = () => {
      this.applySave(this.saveData);
      this.startPlaying();
    };
    this.hud.onResume = () => this.setPaused(false);
    this.hud.onSave = () => {
      this.saveGame();
      this.hud.showMessage('Game saved.');
    };
    this.hud.onQuitToTitle = () => {
      this.saveGame();
      this.setPaused(false);
      this.state = 'title';
      this.hud.showTitle(!!loadSave(), MISSIONS, this.missions.missionIndex);
    };
    this.hud.onRestartMission = () => {
      this.setPaused(false);
      this.missions.restartMission();
      this.hud.showMessage('Mission restarted.');
    };
    this.hud.onShopBuy = (item) => this.buyShopItem(item);
    this.hud.onCloseShop = () => this.hud.hideShop();
  }

  wireMissions() {
    this.missions.onSetWanted = (level) => this.wanted.setLevel(level);
    this.missions.onSpawnMissionCar = () => this.hotelCar;
    this.missions.onSpawnMissionDrops = (count) => {
      const spots = this.activities.spawnCollectibles(count, []);
      for (const spot of spots) {
        const pickup = this.combat.spawnPickup('cash', spot.x, spot.z, 200);
        pickup.missionDrop = true;
      }
    };
    this.missions.onSpawnGuards = (count) => {
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        this.combat.spawnEnemy('guard', 203 + Math.cos(angle) * 18, -203 + Math.sin(angle) * 18);
      }
    };
    this.missions.onNextDropPosition = () => {
      const drop = this.combat.pickups.find((p) => p.missionDrop);
      return drop ? { x: drop.x, z: drop.z } : null;
    };
  }

  resetProgress() {
    this.player.cash = 200;
    this.player.health = 100;
    this.player.armor = 0;
    this.player.weapon = 'pistol';
    this.player.magAmmo = WEAPONS.pistol.mag;
    this.ownedWeapons = new Set(['pistol']);
    this.collectiblesTaken = new Set();
    this.playTimeSeconds = 0;
    this.missions.missionIndex = 0;
    this.missions.storyComplete = false;
    this.player.teleport(PLAYER_START.x, PLAYER_START.z);
    this.wanted.setLevel(0, true);
  }

  applySave(save) {
    if (!save) return;
    this.player.cash = save.cash ?? 200;
    this.player.health = save.health ?? 100;
    this.player.armor = save.armor ?? 0;
    this.player.weapon = save.weapon || 'pistol';
    this.player.magAmmo = WEAPONS[this.player.weapon].mag;
    this.ownedWeapons = new Set(['pistol', ...(save.weapon && save.weapon !== 'pistol' ? [save.weapon] : [])]);
    this.missions.missionIndex = save.missionIndex ?? 0;
    this.missions.storyComplete = !!save.storyComplete;
    this.collectiblesTaken = new Set(save.collectiblesTaken || []);
    this.playTimeSeconds = save.playTimeSeconds || 0;
    this.player.teleport(save.playerX ?? PLAYER_START.x, save.playerZ ?? PLAYER_START.z);
    // Remove already-collected bundles.
    for (const pickup of [...this.combat.pickups]) {
      if (pickup.collectibleId !== undefined && this.collectiblesTaken.has(pickup.collectibleId)) {
        this.scene.remove(pickup.mesh);
        this.scene.remove(pickup.light);
        this.combat.pickups.splice(this.combat.pickups.indexOf(pickup), 1);
      }
    }
  }

  startPlaying() {
    this.audio.ensure();
    this.hud.hideTitle();
    this.hud.hideWasted();
    this.hud.hideBusted();
    this.state = 'playing';
    if (!this.missions.active && !this.missions.storyComplete) {
      this.missions.startMission(this.missions.missionIndex);
    }
    this.hud.showMessage(MISSIONS[this.missions.missionIndex]
      ? `Mission: ${MISSIONS[this.missions.missionIndex].name}` : 'Story complete — free roam!', 5);
  }

  setPaused(paused) {
    if (this.state === 'playing' && paused) {
      this.state = 'paused';
      const stats = `Cash $${Math.floor(this.player.cash).toLocaleString()}  •  Missions done ${this.stats.missionsDone}/6  •  ` +
        `Play time ${Math.floor(this.playTimeSeconds / 60)} min  •  Wanted ${this.wanted.level}★`;
      this.hud.showPause(stats);
    } else if (this.state === 'paused' && !paused) {
      this.state = 'playing';
      this.hud.hidePause();
    }
  }

  saveGame() {
    writeSave(buildSaveData(this));
    this.lastSave = this.time;
  }

  // --- interactions ---
  nearestInteractable() {
    const px = this.player.x;
    const pz = this.player.z;
    if (!this.playerCar) {
      const shop = this.activities.nearestShop(px, pz);
      if (shop) return { kind: 'shop', shop, text: `Press E — ${shop.label}` };
      const car = this.traffic.nearestCar(px, pz, 5.5);
      if (car) {
        const parked = car.speed < 1;
        return { kind: 'car', car, text: parked ? 'Press E to enter car' : 'Press E to jack the car!' };
      }
      const step = this.missions.currentStep();
      if (step && step.type === 'talk') {
        const npc = this.missions.npcs[step.npc];
        if (npc && distance2D(px, pz, npc.x, npc.z) < step.radius) {
          return { kind: 'talk', text: 'Press E to talk' };
        }
      }
    } else if (this.playerCar.type === 'taxi' && !this.activities.taxi.active) {
      return { kind: 'taxi', text: 'Press T to start a taxi fare' };
    }
    return null;
  }

  interact() {
    const target = this.nearestInteractable();
    if (!target) return;
    if (target.kind === 'shop') {
      this.audio.uiClick();
      const shop = target.shop;
      if (shop.kind === 'race') {
        if (this.activities.startRace()) this.hud.showMessage('Race started — hit all 8 gates!');
        return;
      }
      this.hud.showShop(shop, this.activities.shopItems(shop));
      return;
    }
    if (target.kind === 'car') {
      this.enterCar(target.car);
      return;
    }
    if (target.kind === 'taxi') {
      this.activities.startTaxi(this.playerCar, this.player);
    }
  }

  handleCarExit(interactPressed, interactable) {
    if (!this.playerCar || !interactPressed) return;
    if (!interactable || interactable.kind === 'car') this.exitCar();
  }

  enterCar(car) {
    this.audio.carDoor();
    this.playerCar = car;
    car.isPlayer = true;
    car.occupied = true;
    car.parked = false;
    car.speed = 0;
    if (car.type === 'police') this.wanted.addCrime(20);
    else if (car.speed > 1 || car === this.hotelCar) {
      // Jacking a moving car or the hotel sports car is a crime.
      this.wanted.addCrime(20);
      this.stats.carsStolen += 1;
      this.hud.showMessage('Car stolen! The cops are on their way.');
    }
    this.player.mesh.visible = false;
    this.cam.targetDistance = 13;
  }

  exitCar() {
    if (!this.playerCar) return;
    const car = this.playerCar;
    car.isPlayer = false;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.player.teleport(car.x + side.x * 2.5, car.z + side.z * 2.5);
    this.player.mesh.visible = true;
    this.playerCar = null;
    this.audio.carDoor();
    this.cam.targetDistance = 10;
    this.activities.cancelTaxi();
  }

  buyShopItem(item) {
    if (this.player.cash < item.price) {
      this.audio.denied();
      this.hud.showMessage('Not enough cash.');
      return;
    }
    this.player.cash -= item.price;
    this.audio.cashSound();
    if (item.id === 'ammo') {
      this.player.magAmmo = WEAPONS[this.player.weapon].mag;
      this.hud.showMessage('Magazine refilled.');
    } else if (item.id === 'smg' || item.id === 'shotgun') {
      this.ownedWeapons.add(item.id);
      this.player.weapon = item.id;
      this.player.magAmmo = WEAPONS[item.id].mag;
      this.hud.showMessage(`${WEAPONS[item.id].name} bought — press ${item.id === 'smg' ? '2' : '3'} to use it.`);
    } else if (item.id === 'armor') {
      this.player.addArmor(50);
      this.hud.showMessage('Body armour fitted.');
    } else if (item.id === 'heal') {
      this.player.heal(100);
      this.hud.showMessage('You feel brand new.');
    } else if (item.id === 'repair') {
      if (this.playerCar) {
        this.playerCar.health = 100;
        this.playerCar.smoking = false;
        this.hud.showMessage('Car repaired.');
      } else {
        this.player.cash += item.price;
        this.hud.showMessage('You need to be in a car to repair it.');
      }
    } else if (item.id === 'bribe') {
      this.wanted.setLevel(0);
      this.police.clearAll(this.traffic.cars);
      this.hud.showMessage('The cops look the other way. For now.');
    }
  }

  // --- death / busted ---
  onWasted() {
    this.state = 'wasted';
    this.audio.wasted();
    this.audio.setSiren(false);
    this.hud.showWasted();
    this.respawnTimer = 3;
  }

  onBusted() {
    this.state = 'busted';
    this.audio.setSiren(false);
    this.hud.showBusted();
    this.respawnTimer = 3;
  }

  respawn() {
    const wasWasted = this.state === 'wasted';
    const fine = Math.floor(this.player.cash * (wasWasted ? 0.1 : 0.15));
    this.player.cash -= fine;
    this.player.health = 100;
    this.player.armor = 0;
    this.wanted.setLevel(0, true);
    this.police.clearAll(this.traffic.cars);
    this.combat.clearEnemies();
    if (this.playerCar) {
      this.playerCar.isPlayer = false;
      this.playerCar = null;
    }
    this.player.mesh.visible = true;
    this.player.teleport(-145, -29); // Marina Clinic steps.
    this.hud.hideWasted();
    this.hud.hideBusted();
    this.missions.restartMission();
    this.state = 'playing';
    this.hud.showMessage(wasWasted ? 'You woke up at the Marina Clinic.' : 'You made bail. Back on the streets.');
  }

  // --- main update ---
  update(dt) {
    this.time += dt;
    if (this.state === 'title') {
      // Slow cinematic orbit over the city.
      const angle = this.time * 0.02;
      this.camera.position.set(Math.sin(angle) * 200, 90, Math.cos(angle) * 200);
      this.camera.lookAt(0, 10, 0);
      this.traffic.update(dt, null, null);
      this.peds.update(dt, null);
      this.effects.update(dt, this.time);
      this.animateClouds(dt);
      this.input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      this.input.endFrame();
      return;
    }
    if (this.state === 'wasted' || this.state === 'busted') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      this.effects.update(dt, this.time);
      this.input.endFrame();
      return;
    }

    this.playTimeSeconds += dt;
    this.clockMinutes += dt * 0.5;
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 30) {
      this.autosaveTimer = 0;
      this.saveGame();
    }

    const input = this.input;
    // Pause.
    if (input.consumePressed('Escape') || input.consumePressed('KeyP')) {
      this.setPaused(true);
      input.endFrame();
      return;
    }
    // Music toggle.
    if (input.consumePressed('KeyM')) {
      const on = this.audio.toggleMusic();
      this.hud.showMessage(on ? 'Radio on.' : 'Radio off.');
    }
    // Weapon switching.
    if (input.consumePressed('Digit1') && this.ownedWeapons.has('pistol')) this.player.weapon = 'pistol';
    if (input.consumePressed('Digit2') && this.ownedWeapons.has('smg')) this.player.weapon = 'smg';
    if (input.consumePressed('Digit3') && this.ownedWeapons.has('shotgun')) this.player.weapon = 'shotgun';
    if (input.consumePressed('KeyR')) this.combat.startReload(this.player);
    // Taxi.
    if (input.consumePressed('KeyT') && this.playerCar && this.playerCar.type === 'taxi') {
      this.activities.startTaxi(this.playerCar, this.player);
    }

    // Interact (E) — held for vault-cracking steps.
    const holdingInteract = input.isDown('KeyE');
    const interactPressed = input.consumePressed('KeyE');
    let interactable = null;
    if (this.hud.el['shop-panel'].style.display === 'flex') {
      if (interactPressed) this.hud.hideShop();
    } else {
      // Whether the player was driving before this press decides the exit:
      // the same press that enters a car must not exit it again.
      const wasInCar = !!this.playerCar;
      interactable = this.nearestInteractable();
      if (interactPressed) this.interact();
      if (wasInCar) this.handleCarExit(interactPressed, interactable);
    }

    // Movement.
    const cars = this.traffic.allCars();
    if (this.playerCar) {
      const car = this.playerCar;
      const driveInput = this.autoDrive
        ? { moveAxes: () => ({ forward: 1, strafe: 0 }), isDown: () => false, wasPressed: () => false }
        : input;
      car.updatePlayer(dt, driveInput, this.city.colliders, cars, () => this.audio.skid());
      if (car.dead) {
        this.effects.explosion(car.x, 1, car.z);
        this.audio.explosion();
        this.player.damage(35);
        this.exitCar();
        this.player.teleport(car.x + 3, car.z + 3);
        car.remove();
        cars.splice(cars.indexOf(car), 1);
      }
      this.player.x = car.x;
      this.player.z = car.z;
      this.audio.setEngine(Math.abs(car.speed) / car.spec.topSpeed, true);
    } else {
      this.player.update(dt, input, this.cam.yaw, this.city.colliders, cars);
      this.audio.setEngine(0, false);
      // Shooting.
      const weapon = WEAPONS[this.player.weapon];
      const wantFire = weapon.auto ? input.mouseDown : input.mouseClicked;
      if (wantFire) {
        this.combat.playerFire(this.camera, this.player, cars, this.peds.peds, this.city.solidMeshes,
          (kind, target) => this.onShotHit(kind, target));
      }
    }

    // Systems.
    const playerPos = { x: this.player.x, z: this.player.z };
    this.traffic.update(dt, playerPos, this.playerCar);
    this.peds.update(dt, playerPos);
    this.wanted.update(dt, false);
    this.police.onPlayerShot = (damage) => {
      const died = this.player.damage(damage);
      if (died) this.onWasted();
    };
    this.police.update(dt, this.wanted.level, playerPos, this.playerCar, this.city.colliders, cars,
      () => this.onBusted());
    this.combat.update(dt, {
      player: this.player,
      playerCar: this.playerCar,
      onPlayerDamaged: (amount, died) => { if (died) this.onWasted(); },
      onCarDamaged: () => {},
      onPickup: (pickup) => this.onPickup(pickup),
    });
    // Mission + activities.
    this.missions.update(dt, {
      player: this.player,
      playerCar: this.playerCar,
      interactPressed,
      holdingInteract,
    });
    this.activities.updateTaxi(dt, this.playerCar, playerPos);
    this.activities.updateRace(dt, this.playerCar, playerPos);
    this.drainEvents();
    // Smoking cars.
    for (const car of cars) {
      if (car.smoking && !car.dead && Math.random() < dt * 6) {
        this.effects.smoke(car.x, 1.5, car.z);
      }
    }
    // Camera + effects + clouds.
    const focus = this.playerCar
      ? { x: this.playerCar.x, y: 0, z: this.playerCar.z }
      : { x: this.player.x, y: this.player.y, z: this.player.z };
    if (this.vistaMode) this.cam.setVista();
    else this.cam.update(dt, input, focus, !!this.playerCar, this.playerCar ? this.playerCar.heading : 0);
    const shake = this.effects.shakeOffset();
    this.camera.position.x += shake.x;
    this.camera.position.y += shake.y;
    this.effects.update(dt, this.time);
    this.animateClouds(dt);
    this.updateHud(dt, interactable);
    input.endFrame();
  }

  onShotHit(kind, target) {
    if (kind === 'ped') {
      this.wanted.addCrime(25);
      this.peds.scare(target.x, target.z, 40);
      this.hud.showMessage('You shot a civilian! The cops are coming.');
    } else if (kind === 'enemy') {
      this.stats.kills += 1;
      if (target.type === 'cop') this.wanted.addCrime(25);
      this.missions.onEnemyKilled();
    } else if (kind === 'carDestroyed') {
      this.wanted.addCrime(20);
      this.effects.explosion(target.x, 1, target.z);
      this.audio.explosion();
      const cars = this.traffic.allCars();
      const index = cars.indexOf(target);
      if (index !== -1) {
        target.remove();
        cars.splice(index, 1);
      }
      if (target === this.playerCar) this.playerCar = null;
    }
  }

  onPickup(pickup) {
    if (pickup.missionDrop) {
      this.missions.onMissionDropCollected();
      return;
    }
    if (pickup.collectibleId !== undefined) {
      this.collectiblesTaken.add(pickup.collectibleId);
      this.player.cash += ACTIVITIES.collectibleValue;
      this.audio.cashSound();
      this.hud.showMessage(`Hidden cash +$${ACTIVITIES.collectibleValue}`);
      return;
    }
    if (pickup.kind === 'cash') {
      this.player.cash += pickup.amount;
      this.audio.cashSound();
    } else if (pickup.kind === 'health') {
      this.player.heal(pickup.amount);
      this.audio.pickup();
      this.hud.showMessage('Health +50');
    } else if (pickup.kind === 'ammo') {
      this.player.magAmmo = WEAPONS[this.player.weapon].mag;
      this.audio.pickup();
      this.hud.showMessage('Ammo restocked.');
    }
  }

  drainEvents() {
    for (const event of this.missions.drainEvents()) {
      if (event.type === 'message') this.hud.showMessage(event.text, 6);
      else if (event.type === 'complete') {
        this.player.cash += event.mission.reward;
        this.stats.missionsDone += 1;
        this.audio.missionComplete();
        this.hud.showBanner('MISSION COMPLETE', `${event.mission.name} — $${event.mission.reward.toLocaleString()}`, 4);
        this.saveGame();
        if (this.missions.missionIndex < MISSIONS.length) {
          this.missions.startMission(this.missions.missionIndex);
        }
      } else if (event.type === 'failed') {
        this.hud.showBanner('MISSION FAILED', event.reason, 4);
      } else if (event.type === 'storyComplete') {
        this.hud.showBanner('KING OF SOLMAR', 'You took the city. Free roam — the streets are yours.', 6);
      }
    }
    for (const event of this.activities.drainEvents()) {
      if (event.type === 'message') this.hud.showMessage(event.text, 5);
      else if (event.type === 'taxiPaid') {
        this.player.cash += event.fare;
        this.hud.showBanner('FARE PAID', `+$${event.fare}`, 3);
        this.missions.updateMarker();
      } else if (event.type === 'raceWon') {
        this.player.cash += event.reward;
        this.hud.showBanner('RACE WON', `+$${event.reward}`, 4);
        this.missions.updateMarker();
      }
    }
  }

  updateHud(dt, interactable) {
    const objective = this.missions.objectiveText();
    const marker = this.missions.marker
      || (this.activities.taxi.active ? this.activities.taxi.dest : null)
      || (this.activities.race.active ? { x: this.activities.race.gates[this.activities.race.gateIndex][0], z: this.activities.race.gates[this.activities.race.gateIndex][1] } : null);
    this.hud.update(dt, {
      health: this.player.health,
      armor: this.player.armor,
      cash: this.player.cash,
      wanted: this.wanted.level,
      weaponName: WEAPONS[this.player.weapon].name,
      magAmmo: this.player.magAmmo,
      reloading: this.combat.reloadTimer > 0,
      speed: this.playerCar ? this.playerCar.speed : 0,
      inCar: !!this.playerCar,
      missionTitle: objective.title,
      objectiveText: objective.text,
      interactText: interactable ? interactable.text : '',
      showCrosshair: !this.playerCar && this.state === 'playing',
      clockMinutes: this.clockMinutes,
      time: this.time,
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: this.playerCar ? this.playerCar.heading : this.player.heading,
      shops: SHOPS,
      collectibles: this.collectibleSpots.filter((s) => !this.collectiblesTaken.has(s.id)),
      traffic: this.traffic.cars.slice(0, 40),
      policeCars: this.police.cars,
      marker,
    });
  }

  animateClouds(dt) {
    for (const cloud of this.city.clouds) {
      cloud.position.x += dt * 1.2;
      if (cloud.position.x > 380) cloud.position.x = -380;
    }
    if (this.city.ocean) {
      this.city.ocean.material.color.setHSL(0.55, 0.55, 0.42 + Math.sin(this.time * 0.3) * 0.02);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  frame() {
    const dt = Math.min(0.05, this.clockDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  clockDelta() {
    const now = performance.now();
    if (!this.lastFrame) this.lastFrame = now;
    const dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    return dt;
  }

  run() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }
}
