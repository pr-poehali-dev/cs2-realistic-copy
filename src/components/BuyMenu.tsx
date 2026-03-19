import { WEAPONS, WeaponDef, GameState } from '@/game/GameEngine';

interface Props {
  state: GameState;
  onBuy: (id: string) => void;
  onBuyArmor: () => void;
  onClose: () => void;
}

const CATEGORIES = [
  { label: 'Пистолеты', ids: ['p250', 'deagle'] },
  { label: 'SMG', ids: ['mp5'] },
  { label: 'Винтовки', ids: ['ak47', 'm4a4'] },
  { label: 'Снайперки', ids: ['awp'] },
  { label: 'Пулемёты', ids: ['m249'] },
];

function WeaponCard({ def, money, current, onBuy }: { def: WeaponDef; money: number; current: string; onBuy: () => void }) {
  const canAfford = money >= def.price;
  const isSelected = current === def.id;

  return (
    <button
      onClick={onBuy}
      disabled={!canAfford}
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(250,204,21,0.18) 0%, rgba(249,115,22,0.12) 100%)'
          : canAfford ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        border: isSelected ? '1px solid rgba(250,204,21,0.6)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4,
        padding: '10px 14px',
        cursor: canAfford ? 'pointer' : 'not-allowed',
        textAlign: 'left',
        transition: 'all 0.15s',
        opacity: canAfford ? 1 : 0.4,
        width: '100%',
        fontFamily: "'Oswald', sans-serif",
      }}
      onMouseEnter={e => { if (canAfford && !isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={e => { if (canAfford && !isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'white', fontSize: 15, fontWeight: 600, letterSpacing: 1 }}>{def.name}</span>
        <span style={{ color: canAfford ? '#facc15' : '#888', fontSize: 14, fontWeight: 700 }}>
          ${def.price.toLocaleString()}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 5 }}>
        <span style={{ color: '#aaa', fontSize: 11 }}>⚔ {def.damage} урон</span>
        <span style={{ color: '#aaa', fontSize: 11 }}>📦 {def.maxAmmo}/{def.reserveAmmo}</span>
        <span style={{ color: '#aaa', fontSize: 11 }}>🔥 {Math.round(1000 / def.fireRate * 10) / 10} выс/с</span>
      </div>
    </button>
  );
}

export default function BuyMenu({ state, onBuy, onBuyArmor, onClose }: Props) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', fontFamily: "'Oswald', sans-serif", zIndex: 50 }}
    >
      <div style={{
        width: 620, maxHeight: '88vh', overflow: 'auto',
        background: 'linear-gradient(160deg, #0e1820 0%, #0a1218 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'white', letterSpacing: 4 }}>ЗАКУПКА</div>
            <div style={{ fontSize: 12, color: '#888', letterSpacing: 3 }}>Выберите оружие перед боем</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#888', letterSpacing: 3 }}>БАЛАНС</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#4ade80', lineHeight: 1 }}>
              ${state.money.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Armor */}
        <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'white', fontSize: 15, fontWeight: 600, letterSpacing: 1 }}>🛡 Бронежилет</div>
              <div style={{ color: '#aaa', fontSize: 11, marginTop: 3 }}>
                Текущая броня: <span style={{ color: state.armor > 0 ? '#60a5fa' : '#ef4444' }}>{Math.round(state.armor)}</span> / 100 · Поглощение урона 42%
              </div>
            </div>
            <button
              onClick={onBuyArmor}
              disabled={state.money < 650 || state.armor >= 100}
              style={{
                background: state.money >= 650 && state.armor < 100 ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(96,165,250,0.4)',
                color: state.money >= 650 && state.armor < 100 ? '#93c5fd' : '#555',
                padding: '8px 18px', fontSize: 14, fontWeight: 600, letterSpacing: 2,
                cursor: state.money >= 650 && state.armor < 100 ? 'pointer' : 'not-allowed',
                fontFamily: "'Oswald', sans-serif", borderRadius: 3,
              }}
            >
              $650
            </button>
          </div>
        </div>

        {/* Weapon categories */}
        {CATEGORIES.map(cat => (
          <div key={cat.label} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: '#666', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2 }}>
              {cat.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cat.ids.map(id => (
                <WeaponCard
                  key={id}
                  def={WEAPONS[id]}
                  money={state.money}
                  current={state.currentWeapon}
                  onBuy={() => onBuy(id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Actions */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 18, marginTop: 8, display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)',
              color: '#000', border: 'none',
              padding: '14px 0', fontSize: 18, fontWeight: 700, letterSpacing: 5,
              cursor: 'pointer', fontFamily: "'Oswald', sans-serif", borderRadius: 3,
            }}
          >
            В БОЙ
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, color: '#444', fontSize: 11, letterSpacing: 3 }}>
          B — открыть меню закупки · ESC — закрыть
        </div>
      </div>
    </div>
  );
}
