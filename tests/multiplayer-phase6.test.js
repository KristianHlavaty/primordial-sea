import { GameRuntime } from '../src/runtime/GameRuntime.js';
import { ComponentTypes as C } from '../src/engine/components/componentTypes.js';
import { GameEvents } from '../src/engine/events.js';
import { mpBroadcast, mpMinimap, mpRoster } from '../src/engine/mp.js';
import {
  ComponentSnapshotSchemas,
  LEGACY_PROTOCOL_VERSION,
  MULTIPLAYER_PROTOCOL_VERSION,
  MULTIPLAYER_SCHEMA,
  MultiplayerPacketKinds as K,
  adaptPacketToVersion,
  decodeMultiplayerPacket,
  encodeMultiplayerPacket,
  isTransientWirePacket,
  negotiateProtocol,
  readyPacket,
} from '../src/engine/net/ComponentSnapshotProtocol.js';
import { MAPS } from '../src/data/maps.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const equal = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`);
  }
};
const assert = (value, message) => { if (!value) throw new Error(message); };

const room = {
  map: 'sea_shallows', tier: 0, era: 0, fantasy: false,
  evolution: true, bosses: true, mapTransitions: true,
  items: true, funItems: true, cheats: true,
};
const roster = {
  1: { species: 'protocell', name: 'Host', color: '#58e8bc' },
  2: { species: 'protocell', name: 'Client', color: '#74c9ff' },
};

const makeRuntime = async () => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const runtime = new GameRuntime(canvas, { autoStartClock: false, attachInputHandlers: false });
  await runtime.ready;
  return { runtime, canvas };
};

const makePair = async (roomOptions = room) => {
  const hostFixture = await makeRuntime(), clientFixture = await makeRuntime();
  const hostOut = [], clientOut = [];
  const hostLobby = {
    raw: packet => hostOut.push(packet),
    rawTransient: packet => hostOut.push(packet),
  };
  const clientLobby = {
    raw: packet => clientOut.push(packet),
    rawTransient: packet => clientOut.push(packet),
  };
  hostFixture.runtime.startMpHost({
    room: roomOptions, profile: { name: 'Host', color: '#58e8bc' },
    lobby: hostLobby, selfConn: 1, roster,
  });
  clientFixture.runtime.startMpClient({
    room: roomOptions, profile: { name: 'Client', color: '#74c9ff' },
    lobby: clientLobby, selfConn: 2, hostConn: 1, roster,
  });
  const deliverClient = () => {
    while (clientOut.length) {
      const packet = clientOut.shift();
      hostFixture.runtime.receiveNetworkPacket(2, packet.data);
    }
  };
  const deliverHost = () => {
    while (hostOut.length) {
      const packet = hostOut.shift();
      if (packet.to == null || String(packet.to) === '2') clientFixture.runtime.receiveNetworkPacket(1, packet.data);
    }
  };
  const destroy = () => {
    hostFixture.runtime.destroy(); clientFixture.runtime.destroy();
    hostFixture.canvas.remove(); clientFixture.canvas.remove();
  };
  return {
    host: hostFixture.runtime, client: clientFixture.runtime,
    hostOut, clientOut, deliverClient, deliverHost, destroy,
  };
};

const nextSnapshot = pair => {
  pair.host.engine.mp.sendAcc = 1;
  mpBroadcast(pair.host.engine, 0);
  const index = pair.hostOut.findIndex(packet => packet.data?.k === 'S');
  if (index < 0) throw new Error('Host emitted no snapshot');
  return pair.hostOut.splice(index, 1)[0].data;
};

test('Version adapters preserve compact packets and publish explicit component schemas', () => {
  const legacy = {
    k: 'S', q: 7, map: 'sea_shallows',
    players: [{ c: 1, s: 'protocell', x: 10, y: 20, a: 0, hp: 45, mhp: 45, lv: 1, xp: 0 }],
    npcs: [], food: [], dynamicWebs: [], worldItems: [], itemProjectiles: [], vehicles: [],
    rosterPlayers: [], bossesDefeated: [],
  };
  const current = adaptPacketToVersion(legacy, MULTIPLAYER_PROTOCOL_VERSION);
  equal([current.pv, current.ps], [2, MULTIPLAYER_SCHEMA]);
  const decoded = decodeMultiplayerPacket(current);
  equal([decoded.kind, decoded.version, decoded.data.q], [K.SNAPSHOT, 2, 7]);
  equal(adaptPacketToVersion(current, LEGACY_PROTOCOL_VERSION), legacy);
  const overhead = JSON.stringify(current).length - JSON.stringify(legacy).length;
  assert(overhead <= 24, `Version marker added ${overhead} bytes`);
  equal(ComponentSnapshotSchemas.snapshot.collections.players.transform, ['x', 'y', 'a']);
  equal(ComponentSnapshotSchemas.snapshot.collections.players.inventory, ['it']);
  equal(ComponentSnapshotSchemas.snapshot.collections.vehicles.vehicle.includes('oc'), true);
  equal([isTransientWirePacket(current), isTransientWirePacket({ k: 'I' }), isTransientWirePacket({ k: 'K' })], [true, true, false]);
});

