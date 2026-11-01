/* recom.js — Demanda e geração (aba Dados da instalação) e ajustes recomendados do cliente (estudos CPFL).
   S.dem = { contratada kW, geracao kW, pger kW, par: "exp" | "zero" }.
   Demanda base = maior entre a contratada e a de geração (a de geração só vale se a finalidade inclui geração e há exportação).
   Corrente nominal da demanda = kW ÷ (√3 · kV de base), fator de potência 1.
   Os ajustes das funções do cliente usam multiplicadores sobre estas bases (ver MULTIPLICADORES abaixo). */
"use strict";

const DEM_BLANK = () => ({ contratada: null, geracao: null, pger: null, par: "exp" });
function demNormalize(j){
  j = j || {}; const o = DEM_BLANK();
  ["contratada", "geracao", "pger"].forEach(k => { if (j[k] > 0) o[k] = j[k]; });
  if (j.par === "zero") o.par = "zero";
  return o;
}
function demCalc(){
  const d = S.dem || DEM_BLANK(), ger = S.info.fin !== "consumo", V = S.baseKV > 0 ? S.baseKV : null;
  const c = d.contratada > 0 ? d.contratada : 0, g = ger && d.par !== "zero" && d.geracao > 0 ? d.geracao : 0;   // a de geração só vale com exportação
  // tensão de linha do lado de baixa tensão (secundário do transformador de maior potência)
  const n = Math.max(1, Math.min(TR_MAX, S.nTrafos || 1)), tr = S.trafos.slice(0, n).filter(t => t.v2 > 0).sort((a, b) => (b.kva || 0) - (a.kva || 0))[0];
  const V2 = tr ? tr.v2 : null;                                         // em volts
  const base = Math.max(c, g) || null;
  const iBT = kw => kw > 0 && V2 ? kw * 1000 / (Math.sqrt(3) * V2) : null;                          // corrente no lado de baixa tensão
  const ia = kw => kw > 0 && V ? (V2 ? iBT(kw) * V2 / (V * 1000) : kw / (Math.sqrt(3) * V)) : null;   // referida à tensão base (MT)
  return { ger, zero: ger && d.par === "zero", V, V2, base, ibt: iBT(base), ibase: ia(base), pger: ger && d.pger > 0 ? d.pger : null, ipg: ger ? ia(d.pger) : null, ipgBT: ger ? iBT(d.pger) : null };
}

/* ---------- multiplicadores (ordem de ajuste de proteção) ----------
   Cada ajuste de corrente/potência/tensão tem uma ou mais "bases" (potência dos transformadores, demanda, inrush, outra função,
   ajuste da concessionária...). O USUÁRIO ESCOLHE a base (lista) e DIGITA o multiplicador: valor final = base escolhida × multiplicador.
   Não há multiplicador padrão nem habilitação automática: nada é preenchido até o usuário digitar o multiplicador.
   S.mult["fn|set|campo|base"] = multiplicador digitado; S.mbase["fn|set|campo"] = base escolhida (padrão: a primeira da lista);
   S.mao["fn|set|campo"] = valor final digitado à mão (não é sobrescrito). */
