import React, { useState, useEffect, useCallback, useRef } from "react";
import { Leaf, DollarSign, Package, Zap, Lock, TrendingUp, TrendingDown, Sprout, ShoppingCart } from "lucide-react";

// ---- Game data ----
const STRAINS = [
  { id: "bag-seed", name: "Bag Seed", growSeconds: 14, basePrice: 8, unlockCost: 0, color: "#7C9A5C" },
  { id: "lemon-haze", name: "Lemon Haze", growSeconds: 22, basePrice: 16, unlockCost: 150, color: "#C9B94A" },
  { id: "purple-kush", name: "Purple Kush", growSeconds: 34, basePrice: 29, unlockCost: 600, color: "#8B5FBF" },
  { id: "og-diesel", name: "OG Diesel", growSeconds: 50, basePrice: 47, unlockCost: 2200, color: "#4A9A8F" },
];

const UPGRADES = [
  { id: "led", name: "LED Lights", desc: "Pflanzen wachsen 20% schneller", cost: 300, icon: Zap },
  { id: "extra-slot", name: "Zusätzlicher Topf", desc: "+1 Anbauplatz", cost: 400, icon: Sprout },
];

const SLOT_BASE = 3;
const TICK_MS = 200;
const STORAGE_KEY = "grow-tycoon-save";
const LEGACY_CASH_STORAGE_KEY = "grow-tycoon-cash";

function makePlant(strainId) {
  return { strainId, plantedAt: Date.now(), id: Math.random().toString(36).slice(2) };
}

function currency(n) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const legacyCash = localStorage.getItem(LEGACY_CASH_STORAGE_KEY);
  return legacyCash !== null ? { cash: Number(legacyCash) } : null;
}

