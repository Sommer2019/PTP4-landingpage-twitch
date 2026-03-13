import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBartclickerGame } from '../../hooks/useBartclickerGame';
import './BartclickerGame.css';

interface BartclickerGameProps {
  compact?: boolean;
}

export default function BartclickerGame({ compact = false }: BartclickerGameProps) {
  const { t } = useTranslation();
  const { gameState, isLoading, clickPower, cps, handleClick, buyItem, performRebirth } =
    useBartclickerGame();

  const [activeTab, setActiveTab] = useState<'shop' | 'leaderboard' | 'stats'>('shop');

  if (isLoading) {
    return (
      <div className="bartclicker-loading">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'b';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'm';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'k';
    return Math.floor(num).toString();
  };

  const passiveItems = gameState.shop_items.filter((item) => item.type === 'passive');
  const clickItems = gameState.shop_items.filter((item) => item.type === 'click');

  return (
    <div className={`bartclicker-game ${compact ? 'compact' : ''}`}>
      {/* Header Stats */}
      <div className="bartclicker-header">
        <div className="stat-box">
          <h2 className="stat-value">{formatNumber(gameState.energy)}</h2>
          <p className="stat-label">Barthaare</p>
        </div>

        <div className="stat-box">
          <h3 className="stat-cps">{formatNumber(cps)}/s</h3>
          <p className="stat-label">Pro Sekunde</p>
        </div>

        <div className="stat-box">
          <h3 className="stat-rebirth">Rebirth: {gameState.rebirth_count}</h3>
          <p className="stat-label">×{gameState.rebirth_multiplier.toFixed(0)}</p>
        </div>
      </div>

      {/* Main Click Area */}
      <div className="click-area">
        <button
          className="click-button"
          onClick={handleClick}
          disabled={isLoading}
          title={`+${formatNumber(clickPower)} Barthaare`}
        >
          <div className="click-button-content">
            <span className="click-icon">💈</span>
            <span className="click-power">+{formatNumber(clickPower)}</span>
          </div>
        </button>
      </div>

      {/* Shop & Info Tabs */}
      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => setActiveTab('shop')}
        >
          🛒 Shop
        </button>
        <button
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Stats
        </button>
        <button
          className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 Leaderboard
        </button>
      </div>

      {/* Shop Tab */}
      {activeTab === 'shop' && (
        <div className="shop-content">
          <div className="shop-section">
            <h3>💧 Passive Items</h3>
            <div className="item-list">
              {passiveItems.map((item) => (
                <div key={item.id} className="shop-item">
                  <div className="item-header">
                    <span className="item-icon">{item.icon}</span>
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <p className="item-cps">{item.cps?.toFixed(1)}/s</p>
                    </div>
                    <span className="item-count">×{item.count}</span>
                  </div>
                  <button
                    className="buy-button"
                    onClick={() => buyItem(item.id)}
                    disabled={gameState.energy < item.cost}
                    title={`Kosten: ${formatNumber(item.cost)}`}
                  >
                    {formatNumber(item.cost)}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="shop-section">
            <h3>💪 Click Items</h3>
            <div className="item-list">
              {clickItems.map((item) => (
                <div key={item.id} className="shop-item">
                  <div className="item-header">
                    <span className="item-icon">{item.icon}</span>
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <p className="item-power">+{item.clickPower}</p>
                    </div>
                    <span className="item-count">×{item.count}</span>
                  </div>
                  <button
                    className="buy-button"
                    onClick={() => buyItem(item.id)}
                    disabled={gameState.energy < item.cost}
                    title={`Kosten: ${formatNumber(item.cost)}`}
                  >
                    {formatNumber(item.cost)}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {gameState.rebirth_count === 0 && gameState.total_ever >= 1000000 && (
            <div className="rebirth-section">
              <button className="rebirth-button" onClick={performRebirth}>
                🔄 Rebirth
              </button>
              <p className="rebirth-info">
                Verdopple deine Multiplikatoren und starte von vorne!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="stats-content">
          <div className="stat-row">
            <label>Total Ever:</label>
            <span>{formatNumber(gameState.total_ever)}</span>
          </div>
          <div className="stat-row">
            <label>Current Energy:</label>
            <span>{formatNumber(gameState.energy)}</span>
          </div>
          <div className="stat-row">
            <label>CPS:</label>
            <span>{formatNumber(cps)}</span>
          </div>
          <div className="stat-row">
            <label>Click Power:</label>
            <span>{formatNumber(clickPower)}</span>
          </div>
          <div className="stat-row">
            <label>Rebirth Count:</label>
            <span>{gameState.rebirth_count}</span>
          </div>
          <div className="stat-row">
            <label>Multiplier:</label>
            <span>×{gameState.rebirth_multiplier.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="leaderboard-content">
          <p className="coming-soon">🏆 Leaderboard wird geladen...</p>
        </div>
      )}
    </div>
  );
}



