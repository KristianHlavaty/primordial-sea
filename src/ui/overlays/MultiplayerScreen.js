/* Local-network multiplayer lobby.

   The WebSocket lobby is owned by App (so it survives lobby→game); this screen
   just renders its state (`ls`) and calls its actions (`lobby`). You can host a
   game (pick map + tier), join one, pick an animal of the room's tier, and the
   host hits Start to drop everyone into the shared arena. */
import { html, useState, useEffect } from '../react.js';
import { MAPS, STAGES } from '../../data/maps.js';
import { SPECIES, tiersOfStage, speciesOfStageTier } from '../../data/species.js';

/* NPC difficulty for a fixed arena scales with stage + chosen tier. */
const STAGE_ERA_BASE = { sea: 0, devonian: 4, carboniferous: 8 };
const eraFor = (stage, tier) => (STAGE_ERA_BASE[stage] || 0) + (tier - 1);

const MAP_ENTRIES = Object.keys(MAPS)
  .map(id => ({ id, name: MAPS[id].name, stage: MAPS[id].stage }))
  .sort((a, b) => (STAGES[a.stage].order - STAGES[b.stage].order) || a.name.localeCompare(b.name));

const dot = color => html`<span className="pfDot" style=${{ background: color }}></span>`;

/* ---------- host-a-game panel ---------- */
function HostPanel({ profile, onCreate, onCancel }) {
  const [name, setName] = useState((profile ? profile.name : 'Player') + "'s game");
  const [mapId, setMapId] = useState('sea_shallows');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [fantasy, setFantasy] = useState(true);
  const [evolution, setEvolution] = useState(true);
  const [bosses, setBosses] = useState(false);
  const [mapTransitions, setMapTransitions] = useState(false);
  const [cheats, setCheats] = useState(false);
  const stage = MAPS[mapId].stage;
  const tiers = tiersOfStage(stage, fantasy);
  const [tier, setTier] = useState(tiers[0] || 1);
  useEffect(() => { if (!tiers.includes(tier)) setTier(tiers[0] || 1); }, [mapId, fantasy]);   // keep tier valid across stages/settings

  const picks = speciesOfStageTier(stage, tier, fantasy).map(id => SPECIES[id].name);
  const era = eraFor(stage, tier);
  const create = () => onCreate({
    name: name.trim() || (profile.name + "'s game"), map: mapId, mapName: MAPS[mapId].name,
    stage, tier, era, maxPlayers, fantasy, evolution, bosses, mapTransitions, cheats,
  });

  return html`
    <div className="hostPanel">
      <label className="pfLabel">Room name</label>
      <input className="pfInput" type="text" maxLength=${32} value=${name} onInput=${e => setName(e.target.value)}/>

      <label className="pfLabel">Map</label>
      <div className="hpMaps">
        ${MAP_ENTRIES.map(m => html`<button key=${m.id} className=${'hpMap' + (m.id === mapId ? ' sel' : '')} onClick=${() => setMapId(m.id)}>
          <b>${m.name}</b><small>${STAGES[m.stage].name}</small></button>`)}
      </div>

      <label className="pfLabel">Era / tier — everyone starts as a tier-${tier} animal</label>
      <div className="hpTiers">
        ${tiers.map(t => html`<button key=${t} className=${'hpTier' + (t === tier ? ' sel' : '')} onClick=${() => setTier(t)}>T${t}</button>`)}
      </div>
      <div className="hpPicks">Animals: ${picks.join(' · ')}</div>

      <div className="roomToggles">
        <label className="roomToggle">
          <input type="checkbox" checked=${fantasy} onChange=${e => setFantasy(e.target.checked)}/>
          <span><b>Allow fantasy animals</b><small>Adds speculative animals to the room's map and tier</small></span>
        </label>
        <label className="roomToggle">
          <input type="checkbox" checked=${evolution} onChange=${e => setEvolution(e.target.checked)}/>
          <span><b>Allow evolution within this stage</b><small>Players can progress through the remaining tiers, but cannot enter another stage</small></span>
        </label>
        <label className="roomToggle bossRoomToggle">
          <input type="checkbox" checked=${bosses} onChange=${e => setBosses(e.target.checked)}/>
          <span><b>Enable bosses</b><small>Adds each map's boss encounters and shared permanent rewards</small></span>
        </label>
        <label className="roomToggle mapRoomToggle">
          <input type="checkbox" checked=${mapTransitions} onChange=${e => setMapTransitions(e.target.checked)}/>
          <span><b>Allow travel to adjacent maps</b><small>When a player crosses an edge, the whole room travels to that neighboring map</small></span>
        </label>
        <label className="roomToggle cheatRoomToggle">
          <input type="checkbox" checked=${cheats} onChange=${e => setCheats(e.target.checked)}/>
          <span><b>Enable cheats for testing purposes</b><small>Adds invincibility and level-up controls for every player</small></span>
        </label>
      </div>

      <label className="pfLabel">Max players</label>
      <div className="hpTiers">
        ${[2, 3, 4, 5, 6, 8].map(n => html`<button key=${n} className=${'hpTier' + (n === maxPlayers ? ' sel' : '')} onClick=${() => setMaxPlayers(n)}>${n}</button>`)}
      </div>

      <div className="mpNote" style=${{ marginTop: '12px' }}>Combat is <b>free-for-all</b>. ${mapTransitions ? 'Adjacent-map travel moves the whole room together.' : 'The map and stage stay fixed for the whole match.'}</div>

      <div className="pfActions">
        <button className="stayBtn" onClick=${onCancel}>Cancel</button>
        <button className="bigbtn" onClick=${create}>CREATE GAME</button>
      </div>
    </div>`;
}