const REC_DT = 0.3;                          // diferença mínima de tempo para a concessionária, s
const r2 = x => Math.round(x * 100) / 100;
const fmtN = x => x == null ? "—" : showNum(r2(x));
const posN = x => typeof x === "number" && isFinite(x) && x > 0 ? x : null;
const trafKva = () => { const n = Math.max(1, Math.min(TR_MAX, S.nTrafos || 1)); return S.trafos.slice(0, n).reduce((a, t) => a + (t.kva > 0 ? t.kva : 0), 0); };
function multDefs(){
  const D = demCalc(), C = S.concProt.funcs, F = S.cliente.funcs, cip = (id, set) => { const f = C[id]; return f && f.en && f[set] && f[set].ip > 0 ? f[set].ip : null; };
  const conc = (id, set, nome) => ({ id: "c" + id, lab: `${nome} da concessionária`, val: cip(id, set), un: "A" });
  const exp = D.zero ? "0,10" : (D.pger > 1000 ? "1,05" : "1,10");        // só dica no campo (placeholder), nunca é aplicada
  const it = typeof inrushTotal === "function" ? inrushTotal() : null;
  const kva = trafKva(), V = S.baseKV > 0 ? S.baseKV : null;
  const cli = (id, set, lab, bid) => ({ id: bid, lab, val: F[id] ? posN(F[id][set].ip) : null, un: "A" });
  const out = [
    { fn: "51", set: "s1", k: "ip", lab: "Ip₁", un: "A", bases: [
      { id: "trf", lab: "potência total dos transformadores", val: kva > 0 && V ? kva / (Math.sqrt(3) * V) : null, un: "A" },
      { id: "dem", lab: "demanda contratada", val: D.ibase, un: "A" },
      Object.assign(conc("51", "s1", "51"), { lab: "51 de fase da concessionária" })] },
    { fn: "50", set: "m", k: "ip", lab: "Instan", un: "A", bases: [{ id: "inr", lab: "inrush total", val: it ? it.I : null, un: "A" }, conc("50", "m", "50")] },
    { fn: "51N", set: "s1", k: "ip", lab: "Ip₁", un: "A", bases: [conc("51N", "s1", "51N"), cli("51", "s1", "51 de fase do cliente", "f51")] },
    { fn: "50N", set: "m", k: "ip", lab: "Instan", un: "A", bases: [cli("50", "m", "50 do cliente", "f50"), conc("50N", "m", "50N")] },
    { fn: "51G", set: "s1", k: "ip", lab: "Ip₁", un: "A", bases: [cli("51N", "s1", "51N do cliente", "f51n"), conc("51G", "s1", "51GS")] },
    { fn: "46", set: "m", k: "ip", lab: "Pickup", un: "A", bases: [{ id: "dem", lab: "demanda contratada", val: D.ibase, un: "A" }] }
  ];
  {                                                  // 67, 32 e 59N: sempre listadas; sem geração a base fica "sem valor"
    ["s1", "s2"].forEach(set => out.push({ fn: "67", set, k: "ip", lab: set === "s1" ? "Ip₁" : "Ip₂", un: "A", bases: [{ id: "ipg", lab: "corrente nominal de geração/exportação", val: D.ipg, un: "A", ph: exp }] }));
    out.push({ fn: "32", set: "m", k: "ip", lab: "Pickup", un: "kW", bases: [{ id: "pg", lab: "potência de geração", val: D.pger, un: "kW", ph: exp }] });
    out.push({ fn: "59N", set: "m", k: "ip", lab: "Pickup", un: "V", bases: [{ id: "vff", lab: "tensão fase-fase", val: S.baseKV > 0 ? S.baseKV * 1000 : null, un: "V", ph: "0,35" }] });
  }
  // 59 e 27 (funções de fase): o usuário escolhe se o multiplicador vale sobre a tensão de linha ou a de fase (a base é 100 % Vn; vref = tensão em volts)
  ["59", "27"].forEach(fn => ["s1", "s2"].forEach(set => out.push({ fn, set, k: "ip", lab: `Pickup${set === "s2" ? " (estágio 2)" : ""}`, un: "% Vn", bases: [
    { id: "vl", lab: "tensão de linha", val: 100, un: "%", vref: V ? V * 1000 : null },
    { id: "vf", lab: "tensão de fase", val: 100, un: "%", vref: V ? V * 1000 / Math.sqrt(3) : null }] })));
  out.push({ fn: "47", set: "m", k: "ip", lab: "Pickup", un: "% V2/V1", bases: [{ id: "vn", lab: "referência (100 %)", val: 100, un: "%" }] });
  [["o1", "81O · estágio 1"], ["o2", "81O · estágio 2"], ["u1", "81U · estágio 1"], ["u2", "81U · estágio 2"]].forEach(([set, lab]) => out.push({ fn: "81O/U", set, k: "ip", lab: lab.replace(" · estágio ", "-E"), un: "Hz", bases: [{ id: "f0", lab: "frequência nominal", val: 60, un: "Hz" }] }));
  return out;
}
const multKey = (d, b) => `${d.fn}|${d.set}|${d.k}|${b.id}`, campoKey = d => `${d.fn}|${d.set}|${d.k}`;
const multEf = (d, b) => { const m = (S.mult || {})[multKey(d, b)]; return m > 0 ? m : null; };
const selBase = d => d.bases.find(b => b.id === (S.mbase || {})[campoKey(d)]) || d.bases[0];      // base escolhida pelo usuário (padrão: a primeira)
// valor final de um campo: base escolhida × multiplicador digitado (null se faltar um dos dois)
function multFinal(d){ const b = selBase(d), m = multEf(d, b); return m > 0 && b.val != null ? r2(b.val * m) : null; }
const multOutTxt = (d, b) => { const m = multEf(d, b); if (!(m > 0) || b.val == null) return ""; const v = r2(b.val * m); return `= ${fmtN(v)} ${d.un}` + (b.vref ? ` (${fmtN(v / 100 * b.vref)} V)` : ""); };

