/* instalacao.js — aba "Dados da instalação": transformadores (S.nTrafos, S.trafos).
   Para incluir ou mudar colunas, edite TR_COLS: k = chave salva, lab = rótulo, tipo = num | txt | sel | calc.
   As colunas "calc" são calculadas automaticamente (não são salvas). */
"use strict";

const TR_MAX = 30;
const TR_LIG = ["Dyn1", "Dyn11", "Yyn0", "Ynyn0", "Yd1", "Yd11", "Dd0"];
const TR_REFRIG = [["oleo", "Óleo"], ["seco", "Seco"]];
const TR_B_PADRAO = { oleo: 10, seco: 14 };      // fator k padrão (óleo 10, seco 14); usado quando o campo fica vazio
/* Z% típico, usado só quando o campo fica em branco (sem dado do fabricante).
   ≤ 300 kVA: tabelas de transformadores de distribuição (NBR 5440, ex.: CELESC E-313.0019, classe 15 kV: ≤150 kVA = 3,5%, 225–300 = 4,5%; classes 24,2 e 36,2 kV: 4,0% e 5,0%).
   > 300 kVA: estimativa a partir de especificações de concessionárias/fabricantes (EDP 500 kVA = 5%; Celg NTC-58 750 kVA = 6%, 2000 kVA = 6,5%; E-Redes >630 kVA = 6%). */
function zTipico(kva, kv){
  if (!(kva > 0)) return null;
  if (kva <= 300){
    const alta = kv > 15.5;
    return kva <= 150 ? (alta ? 4 : 3.5) : (alta ? 5 : 4.5);
  }
  return kva <= 630 ? 5 : kva <= 2000 ? 6 : 6.5;
}
const TR_B_FAIXA = { oleo: "8 a 10", seco: "10 a 14" };

const TR_COLS = [
  { k: "nome", lab: "Identificação", tipo: "txt", ph: "TR-1", w: 110 },
  { k: "kva",  lab: "Potência", unit: "kVA", tipo: "num", w: 100 },
  { k: "v1",   lab: "Tensão primária", unit: "kV", tipo: "num", w: 110 },
  { k: "v2",   lab: "Tensão secundária", unit: "V", tipo: "num", w: 110 },
  { k: "lig",  lab: "Ligação", tipo: "sel", op: TR_LIG.map(x => [x, x]), w: 100 },
  { k: "ref",  lab: "Refrigeração", tipo: "sel", op: TR_REFRIG, w: 100 },
  { k: "z",    lab: "Impedância (Z%)", unit: "%", tipo: "num", w: 110, dica: "Valor da placa/fabricante. Em branco: usa o Z% típico pela potência e classe de tensão (valor exibido em cinza)." },
  { k: "b",    lab: "Fator k (inrush)", unit: "×In", tipo: "num", w: 120, dica: "Corrente de magnetização = k × In nominal. Em branco: usa o valor típico (óleo 10; seco 14)." },
  { k: "in1",  lab: "In primária", unit: "A", tipo: "calc", w: 110 },
  { k: "in2",  lab: "In secundária", unit: "A", tipo: "calc", w: 110 },
  { k: "imag", lab: "I magnetização (inrush)", unit: "A", tipo: "calc", w: 120, dica: "B × In primária" },
  { k: "ian1", lab: "I ANSI primário", unit: "A", tipo: "calc", w: 120, dica: "I ANSI = (In ÷ Z%) × 100 (ponto de 2 s da curva ANSI)" },
  { k: "nan1", lab: "I NANSI primário", unit: "A", tipo: "calc", w: 120, dica: "I NANSI = 0,58 × I ANSI (curva ANSI de neutro)" },
];

// tensão primária começa na tensão de base do estudo
const trafoBlank = () => ({ nome: "", kva: null, v1: typeof S === "object" && S && S.baseKV > 0 ? S.baseKV : null,  v2: null, lig: "Dyn1", ref: "oleo", z: null, b: null });
const trafoNorm = t => {
  const o = trafoBlank();
  o.nome = typeof (t && t.nome) === "string" ? t.nome : "";
  ["kva", "v1", "v2", "z", "b"].forEach(k => { o[k] = typeof (t && t[k]) === "number" && isFinite(t[k]) && t[k] >= 0 ? t[k] : (k === "v1" ? null : null); });
  o.lig = TR_LIG.includes(t && t.lig) ? t.lig : "Dyn1";
  o.ref = t && t.ref === "seco" ? "seco" : "oleo";
  return o;
};
const trafosNormalize = (lista, n) => {
  const arr = Array.isArray(lista) ? lista.slice(0, TR_MAX).map(trafoNorm) : [];
  const q = Number.isInteger(n) ? clamp(n, 1, TR_MAX) : Math.max(1, arr.length);
  while (arr.length < q) arr.push(trafoBlank());
  return arr;
};