test('Ready negotiation supports current and legacy browsers in the same host', async () => {
  equal(negotiateProtocol(readyPacket()), MULTIPLAYER_PROTOCOL_VERSION);
  equal(negotiateProtocol({ k: 'ready' }), LEGACY_PROTOCOL_VERSION);
  const hostFixture = await makeRuntime(), outgoing = [];
  const mixedRoster = {
    ...roster,
    3: { species: 'protocell', name: 'Current', color: '#f7c66b' },
  };
  hostFixture.runtime.startMpHost({
    room, profile: { name: 'Host', color: '#58e8bc' },
    lobby: { raw: packet => outgoing.push(packet), rawTransient: packet => outgoing.push(packet) },
    selfConn: 1, roster: mixedRoster,
  });
  hostFixture.runtime.receiveNetworkPacket(2, { k: 'ready' });
  hostFixture.runtime.receiveNetworkPacket(3, readyPacket());
  const legacyWorld = outgoing.find(packet => packet.to === 2)?.data;
  const currentWorld = outgoing.find(packet => packet.to === 3)?.data;
  equal([legacyWorld.k, legacyWorld.pv, hostFixture.runtime.engine.mp.peerProtocols.get('2')], ['W', undefined, 1]);
  equal([currentWorld.k, currentWorld.pv, currentWorld.ps, hostFixture.runtime.engine.mp.peerProtocols.get('3')], ['W', 2, MULTIPLAYER_SCHEMA, 2]);
  outgoing.length = 0;
  const adapter = hostFixture.runtime.componentRegistry, originalSync = adapter.sync.bind(adapter);
  let extraProjections = 0;
  adapter.sync = engine => { extraProjections++; return originalSync(engine); };
  hostFixture.runtime.engine.mp.sendAcc = 1;
  mpBroadcast(hostFixture.runtime.engine, 0);
  const legacySnapshot = outgoing.find(packet => packet.to === 2 && packet.data.k === 'S')?.data;
  const currentSnapshot = outgoing.find(packet => packet.to === 3 && packet.data.k === 'S')?.data;
  equal([legacySnapshot.pv, currentSnapshot.pv, currentSnapshot.ps], [undefined, 2, MULTIPLAYER_SCHEMA]);
  equal(extraProjections, 0, 'Broadcast added a per-recipient component projection');
  hostFixture.runtime.destroy(); hostFixture.canvas.remove();
});

test('Host/client settings survive both disabled and fully enabled room profiles', async () => {
  const keys = ['fantasy', 'evolution', 'bosses', 'mapTransitions', 'items', 'funItems', 'cheats'];
  for (const enabled of [false, true]) {
    const options = {
      ...room,
      fantasy: enabled, evolution: enabled, bosses: enabled,
      mapTransitions: enabled, items: enabled, funItems: enabled, cheats: enabled,
    };
    const pair = await makePair(options);
    pair.deliverClient(); pair.deliverHost();
    equal(keys.map(key => pair.host.engine.mp[key]), keys.map(() => enabled));
    equal(keys.map(key => pair.client.engine.mp[key]), keys.map(() => enabled));
    pair.destroy();
  }
});

