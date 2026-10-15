/* curves.js — fórmulas das curvas e modelos de cada tipo de dispositivo.
   Cada modelo devolve { kind, segs, bands, pts, vls, tAt } com correntes JÁ convertidas para a tensão base:
     kind  : "protect" (dispositivo de proteção) | "damage" (limite suportável) | "info" | "marker"
     segs  : polilinhas [{ pts:[[I,t],...], w, dash }]
     bands : faixas preenchidas [{ up:[[I,t]...], lo:[[I,t]...] }]
     pts   : pontos isolados [{ I, t, label }]
     vls   : linhas verticais [{ I, label, dash }]
     tAt   : função I(base) -> tempo de atuação / limite (Infinity se não atua) */
"use strict";

/* ---------- Biblioteca de curvas inversas:  t = dial · ( A / (M^p − 1) + B ),  M = I / Ipickup ---------- */
const CURVES = {
  "IEC-NI":  { g: "IEC 60255-151", n: "Normal inversa (NI)",       A: 0.14,    p: 0.02, B: 0 },
  "IEC-VI":  { g: "IEC 60255-151", n: "Muito inversa (VI)",        A: 13.5,    p: 1,    B: 0 },
  "IEC-EI":  { g: "IEC 60255-151", n: "Extremamente inversa (EI)", A: 80,      p: 2,    B: 0 },
  "IEC-LTI": { g: "IEC 60255-151", n: "Inversa longa (LTI)",       A: 120,     p: 1,    B: 0 },
  "IEEE-MI": { g: "IEEE C37.112",  n: "Moderadamente inversa",     A: 0.0515,  p: 0.02, B: 0.114 },
  "IEEE-VI": { g: "IEEE C37.112",  n: "Muito inversa",             A: 19.61,   p: 2,    B: 0.491 },
  "IEEE-EI": { g: "IEEE C37.112",  n: "Extremamente inversa",      A: 28.2,    p: 2,    B: 0.1217 },
  "US-U1":   { g: "US (U1–U5)",    n: "U1 Moderadamente inversa",  A: 0.2256,  p: 0.02, B: 0.0104 },
  "US-U2":   { g: "US (U1–U5)",    n: "U2 Inversa",                A: 5.95,    p: 2,    B: 0.180 },
  "US-U3":   { g: "US (U1–U5)",    n: "U3 Muito inversa",          A: 3.88,    p: 2,    B: 0.0963 },
  "US-U4":   { g: "US (U1–U5)",    n: "U4 Extremamente inversa",   A: 5.67,    p: 2,    B: 0.0352 },
  "US-U5":   { g: "US (U1–U5)",    n: "U5 Tempo curto inversa",    A: 0.00262, p: 0.02, B: 0.00342 },
  "DT":      { g: "Outras",        n: "Tempo definido",            A: 0, p: 1, B: 0 },
  "CUSTOM":  { g: "Outras",        n: "Personalizada (A, p, B)",   A: 0.14, p: 0.02, B: 0 }
};

/* Curvas Kyle: constantes do código VBA de referência:  t = dial · ( k / (M^alpha − 1) + C ).
   Só estão cadastradas as curvas presentes no VBA. Formato: número da curva: [k, alpha, C]. */
const KYLE_CONSTS = {
  103: [2, 2.5, 0.015],   106: [4.5, 2.3, 0.012], 111: [5, 1.5, 0],      112: [9, 2, 0.02],     113: [16, 2.3, 0.018],
  115: [60, 3.1, 0.01],   116: [20, 2, 0],        118: [25, 2.2, 0.015], 119: [20, 2, 0.45],    120: [30, 2, 0.09],
  131: [0.65, 0.1, 0.38], 132: [60, 2.2, 0.01],   133: [43, 2, 0.04],    134: [50, 2.3, 0.4],   135: [30, 1.7, 0.5],
  137: [40, 1.5, 0.1],    138: [42, 1.5, 0],      139: [40, 1.8, 0],     140: [80, 2, 1],       141: [0.05, 0.01, 10],
  151: [180, 2.5, 0.45],  162: [80, 2.2, 0.02],   163: [20, 2, 0.01],    164: [250, 2.6, 0.02], 165: [800, 3.1, 0.04],
  200: [100, 1.5, 0.25],  201: [800, 2.5, 0.5],   202: [300, 2, 0.02]
};
Object.entries(KYLE_CONSTS).forEach(([n, [k, alpha, C]]) => { CURVES["KYLE-" + n] = { g: "Kyle", n: "Kyle " + n, A: k, p: alpha, B: C }; });