/* ---------- cálculos de cada transformador ---------- */
function trafoCalc(t){
  const r = { in1: null, in2: null, imag: null, zUsado: null, zTip: false, cat: null, ian1: null, ian2: null, nan1: null, nan2: null }, s3 = Math.sqrt(3);
  if (t.kva > 0 && t.v1 > 0) r.in1 = t.kva / (s3 * t.v1);
  if (t.kva > 0 && t.v2 > 0) r.in2 = t.kva / (s3 * t.v2 / 1000);
  const b = t.b > 0 ? t.b : TR_B_PADRAO[t.ref];
  if (r.in1 != null) r.imag = b * r.in1;
  if (t.kva > 0) r.cat = t.kva <= 500 ? "I" : t.kva <= 5000 ? "II" : t.kva <= 30000 ? "III" : "IV";
  const z = t.z > 0 ? t.z : zTipico(t.kva, t.v1);
  r.zUsado = z; r.zTip = !(t.z > 0) && z != null;
  if (r.in1 != null && z > 0) r.ian1 = r.in1 / (z / 100);
  if (r.in2 != null && z > 0) r.ian2 = r.in2 / (z / 100);
  if (r.ian1 != null) r.nan1 = 0.58 * r.ian1;
  if (r.ian2 != null) r.nan2 = 0.58 * r.ian2;
  return r;
}
/* Corrente de inrush total da instalação (método escolhido na aba Dados da Concessionária), referida à tensão base do gráfico.
   Corrente de cada trafo: primária (kVA/(√3·kV)), convertida pela relação v1/baseKV. "Maior" = trafo de maior kVA.
   I_ccMáx = corrente trifásica do estudo (aba Dados da Concessionária). */
function inrushTotal(){
  const m = typeof inrushEfetivo === "function" ? inrushEfetivo() : 0;
  if (!m) return null;
  const n = Math.max(1, Math.min(TR_MAX, S.nTrafos || 1)), L = [];
  S.trafos.slice(0, n).forEach(t => {
    const r = trafoCalc(t); if (r.in1 == null) return;
    const f = t.v1 > 0 && S.baseKV > 0 ? t.v1 / S.baseKV : 1;
    L.push({ kva: t.kva, in: r.in1 * f, mag: r.imag * f });
  });
  if (!L.length) return null;
  let k = 0; L.forEach((x, i) => { if (x.kva > L[k].kva) k = i; });
  const outros = L.filter((x, i) => i !== k), somaIn = outros.reduce((a, x) => a + x.in, 0), somaMag = L.reduce((a, x) => a + x.mag, 0);
  const icc = (typeof iccEstudo === "function" ? iccEstudo() : {}).i3, temIcc = typeof icc === "number" && isFinite(icc) && icc > 0;
  const par = (a, b) => 1 / (1 / a + 1 / b);
  const m1 = L[k].mag + somaIn;
  let v;
  if (m === 1) v = m1;
  else if (m === 2) v = temIcc ? par(m1, icc) : null;
  else if (m === 3) v = somaMag;
  else if (m === 4) v = temIcc ? par(somaMag, icc) : null;
  else v = 8 * L[k].in + 4 * somaIn;
  return v != null && isFinite(v) && v > 0 ? { I: v, metodo: m } : null;
}
/* Pontos ANSI de cada transformador (ponto de 2 s da curva de dano), na tensão base do gráfico.
   tipo "ansi" (visão Fase): I ANSI primário; "nansi" (visão Neutro): I NANSI primário. */
function trafoPontosANSI(tipo){
  const n = Math.max(1, Math.min(TR_MAX, S.nTrafos || 1)), out = [];
  S.trafos.slice(0, n).forEach((t, i) => {
    const r = trafoCalc(t), v = tipo === "nansi" ? r.nan1 : r.ian1;
    if (v == null || !(v > 0)) return;
    const f = t.v1 > 0 && S.baseKV > 0 ? t.v1 / S.baseKV : 1;
    out.push({ I: v * f, id: (t.nome || "").trim() || "T" + (i + 1) });
  });
  return out;
}
const fmtA = n => n == null || !isFinite(n) ? "—" : ptbr((Math.round(n * 100) / 100).toString());

