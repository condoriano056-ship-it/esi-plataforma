/* funcoes.js — catálogo das funções de proteção do cliente (ordem do menu) e seus campos de preenchimento.
   Para ajustar ou incluir um campo, edite o "fields" da função. Para incluir uma função nova, acrescente um item em FUNCS.

   Tipos de campo:  num   { k, lab, unit }        caixa numérica
                    sel   { k, lab, opts }        lista de opções
                    curve { lab }                 par norma + tipo da curva (grava em norm e tipo)
   id = chave interna (não mude: é usada nos dados salvos); label = texto mostrado, se diferente do id; name = nome completo.
   Cada função tem "sets" (blocos de campos). Um set com toggle:true ganha botão ON/OFF próprio.
   "curve" indica como a função vai para o gráfico: "oc" (curva inversa, 2 estágios) ou "inst" (instantânea); sem "curve" só guarda os dados. */
"use strict";

const NUM = (k, lab, unit, extra = {}) => ({ t: "num", k, lab, unit, ...extra });
const SEL = (k, lab, opts) => ({ t: "sel", k, lab, opts });
const CURVE = { t: "curve", lab: "Curva" };
const DIAL = { t: "num", k: "dial", lab: "Dial", unit: "", dial: true };       // vira "Tempo (s)" quando a norma é tempo definido
const ocSets = () => [
  { key: "s1", title: "Estágio 1", fields: [NUM("ip", "Ip<sub>1</sub>", "A"), CURVE, DIAL] },
  { key: "s2", title: "Estágio 2", toggle: true, fields: [NUM("ip", "Ip<sub>2</sub>", "A"), CURVE, DIAL] }
];
const tensaoSets = () => [
  { key: "s1", title: "Estágio 1", fields: [NUM("ip", "Pickup", "% Vn"), NUM("t", "Tempo", "s")] },
  { key: "s2", title: "Estágio 2", toggle: true, fields: [NUM("ip", "Pickup", "% Vn"), NUM("t", "Tempo", "s")] }
];

const FUNCS = [
  { id: "51",   name: "Sobrecorrente temporizada de Fase",  curve: "oc",   group: "fase",   colors: { s1: "#D62728", s2: "#FF7F0E" }, sets: ocSets() },
  { id: "50",   name: "Sobrecorrente instantânea de Fase",  curve: "inst", group: "fase",   colors: { m: "#0F2747" },
    sets: [{ key: "m", fields: [NUM("ip", "Instan", "A"), NUM("dial", "Dial", "s")] }] },
  { id: "51N",  name: "Sobrecorrente temporizada de Neutro", curve: "oc",  group: "neutro", colors: { s1: "#2CA02C", s2: "#9467BD" }, sets: ocSets() },
  { id: "50N",  name: "Sobrecorrente instantânea de Neutro", curve: "inst", group: "neutro", colors: { m: "#8C564B" },
    sets: [{ key: "m", fields: [NUM("ip", "Instan", "A"), NUM("dial", "Dial", "s")] }] },
  { id: "51G",  label: "51GS", name: "Sobrecorrente de Neutro Sensível",  curve: "oc",  group: "neutro",  colors: { s1: "#17BECF", s2: "#E377C2" }, sets: ocSets() },
  { id: "67",   name: "Sobrecorrente direcional de Fase", curve: "dir", group: "fase", colors: { s1: "#E91E8C", s2: "#F48FB1" },
    sets: [
      { key: "s1", title: "Estágio 1", fields: [NUM("ip", "Ip<sub>1</sub>", "A"), CURVE, DIAL, SEL("dir", "Direção", [["frente", "Frente"], ["reversa", "Reversa"]]), NUM("ang", "Ângulo", "°")] },
      { key: "s2", title: "Estágio 2", toggle: true, fields: [NUM("ip", "Ip<sub>2</sub>", "A"), CURVE, DIAL, SEL("dir", "Direção", [["frente", "Frente"], ["reversa", "Reversa"]]), NUM("ang", "Ângulo", "°")] }
    ] },
  { id: "59",   name: "Sobretensão",                         sets: tensaoSets() },
  { id: "27",   name: "Subtensão",                           sets: tensaoSets() },
  { id: "47",   name: "Desbalanço de Tensão ou Sequência de Fase",
    sets: [{ key: "m", fields: [NUM("ip", "Pickup", "% V2/V1"), NUM("t", "Tempo", "s")] }] },
  { id: "59N",  name: "Sobretensão de Neutro",
    sets: [{ key: "m", fields: [NUM("ip", "Pickup", "V"), NUM("t", "Tempo", "s")] }] },
  { id: "81O/U", name: "Sobre e Subfrequência",
    sets: [
      { key: "o1", title: "81O · Sobrefrequência · Estágio 1", fields: [NUM("ip", "Pickup", "Hz"), NUM("t", "Tempo", "s")] },
      { key: "o2", title: "81O · Sobrefrequência · Estágio 2", fields: [NUM("ip", "Pickup", "Hz"), NUM("t", "Tempo", "s")] },
      { key: "u1", title: "81U · Subfrequência · Estágio 1",   fields: [NUM("ip", "Pickup", "Hz"), NUM("t", "Tempo", "s")] },
      { key: "u2", title: "81U · Subfrequência · Estágio 2",   fields: [NUM("ip", "Pickup", "Hz"), NUM("t", "Tempo", "s")] }
    ] },
  { id: "46",   name: "Desbalanço de Corrente",
    sets: [{ key: "m", fields: [NUM("ip", "Pickup", "A"), CURVE, DIAL] }] },
  { id: "32",   name: "Direcional de Potência",
    sets: [{ key: "m", fields: [NUM("ip", "Pickup", "kW"), SEL("dir", "Direção", [["direta", "Direta"], ["reversa", "Reversa"]]), NUM("t", "Tempo", "s")] }] },
  { id: "27-0", name: "Subtensão da Alimentação Auxiliar",
    sets: [{ key: "m", fields: [NUM("ip", "Pickup", "V"), NUM("t", "Tempo", "s")] }] }
];
const FUNC_BY_ID = Object.fromEntries(FUNCS.map(f => [f.id, f]));
const fnLabel = id => FUNC_BY_ID[id].label || id;       // texto do botão e do título

