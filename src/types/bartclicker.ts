// Shop-Items
export interface ShopItem {
  id: number;
  name: string;
  cost: number;
  cps?: number; // Klicks pro Sekunde (für passive Items)
  clickPower?: number; // Power pro Klick
  icon: string;
  type: 'passive' | 'click';
  count: number;
}

// Buffs – Temporäre Boni
export interface Buff {
  id: number;
  name: string;
  icon: string;
  effect: 'cpsMultiplier' | 'clickMultiplier' | 'both';
  value?: number;
  cpsValue?: number;
  clickValue?: number;
  duration: number;
  baseCost: number;
  description: string;
  endTime?: number; // Unix-Timestamp
  negativeEffect?: {
    chance: number;
    type: 'energyLoss' | 'clickReduction' | 'both';
    value?: number;
    cpsValue?: number;
    clickValue?: number;
    duration?: number;
    description: string;
  };
}

// Debuffs – Temporäre Strafen
export interface Debuff {
  type: 'energyLoss' | 'clickReduction' | 'both';
  value?: number;
  cpsValue?: number;
  clickValue?: number;
  endTime: number;
  description?: string;
}

// Relikte – Permanente Boni
export interface Relic {
  id: number;
  name: string;
  icon: string;
  effect: 'cpsBonus' | 'clickBonus' | 'offlineBonus' | 'allBonus';
  value?: number;
  cpsValue?: number;
  clickValue?: number;
  unlockCost: number;
  description: string;
}

// Spielstand aus der Datenbank
export interface BartclickerGameState {
  id?: string;
  user_id?: string;
  energy: number;
  total_ever: number;
  rebirth_count: number;
  rebirth_multiplier: number;
  shop_items: ShopItem[];
  active_buffs: Buff[];
  active_debuffs: Debuff[];
  relics: Relic[];
  offline_earning_upgrades: number;
   auto_click_buyer_enabled: boolean;
   auto_click_buyer_unlocked: boolean;
   click_upgrade_buyer_enabled: boolean;
   click_upgrade_buyer_unlocked: boolean;
  click_upgrade_buyer_items: number[];
  last_updated?: string;
  created_at?: string;
}

// Ranglisten-Eintrag
export interface BartclickerLeaderboardEntry {
  rank: number;
  user_id: string;
  total_ever: number;
  rebirth_count: number;
  last_updated: string;
  display_name?: string;
}

// Offline-Fortschrittsberechnung
export interface OfflineProgress {
  progress: number;
  offlineSeconds: number;
}
