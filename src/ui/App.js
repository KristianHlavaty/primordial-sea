/* Root component: the game canvas plus whichever UI layer the game state
   calls for (HUD, toasts, tree wiki, world atlas, evolve/pause/death/start). */
import { html, useState, useRef, useEffect, Fragment } from './react.js';
import { useEngine } from './useEngine.js';
import { Hud } from './components/Hud.js';
import { AchievementToast } from './components/AchievementToast.js';
import { TreeModal } from './tree/TreeModal.js';
import { AtlasModal } from './overlays/AtlasModal.js';
import { TalentModal } from './overlays/TalentModal.js';
import { EvolveModal } from './overlays/EvolveModal.js';
import { PauseOverlay } from './overlays/PauseOverlay.js';
import { GameOverScreen } from './overlays/GameOverScreen.js';
import { StartScreen } from './overlays/StartScreen.js';
import { MultiplayerScreen } from './overlays/MultiplayerScreen.js';
import { MpHud } from './overlays/MpHud.js';
import { ProfileModal } from './overlays/ProfileModal.js';
import { BossEffectsModal } from './overlays/BossEffectsModal.js';
import { SettingsModal } from './overlays/SettingsModal.js';
import { loadProfile } from '../net/profile.js';
import { createLobby } from '../net/lobby.js';
import { loadSettings, saveSettings } from './settings.js';