/* ---------- desenho ---------- */
function celulaHTML(c, t, i){
  const id = `tr-${i}-${c.k}`;
  if (c.tipo === "calc") return `<td><div class="box dim"><output id="${id}" data-calc="${c.k}" data-i="${i}"${c.dica ? ` title="${esc(c.dica)}"` : ""}>—</output><span class="u">${c.unit}</span></div></td>`;
  if (c.tipo === "sel") return `<td><div class="box"><select id="${id}" data-i="${i}" data-k="${c.k}" aria-label="${c.lab} do transformador ${i + 1}">${c.op.map(([v, l]) => `<option value="${v}"${t[c.k] === v ? " selected" : ""}>${l}</option>`).join("")}</select></div></td>`;
  if (c.tipo === "txt") return `<td><div class="box"><input id="${id}" data-i="${i}" data-k="${c.k}" type="text" autocomplete="off" placeholder="${esc(c.ph || "")} " value="${esc(t[c.k] || "")}" aria-label="${c.lab} do transformador ${i + 1}"></div></td>`;
  return `<td><div class="box"><input id="${id}" data-i="${i}" data-k="${c.k}" type="text" inputmode="decimal" autocomplete="off"${c.k === "b" ? ` placeholder="${TR_B_PADRAO[t.ref]}"` : c.k === "z" ? ` placeholder="${showNum(zTipico(t.kva, t.v1)) || ""}"` : ""} value="${showNum(t[c.k])}" aria-label="${c.lab} do transformador ${i + 1}"${c.dica ? ` title="${esc(c.dica)}"` : ""}>${c.unit ? `<span class="u">${c.unit}</span>` : ""}</div></td>`;
}
function renderInst(){
  const host = $("#instTrafos"); if (!host) return;
  const n = S.nTrafos, tabela = `<div class="trtab-wrap"><table class="trtab">
    <colgroup><col style="width:44px">${TR_COLS.map(c => `<col style="width:${c.w}px">`).join("")}</colgroup>
    <thead><tr><th scope="col">Nº</th>${TR_COLS.map(c => `<th scope="col"${c.tipo === "calc" ? ' class="calc"' : ""}${c.dica ? ` title="${esc(c.dica)}"` : ""}>${c.lab}</th>`).join("")}</tr></thead>
    <tbody>${S.trafos.slice(0, n).map((t, i) => `<tr data-row="${i}"><th scope="row" class="trn">${i + 1}</th>${TR_COLS.map(c => celulaHTML(c, t, i)).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><th scope="row" colspan="2" class="trtot">Total instalado</th><td colspan="1"><div class="box dim"><output id="trTotKva">—</output><span class="u">kVA</span></div></td><td colspan="${TR_COLS.length - 2}"></td></tr></tfoot>
  </table></div>`;
  host.innerHTML = tabela;
  for (let i = 0; i < n; i++) updateTrafoCalc(i);
  updateTrafoTotal();
  $("#nTrafos").value = String(n);
  if (typeof renderDem === "function") renderDem();
  if (typeof renderTC === "function") renderTC();
}
function updateTrafoCalc(i){
  const t = S.trafos[i], r = trafoCalc(t);
  ["in1", "in2", "imag", "ian1", "nan1"].forEach(k => { const el = $(`#tr-${i}-${k}`); if (el) el.textContent = fmtA(r[k]); });
  const zi = $(`#tr-${i}-z`); if (zi) zi.placeholder = r.zTip ? showNum(r.zUsado) : "";
  const b = $(`#tr-${i}-b`); if (b) b.placeholder = String(TR_B_PADRAO[t.ref]);
  const bt = $(`#tr-${i}-b`); if (bt) bt.title = `Faixa típica (${t.ref === "seco" ? "seco" : "óleo"}): ${TR_B_FAIXA[t.ref]}. Em branco: usa ${TR_B_PADRAO[t.ref]}.`;
}
function updateTrafoTotal(){
  const tot = S.trafos.slice(0, S.nTrafos).reduce((a, t) => a + (t.kva > 0 ? t.kva : 0), 0), el = $("#trTotKva");
  if (el) el.textContent = tot > 0 ? fmtA(tot) : "—";
}
function setNTrafos(n){
  n = clamp(Math.round(n) || 1, 1, TR_MAX);
  while (S.trafos.length < n) S.trafos.push(trafoBlank());
  S.nTrafos = n; renderInst(); touch();
}

/* ---------- eventos ---------- */
(function(){
  const nIn = $("#nTrafos"); if (!nIn) return;
  nIn.addEventListener("change", () => setNTrafos(parseInt(nIn.value, 10)));
  nIn.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); nIn.blur(); } });
  $("#nTrafosMais").addEventListener("click", () => setNTrafos(S.nTrafos + 1));
  $("#nTrafosMenos").addEventListener("click", () => setNTrafos(S.nTrafos - 1));
  const host = $("#instTrafos");
  host.addEventListener("input", e => {
    const el = e.target, i = +el.dataset.i, k = el.dataset.k; if (!k || el.tagName === "SELECT") return;
    if (k === "nome"){ S.trafos[i].nome = el.value; touch(); return; }
    const v = parseNum(el.value); if (v === undefined) return;
    S.trafos[i][k] = v; updateTrafoCalc(i); updateTrafoTotal(); touch();
  });
  host.addEventListener("change", e => {
    const el = e.target; if (el.tagName !== "SELECT") return;
    const i = +el.dataset.i; S.trafos[i][el.dataset.k] = el.value; updateTrafoCalc(i); touch();
  });
  host.addEventListener("focusout", e => {
    const el = e.target; if (el.tagName !== "INPUT" || !el.dataset.k || el.dataset.k === "nome") return;
    el.value = showNum(S.trafos[+el.dataset.i][el.dataset.k]);
  });
})();
