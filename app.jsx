const { useState, useMemo, useRef, useEffect } = React;
const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } = Recharts;

// Lucide Adaptador Global
const LucideIcon = ({ name, size = 20, color = "currentColor", className = "" }) => {
  useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [name]);
  const formatted = name ? name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() : 'more-horizontal';
  return <i data-lucide={formatted} className={className} style={{ fontSize: size, color: color, display: 'inline-flex', verticalAlign: 'middle', width: size, height: size }}></i>;
};

/* ---------------------------------------------------------------------- */
/*  ALMACENAMIENTO PERSISTENTE                                             */
/*  Usa window.storage (disponible dentro de artifacts de Claude). Si la   */
/*  app se despliega fuera de Claude, sustituye este objeto por llamadas   */
/*  a tu propio backend / base de datos — el resto de la app no cambia.    */
/* ---------------------------------------------------------------------- */

const STORAGE_KEY = "finanzapro_state_v1";
const hasStorage = typeof window !== "undefined" && !!window.storage;

const Store = {
  async load() {
    if (!hasStorage) return null;
    try {
      const res = await window.storage.get(STORAGE_KEY, false);
      if (res && res.value) return JSON.parse(res.value);
      return null;
    } catch (e) {
      return null;
    }
  },
  async save(payload) {
    if (!hasStorage) return false;
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(payload), false);
      return true;
    } catch (e) {
      return false;
    }
  },
  async clear() {
    if (!hasStorage) return false;
    try {
      await window.storage.delete(STORAGE_KEY, false);
      return true;
    } catch (e) {
      return false;
    }
  },
};

/* ---------------------------------------------------------------------- */
/*  VOZ: reconocimiento (STT) y lectura en voz alta (TTS)                  */
/*  Se usa la Web Speech API nativa del navegador: sin librerías extra,    */
/*  cero costo, funciona en Chrome/Edge/Android. En navegadores sin        */
/*  soporte (Safari/Firefox a veces) los botones se ocultan solos.         */
/* ---------------------------------------------------------------------- */

const SpeechRecognitionAPI =
  typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const voiceInputSupported = !!SpeechRecognitionAPI;
const voiceOutputSupported = typeof window !== "undefined" && !!window.speechSynthesis;

function recognizeSpeech({ onResult, onError, onEnd }) {
  if (!SpeechRecognitionAPI) {
    onError && onError("unsupported");
    return null;
  }
  const rec = new SpeechRecognitionAPI();
  rec.lang = "es-MX";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => onResult(e.results[0][0].transcript);
  rec.onerror = (e) => onError && onError(e.error);
  rec.onend = () => onEnd && onEnd();
  try {
    rec.start();
  } catch (e) {
    onError && onError("start_failed");
  }
  return rec;
}

function speak(text) {
  if (!voiceOutputSupported || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-MX";
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  } catch (e) {}
}

/* ---------------------------------------------------------------------- */
/*  DATOS: iconos, categorías, temas                                       */
/* ---------------------------------------------------------------------- */

const ICONS = {
  Briefcase, TrendingUp, Gift, PlusCircle, Utensils, Car, Home, Heart,
  ShoppingBag, Zap, MoreHorizontal, ShoppingCart, Users, Building2,
  Megaphone, Package, Landmark, Laptop, Popcorn, Receipt, DollarSign,
  Target, Rocket, Wallet,
};

const CATEGORIES = {
  personal: {
    ingreso: [
      { id: "salario", name: "Salario", icon: "Briefcase", color: "#1E3A8A" },
      { id: "freelance", name: "Freelance", icon: "Laptop", color: "#6366F1" },
      { id: "inversion", name: "Inversión", icon: "TrendingUp", color: "#10B981" },
      { id: "regalo", name: "Regalo", icon: "Gift", color: "#F59E0B" },
      { id: "otro_ing", name: "Otro", icon: "PlusCircle", color: "#64748B" },
    ],
    gasto: [
      { id: "comida", name: "Comida", icon: "Utensils", color: "#F59E0B" },
      { id: "transporte", name: "Transporte", icon: "Car", color: "#3B82F6" },
      { id: "hogar", name: "Hogar", icon: "Home", color: "#8B5CF6" },
      { id: "salud", name: "Salud", icon: "Heart", color: "#EF4444" },
      { id: "entretenimiento", name: "Ocio", icon: "Popcorn", color: "#EC4899" },
      { id: "compras", name: "Compras", icon: "ShoppingBag", color: "#F97316" },
      { id: "servicios", name: "Servicios", icon: "Zap", color: "#EAB308" },
      { id: "otro_gasto", name: "Otro", icon: "MoreHorizontal", color: "#64748B" },
    ],
  },
  empresa: {
    ingreso: [
      { id: "ventas", name: "Ventas", icon: "ShoppingCart", color: "#1E3A8A" },
      { id: "servicios_prestados", name: "Servicios", icon: "Briefcase", color: "#6366F1" },
      { id: "otros_ing_e", name: "Otros ingresos", icon: "PlusCircle", color: "#10B981" },
    ],
    gasto: [
      { id: "nomina", name: "Nómina", icon: "Users", color: "#EF4444" },
      { id: "renta", name: "Renta", icon: "Building2", color: "#8B5CF6" },
      { id: "marketing", name: "Marketing", icon: "Megaphone", color: "#EC4899" },
      { id: "suministros", name: "Suministros", icon: "Package", color: "#F97316" },
      { id: "servicios_e", name: "Servicios", icon: "Zap", color: "#EAB308" },
      { id: "impuestos", name: "Impuestos", icon: "Landmark", color: "#64748B" },
      { id: "otro_gasto_e", name: "Otro", icon: "MoreHorizontal", color: "#94A3B8" },
    ],
  },
};

const THEMES = {
  soft: {
    label: "Neutro / Soft", bg: "#F8F9FA", card: "#FFFFFF", primary: "#1E3A8A",
    primarySoft: "#E9EEFB", accent: "#F59E0B", success: "#10B981", danger: "#EF4444",
    text: "#111827", textMuted: "#6B7280", border: "#E5E7EB", nav: "#FFFFFF",
  },
  navy: {
    label: "Azul Marino", bg: "#EEF2FB", card: "#FFFFFF", primary: "#0B1E4D",
    primarySoft: "#DCE4F7", accent: "#F59E0B", success: "#10B981", danger: "#EF4444",
    text: "#0B1E4D", textMuted: "#5B6B93", border: "#D9E1F5", nav: "#FFFFFF",
  },
  green: {
    label: "Verde Clásico", bg: "#F1FAF5", card: "#FFFFFF", primary: "#065F46",
    primarySoft: "#DBF3E7", accent: "#F59E0B", success: "#10B981", danger: "#EF4444",
    text: "#0F2C22", textMuted: "#5C7A6E", border: "#DAEEE3", nav: "#FFFFFF",
  },
  dark: {
    label: "Modo Oscuro", bg: "#0B0F19", card: "#131A2A", primary: "#5B7CFA",
    primarySoft: "#1D2440", accent: "#FBBF24", success: "#34D399", danger: "#F87171",
    text: "#F3F4F6", textMuted: "#93A0B8", border: "#232B3E", nav: "#131A2A",
  },
};

/* Estado inicial: SIEMPRE vacío. El usuario empieza de cero con sus propios datos. */
const EMPTY_STATE = {
  version: 1,
  userName: "",
  mode: "personal",
  themeKey: "soft",
  currency: "USD",
  onboarded: false,
  voiceEnabled: false,
  transactions: [],
  goals: [],
  budgets: {},
  debts: [],
  assets: [],
  liabilities: [],
  bills: [],
  xp: 0,
  streak: 0,
  lastLogDate: null,
  chatHistories: { personal: [], empresa: [] },
};

/* ---------------------------------------------------------------------- */
/*  HELPERS DE FECHA / FORMATO                                             */
/* ---------------------------------------------------------------------- */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  return (dateStr || todayISO()).slice(0, 7);
}

function shiftMonthKey(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.toISOString().slice(0, 7);
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "short" });
}

function monthLabelFull(key) {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function lastNMonthsKeys(n, endKey) {
  const base = endKey || monthKey(todayISO());
  const [y, m] = base.split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

function daysBetween(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function fmt(n, currency = "USD") {
  const v = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `$${v.toFixed(0)}`;
  }
}

function findCategory(mode, type, id) {
  const list = CATEGORIES[mode]?.[type] || [];
  return list.find((c) => c.id === id) || list.find((c) => c.name.toLowerCase() === String(id).toLowerCase()) || { id, name: id, icon: "MoreHorizontal", color: "#64748B" };
}

function fallbackCategoryId(mode, type) {
  if (type === "ingreso") return mode === "personal" ? "otro_ing" : "otros_ing_e";
  return mode === "personal" ? "otro_gasto" : "otro_gasto_e";
}

/* ---------------------------------------------------------------------- */
/*  CONTEXTO FINANCIERO PARA LA IA                                         */
/* ---------------------------------------------------------------------- */

function buildFinancialContext({ userName, mode, currency, selectedMonth, transactions, goals, budgets, debts, assets, liabilities, bills }) {
  if (transactions.length === 0 && goals.length === 0 && debts.length === 0 && assets.length === 0) {
    return `El usuario ${userName ? `(${userName}) ` : ""}todavía NO tiene ningún registro en modo ${mode === "personal" ? "personal" : "empresa"}. No inventes cifras: invítalo a registrar su primer movimiento o hazle preguntas para entender su situación.`;
  }

  const thisMonth = monthKey(todayISO());
  const txThisMonth = transactions.filter((t) => monthKey(t.date) === thisMonth);
  const ingresos = txThisMonth.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const gastos = txThisMonth.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);

  const catBreakdown = {};
  txThisMonth.filter((t) => t.type === "gasto").forEach((t) => {
    const cat = findCategory(mode, "gasto", t.category);
    catBreakdown[cat.name] = (catBreakdown[cat.name] || 0) + t.amount;
  });
  const catLines = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).map(([n, v]) => `  - ${n}: ${fmt(v, currency)}`).join("\n");

  let out = "";
  if (userName) out += `Nombre del usuario: ${userName}\n`;
  out += `Modo activo: ${mode === "personal" ? "Finanzas Personales" : "Empresa / Microempresa"}\n`;
  out += `Moneda: ${currency}\n`;
  out += `Mes que el usuario está viendo en la app ahora mismo: ${monthLabelFull(selectedMonth)}\n`;
  out += `${mode === "personal" ? "Ingresos" : "Ventas"} del mes en curso (real, hoy): ${fmt(ingresos, currency)}\n`;
  out += `${mode === "personal" ? "Gastos" : "Costos operativos"} del mes en curso: ${fmt(gastos, currency)}\n`;
  out += `${mode === "personal" ? "Balance" : "Utilidad neta"} del mes en curso: ${fmt(ingresos - gastos, currency)}\n`;
  if (catLines) out += `Desglose por categoría este mes:\n${catLines}\n`;

  if (mode === "personal") {
    if (Object.keys(budgets).length) {
      out += `Presupuestos mensuales:\n`;
      Object.entries(budgets).forEach(([catId, limit]) => {
        const spent = catBreakdown[findCategory("personal", "gasto", catId).name] || 0;
        out += `  - ${findCategory("personal", "gasto", catId).name}: presupuesto ${fmt(limit, currency)}, gastado ${fmt(spent, currency)}${spent > limit ? " (EXCEDIDO)" : ""}\n`;
      });
    }
    if (goals.length) {
      out += `Metas de ahorro:\n`;
      goals.forEach((g) => { out += `  - ${g.name}: ${fmt(g.current, currency)} de ${fmt(g.target, currency)} (${Math.round((g.current / g.target) * 100)}%)\n`; });
    }
  }

  if (debts.length) {
    out += `Deudas activas:\n`;
    debts.forEach((d) => { out += `  - ${d.name}: saldo ${fmt(d.balance, currency)}, tasa ${d.rate}% anual, pago mínimo ${fmt(d.minPayment, currency)}\n`; });
  }

  if (mode === "empresa") {
    const totalAssets = assets.reduce((s, a) => s + a.value, 0);
    const totalLiab = liabilities.reduce((s, l) => s + l.value, 0);
    out += `Balance general: Activos ${fmt(totalAssets, currency)}, Pasivos ${fmt(totalLiab, currency)}, Patrimonio neto ${fmt(totalAssets - totalLiab, currency)}\n`;
  }

  if (bills.length) {
    out += `Pagos recurrentes:\n`;
    bills.forEach((b) => { out += `  - ${b.name}: ${fmt(b.amount, currency)}, vence día ${b.dueDay}\n`; });
  }

  out += `Total de movimientos históricos registrados: ${transactions.length}\n`;
  return out;
}

