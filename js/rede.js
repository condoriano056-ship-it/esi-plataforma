/* rede.js — "Dados da rede" (aba Dados da Concessionária).
   Modo "Impedâncias de sequência": uma lista de trechos, cada um com R1/X1 e R0/X0 (S.trechos).
   Modo "Corrente de curto direta": correntes de curto-circuito (S.rede).
   Para incluir ou mudar campos, edite TRECHO_GRUPOS / ICC_GRUPO (k = chave salva, lab = rótulo, unit = unidade). */
"use strict";

const TRECHO_GRUPOS = [
  { titulo: "Impedância de sequência positiva", campos: [
    { k: "r1", lab: "R<sub>1</sub>", unit: "Ω" }, { k: "x1", lab: "X<sub>1</sub>", unit: "Ω" } ] },
  { titulo: "Impedância de sequência zero", campos: [
    { k: "r0", lab: "R<sub>0</sub>", unit: "Ω" }, { k: "x0", lab: "X<sub>0</sub>", unit: "Ω" } ] }
];
const ICC_GRUPO = { titulo: "Corrente de curto-circuito", campos: [
  { k: "i3", lab: "Trifásica", unit: "A" }, { k: "i3a", lab: "Trifásica assimétrica", unit: "A" },
  { k: "i2", lab: "Bifásica", unit: "A" }, { k: "i2a", lab: "Bifásica assimétrica", unit: "A" },
  { k: "ift", lab: "Fase-terra", unit: "A" }, { k: "iftmin", lab: "Fase-terra mín.", unit: "A" } ] };

const numOrNull = v => typeof v === "number" && isFinite(v) ? v : null;
const redeBlank = () => { const o = {}; ICC_GRUPO.campos.forEach(c => { o[c.k] = null; }); return o; };
const redeNormalize = j => { const o = redeBlank(); Object.keys(o).forEach(k => { o[k] = numOrNull(j && j[k]); }); return o; };
const trechoBlank = () => ({ r1: null, x1: null, r0: null, x0: null });
const trechoNorm = t => { const o = trechoBlank(); Object.keys(o).forEach(k => { o[k] = numOrNull(t && t[k]); }); return o; };
// lista de trechos; projetos antigos guardavam R1/X1/R0/X0 direto em S.rede (vira o trecho 1)
const trechosNormalize = (lista, rede) => Array.isArray(lista) && lista.length ? lista.map(trechoNorm) : [trechoNorm(rede)];

const campoHTML = (id, attrs, c, val) => `<label for="${id}">${c.lab}</label>
  <div class="box"><input id="${id}" ${attrs} type="text" inputmode="decimal" autocomplete="off" value="${showNum(val)}"><span class="u">${c.unit}</span></div>`;

function trechoHTML(t, i){
  const n = S.trechos.length;
  return `<div class="trecho" data-trecho="${i}">
    <div class="trecho-top"><p class="trecho-h">Trecho ${i + 1}</p>
      ${n > 1 ? `<button type="button" class="fbtn sm" data-del-trecho="${i}" aria-label="Remover trecho ${i + 1}">Remover</button>` : ""}</div>
    <div class="rgrid">${TRECHO_GRUPOS.map(g => `<div class="rbloco"><p class="stage-h">${g.titulo}</p><div class="xl">${
      g.campos.map(c => campoHTML(`rede-t${i}-${c.k}`, `data-tr="${i}" data-k="${c.k}"`, { ...c, unit: zUnit() }, S.trechos[i][c.k])).join("")}</div></div>`).join("")}</div>
  </div>`;
}
function renderTrechos(novo){
  const box = $("#trechos"); if (!box) return;
  box.innerHTML = S.trechos.map(trechoHTML).join("");
  if (novo != null){
    const el = box.querySelector(`[data-trecho="${novo}"]`);
    if (el){ el.classList.add("novo"); const inp = el.querySelector("input"); if (inp) inp.focus(); }
  }
}