/* Como cada base é obtida (fórmula com os números do projeto) */
function baseHowHTML(b){
  const D = demCalc(), f = x => x == null ? "—" : fmtN(x), I = (a, s) => `<i>${a}</i><sub>${s}</sub>`;
  if (b.id === "dem"){
    if (!D.base) return `Informe a demanda contratada (e a de geração, se houver) em Dados da instalação.`;
    if (!D.V2) return `${I("I", "nom")} = P ÷ (√3 · V) = ${f(D.base)} · 1000 ÷ (√3 · ${f(D.V * 1000)}) = <b>${f(D.ibase)} A</b> <em>(sem tensão secundária informada: calculada na tensão de base)</em>`;
    return `${I("I", "BT")} = P ÷ (√3 · ${I("V", "BT")}) = ${f(D.base)} · 1000 ÷ (√3 · ${f(D.V2)}) = ${f(D.ibt)} A<br>${I("I", "nom")} = ${I("I", "BT")} · ${I("V", "BT")} ÷ ${I("V", "base")} = ${f(D.ibt)} · ${f(D.V2)} ÷ ${f(D.V * 1000)} = <b>${f(D.ibase)} A</b><br><em>P = maior entre a demanda contratada e a de geração com exportação · fator de potência 1</em>`;
  }
  if (b.id === "inr"){
    const it = typeof inrushTotal === "function" ? inrushTotal() : null, m = it && INRUSH_METODOS.find(x => x.n === it.metodo);
    return it && m ? `<span class="form">${m.f}</span> = <b>${f(it.I)} A</b> <em>(${m.nome}, na tensão de base)</em>${it.icc && (it.metodo === 2 || it.metodo === 4) ? `<br><em>I<sub>cc</sub> = ${f(it.icc)} A — ${it.iccAssim ? "trifásica assimétrica" : "trifásica simétrica (a assimétrica não está disponível)"}</em>` : ""}` : `Defina o método de inrush (Dados da Concessionária) e os transformadores (Dados da instalação).`;
  }
  if (b.id === "ipg") return D.pger ? `${I("I", "ger")} = ${I("P", "ger")} ÷ (√3 · ${I("V", "BT")}) · ${I("V", "BT")} ÷ ${I("V", "base")} = <b>${f(D.ipg)} A</b>` : `Informe a potência de geração em Dados da instalação.`;
  if (b.id === "pg") return `Potência de geração informada em Dados da instalação: <b>${f(D.pger)} kW</b>`;
  if (b.id === "vff") return `${I("V", "ff")} = tensão de base = <b>${f(S.baseKV * 1000)} V</b>`;
  if (b.id === "vn") return `Referência = 100 % da tensão nominal`;
  if (b.id === "f0") return `Referência = frequência nominal <b>60 Hz</b>`;
  if (b.id === "trf"){ const kva = trafKva(); return kva > 0 && S.baseKV > 0 ? `${I("I", "nom")} = ΣkVA ÷ (√3 · ${I("V", "base")}) = ${f(kva)} ÷ (√3 · ${f(S.baseKV)} kV) = <b>${f(b.val)} A</b> <em>(potência total dos transformadores, na tensão de base)</em>` : `Informe a potência dos transformadores (Dados da instalação) e a tensão de base.`; }
  if (b.id === "vl" || b.id === "vf") return b.vref ? `${b.lab[0].toUpperCase() + b.lab.slice(1)} = <b>${f(b.vref)} V</b> = 100 % Vn${b.id === "vf" ? " <em>(tensão de linha ÷ √3)</em>" : ""}. O multiplicador é aplicado sobre 100 % e o resultado também aparece em volts.` : `Informe a tensão de base.`;
  if (b.id === "f51" || b.id === "f50" || b.id === "f51n") return `Valor já ajustado da função ${b.lab.split(" ")[0]} do cliente: <b>${f(b.val)} A</b>`;
  if (b.id[0] === "c") return `Ajuste da função ${b.lab.split(" ")[0]} da concessionária (aba Dados da Concessionária): <b>${f(b.val)} A</b>`;
  return "";
}
/* Bloco de cálculo de uma função: uma linha de fórmula por base (multiplicador editável × base = resultado) e o valor adotado */
function multHTML(fn){
  const defs = multDefs().filter(d => d.fn === fn); if (!defs.length) return "";
  const vistos = new Set(), como = [];
  const linhas = defs.map(d => {
    const mao = (S.mao || {})[campoKey(d)], sel = selBase(d);
    const key = multKey(d, sel), m = multEf(d, sel), fin = multFinal(d);
    if (!vistos.has(sel.id + "|" + d.set)){ vistos.add(sel.id + "|" + d.set); const h = baseHowHTML(sel); if (h) como.push(`<div class="cq-how"><b>${sel.lab}</b><span>${h}</span></div>`); }
    const lista = d.bases.length > 1 ? `<label class="cq-base"><span>Base de cálculo</span><select data-mbase="${campoKey(d)}" aria-label="Base de cálculo de ${d.lab}">${d.bases.map(b => `<option value="${b.id}" ${b === sel ? "selected" : ""}>${b.lab}</option>`).join("")}</select></label>` : "";
    const row = `<div class="cq-line"><span class="cq-l">${d.lab} =</span>
        <div class="box"><input type="text" inputmode="decimal" autocomplete="off" data-mult="${key}" placeholder="${sel.ph || "mult."}" value="${showNum(m)}" aria-label="Multiplicador de ${d.lab} sobre ${sel.lab}"><span class="u">×</span></div>
        <span class="cq-b">${sel.lab} <em>(${sel.val != null ? (sel.vref ? fmtN(sel.vref) + " V" : fmtN(sel.val) + " " + sel.un) : "sem valor"})</em></span>
        <output data-multout="${key}">${multOutTxt(d, sel)}</output></div>`;
    const adot = mao ? `<p class="cq-fin">${d.lab}: valor digitado à mão. <button type="button" class="btn sm" data-multusar="${campoKey(d)}">Usar multiplicador</button></p>`
      : fin != null ? `<p class="cq-fin" data-adot="${campoKey(d)}">${d.lab} adotado = <b>${fmtN(fin)} ${d.un}</b></p>` : "";
    return `<div class="cq"><p class="cq-t">${d.lab}</p>${lista}${row}${adot}</div>`;
  }).join("");
  return `<div class="multbox" data-multbox="${fn}"><p class="fnote">Escolha a base de cálculo e digite o multiplicador: valor = base × multiplicador.</p>${linhas}<div class="cq-hows">${como.join("")}</div></div>`;
}