/* ---------- room roster (after hosting or joining) ---------- */
function RoomView({ room, connId, onSetSpecies, onLeave, onStart }) {
  const me = room.players.find(p => p.connId === connId);
  const isHost = !!(me && me.isHost);
  const picks = speciesOfStageTier(room.stage, room.tier, !!room.fantasy);
  const enabledOptions = [
    room.fantasy && ['Fantasy animals', 'fantasy'],
    room.evolution && ['Same-stage evolution', 'evolution'],
    room.bosses && ['Bosses', 'bosses'],
    room.mapTransitions && ['Adjacent-map travel', 'maps'],
    room.cheats && ['Testing cheats', 'cheats'],
  ].filter(Boolean);

  return html`
    <div className="roomView">
      <div className="roomInfo">
        <div><b>${room.name}</b></div>
        <div className="roomMeta">${room.mapName} · ${STAGES[room.stage] ? STAGES[room.stage].name : room.stage} · Tier ${room.tier} · ${room.players.length}/${room.maxPlayers} · <span className="ffa">free-for-all</span></div>
        <div className="roomOptions">
          <span className="roomOptionsLabel">Enabled options</span>
          <div className="roomOptionChips">
            ${enabledOptions.length
              ? enabledOptions.map(([label, kind]) => html`<span key=${kind} className=${'roomOptionChip ' + kind}>${label}</span>`)
              : html`<span className="roomOptionNone">Standard fixed-map rules</span>`}
          </div>
        </div>
      </div>

      <div className="roomRoster">
        ${room.players.map(p => html`<div key=${p.connId} className="rosterRow">
          ${dot(p.color)}<span className="rName">${p.name}</span>
          ${p.isHost && html`<span className="hostBadge">HOST</span>`}
          <span className="rSpecies">${p.species && SPECIES[p.species] ? SPECIES[p.species].name : '— choosing —'}</span>
        </div>`)}
      </div>

      <label className="pfLabel">Choose your animal (tier ${room.tier})</label>
      <div className="speciesPick">
        ${picks.map(id => html`<button key=${id} className=${'spBtn ' + SPECIES[id].branch + (me && me.species === id ? ' sel' : '')} onClick=${() => onSetSpecies(id)}>${SPECIES[id].name}</button>`)}
      </div>

      <div className="pfActions">
        <button className="stayBtn" onClick=${onLeave}>Leave</button>
        ${isHost
          ? html`<button className="bigbtn" onClick=${onStart}>START GAME</button>`
          : html`<span className="waitHost">waiting for the host to start…</span>`}
      </div>
    </div>`;
}

