import { GameState } from '@/game/GameEngine';

interface Props {
  state: GameState;
}

export default function GameHUD({ state }: Props) {
  const healthColor = state.health > 60 ? '#4ade80' : state.health > 30 ? '#facc15' : '#ef4444';

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "'Oswald', sans-serif" }}>

      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center">
        {state.hitMarker ? (
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: 2, height: 14, background: '#ef4444', transform: 'rotate(45deg)', boxShadow: '0 0 4px #ef4444' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: 2, height: 14, background: '#ef4444', transform: 'rotate(-45deg)', boxShadow: '0 0 4px #ef4444' }} />
            </div>
          </div>
        ) : (
          <div className="relative" style={{ width: 20, height: 20 }}>
            {/* Dynamic crosshair gap based on aiming */}
            {[0, 90, 180, 270].map((angle, i) => (
              <div key={i} className="absolute" style={{
                width: state.isAiming ? 5 : 7,
                height: 1.5,
                background: 'rgba(200,255,200,0.9)',
                top: '50%',
                left: '50%',
                transformOrigin: 'left center',
                transform: `translate(-50%,-50%) rotate(${angle}deg) translateX(${state.isAiming ? 3 : 5}px)`,
                filter: 'drop-shadow(0 0 2px rgba(0,255,0,0.8))',
                transition: 'all 0.1s',
              }} />
            ))}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 2, height: 2,
              background: 'rgba(200,255,200,0.8)',
              borderRadius: '50%'
            }} />
          </div>
        )}
      </div>

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end p-6"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>

        {/* Health */}
        <div className="flex flex-col gap-1">
          <div style={{ color: '#aaaaaa', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>ЗДОРОВЬЕ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 52, fontWeight: 700, color: healthColor, lineHeight: 1, textShadow: `0 0 20px ${healthColor}40` }}>
              {Math.ceil(state.health)}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  width: 40, height: 3,
                  background: (i * 20) < state.health ? healthColor : 'rgba(255,255,255,0.15)',
                  transition: 'background 0.3s',
                  borderRadius: 2,
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Kill counter */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#aaaaaa', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>УБИЙСТВА</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#facc15', textShadow: '0 0 15px rgba(250,204,21,0.5)' }}>
            {state.kills}
          </div>
        </div>

        {/* Ammo */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#aaaaaa', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>ПАТРОНЫ</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'flex-end' }}>
            <span style={{
              fontSize: 52, fontWeight: 700,
              color: state.ammo < 8 ? '#ef4444' : 'white',
              lineHeight: 1,
              textShadow: state.ammo < 8 ? '0 0 20px rgba(239,68,68,0.5)' : 'none',
            }}>
              {state.ammo}
            </span>
            <span style={{ fontSize: 22, color: '#888', fontWeight: 400 }}>/ {state.reserveAmmo}</span>
          </div>

          {/* Ammo dots */}
          <div style={{ display: 'flex', gap: 2, marginTop: 4, justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 180 }}>
            {[...Array(state.maxAmmo)].map((_, i) => (
              <div key={i} style={{
                width: 4, height: 12,
                background: i < state.ammo ? '#e8e8e8' : 'rgba(255,255,255,0.12)',
                borderRadius: 2,
                transition: 'background 0.1s',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Weapon name top right */}
      <div className="absolute top-6 right-6" style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 2 }}>AK-47</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3 }}>ASSAULT RIFLE</div>
      </div>

      {/* Enemies alive top left */}
      <div className="absolute top-6 left-6">
        <div style={{ fontSize: 11, color: '#aaaaaa', letterSpacing: 3, textTransform: 'uppercase' }}>ПРОТИВНИКИ</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              width: 12, height: 20,
              background: i < state.enemiesAlive ? '#ef4444' : 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Reload bar */}
      {state.isReloading && (
        <div className="absolute" style={{ bottom: 120, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ color: '#facc15', fontSize: 13, letterSpacing: 4, marginBottom: 8, textTransform: 'uppercase' }}>
            ПЕРЕЗАРЯДКА
          </div>
          <div style={{ width: 200, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
            <div style={{
              width: `${state.reloadProgress * 100}%`,
              height: '100%',
              background: '#facc15',
              borderRadius: 2,
              transition: 'width 0.1s linear',
            }} />
          </div>
        </div>
      )}

      {/* Inspect label */}
      {state.isInspecting && (
        <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -200px)', color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 4 }}>
          ОСМОТР ОРУЖИЯ
        </div>
      )}

      {/* Crouching indicator */}
      {state.isCrouching && (
        <div className="absolute" style={{ bottom: 170, left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.5)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-6 left-1/2" style={{ transform: 'translateX(-50%)', opacity: 0.35, fontSize: 10, letterSpacing: 2, color: 'white', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>
        WASD — движение &nbsp;|&nbsp; ЛКМ — огонь &nbsp;|&nbsp; R — перезарядка &nbsp;|&nbsp; F — осмотр &nbsp;|&nbsp; C — присесть &nbsp;|&nbsp; Пробел — прыжок
      </div>

      {/* Muzzle flash vignette */}
      {state.muzzleFlash && (
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, rgba(255,240,150,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Damage vignette */}
      {state.health < 40 && (
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(180,20,20,${0.15 + (1 - state.health / 40) * 0.25}) 100%)`,
          animation: 'pulse 1s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}