/* Dial (ou tempo) máximo para manter 300 ms abaixo da curva temporizada da concessionária */
function dialMax(fn){
  const cs = S.concProt.funcs[fn], cl = S.cliente.funcs[fn];
  if (!cs || !cl || !cl.en || !cs.en) return null;
  const ec = stageElement(cs.s1, "c", "#000"), eu = stageElement(Object.assign({}, cl.s1, { dial: 1, on: true }), "u", "#000");
  if (!ec || !eu) return null;
  const inst = fn === "51" ? "50" : fn === "51N" ? "50N" : null, fi = inst && S.concProt.funcs[inst];
  const hi = fi && fi.en && fi.m.ip > 0 ? fi.m.ip * 0.9999 : 1e5, lo = Math.max(eu.th, ec.th) * 1.0001;
  if (!(hi > lo)) return null;
  let m = Infinity;
  logspace(lo, hi, 300).forEach(I => { const tc = ec.f(I), tu = eu.f(I); if (isFinite(tc) && isFinite(tu) && tu > 0) m = Math.min(m, (tc - REC_DT) / tu); });
  return isFinite(m) ? m : null;
}
function dialNotaHTML(fn){
  if (S.info.conc !== "cpfl" || !["51", "51N", "51G"].includes(fn)) return "";
  const m = dialMax(fn); if (m == null) return "";
  const cl = S.cliente.funcs[fn].s1, dt = cl.norm === "DT", nome = dt ? "Tempo" : "Dial", at = cl.dial > 0 ? cl.dial : null;
  if (m <= 0.0099) return `<p class="tcwarn" style="margin:8px 0 0"><b>Atenção:</b> a diferença de 300 ms para a curva do ${fnLabel(fn)} da concessionária não é atingida com esta partida. Se possível, reduza o Ip₁ ou revise a curva.</p>`;
  if (at != null && at > m + 1e-9) return `<p class="tcwarn" style="margin:8px 0 0"><b>Atenção:</b> o ${nome.toLowerCase()} atual (${showNum(at)}) passa do máximo que mantém 300 ms abaixo da curva do ${fnLabel(fn)} da concessionária (${showNum(Math.floor(m * 100) / 100)}).</p>`;
  return `<p class="fnote">Diferença de 300 ms para a concessionária: ${nome.toLowerCase()} máximo ${showNum(Math.floor(m * 100) / 100)}${at != null ? ` (atual ${showNum(at)})` : ""}.</p>`;
}
/* Cartão da área de cálculo (aba Ordem de ajuste): função habilitada + fórmulas + nota dos 300 ms */
function calcCardHTML(id){
  const def = FUNC_BY_ID[id], D = demCalc(), mh = multHTML(id), dn = dialNotaHTML(id);
  const sem = !mh && !dn ? `<p class="fnote">${["67", "32", "59N"].includes(id) && !D.ger ? "O cálculo desta função só existe quando a finalidade do estudo inclui geração (Página inicial)." : "Sem cálculo de multiplicador para esta função: preencha os ajustes diretamente ao lado."}</p>` : "";
  const dg = id === "67" && typeof dirDiagramaHTML === "function" ? dirDiagramaHTML() : "";
  return `<section class="calc-card" data-calcfn="${id}"><h3 class="calc-h">Função ${esc(fnLabel(id))} <span>${esc(def.name)}</span></h3>${mh}${dn}${sem}${dg}</section>`;
}
/* Redesenha a área de cálculo. Com o cursor dentro de um cartão, ele não é refeito (só os resultados dele são atualizados). */
function renderCalc(force){
  const host = $("#calc"); if (!host || !S) return;
  const ids = FUNCS.filter(d => S.cliente.funcs[d.id].en).map(d => d.id), act = document.activeElement;
  const has = [...host.querySelectorAll("[data-calcfn]")].map(c => c.dataset.calcfn);
  if (!force && has.join() === ids.join() && host.contains(act)){
    host.querySelectorAll("[data-calcfn]").forEach(c => {
      if (!c.contains(act)){ c.outerHTML = calcCardHTML(c.dataset.calcfn); return; }
      multDefs().filter(d => d.fn === c.dataset.calcfn).forEach(d => { const b = selBase(d), o = c.querySelector(`[data-multout="${multKey(d, b)}"]`); if (o) o.textContent = multOutTxt(d, b); });
      multDefs().filter(d => d.fn === c.dataset.calcfn).forEach(d => { const p = c.querySelector(`[data-adot="${campoKey(d)}"] b`), v = multFinal(d); if (p && v != null) p.textContent = `${fmtN(v)} ${d.un}`; });
    });
    return;
  }
  host.innerHTML = ids.length ? ids.map(calcCardHTML).join("") : `<p class="note" style="text-align:center">Habilite uma função ao lado para ver aqui o cálculo do ajuste.</p>`;
  host.querySelectorAll("[data-calcfn]").forEach(c => { if (!has.includes(c.dataset.calcfn)) c.classList.add("novo"); });
}

