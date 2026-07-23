/* Phase 6 multiplayer wire boundary.

   Version 1 is the original compact packet format assembled directly in
   engine/mp.js. Version 2 deliberately retains those short wire keys so old
   browsers can still read host snapshots. The difference is architectural:
   packets are now described by explicit component projections, carry a
   protocol marker, and pass through this adapter before simulation code sees
   them. This avoids sending a second, duplicate component envelope at 20 Hz. */

export const LEGACY_PROTOCOL_VERSION = 1;
export const MULTIPLAYER_PROTOCOL_VERSION = 2;
export const MULTIPLAYER_SCHEMA = 'ecs-1';
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([
  MULTIPLAYER_PROTOCOL_VERSION,
  LEGACY_PROTOCOL_VERSION,
]);

export const MultiplayerPacketKinds = Object.freeze({
  SNAPSHOT: 'snapshot',
  WORLD_INIT: 'world-init',
  FEED: 'feed',
  INPUT: 'input',
  ABILITY: 'ability',
  EVOLUTION: 'evolution',
  CHEAT: 'cheat',
  ITEM_USE: 'item-use',
  ITEM_DROP: 'item-drop',
  VEHICLE: 'vehicle',
  READY: 'ready',
});

const WIRE_TO_KIND = Object.freeze({
  S: MultiplayerPacketKinds.SNAPSHOT,
  W: MultiplayerPacketKinds.WORLD_INIT,
  K: MultiplayerPacketKinds.FEED,
  I: MultiplayerPacketKinds.INPUT,
  A: MultiplayerPacketKinds.ABILITY,
  E: MultiplayerPacketKinds.EVOLUTION,
  C: MultiplayerPacketKinds.CHEAT,
  U: MultiplayerPacketKinds.ITEM_USE,
  D: MultiplayerPacketKinds.ITEM_DROP,
  V: MultiplayerPacketKinds.VEHICLE,
  ready: MultiplayerPacketKinds.READY,
});
const KIND_TO_WIRE = Object.freeze(Object.fromEntries(
  Object.entries(WIRE_TO_KIND).map(([wire, kind]) => [kind, wire]),
));

/* Each list is the canonical component projection carried by one compact
   entity record. The field catalog is executable documentation used by tests
   and protocol tooling; additions require an intentional schema change. */
export const ComponentSnapshotSchemas = Object.freeze({
  snapshot: Object.freeze({
    required: Object.freeze(['k', 'q', 'players', 'npcs', 'food']),
    collections: Object.freeze({
      players: Object.freeze({
        identity: Object.freeze(['c', 's']),
        transform: Object.freeze(['x', 'y', 'a']),
        health: Object.freeze(['hp', 'mhp']),
        experience: Object.freeze(['lv', 'xp']),
        combat: Object.freeze(['b', 'k', 'ca', 'cq', 'ct', 'grt', 'grx', 'gry', 'pw']),
        shield: Object.freeze(['sh', 'sm', 'ff']),
        abilityState: Object.freeze(['ab']),
        respawn: Object.freeze(['d']),
        evolution: Object.freeze(['ev']),
        inventory: Object.freeze(['it']),
        vehiclePilot: Object.freeze(['vh', 'vt']),
        networkState: Object.freeze(['iv', 'sq', 'sk']),
      }),
      npcs: Object.freeze({
        networkIdentity: Object.freeze(['n', 'k']),
        transform: Object.freeze(['x', 'y', 'a']),
        health: Object.freeze(['hp', 'mhp']),
        collider: Object.freeze(['r']),
        experience: Object.freeze(['lv']),
        combat: Object.freeze(['st', 'mo', 'ar', 'vu', 'vs', 'vm']),
        boss: Object.freeze(['bk', 'h', 'e', 'ps']),
        telegraph: Object.freeze(['tg']),
        renderable: Object.freeze(['pl', 'co', 'lo', 'ht']),
      }),
      food: Object.freeze({
        networkIdentity: Object.freeze(['n']),
        transform: Object.freeze(['x', 'y']),
        food: Object.freeze(['m']),
      }),
      dynamicWebs: Object.freeze({
        transform: Object.freeze(['x', 'y', 'angle']),
        collider: Object.freeze(['r']),
        lifetime: Object.freeze(['life']),
        renderable: Object.freeze(['abilityWeb']),
      }),
      worldItems: Object.freeze({
        networkIdentity: Object.freeze(['n']),
        item: Object.freeze(['t', 'u']),
        transform: Object.freeze(['x', 'y']),
      }),
      itemProjectiles: Object.freeze({
        networkIdentity: Object.freeze(['n']),
        projectile: Object.freeze(['t', 'v', 'r', 'l', 'ml', 'len', 'sp', 'c', 'sd', 'ar', 'at', 'am', 'tr']),
        transform: Object.freeze(['x', 'y', 'a']),
      }),
      vehicles: Object.freeze({
        networkIdentity: Object.freeze(['n']),
        vehicle: Object.freeze(['t', 'hp', 'mhp', 'r', 'oc', 'cd', 'tm']),
        transform: Object.freeze(['x', 'y', 'a']),
      }),
    }),
    projections: Object.freeze({
      roster: Object.freeze(['rosterPlayers']),
      map: Object.freeze(['map', 'edgeC', 'edgeName']),
      run: Object.freeze(['perks', 'bossesDefeated']),
    }),
  }),
  worldInit: Object.freeze({
    world: Object.freeze(['map', 'era', 'W', 'H', 'theme']),
    staticCollections: Object.freeze(['obstacles', 'plants', 'webs']),
  }),
  input: Object.freeze({
    remoteInput: Object.freeze(['q', 'tx', 'ty', 'm', 'b']),
  }),
});