const CHAT_SYSTEM_INSTRUCTIONS = `
Eres el "Asesor FinanzaPro AI": un analista financiero experto Y un psicólogo financiero, integrado dentro de la app FinanzaPro AI. Hablas español, cercano, profesional, sin tecnicismos innecesarios, sin juzgar nunca las decisiones pasadas del usuario. Das consejos concretos y accionables, con números cuando ayudan. Sé breve (4-8 líneas) salvo que pidan un análisis a fondo.

CAPACIDAD DE ACCIÓN: si el usuario te pide explícitamente REGISTRAR, AGREGAR o CREAR un ingreso, gasto, meta de ahorro, presupuesto o deuda, y tienes los datos mínimos (al menos el monto), responde con tu mensaje normal en texto Y agrega al final, en una línea aparte, un bloque de acción con este formato EXACTO (JSON válido en una sola línea, sin markdown, sin comillas triples):
@ACTION@{"action":"add_transaction","type":"gasto","category":"comida","amount":50,"note":"Almuerzo"}

Tipos de acción soportados:
- add_transaction: {"action":"add_transaction","type":"ingreso"|"gasto","category":"<id o nombre de categoría>","amount":number,"note":"texto opcional"}
- add_goal: {"action":"add_goal","name":"texto","target":number,"current":number opcional}
- add_budget: {"action":"add_budget","category":"<id o nombre>","limit":number}
- add_debt: {"action":"add_debt","name":"texto","balance":number,"rate":number,"minPayment":number}

Categorías de gasto válidas (modo personal): comida, transporte, hogar, salud, entretenimiento, compras, servicios, otro_gasto.
Categorías de ingreso válidas (modo personal): salario, freelance, inversion, regalo, otro_ing.
Categorías de gasto válidas (modo empresa): nomina, renta, marketing, suministros, servicios_e, impuestos, otro_gasto_e.
Categorías de ingreso válidas (modo empresa): ventas, servicios_prestados, otros_ing_e.

Si el usuario no da un monto o dato imprescindible, NO generes el bloque @ACTION@: pregúntale primero lo que falta. Si solo te pide análisis, consejo u opinión (no una acción), nunca generes el bloque @ACTION@. Solo puedes generar UN bloque @ACTION@ por respuesta.`;

function parseActionFromReply(text) {
  const match = text.match(/@ACTION@(\{.*\})\s*$/m);
  if (!match) return { cleanText: text.trim(), action: null };
  let action = null;
  try {
    action = JSON.parse(match[1]);
  } catch (e) {
    action = null;
  }
  const cleanText = text.replace(match[0], "").trim();
  return { cleanText, action };
}

/* ---------------------------------------------------------------------- */
/*  UI PRIMITIVAS                                                          */
/* ---------------------------------------------------------------------- */

function Card({ th, className = "", children, style = {} }) {
  return (
    <div
      className={`rounded-3xl p-4 shadow-[0_6px_24px_-8px_rgba(17,24,39,0.15)] ${className}`}
      style={{ background: th.card, border: `1px solid ${th.border}`, ...style }}
    >
      {children}
    </div>
  );
}

