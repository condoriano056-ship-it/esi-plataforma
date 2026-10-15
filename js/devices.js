/* devices.js — tipos de dispositivo: valores padrão, formulários (SCHEMA) e textos informativos.
   Para criar um novo tipo: 1) adicione em TYPES, 2) DEFAULTS, 3) SCHEMA, 4) crie o modelo em curves.js e registre em MODELS. */
"use strict";

const TYPES = {
  relay:   { label: "Relé 50/51",       tag: "REL" },
  breaker: { label: "Disjuntor BT",     tag: "DJ" },
  curve:   { label: "Curva por pontos", tag: "PTS" },
  xfmr:    { label: "Transformador",    tag: "TR" },
  cable:   { label: "Cabo",             tag: "CAB" },
  motor:   { label: "Motor",            tag: "MOT" },
  marker:  { label: "Linha de Icc",     tag: "Icc" }
};

const FUSE_EXAMPLE = "150  400  800\n200  60  120\n300  10  22\n500  1,5  3\n1000  0,15  0,3\n2000  0,03  0,07\n5000  0,008  0,02\n10000  0,004  0,012";

const DEFAULTS = {
  relay:   () => ({ name: "Relé 51/50", kv: S.baseKV, ct1: 100, ct2: 5, tap: 3.5, curve: "IEC-NI", dial: 0.2, cA: 0.14, cP: 0.02, cB: 0, inst: true, instSec: 40, instT: 0.05, tol: 0 }),
  breaker: () => ({ name: "Disjuntor BT", kv: 0.38, ir: 1500, tr: 6, sdOn: true, isd: 8, tsd: 0.2, i2t: false, iiOn: true, ii: 12, ti: 0.03, tol: 0 }),
  curve:   () => ({ name: "Fusível (exemplo)", kv: S.baseKV, role: "protect", showMelt: true, pts: FUSE_EXAMPLE }),
  xfmr:    () => ({ name: "Transformador", kva: 1000, ph: 3, v1: 13.8, v2: 0.38, z: 6, cat: "auto", freq: true, side: "primario", shift: 1, showDamage: true, showInrush: true, inrushX: 12, inrushT: 0.1 }),
  cable:   () => ({ name: "Cabo", kv: 0.38, s: 240, k: 143, iz: 0 }),
  motor:   () => ({ name: "Motor", kv: 0.38, in: 100, ratio: 6, ts: 5, tstall: 8 }),
  marker:  () => ({ name: "Icc 3φ máx.", I: 8000, kv: S.baseKV, dash: true })
};

/* ---------- Descrição dos campos de cada formulário ---------- */
const num = (key, label, extra = {}) => ({ key, label, t: "num", ...extra });
const sel = (key, label, opts, extra = {}) => ({ key, label, t: "sel", opts, ...extra });
const chk = (key, label, extra = {}) => ({ key, label, t: "chk", ...extra });
const KV = num("kv", "Tensão do circuito (kV)");
const CURVE_GROUPS = (() => { const g = {}; Object.entries(CURVES).forEach(([k, c]) => (g[c.g] = g[c.g] || []).push([k, c.n])); return g; })();