/* Quais funções aparecem em cada visão do gráfico (fase e neutro ficam em gráficos separados; 51G entra no neutro) */
const GROUPS = { fase: { label: "Fase", ids: ["51", "50", "67"] }, neutro: { label: "Neutro", ids: ["51N", "50N", "51G"] } };

/* ---------- valores iniciais ---------- */
function blankSet(set){
  const o = {}; if (set.toggle) o.on = false;
  set.fields.forEach(f => {
    if (f.t === "curve"){ o.norm = "IEC"; o.tipo = "NI"; }
    else if (f.t === "sel") o[f.k] = f.opts[0][0];
    else o[f.k] = null;
  });
  return o;
}
function blankFunc(def){ const o = { en: false }; def.sets.forEach(s => { o[s.key] = blankSet(s); }); return o; }
function clienteEmpty(){ const funcs = {}; FUNCS.forEach(d => { funcs[d.id] = blankFunc(d); }); return { funcs }; }
function clienteExample(){                                     // valores da planilha de referência
  const c = clienteEmpty(), f51 = c.funcs["51"], f50 = c.funcs["50"];
  f51.en = true; Object.assign(f51.s1, { norm: "IEC", tipo: "EI", ip: 19.72, dial: 0.5 });
  f50.en = true; Object.assign(f50.m, { ip: 355.12, dial: 0 });
  return c;
}
// Completa campos que faltam e converte o formato antigo (f51 / f50) para o novo (funcs)
function normalizeCliente(jc, base){
  jc = jc || {}; base = base || clienteEmpty();
  const old = jc.funcs || {}, out = { funcs: {} };
  FUNCS.forEach(def => {
    const src = Object.assign({}, old[def.id] || {}); if (def.id === "67" && src.m && !src.s1) src.s1 = src.m;
    if (def.id === "81O/U"){ if (src.o && !src.o1) src.o1 = src.o; if (src.u && !src.u1) src.u1 = src.u; }   // projetos antigos: um estágio por função   // projetos antigos: o 67 tinha um único bloco
    const o = { en: src.en === undefined ? base.funcs[def.id].en : !!src.en };
    def.sets.forEach(s => { o[s.key] = Object.assign({}, base.funcs[def.id][s.key], src[s.key]); });
    out.funcs[def.id] = o;
  });
  if (!jc.funcs){
    const f51 = out.funcs["51"], f50 = out.funcs["50"];
    if (jc.f51){ Object.assign(f51.s1, jc.f51.s1); Object.assign(f51.s2, jc.f51.s2); f51.en = true; }
    if (jc.f50){ f50.m = { ip: jc.f50.ip, dial: jc.f50.dial }; f50.en = !!jc.f50.on; }
  }
  return out;
}