const arraysForSnapshot = Object.freeze([
  'players', 'npcs', 'food', 'dynamicWebs', 'worldItems', 'itemProjectiles',
  'vehicles', 'rosterPlayers', 'bossesDefeated',
]);
const arraysForWorld = Object.freeze(['obstacles', 'plants', 'webs']);

const versionOf = packet => {
  const version = Number(packet && packet.pv);
  return SUPPORTED_PROTOCOL_VERSIONS.includes(version) ? version : LEGACY_PROTOCOL_VERSION;
};

const withVersion = (packet, version, includeSchema = false) => {
  const selected = SUPPORTED_PROTOCOL_VERSIONS.includes(version) ? version : LEGACY_PROTOCOL_VERSION;
  const { pv: _pv, ps: _ps, ...wire } = packet;
  if (selected === LEGACY_PROTOCOL_VERSION) return wire;
  return {
    ...wire,
    pv: selected,
    ...(includeSchema ? { ps: MULTIPLAYER_SCHEMA } : {}),
  };
};

const normalizeSnapshot = packet => {
  const normalized = { ...packet };
  for (const field of arraysForSnapshot) if (!Array.isArray(normalized[field])) normalized[field] = [];
  if (!Number.isFinite(normalized.q)) normalized.q = null;
  return normalized;
};

const normalizeWorldInit = packet => {
  const normalized = { ...packet };
  for (const field of arraysForWorld) if (!Array.isArray(normalized[field])) normalized[field] = [];
  return normalized;
};

export function decodeMultiplayerPacket(packet) {
  if (!packet || typeof packet !== 'object') return null;
  const wireKind = typeof packet.k === 'string' ? packet.k : KIND_TO_WIRE[packet.kind];
  const kind = WIRE_TO_KIND[wireKind];
  if (!kind) return null;
  const version = versionOf(packet);
  let data = packet;
  if (kind === MultiplayerPacketKinds.SNAPSHOT) data = normalizeSnapshot(packet);
  else if (kind === MultiplayerPacketKinds.WORLD_INIT) data = normalizeWorldInit(packet);
  return {
    kind,
    wireKind,
    version,
    schema: packet.ps || (version === LEGACY_PROTOCOL_VERSION ? 'legacy-1' : MULTIPLAYER_SCHEMA),
    data,
  };
}

export function encodeMultiplayerPacket(kind, payload = {}, version = MULTIPLAYER_PROTOCOL_VERSION) {
  const wireKind = KIND_TO_WIRE[kind];
  if (!wireKind) throw new TypeError(`Unknown multiplayer packet kind: ${kind}`);
  return withVersion(
    { k: wireKind, ...payload },
    version,
    kind === MultiplayerPacketKinds.SNAPSHOT || kind === MultiplayerPacketKinds.WORLD_INIT,
  );
}

export function adaptPacketToVersion(packet, version) {
  const decoded = decodeMultiplayerPacket(packet);
  if (!decoded) return null;
  return withVersion(
    decoded.data,
    version,
    decoded.kind === MultiplayerPacketKinds.SNAPSHOT || decoded.kind === MultiplayerPacketKinds.WORLD_INIT,
  );
}

export function readyPacket(version = MULTIPLAYER_PROTOCOL_VERSION) {
  return encodeMultiplayerPacket(MultiplayerPacketKinds.READY, {
    pvs: SUPPORTED_PROTOCOL_VERSIONS,
  }, version);
}

export function negotiateProtocol(packet) {
  const offered = Array.isArray(packet && packet.pvs)
    ? packet.pvs.map(Number)
    : [Number(packet && packet.pv) || LEGACY_PROTOCOL_VERSION];
  return SUPPORTED_PROTOCOL_VERSIONS.find(version => offered.includes(version))
    || LEGACY_PROTOCOL_VERSION;
}

export function isNewerSnapshotSequence(sequence, previous) {
  if (!Number.isFinite(sequence)) return previous == null || previous < 0;
  return previous == null || previous < 0 || sequence > previous;
}

export function isTransientWirePacket(packet) {
  const decoded = decodeMultiplayerPacket(packet);
  return !!decoded && (
    decoded.kind === MultiplayerPacketKinds.SNAPSHOT
    || decoded.kind === MultiplayerPacketKinds.INPUT
  );
}