test('Synthetic host/client relay projects component authority and replica components', async () => {
  const pair = await makePair(), negotiated = [], applied = [];
  pair.client.events.subscribe(GameEvents.NET_PROTOCOL_NEGOTIATED, event => negotiated.push(event.version));
  pair.client.events.subscribe(GameEvents.NET_SNAPSHOT_APPLIED, event => applied.push(event));
  pair.deliverClient(); pair.deliverHost();
  equal([pair.client.engine.mp.gotInit, pair.host.engine.mp.peerProtocols.get('2')], [true, 2]);

  const remote = pair.host.engine.remotePlayers[0];
  pair.host.componentRegistry.sync(pair.host.engine);
  const transform = pair.host.componentRegistry.componentFor(remote, C.TRANSFORM);
  const health = pair.host.componentRegistry.componentFor(remote, C.HEALTH);
  const experience = pair.host.componentRegistry.componentFor(remote, C.EXPERIENCE);
  const inventory = pair.host.componentRegistry.componentFor(remote, C.INVENTORY);
  const respawn = pair.host.componentRegistry.componentFor(remote, C.RESPAWN);
  const combat = pair.host.componentRegistry.componentFor(remote, C.COMBAT);
  const pilot = pair.host.componentRegistry.componentFor(remote, C.VEHICLE_PILOT);
  transform.x = 1234; transform.y = 987; health.hp = 31; experience.level = 4;
  inventory.items = [{ id: 'bone_club', uses: 3, cd: .4 }, null, null];
  respawn.deadT = 2; combat.kills = 5;
  pilot.vehicleType = 'submarine'; pilot.vehicleNetId = 900;
  remote.mpEvolveChoices = ['arthropod_larva'];
  pair.host.engine.worldItems.push({ netId: 700, type: 'bone_club', x: 300, y: 400, uses: 2, radius: 18, pickupDelay: 0 });
  pair.host.engine.itemProjectiles.push({
    netId: 800, type: 'fossil_spear', visual: 'projectile', x: 350, y: 450,
    angle: .5, radius: 8, life: 1, maxLife: 1.3, length: 0, spread: 0,
    color: '#fff', seed: 3, armed: false,
  });
  pair.host.engine.vehicles.push({
    netId: 900, type: 'submarine', x: 500, y: 600, angle: .2,
    radius: 48, hp: 300, maxHp: 320, weaponCd: .5,
    occupantConn: 2, hurt: 0, shotSide: -1, timeLeft: 25,
  });
  pair.host.componentRegistry.sync(pair.host.engine);

  const snapshot = nextSnapshot(pair);
  equal([snapshot.pv, snapshot.ps, snapshot.map], [2, MULTIPLAYER_SCHEMA, 'sea_shallows']);
  equal(
    JSON.stringify(snapshot).length - JSON.stringify(adaptPacketToVersion(snapshot, 1)).length <= 24,
    true,
    'Real snapshot version overhead exceeded the compact marker budget',
  );
  assert(snapshot.worldItems.some(item => item.n === 700), 'World item component was omitted');
  assert(snapshot.itemProjectiles.some(projectile => projectile.n === 800), 'Projectile component was omitted');
  assert(snapshot.vehicles.some(vehicle => vehicle.n === 900 && vehicle.oc === 2), 'Vehicle component was omitted');
  pair.client.receiveNetworkPacket(1, snapshot);
  pair.client.componentRegistry.sync(pair.client.engine);
  const replica = pair.client.componentRegistry.componentFor(pair.client.engine.player, C.NETWORK_REPLICA);
  equal(
    [pair.client.engine.player.gx, pair.client.engine.player.gy, pair.client.engine.player.hp, pair.client.engine.player.level,
      pair.client.engine.player.items[0].id, pair.client.engine.player.deadT, pair.client.engine.player.mpEvolveChoices[0],
      pair.client.engine.player.vehicleType],
    [1234, 987, 31, 4, 'bone_club', 2, 'arthropod_larva', 'submarine'],
  );
  equal([
    pair.client.engine.worldItems.some(item => item.netId === 700),
    pair.client.engine.itemProjectiles.some(projectile => projectile.netId === 800),
    pair.client.engine.vehicles.some(vehicle => vehicle.netId === 900 && vehicle.occupantConn === 2),
  ], [true, true, true]);
  equal([replica.gx, replica.gy, replica.snapshotSeq], [1234, 987, snapshot.q]);
  equal([applied.length, applied[0].sequence], [1, snapshot.q]);

  const scoreboard = mpRoster(pair.client.engine);
  const clientRow = scoreboard.find(player => String(player.connId) === '2');
  equal([clientRow.level, clientRow.kills, clientRow.dead, clientRow.mapId], [4, 5, true, 'sea_shallows']);
  const marker = mpMinimap(pair.client.engine).players.find(player => player.self);
  equal([marker.dead, Math.round(marker.x), Math.round(marker.y)], [true, Math.round(1234 / pair.client.engine.W * 100), Math.round(987 / pair.client.engine.H * 100)]);
  pair.client.receiveNetworkPacket(1, encodeMultiplayerPacket(K.FEED, { text: 'Client was eaten', color: '#f99' }));
  equal(pair.client.engine.mp.feed.at(-1).text, 'Client was eaten');
  pair.destroy();
});

