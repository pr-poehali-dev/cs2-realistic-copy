import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from '@/game/GameEngine';
import GameHUD from '@/components/GameHUD';
import BuyMenu from '@/components/BuyMenu';

const INITIAL_STATE: GameState = {
  ammo: 30, maxAmmo: 30, reserveAmmo: 90,
  health: 100, armor: 0, money: 3000,
  isReloading: false, isCrouching: false,
  isJumping: false, isInspecting: false, isAiming: false,
  kills: 0, gamePhase: 'menu', reloadProgress: 0,
  muzzleFlash: false, hitMarker: false, headshot: false,
  enemiesAlive: 5, currentWeapon: 'ak47', roundTime: 90, damageFlash: 0,
};

export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [isLocked, setIsLocked] = useState(false);

  const handleStateChange = useCallback((state: GameState) => {
    setGameState({ ...state });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, handleStateChange);
    engineRef.current = engine;

    const onLockChange = () => setIsLocked(document.pointerLockElement === canvas);
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      engine.destroy();
    };
  }, [handleStateChange]);

  const handleCanvasClick = () => {
    if (gameState.gamePhase === 'playing') canvasRef.current?.requestPointerLock();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black" style={{ fontFamily: "'Oswald', sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onClick={handleCanvasClick}
        style={{ cursor: isLocked ? 'none' : 'default' }}
      />

      {/* HUD */}
      {gameState.gamePhase === 'playing' && <GameHUD state={gameState} />}

      {/* Buy Menu */}
      {gameState.gamePhase === 'buy' && (
        <BuyMenu
          state={gameState}
          onBuy={(id) => engineRef.current?.buyWeapon(id)}
          onBuyArmor={() => engineRef.current?.buyArmor()}
          onClose={() => engineRef.current?.closeBuyMenu()}
        />
      )}

      {/* Click to lock overlay */}
      {gameState.gamePhase === 'playing' && !isLocked && (
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.55)' }} onClick={handleCanvasClick}>
          <div style={{ textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 4, marginBottom: 12 }}>НАЖМИТЕ ДЛЯ ВХОДА</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>ESC — выход из режима</div>
          </div>
        </div>
      )}

      {/* MAIN MENU */}
      {gameState.gamePhase === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.93) 0%, rgba(8,18,26,0.96) 100%)' }}>

          <div style={{ marginBottom: 56, textAlign: 'center' }}>
            <div style={{
              fontSize: 86, fontWeight: 700, letterSpacing: 12,
              background: 'linear-gradient(180deg, #ffffff 0%, #aaaaaa 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 0.9,
            }}>
              CS<span style={{
                background: 'linear-gradient(180deg, #facc15 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>2</span>
            </div>
            <div style={{ fontSize: 12, letterSpacing: 10, color: 'rgba(255,255,255,0.32)', marginTop: 10 }}>
              COUNTER STRIKE · BROWSER EDITION
            </div>
          </div>

          <div style={{
            border: '1px solid rgba(255,255,255,0.1)', padding: '16px 34px', marginBottom: 40,
            textAlign: 'center', background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', letterSpacing: 4 }}>КАРТА</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'white', letterSpacing: 3, marginTop: 4 }}>DE_MIRAGE</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginTop: 4 }}>
              5 ПРОТИВНИКОВ · LOS · ЗАКУПКА ОРУЖИЯ · ЗВУКИарт
            </div>
          </div>

          <button
            onClick={() => engineRef.current?.start()}
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)',
              color: '#000', border: 'none', padding: '18px 68px',
              fontSize: 20, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: "'Oswald', sans-serif", marginBottom: 20,
              boxShadow: '0 0 32px rgba(250,204,21,0.28)', transition: 'transform 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            НАЧАТЬ ИГРУ
          </button>

          <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, letterSpacing: 3, textAlign: 'center', lineHeight: 2.4 }}>
            <div>WASD — ДВИЖЕНИЕ &nbsp;·&nbsp; МЫШЬ — ПРИЦЕЛ &nbsp;·&nbsp; ЛКМ — ОГОНЬ &nbsp;·&nbsp; ПКМ — ПРИЦЕЛ</div>
            <div>R — ПЕРЕЗАРЯДКА &nbsp;·&nbsp; F — ОСМОТР &nbsp;·&nbsp; C — ПРИСЕСТЬ &nbsp;·&nbsp; ПРОБЕЛ — ПРЫЖОК &nbsp;·&nbsp; B — ЗАКУПКА</div>
          </div>
        </div>
      )}

      {/* DEATH SCREEN */}
      {gameState.gamePhase === 'dead' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at center, rgba(55,0,0,0.92) 0%, rgba(0,0,0,0.97) 100%)' }}>

          <div style={{
            fontSize: 96, fontWeight: 700, letterSpacing: 8, color: '#ef4444',
            textShadow: '0 0 70px rgba(239,68,68,0.6)', marginBottom: 16,
          }}>УБИТ</div>

          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 5, marginBottom: 48 }}>
            ВЫ УНИЧТОЖЕНЫ
          </div>

          <div style={{
            display: 'flex', gap: 60, marginBottom: 48,
            border: '1px solid rgba(255,255,255,0.1)', padding: '20px 52px',
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: 3 }}>УБИЙСТВА</div>
              <div style={{ fontSize: 50, fontWeight: 700, color: '#facc15' }}>{gameState.kills}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: 3 }}>ОСТАЛОСЬ</div>
              <div style={{ fontSize: 50, fontWeight: 700, color: '#ef4444' }}>{gameState.enemiesAlive}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: 3 }}>БОНУС</div>
              <div style={{ fontSize: 50, fontWeight: 700, color: '#4ade80' }}>$1400</div>
            </div>
          </div>

          <button
            onClick={() => engineRef.current?.restart()}
            style={{
              background: 'rgba(255,255,255,0.07)', color: 'white',
              border: '1px solid rgba(255,255,255,0.22)', padding: '16px 58px',
              fontSize: 18, fontWeight: 600, letterSpacing: 6,
              cursor: 'pointer', fontFamily: "'Oswald', sans-serif", transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
          >
            СЛЕДУЮЩИЙ РАУНД
          </button>
        </div>
      )}

      {/* VICTORY */}
      {gameState.gamePhase === 'playing' && gameState.enemiesAlive === 0 && gameState.health > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,38,0,0.88) 0%, rgba(0,0,0,0.92) 100%)' }}>
          <div style={{
            fontSize: 84, fontWeight: 700, letterSpacing: 8, color: '#4ade80',
            textShadow: '0 0 65px rgba(74,222,128,0.65)', marginBottom: 14,
          }}>ПОБЕДА</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 5 }}>
            РАУНД ЗАВЕРШЁН · УБИЙСТВА: {gameState.kills} · +$300 БОНУС
          </div>
        </div>
      )}
    </div>
  );
}