const SCHEMA = {
  relay: [
    num("ct1", "RTC primário (A)"), num("ct2", "RTC secundário (A)"),
    num("tap", "Pickup 51 – tap (A sec.)"),
    { key: "curve", label: "Curva", t: "sel", groups: CURVE_GROUPS },
    num("dial", "Dial / TMS", { labelFn: d => d.curve === "DT" ? "Tempo definido (s)" : "Dial / TMS" }),
    num("cA", "A (numerador)", { show: d => d.curve === "CUSTOM" }), num("cP", "p (expoente)", { show: d => d.curve === "CUSTOM" }), num("cB", "B (constante)", { show: d => d.curve === "CUSTOM" }),
    chk("inst", "Instantâneo (50)", { full: true }),
    num("instSec", "Pickup 50 (A sec.)", { show: d => d.inst }), num("instT", "Tempo 50 (s)", { show: d => d.inst }),
    num("tol", "Tolerância de tempo (±%)"), KV
  ],
  breaker: [
    num("ir", "Ir – longa duração (A)"), num("tr", "tr – atraso longo a 6×Ir (s)"),
    chk("sdOn", "Curta duração (Isd)", { full: true }),
    num("isd", "Isd (×Ir)", { show: d => d.sdOn }), num("tsd", "tsd (s)", { show: d => d.sdOn }),
    chk("i2t", "I²t ligado na curta", { full: true, show: d => d.sdOn }),
    chk("iiOn", "Instantâneo (Ii)", { full: true }),
    num("ii", "Ii (×Ir)", { show: d => d.iiOn }), num("ti", "Tempo instantâneo (s)", { show: d => d.iiOn }),
    num("tol", "Tolerância de tempo (±%)"), KV
  ],
  curve: [
    sel("role", "Comportamento", [["protect", "Proteção (atua)"], ["damage", "Limite de dano"]]), KV,
    chk("showMelt", "Mostrar 2ª curva e faixa (se houver 3 colunas)", { full: true }),
    { key: "pts", label: "Pontos, um por linha: corrente (A)  t mín/fusão (s)  [t máx/total (s)]", t: "area", full: true }
  ],
  xfmr: [
    num("kva", "Potência (kVA)"), sel("ph", "Fases", [["3", "Trifásico"], ["1", "Monofásico"]], { num: true }),
    num("v1", "Tensão primária (kV)"), num("v2", "Tensão secundária (kV)"),
    num("z", "Impedância Zt (%)"),
    sel("cat", "Categoria ANSI", [["auto", "Automática (por kVA)"], ["1", "I"], ["2", "II"], ["3", "III"], ["4", "IV"]]),
    sel("side", "Lado de referência", [["primario", "Primário"], ["secundario", "Secundário"]]),
    num("shift", "Fator da curva (Δ-Y falta f-f: 0,87)"),
    chk("freq", "Falhas frequentes (trecho mecânico)", { full: true }),
    chk("showDamage", "Mostrar curva de dano", { full: true }),
    chk("showInrush", "Mostrar ponto de inrush", { full: true }),
    num("inrushX", "Inrush (× In)", { show: d => d.showInrush }), num("inrushT", "Duração (s)", { show: d => d.showInrush })
  ],
  cable: [
    num("s", "Seção (mm²)"),
    sel("k", "Isolação / condutor (k)", [["143", "Cu XLPE/EPR – 143"], ["115", "Cu PVC – 115"], ["94", "Al XLPE/EPR – 94"], ["76", "Al PVC – 76"]], { num: true }),
    num("iz", "Ampacidade Iz (A, 0 = ocultar)"), KV
  ],
  motor: [
    num("in", "Corrente nominal In (A)"), num("ratio", "Ip / In"),
    num("ts", "Tempo de partida (s)"), num("tstall", "Rotor bloqueado a quente (s)"), KV
  ],
  marker: [num("I", "Corrente (A)"), KV, chk("dash", "Tracejada", { full: true })]
};

/* ---------- Texto de apoio mostrado no fim de cada formulário ---------- */
function infoHTML(d){
  const b = v => "<b>" + v + "</b>";
  const ne = Math.abs(sc(d) - 1) > 1e-9;
  if (d.type === "relay"){
    const { r, Ip, Ii } = relayParams(d), s = sc(d);
    return "RTC " + b(fmt(r)) + " · Pickup 51: " + b(fmt(Ip) + " A") + (d.inst ? " · Pickup 50: " + b(fmt(Ii) + " A") : "") +
      (ne ? "<br>Na base: 51 = " + b(fmt(Ip * s) + " A") + (d.inst ? ", 50 = " + b(fmt(Ii * s) + " A") : "") : "");
  }
  if (d.type === "breaker")
    return "Isd = " + b(fmt(d.isd * d.ir) + " A") + " · Ii = " + b(fmt(d.ii * d.ir) + " A") + (ne ? "<br>Ir na base: " + b(fmt(d.ir * sc(d)) + " A") : "");
  if (d.type === "curve")
    return parseTable(d.pts).length + " ponto(s) válido(s). Os valores iniciais são de exemplo; substitua pelos do catálogo do fabricante.";
  if (d.type === "xfmr"){
    const x = xfmrBase(d), cat = d.cat === "auto" ? autoCat(d) : +d.cat;
    return "In prim. " + b(fmt(x.In1) + " A") + " · In sec. " + b(fmt(x.In2) + " A") + "<br>Categoria " + b(["", "I", "II", "III", "IV"][cat]) + " · Icc máx. (1/Zt) sec. " + b(fmt(x.In2 / (d.z / 100)) + " A");
  }
  if (d.type === "cable") return "I²t suportável: " + b(fmt(Math.pow(d.k * d.s, 2) / 1e6) + " MA²s");
  if (d.type === "motor") return "Ip = " + b(fmt(d.in * d.ratio) + " A") + " (na tensão do circuito)";
  if (d.type === "marker") return "Na base: " + b(fmt(d.I * sc(d)) + " A");
  return "";
}