/* Aplica os multiplicadores (na ordem, pois 51N e 50N dependem do 51 e do 50). Devolve true se algum valor mudou. */
function multAplica(){
  if (!S.mao) S.mao = {}; if (!S.mbase) S.mbase = {};
  let ch = false; const F = S.cliente.funcs;
  for (let passo = 0; passo < 3; passo++){                   // 51N e 50N dependem do 51 e do 50: repete até estabilizar
    let mudou = false;
    multDefs().forEach(d => {
      if (S.mao[campoKey(d)]) return;
      const fn = F[d.fn]; if (!fn.en) return;                // nunca liga função sozinho
      const v = multFinal(d); if (v == null) return;
      const tgt = fn[d.set];
      if (tgt[d.k] !== v){ tgt[d.k] = v; mudou = true; }
    });
    if (!mudou) break; ch = true;
  }
  return ch;
}
/* Atualiza a tela depois de aplicar: área de cálculo e campos finais (menos o que está sendo digitado) */
function multTela(){
  const act = document.activeElement;
  renderCalc();
  multDefs().forEach(d => { const inp = document.getElementById(`f-c-${safeId(d.fn)}-${d.set}-${d.k}`); if (inp && inp !== act) inp.value = showNum(S.cliente.funcs[d.fn][d.set][d.k]); });
}
/* Chamada quando mudam as bases (concessionária, demanda, geração, tensão, transformadores) */
function syncRecom(refresh = true){
  if (!S || !S.concProt || !S.cliente) return false;
  const ch = multAplica();
  if (refresh){
    const a = document.activeElement;
    if ($("#prot") && !(a && a.dataset && a.dataset.mult)) renderPanel(CTX_CLIENTE); else multTela();
    if (ch){ render(); if (typeof updateTC === "function") updateTC(); touch(); }
  }
  return ch;
}
/* Valor final digitado à mão: não é mais sobrescrito até clicar em "Usar multiplicadores" ou apagar o campo */
function multMao(fn, set, k, tem){
  if (!S.mao) S.mao = {}; const key = `${fn}|${set}|${k}`;
  if (tem && multDefs().some(d => campoKey(d) === key)) S.mao[key] = true; else delete S.mao[key];
  const box = document.querySelector(`[data-multbox="${fn}"]`); if (box && !box.contains(document.activeElement)) box.outerHTML = multHTML(fn);
}
(function(){
  const host = $("#calc"); if (!host) return;
  host.addEventListener("input", e => {
    const el = e.target, key = el.dataset && el.dataset.mult; if (!key) return;
    const v = parseNum(el.value); if (v === undefined) return;
    if (!S.mult) S.mult = {}; if (!S.mao) S.mao = {};
    if (v > 0) S.mult[key] = v; else delete S.mult[key];
    delete S.mao[key.split("|").slice(0, 3).join("|")];
    multAplica(); multTela(); render(); if (typeof updateTC === "function") updateTC(); touch();
  });
  host.addEventListener("change", e => {
    const el = e.target, k = el.dataset && el.dataset.mbase; if (!k) return;
    if (!S.mbase) S.mbase = {}; S.mbase[k] = el.value;
    multAplica(); renderCalc(true); render(); if (typeof updateTC === "function") updateTC(); touch();
    const novo = host.querySelector(`[data-mbase="${k}"]`); if (novo) novo.focus();
  });
  host.addEventListener("focusout", e => { const el = e.target; if (el.dataset && el.dataset.mult){ const d = multDefs().find(x => el.dataset.mult.startsWith(campoKey(x) + "|")), b = d && d.bases.find(x => multKey(d, x) === el.dataset.mult); if (b){ const m = multEf(d, b); el.value = showNum(m > 0 ? m : null); } } });
  host.addEventListener("click", e => {
    const b = e.target.closest("[data-multusar]"); if (!b) return;
    delete S.mao[b.dataset.multusar]; syncRecom(); multAplica(); render(); touch();
  });
})();

