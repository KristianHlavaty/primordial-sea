/* Client side of the lobby. Opens a WebSocket to the host that served this
   page (same origin, at /ws), says hello with the local profile, and keeps a
   small state object in sync with the server's lobby/room messages. It calls
   onState(state) on every change so React can re-render.

   This is transport for the LOBBY only. In-game packet relay (Phase 3) reuses
   the same socket via api.raw({t:'relay', ...}) and the onRelay callback. */

export function createLobby(profile, onState, onRelay) {
  const MAX_TRANSIENT_BUFFER = 256 * 1024;
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  const url = proto + location.host + '/ws';

  const state = { status: 'connecting', connId: null, rooms: [], room: null, error: null };
  const emit = () => onState({ ...state });

  let ws;
  try { ws = new WebSocket(url); }
  catch (e) { state.status = 'error'; state.error = 'Could not reach a host.'; queueMicrotask(emit); return stub(); }

  ws.onopen = () => send({ t: 'hello', profile });   // status flips to 'connected' on welcome
  ws.onclose = () => { if (state.status !== 'error') { state.status = 'closed'; state.room = null; emit(); } };
  ws.onerror = () => { if (state.status === 'connecting') { state.status = 'error'; state.error = 'No host on this address. Is the multiplayer host running?'; emit(); } };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    switch (m.t) {
      case 'welcome': state.status = 'connected'; state.connId = m.connId; state.rooms = m.rooms || []; emit(); break;
      case 'rooms': state.rooms = m.rooms || []; emit(); break;
      case 'joined': state.room = m.room; state.error = null; emit(); break;
      case 'roomUpdate': if (state.room && m.room && m.room.id === state.room.id) { state.room = m.room; emit(); } break;
      case 'left': state.room = null; emit(); break;
      case 'roomClosed': state.room = null; state.error = 'The host closed the game.'; emit(); break;
      case 'error': state.error = m.msg || 'Something went wrong.'; emit(); break;
      case 'relay': if (onRelay) onRelay(m.from, m.data); break;
    }
  };

  function send(o, transient = false) {
    try {
      if (ws && ws.readyState === 1 && (!transient || ws.bufferedAmount < MAX_TRANSIENT_BUFFER)) ws.send(JSON.stringify(o));
    } catch { }
  }

  function stub() { return { getState: () => ({ ...state }), createRoom() { }, joinRoom() { }, setSpecies() { }, leaveRoom() { }, start() { }, raw() { }, rawTransient() { }, close() { } }; }

  queueMicrotask(emit);   // push the initial 'connecting' state to the UI

  return {
    getState: () => ({ ...state }),
    createRoom: opts => send({ t: 'createRoom', ...opts }),
    joinRoom: (roomId, species) => send({ t: 'joinRoom', roomId, species }),
    setSpecies: species => send({ t: 'setSpecies', species }),
    start: () => send({ t: 'start' }),
    leaveRoom: () => send({ t: 'leaveRoom' }),
    raw: send,
    // Snapshots/input supersede older copies, so dropping one is better than
    // growing an unbounded WebSocket queue on a slow connection.
    rawTransient: o => send(o, true),
    close: () => { try { ws && ws.close(); } catch { } },
  };
}
