import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from '@/game/GameEngine';
import GameHUD from '@/components/GameHUD';

const INITIAL_STATE: GameState = {
  ammo: 30, maxAmmo: 30, reserveAmmo: 90,
  health: 100, isReloading: false, isCrouching: false,
  isJumping: false, isInspecting: false, isAiming: false,
  kills: 0, gamePhase: 'menu', reloadProgress: 0,
  muzzleFlash: false, hitMarker: false, enemiesAlive: 5,
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

    const onLockChange = () => {
      setIsLocked(document.pointerLockElement === canvas);
    };
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      engine.destroy();
    };
  }, [handleStateChange]);

  const startGame = () => {
    engineRef.current?.start();
  };

  const restartGame = () => {
    engineRef.current?.restart();
  };

  const handleCanvasClick = () => {
    if (gameState.gamePhase === 'playing') {
      canvasRef.current?.requestPointerLock();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black" style={{ fontFamily: "'Oswald', sans-serif" }}>
      {/* Google Font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onClick={handleCanvasClick}
        style={{ cursor: isLocked ? 'none' : 'default' }}
      />

      {/* HUD (only when playing) */}
      {gameState.gamePhase === 'playing' && (
        <GameHUD state={gameState} />
      )}

      {/* Click to lock overlay */}
      {gameState.gamePhase === 'playing' && !isLocked && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={handleCanvasClick}
        >
          <div style={{ textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 4, marginBottom: 12 }}>НАЖМИТЕ ДЛЯ ВХОДА</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>ESC — выход из режима</div>
          </div>
        </div>
      )}

      {/* Main Menu */}
      {gameState.gamePhase === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(10,20,30,0.95) 100%)',
          }}>

          {/* Logo */}
          <div style={{ marginBottom: 60, textAlign: 'center' }}>
            <div style={{
              fontSize: 80, fontWeight: 700, letterSpacing: 12,
              background: 'linear-gradient(180deg, #ffffff 0%, #aaaaaa 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              lineHeight: 0.9,
            }}>
              CS<span style={{
                background: 'linear-gradient(180deg, #facc15 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>2</span>
            </div>
            <div style={{ fontSize: 13, letterSpacing: 10, color: 'rgba(255,255,255,0.35)', marginTop: 10, textTransform: 'uppercase' }}>
              Counter Strike · Browser Edition
            </div>
          </div>

          {/* Map preview info */}
          <div style={{
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '16px 32px',
            marginBottom: 40,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 4 }}>КАРТА</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'white', letterSpacing: 3, marginTop: 4 }}>DE_MIRAGE</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginTop: 4 }}>5 противников · AK-47</div>
          </div>

          {/* Start button */}
          <button
            onClick={startGame}
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)',
              color: '#000',
              border: 'none',
              padding: '18px 64px',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif",
              marginBottom: 20,
              transition: 'transform 0.1s, box-shadow 0.1s',
              boxShadow: '0 0 30px rgba(250,204,21,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            НАЧАТЬ ИГРУ
          </button>

          {/* Controls */}
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: 3, textAlign: 'center', lineHeight: 2.2 }}>
            <div>WASD — ДВИЖЕНИЕ &nbsp;·&nbsp; МЫШЬ — ПРИЦЕЛ &nbsp;·&nbsp; ЛКМ — ОГОНЬ</div>
            <div>R — ПЕРЕЗАРЯДКА &nbsp;·&nbsp; F — ОСМОТР &nbsp;·&nbsp; C — ПРИСЕСТЬ &nbsp;·&nbsp; ПРОБЕЛ — ПРЫЖОК</div>
          </div>
        </div>
      )}

      {/* Death Screen */}
      {gameState.gamePhase === 'dead' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at center, rgba(60,0,0,0.9) 0%, rgba(0,0,0,0.97) 100%)' }}>

          <div style={{
            fontSize: 90, fontWeight: 700, letterSpacing: 8,
            color: '#ef4444',
            textShadow: '0 0 60px rgba(239,68,68,0.6)',
            marginBottom: 20,
          }}>
            УБИТ
          </div>

          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', letterSpacing: 4, marginBottom: 50 }}>
            ВЫ УНИЧТОЖЕНЫ
          </div>

          <div style={{
            display: 'flex', gap: 60, marginBottom: 50,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '20px 50px',
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 3 }}>УБИЙСТВА</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#facc15' }}>{gameState.kills}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 3 }}>ОСТАЛОСЬ</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#ef4444' }}>{gameState.enemiesAlive}</div>
            </div>
          </div>

          <button
            onClick={restartGame}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '16px 56px',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif",
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            }}
          >
            НАЧАТЬ ЗАНОВО
          </button>
        </div>
      )}

      {/* Victory Screen */}
      {gameState.gamePhase === 'playing' && gameState.enemiesAlive === 0 && gameState.health > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,40,0,0.85) 0%, rgba(0,0,0,0.9) 100%)' }}>
          <div style={{
            fontSize: 80, fontWeight: 700, letterSpacing: 8,
            color: '#4ade80',
            textShadow: '0 0 60px rgba(74,222,128,0.6)',
            marginBottom: 16,
          }}>
            ПОБЕДА
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: 4 }}>
            РАУНД ЗАВЕРШЁН · УБИЙСТВА: {gameState.kills}
          </div>
        </div>
      )}
    </div>
  );
}