function renderRede(){
  // os dois modos ficam no HTML; ao trocar, só se alternam as classes e o CSS faz a animação
  $("#rede").innerHTML = `
    <section class="grp" aria-label="Dados da rede">
      <h3 class="grp-h">Dados da rede</h3>
      <div class="func">
        <div class="swrap" data-rmodo="imp"><div class="sinner">
          <div class="zbar">
            <label class="zsel" for="zUnit"><span>Unidade</span>
              <select id="zUnit" aria-label="Unidade da impedância"><option value="ohm">Ohms (Ω)</option><option value="pu">Por unidade (pu)</option></select></label>
          </div>
          <div id="trechos"></div>
          <button type="button" class="fbtn add-trecho" id="addTrecho">+ Adicionar trecho</button>
          <div class="rbloco rf-bloco"><p class="stage-h">Fase-terra mínima</p><div class="xl">${
            campoHTML("rede-rf", 'data-rf="1"', { lab: "Impedância de contato", unit: "Ω" }, S.rf)}</div>
            <p class="note" style="margin:6px 0 0">Usada no cálculo da corrente de fase-terra mínima (padrão: 40 Ω).</p></div>
        </div></div>
        <div class="swrap" data-rmodo="icc"><div class="sinner">
          <p class="note" style="margin:0 0 12px">Correntes de curto-circuito em ampères, na tensão base, informadas direto (sem cálculo por impedância).</p>
          <div class="rgrid"><div class="rbloco full"><p class="stage-h">${ICC_GRUPO.titulo}</p><div class="xl">${
            ICC_GRUPO.campos.map(c => campoHTML(`rede-${c.k}`, `data-rede="${c.k}"`, c, S.rede[c.k])).join("")}</div></div></div>
          <div class="rbloco rf-bloco"><p class="stage-h">Fase-terra mínima</p><div class="xl">${
            campoHTML("rede-rf-icc", 'data-rf="1"', { lab: "Impedância de contato", unit: "Ω" }, S.rf)}</div>
            <p class="note" style="margin:6px 0 0">Impedância de contato considerada na corrente de fase-terra mínima informada (padrão: 40 Ω).</p></div>
        </div></div>
      </div>
    </section>`;
  $("#zUnit").value = S.zUnit === "pu" ? "pu" : "ohm";
  renderTrechos();
  applyModo();
  syncRf(null);
  updateZNote();
  updateIccDef();
}
// a impedância de contato é a mesma nos dois modos: mantém os dois campos e os rótulos iguais
function syncRf(origem){
  document.querySelectorAll("#rede [data-rf]").forEach(i => { if (i !== origem) i.value = showNum(S.rf); });
  const t = "Fase-terra mín. (" + showNum(S.rf) + " Ω)", l = document.querySelector('label[for="rede-iftmin"]');
  if (l) l.textContent = t;
}
function updateZNote(){}
function applyModo(){
  applyInrush();
  const modo = S.redeModo === "icc" ? "icc" : "imp";
  document.querySelectorAll("#rede [data-rmodo]").forEach(w => w.classList.toggle("open", w.dataset.rmodo === modo));
  document.querySelectorAll("#redeModo [data-modo]").forEach(b => { const on = b.dataset.modo === modo; b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-checked", String(on)); });
}

$("#rede").addEventListener("input", e => {
  const el = e.target; if (el.tagName !== "INPUT") return;
  const v = parseNum(el.value); if (v === undefined) return;
  if (el.dataset.tr != null) S.trechos[+el.dataset.tr][el.dataset.k] = v;
  else if (el.dataset.rf){ S.rf = v; syncRf(el); }
  else if (el.dataset.rede) S.rede[el.dataset.rede] = v;
  else return;
  updateIccDef(); touch();
});
$("#rede").addEventListener("focusout", e => {
  const el = e.target; if (el.tagName !== "INPUT") return;
  if (el.dataset.tr != null) el.value = showNum(S.trechos[+el.dataset.tr][el.dataset.k]);
  else if (el.dataset.rf) el.value = showNum(S.rf);
  else if (el.dataset.rede) el.value = showNum(S.rede[el.dataset.rede]);
});
$("#rede").addEventListener("click", e => {
  if (e.target.closest("#addTrecho")){ S.trechos.push(trechoBlank()); renderTrechos(S.trechos.length - 1); updateIccDef(); touch(); return; }
  const d = e.target.closest("[data-del-trecho]");
  if (d && S.trechos.length > 1){ S.trechos.splice(+d.dataset.delTrecho, 1); renderTrechos(); updateIccDef(); touch(); }
});
$("#rede").addEventListener("change", e => {
  if (e.target.id !== "zUnit") return;
  S.zUnit = e.target.value === "pu" ? "pu" : "ohm"; renderTrechos(); updateZNote(); updateIccDef(); touch();
});
$("#redeModo").addEventListener("click", e => {
  const b = e.target.closest("[data-modo]"); if (!b) return;
  S.redeModo = b.dataset.modo; applyModo(); updateIccDef(); touch();
});

/* ---------- correntes de curto-circuito do estudo (valores definitivos) ----------
   Modo "Corrente de curto direta": copia os valores informados em "Dados da rede".
   Modo "Impedâncias de sequência": calcula a partir da soma (em série) dos trechos, com V = tensão de base (linha-linha):
     I3  = V / (√3·|Z1|)              trifásica (Z2 = Z1)
     I2  = V / (2·|Z1|)               bifásica
     Ift = √3·V / |2·Z1 + Z0|         fase-terra
     Ift mín = √3·V / |2·Z1 + Z0 + 3·Rf|   fase-terra mínima (Rf = impedância de contato, padrão 40 Ω)
     assimétrica = simétrica × √(1 + 2·e^(−2π/(X1/R1)))   (valor eficaz no primeiro meio ciclo; X/R de Z1) */
const ICC_DEF = [["i3", "Trifásica"], ["i3a", "Trifásica assimétrica"], ["i2", "Bifásica"], ["i2a", "Bifásica assimétrica"], ["ift", "Fase-terra"], ["iftmin", "Fase-terra mín."]];
const cabs = (a, b) => Math.hypot(a, b);

const zUnit = () => S.zUnit === "pu" ? "pu" : "Ω";
const zBase = () => S.baseKV > 0 && S.baseS > 0 ? S.baseKV * S.baseKV / S.baseS : null;      // Ω  (kV² / MVA)
const iBase = () => S.baseKV > 0 && S.baseS > 0 ? S.baseS * 1000 / (Math.sqrt(3) * S.baseKV) : null;   // A  (Sb / (√3·Vb))
/* Passos: soma dos trechos (série) → converte para pu (se vierem em Ω: Zpu = Z / Zb, Zb = Vb²/Sb; a impedância de contato,
   sempre em Ω, também) → corrente em pu → corrente em A = I(pu) × Ib. Exige tensão e potência de base. */
function calcIcc(){
  const out = { i3: null, i3a: null, i2: null, i2a: null, ift: null, iftmin: null };
  const zb = zBase(), ib = iBase(); if (!zb || !ib) return out;
  let r1 = 0, x1 = 0, r0 = 0, x0 = 0;
  S.trechos.forEach(t => { r1 += t.r1 || 0; x1 += t.x1 || 0; r0 += t.r0 || 0; x0 += t.x0 || 0; });
  if (S.zUnit !== "pu"){ r1 /= zb; x1 /= zb; r0 /= zb; x0 /= zb; }     // ohms → pu
  const rf = (S.rf || 0) / zb;                                          // impedância de contato (Ω) → pu
  const z1 = cabs(r1, x1);
  if (z1 > 0){
    out.i3 = ib / z1;                     // 3·Vf/Z1 em pu: 1/|Z1|
    out.i2 = ib * Math.sqrt(3) / (2 * z1); // = V/(2|Z1|)
    const k = r1 > 0 ? Math.sqrt(1 + 2 * Math.exp(-2 * Math.PI / (x1 / r1))) : Math.sqrt(3);   // estimativa: fator do 1º meio ciclo (X/R da seq. positiva)
    out.i3a = out.i3 * k; out.i2a = out.i2 * k;
  }
  const zg = cabs(2 * r1 + r0, 2 * x1 + x0);
  if (zg > 0) out.ift = ib * 3 / zg;
  const zm = cabs(2 * r1 + r0 + 3 * rf, 2 * x1 + x0);
  if (zm > 0) out.iftmin = ib * 3 / zm;
  return out;
}
/* X/R da sequência positiva da rede (soma dos trechos); null se não houver R. Usado na verificação de saturação do TC. */
function xrRede(){
  let r1 = 0, x1 = 0; S.trechos.forEach(t => { r1 += t.r1 || 0; x1 += t.x1 || 0; });
  return r1 > 0 && x1 > 0 ? x1 / r1 : null;
}
// valores que o estudo vai usar (A)
function iccEstudo(){
  if (S.redeModo === "icc"){ const o = {}; ICC_DEF.forEach(([k]) => { o[k] = S.rede[k]; }); return o; }
  return calcIcc();
}
function updateIccDef(){
  const grid = $("#iccGrid"); if (!grid) return;
  const v = iccEstudo(), rf = showNum(S.rf);
  if (!grid.children.length)
    grid.innerHTML = ICC_DEF.map(([k, lab]) => `<div class="iccitem"><span class="iccl" data-iccl="${k}">${lab}</span><div class="box dim"><output id="icc-${k}" data-icc="${k}"></output><span class="u">A</span></div></div>`).join("");
  ICC_DEF.forEach(([k]) => {
    const el = grid.querySelector(`[data-icc="${k}"]`), n = v[k];
    el.textContent = n == null || !isFinite(n) ? "—" : ptbr((Math.round(n * 100) / 100).toString());
  });
  grid.querySelector('[data-iccl="iftmin"]').textContent = "Fase-terra mín. (" + rf + " Ω)";
  $("#iccOrigem").textContent = S.redeModo === "icc"
    ? "Valores informados em Dados da rede (corrente de curto direta), copiados para o estudo."
    : (zBase() ? "Calculadas a partir das impedâncias dos trechos em série" + (S.zUnit === "pu" ? " (em pu)" : ", convertidas de ohms para pu") + ", com bases de " + showNum(S.baseKV) + " kV e " + showNum(S.baseS) + " MVA (Ib = " + ptbr((Math.round(iBase() * 100) / 100).toString()) + " A) e impedância de contato de " + rf + " Ω na fase-terra mínima. Assimétricas: valores estimados (fator do primeiro meio ciclo, pelo X/R da sequência positiva); se a concessionária informar a assimétrica, use \"Corrente de curto direta\"." : "Informe a tensão de base e a potência de base nas premissas do estudo: elas são necessárias para converter as impedâncias para pu e calcular as correntes de curto.");
}