function Pill({ th, active, onClick, children, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all shrink-0"
      style={{ background: active ? th.primary : th.primarySoft, color: active ? "#FFFFFF" : th.primary }}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function ProgressBar({ pct, color, bg }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: bg }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

function IconBubble({ name, color, size = 20 }) {
  const Ico = ICONS[name] || MoreHorizontal;
  return (
    <div className="flex items-center justify-center rounded-2xl shrink-0" style={{ width: size * 2, height: size * 2, background: `${color}20`, color }}>
      <Ico size={size} />
    </div>
  );
}

function EmptyState({ th, icon: Icon, title, body, actionLabel, onAction, actionLabel2, onAction2 }) {
  return (
    <Card th={th} className="text-center !py-7 mb-3">
      <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-3" style={{ background: th.primarySoft }}>
        <Icon size={24} color={th.primary} />
      </div>
      <p className="text-[14px] font-bold mb-1" style={{ color: th.text }}>{title}</p>
      <p className="text-[12.5px] mb-4 leading-snug px-2" style={{ color: th.textMuted }}>{body}</p>
      <div className="flex flex-col gap-2 px-2">
        {actionLabel && (
          <button onClick={onAction} className="w-full rounded-2xl py-2.5 font-bold text-[13px]" style={{ background: th.primary, color: "#fff" }}>
            {actionLabel}
          </button>
        )}
        {actionLabel2 && (
          <button onClick={onAction2} className="w-full rounded-2xl py-2.5 font-semibold text-[13px]" style={{ background: th.primarySoft, color: th.primary }}>
            {actionLabel2}
          </button>
        )}
      </div>
    </Card>
  );
}

function Modal({ th, onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(17,24,39,0.5)" }} onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-8" style={{ background: th.card }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: th.text }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: th.primarySoft }}>
            <X size={16} color={th.primary} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ th, title, body, confirmLabel = "Confirmar", danger, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <div className="absolute inset-0" style={{ background: "rgba(17,24,39,0.6)" }} onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-3xl p-5" style={{ background: th.card }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: danger ? `${th.danger}20` : th.primarySoft }}>
          <AlertTriangle size={20} color={danger ? th.danger : th.primary} />
        </div>
        <p className="text-[15px] font-bold mb-1.5" style={{ color: th.text }}>{title}</p>
        <p className="text-[12.5px] mb-5 leading-snug" style={{ color: th.textMuted }}>{body}</p>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="flex-1 rounded-2xl py-2.5 font-semibold text-[13px]" style={{ background: th.primarySoft, color: th.primary }}>Cancelar</button>
          <button onClick={onConfirm} className="flex-1 rounded-2xl py-2.5 font-bold text-[13px]" style={{ background: danger ? th.danger : th.primary, color: "#fff" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ th, title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-1">
      <div>
        <h2 className="text-lg font-bold" style={{ color: th.text }}>{title}</h2>
        {subtitle && <p className="text-[12.5px]" style={{ color: th.textMuted }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ONBOARDING                                                              */
/* ---------------------------------------------------------------------- */

function Onboarding({ th, onFinish }) {
  const [name, setName] = useState("");
  const [chosenMode, setChosenMode] = useState("personal");
  return (
    <div className="fixed inset-0 z-50 flex justify-center" style={{ background: th.bg }}>
      <div className="w-full max-w-md h-full flex flex-col px-6 py-10 overflow-y-auto">
        <div className="w-14 h-14 rounded-3xl flex items-center justify-center mb-5" style={{ background: th.primary }}>
          <Sparkles size={26} color="#fff" />
        </div>
        <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: th.text }}>Bienvenido a FinanzaPro AI</h1>
        <p className="text-[13.5px] mb-8 leading-snug" style={{ color: th.textMuted }}>
          Esta app empieza completamente en blanco: no hay datos de ejemplo ni información precargada. Todo lo que registres es tuyo, se guarda automáticamente y solo se borra si tú lo decides.
        </p>

        <p className="text-[12.5px] font-semibold mb-2" style={{ color: th.textMuted }}>¿Cómo quieres que te llamemos? (opcional)</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre"
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none mb-6" style={{ background: th.primarySoft, color: th.text }}
        />

        <p className="text-[12.5px] font-semibold mb-2" style={{ color: th.textMuted }}>¿Con qué quieres empezar?</p>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => setChosenMode("personal")}
            className="rounded-2xl p-4 text-left border-2"
            style={{ background: th.card, borderColor: chosenMode === "personal" ? th.primary : th.border }}
          >
            <Home size={20} color={th.primary} />
            <p className="text-[13px] font-bold mt-2" style={{ color: th.text }}>Finanzas personales</p>
            <p className="text-[11px] mt-0.5" style={{ color: th.textMuted }}>Ingresos, gastos, metas y deudas</p>
          </button>
          <button
            onClick={() => setChosenMode("empresa")}
            className="rounded-2xl p-4 text-left border-2"
            style={{ background: th.card, borderColor: chosenMode === "empresa" ? th.primary : th.border }}
          >
            <Building2 size={20} color={th.primary} />
            <p className="text-[13px] font-bold mt-2" style={{ color: th.text }}>Mi empresa</p>
            <p className="text-[11px] mt-0.5" style={{ color: th.textMuted }}>P&L, balance y flujo de caja</p>
          </button>
        </div>

        <div className="mt-auto">
          <button onClick={() => onFinish({ name: name.trim(), mode: chosenMode })} className="w-full rounded-2xl py-3.5 font-bold text-[15px]" style={{ background: th.primary, color: "#fff" }}>
            Empezar de cero
          </button>
          <p className="text-[10.5px] text-center mt-3" style={{ color: th.textMuted }}>
            Podrás cambiar de modo, importar datos o restablecer todo cuando quieras desde Configuración.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  MOTOR DE IA — ALERTAS AUTOMÁTICAS                                       */
/* ---------------------------------------------------------------------- */

function useAIInsights({ mode, transactions, budgets, debts, assets, liabilities, bills }) {
  return useMemo(() => {
    const insights = [];
    const thisMonth = monthKey(todayISO());

    if (mode === "personal") {
      Object.entries(budgets).forEach(([catId, limit]) => {
        if (!limit) return;
        const spent = transactions.filter((t) => t.type === "gasto" && t.category === catId && monthKey(t.date) === thisMonth).reduce((s, t) => s + t.amount, 0);
        if (spent > limit) {
          const cat = findCategory("personal", "gasto", catId);
          const pctOver = Math.round(((spent - limit) / limit) * 100);
          insights.push({
            type: "warning", icon: "AlertTriangle", title: `Fuga de dinero en ${cat.name}`,
            body: `Ya gastaste ${fmt(spent)} de un presupuesto de ${fmt(limit)}, un ${pctOver}% por encima. Considera pausar gastos en esta categoría.`,
          });
        }
      });

      if (transactions.length > 0) {
        const monthsData = lastNMonthsKeys(3);
        const avgExpense = monthsData.reduce((s, mk) => s + transactions.filter(t => t.type === "gasto" && monthKey(t.date) === mk).reduce((a, t) => a + t.amount, 0), 0) / monthsData.length || 1;
        const liquid = transactions.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0) - transactions.filter(t => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
        const coverageMonths = Math.max(0, liquid / avgExpense);
        insights.push({
          type: coverageMonths >= 3 ? "success" : "warning",
          icon: coverageMonths >= 3 ? "BadgeCheck" : "AlertTriangle",
          title: "Salud financiera: fondo de emergencia",
          body: `Tu colchón actual cubriría ~${coverageMonths.toFixed(1)} meses de gastos. ${coverageMonths >= 3 ? "¡Vas muy bien! La meta recomendada es de 3 a 6 meses." : "Se recomienda alcanzar al menos 3 meses de cobertura."}`,
        });
      }

      if (debts.length) {
        const first = [...debts].sort((a, b) => b.rate - a.rate)[0];
        insights.push({
          type: "info", icon: "Snowflake", title: "Recomendación para liquidar deudas",
          body: `Enfoca los pagos extra en "${first.name}" primero (saldo ${fmt(first.balance)}, tasa ${first.rate}%). Mantén los pagos mínimos en las demás.`,
        });
      }
    } else {
      if (assets.length > 0 || liabilities.length > 0) {
        const currentAssets = assets.filter(a => a.type === "Corriente").reduce((s, a) => s + a.value, 0);
        const currentLiab = liabilities.filter(l => l.type === "Corriente").reduce((s, l) => s + l.value, 0);
        const ratio = currentLiab > 0 ? currentAssets / currentLiab : currentAssets > 0 ? 99 : 0;
        insights.push({
          type: ratio >= 1.5 ? "success" : ratio >= 1 ? "info" : "warning",
          icon: ratio >= 1.5 ? "BadgeCheck" : "AlertTriangle",
          title: "Índice de liquidez corriente",
          body: `Tu razón corriente es ${ratio.toFixed(2)}x (activo corriente / pasivo corriente). ${ratio >= 1.5 ? "Buena posición de liquidez." : ratio >= 1 ? "Aceptable, pero con poco margen." : "Riesgo: tus pasivos corrientes superan tus activos líquidos."}`,
        });
      }

      const ventas = transactions.filter(t => t.type === "ingreso" && monthKey(t.date) === thisMonth).reduce((s, t) => s + t.amount, 0);
      const costosPorCat = {};
      transactions.filter(t => t.type === "gasto" && monthKey(t.date) === thisMonth).forEach(t => { costosPorCat[t.category] = (costosPorCat[t.category] || 0) + t.amount; });
      Object.entries(costosPorCat).forEach(([catId, val]) => {
        if (ventas > 0 && val / ventas > 0.35) {
          const cat = findCategory("empresa", "gasto", catId);
          insights.push({
            type: "warning", icon: "AlertTriangle", title: `Costo elevado: ${cat.name}`,
            body: `"${cat.name}" representa ${Math.round((val / ventas) * 100)}% de tus ventas del mes (${fmt(val)}). Revisa si puedes renegociar o reducir este rubro.`,
          });
        }
      });

      if (debts.length) {
        const first = [...debts].sort((a, b) => b.rate - a.rate)[0];
        insights.push({
          type: "info", icon: "Mountain", title: "Plan de liquidación de pasivos",
          body: `Prioriza "${first.name}" (saldo ${fmt(first.balance)}, tasa ${first.rate}%) con el método avalancha para minimizar intereses pagados.`,
        });
      }
    }

    const day = new Date().getDate();
    bills.forEach((b) => {
      const diff = b.dueDay - day;
      if (diff >= 0 && diff <= 5) {
        insights.push({ type: "warning", icon: "Calendar", title: `Pago próximo: ${b.name}`, body: `Vence el día ${b.dueDay} por ${fmt(b.amount)}. Faltan ${diff} día(s).` });
      }
    });

    return insights;
  }, [mode, transactions, budgets, debts, assets, liabilities, bills]);
}

function AIInsightCard({ th, insight }) {
  const colorMap = { warning: th.accent, success: th.success, info: th.primary };
  const color = colorMap[insight.type] || th.primary;
  const Icon = { AlertTriangle, BadgeCheck, Snowflake, Mountain, Calendar, Info }[insight.icon] || Info;
  return (
    <Card th={th} className="!py-3">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
          <Icon size={16} color={color} />
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: th.text }}>{insight.title}</p>
          <p className="text-[12px] mt-0.5 leading-snug" style={{ color: th.textMuted }}>{insight.body}</p>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------------- */
/*  APP                                                                     */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [loaded, setLoaded] = useState(false);

  const [userName, setUserName] = useState("");
  const [mode, setMode] = useState("personal");
  const [themeKey, setThemeKey] = useState("soft");
  const [currency, setCurrency] = useState("USD");
  const [onboarded, setOnboarded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [debts, setDebts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [bills, setBills] = useState([]);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastLogDate, setLastLogDate] = useState(null);
  const [chatHistories, setChatHistories] = useState({ personal: [], empresa: [] });

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(monthKey(todayISO()));
  const [strategy, setStrategy] = useState("avalancha");

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showNovedades, setShowNovedades] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatPrefill, setChatPrefill] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  const th = THEMES[themeKey];

  /* ---- Carga inicial desde almacenamiento persistente ---- */
  useEffect(() => {
    (async () => {
      const saved = await Store.load();
      if (saved) {
        setUserName(saved.userName || "");
        setMode(saved.mode || "personal");
        setThemeKey(saved.themeKey || "soft");
        setCurrency(saved.currency || "USD");
        setOnboarded(!!saved.onboarded);
        setVoiceEnabled(!!saved.voiceEnabled);
        setTransactions(saved.transactions || []);
        setGoals(saved.goals || []);
        setBudgets(saved.budgets || {});
        setDebts(saved.debts || []);
        setAssets(saved.assets || []);
        setLiabilities(saved.liabilities || []);
        setBills(saved.bills || []);
        setXp(saved.xp || 0);
        setStreak(saved.streak || 0);
        setLastLogDate(saved.lastLogDate || null);
        setChatHistories(saved.chatHistories || { personal: [], empresa: [] });
      }
      setLoaded(true);
    })();
  }, []);

  /* ---- Guardado automático (con pequeño debounce) ---- */
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      Store.save({
        version: 1, userName, mode, themeKey, currency, onboarded, voiceEnabled,
        transactions, goals, budgets, debts, assets, liabilities, bills,
        xp, streak, lastLogDate, chatHistories,
      });
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [loaded, userName, mode, themeKey, currency, onboarded, voiceEnabled, transactions, goals, budgets, debts, assets, liabilities, bills, xp, streak, lastLogDate, chatHistories]);

  function switchMode(next) {
    setMode(next);
    setActiveTab("dashboard");
  }

  function registerStreak() {
    const today = todayISO();
    if (lastLogDate === today) return;
    if (lastLogDate && daysBetween(lastLogDate, today) === 1) setStreak((s) => s + 1);
    else setStreak(1);
    setLastLogDate(today);
    setXp((x) => x + 10);
  }

  function addTransaction(tx, targetMode = mode) {
    setTransactions((prev) => [{ ...tx, id: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`, mode: targetMode }, ...prev]);
    registerStreak();
  }

  function addTransactionsBulk(list) {
    setTransactions((prev) => [...list, ...prev]);
  }

  /* ---- Ejecutor de acciones que la IA del chat puede disparar ---- */
  function applyChatAction(action) {
    if (!action || !action.action) return null;
    try {
      if (action.action === "add_transaction") {
        const type = action.type === "ingreso" ? "ingreso" : "gasto";
        const cats = CATEGORIES[mode][type];
        const found = cats.find((c) => c.id === action.category) || cats.find((c) => c.name.toLowerCase() === String(action.category || "").toLowerCase());
        const categoryId = found ? found.id : fallbackCategoryId(mode, type);
        const amount = parseFloat(action.amount);
        if (!amount || amount <= 0) return null;
        addTransaction({ type, category: categoryId, amount, note: action.note || findCategory(mode, type, categoryId).name, date: todayISO() });
        return `✅ Registrado: ${type === "ingreso" ? "Ingreso" : "Gasto"} de ${fmt(amount, currency)} en ${findCategory(mode, type, categoryId).name}.`;
      }
      if (action.action === "add_goal") {
        const target = parseFloat(action.target);
        if (!action.name || !target) return null;
        setGoals((g) => [...g, { id: `g${Date.now()}`, name: action.name, target, current: parseFloat(action.current) || 0, icon: "Target" }]);
        return `✅ Meta creada: "${action.name}" por ${fmt(target, currency)}.`;
      }
      if (action.action === "add_budget") {
        const cats = CATEGORIES[mode].gasto;
        const found = cats.find((c) => c.id === action.category) || cats.find((c) => c.name.toLowerCase() === String(action.category || "").toLowerCase());
        const categoryId = found ? found.id : fallbackCategoryId(mode, "gasto");
        const limit = parseFloat(action.limit);
        if (!limit) return null;
        setBudgets((b) => ({ ...b, [categoryId]: limit }));
        return `✅ Presupuesto de ${findCategory(mode, "gasto", categoryId).name} fijado en ${fmt(limit, currency)}.`;
      }
      if (action.action === "add_debt") {
        const balance = parseFloat(action.balance);
        if (!action.name || !balance) return null;
        setDebts((d) => [...d, { id: `d${Date.now()}`, mode, name: action.name, balance, rate: parseFloat(action.rate) || 0, minPayment: parseFloat(action.minPayment) || 0 }]);
        return `✅ Deuda agregada: "${action.name}" (${fmt(balance, currency)}).`;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  const modeTx = useMemo(() => transactions.filter((t) => t.mode === mode), [transactions, mode]);

  function openChat(prefill = "") {
    setChatPrefill(prefill);
    setShowChat(true);
  }

  async function sendChatMessage(text) {
    if (!text.trim() || chatLoading) return;
    const userMsg = { role: "user", content: text.trim() };
    const nextHistory = [...chatHistories[mode], userMsg];
    setChatHistories((prev) => ({ ...prev, [mode]: nextHistory }));
    setChatLoading(true);

    const context = buildFinancialContext({
      userName, mode, currency, selectedMonth, transactions: modeTx, goals,
      budgets, debts: debts.filter((d) => d.mode === mode),
      assets, liabilities, bills: bills.filter((b) => b.mode === mode),
    });

    const systemPrompt = `${CHAT_SYSTEM_INSTRUCTIONS}\n\nDatos financieros actuales del usuario:\n${context}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const rawText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n") || "No pude generar una respuesta en este momento. Intenta de nuevo.";
      const { cleanText, action } = parseActionFromReply(rawText);
      const actionResult = action ? applyChatAction(action) : null;
      setChatHistories((prev) => ({ ...prev, [mode]: [...prev[mode], { role: "assistant", content: cleanText || rawText, actionResult }] }));
      if (voiceEnabled) speak(cleanText || rawText);
    } catch (e) {
      setChatHistories((prev) => ({ ...prev, [mode]: [...prev[mode], { role: "assistant", content: "Tuve un problema para conectarme. Revisa tu conexión e intenta de nuevo." }] }));
    } finally {
      setChatLoading(false);
    }
  }

  function handleVoiceQuickAdd() {
    if (!voiceInputSupported || voiceListening) return;
    setVoiceListening(true);
    recognizeSpeech({
      onResult: (text) => { openChat(""); sendChatMessage(text); },
      onError: () => setVoiceListening(false),
      onEnd: () => setVoiceListening(false),
    });
  }

  /* ---- Importación / Exportación / Reinicio de datos ---- */
  function exportBackup() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), userName, mode, themeKey, currency, onboarded, voiceEnabled, transactions, goals, budgets, debts, assets, liabilities, bills, xp, streak, lastLogDate, chatHistories };
    downloadBlob(JSON.stringify(payload, null, 2), `finanzapro_respaldo_${todayISO()}.json`, "application/json");
  }

  function importBackupFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setConfirmDialog({
          title: "¿Reemplazar todos tus datos?",
          body: "Vas a importar un respaldo completo. Esto sustituirá todos tus datos actuales (transacciones, metas, presupuestos, deudas y configuración) por los del archivo. Esta acción no se puede deshacer.",
          confirmLabel: "Sí, reemplazar",
          danger: true,
          onConfirm: () => {
            setUserName(parsed.userName || "");
            setMode(parsed.mode || "personal");
            setThemeKey(parsed.themeKey || "soft");
            setCurrency(parsed.currency || "USD");
            setOnboarded(true);
            setVoiceEnabled(!!parsed.voiceEnabled);
            setTransactions(parsed.transactions || []);
            setGoals(parsed.goals || []);
            setBudgets(parsed.budgets || {});
            setDebts(parsed.debts || []);
            setAssets(parsed.assets || []);
            setLiabilities(parsed.liabilities || []);
            setBills(parsed.bills || []);
            setXp(parsed.xp || 0);
            setStreak(parsed.streak || 0);
            setLastLogDate(parsed.lastLogDate || null);
            setChatHistories(parsed.chatHistories || { personal: [], empresa: [] });
            setImportStatus("Respaldo importado correctamente.");
            setConfirmDialog(null);
          },
          onCancel: () => setConfirmDialog(null),
        });
      } catch (e) {
        setImportStatus("El archivo no es un respaldo válido de FinanzaPro AI.");
      }
    };
    reader.readAsText(file);
  }

  function mapImportedRow(row) {
    const norm = {};
    Object.keys(row).forEach((k) => { norm[k.trim().toLowerCase()] = row[k]; });
    const date = norm["fecha"] || norm["date"] || todayISO();
    const typeRaw = (norm["tipo"] || norm["type"] || "gasto").toString().toLowerCase();
    const type = typeRaw.includes("ingr") || typeRaw.includes("income") ? "ingreso" : "gasto";
    const catName = norm["categoría"] || norm["categoria"] || norm["category"] || "";
    const cats = CATEGORIES[mode][type];
    const found = cats.find((c) => c.name.toLowerCase() === String(catName).toLowerCase()) || cats.find((c) => c.id === catName);
    const category = found ? found.id : fallbackCategoryId(mode, type);
    const amount = parseFloat(norm["monto"] || norm["amount"] || 0);
    const note = norm["nota"] || norm["note"] || "";
    if (!amount || amount <= 0) return null;
    return { id: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`, mode, type, category, amount, note, date: String(date).slice(0, 10) };
  }

  function importTransactionsFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => {
          const rows = res.data.map(mapImportedRow).filter(Boolean);
          addTransactionsBulk(rows);
          setImportStatus(`Se importaron ${rows.length} movimientos (${res.data.length - rows.length} filas omitidas).`);
        },
        error: () => setImportStatus("No se pudo leer el archivo CSV."),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
          const sheetName = wb.SheetNames.includes("Transacciones") ? "Transacciones" : wb.SheetNames[0];
          const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
          const rows = json.map(mapImportedRow).filter(Boolean);
          addTransactionsBulk(rows);
          setImportStatus(`Se importaron ${rows.length} movimientos (${json.length - rows.length} filas omitidas).`);
        } catch (e) {
          setImportStatus("No se pudo leer el archivo Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setImportStatus("Formato no soportado. Usa .csv, .xlsx o .json (respaldo completo).");
    }
  }

  function requestResetAll() {
    setConfirmDialog({
      title: "¿Borrar todos tus datos?",
      body: "Se eliminarán permanentemente todas tus transacciones, metas, presupuestos, deudas, balance y conversaciones con la IA en ambos modos. Esta acción no se puede deshacer.",
      confirmLabel: "Sí, borrar todo",
      danger: true,
      onConfirm: async () => {
        await Store.clear();
        setUserName(""); setMode("personal"); setThemeKey("soft"); setCurrency("USD");
        setOnboarded(false); setVoiceEnabled(false);
        setTransactions([]); setGoals([]); setBudgets({}); setDebts([]); setAssets([]); setLiabilities([]); setBills([]);
        setXp(0); setStreak(0); setLastLogDate(null); setChatHistories({ personal: [], empresa: [] });
        setConfirmDialog(null); setShowConfig(false);
      },
      onCancel: () => setConfirmDialog(null),
    });
  }

  const tabsPersonal = [
    { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
    { id: "registro", label: "Registrar", icon: PlusCircle },
    { id: "metas", label: "Metas", icon: Target },
    { id: "presupuestos", label: "Presupuesto", icon: ListChecks },
    { id: "deudas", label: "Deudas", icon: CreditCard },
  ];
  const tabsEmpresa = [
    { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
    { id: "pl", label: "P&L", icon: FileText },
    { id: "balance", label: "Balance", icon: Scale },
    { id: "cashflow", label: "Flujo", icon: LineChartIcon },
    { id: "export", label: "Exportar", icon: FileSpreadsheet },
  ];
  const tabs = mode === "personal" ? tabsPersonal : tabsEmpresa;

  if (!loaded) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: THEMES.soft.bg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: THEMES.soft.primary }}>
            <Sparkles size={22} color="#fff" />
          </div>
          <p className="text-[12.5px]" style={{ color: THEMES.soft.textMuted }}>Cargando tus datos…</p>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <Onboarding
        th={th}
        onFinish={({ name, mode: chosenMode }) => {
          setUserName(name);
          setMode(chosenMode);
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full font-sans" style={{ background: th.bg, color: th.text }}>
      <div className="max-w-md mx-auto min-h-screen relative pb-24" style={{ background: th.bg }}>
        <TopBar
          th={th} mode={mode} switchMode={switchMode}
          onConfig={() => setShowConfig(true)}
          onNovedades={() => setShowNovedades(true)}
          onChat={() => openChat("")}
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        />

        <main className="px-4 pt-3">
          {activeTab === "dashboard" && (
            <Dashboard
              th={th} mode={mode} currency={currency} userName={userName}
              transactions={modeTx} selectedMonth={selectedMonth}
              goals={goals} budgets={budgets} debts={debts.filter(d => d.mode === mode)}
              assets={assets} liabilities={liabilities} bills={bills.filter(b => b.mode === mode)}
              streak={streak} xp={xp} voiceListening={voiceListening} voiceInputSupported={voiceInputSupported}
              onOpenQuickAdd={() => setShowQuickAdd(true)}
              onOpenSimulator={() => setShowSimulator(true)}
              onOpenChat={openChat}
              onVoiceQuickAdd={handleVoiceQuickAdd}
              setActiveTab={setActiveTab}
            />
          )}

          {mode === "personal" && activeTab === "registro" && (
            <div className="pt-1">
              <SectionTitle th={th} title="Registro rápido" subtitle="Agrega un ingreso o gasto en segundos" />
              <QuickAddForm th={th} mode={mode} currency={currency} onSubmit={addTransaction} selectedMonth={selectedMonth} embedded />
              <RecentList th={th} currency={currency} mode={mode} selectedMonth={selectedMonth} transactions={modeTx} />
            </div>
          )}

          {mode === "personal" && activeTab === "metas" && (
            <MetasRetiro th={th} currency={currency} goals={goals} setGoals={setGoals} transactions={modeTx} />
          )}

          {mode === "personal" && activeTab === "presupuestos" && (
            <Presupuestos th={th} currency={currency} budgets={budgets} setBudgets={setBudgets} transactions={modeTx} selectedMonth={selectedMonth} />
          )}

          {mode === "personal" && activeTab === "deudas" && (
            <Deudas th={th} currency={currency} debts={debts.filter(d => d.mode === "personal")} setDebts={setDebts} strategy={strategy} setStrategy={setStrategy} />
          )}

          {mode === "empresa" && activeTab === "pl" && (
            <PL th={th} currency={currency} transactions={modeTx} selectedMonth={selectedMonth} />
          )}

          {mode === "empresa" && activeTab === "balance" && (
            <BalanceGeneral th={th} currency={currency} assets={assets} setAssets={setAssets} liabilities={liabilities} setLiabilities={setLiabilities} />
          )}

          {mode === "empresa" && activeTab === "cashflow" && (
            <CashFlow th={th} currency={currency} transactions={modeTx} selectedMonth={selectedMonth} />
          )}

          {mode === "empresa" && activeTab === "export" && (
            <Exportar th={th} currency={currency} transactions={modeTx} assets={assets} liabilities={liabilities} />
          )}
        </main>

        <BottomNav th={th} tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} onQuickAdd={() => setShowQuickAdd(true)} />

        {showQuickAdd && (
          <Modal th={th} onClose={() => setShowQuickAdd(false)} title="Registro rápido">
            <QuickAddForm th={th} mode={mode} currency={currency} onSubmit={(tx) => { addTransaction(tx); setShowQuickAdd(false); }} selectedMonth={selectedMonth} />
          </Modal>
        )}

        {showConfig && (
          <Modal th={th} onClose={() => setShowConfig(false)} title="Configuración">
            <ConfigPanel
              th={th} themeKey={themeKey} setThemeKey={setThemeKey} currency={currency} setCurrency={setCurrency}
              userName={userName} setUserName={setUserName} voiceEnabled={voiceEnabled} setVoiceEnabled={setVoiceEnabled}
              onExportBackup={exportBackup} onImportBackupFile={importBackupFile} onImportTransactionsFile={importTransactionsFile}
              onResetAll={requestResetAll} importStatus={importStatus} setImportStatus={setImportStatus}
              hasStorage={hasStorage}
            />
          </Modal>
        )}

        {showNovedades && (
          <Modal th={th} onClose={() => setShowNovedades(false)} title="Novedades y sugerencias de la IA">
            <Novedades th={th} />
          </Modal>
        )}

        {showSimulator && (
          <Modal th={th} onClose={() => setShowSimulator(false)} title="Simulador de crédito e inflación">
            <CreditInflationSimulator th={th} currency={currency} />
          </Modal>
        )}

        {showChat && (
          <ChatPanel
            th={th} mode={mode} messages={chatHistories[mode]} loading={chatLoading}
            prefill={chatPrefill} onSend={sendChatMessage} onClose={() => setShowChat(false)}
            voiceEnabled={voiceEnabled} setVoiceEnabled={setVoiceEnabled}
          />
        )}

        {confirmDialog && (
          <ConfirmDialog th={th} title={confirmDialog.title} body={confirmDialog.body} confirmLabel={confirmDialog.confirmLabel} danger={confirmDialog.danger} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} />
        )}
      </div>
    </div>
  );
}

function downloadBlob(content, filename, type) {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Error exportando:", e);
  }
}

/* ---------------------------------------------------------------------- */
/*  TOPBAR + SELECTOR DE MES (siempre visible)                             */
/* ---------------------------------------------------------------------- */

function TopBar({ th, mode, switchMode, onConfig, onNovedades, onChat, selectedMonth, setSelectedMonth }) {
  const isCurrentMonth = selectedMonth === monthKey(todayISO());
  return (
    <div className="sticky top-0 z-20 px-4 pt-4 pb-3 backdrop-blur" style={{ background: `${th.bg}E6`, borderBottom: `1px solid ${th.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.primary }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <div>
            <p className="text-[15px] font-bold leading-none" style={{ color: th.text }}>FinanzaPro AI</p>
            <p className="text-[11px] leading-none mt-1" style={{ color: th.textMuted }}>{mode === "personal" ? "Modo Personal" : "Modo Empresa / Contable"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onChat} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.primary }}>
            <MessageCircle size={17} color="#fff" />
          </button>
          <button onClick={onNovedades} className="w-9 h-9 rounded-2xl flex items-center justify-center relative" style={{ background: th.primarySoft }}>
            <Bell size={17} color={th.primary} />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full" style={{ background: th.accent }} />
          </button>
          <button onClick={onConfig} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.primarySoft }}>
            <Settings size={17} color={th.primary} />
          </button>
        </div>
      </div>

      <div className="flex p-1 rounded-2xl mb-2.5" style={{ background: th.primarySoft }}>
        {[{ id: "personal", label: "Personal", icon: Home }, { id: "empresa", label: "Empresa", icon: Building2 }].map((m) => (
          <button
            key={m.id} onClick={() => switchMode(m.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: mode === m.id ? th.primary : "transparent", color: mode === m.id ? "#fff" : th.primary }}
          >
            <m.icon size={15} />{m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl px-2 py-1.5" style={{ background: th.card, border: `1px solid ${th.border}` }}>
        <button onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: th.primarySoft }}>
          <ChevronLeft size={14} color={th.primary} />
        </button>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={13} color={th.textMuted} />
          <span className="text-[12.5px] font-bold" style={{ color: th.text }}>{monthLabelFull(selectedMonth)}</span>
          {!isCurrentMonth && (
            <button onClick={() => setSelectedMonth(monthKey(todayISO()))} className="text-[10.5px] font-semibold rounded-full px-2 py-0.5 ml-1" style={{ background: th.primarySoft, color: th.primary }}>Hoy</button>
          )}
        </div>
        <button onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: th.primarySoft }}>
          <ChevronRight size={14} color={th.primary} />
        </button>
      </div>
    </div>
  );
}

