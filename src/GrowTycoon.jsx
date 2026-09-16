import React, { useState, useEffect, useCallback, useRef } from "react";
import { Leaf, DollarSign, Package, Zap, Lock, TrendingUp, TrendingDown, Sprout, ShoppingCart } from "lucide-react";

// ---- Game data ----
const STRAINS = [
  { id: "bag-seed", name: "Bag Seed", growSeconds: 14, basePrice: 8, unlockCost: 0, color: "#6B8F5A" },
  { id: "lemon-haze", name: "Lemon Haze", growSeconds: 22, basePrice: 16, unlockCost: 150, color: "#C68A2E" },
  { id: "purple-kush", name: "Purple Kush", growSeconds: 34, basePrice: 29, unlockCost: 600, color: "#9B7ECB" },
  { id: "og-diesel", name: "OG Diesel", growSeconds: 50, basePrice: 47, unlockCost: 2200, color: "#5FAA9F" },
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
    <div className="min-h-screen w-full bg-paper text-ink font-sans paper-grain">
      {/* header */}
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur">
        <div className="h-[3px] bg-forest" />
        <div className="border-b-2 border-ink/80 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-0.5">Kultivierungs-Ledger</p>
            <div className="flex items-center gap-2">
              <Leaf size={20} className="text-forest" />
              <span className="font-display font-extrabold text-xl tracking-tight">Grow Tycoon</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalHarvested > 0 && (
              <div className="flex items-center gap-1.5 bg-paper-dark border border-line border-l-2 border-l-dashed pl-2.5 pr-3 py-1.5 rounded-sm">
                <Package size={14} className="text-forest" />
                <span className="font-mono font-semibold text-sm text-forest">{totalHarvested}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-paper-dark border border-line border-l-2 border-l-dashed pl-2.5 pr-3 py-1.5 rounded-sm">
              <DollarSign size={14} className="text-ochre-dark" />
              <span className="font-mono font-semibold text-sm text-ochre-dark">{currency(cash)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex px-5 pt-4 gap-1.5">
        {[
          { id: "grow", label: "Anbau" },
          { id: "market", label: "Markt" },
          { id: "upgrades", label: "Ausbau" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-t-md text-sm font-medium font-display transition-colors border-2 border-b-0 ${
              tab === t.id
                ? "bg-paper-dark text-forest border-ink/80"
                : "bg-transparent text-ink-soft border-transparent hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-paper-dark border-y-2 border-ink/80 px-5 py-6 min-h-[60vh]">
        {tab === "grow" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map((plant, idx) => {
              const strain = plant ? STRAINS.find(s => s.id === plant.strainId) : null;
              const progress = plant ? growProgress(plant) : 0;
              const ready = plant && progress >= 1;
              return (
                <div key={idx} className="relative cutline bg-paper p-4 flex flex-col gap-3 settle-in">
                  {ready && (
                    <div className="stamp absolute -top-3 -right-3 z-10 -rotate-6 bg-paper border-2 border-rust text-rust font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-sm shadow-sm">
                      Erntebereit
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">Packet N° {String(idx + 1).padStart(2, "0")}</span>
                    {strain && <span className="font-display text-xs font-semibold" style={{ color: strain.color }}>{strain.name}</span>}
                  </div>

                  {!plant ? (
                    <div className="flex-1 flex flex-col justify-center gap-2 py-4">
                      <p className="text-sm text-ink-soft mb-1">Leerer Topf</p>
                      <select
                        onChange={(e) => e.target.value && plantSeed(idx, e.target.value)}
                        defaultValue=""
                        className="bg-paper border border-dashed border-line rounded-sm px-3 py-2 text-sm text-ink"
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
                      <div className="relative w-full h-2 bg-line/60 rounded-sm overflow-hidden">
                        <div
                          className="h-full transition-all duration-200"
                          style={{ width: `${progress * 100}%`, backgroundColor: strain.color }}
                        />
                        <div className="absolute inset-0 flex justify-between px-[24%] pointer-events-none">
                          <span className="w-px h-full bg-paper-dark/70" />
                          <span className="w-px h-full bg-paper-dark/70" />
                          <span className="w-px h-full bg-paper-dark/70" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => harvest(idx)}
                          disabled={!ready}
                          className={`flex-1 rounded-sm py-2 text-sm font-medium font-display transition-colors ${
                            ready
                              ? "bg-forest text-paper hover:bg-forest-dark"
                              : "bg-line/50 text-ink-soft cursor-not-allowed"
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
            <p className="text-sm text-ink-soft mb-1">Preise schwanken laufend — verkaufe, wenn der Kurs hoch steht.</p>
            <div className="flex items-center px-4 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
              <span className="flex-1">Sorte</span>
              <span>Kurs &amp; Bestand</span>
            </div>
            {STRAINS.map(s => {
              const mul = priceMul[s.id];
              const price = Math.round(s.basePrice * mul);
              const isUnlocked = unlocked.includes(s.id);
              const up = mul >= 1;
              const owned_ = inventory[s.id] || 0;
              return (
                <div key={s.id} className="bg-paper border border-line rounded-sm px-4 py-3 flex items-center justify-between settle-in">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full border border-ink/20" style={{ backgroundColor: s.color }} />
                    <div>
                      <p className="font-display font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-ink-soft">Wachstum {s.growSeconds}s{isUnlocked && owned_ > 0 ? ` · ${owned_}x im Lager` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isUnlocked ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          {up ? <TrendingUp size={14} className="text-forest" /> : <TrendingDown size={14} className="text-rust" />}
                          <span className="font-mono font-semibold text-sm">{currency(price)}</span>
                        </div>
                        {owned_ > 0 && (
                          <button
                            onClick={() => sellStrain(s.id)}
                            className="flex items-center gap-1.5 text-xs bg-ochre text-ink rounded-sm px-3 py-1.5 font-medium hover:bg-ochre-dark hover:text-paper transition-colors"
                          >
                            <ShoppingCart size={12} /> {owned_}x verkaufen für {currency(price * owned_)}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => unlockStrain(s)}
                        disabled={cash < s.unlockCost}
                        className="flex items-center gap-1.5 text-xs bg-paper-dark border border-dashed border-rust/60 text-rust rounded-sm px-3 py-1.5 disabled:opacity-40 hover:border-rust transition-colors"
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
                <div key={u.id} className="cutline bg-paper p-4 flex flex-col gap-3 settle-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full border-2 border-forest flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-forest" />
                    </div>
                    <span className="font-display font-semibold text-sm">{u.name}</span>
                  </div>
                  <p className="text-xs text-ink-soft flex-1">{u.desc}</p>
                  <button
                    onClick={() => buyUpgrade(u)}
                    disabled={owned_ || cash < u.cost}
                    className={`flex items-center justify-center gap-1.5 rounded-sm py-2 text-sm font-medium font-display transition-colors ${
                      owned_
                        ? "bg-transparent border-2 border-forest text-forest cursor-default"
                        : cash < u.cost
                        ? "bg-line/50 text-ink-soft cursor-not-allowed"
                        : "bg-ochre text-ink hover:bg-ochre-dark hover:text-paper"
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
      <div className="px-5 pb-6">
        <div className="max-w-xl mx-auto">
          <div className="perforated rounded-b-sm" />
          <div className="bg-paper-dark border-x border-b border-line rounded-b-sm px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft mb-2">Aktivität</p>
            <div className="flex flex-col gap-1">
              {log.length === 0 && <p className="font-mono text-xs text-ink-soft">Noch keine Ereignisse.</p>}
              {log.map(l => (
                <p key={l.id} className="font-mono text-xs text-ink">» {l.text}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
