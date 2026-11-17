// Solmar City — configuration: city layout, tuning, story missions, names.
// Everything here is original: a fictional sun-soaked coastal city, its people
// and its story. Nothing is taken from any commercial game.
export const CITY = {
  blocks: 9, // blocks per side
  pitch: 58, // block + road width
  road: 14, // road width
  size: 9 * 58, // total city span in world units
  seed: 7,
};

export const TUNE = {
  playerWalkSpeed: 7,
  playerRunSpeed: 11,
  playerJump: 8.5,
  gravity: 24,
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 46,
  carMaxReverse: 14,
  carSteer: 1.9,
  carGrip: 6.5,
  trafficCount: 16,
  pedCount: 26,
  policeResponseTime: 2.5,
  wantedDecaySeconds: 25,
  bulletDamage: 34,
  guardHealth: 100,
  copHealth: 80,
  playerHealth: 100,
};

export const PLAYER_START = { x: -40, z: 120 };

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, mag: 12, reserve: 9999, fireRate: 0.22, range: 90, spread: 0.012, auto: false },
  smg: { name: 'SMG', damage: 18, mag: 32, reserve: 9999, fireRate: 0.085, range: 70, spread: 0.03, auto: true },
  shotgun: { name: 'Shotgun', damage: 16, mag: 6, reserve: 9999, fireRate: 0.8, range: 32, spread: 0.09, pellets: 7, auto: false },
};

// Story: Jax Marlowe, a wheelman new to Solmar City, works his way up from
// Lena Cruz's garage crew to the top of the city's underworld.
export const STORY = {
  title: 'SOLMAR CITY',
  subtitle: 'Sun, salt air, and stolen cars.',
  intro:
    'Jax Marlowe just rolled into Solmar City with an empty wallet and a fast right foot. ' +
    'Lena Cruz runs a garage on Marina Row and always needs a driver who asks no questions. ' +
    'Do her jobs, earn her trust, and take the city — one getaway at a time.',
  characters: {
    lena: 'Lena Cruz — garage owner, fixer, the only honest crook in Solmar.',
    eddie: 'Big Eddie — a loudmouth with a louder car and a debt to collect.',
    tavares: 'Commissioner Tavares — owns the police, the port, and half the skyline.',
  },
};

// Mission steps. Types: goto, talk, enterCar, driveTo, collect, kill, hold, race, escape.
export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Job',
    briefing:
      'Lena needs a package moved across town. Meet her at the garage on Marina Row, then drive the package to the drop-off at the docks. Keep it clean.',
    reward: 500,
    steps: [
      { type: 'goto', label: 'Meet Lena at the garage', pos: [-87, 145], radius: 6 },
      { type: 'talk', label: 'Talk to Lena (E)', npc: 'lena', pos: [-87, 145], radius: 5 },
      { type: 'enterCar', label: 'Get in a car', any: true },
      { type: 'driveTo', label: 'Drive the package to the docks', pos: [203, -29], radius: 10 },
    ],
  },
  {
    id: 'm2',
    name: 'Hot Wheels',
    briefing:
      'A cherry-red sports car is parked outside the Solmar Grand hotel. Steal it and bring it to Lena\'s garage. The owner will call the cops — lose them or outrun them.',
    reward: 900,
    steps: [
      { type: 'goto', label: 'Find the sports car at the Solmar Grand', pos: [145, 29], radius: 8 },
      { type: 'enterCar', label: 'Steal the sports car', carType: 'sports', pos: [145, 29], radius: 6 },
      { type: 'driveTo', label: 'Bring it to Lena\'s garage', pos: [-87, 145], radius: 10, wanted: 2 },
    ],
  },
  {
    id: 'm3',
    name: 'Getaway Driver',
    briefing:
      'Big Eddie just "borrowed" a briefcase from the casino. Pick him up outside the casino, then hit all five checkpoints and lose the cops before you reach the safehouse.',
    reward: 1500,
    steps: [
      { type: 'goto', label: 'Pick up Big Eddie at the casino', pos: [87, -145], radius: 8 },
      { type: 'talk', label: 'Talk to Eddie (E)', npc: 'eddie', pos: [87, -145], radius: 5 },
      { type: 'race', label: 'Hit the checkpoints and lose the cops', gates: [[29, -87], [87, -87], [87, 29], [29, 87], [-87, 87]], wanted: 3 },
      { type: 'driveTo', label: 'Reach the safehouse', pos: [-203, 203], radius: 10 },
    ],
  },
  {
    id: 'm4',
    name: 'The Collector',
    briefing:
      'Lena stashed six cash drops around downtown before the cops swept her garage. Grab them all on foot — the patrols are out, so stay sharp and stay moving.',
    reward: 1800,
    steps: [
      { type: 'collect', label: 'Collect the cash drops (0/6)', count: 6, wanted: 2 },
    ],
  },
  {
    id: 'm5',
    name: 'Bank Job',
    briefing:
      'The Solmar National Bank keeps a fortune in its vault and a skeleton crew after midnight. Get in, grab the cash, and get out. The whole city will be looking for you.',
    reward: 3500,
    steps: [
      { type: 'driveTo', label: 'Drive to the Solmar National Bank', pos: [29, 87], radius: 10 },
      { type: 'hold', label: 'Crack the vault — hold E', pos: [29, 87], radius: 8, seconds: 6 },
      { type: 'escape', label: 'Escape to the pier safehouse', pos: [-261, -232], radius: 12, wanted: 4 },
    ],
  },
  {
    id: 'm6',
    name: 'King of Solmar',
    briefing:
      'Commissioner Tavares runs this city from his mansion on the hill. Take out his guards, take his ledger, and drive the evidence to the pier. Tonight, Solmar gets a new king.',
    reward: 5000,
    steps: [
      { type: 'driveTo', label: 'Drive to the Tavares mansion', pos: [203, -203], radius: 12 },
      { type: 'kill', label: 'Clear the mansion guards (0/8)', count: 8, wanted: 4 },
      { type: 'enterCar', label: 'Get in the getaway car', any: true },
      { type: 'driveTo', label: 'Deliver the ledger to the pier', pos: [-261, -232], radius: 12 },
    ],
  },
];

export const ACTIVITIES = {
  taxiFareBase: 60,
  taxiFarePerMetre: 0.9,
  raceReward: 800,
  collectibleValue: 150,
  collectibleCount: 24,
  ammoPrice: 50,
  armorPrice: 120,
  healPrice: 80,
  repairPrice: 100,
  bribePrice: 250,
};

export const SHOPS = [
  { id: 'gunstore', name: 'Sunset Arms', kind: 'guns', pos: [58, 145], label: 'Sunset Arms — guns & armor' },
  { id: 'clinic', name: 'Marina Clinic', kind: 'clinic', pos: [-145, -29], label: 'Marina Clinic — patch up' },
  { id: 'garage', name: "Lena's Garage", kind: 'garage', pos: [-87, 145], label: "Lena's Garage — repairs & bribes" },
  { id: 'race', name: 'Beach Race Start', kind: 'race', pos: [-203, 87], label: 'Beach Race — press E to race' },
];

export const WANTED_NAMES = ['', 'One star', 'Two stars', 'Three stars', 'Four stars', 'Five stars'];