export function App() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('start');   // 'start' | 'play'
  const [treeOpen, setTreeOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [bossEffectsOpen, setBossEffectsOpen] = useState(false);
  const [talentsOpen, setTalentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mpMenuOpen, setMpMenuOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [profile, setProfile] = useState(loadProfile);   // {id,name,color} or null on first run
  const [profileOpen, setProfileOpen] = useState(() => !loadProfile());
  const [mpView, setMpView] = useState(false);           // multiplayer lobby showing (on the start screen)
  const [mpState, setMpState] = useState({ status: 'idle', rooms: [], room: null, error: null, connId: null });
  const lobbyRef = useRef(null);                  // the WebSocket lobby — owned here so it survives lobby→game
  const uiRef = useRef({});                       // latest UI state for input handlers / debug API
  const { engineRef, hud } = useEngine(canvasRef, uiRef);
  const engine = engineRef.current;

  const begin = options => { engineRef.current.start(options); setMpMenuOpen(false); setPhase('play'); };
  const skipToLand = (id, options) => { engineRef.current.startAt(id, options); setMpMenuOpen(false); setPhase('play'); };
  // "Evolve again" from the death screen — keep the run's Fantasy/Cheats settings
  const restartRun = () => { const e = engineRef.current; e.start({ fantasyEvolution: e.fantasyEvolution, cheats: e.cheatsEnabled }); setPhase('play'); };
  const openTree = () => { if (engineRef.current && engineRef.current.canWiki()) { engineRef.current.setPaused(true); setTreeOpen(true); } };
  const closeTree = () => { setTreeOpen(false); if (engineRef.current) engineRef.current.setPaused(false); };
  const openAtlas = () => { if (engineRef.current && engineRef.current.canWiki()) { engineRef.current.setPaused(true); setAtlasOpen(true); } };
  const closeAtlas = () => { setAtlasOpen(false); if (engineRef.current) engineRef.current.setPaused(false); };
  const openBossEffects = () => { if (engineRef.current && engineRef.current.canWiki()) { engineRef.current.setPaused(true); setBossEffectsOpen(true); } };
  const closeBossEffects = () => { setBossEffectsOpen(false); if (engineRef.current) engineRef.current.setPaused(false); };
  const openTalents = () => { if (engineRef.current && engineRef.current.canWiki()) { engineRef.current.setPaused(true); setTalentsOpen(true); } };
  const closeTalents = () => { setTalentsOpen(false); if (engineRef.current) engineRef.current.setPaused(false); };
  const closeAchievement = () => { if (engineRef.current) engineRef.current.dismissAchievement(); };
  const openSettings = () => setSettingsOpen(true);
  const closeSettings = () => setSettingsOpen(false);
  const changeSettings = value => setSettings(saveSettings(value));
  const toggleMpMenu = () => {
    const open = !mpMenuOpen;
    if (engineRef.current) engineRef.current.setInputSuppressed(open);
    setMpMenuOpen(open);
  };
  const handleEscape = () => {
    if (settingsOpen) closeSettings();
    else if (profileOpen) { if (profile) setProfileOpen(false); }
    else if (hud && hud.achievement) closeAchievement();
    else if (bossEffectsOpen) closeBossEffects();
    else if (talentsOpen) closeTalents();
    else if (treeOpen) closeTree();
    else if (atlasOpen) closeAtlas();
    else if (engineRef.current && engineRef.current.mp) toggleMpMenu();
    else if (engineRef.current) engineRef.current.togglePause();
  };
  const closeLobby = () => {
    if (lobbyRef.current) { lobbyRef.current.close(); lobbyRef.current = null; }
    setMpState({ status: 'idle', rooms: [], room: null, error: null, connId: null });
  };
  const mainMenu = () => {
    setTreeOpen(false); setAtlasOpen(false); setBossEffectsOpen(false); setTalentsOpen(false);
    setSettingsOpen(false); setMpMenuOpen(false); setMpView(false);
    closeLobby();
    if (engineRef.current) { engineRef.current.setInputSuppressed(false); engineRef.current.returnToMenu(); }
    setPhase('start');
  };
  const openProfile = () => setProfileOpen(true);
  const onProfileSave = p => { setProfile(p); setProfileOpen(false); };
  const openMultiplayer = () => {
    if (!lobbyRef.current) {
      lobbyRef.current = createLobby(profile, setMpState,
        (from, data) => { if (engineRef.current) engineRef.current.onNetPacket(from, data); });
    }
    setMpView(true);
  };
  const leaveMultiplayer = () => { closeLobby(); setMpView(false); };

  // roster keyed by connId — the shape the engine wants for host/client setup
  const buildRoster = room => { const r = {}; for (const pl of room.players) r[pl.connId] = { name: pl.name, color: pl.color, species: pl.species }; return r; };

  // when the room starts, drop into the shared arena as host or client
  const started = !!(mpState.room && mpState.room.started);
  useEffect(() => {
    if (!started || phase !== 'start') return;
    const room = mpState.room, roster = buildRoster(room), isHost = room.host === mpState.connId;
    const opts = { room, profile, lobby: lobbyRef.current, selfConn: mpState.connId, roster };
    if (isHost) engineRef.current.startMpHost(opts);
    else engineRef.current.startMpClient({ ...opts, hostConn: room.host });
    setMpView(false); setMpMenuOpen(false); setPhase('play');
  }, [started, phase]);

  // keep the host's roster fresh as players join/leave/recolour mid-session
  useEffect(() => {
    if (phase === 'play' && mpState.room && engineRef.current && engineRef.current.mp) engineRef.current.mpSetRoster(buildRoster(mpState.room));
  }, [mpState.room]);
  const curId = (engine && engine.player) ? engine.player.speciesId : 'protocell';
  const contentModalOpen = treeOpen || atlasOpen || bossEffectsOpen || talentsOpen;
  const inputBlocked = contentModalOpen || settingsOpen || profileOpen || mpMenuOpen || !!(hud && hud.paused);
  uiRef.current = {
    phase, frameRate: settings.frameRate, inputBlocked, handleEscape,
    treeOpen, openTree, closeTree, atlasOpen, openAtlas, closeAtlas,
    bossEffectsOpen, openBossEffects, closeBossEffects, talentsOpen, openTalents, closeTalents,
    achievementOpen: !!(hud && hud.achievement), closeAchievement,
  };

  return html`
    <${Fragment}>
      <canvas id="game" ref=${canvasRef}/>

      ${phase === 'play' && hud && !hud.dead && html`<${Hud} hud=${hud} engine=${engine} onOpenTree=${openTree} onOpenAtlas=${openAtlas} onOpenBossEffects=${openBossEffects} onOpenTalents=${openTalents}/>`}

      ${phase === 'play' && hud && hud.mpRole && html`<button className="mpLeaveBtn" onClick=${mainMenu} title="Leave the shared game">‹ Leave game</button>`}

      ${phase === 'play' && hud && hud.mpRole && html`<${MpHud} hud=${hud}/>`}

      ${phase === 'play' && hud && hud.achievement && html`<${AchievementToast} key=${hud.achievement.id} ach=${hud.achievement} onClose=${closeAchievement}/>`}

      ${phase === 'play' && treeOpen && html`<${TreeModal} curId=${curId} onClose=${closeTree}/>`}

      ${phase === 'play' && atlasOpen && hud && html`<${AtlasModal} engine=${engine} hud=${hud} onClose=${closeAtlas}/>`}

      ${phase === 'play' && talentsOpen && engine && html`<${TalentModal} engine=${engine} onClose=${closeTalents}/>`}

      ${phase === 'play' && bossEffectsOpen && hud && html`<${BossEffectsModal} perks=${hud.perks || []} onClose=${closeBossEffects}/>`}

      ${phase === 'play' && hud && hud.pendingEvolve && engine && html`<${EvolveModal} engine=${engine} hud=${hud}/>`}

      ${phase === 'play' && hud && hud.paused && !hud.pendingEvolve && !hud.dead && !hud.achievement && !contentModalOpen && !settingsOpen && html`
        <${PauseOverlay} onResume=${() => engine.togglePause()} onSettings=${openSettings} onMainMenu=${mainMenu}/>`}

      ${phase === 'play' && hud && hud.mpRole && mpMenuOpen && !settingsOpen && html`
        <${PauseOverlay} multiplayer=${true} onResume=${toggleMpMenu} onSettings=${openSettings} onMainMenu=${mainMenu}/>`}

      ${phase === 'play' && hud && hud.dead && html`<${GameOverScreen} hud=${hud} onRestart=${restartRun}/>`}

      ${phase === 'start' && !mpView && html`<${StartScreen} onBegin=${begin} onSkipToLand=${skipToLand} onMultiplayer=${openMultiplayer}
        profile=${profile} onEditProfile=${openProfile} settings=${settings} onOpenSettings=${openSettings}/>`}

      ${phase === 'start' && mpView && html`<${MultiplayerScreen} profile=${profile} lobby=${lobbyRef.current} ls=${mpState} onBack=${leaveMultiplayer}/>`}

      ${profileOpen && html`<${ProfileModal} profile=${profile} firstRun=${!profile} onSave=${onProfileSave} onClose=${() => setProfileOpen(false)}/>`}

      ${settingsOpen && html`<${SettingsModal} settings=${settings} onChange=${changeSettings} onClose=${closeSettings}/>`}
    <//>`;
}
