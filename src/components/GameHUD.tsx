import { GameState, WEAPONS } from '@/game/GameEngine';

interface Props {
  state: GameState;
}

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export default function GameHUD({ state }: Props) {
  const hp = state.health;
  const healthColor = hp > 60 ? '#4ade80' : hp > 30 ? '#facc15' : '#ef4444';
  const mins = Math.floor(state.roundTime / 60);
  const secs = Math.floor(state.roundTime % 60);
  const timeColor = state.roundTime < 15 ? '#ef4444' : 'white';
  const weapName = WEAPONS[state.currentWeapon]?.name ?? 'AK-47';

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ fontFamily: "'Oswald', sans-serif" }}
    >
      {/* DAMAGE VIGNETTE */}
      {state.damageFlash > 0 && (
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at center, transparent 35%, rgba(200,20,20,${state.damageFlash * 0.55}) 100%)`,
        }} />
      )}

      {/* Low health pulsing vignette */}
      {hp < 35 && (
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(180,0,0,0.22) 100%)`,
          animation: 'pulse 1.2s ease-in-out infinite',
        }} />
      )}

      {/* CROSSHAIR */}
      <div className="absolute inset-0 flex items-center justify-center">
        {state.hitMarker ? (
          <div style={{ position: 'relative', width: 24, height: 24 }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 2, height: 18, background: state.headshot ? '#facc15' : '#ef4444', transform: 'rotate(45deg)', boxShadow: `0 0 5px ${state.headshot ? '#facc15' : '#ef4444'}` }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 2, height: 18, background: state.headshot ? '#facc15' : '#ef4444', transform: 'rotate(-45deg)', boxShadow: `0 0 5px ${state.headshot ? '#facc15' : '#ef4444'}` }} />
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            {[0, 90, 180, 270].map((angle, i) => (
              <div key={i} style={{
                position: 'absolute', width: state.isAiming ? 5 : 7, height: 1.5,
                background: 'rgba(190,255,190,0.92)',
                top: '50%', left: '50%',
                transformOrigin: 'left center',
                transform: `translate(-50%,-50%) rotate(${angle}deg) translateX(${state.isAiming ? 3 : 5}px)`,
                filter: 'drop-shadow(0 0 2px rgba(0,255,0,0.7))',
                transition: 'all 0.1s',
              }} />
            ))}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 2, height: 2, background: 'rgba(190,255,190,0.8)', borderRadius: '50%',
            }} />
          </div>
        )}
      </div>

      {/* ROUND TIMER (top centre) */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pt-5">
        <div style={{
          background: 'rgba(0,0,0,0.55)', padding: '6px 20px',
          borderBottom: `2px solid ${timeColor}`,
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: timeColor, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>
            {pad2(mins)}:{pad2(secs)}
          </span>
        </div>
      </div>

      {/* TOP LEFT: enemies alive */}
      <div className="absolute top-5 left-5">
        <div style={{ fontSize: 10, color: '#999', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 5 }}>ПРОТИВНИКИ</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              width: 14, height: 22, borderRadius: 2,
              background: i < state.enemiesAlive ? '#ef4444' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.4s',
              boxShadow: i < state.enemiesAlive ? '0 0 6px rgba(239,68,68,0.4)' : 'none',
            }} />
          ))}
        </div>
      </div>

      {/* TOP RIGHT: weapon + money */}
      <div className="absolute top-5 right-5" style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 2 }}>{weapName}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 3 }}>{state.currentWeapon.toUpperCase()}</div>
        <div style={{ fontSize: 14, color: '#4ade80', marginTop: 4, letterSpacing: 2 }}>${state.money.toLocaleString()}</div>
      </div>

      {/* BOTTOM HUD */}
      <div className="absolute bottom-0 left-0 right-0" style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
        padding: '0 24px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        {/* Health + Armor */}
        <div>
          <div style={{ fontSize: 10, color: '#999', letterSpacing: 3, marginBottom: 3 }}>ЗДОРОВЬЕ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 54, fontWeight: 700, lineHeight: 1, color: healthColor,
              textShadow: `0 0 25px ${healthColor}55`,
            }}>{Math.ceil(hp)}</span>
            <div>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  width: 36, height: 3, marginBottom: 3, borderRadius: 2,
                  background: i * 20 < hp ? healthColor : 'rgba(255,255,255,0.12)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
          </div>
          {/* Armor bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 11, color: state.armor > 0 ? '#60a5fa' : '#444' }}>🛡</span>
            <div style={{ width: 80, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
              <div style={{ width: `${state.armor}%`, height: '100%', background: '#60a5fa', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 11, color: '#60a5fa' }}>{Math.round(state.armor)}</span>
          </div>
        </div>

        {/* Kill counter */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#999', letterSpacing: 3, marginBottom: 3 }}>УБИЙСТВА</div>
          <div style={{ fontSize: 38, fontWeight: 700, color: '#facc15', textShadow: '0 0 18px rgba(250,204,21,0.45)' }}>
            {state.kills}
          </div>
        </div>

        {/* Ammo */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#999', letterSpacing: 3, marginBottom: 3 }}>ПАТРОНЫ</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'flex-end' }}>
            <span style={{
              fontSize: 54, fontWeight: 700, lineHeight: 1,
              color: state.ammo < 8 && state.maxAmmo > 8 ? '#ef4444' : 'white',
              textShadow: state.ammo < 8 && state.maxAmmo > 8 ? '0 0 20px rgba(239,68,68,0.5)' : 'none',
            }}>{state.ammo}</span>
            <span style={{ fontSize: 20, color: '#555', fontWeight: 400 }}>/ {state.reserveAmmo}</span>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 4, justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 200 }}>
            {[...Array(Math.min(state.maxAmmo, 30))].map((_, i) => (
              <div key={i} style={{
                width: 4, height: 11, borderRadius: 2,
                background: i < state.ammo ? '#e0e0e0' : 'rgba(255,255,255,0.1)',
                transition: 'background 0.08s',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* RELOAD BAR */}
      {state.isReloading && (
        <div className="absolute" style={{ bottom: 110, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ color: '#facc15', fontSize: 12, letterSpacing: 5, marginBottom: 7, textTransform: 'uppercase' }}>ПЕРЕЗАРЯДКА</div>
          <div style={{ width: 210, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
            <div style={{
              width: `${state.reloadProgress * 100}%`, height: '100%',
              background: 'linear-gradient(90deg, #facc15, #f97316)',
              borderRadius: 2, transition: 'width 0.12s linear',
            }} />
          </div>
        </div>
      )}

      {/* STATUS */}
      <div className="absolute" style={{ bottom: 78, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 14 }}>
        {state.isCrouching && (
          <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', padding: '3px 10px', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 3 }}>ПРИСЕЛИ</div>
        )}
        {state.isInspecting && (
          <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', padding: '3px 10px', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 3 }}>ОСМОТР</div>
        )}
      </div>

      {/* MUZZLE FLASH GLOW */}
      {state.muzzleFlash && (
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 60% 55%, rgba(255,240,140,0.07) 0%, transparent 65%)',
        }} />
      )}

      {/* HEADSHOT */}
      {state.headshot && (
        <div className="absolute" style={{ top: '38%', left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 6, color: '#facc15', textShadow: '0 0 18px rgba(250,204,21,0.9)' }}>
            HEADSHOT
          </div>
        </div>
      )}

      {/* CONTROLS HINT */}
      <div className="absolute bottom-1" style={{ left: '50%', transform: 'translateX(-50%)', opacity: 0.22, fontSize: 10, letterSpacing: 2, color: 'white', whiteSpace: 'nowrap' }}>
        WASD · ЛКМ огонь · ПКМ прицел · R заряд · F осмотр · C присесть · ПРОБЕЛ прыжок · B закупка
      </div>
    </div>
  );
}