function BottomNav({ th, tabs, activeTab, setActiveTab, onQuickAdd }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-20 px-3 pb-3 pt-2" style={{ background: `linear-gradient(to top, ${th.bg} 65%, transparent)` }}>
      <div className="relative">
        <button
          onClick={onQuickAdd}
          className="absolute -top-7 right-3 z-30 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_10px_24px_-6px_rgba(30,58,138,0.55)] active:scale-95 transition-transform"
          style={{ background: th.primary, color: "#fff" }} aria-label="Registro rápido"
        >
          <Plus size={26} />
        </button>
        <div className="flex items-center justify-between px-2 py-2 rounded-3xl shadow-[0_10px_30px_-10px_rgba(17,24,39,0.3)]" style={{ background: th.nav, border: `1px solid ${th.border}` }}>
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-2xl transition-all flex-1" style={{ background: active ? th.primarySoft : "transparent" }}>
                <t.icon size={19} color={active ? th.primary : th.textMuted} />
                <span className="text-[10px] font-medium" style={{ color: active ? th.primary : th.textMuted }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DASHBOARD                                                               */
/* ---------------------------------------------------------------------- */

function Dashboard({ th, mode, currency, userName, transactions, selectedMonth, goals, budgets, debts, assets, liabilities, bills, streak, xp, voiceListening, voiceInputSupported, onOpenQuickAdd, onOpenSimulator, onOpenChat, onVoiceQuickAdd, setActiveTab }) {
  const insights = useAIInsights({ mode, transactions, budgets, debts, assets, liabilities, bills });
  const spotlight = insights.find((i) => i.type === "warning") || insights[0] || null;
  const restInsights = spotlight ? insights.filter((i) => i !== spotlight) : [];

  const txMonth = transactions.filter((t) => monthKey(t.date) === selectedMonth);
  const ingresos = txMonth.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const gastos = txMonth.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
  const balance = ingresos - gastos;
  const isCurrentMonth = selectedMonth === monthKey(todayISO());

  const donutData = useMemo(() => {
    const map = {};
    txMonth.filter((t) => t.type === "gasto").forEach((t) => {
      const cat = findCategory(mode, "gasto", t.category);
      map[cat.name] = map[cat.name] || { name: cat.name, value: 0, color: cat.color };
      map[cat.name].value += t.amount;
    });
    return Object.values(map);
  }, [txMonth, mode]);

  const totalSavings = goals.reduce((s, g) => s + g.current, 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const netWorth = totalSavings - totalDebt;

  const noDataAtAll = transactions.length === 0;

  return (
    <div className="pb-4">
      <SectionTitle
        th={th}
        title={noDataAtAll ? `¡Hola${userName ? `, ${userName}` : ""}!` : (mode === "personal" ? "Resumen del mes" : "Panel ejecutivo")}
        subtitle={monthLabelFull(selectedMonth)}
      />

      {noDataAtAll ? (
        <EmptyState
          th={th} icon={Sparkles}
          title="Empecemos con tu primer registro"
          body="Aún no tienes movimientos guardados. No hay presión: agrega tu primer ingreso o gasto (por texto o por voz) y aquí empezarán a aparecer tus gráficas y recomendaciones."
          actionLabel="Agregar mi primer movimiento" onAction={onOpenQuickAdd}
          actionLabel2={voiceInputSupported ? "Agregar por voz" : undefined} onAction2={voiceInputSupported ? onVoiceQuickAdd : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card th={th} className="!p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${th.success}20` }}><ArrowUpRight size={14} color={th.success} /></div>
                <span className="text-[11.5px]" style={{ color: th.textMuted }}>{mode === "personal" ? "Ingresos" : "Ventas"}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: th.text }}>{fmt(ingresos, currency)}</p>
            </Card>
            <Card th={th} className="!p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${th.danger}18` }}><ArrowDownRight size={14} color={th.danger} /></div>
                <span className="text-[11.5px]" style={{ color: th.textMuted }}>{mode === "personal" ? "Gastos" : "Costos"}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: th.text }}>{fmt(gastos, currency)}</p>
            </Card>
          </div>

          <Card th={th} className="mb-3" style={{ background: th.primary }}>
            <p className="text-[12px]" style={{ color: "#C7D2FE" }}>{mode === "personal" ? "Balance disponible" : "Utilidad neta"} {!isCurrentMonth && "(mes seleccionado)"}</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: "#fff" }}>{fmt(balance, currency)}</p>
            <div className="flex items-center gap-1.5 mt-2">
              {balance >= 0 ? <TrendingUp size={14} color="#A7F3D0" /> : <TrendingDown size={14} color="#FCA5A5" />}
              <span className="text-[11.5px]" style={{ color: "#DBEAFE" }}>{balance >= 0 ? "Vas positivo este mes" : "Gastos superan tus ingresos"}</span>
            </div>
          </Card>

          {mode === "personal" && (goals.length > 0 || debts.length > 0) && (
            <Card th={th} className="mb-3 !p-3.5">
              <p className="text-[11px] mb-1" style={{ color: th.textMuted }}>Patrimonio personal estimado</p>
              <p className="text-lg font-bold" style={{ color: netWorth >= 0 ? th.success : th.danger }}>{fmt(netWorth, currency)}</p>
              <p className="text-[10.5px] mt-0.5" style={{ color: th.textMuted }}>Ahorros ({fmt(totalSavings, currency)}) − Deudas ({fmt(totalDebt, currency)})</p>
            </Card>
          )}

          {mode === "personal" && (
            <Card th={th} className="mb-3 flex items-center justify-between !py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `${th.accent}20` }}><Flame size={17} color={th.accent} /></div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: th.text }}>{streak > 0 ? `Racha de ${streak} día${streak === 1 ? "" : "s"}` : "Empieza tu racha hoy"}</p>
                  <p className="text-[11px]" style={{ color: th.textMuted }}>{xp} XP · Nivel {Math.floor(xp / 200) + 1}</p>
                </div>
              </div>
              <Trophy size={18} color={th.accent} />
            </Card>
          )}

          {donutData.length > 0 && (
            <Card th={th} className="mb-3">
              <p className="text-sm font-semibold mb-1" style={{ color: th.text }}>{mode === "personal" ? "Gastos por categoría" : "Costos por rubro"}</p>
              <div className="h-44 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v, currency)} contentStyle={{ borderRadius: 12, border: `1px solid ${th.border}` }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1 justify-center">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /><span className="text-[11px]" style={{ color: th.textMuted }}>{d.name}</span></div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <div className="flex items-center justify-between mb-2 mt-4">
        <div className="flex items-center gap-2"><BarChart3 size={16} color={th.accent} /><h3 className="text-sm font-bold" style={{ color: th.text }}>Tu analista IA</h3></div>
        <button onClick={() => onOpenChat("")} className="text-[11.5px] font-semibold" style={{ color: th.primary }}>Chatear →</button>
      </div>

      {spotlight ? (
        <Card th={th} className="mb-3" style={{ background: `linear-gradient(135deg, ${th.primary}, ${th.primary}CC)` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}><Sparkles size={13} color="#fff" /></div>
            <span className="text-[11px] font-semibold" style={{ color: "#DBEAFE" }}>Recomendación principal</span>
          </div>
          <p className="text-[13.5px] font-bold" style={{ color: "#fff" }}>{spotlight.title}</p>
          <p className="text-[12px] mt-1 leading-snug" style={{ color: "#E5EDFB" }}>{spotlight.body}</p>
          <button onClick={() => onOpenChat(`Explícame más sobre esto: "${spotlight.title}". ${spotlight.body}`)} className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1.5" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>
            <MessageCircle size={13} /> Preguntar al asesor
          </button>
        </Card>
      ) : (
        <Card th={th} className="mb-3 !py-3.5">
          <p className="text-[12.5px]" style={{ color: th.textMuted }}>{noDataAtAll ? "Aún no hay datos suficientes para un análisis. ¡Registra tu primer movimiento o pregúntale algo a tu asesor!" : "Sin alertas por ahora. ¡Todo se ve saludable!"}</p>
        </Card>
      )}

      {restInsights.length > 0 && (
        <div className="space-y-2.5 mb-4">{restInsights.map((ins, i) => <AIInsightCard key={i} th={th} insight={ins} />)}</div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-2">
        <button onClick={onOpenSimulator} className="rounded-2xl p-3.5 flex items-center gap-2.5" style={{ background: th.primarySoft }}>
          <Calculator size={18} color={th.primary} /><span className="text-[12.5px] font-semibold text-left" style={{ color: th.primary }}>Simulador de crédito</span>
        </button>
        <button onClick={() => setActiveTab(mode === "personal" ? "deudas" : "balance")} className="rounded-2xl p-3.5 flex items-center gap-2.5" style={{ background: th.primarySoft }}>
          <Scale size={18} color={th.primary} /><span className="text-[12.5px] font-semibold text-left" style={{ color: th.primary }}>{mode === "personal" ? "Ver deudas" : "Balance general"}</span>
        </button>
      </div>

      {!noDataAtAll && voiceInputSupported && (
        <button onClick={onVoiceQuickAdd} disabled={voiceListening} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 mt-2 font-bold text-[13.5px]" style={{ background: voiceListening ? th.accent : th.primarySoft, color: voiceListening ? "#fff" : th.primary }}>
          <Mic size={16} className={voiceListening ? "animate-pulse" : ""} /> {voiceListening ? "Escuchando…" : "Registrar por voz"}
        </button>
      )}

      <button onClick={() => onOpenChat("Dame un análisis completo de mi situación financiera actual y 3 acciones prioritarias.")} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 mt-2 font-bold text-[13.5px]" style={{ background: th.primarySoft, color: th.primary }}>
        <Bot size={16} /> Pedir análisis completo a la IA
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  REGISTRO RÁPIDO                                                         */
/* ---------------------------------------------------------------------- */

function QuickAddForm({ th, mode, currency, onSubmit, selectedMonth, embedded }) {
  const [type, setType] = useState("gasto");
  const [category, setCategory] = useState(CATEGORIES[mode][type][0].id);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const isCurrentMonth = !selectedMonth || selectedMonth === monthKey(todayISO());
  const [date, setDate] = useState(isCurrentMonth ? todayISO() : `${selectedMonth}-15`);
  const [scanning, setScanning] = useState(false);
  const [listening, setListening] = useState(false);

  const cats = CATEGORIES[mode][type];

  function selectType(t) { setType(t); setCategory(CATEGORIES[mode][t][0].id); }

  function handleSubmit() {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    onSubmit({ type, category, amount: val, note: note || findCategory(mode, type, category).name, date });
    setAmount(""); setNote("");
  }

  function mockScan() {
    setScanning(true);
    setTimeout(() => {
      setType("gasto");
      const guess = mode === "personal" ? "comida" : "suministros";
      setCategory(guess);
      setAmount((Math.random() * 60 + 15).toFixed(2));
      setNote("Recibo escaneado (auto)");
      setScanning(false);
    }, 1100);
  }

  function dictateNote() {
    if (!voiceInputSupported || listening) return;
    setListening(true);
    recognizeSpeech({
      onResult: (text) => { setNote(text); setListening(false); },
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    });
  }

  return (
    <div>
      <div className="flex p-1 rounded-2xl mb-4" style={{ background: th.primarySoft }}>
        {["ingreso", "gasto"].map((t) => (
          <button key={t} onClick={() => selectType(t)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize" style={{ background: type === t ? th.primary : "transparent", color: type === t ? "#fff" : th.primary }}>
            {t === "ingreso" ? "Ingreso" : "Gasto"}
          </button>
        ))}
      </div>

      <p className="text-[12px] font-semibold mb-2" style={{ color: th.textMuted }}>Categoría</p>
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {cats.map((c) => {
          const Ico = ICONS[c.icon] || MoreHorizontal;
          const active = category === c.id;
          return (
            <button key={c.id} onClick={() => setCategory(c.id)} className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all" style={{ background: active ? c.color : `${c.color}18`, border: active ? `2px solid ${c.color}` : "2px solid transparent" }}>
                <Ico size={20} color={active ? "#fff" : c.color} />
              </div>
              <span className="text-[10.5px] text-center leading-tight" style={{ color: th.textMuted }}>{c.name}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[12px] font-semibold mb-1.5" style={{ color: th.textMuted }}>Monto</p>
      <div className="flex items-center rounded-2xl px-4 py-3 mb-3" style={{ background: th.primarySoft }}>
        <span className="text-xl font-bold mr-1" style={{ color: th.primary }}>$</span>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="bg-transparent outline-none text-xl font-bold w-full" style={{ color: th.text }} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: th.textMuted }}>Fecha</p>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
        </div>
        <div>
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: th.textMuted }}>Nota (opcional)</p>
          <div className="flex items-center rounded-xl px-2 py-1" style={{ background: th.primarySoft }}>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Café con equipo" className="flex-1 bg-transparent outline-none text-sm py-1.5" style={{ color: th.text }} />
            {voiceInputSupported && (
              <button onClick={dictateNote} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: listening ? th.accent : "transparent" }}>
                <Mic size={13} color={listening ? "#fff" : th.primary} className={listening ? "animate-pulse" : ""} />
              </button>
            )}
          </div>
        </div>
      </div>

      <button onClick={mockScan} disabled={scanning} className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 mb-3 border-2 border-dashed text-sm font-semibold" style={{ borderColor: th.border, color: th.textMuted }}>
        <Camera size={16} /> {scanning ? "Leyendo recibo…" : "Escanear recibo (beta IA)"}
      </button>

      <button onClick={handleSubmit} className="w-full rounded-2xl py-3.5 font-bold text-[15px]" style={{ background: th.primary, color: "#fff" }}>
        Guardar {type === "ingreso" ? "ingreso" : "gasto"}
      </button>
    </div>
  );
}

function RecentList({ th, currency, mode, selectedMonth, transactions }) {
  const filtered = transactions.filter((t) => monthKey(t.date) === selectedMonth).slice(0, 12);
  return (
    <div className="mt-5">
      <p className="text-sm font-bold mb-2" style={{ color: th.text }}>Movimientos de {monthLabelFull(selectedMonth)}</p>
      {filtered.length === 0 && (
        <Card th={th} className="!py-4 text-center"><p className="text-[12.5px]" style={{ color: th.textMuted }}>No hay movimientos registrados este mes todavía.</p></Card>
      )}
      <div className="space-y-2">
        {filtered.map((t) => {
          const cat = findCategory(mode, t.type, t.category);
          return (
            <Card th={th} key={t.id} className="!py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconBubble name={cat.icon} color={cat.color} size={16} />
                <div><p className="text-[13px] font-semibold" style={{ color: th.text }}>{t.note || cat.name}</p><p className="text-[11px]" style={{ color: th.textMuted }}>{cat.name} · {t.date}</p></div>
              </div>
              <p className="text-[13.5px] font-bold" style={{ color: t.type === "ingreso" ? th.success : th.danger }}>{t.type === "ingreso" ? "+" : "-"}{fmt(t.amount, currency)}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  METAS & RETIRO                                                          */
/* ---------------------------------------------------------------------- */

function MetasRetiro({ th, currency, goals, setGoals, transactions }) {
  const [form, setForm] = useState({ name: "", target: "", current: "" });
  const [showForm, setShowForm] = useState(false);

  function addGoal() {
    if (!form.name || !form.target) return;
    setGoals((g) => [...g, { id: `g${Date.now()}`, name: form.name, target: parseFloat(form.target), current: parseFloat(form.current || 0), icon: "Target" }]);
    setForm({ name: "", target: "", current: "" });
    setShowForm(false);
  }

  function bump(id, delta) { setGoals((gs) => gs.map((g) => g.id === id ? { ...g, current: Math.max(0, g.current + delta) } : g)); }

  const [monthly, setMonthly] = useState(200);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(7);
  const futureValue = useMemo(() => {
    const r = rate / 100 / 12; const n = years * 12;
    if (r === 0) return monthly * n;
    return monthly * ((Math.pow(1 + r, n) - 1) / r);
  }, [monthly, years, rate]);

  return (
    <div className="pb-4">
      <SectionTitle th={th} title="Metas de ahorro" subtitle="Sigue tu progreso visualmente"
        right={<button onClick={() => setShowForm(s => !s)} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full" style={{ background: th.primarySoft, color: th.primary }}>+ Meta</button>}
      />

      {showForm && (
        <Card th={th} className="mb-3 space-y-2.5">
          <input placeholder="Nombre de la meta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
          <div className="grid grid-cols-2 gap-2.5">
            <input placeholder="Meta $" type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
            <input placeholder="Actual $" type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
          </div>
          <button onClick={addGoal} className="w-full rounded-xl py-2.5 font-bold text-sm" style={{ background: th.primary, color: "#fff" }}>Crear meta</button>
        </Card>
      )}

      {goals.length === 0 && !showForm && (
        <EmptyState th={th} icon={Target} title="Aún no tienes metas" body="Crea tu primera meta de ahorro (fondo de emergencia, vacaciones, un enganche) y da seguimiento a tu progreso con barras visuales." actionLabel="Crear mi primera meta" onAction={() => setShowForm(true)} />
      )}

      <div className="space-y-3 mb-5">
        {goals.map((g) => {
          const pct = (g.current / g.target) * 100;
          const complete = pct >= 100;
          return (
            <Card th={th} key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${th.accent}20` }}>
                    {complete ? <Trophy size={18} color={th.accent} /> : <Target size={18} color={th.accent} />}
                  </div>
                  <div><p className="text-sm font-bold" style={{ color: th.text }}>{g.name}</p><p className="text-[11.5px]" style={{ color: th.textMuted }}>{fmt(g.current, currency)} de {fmt(g.target, currency)}</p></div>
                </div>
                <span className="text-sm font-bold" style={{ color: complete ? th.success : th.primary }}>{Math.min(100, Math.round(pct))}%</span>
              </div>
              <ProgressBar pct={pct} color={complete ? th.success : th.primary} bg={th.primarySoft} />
              <div className="flex gap-2 mt-3">
                <button onClick={() => bump(g.id, 25)} className="flex-1 rounded-xl py-2 text-[12px] font-semibold flex items-center justify-center gap-1" style={{ background: th.primarySoft, color: th.primary }}><Plus size={13} /> Abonar $25</button>
                <button onClick={() => bump(g.id, -25)} className="flex-1 rounded-xl py-2 text-[12px] font-semibold flex items-center justify-center gap-1" style={{ background: th.primarySoft, color: th.textMuted }}><Minus size={13} /> Ajustar</button>
              </div>
            </Card>
          );
        })}
      </div>

      <SectionTitle th={th} title="Calculadora de retiro" subtitle="Proyección simplificada de interés compuesto" />
      <Card th={th} className="mb-3 space-y-3.5">
        <SliderField th={th} label="Aporte mensual" value={monthly} setValue={setMonthly} min={20} max={2000} step={10} format={(v) => fmt(v, currency)} />
        <SliderField th={th} label="Años para invertir" value={years} setValue={setYears} min={1} max={40} step={1} format={(v) => `${v} años`} />
        <SliderField th={th} label="Rendimiento anual estimado" value={rate} setValue={setRate} min={1} max={15} step={0.5} format={(v) => `${v}%`} />
        <div className="rounded-2xl p-4 text-center" style={{ background: th.primary }}>
          <p className="text-[11px]" style={{ color: "#C7D2FE" }}>Valor futuro estimado</p>
          <p className="text-2xl font-extrabold" style={{ color: "#fff" }}>{fmt(futureValue, currency)}</p>
        </div>
      </Card>
    </div>
  );
}

function SliderField({ th, label, value, setValue, min, max, step, format }) {
  return (
    <div>
      <div className="flex justify-between mb-1.5"><span className="text-[12.5px] font-medium" style={{ color: th.textMuted }}>{label}</span><span className="text-[12.5px] font-bold" style={{ color: th.primary }}>{format(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(parseFloat(e.target.value))} className="w-full" style={{ accentColor: th.primary }} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  PRESUPUESTOS                                                            */
/* ---------------------------------------------------------------------- */

function Presupuestos({ th, currency, budgets, setBudgets, transactions, selectedMonth }) {
  function update(cat, val) { setBudgets((b) => ({ ...b, [cat]: parseFloat(val) || 0 })); }
  const allCats = CATEGORIES.personal.gasto;
  const anyBudget = Object.values(budgets).some((v) => v > 0);

  return (
    <div className="pb-4">
      <SectionTitle th={th} title="Presupuestos" subtitle={`Comparado contra lo gastado en ${monthLabelFull(selectedMonth)}`} />
      {!anyBudget && (
        <EmptyState th={th} icon={ListChecks} title="Define tus primeros límites" body="Un presupuesto no es una restricción, es un mapa. Asigna un límite mensual a las categorías que más te importan y la IA te avisará si te estás acercando al tope." />
      )}
      <div className="space-y-3">
        {allCats.map((c) => {
          const limit = budgets[c.id] ?? 0;
          const spent = transactions.filter((t) => t.type === "gasto" && t.category === c.id && monthKey(t.date) === selectedMonth).reduce((s, t) => s + t.amount, 0);
          const pct = limit > 0 ? (spent / limit) * 100 : 0;
          const over = spent > limit && limit > 0;
          return (
            <Card th={th} key={c.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <IconBubble name={c.icon} color={c.color} size={16} />
                  <div><p className="text-[13.5px] font-bold" style={{ color: th.text }}>{c.name}</p><p className="text-[11px]" style={{ color: over ? th.danger : th.textMuted }}>{fmt(spent, currency)} de {fmt(limit, currency)}</p></div>
                </div>
                <input type="number" value={limit || ""} placeholder="0" onChange={(e) => update(c.id, e.target.value)} className="w-20 text-right rounded-lg px-2 py-1 text-[12.5px] font-semibold outline-none" style={{ background: th.primarySoft, color: th.text }} />
              </div>
              <ProgressBar pct={pct} color={over ? th.danger : th.success} bg={th.primarySoft} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DEUDAS                                                                   */
/* ---------------------------------------------------------------------- */

function Deudas({ th, currency, debts, setDebts, strategy, setStrategy }) {
  const [form, setForm] = useState({ name: "", balance: "", rate: "", minPayment: "" });
  const [showForm, setShowForm] = useState(false);

  function addDebt() {
    if (!form.name || !form.balance) return;
    setDebts((d) => [...d, { id: `d${Date.now()}`, mode: "personal", name: form.name, balance: parseFloat(form.balance), rate: parseFloat(form.rate) || 0, minPayment: parseFloat(form.minPayment) || 0 }]);
    setForm({ name: "", balance: "", rate: "", minPayment: "" });
    setShowForm(false);
  }

  const ordered = useMemo(() => {
    const arr = [...debts];
    if (strategy === "avalancha") arr.sort((a, b) => b.rate - a.rate);
    else arr.sort((a, b) => a.balance - b.balance);
    return arr;
  }, [debts, strategy]);

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const totalMin = debts.reduce((s, d) => s + d.minPayment, 0);

  return (
    <div className="pb-4">
      <SectionTitle th={th} title="Deudas" subtitle="Elige tu estrategia de liquidación"
        right={<button onClick={() => setShowForm(s => !s)} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full" style={{ background: th.primarySoft, color: th.primary }}>+ Deuda</button>}
      />

      {showForm && (
        <Card th={th} className="mb-3 space-y-2.5">
          <input placeholder="Nombre (ej. Tarjeta de crédito)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Saldo" type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="w-full rounded-xl px-2.5 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
            <input placeholder="Tasa %" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="w-full rounded-xl px-2.5 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
            <input placeholder="Pago mín." type="number" value={form.minPayment} onChange={(e) => setForm({ ...form, minPayment: e.target.value })} className="w-full rounded-xl px-2.5 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
          </div>
          <button onClick={addDebt} className="w-full rounded-xl py-2.5 font-bold text-sm" style={{ background: th.primary, color: "#fff" }}>Agregar deuda</button>
        </Card>
      )}

      {debts.length === 0 && !showForm ? (
        <EmptyState th={th} icon={CreditCard} title="Sin deudas registradas" body="Si tienes tarjetas de crédito, préstamos u otros pasivos, agrégalos aquí para que la IA te recomiende el mejor orden de pago." actionLabel="Agregar mi primera deuda" onAction={() => setShowForm(true)} />
      ) : (
        <>
          <Card th={th} className="mb-3 flex items-center justify-between">
            <div><p className="text-[11.5px]" style={{ color: th.textMuted }}>Saldo total</p><p className="text-xl font-extrabold" style={{ color: th.text }}>{fmt(totalBalance, currency)}</p></div>
            <div className="text-right"><p className="text-[11.5px]" style={{ color: th.textMuted }}>Pago mínimo mensual</p><p className="text-sm font-bold" style={{ color: th.primary }}>{fmt(totalMin, currency)}</p></div>
          </Card>

          <div className="flex p-1 rounded-2xl mb-3" style={{ background: th.primarySoft }}>
            <button onClick={() => setStrategy("avalancha")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-semibold" style={{ background: strategy === "avalancha" ? th.primary : "transparent", color: strategy === "avalancha" ? "#fff" : th.primary }}><Mountain size={14} /> Avalancha</button>
            <button onClick={() => setStrategy("bola")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-semibold" style={{ background: strategy === "bola" ? th.primary : "transparent", color: strategy === "bola" ? "#fff" : th.primary }}><Snowflake size={14} /> Bola de nieve</button>
          </div>

          <div className="space-y-2.5">
            {ordered.map((d, i) => (
              <Card th={th} key={d.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: i === 0 ? th.accent : th.primarySoft, color: i === 0 ? "#fff" : th.primary }}>{i + 1}</div>
                  <div><p className="text-[13.5px] font-bold" style={{ color: th.text }}>{d.name}</p><p className="text-[11px]" style={{ color: th.textMuted }}>Tasa {d.rate}% · Mínimo {fmt(d.minPayment, currency)}</p></div>
                </div>
                <p className="text-sm font-bold" style={{ color: th.text }}>{fmt(d.balance, currency)}</p>
              </Card>
            ))}
          </div>
          {ordered[0] && (
            <Card th={th} className="mt-3" style={{ background: th.primarySoft }}>
              <p className="text-[12.5px]" style={{ color: th.primary }}><b>Sugerencia IA:</b> destina cualquier excedente a "{ordered[0].name}" mientras pagas el mínimo en las demás.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  P&L                                                                      */
/* ---------------------------------------------------------------------- */

function PL({ th, currency, transactions, selectedMonth }) {
  const monthsKeys = lastNMonthsKeys(6, selectedMonth);
  const data = monthsKeys.map((mk) => {
    const ventas = transactions.filter(t => t.type === "ingreso" && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
    const costos = transactions.filter(t => t.type === "gasto" && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
    return { mes: monthLabel(mk), ventas, costos, utilidad: ventas - costos };
  });

  const current = data[data.length - 1] || { ventas: 0, costos: 0, utilidad: 0 };
  const margen = current.ventas > 0 ? (current.utilidad / current.ventas) * 100 : 0;

  const costBreakdown = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type === "gasto" && monthKey(t.date) === selectedMonth).forEach(t => {
      const cat = findCategory("empresa", "gasto", t.category);
      map[cat.name] = (map[cat.name] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions, selectedMonth]);

  if (transactions.length === 0) {
    return (
      <div className="pb-4">
        <SectionTitle th={th} title="Estado de resultados" subtitle="Ventas − Costos operativos = Utilidad neta" />
        <EmptyState th={th} icon={FileText} title="Sin movimientos todavía" body="Registra tus ventas y costos operativos (desde el botón + o por chat) para que aquí se calcule automáticamente tu P&L." />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <SectionTitle th={th} title="Estado de resultados" subtitle={`${monthLabelFull(selectedMonth)} · Ventas − Costos = Utilidad neta`} />
      <Card th={th} className="mb-3" style={{ background: th.primary }}>
        <p className="text-[11px]" style={{ color: "#C7D2FE" }}>Utilidad neta ({monthLabel(selectedMonth)})</p>
        <p className="text-2xl font-extrabold" style={{ color: "#fff" }}>{fmt(current.utilidad, currency)}</p>
        <p className="text-[12px] mt-1" style={{ color: "#DBEAFE" }}>Margen neto: {margen.toFixed(1)}%</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Card th={th} className="!p-3.5"><p className="text-[11px]" style={{ color: th.textMuted }}>Ventas</p><p className="text-base font-bold" style={{ color: th.success }}>{fmt(current.ventas, currency)}</p></Card>
        <Card th={th} className="!p-3.5"><p className="text-[11px]" style={{ color: th.textMuted }}>Costos operativos</p><p className="text-base font-bold" style={{ color: th.danger }}>{fmt(current.costos, currency)}</p></Card>
      </div>

      <Card th={th} className="mb-3">
        <p className="text-sm font-semibold mb-2" style={{ color: th.text }}>Tendencia (6 meses)</p>
        <div className="h-48 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={th.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: th.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: th.textMuted }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => fmt(v, currency)} contentStyle={{ borderRadius: 12, border: `1px solid ${th.border}` }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ventas" fill={th.success} radius={[6, 6, 0, 0]} name="Ventas" />
              <Bar dataKey="costos" fill={th.danger} radius={[6, 6, 0, 0]} name="Costos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {costBreakdown.length > 0 && (
        <>
          <p className="text-sm font-bold mb-2" style={{ color: th.text }}>Desglose de costos ({monthLabel(selectedMonth)})</p>
          <div className="space-y-2">
            {costBreakdown.map(([name, val]) => (
              <Card th={th} key={name} className="!py-2.5 flex items-center justify-between"><span className="text-[13px] font-medium" style={{ color: th.text }}>{name}</span><span className="text-[13px] font-bold" style={{ color: th.text }}>{fmt(val, currency)}</span></Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  BALANCE GENERAL                                                          */
/* ---------------------------------------------------------------------- */

function BalanceGeneral({ th, currency, assets, setAssets, liabilities, setLiabilities }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiab = liabilities.reduce((s, l) => s + l.value, 0);
  const equity = totalAssets - totalLiab;
  const [newRow, setNewRow] = useState({ kind: "asset", name: "", value: "", type: "Corriente" });

  function addRow() {
    if (!newRow.name || !newRow.value) return;
    const row = { id: `${newRow.kind}${Date.now()}`, name: newRow.name, value: parseFloat(newRow.value), type: newRow.type };
    if (newRow.kind === "asset") setAssets((a) => [...a, row]); else setLiabilities((l) => [...l, row]);
    setNewRow({ ...newRow, name: "", value: "" });
  }
  function removeRow(kind, id) {
    if (kind === "asset") setAssets((a) => a.filter((x) => x.id !== id)); else setLiabilities((l) => l.filter((x) => x.id !== id));
  }

  return (
    <div className="pb-4">
      <SectionTitle th={th} title="Balance general" subtitle="Activos vs. Pasivos" />
      {assets.length === 0 && liabilities.length === 0 && (
        <EmptyState th={th} icon={Scale} title="Aún no tienes balance registrado" body="Agrega tus activos (efectivo, cuentas por cobrar, equipo) y pasivos (deudas, cuentas por pagar) para calcular tu patrimonio neto automáticamente." />
      )}

      {(assets.length > 0 || liabilities.length > 0) && (
        <>
          <Card th={th} className="mb-3" style={{ background: th.primary }}><p className="text-[11px]" style={{ color: "#C7D2FE" }}>Patrimonio neto</p><p className="text-2xl font-extrabold" style={{ color: "#fff" }}>{fmt(equity, currency)}</p></Card>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card th={th} className="!p-3.5"><p className="text-[11px]" style={{ color: th.textMuted }}>Total activos</p><p className="text-base font-bold" style={{ color: th.success }}>{fmt(totalAssets, currency)}</p></Card>
            <Card th={th} className="!p-3.5"><p className="text-[11px]" style={{ color: th.textMuted }}>Total pasivos</p><p className="text-base font-bold" style={{ color: th.danger }}>{fmt(totalLiab, currency)}</p></Card>
          </div>
          <BalanceTable th={th} currency={currency} title="Activos" rows={assets} kind="asset" onRemove={removeRow} color={th.success} />
          <BalanceTable th={th} currency={currency} title="Pasivos" rows={liabilities} kind="liability" onRemove={removeRow} color={th.danger} />
        </>
      )}

      <Card th={th} className="mt-1 space-y-2.5">
        <p className="text-sm font-semibold" style={{ color: th.text }}>Agregar partida</p>
        <div className="flex p-1 rounded-2xl" style={{ background: th.primarySoft }}>
          <button onClick={() => setNewRow({ ...newRow, kind: "asset" })} className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: newRow.kind === "asset" ? th.primary : "transparent", color: newRow.kind === "asset" ? "#fff" : th.primary }}>Activo</button>
          <button onClick={() => setNewRow({ ...newRow, kind: "liability" })} className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: newRow.kind === "liability" ? th.primary : "transparent", color: newRow.kind === "liability" ? "#fff" : th.primary }}>Pasivo</button>
        </div>
        <input placeholder="Nombre (ej. Equipo de cómputo)" value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
        <div className="grid grid-cols-2 gap-2.5">
          <input placeholder="Valor $" type="number" value={newRow.value} onChange={(e) => setNewRow({ ...newRow, value: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
          <select value={newRow.type} onChange={(e) => setNewRow({ ...newRow, type: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }}>
            <option>Corriente</option><option>{newRow.kind === "asset" ? "Fijo" : "Largo plazo"}</option>
          </select>
        </div>
        <button onClick={addRow} className="w-full rounded-xl py-2.5 font-bold text-sm" style={{ background: th.primary, color: "#fff" }}>Agregar</button>
      </Card>
    </div>
  );
}

function BalanceTable({ th, currency, title, rows, kind, onRemove, color }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-sm font-bold mb-2" style={{ color: th.text }}>{title}</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <Card th={th} key={r.id} className="!py-2.5 flex items-center justify-between">
            <div><p className="text-[13px] font-medium" style={{ color: th.text }}>{r.name}</p><p className="text-[10.5px]" style={{ color: th.textMuted }}>{r.type}</p></div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold" style={{ color }}>{fmt(r.value, currency)}</span>
              <button onClick={() => onRemove(kind, r.id)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: th.primarySoft }}><X size={12} color={th.textMuted} /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  CASH FLOW                                                                */
/* ---------------------------------------------------------------------- */

function CashFlow({ th, currency, transactions, selectedMonth }) {
  if (transactions.length === 0) {
    return (
      <div className="pb-4">
        <SectionTitle th={th} title="Flujo de caja" subtitle="Histórico y proyección a 3 meses" />
        <EmptyState th={th} icon={LineChartIcon} title="Sin flujo que mostrar aún" body="En cuanto registres tus primeros ingresos y egresos, aquí verás la tendencia histórica y una proyección estimada a 3 meses." />
      </div>
    );
  }

  const histKeys = lastNMonthsKeys(6, selectedMonth);
  const hist = histKeys.map((mk) => {
    const entradas = transactions.filter(t => t.type === "ingreso" && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
    const salidas = transactions.filter(t => t.type === "gasto" && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
    return { mes: monthLabel(mk), entradas, salidas, neto: entradas - salidas };
  });

  const lastEntradas = hist[hist.length - 1]?.entradas || 0;
  const lastSalidas = hist[hist.length - 1]?.salidas || 0;
  const proyeccion = [1, 2, 3].map((i) => {
    const entradas = Math.max(0, lastEntradas * (1 + 0.03 * i));
    const salidas = Math.max(0, lastSalidas * (1 + 0.015 * i));
    return { mes: `+${i}m`, entradas: Math.round(entradas), salidas: Math.round(salidas), neto: Math.round(entradas - salidas) };
  });
  const fullData = [...hist, ...proyeccion];

  return (
    <div className="pb-4">
      <SectionTitle th={th} title="Flujo de caja" subtitle={`Histórico hasta ${monthLabelFull(selectedMonth)} + proyección`} />
      <Card th={th} className="mb-3">
        <div className="h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fullData}>
              <CartesianGrid strokeDasharray="3 3" stroke={th.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: th.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: th.textMuted }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => fmt(v, currency)} contentStyle={{ borderRadius: 12, border: `1px solid ${th.border}` }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="entradas" stroke={th.success} strokeWidth={2.5} dot={false} name="Entradas" />
              <Line type="monotone" dataKey="salidas" stroke={th.danger} strokeWidth={2.5} dot={false} name="Salidas" />
              <Line type="monotone" dataKey="neto" stroke={th.primary} strokeWidth={2.5} strokeDasharray="4 3" dot={false} name="Flujo neto" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] mt-2 text-center" style={{ color: th.textMuted }}>Los últimos 3 puntos (+1m, +2m, +3m) son una proyección estimada por la IA.</p>
      </Card>
      <div className="grid grid-cols-3 gap-2.5">
        {proyeccion.map((p, i) => (
          <Card th={th} key={i} className="!p-3 text-center"><p className="text-[10.5px]" style={{ color: th.textMuted }}>{p.mes}</p><p className="text-sm font-bold mt-1" style={{ color: p.neto >= 0 ? th.success : th.danger }}>{fmt(p.neto, currency)}</p></Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  EXPORTAR (contable)                                                       */
/* ---------------------------------------------------------------------- */

function Exportar({ th, currency, transactions, assets, liabilities }) {
  function exportCSV() {
    const header = "Fecha,Tipo,Categoría,Monto,Nota\n";
    const rows = transactions.map(t => `${t.date},${t.type},${findCategory("empresa", t.type, t.category).name},${t.amount},"${(t.note || "").replace(/"/g, "'")}"`).join("\n");
    downloadBlob(header + rows, "finanzapro_transacciones.csv", "text/csv;charset=utf-8;");
  }

  function exportXLSX() {
    const wb = XLSX.utils.book_new();
    const txSheet = XLSX.utils.json_to_sheet(transactions.map(t => ({ Fecha: t.date, Tipo: t.type, Categoría: findCategory("empresa", t.type, t.category).name, Monto: t.amount, Nota: t.note || "" })));
    XLSX.utils.book_append_sheet(wb, txSheet, "Transacciones");
    const balanceSheet = XLSX.utils.json_to_sheet([...assets.map(a => ({ Sección: "Activo", Nombre: a.name, Tipo: a.type, Valor: a.value })), ...liabilities.map(l => ({ Sección: "Pasivo", Nombre: l.name, Tipo: l.type, Valor: l.value }))]);
    XLSX.utils.book_append_sheet(wb, balanceSheet, "Balance General");
    const ventas = transactions.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
    const costos = transactions.filter(t => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
    const plSheet = XLSX.utils.json_to_sheet([{ Concepto: "Ventas totales", Monto: ventas }, { Concepto: "Costos operativos totales", Monto: costos }, { Concepto: "Utilidad neta", Monto: ventas - costos }]);
    XLSX.utils.book_append_sheet(wb, plSheet, "P&L");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(out, "finanzapro_reporte_contable.xlsx", "application/octet-stream");
  }

  const ventas = transactions.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const costos = transactions.filter(t => t.type === "gasto").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="pb-4">
      <SectionTitle th={th} title="Exportar para tu contador" subtitle="Reportes tabulados listos para descargar" />
      {transactions.length === 0 ? (
        <EmptyState th={th} icon={FileSpreadsheet} title="Nada que exportar todavía" body="En cuanto registres movimientos podrás descargar reportes en Excel (.xlsx) o CSV listos para tu contador. También puedes importar movimientos desde Configuración." />
      ) : (
        <>
          <Card th={th} className="mb-4">
            <p className="text-sm font-semibold mb-2" style={{ color: th.text }}>Resumen a exportar</p>
            <div className="flex justify-between text-[12.5px] mb-1" style={{ color: th.textMuted }}><span>Movimientos registrados</span><span className="font-semibold" style={{ color: th.text }}>{transactions.length}</span></div>
            <div className="flex justify-between text-[12.5px] mb-1" style={{ color: th.textMuted }}><span>Ventas totales</span><span className="font-semibold" style={{ color: th.text }}>{fmt(ventas, currency)}</span></div>
            <div className="flex justify-between text-[12.5px]" style={{ color: th.textMuted }}><span>Costos totales</span><span className="font-semibold" style={{ color: th.text }}>{fmt(costos, currency)}</span></div>
          </Card>
          <button onClick={exportXLSX} className="w-full flex items-center justify-between rounded-2xl p-4 mb-3" style={{ background: th.primary }}>
            <div className="flex items-center gap-3"><FileSpreadsheet size={20} color="#fff" /><div className="text-left"><p className="text-sm font-bold" style={{ color: "#fff" }}>Reporte contable (.xlsx)</p><p className="text-[11px]" style={{ color: "#DBEAFE" }}>Transacciones, Balance y P&L en pestañas</p></div></div>
            <Download size={18} color="#fff" />
          </button>
          <button onClick={exportCSV} className="w-full flex items-center justify-between rounded-2xl p-4" style={{ background: th.primarySoft }}>
            <div className="flex items-center gap-3"><FileText size={20} color={th.primary} /><div className="text-left"><p className="text-sm font-bold" style={{ color: th.primary }}>Transacciones (.csv)</p><p className="text-[11px]" style={{ color: th.textMuted }}>Compatible con Excel / Google Sheets</p></div></div>
            <Download size={18} color={th.primary} />
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  CONFIGURACIÓN (perfil, tema, voz, datos y respaldo)                      */
/* ---------------------------------------------------------------------- */

function ConfigPanel({ th, themeKey, setThemeKey, currency, setCurrency, userName, setUserName, voiceEnabled, setVoiceEnabled, onExportBackup, onImportBackupFile, onImportTransactionsFile, onResetAll, importStatus, setImportStatus, hasStorage }) {
  const backupInputRef = useRef(null);
  const txInputRef = useRef(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold mb-2.5" style={{ color: th.text }}>Perfil</p>
        <input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Tu nombre" className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none" style={{ background: th.primarySoft, color: th.text }} />
      </div>

      <div>
        <p className="text-sm font-bold mb-2.5" style={{ color: th.text }}>Tema visual</p>
        <div className="grid grid-cols-2 gap-2.5">
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => setThemeKey(key)} className="rounded-2xl p-3 text-left border-2" style={{ background: t.bg, borderColor: themeKey === key ? t.primary : "transparent" }}>
              <div className="flex gap-1 mb-2"><span className="w-4 h-4 rounded-full" style={{ background: t.primary }} /><span className="w-4 h-4 rounded-full" style={{ background: t.accent }} /><span className="w-4 h-4 rounded-full" style={{ background: t.success }} /></div>
              <p className="text-[12px] font-semibold" style={{ color: t.text }}>{t.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold mb-2.5" style={{ color: th.text }}>Moneda</p>
        <div className="flex flex-wrap gap-2">{["USD", "MXN", "EUR", "COP", "ARS"].map((c) => <Pill key={c} th={th} active={currency === c} onClick={() => setCurrency(c)}>{c}</Pill>)}</div>
      </div>

      <div>
        <p className="text-sm font-bold mb-2.5" style={{ color: th.text }}>Voz</p>
        <Card th={th} className="!py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.primarySoft }}>{voiceEnabled ? <Volume2 size={16} color={th.primary} /> : <VolumeX size={16} color={th.textMuted} />}</div>
            <div><p className="text-[13px] font-semibold" style={{ color: th.text }}>Leer respuestas del asesor en voz alta</p><p className="text-[11px]" style={{ color: th.textMuted }}>{voiceOutputSupported ? "Usa la voz de tu navegador" : "No disponible en este navegador"}</p></div>
          </div>
          <button disabled={!voiceOutputSupported} onClick={() => setVoiceEnabled(!voiceEnabled)} className="w-11 h-6 rounded-full relative shrink-0 disabled:opacity-40" style={{ background: voiceEnabled ? th.primary : th.primarySoft }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: voiceEnabled ? 22 : 2 }} />
          </button>
        </Card>
        <p className="text-[11px] mt-2 leading-snug" style={{ color: th.textMuted }}>
          También puedes dictar por voz tus movimientos y preguntas al chat (botón de micrófono) si tu navegador lo soporta.
        </p>
      </div>

      <div>
        <p className="text-sm font-bold mb-2.5" style={{ color: th.text }}>Datos y respaldo</p>
        {!hasStorage && (
          <Card th={th} className="!py-3 mb-2.5" style={{ background: `${th.accent}18` }}>
            <p className="text-[11.5px] leading-snug" style={{ color: th.text }}>El guardado automático solo está disponible cuando la app corre dentro de Claude. Si la despliegas en tu propio sitio, conecta aquí tu base de datos — el resto de la app no necesita cambios.</p>
          </Card>
        )}
        <div className="space-y-2">
          <button onClick={onExportBackup} className="w-full flex items-center justify-between rounded-2xl p-3.5" style={{ background: th.primarySoft }}>
            <div className="flex items-center gap-2.5"><FileJson size={17} color={th.primary} /><span className="text-[13px] font-semibold" style={{ color: th.primary }}>Descargar respaldo completo (.json)</span></div>
            <Download size={15} color={th.primary} />
          </button>

          <input ref={backupInputRef} type="file" accept=".json" className="hidden" onChange={(e) => { if (e.target.files[0]) onImportBackupFile(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={() => backupInputRef.current?.click()} className="w-full flex items-center justify-between rounded-2xl p-3.5" style={{ background: th.primarySoft }}>
            <div className="flex items-center gap-2.5"><Upload size={17} color={th.primary} /><span className="text-[13px] font-semibold" style={{ color: th.primary }}>Restaurar respaldo (.json)</span></div>
          </button>

          <input ref={txInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files[0]) onImportTransactionsFile(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={() => txInputRef.current?.click()} className="w-full flex items-center justify-between rounded-2xl p-3.5" style={{ background: th.primarySoft }}>
            <div className="flex items-center gap-2.5"><Upload size={17} color={th.primary} /><span className="text-[13px] font-semibold" style={{ color: th.primary }}>Importar movimientos (.csv / .xlsx)</span></div>
          </button>

          {importStatus && (
            <div className="flex items-start gap-2 px-1">
              <CheckCircle2 size={14} color={th.success} className="mt-0.5 shrink-0" />
              <p className="text-[11.5px]" style={{ color: th.textMuted }}>{importStatus}</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold mb-2.5" style={{ color: th.danger }}>Zona de riesgo</p>
        <button onClick={onResetAll} className="w-full flex items-center justify-center gap-2 rounded-2xl p-3.5 font-semibold text-[13px]" style={{ background: `${th.danger}15`, color: th.danger }}>
          <Trash2 size={16} /> Borrar todos mis datos
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1" style={{ color: th.textMuted }}>
        <ShieldCheck size={14} />
        <p className="text-[11px]">Tus datos se guardan automáticamente y nunca se eliminan salvo que tú lo hagas.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SIMULADOR DE CRÉDITO / INFLACIÓN                                          */
/* ---------------------------------------------------------------------- */

function CreditInflationSimulator({ th, currency }) {
  const [tab, setTab] = useState("credito");
  const [principal, setPrincipal] = useState(5000);
  const [rateY, setRateY] = useState(18);
  const [termM, setTermM] = useState(24);
  const payment = useMemo(() => {
    const r = rateY / 100 / 12;
    if (r === 0) return principal / termM;
    return (principal * r) / (1 - Math.pow(1 + r, -termM));
  }, [principal, rateY, termM]);
  const totalPaid = payment * termM;
  const totalInterest = totalPaid - principal;

  const [amount, setAmount] = useState(1000);
  const [inflation, setInflation] = useState(5);
  const [yearsInf, setYearsInf] = useState(10);
  const futureValueReal = amount / Math.pow(1 + inflation / 100, yearsInf);

  return (
    <div>
      <div className="flex p-1 rounded-2xl mb-4" style={{ background: th.primarySoft }}>
        <button onClick={() => setTab("credito")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: tab === "credito" ? th.primary : "transparent", color: tab === "credito" ? "#fff" : th.primary }}>Crédito</button>
        <button onClick={() => setTab("inflacion")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: tab === "inflacion" ? th.primary : "transparent", color: tab === "inflacion" ? "#fff" : th.primary }}>Inflación</button>
      </div>
      {tab === "credito" ? (
        <div className="space-y-3.5">
          <SliderField th={th} label="Monto del préstamo" value={principal} setValue={setPrincipal} min={500} max={50000} step={100} format={(v) => fmt(v, currency)} />
          <SliderField th={th} label="Tasa anual" value={rateY} setValue={setRateY} min={1} max={60} step={0.5} format={(v) => `${v}%`} />
          <SliderField th={th} label="Plazo (meses)" value={termM} setValue={setTermM} min={3} max={120} step={1} format={(v) => `${v} m`} />
          <Card th={th} style={{ background: th.primary }}>
            <p className="text-[11px]" style={{ color: "#C7D2FE" }}>Pago mensual estimado</p>
            <p className="text-2xl font-extrabold" style={{ color: "#fff" }}>{fmt(payment, currency)}</p>
            <div className="flex justify-between mt-2 text-[11.5px]" style={{ color: "#DBEAFE" }}><span>Total: {fmt(totalPaid, currency)}</span><span>Interés: {fmt(totalInterest, currency)}</span></div>
          </Card>
        </div>
      ) : (
        <div className="space-y-3.5">
          <SliderField th={th} label="Monto actual" value={amount} setValue={setAmount} min={100} max={20000} step={50} format={(v) => fmt(v, currency)} />
          <SliderField th={th} label="Inflación anual estimada" value={inflation} setValue={setInflation} min={0} max={30} step={0.5} format={(v) => `${v}%`} />
          <SliderField th={th} label="Horizonte" value={yearsInf} setValue={setYearsInf} min={1} max={30} step={1} format={(v) => `${v} años`} />
          <Card th={th} style={{ background: th.primary }}>
            <p className="text-[11px]" style={{ color: "#C7D2FE" }}>Poder adquisitivo real futuro</p>
            <p className="text-2xl font-extrabold" style={{ color: "#fff" }}>{fmt(futureValueReal, currency)}</p>
            <p className="text-[11.5px] mt-1" style={{ color: "#DBEAFE" }}>Es lo que hoy equivaldría {fmt(amount, currency)} dentro de {yearsInf} años.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  CHAT CON EL ASESOR IA                                                    */
/* ---------------------------------------------------------------------- */

const CHAT_SUGGESTIONS = {
  personal: ["¿Cómo voy con mi presupuesto este mes?", "Dame un plan para pagar mis deudas más rápido", "Registra un gasto de 200 en comida", "Analiza mi salud financiera"],
  empresa: ["Analiza mi P&L de este mes", "¿Cuál es mi salud financiera según el balance?", "Registra una venta de 500", "Dame ideas para reducir costos"],
};

function ChatPanel({ th, mode, messages, loading, prefill, onSend, onClose, voiceEnabled, setVoiceEnabled }) {
  const [input, setInput] = useState(prefill || "");
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  function handleSend() {
    if (!input.trim() || loading) return;
    onSend(input);
    setInput("");
  }
  function handleKeyDown(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }

  function dictate() {
    if (!voiceInputSupported || listening) return;
    setListening(true);
    recognizeSpeech({ onResult: (text) => { setInput((prev) => (prev ? prev + " " : "") + text); setListening(false); }, onError: () => setListening(false), onEnd: () => setListening(false) });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="w-full max-w-md h-full flex flex-col" style={{ background: th.bg }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ background: th.primary }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}><Bot size={18} color="#fff" /></div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: "#fff" }}>Asesor FinanzaPro AI</p>
              <p className="text-[11px]" style={{ color: "#DBEAFE" }}>{mode === "personal" ? "Analista de finanzas personales" : "Analista de finanzas empresariales"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {voiceOutputSupported && (
              <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}>
                {voiceEnabled ? <Volume2 size={15} color="#fff" /> : <VolumeX size={15} color="#fff" />}
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}><X size={16} color="#fff" /></button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div>
              <Card th={th} className="mb-3">
                <p className="text-[12.5px] leading-snug" style={{ color: th.textMuted }}>
                  Hola, soy tu asesor financiero de IA. Tengo acceso a tus registros actuales de {mode === "personal" ? "finanzas personales" : "tu empresa"} y puedo darte consejos, análisis, y hasta registrar movimientos por ti si me lo pides. ¿En qué te ayudo hoy?
                </p>
              </Card>
              <p className="text-[11.5px] font-semibold mb-2" style={{ color: th.textMuted }}>Prueba preguntando:</p>
              <div className="flex flex-col gap-2">
                {CHAT_SUGGESTIONS[mode].map((s, i) => (
                  <button key={i} onClick={() => onSend(s)} className="text-left rounded-2xl px-3.5 py-2.5 text-[12.5px] font-medium" style={{ background: th.primarySoft, color: th.primary }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                {m.role === "assistant" && <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5" style={{ background: th.primarySoft }}><Bot size={13} color={th.primary} /></div>}
                <div
                  className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug whitespace-pre-wrap"
                  style={{ background: m.role === "user" ? th.primary : th.card, color: m.role === "user" ? "#fff" : th.text, border: m.role === "assistant" ? `1px solid ${th.border}` : "none" }}
                >
                  {m.content}
                </div>
              </div>
              {m.actionResult && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-9 rounded-full px-2.5 py-1" style={{ background: `${th.success}18` }}>
                  <CheckCircle2 size={11} color={th.success} /><span className="text-[10.5px] font-semibold" style={{ color: th.success }}>{m.actionResult}</span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2" style={{ background: th.primarySoft }}><Bot size={13} color={th.primary} /></div>
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: th.card, border: `1px solid ${th.border}` }}>
                <Loader2 size={14} className="animate-spin" color={th.primary} /><span className="text-[12px]" style={{ color: th.textMuted }}>Analizando tus datos…</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-3 pb-4 pt-2" style={{ borderTop: `1px solid ${th.border}`, background: th.bg }}>
          <div className="flex items-end gap-2 rounded-3xl px-3 py-2" style={{ background: th.card, border: `1px solid ${th.border}` }}>
            <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe o dicta tu pregunta…" className="flex-1 bg-transparent outline-none text-[13px] resize-none max-h-24 py-1.5" style={{ color: th.text }} />
            {voiceInputSupported && (
              <button onClick={dictate} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: listening ? th.accent : th.primarySoft }}>
                <Mic size={14} color={listening ? "#fff" : th.primary} className={listening ? "animate-pulse" : ""} />
              </button>
            )}
            <button onClick={handleSend} disabled={loading || !input.trim()} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40" style={{ background: th.primary }}><Send size={15} color="#fff" /></button>
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: th.textMuted }}>El asesor responde con base en tus registros actuales y puede registrar movimientos si se lo pides.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  NOVEDADES DE LA IA                                                        */
/* ---------------------------------------------------------------------- */

function Novedades({ th }) {
  const items = [
    { icon: "shield-check", title: "Guardado automático y persistente", body: "Toda tu información se guarda sola mientras usas la app y nunca se pierde entre sesiones — solo se borra si tú lo haces explícitamente desde Configuración." },
    { icon: "calendar-days", title: "Navegación por meses", body: "Agregué un selector de mes siempre visible en la parte superior para que revises tu historial mes a mes, manteniendo claro en cuál estás trabajando." },
    { icon: "message-circle", title: "Chat con tu asesor financiero IA", body: "El chat usa tus registros reales como contexto y ahora también puede EJECUTAR acciones: si le dices 'registra un gasto de 200 en comida', lo agrega por ti automáticamente." },
    { icon: "mic", title: "Entrada y salida de voz", body: "Puedes dictar movimientos y preguntas al chat, y pedirle que lea sus respuestas en voz alta. Elegí la Web Speech API nativa del navegador (sin costo, sin librerías extra) porque es la opción más eficiente para logging manos-libres y accesibilidad." },
    { icon: "upload", title: "Importar y exportar datos reales", body: "Puedes exportar un respaldo completo en JSON, exportar reportes contables en Excel/CSV, e importar movimientos desde archivos CSV o Excel de otras apps." },
    { icon: "sparkles", title: "Empiezas siempre desde cero", body: "Quité todos los datos de ejemplo: la app arranca vacía con un breve onboarding para que sea 100% tuya desde el primer momento." },
    { icon: "wallet", title: "Patrimonio neto personal", body: "Agregué una tarjeta que combina tus ahorros en metas menos tus deudas para mostrarte tu patrimonio neto estimado de un vistazo." },
    { icon: "calculator", title: "Simulador de crédito e inflación", body: "Calculadora para estimar pagos mensuales de préstamos y el impacto de la inflación en tu dinero a futuro." },
  ];
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] mb-1" style={{ color: th.textMuted }}>Como desarrollador, analista financiero y diseñador de experiencia, integré estas mejoras pensando en lo que de verdad importa en una app de finanzas:</p>
      {items.map((it, i) => (
        <Card th={th} key={i} className="!py-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${th.accent}20` }}>
              <LucideIcon name={it.icon} size={16} color={th.accent} />
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: th.text }}>{it.title}</p>
              <p className="text-[12px] mt-0.5 leading-snug" style={{ color: th.textMuted }}>{it.body}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