/* ---------- screen ---------- */
export function MultiplayerScreen({ profile, lobby, ls, onBack }) {
  const [hosting, setHosting] = useState(false);
  const [addr, setAddr] = useState('');
  const L = lobby;
  const connected = ls.status === 'connected';

  const statusText = ls.room ? ('In “' + ls.room.name + '”')
    : ls.status === 'connected' ? ('Connected · ' + ls.rooms.length + (ls.rooms.length === 1 ? ' game open' : ' games open'))
    : ls.status === 'connecting' ? 'Connecting to host…'
    : ls.status === 'closed' ? 'Disconnected from host.'
    : (ls.error || 'Not connected.');

  const create = opts => { if (L) L.createRoom(opts); setHosting(false); };
  const goToAddress = () => {
    let a = addr.trim(); if (!a) return;
    a = a.replace(/^https?:\/\//i, '').replace(/\/+$/, '');   // drop protocol + any trailing slashes
    if (!/:\d+$/.test(a)) a += ':8899';                        // default to the host port if none given
    location.href = 'http://' + a + '/';
  };

  let body;
  if (ls.room) {
    body = html`<${RoomView} room=${ls.room} connId=${ls.connId}
      onSetSpecies=${id => L && L.setSpecies(id)} onLeave=${() => L && L.leaveRoom()} onStart=${() => L && L.start()}/>`;
  } else if (hosting) {
    body = html`<${HostPanel} profile=${profile} onCreate=${create} onCancel=${() => setHosting(false)}/>`;
  } else {
    body = html`
      <${'div'}>
        <div className="mpRooms">
          <div className="mpRoomsHead"><b>Games on this network</b><span>${ls.rooms.length} open</span></div>
          ${ls.rooms.length === 0
            ? html`<div className="mpEmpty">${connected ? 'No games yet. Host one below and share your address, or wait for a friend to host.' : 'Connecting…'}</div>`
            : ls.rooms.map(r => html`<div key=${r.id} className="roomRow">
                ${dot(r.hostColor)}
                <div className="rrMain"><b>${r.name}</b><small>${r.hostName} · ${r.mapName} · Tier ${r.tier}${r.fantasy ? ' · Fantasy animals' : ''}${r.evolution ? ' · Evolution' : ''}${r.bosses ? ' · Bosses' : ''}${r.mapTransitions ? ' · Map travel' : ''}${r.cheats ? ' · Cheats' : ''}</small></div>
                <span className="rrCount">${r.count}/${r.maxPlayers}</span>
                <button className="rrJoin" disabled=${r.count >= r.maxPlayers} onClick=${() => L && L.joinRoom(r.id)}>${r.count >= r.maxPlayers ? 'Full' : 'Join'}</button>
              </div>`)}
        </div>

        <div className="mpActions">
          <button className="bigbtn" disabled=${!connected} onClick=${() => setHosting(true)}>HOST A GAME</button>
        </div>

        <div className="mpJoinAddr">
          <span>On a different host?</span>
          <input className="pfInput addrInput" placeholder="192.168.1.23:8899" value=${addr}
            onInput=${e => setAddr(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') goToAddress(); }}/>
          <button className="stayBtn" disabled=${!addr.trim()} onClick=${goToAddress}>Go</button>
        </div>
      <//>`;
  }

  return html`
    <div className="scrim">
      <div className="card mpCard">
        <div className="mpHead">
          <button className="mpBack" onClick=${ls.room ? (() => L && L.leaveRoom()) : onBack}>‹ ${ls.room ? 'Leave' : 'Menu'}</button>
          <div className="title" style=${{ fontSize: '24px' }}>LOCAL MULTIPLAYER</div>
          <div className="mpMe">${dot(profile ? profile.color : '#5ec8f2')}<b style=${{ color: profile ? profile.color : '#5ec8f2' }}>${profile ? profile.name : 'Nameless'}</b></div>
        </div>

        <div className=${'mpStatus' + (connected ? '' : ' off')}><span className="mpDot"></span> ${statusText}</div>
        ${ls.error && !ls.room && html`<div className="mpErr">${ls.error}</div>`}

        <div className="mpBody">${body}</div>
      </div>
    </div>`;
}