export default function GrowTycoon() {
  const [initialSave] = useState(loadSave);
  const [cash, setCash] = useState(initialSave?.cash ?? 120);
  const [unlocked, setUnlocked] = useState(initialSave?.unlocked ?? ["bag-seed"]);
  const [owned, setOwned] = useState(initialSave?.owned ?? []); // upgrade ids
  const [slots, setSlots] = useState(initialSave?.slots ?? Array(SLOT_BASE).fill(null));
  const [priceMul, setPriceMul] = useState(initialSave?.priceMul ?? Object.fromEntries(STRAINS.map(s => [s.id, 1])));
  const [inventory, setInventory] = useState(initialSave?.inventory ?? {});
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState("grow");
  const [now, setNow] = useState(Date.now());
  const logIdRef = useRef(0);

  const hasUpgrade = (id) => owned.includes(id);
  const speedMul = hasUpgrade("led") ? 0.8 : 1;
  const totalSlots = SLOT_BASE + (hasUpgrade("extra-slot") ? 1 : 0);
  const totalHarvested = Object.values(inventory).reduce((a, b) => a + b, 0);

  // tick clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // persist game state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cash, unlocked, owned, slots, priceMul, inventory }));
  }, [cash, unlocked, owned, slots, priceMul, inventory]);

  // drift market prices slowly
  useEffect(() => {
    const t = setInterval(() => {
      setPriceMul(prev => {
        const next = { ...prev };
        for (const s of STRAINS) {
          const drift = (Math.random() - 0.5) * 0.08;
          next[s.id] = Math.min(1.6, Math.max(0.6, prev[s.id] + drift));
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const addLog = useCallback((text) => {
    logIdRef.current += 1;
    setLog(prev => [{ id: logIdRef.current, text }, ...prev].slice(0, 6));
  }, []);

  const growProgress = (plant) => {
    const strain = STRAINS.find(s => s.id === plant.strainId);
    const elapsed = (now - plant.plantedAt) / 1000;
    const needed = strain.growSeconds * speedMul;
    return Math.min(1, elapsed / needed);
  };

  const plantSeed = (slotIdx, strainId) => {
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = makePlant(strainId);
      return next;
    });
  };

  const harvest = (slotIdx) => {
    const plant = slots[slotIdx];
    if (!plant || growProgress(plant) < 1) return;
    const strain = STRAINS.find(s => s.id === plant.strainId);
    setInventory(prev => ({ ...prev, [strain.id]: (prev[strain.id] || 0) + 1 }));
    addLog(`${strain.name} geerntet`);
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const sellStrain = (strainId) => {
    const count = inventory[strainId] || 0;
    if (count <= 0) return;
    const strain = STRAINS.find(s => s.id === strainId);
    const price = Math.round(strain.basePrice * priceMul[strainId]);
    const total = price * count;
    setCash(c => c + total);
    setInventory(prev => ({ ...prev, [strainId]: 0 }));
    addLog(`${count}x ${strain.name} verkauft für ${currency(total)}`);
  };

  const buyUpgrade = (upg) => {
    if (cash < upg.cost || hasUpgrade(upg.id)) return;
    setCash(c => c - upg.cost);
    setOwned(prev => [...prev, upg.id]);
    if (upg.id === "extra-slot") setSlots(prev => [...prev, null]);
    addLog(`${upg.name} gekauft`);
  };

  const unlockStrain = (strain) => {
    if (cash < strain.unlockCost || unlocked.includes(strain.id)) return;
    setCash(c => c - strain.unlockCost);
    setUnlocked(prev => [...prev, strain.id]);
    addLog(`${strain.name} freigeschaltet`);
  };

  return (
    <div className="min-h-screen w-full bg-[#10140F] text-[#E9E9E0] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* header */}
      <div className="border-b border-[#2A3324] px-5 py-4 flex items-center justify-between sticky top-0 bg-[#10140F]/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <Leaf size={22} className="text-[#8FBF5A]" />
          <span className="font-display font-bold text-lg tracking-tight">Grow Tycoon</span>
        </div>
        <div className="flex items-center gap-2">
          {totalHarvested > 0 && (
            <div className="flex items-center gap-1.5 bg-[#1A2116] border border-[#2A3324] rounded-full px-4 py-1.5">
              <Package size={16} className="text-[#8FBF5A]" />
              <span className="font-display font-bold text-[#8FBF5A]">{totalHarvested}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-[#1A2116] border border-[#2A3324] rounded-full px-4 py-1.5">
            <DollarSign size={16} className="text-[#C9B94A]" />
            <span className="font-display font-bold text-[#C9B94A]">{currency(cash)}</span>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex px-5 pt-4 gap-1">
        {[
          { id: "grow", label: "Anbau" },
          { id: "market", label: "Markt" },
          { id: "upgrades", label: "Ausbau" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-[#1A2116] text-[#8FBF5A] border-t border-x border-[#2A3324]"
                : "text-[#8A9280] hover:text-[#E9E9E0]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-[#1A2116] border-t border-[#2A3324] px-5 py-6 min-h-[60vh]">
        {tab === "grow" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map((plant, idx) => {
              const strain = plant ? STRAINS.find(s => s.id === plant.strainId) : null;
              const progress = plant ? growProgress(plant) : 0;
              const ready = plant && progress >= 1;
              return (
                <div key={idx} className="bg-[#10140F] border border-[#2A3324] rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-[#6B7362]">Topf {idx + 1}</span>
                    {strain && <span className="text-xs font-medium" style={{ color: strain.color }}>{strain.name}</span>}
                  </div>

                  {!plant ? (
                    <div className="flex-1 flex flex-col justify-center gap-2 py-4">
                      <p className="text-sm text-[#6B7362] mb-1">Leerer Topf</p>
                      <select
                        onChange={(e) => e.target.value && plantSeed(idx, e.target.value)}
                        defaultValue=""
                        className="bg-[#1A2116] border border-[#2A3324] rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="" disabled>Sorte pflanzen...</option>
                        {unlocked.map(id => {
                          const s = STRAINS.find(x => x.id === id);
                          return <option key={id} value={id}>{s.name}</option>;
                        })}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="h-24 flex items-end justify-center">
                        <Sprout
                          size={24 + progress * 48}
                          style={{ color: strain.color }}
                          className="transition-all duration-200"
                        />
                      </div>
                      <div className="w-full h-2 bg-[#2A3324] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{ width: `${progress * 100}%`, backgroundColor: strain.color }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => harvest(idx)}
                          disabled={!ready}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                            ready
                              ? "bg-[#8FBF5A] text-[#10140F] hover:bg-[#a3d16c]"
                              : "bg-[#2A3324] text-[#6B7362] cursor-not-allowed"
                          }`}
                        >
                          {ready ? "Ernten" : "Wächst..."}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "market" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#8A9280] mb-1">Preise schwanken laufend — verkaufe, wenn der Kurs hoch steht.</p>
            {STRAINS.map(s => {
              const mul = priceMul[s.id];
              const price = Math.round(s.basePrice * mul);
              const isUnlocked = unlocked.includes(s.id);
              const up = mul >= 1;
              const owned_ = inventory[s.id] || 0;
              return (
                <div key={s.id} className="bg-[#10140F] border border-[#2A3324] rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-[#6B7362]">Wachstum {s.growSeconds}s{isUnlocked && owned_ > 0 ? ` · ${owned_}x im Lager` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isUnlocked ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          {up ? <TrendingUp size={14} className="text-[#8FBF5A]" /> : <TrendingDown size={14} className="text-[#C97B5C]" />}
                          <span className="font-display font-bold text-sm">{currency(price)}</span>
                        </div>
                        {owned_ > 0 && (
                          <button
                            onClick={() => sellStrain(s.id)}
                            className="flex items-center gap-1.5 text-xs bg-[#8FBF5A] text-[#10140F] rounded-full px-3 py-1.5 font-medium hover:bg-[#a3d16c] transition-colors"
                          >
                            <ShoppingCart size={12} /> {owned_}x verkaufen für {currency(price * owned_)}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => unlockStrain(s)}
                        disabled={cash < s.unlockCost}
                        className="flex items-center gap-1.5 text-xs bg-[#1A2116] border border-[#2A3324] rounded-full px-3 py-1.5 disabled:opacity-40 hover:border-[#8FBF5A] transition-colors"
                      >
                        <Lock size={12} /> Freischalten für {currency(s.unlockCost)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "upgrades" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {UPGRADES.map(u => {
              const Icon = u.icon;
              const owned_ = hasUpgrade(u.id);
              return (
                <div key={u.id} className="bg-[#10140F] border border-[#2A3324] rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-[#1A2116] flex items-center justify-center">
                      <Icon size={16} className="text-[#8FBF5A]" />
                    </div>
                    <span className="font-medium text-sm">{u.name}</span>
                  </div>
                  <p className="text-xs text-[#8A9280] flex-1">{u.desc}</p>
                  <button
                    onClick={() => buyUpgrade(u)}
                    disabled={owned_ || cash < u.cost}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                      owned_
                        ? "bg-[#2A3324] text-[#8FBF5A] cursor-default"
                        : cash < u.cost
                        ? "bg-[#2A3324] text-[#6B7362] cursor-not-allowed"
                        : "bg-[#8FBF5A] text-[#10140F] hover:bg-[#a3d16c]"
                    }`}
                  >
                    {owned_ ? "Aktiv" : <><ShoppingCart size={14} /> {currency(u.cost)}</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* activity log */}
      <div className="px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-[#6B7362] mb-2">Aktivität</p>
        <div className="flex flex-col gap-1">
          {log.length === 0 && <p className="text-sm text-[#6B7362]">Noch keine Ereignisse.</p>}
          {log.map(l => (
            <p key={l.id} className="text-sm text-[#8A9280]">{l.text}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