test('Input and snapshot ordering reject stale packets without rolling state back', async () => {
  const pair = await makePair(), drops = [];
  pair.host.events.subscribe(GameEvents.NET_PACKET_DROPPED, event => drops.push(event.reason));
  pair.client.events.subscribe(GameEvents.NET_PACKET_DROPPED, event => drops.push(event.reason));
  pair.deliverClient(); pair.deliverHost();
  const remote = pair.host.engine.remotePlayers[0];
  pair.host.receiveNetworkPacket(2, encodeMultiplayerPacket(K.INPUT, { q: 8, tx: 1, ty: 0, m: 1, b: 0 }));
  pair.host.componentRegistry.sync(pair.host.engine);
  equal([
    pair.host.componentRegistry.componentFor(remote, C.REMOTE_INPUT).state.sequence,
    pair.host.componentRegistry.componentFor(remote, C.REMOTE_INPUT).state.tx,
  ], [8, 1]);
  pair.host.receiveNetworkPacket(2, encodeMultiplayerPacket(K.INPUT, { q: 7, tx: -1, ty: 0, m: 1, b: 0 }));
  equal(pair.host.componentRegistry.componentFor(remote, C.REMOTE_INPUT).state.tx, 1);

  const transform = pair.host.componentRegistry.componentFor(remote, C.TRANSFORM);
  transform.x = 500;
  const older = nextSnapshot(pair);
  transform.x = 900;
  const newer = nextSnapshot(pair);
  pair.client.receiveNetworkPacket(1, newer);
  pair.client.receiveNetworkPacket(1, older);
  equal([pair.client.engine.player.gx, pair.client.engine.mp.lastSnapshotSeq], [900, newer.q]);
  equal(drops.sort(), ['stale-input', 'stale-sequence']);
  pair.destroy();
});

test('World changes cover every map and discard delayed snapshots from the previous map', async () => {
  const fixture = await makeRuntime(), runtime = fixture.runtime, drops = [];
  runtime.startMpClient({
    room, profile: { name: 'Client', color: '#74c9ff' },
    lobby: null, selfConn: 2, hostConn: 1, roster,
  });
  runtime.events.subscribe(GameEvents.NET_PACKET_DROPPED, event => drops.push(event.reason));
  let sequence = 0;
  for (const [mapId, map] of Object.entries(MAPS)) {
    runtime.receiveNetworkPacket(1, encodeMultiplayerPacket(K.WORLD_INIT, {
      map: mapId, era: 1, W: map.W, H: map.H, theme: map.theme,
      obstacles: [], plants: [], webs: [],
    }));
    runtime.receiveNetworkPacket(1, encodeMultiplayerPacket(K.SNAPSHOT, {
      q: sequence++, map: mapId, players: [], npcs: [], food: [],
      dynamicWebs: [], worldItems: [], itemProjectiles: [], vehicles: [],
      rosterPlayers: [], bossesDefeated: [],
    }));
    equal(runtime.engine.mapId, mapId);
  }
  const currentMap = runtime.engine.mapId;
  const delayedMap = currentMap === 'sea_shallows'
    ? Object.keys(MAPS).find(mapId => mapId !== currentMap)
    : 'sea_shallows';
  runtime.receiveNetworkPacket(1, encodeMultiplayerPacket(K.SNAPSHOT, {
    q: sequence + 10, map: delayedMap, players: [], npcs: [], food: [],
  }));
  equal([runtime.engine.mapId, drops.includes('wrong-map')], [currentMap, true]);
  runtime.destroy(); fixture.canvas.remove();
});

test('Roster reconnect cleanup and background host stepping keep the session live', async () => {
  const pair = await makePair();
  pair.deliverClient(); pair.deliverHost();
  const departed = pair.host.engine.remotePlayers[0];
  pair.host.setRoster({ 1: roster[1] });
  pair.host.componentRegistry.sync(pair.host.engine);
  equal([
    pair.host.engine.remotePlayers.length,
    pair.host.componentRegistry.entityFor(departed),
    pair.host.engine.mp.peerProtocols.has('2'),
  ], [0, null, false]);

  pair.host.setRoster({ 1: roster[1], 3: { species: 'protocell', name: 'Reconnect', color: '#f7c66b' } });
  pair.host.receiveNetworkPacket(3, readyPacket());
  equal([
    pair.host.engine.remotePlayers.length,
    pair.host.engine.remotePlayers[0].connId,
    pair.host.engine.mp.peerProtocols.get('3'),
  ], [1, 3, 2]);

  pair.hostOut.length = 0;
  pair.host.engine.setBackgrounded(true);
  pair.host.step(.05);
  assert(pair.hostOut.some(packet => packet.data?.k === 'S'), 'Background host did not continue snapshot cadence');
  pair.destroy();
});

const results = document.getElementById('results');
let passed = 0;
for (const { name, run } of tests) {
  try { await run(); passed++; results.insertAdjacentHTML('beforeend', `<span class="pass">PASS</span> ${name}\n`); }
  catch (error) { results.insertAdjacentHTML('beforeend', `<span class="fail">FAIL</span> ${name}\n${error.stack || error}\n`); }
}
results.firstChild?.remove();
results.insertAdjacentHTML('beforeend', `\n${passed}/${tests.length} passed`);
document.title = passed === tests.length ? 'PASS - Phase 6 tests' : 'FAIL - Phase 6 tests';
document.body.dataset.tests = passed === tests.length ? 'pass' : 'fail';
