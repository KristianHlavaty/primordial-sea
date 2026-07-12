/* Root component: the game canvas plus whichever UI layer the game state
   calls for (HUD, toasts, tree wiki, world atlas, evolve/pause/death/start). */
import { html, useState, useRef, Fragment } from './react.js';
import { useEngine } from './useEngine.js';
import { Hud } from './components/Hud.js';
import { AchievementToast } from './components/AchievementToast.js';
import { TreeModal } from './tree/TreeModal.js';
import { AtlasModal } from './overlays/AtlasModal.js';
import { EvolveModal } from './overlays/EvolveModal.js';
import { PauseOverlay } from './overlays/PauseOverlay.js';
import { GameOverScreen } from './overlays/GameOverScreen.js';
import { StartScreen } from './overlays/StartScreen.js';

export function App() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('start');   // 'start' | 'play'
  const [treeOpen, setTreeOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const uiRef = useRef({});                       // latest UI state for input handlers / debug API
  const { engineRef, hud } = useEngine(canvasRef, uiRef);
  const engine = engineRef.current;

  const begin = options => { engineRef.current.start(options); setPhase('play'); };
  const skipToLand = (id, options) => { engineRef.current.startAt(id, options); setPhase('play'); };
  const openTree = () => { if (engineRef.current && engineRef.current.canWiki()) { engineRef.current.setPaused(true); setTreeOpen(true); } };
  const closeTree = () => { setTreeOpen(false); if (engineRef.current) engineRef.current.setPaused(false); };
  const openAtlas = () => { if (engineRef.current && engineRef.current.canWiki()) { engineRef.current.setPaused(true); setAtlasOpen(true); } };
  const closeAtlas = () => { setAtlasOpen(false); if (engineRef.current) engineRef.current.setPaused(false); };
  const curId = (engine && engine.player) ? engine.player.speciesId : 'protocell';
  uiRef.current = { phase, treeOpen, openTree, closeTree, atlasOpen, openAtlas, closeAtlas };

  const anyModal = treeOpen || atlasOpen;

  return html`
    <${Fragment}>
      <canvas id="game" ref=${canvasRef}/>

      ${phase === 'play' && hud && !hud.dead && html`<${Hud} hud=${hud} engine=${engine} onOpenTree=${openTree} onOpenAtlas=${openAtlas}/>`}

      ${phase === 'play' && hud && hud.achievement && html`<${AchievementToast} key=${hud.achievement.id} ach=${hud.achievement}/>`}

      ${phase === 'play' && treeOpen && html`<${TreeModal} curId=${curId} onClose=${closeTree}/>`}

      ${phase === 'play' && atlasOpen && hud && html`<${AtlasModal} engine=${engine} hud=${hud} onClose=${closeAtlas}/>`}

      ${phase === 'play' && hud && hud.pendingEvolve && engine && html`<${EvolveModal} engine=${engine} hud=${hud}/>`}

      ${phase === 'play' && hud && hud.paused && !hud.pendingEvolve && !hud.dead && !anyModal && html`<${PauseOverlay} onResume=${() => engine.togglePause()}/>`}

      ${phase === 'play' && hud && hud.dead && html`<${GameOverScreen} hud=${hud} onRestart=${begin}/>`}

      ${phase === 'start' && html`<${StartScreen} onBegin=${begin} onSkipToLand=${skipToLand}/>`}
    <//>`;
}
