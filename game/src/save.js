// Save and load: the player's cash, story progress, collectibles and
// position live in localStorage so a session can continue later.
const SAVE_KEY = 'solmar-city-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    /* storage unavailable */
  }
}

export function buildSaveData(game) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    cash: Math.floor(game.player.cash),
    health: Math.round(game.player.health),
    armor: Math.round(game.player.armor),
    weapon: game.player.weapon,
    missionIndex: game.missions.missionIndex,
    storyComplete: game.missions.storyComplete,
    playerX: game.player.x,
    playerZ: game.player.z,
    collectiblesTaken: [...game.collectiblesTaken],
    playTimeSeconds: Math.round(game.playTimeSeconds),
  };
}