/* ---------- Geração de pontos / interpolação ---------- */
// Amostra f(I) em escala log e quebra a linha onde f é infinito. thr = correntes onde há degrau (gera salto vertical).
function buildCurve(f, lo, hi, thr = [], n = 600){
  const xs = logspace(lo, hi, n);
  thr.forEach(x => { if (x > lo && x < hi) xs.push(x * (1 - 1e-9), x); });
  xs.sort((a, b) => a - b);
  const segs = []; let cur = [];
  for (const x of xs){
    const t = f(x);
    if (isFinite(t) && t > 0) cur.push([x, t]);
    else { if (cur.length > 1) segs.push(cur); cur = []; }
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}
// Interpolação log-log em uma tabela [[x,y],...] ordenada. Abaixo do 1º ponto: Infinity; acima do último: último valor.
function interpLL(P, x){
  if (!P.length || x < P[0][0]) return Infinity;
  const L = P[P.length - 1];
  if (x >= L[0]) return L[1];
  for (let i = 0; i < P.length - 1; i++){
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    if (x <= x1 && x1 > x0)
      return Math.exp(Math.log(y0) + (Math.log(y1) - Math.log(y0)) * (Math.log(x / x0) / Math.log(x1 / x0)));
  }
  return Infinity;
}
// Menor tempo entre os trechos de uma polilinha que cobrem a corrente x (ignora trechos verticais).
function tAtPoly(P, x){
  let best = Infinity;
  for (let i = 0; i < P.length - 1; i++){
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    if (x1 > x0 && x >= x0 && x <= x1){
      const t = Math.exp(Math.log(y0) + (Math.log(y1) - Math.log(y0)) * (Math.log(x / x0) / Math.log(x1 / x0)));
      best = Math.min(best, t);
    }
  }
  return best;
}
const scaleSegs = (segs, s) => segs.map(sg => sg.map(([I, t]) => [I * s, t]));
function bandsFrom(segs, tol){
  if (!(tol > 0)) return [];
  return segs.map(sg => ({ up: sg.map(([I, t]) => [I, t * (1 + tol)]), lo: sg.map(([I, t]) => [I, t * (1 - tol)]) }));
}
// Fator de conversão do circuito do dispositivo para a tensão base do gráfico.
const sc = d => d.kv / S.baseKV;

/* Tabela "corrente  t1  [t2]" digitada em texto (aceita vírgula decimal; separadores: espaço, tab ou ;) */
function parseTable(txt){
  const rows = [];
  String(txt).split(/\n/).forEach(l => {
    const v = l.trim().split(/[;\t ]+/).map(x => parseFloat(x.replace(",", "."))).filter(x => isFinite(x));
    if (v.length >= 2 && v[0] > 0 && v[1] > 0) rows.push(v);
  });
  rows.sort((a, b) => a[0] - b[0]);
  return rows;
}

/* ---------- Relé 50/51 ---------- */
function relayParams(d){
  const r = d.ct1 / d.ct2;
  return { r, Ip: d.tap * r, Ii: d.instSec * r };
}
function relayModel(d){
  const s = sc(d), { Ip, Ii } = relayParams(d);
  const c = d.curve === "CUSTOM" ? { A: d.cA, p: d.cP, B: d.cB } : CURVES[d.curve];
  const f = I => {
    if (d.inst && Ii > 0 && I >= Ii) return d.instT;
    if (!(I > Ip * 1.0001)) return Infinity;
    if (d.curve === "DT") return d.dial;
    const den = Math.pow(I / Ip, c.p) - 1;
    return den > 0 ? d.dial * (c.A / den + c.B) : Infinity;
  };
  const thr = [Ip * 1.0001]; if (d.inst && Ii > 0) thr.push(Ii);
  const segs = scaleSegs(buildCurve(f, Ip * 1.002, 1e7, thr), s);
  return { kind: "protect", segs: segs.map(pts => ({ pts, w: 2 })), bands: bandsFrom(segs, d.tol / 100), pts: [], vls: [], tAt: I => f(I / s) };
}

/* ---------- Disjuntor BT (L, S, I) ---------- */
function breakerModel(d){
  const s = sc(d), Ir = d.ir, Isd = d.isd * Ir, Ii = d.ii * Ir;
  const f = I => {
    if (d.iiOn && I >= Ii) return d.ti;
    if (d.sdOn && I >= Isd) return d.i2t ? d.tsd * Math.pow(Isd / I, 2) : d.tsd;
    return I >= 1.05 * Ir ? d.tr * Math.pow(6 * Ir / I, 2) : Infinity;   // longa: t = tr·(6·Ir/I)²
  };
  const thr = [1.05 * Ir]; if (d.sdOn) thr.push(Isd); if (d.iiOn) thr.push(Ii);
  const segs = scaleSegs(buildCurve(f, Ir, 1e7, thr), s);
  return { kind: "protect", segs: segs.map(pts => ({ pts, w: 2 })), bands: bandsFrom(segs, d.tol / 100), pts: [], vls: [], tAt: I => f(I / s) };
}

/* ---------- Curva por pontos (fusível, curva digitalizada de catálogo, limite de dano) ----------
   Colunas: corrente  t_fusão/t_mín  [t_total/t_máx].  Com 3 colunas desenha as duas curvas e a faixa entre elas. */
function pointsModel(d){
  const s = sc(d), T = parseTable(d.pts);
  const three = T.some(r => r.length >= 3);
  const mainP = T.map(r => [r[0], three && r.length >= 3 ? r[2] : r[1]]);
  const minP = T.map(r => [r[0], r[1]]);
  const segs = [], bands = [];
  if (mainP.length > 1) segs.push({ pts: mainP.map(([I, t]) => [I * s, t]), w: 2, dash: d.role === "damage" ? "7 4" : "" });
  if (three && d.showMelt && minP.length > 1){
    segs.push({ pts: minP.map(([I, t]) => [I * s, t]), w: 1.4, dash: "5 4" });
    bands.push({ up: mainP.map(([I, t]) => [I * s, t]), lo: minP.map(([I, t]) => [I * s, t]) });
  }
  return { kind: d.role === "damage" ? "damage" : "protect", segs, bands, pts: [], vls: [], tAt: I => interpLL(mainP, I / s) };
}

/* ---------- Transformador: curva de dano ANSI/IEEE C57.109 + inrush ----------
   Pontos térmicos (múltiplos de In) e pontos mecânicos em função de Zt (falhas frequentes, categorias II a IV). */
const TH = [[2, 1800], [3, 300], [4.75, 60], [6.3, 30], [11.3, 10], [25, 2]];
function thermalT(pu){
  if (pu >= 11.3) return 1250 / (pu * pu);
  if (pu <= 2) return 1800;
  return interpLL(TH, pu);
}
function autoCat(d){
  const k = d.kva;
  if (d.ph === 3) return k <= 500 ? 1 : k <= 5000 ? 2 : k <= 30000 ? 3 : 4;
  return k <= 500 ? 1 : k <= 1667 ? 2 : k <= 10000 ? 3 : 4;
}
function ansiPts(cat, Z, freq){
  const lim = cat >= 2 && freq ? (cat === 2 ? 0.7 : 0.5) / Z : 25;
  const pts = [];
  TH.forEach(p => { if (p[0] < lim) pts.push(p.slice()); });
  pts.push([lim, thermalT(lim)]);
  if (cat >= 2 && freq){
    pts.push([lim, 2 / (Z * Z) / (lim * lim)]);   // I²t = K = 2/Zt²
    pts.push([1 / Z, 2]);
  }
  return pts;
}
function xfmrBase(d){
  const V = d.side === "primario" ? d.v1 : d.v2;
  const k3 = d.ph === 3 ? Math.sqrt(3) : 1;
  return { V, In: d.kva / (k3 * V), In1: d.kva / (k3 * d.v1), In2: d.kva / (k3 * d.v2) };
}
function xfmrModel(d){
  const { V, In } = xfmrBase(d), s = V / S.baseKV, Z = d.z / 100;
  const cat = d.cat === "auto" ? autoCat(d) : +d.cat;
  const P = ansiPts(cat, Z, d.freq).map(([pu, t]) => [pu * In * s * d.shift, t]);
  const segs = [], pts = [];
  if (d.showDamage) segs.push({ pts: P, w: 2.4 });
  if (d.showInrush) pts.push({ I: d.inrushX * In * s, t: d.inrushT, label: "Inrush " + d.name });
  return { kind: "damage", segs, bands: [], pts, vls: [], tAt: I => d.showDamage ? tAtPoly(P, I) : Infinity };
}

/* ---------- Cabo: limite térmico  t = (k·S / I)² ---------- */
function cableModel(d){
  const s = sc(d), K = d.k * d.s;
  const f = I => Math.pow(K / I, 2);
  const segs = scaleSegs(buildCurve(f, 1, 1e7, [], 300), s);
  const vls = d.iz > 0 ? [{ I: d.iz * s, label: "Iz " + d.name, dash: "2 4" }] : [];
  return { kind: "damage", segs: segs.map(pts => ({ pts, w: 2, dash: "7 4" })), bands: [], pts: [], vls, tAt: I => f(I / s) };
}

/* ---------- Motor: caixa de partida + limite de rotor bloqueado ---------- */
function motorModel(d){
  const s = sc(d), Ip = d.in * d.ratio;
  const start = [[d.in, d.ts], [Ip, d.ts], [Ip, 0.001]].map(([I, t]) => [I * s, t]);
  const stall = logspace(1.5 * d.in, Ip, 40).map(I => [I * s, d.tstall * Math.pow(Ip / I, 2)]);
  return { kind: "info", segs: [{ pts: start, w: 2 }, { pts: stall, w: 1.6, dash: "6 4" }], bands: [], pts: [{ I: Ip * s, t: d.tstall, label: "Rotor bloq. " + d.name }], vls: [], tAt: () => Infinity };
}

/* ---------- Linha vertical (Icc, corrente de carga...) ---------- */
function markerModel(d){
  return { kind: "marker", segs: [], bands: [], pts: [], vls: [{ I: d.I * sc(d), label: d.name, dash: d.dash ? "6 4" : "" }], tAt: () => Infinity };
}

const MODELS = { relay: relayModel, breaker: breakerModel, curve: pointsModel, xfmr: xfmrModel, cable: cableModel, motor: motorModel, marker: markerModel };

/* ============ Proteção do cliente (funções 50/51) ============
   Lido de S.cliente = { f51:{ s1, s2 }, f50:{ on, ip, dial } }. Correntes em A, na tensão base.
   Estágio 51: { on, norm:"IEC|IEEE|US|DT", tipo:"NI|VI|EI|LTI|MI|U1..U5", ip, dial }.  Função 50: pickup instantâneo + tempo (s). */
const NORMS = [["IEC", "IEC"], ["IEEE", "IEEE"], ["US", "US"], ["KYLE", "Kyle"], ["DT", "Tempo def."]];
const TIPOS = {
  IEC:  [["NI", "NI"], ["VI", "VI"], ["EI", "EI"], ["LTI", "LTI"]],
  IEEE: [["MI", "MI"], ["VI", "VI"], ["EI", "EI"]],
  US:   [["U1", "U1"], ["U2", "U2"], ["U3", "U3"], ["U4", "U4"], ["U5", "U5"]],
  KYLE: Object.keys(KYLE_CONSTS).map(n => [n, n]),
  DT:   []
};
const T50_MIN = 0.04;   // dial 0 na função 50 = instantâneo; é plotado em 0,04 s para aparecer no gráfico
const curveKey = st => st.norm === "DT" ? "DT" : st.norm + "-" + st.tipo;

function stageLabel(st){ return st.norm === "DT" ? "TD" : st.norm === "KYLE" ? "Kyle " + st.tipo : st.norm + " " + st.tipo; }

/* Cada elemento ativo vira { name, color, ip, th, f, segs(individual) }:
     f(I)  = tempo de atuação do elemento sozinho (Infinity abaixo do pickup)
     th    = corrente em que o elemento passa a atuar */
function stageElement(st, name, color){
  if (!st || st.on === false || !(st.ip > 0) || !(st.dial > 0)) return null;
  const c = CURVES[curveKey(st)]; if (!c) return null;       // curveKey: "IEC-EI", "KYLE-103", "DT"...
  const ip = st.ip, th = ip * 1.0001;
  const f = I => {
    if (!(I > th)) return Infinity;
    if (st.norm === "DT") return st.dial;
    const den = Math.pow(I / ip, c.p) - 1;
    return den > 0 ? st.dial * (c.A / den + c.B) : Infinity;
  };
  return { name, color, ip, th, f, segs: buildCurve(f, ip * 1.002, 1e7, [th]) };
}
function f50Element(f50, name, color){
  if (!f50 || !f50.on || !(f50.ip > 0)) return null;
  const t = Math.max(f50.dial || 0, T50_MIN);
  return { name, color, ip: f50.ip, th: f50.ip, override: !(f50.dial > 0), f: I => I >= f50.ip ? t : Infinity, segs: [[[f50.ip, 1e5], [f50.ip, t], [1e7, t]]] };
}

/* Curva resultante: em cada corrente vale o MENOR tempo entre os elementos ativos.
   Quando um elemento passa a ser o mais rápido (entra o estágio 2, a função 50, ou há cruzamento entre curvas),
   a linha continua de onde o anterior parou: desce na vertical ou troca de curva no ponto de interseção. */
function buildEnvelope(els, hi = 1e7){
  if (!els.length) return [];
  // elemento instantâneo (dial 0) prevalece sobre os demais acima do seu pickup; os outros competem pelo menor tempo
  const at = I => {
    const o = els.findIndex(e => e.override && isFinite(e.f(I)));
    if (o >= 0) return [els[o].f(I), o];
    let bt = Infinity, bk = -1; els.forEach((e, k) => { const t = e.f(I); if (t < bt){ bt = t; bk = k; } });
    return [bt, bk];
  };
  const xs = logspace(Math.min(...els.map(e => e.ip)) * 1.002, hi, 900);
  els.forEach(e => { if (e.th > xs[0] && e.th < hi) xs.push(e.th * (1 - 1e-9), e.th); });
  xs.sort((a, b) => a - b);
  const segs = []; let cur = null, prev = null;
  for (const x of xs){
    const [t, k] = at(x);
    if (!isFinite(t) || t <= 0){ prev = null; cur = null; continue; }
    if (!prev){ cur = { color: els[k].color, pts: [[x, t]] }; segs.push(cur); }
    else if (k === prev.k) cur.pts.push([x, t]);
    else {                                           // troca de elemento: localiza o ponto exato por bisseção
      let lo = prev.x, hi2 = x;
      for (let n = 0; n < 60; n++){ const mid = Math.sqrt(lo * hi2); at(mid)[1] === prev.k ? lo = mid : hi2 = mid; }
      const tOld = els[prev.k].f(lo), [tNew] = at(hi2);   // tOld: tempo do elemento anterior no ponto da troca
      if (isFinite(tOld)) cur.pts.push([lo, tOld]);
      cur = { color: els[k].color, pts: [[lo, isFinite(tOld) ? tOld : tNew], [hi2, tNew], [x, t]] };
      segs.push(cur);
    }
    prev = { x, t, k };
  }
  return segs.filter(s => s.pts.length > 1);
}

/* Cores das curvas da concessionária (as do cliente ficam em FUNCS[].colors) */
const CONC_COLORS = {
  "51":  { s1: "#C2185B", s2: "#F06292" }, "50":  { m: "#4A148C" },
  "51N": { s1: "#00796B", s2: "#4DB6AC" }, "50N": { m: "#5D4037" },
  "51G": { s1: "#1565C0", s2: "#64B5F6" }
};

/* Modelos de um conjunto de proteções (cliente ou concessionária) para a visão do gráfico.
   who: { C: dados (funcs), label: texto, colors: cores por função, dash: tracejado das individuais, res: cor/nome da resultante } */
function protModels(group, who){
  const C = who.C.funcs, els = [], pre = who.label ? who.label + " · " : "";
  (GROUPS[group] || GROUPS.fase).ids.forEach(id => {
    const def = FUNC_BY_ID[id], F = C[id]; if (!F || !F.en) return;
    const col = (who.colors && who.colors[id]) || def.colors;
    if (def.curve === "oc"){
      ["s1", "s2"].forEach((k, i) => {
        const st = F[k];
        const e = stageElement(st, pre + fnLabel(id) + " · Ip" + (i + 1) + " (" + stageLabel(st) + ", " + (st.norm === "DT" ? "t " : "dial ") + ptbr(st.dial) + ")", col[k]);
        if (e){ e.key = who.k + ":" + id + ":" + k; e.fid = id; e.dt = st.norm === "DT"; els.push(e); }
      });
    } else if (def.curve === "inst"){
      const e = f50Element({ on: true, ip: F.m.ip, dial: F.m.dial }, pre + fnLabel(id) + " · Instantâneo (" + ptbr(F.m.ip) + " A)", col.m);
      if (e){ e.key = who.k + ":" + id + ":m"; e.fid = id; e.dt = true; els.push(e); }
    }
  });
  // 67 (direcional): curva própria, fora da resultante (atua só com corrente no sentido do alimentador)
  const dirs = [];
  (GROUPS[group] || GROUPS.fase).ids.forEach(id => {
    const def = FUNC_BY_ID[id], F = C[id]; if (def.curve !== "dir" || !F || !F.en) return;
    const de = [];
    ["s1", "s2"].forEach((k, i) => {
      const st = F[k]; if (k === "s2" && !st.on) return;
      const col = (who.colors && who.colors[id] && who.colors[id][k]) || def.colors[k];
      const dt = st.norm === "DT", inst = dt && st.ip > 0 && !(st.dial > 0);          // tempo definido sem tempo (ou 0) = atuação instantânea
      const e = stageElement(Object.assign({}, st, { on: true, dial: inst ? T50_MIN : st.dial }), "", col); if (!e) return;
      const t = inst ? T50_MIN : st.dial;
      e.dt = dt;
      if (dt) e.segs = [[[st.ip, 1e5], [st.ip, t], [1e7, t]]];
      e.override = inst;
      e.name = pre + fnLabel(id) + " · Ip" + (i + 1) + " " + ptbr(st.ip) + " A (" + stageLabel(st) + ", " + (inst ? "instantâneo" : (dt ? "t " : "dial ") + ptbr(st.dial) + (dt ? " s" : "")) + ", " + (st.dir === "reversa" ? "reversa" : "frente") + ")";
      e.key = who.k + ":" + id + ":" + k;
      de.push(e);
    });
    if (!de.length) return;
    de.forEach(e => dirs.push({ d: { name: e.name, color: e.color, dash: "8 3" },       // individuais inteiras: só com "Mostrar também as curvas individuais"
      m: { key: e.key, indiv: true, kind: "protect", legend: true, bands: [], pts: [], vls: [], tAt: e.f, segs: e.segs.map(pts => ({ pts, w: 1.2, dash: "4 3", op: 0.8 })) } }));
    const rc = def.colors.s1;                                                           // 67: só o trecho de menor tempo entre os estágios, numa linha única
    dirs.push({ d: { name: pre + fnLabel(id) + (de.length > 1 ? " (resultante)" : ""), color: rc, dash: "8 3" },
      m: { key: who.k + ":" + id + ":res", kind: "protect", noLegend: true, bands: [], pts: [], vls: [],
           segs: (() => { const env = buildEnvelope(de).map(s => ({ pts: s.pts, w: 2.2, color: rc, dash: "8 3" })), e0 = de.reduce((a, e) => e.ip < a.ip ? e : a);
             if (e0.dt && env.length) env.unshift({ pts: [[e0.ip, 1e5], [e0.ip, e0.f(e0.ip * 1.002)]], w: 2.2, color: rc, dash: "8 3" });   // tempo definido: sobe na vertical no pickup
             return env; })(),
           tAt: I => { const o = de.find(e => e.override && isFinite(e.f(I))); return o ? o.f(I) : Math.min(...de.map(e => e.f(I))); } } });
  });
  const out = els.map(e => ({
    d: { name: e.name, color: e.color, dash: who.dash },
    m: { key: e.key, indiv: true, kind: "protect", legend: true, bands: [], pts: [], vls: [], tAt: e.f,
         segs: e.segs.map(pts => ({ pts, w: 1.2, dash: "4 3", op: 0.8 })) }
  }));
  if (els.length) out.push({
    d: { name: (who.resPre || "") + [...new Set(els.map(e => fnLabel(e.fid)))].join(" + "), color: who.resColor, dash: who.dash },
    m: { key: "res:" + who.k, kind: "protect", noLegend: true, bands: [], pts: [], vls: [],
         segs: (() => { const env = buildEnvelope(els).map(s => ({ pts: s.pts, w: who.w || 2.8, color: s.color, dash: who.dash })), e0 = els.reduce((a, e) => e.ip < a.ip ? e : a);
             if (e0.dt && env.length) env.unshift({ pts: [[e0.ip, 1e5], [e0.ip, e0.f(e0.ip * 1.002)]], w: who.w || 2.8, color: e0.color, dash: who.dash });   // tempo definido: sobe na vertical no pickup
             return env; })(),
         tAt: I => { const o = els.find(e => e.override && isFinite(e.f(I))); return o ? o.f(I) : Math.min(...els.map(e => e.f(I))); } }
  });
  return out.concat(dirs);
}
/* Correntes de curto-circuito do estudo (aba Dados da Concessionária), como linhas verticais:
   visão Fase → trifásica, trifásica assimétrica, bifásica; visão Neutro → fase-terra e fase-terra mínima. */
const ICC_PLOT = {
  fase:   [["i3", "Icc 3F", "#111827", "8 4", "Icc 3F"], ["i3a", "Icc 3F assim.", "#6B7280", "2 3", "Icc 3F ass."], ["i2", "Icc 2F", "#4B5563", "10 3 2 3", "Icc 2F"]],
  neutro: [["ift", "Icc FT", "#111827", "8 4", "Icc FT"], ["iftmin", "Icc FT mín.", "#6B7280", "2 3", "Icc FT mín."]]
};
const ICC_T_FIM = 0.03;   // as linhas das correntes de curto sobem da base do gráfico até 0,03 s
function iccModels(group){
  const v = typeof iccEstudo === "function" ? iccEstudo() : {}, out = [];
  (ICC_PLOT[group] || []).forEach(([k, nome, cor, dash, curto]) => {
    const n = v[k]; if (typeof n !== "number" || !isFinite(n) || n <= 0) return;
    out.push({ n, curto, d: { name: nome + " · " + ptbr((Math.round(n * 10) / 10).toString()) + " A", color: cor, dash }, k });
  });
  out.sort((a, b) => a.n - b.n);      // o rótulo da menor fica à esquerda da linha e os demais à direita, todos alinhados pela base, para não se sobrepor quando as correntes são próximas
  return out.map((o, i) => ({ d: o.d,
    m: { key: "icc:" + o.k, kind: "marker", segs: [], bands: [], pts: [], vls: [{ I: o.n, label: o.curto + " " + ptbr(Math.round(o.n).toString()) + " A", dash: o.d.dash, off: 0, side: i ? "r" : "l", tEnd: ICC_T_FIM }], tAt: () => Infinity } }));
}
/* Ponto da corrente de inrush total (visão Fase), em T_INRUSH s */
const T_INRUSH = 0.1;
function inrushModels(group){
  const r = group === "fase" && typeof inrushTotal === "function" ? inrushTotal() : null;
  if (!r) return [];
  const lab = "Inrush " + ptbr(Math.round(r.I).toString()) + " A";
  return [{ d: { name: "Inrush (método " + r.metodo + ") · " + ptbr((Math.round(r.I * 10) / 10).toString()) + " A", color: "#D97706", dash: "" },
    m: { key: "inrush:total", kind: "marker", segs: [], bands: [], pts: [{ I: r.I, t: T_INRUSH, label: lab, vert: true }], vls: [], tAt: () => Infinity } }];
}
/* Pontos ANSI (2 s) dos transformadores: Fase → I ANSI; Neutro → I NANSI. */
const T_ANSI = 2;
function ansiModels(group){
  const tipo = group === "neutro" ? "nansi" : "ansi", L = typeof trafoPontosANSI === "function" ? trafoPontosANSI(tipo) : [];
  if (!L.length) return [];
  const nome = tipo === "nansi" ? "I NANSI" : "I ANSI";
  return [{ d: { name: nome + " (2 s) · " + L.map(o => o.id).join(", "), color: tipo === "nansi" ? "#7C3AED" : "#0E7490", dash: "" },
    m: { key: "ansi:" + tipo, kind: "marker", segs: [], bands: [], vls: [], tAt: () => Infinity,
         pts: L.map(o => ({ I: o.I, t: T_ANSI, label: o.id + " · " + nome + " " + ptbr(Math.round(o.I).toString()) + " A", vert: true })) } }];
}
function clienteModels(group){
  return protModels(group, { k: "c", C: S.cliente, label: "Cliente", resPre: "Cliente · ", resColor: "#0F2747" })
    .concat(protModels(group, { k: "k", C: S.concProt, label: "Concessionária", colors: CONC_COLORS, resPre: "Concessionária · ", resColor: "#C2185B", dash: "9 5", w: 2.4 }))
    .concat(iccModels(group)).concat(inrushModels(group)).concat(ansiModels(group));
}