/* ---------- campos da aba Dados da instalação ---------- */
function renderDem(){
  const host = $("#instDem"); if (!host) return;
  const d = S.dem, ger = S.info.fin !== "consumo", dim = ger ? "" : "dim", dis = ger ? "" : "disabled";
  const num = (k, rot, un, off) => `<label class="fld"><span>${rot}</span><div class="box ${off ? "dim" : ""}"><input data-dem="${k}" type="text" inputmode="decimal" autocomplete="off" value="${showNum(d[k])}" ${off ? "disabled" : ""}><span class="u">${un}</span></div></label>`;
  host.innerHTML = `<div class="demgrid">
      ${num("contratada", "Demanda contratada", "kW", false)}
      ${num("geracao", "Demanda de geração", "kW", !ger)}
      ${num("pger", "Potência de geração", "kW", !ger)}
      <label class="fld"><span>Tipo de paralelismo da geração</span><div class="box ${dim}"><select data-dem="par" ${dis}><option value="exp" ${d.par === "exp" ? "selected" : ""}>Com exportação</option><option value="zero" ${d.par === "zero" ? "selected" : ""}>Sem exportação (grid zero)</option></select></div></label>
    </div>
    <div class="demres" id="demRes"></div>
    <p class="note">${ger ? "A demanda base é a maior entre a contratada e a de geração (esta só vale com exportação)." : "A finalidade do projeto é só consumo (Página inicial): os campos de geração ficam desativados e a demanda base é a contratada."} A corrente é calculada na tensão de linha do lado de baixa tensão do transformador (kW ÷ √3 ÷ V<sub>BT</sub>, fator de potência 1) e referida à tensão base para os ajustes em MT.</p>`;
  updateDemRes();
}
function updateDemRes(){
  const el = $("#demRes"); if (!el) return;
  const D = demCalc(), f = x => x == null ? "—" : showNum(Math.round(x * 100) / 100);
  el.innerHTML = `<span><b>Demanda base</b> ${f(D.base)} kW</span>${D.V2 ? `<span><b>Corrente da demanda em BT (${f(D.V2)} V)</b> ${f(D.ibt)} A</span>` : `<span><b>Tensão secundária</b> não informada (preencha na tabela de transformadores)</span>`}<span><b>Corrente nominal da demanda em MT (${f(D.V)} kV)</b> ${f(D.ibase)} A</span>${D.ger ? `<span><b>Corrente nominal de geração em MT</b> ${f(D.ipg)} A</span>` : ""}`;
}
(function(){
  const host = $("#instDem"); if (!host) return;
  host.addEventListener("input", e => {
    const el = e.target, k = el.dataset.dem; if (!k || el.tagName === "SELECT") return;
    const v = parseNum(el.value); if (v === undefined) return;
    S.dem[k] = v; updateDemRes(); syncRecom(); touch();
  });
  host.addEventListener("change", e => {
    const el = e.target; if (el.dataset.dem !== "par") return;
    S.dem.par = el.value === "zero" ? "zero" : "exp"; syncRecom(); touch();
  });
  host.addEventListener("focusout", e => { const el = e.target; if (el.tagName === "INPUT" && el.dataset.dem) el.value = showNum(S.dem[el.dataset.dem]); });
  const t = $("#instTrafos"); if (t) ["input", "change"].forEach(ev => t.addEventListener(ev, () => { updateDemRes(); syncRecom(); }));
})();
