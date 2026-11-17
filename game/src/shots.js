// Screenshot scenes behind ?shot=cover|chase|mission|city. Each one sets up a
// real, playable game state — a car chase, a shootout, a mission in progress,
// a city vista — and lets the game run forward from there, so the frame is
// what the game itself looks like in play.
import { WEAPONS } from './config.js';

export function stageShot(game, name) {
  game.audio.ensure();
  game.hud.hideTitle();
  game.state = 'playing';
  const wanted = game.wanted;
  const missions = game.missions;

  if (name === 'chase') {
    // On foot at a downtown intersection, wanted level 4, cops closing in
    // and a police car parked across the street with its light bar showing.
    game.player.teleport(29, 87);
    game.player.heading = Math.PI * 0.75;
    game.player.weapon = 'smg';
    game.ownedWeapons.add('smg');
    game.player.magAmmo = WEAPONS.smg.mag;
    game.player.cash = 2450;
    missions.startMission(2);
    missions.stepIndex = 2;
    missions.startStep();
    wanted.setLevel(4);
    game.combat.spawnEnemy('cop', 38, 100);
    game.combat.spawnEnemy('cop', 18, 72);
    game.combat.spawnEnemy('cop', 44, 78);
    const patrol = game.traffic.spawnParked('police', 22, 116, Math.PI * 0.85);
    patrol.isPolice = true;
    game.cam.yaw = 0.8;
    game.cam.pitch = 0.34;
    game.cam.targetDistance = 11;
  } else if (name === 'mission') {
    // Mission 5, the bank job: the player in a sports car stopped outside
    // the bank, the waypoint beacon over the vault, guards on the steps.
    game.hotelCar.x = 29;
    game.hotelCar.z = 158;
    game.hotelCar.heading = Math.PI;
    game.hotelCar.syncMesh(0);
    game.enterCar(game.hotelCar);
    game.player.cash = 3120;
    missions.startMission(4);
    // The beacon belongs over the bank's front door for this shot.
    game.effects.setBeacon(29, 145, 0xffd800);
    missions.marker = { x: 29, z: 145 };
    game.combat.spawnEnemy('guard', 20, 145);
    game.combat.spawnEnemy('guard', 38, 145);
    game.combat.spawnEnemy('guard', 29, 138);
    game.cam.yaw = 0;
    game.cam.pitch = 0.3;
    game.cam.targetDistance = 14;
  } else if (name === 'city') {
    // A high vista over downtown at golden hour, HUD and minimap visible.
    game.player.teleport(-58, 116);
    game.player.cash = 1875;
    missions.startMission(0);
    game.vistaMode = true;
    game.cam.setVista();
  } else {
    // Cover: the getaway, frozen mid-chase. The red sports car sits on the
    // avenue with police cars fore and aft, wanted level 3, the mission
    // objective live — a still frame of a chase in progress.
    game.hotelCar.x = 29;
    game.hotelCar.z = 110;
    game.hotelCar.heading = Math.PI;
    game.hotelCar.syncMesh(0);
    game.enterCar(game.hotelCar);
    game.player.cash = 4320;
    missions.startMission(2);
    missions.stepIndex = 2;
    missions.startStep();
    wanted.setLevel(3);
    // Hold off the police manager's own spawns for this shot; the two
    // staged patrol cars below are the chase.
    game.police.spawnTimer = 1e9;
    const tail = game.traffic.spawnParked('police', 34, 124, Math.PI);
    tail.isPolice = true;
    const roadblock = game.traffic.spawnParked('police', 22, 94, Math.PI);
    roadblock.isPolice = true;
    game.cam.yaw = 0.3;
    game.cam.pitch = 0.3;
    game.cam.targetDistance = 14;
  }
  // Clear the mission briefing toast so it does not cover the frame.
  game.drainEvents();
  game.hud.showMessage('', 0.01);
}
