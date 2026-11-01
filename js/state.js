/* state.js — estado do projeto (S), persistência local e histórico (desfazer/refazer) */
"use strict";

const STORE = "coordenograma.v4";      // v4: projeto inicial em branco (descarta dados salvos de versões anteriores)
const AXES0 = { imin: 1, imax: 100000, tmin: 0.01, tmax: 100 };      // eixos padrão: corrente de 1 A a 100 kA, tempo de 0,01 s a 100 s
const AXES_ANTIGO = { imin: 10, imax: 100000, tmin: 0.01, tmax: 1000 };
let S = null;   // projeto atual: { name, baseKV, axes, legend, info:{cliente,contratada,conc}, cliente:{funcs}, devices:[] }

/* ---------- página inicial (cadastro) ---------- */
const PARTY0 = () => ({ nome: "", endereco: "", doc: "", email: "", tel: "" });
const FINALIDADES = ["consumo", "consumo_geracao", "geracao"];     // finalidade do estudo
const blankInfo = () => ({ cliente: PARTY0(), contratada: PARTY0(), conc: "enel", fin: "consumo" });

function blank(){
  // "devices" fica reservado para a fase da concessionária (relé, disjuntor, transformador...), ainda sem interface
  return { name: "", baseKV: null, baseS: null, axes: { ...AXES0 }, legend: true, showAll: false, vis: {}, view: "fase", info: blankInfo(), cliente: clienteEmpty(), concProt: clienteEmpty(), rede: redeBlank(), trechos: [trechoBlank()], rf: 40, zUnit: "ohm", redeModo: "imp", inrushMetodo: null, nTrafos: 1, trafos: [trafoBlank()], tc: tcBlank(), dem: demNormalize(), mult: {}, mao: {}, mbase: {}, mAuto: {}, devices: [] };
}
const sample = () => blank();

// Completa campos que faltam (projetos antigos / JSON colado)
function normalize(j){
  const o = Object.assign(blank(), j);
  o.axes = Object.assign({ ...AXES0 }, j.axes || {});
  if (Object.keys(AXES_ANTIGO).every(k => Math.abs(o.axes[k] / AXES_ANTIGO[k] - 1) < 1e-6)) o.axes = { ...AXES0 };   // projeto ainda com os eixos antigos: passa para o padrão novo
  const ji = j.info || {};
  o.info = { cliente: Object.assign(PARTY0(), ji.cliente), contratada: Object.assign(PARTY0(), ji.contratada), conc: ji.conc || "enel", fin: FINALIDADES.includes(ji.fin) ? ji.fin : "consumo" };
  o.concProt = normalizeCliente(j.concProt, clienteEmpty());   // proteção da concessionária (aba Dados da Concessionária)
  o.cliente = normalizeCliente(j.cliente);                 // ver funcoes.js
  if (!GROUPS[o.view]) o.view = "fase";
  o.baseS = typeof j.baseS === "number" && j.baseS > 0 ? j.baseS : null;
  o.redeModo = j.redeModo === "icc" ? "icc" : "imp";
  o.inrushMetodo = Number.isInteger(j.inrushMetodo) && j.inrushMetodo >= 1 && j.inrushMetodo <= 5 ? j.inrushMetodo : null;   // null = padrão da concessionária
  o.rf = typeof j.rf === "number" && j.rf >= 0 ? j.rf : 40;
  o.zUnit = j.zUnit === "pu" ? "pu" : "ohm";
  o.trechos = trechosNormalize(j.trechos, j.rede);
  o.trafos = trafosNormalize(j.trafos, j.nTrafos);
  o.nTrafos = Number.isInteger(j.nTrafos) ? clamp(j.nTrafos, 1, TR_MAX) : o.trafos.length;
  o.tc = tcNormalize(j.tc);
  o.dem = demNormalize(j.dem);
  o.mao = Object.assign({}, j.mao || {}); o.mbase = Object.assign({}, j.mbase || {}); o.mAuto = Object.assign({}, j.mAuto || {});
  o.mult = {}; Object.entries(j.mult || {}).forEach(([k, v]) => { if (typeof k === "string" && v > 0) o.mult[k] = v; });
  o.rede = redeNormalize(j.rede);
  o.vis = Object.assign({}, j.vis || {});
  o.devices = [];
  return o;
}

/* ---------- persistência no navegador ---------- */
function save(){ if (typeof projSalvar === "function") projSalvar(); }      // cada estudo é guardado na biblioteca (projetos.js)
let _saveT = 0;
function touch(){                      // chame depois de qualquer alteração no projeto
  clearTimeout(_saveT); _saveT = setTimeout(save, 300);
  histSoon();
}

/* ---------- histórico (os eixos do gráfico não entram) ---------- */
const HIST = { stack: [], i: -1, max: 100, t: 0 };
const histJSON = () => JSON.stringify({ ...S, axes: undefined });
function histInit(){ HIST.stack = [histJSON()]; HIST.i = 0; updHistBtns(); }
function histSoon(){ clearTimeout(HIST.t); HIST.t = setTimeout(histPush, 500); }
function histPush(){
  clearTimeout(HIST.t);
  const j = histJSON(); if (j === HIST.stack[HIST.i]) return;
  HIST.stack = HIST.stack.slice(0, HIST.i + 1); HIST.stack.push(j);
  if (HIST.stack.length > HIST.max) HIST.stack.shift();
  HIST.i = HIST.stack.length - 1; updHistBtns();
}
function histRestore(){
  const keep = { axes: S.axes };
  S = Object.assign(normalize(JSON.parse(HIST.stack[HIST.i])), keep);
  fullRender(); save(); updHistBtns();
}
function undo(){ histPush(); if (HIST.i > 0){ HIST.i--; histRestore(); } }
function redo(){ if (HIST.i < HIST.stack.length - 1){ HIST.i++; histRestore(); } }
function updHistBtns(){
  const u = $("#btnUndo"), r = $("#btnRedo");
  if (u) u.disabled = HIST.i <= 0;
  if (r) r.disabled = HIST.i >= HIST.stack.length - 1;
}
