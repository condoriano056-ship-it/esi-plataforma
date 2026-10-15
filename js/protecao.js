/* protecao.js — painéis de proteção: menu de funções (botões) e um quadro de preenchimento por função habilitada.
   O mesmo painel serve ao cliente (aba Coordenograma, S.cliente) e à concessionária (aba Dados da Concessionária, S.conc).
   Lê e grava em <dados>.funcs[id][set][campo]. As funções e campos vêm de funcoes.js. */
"use strict";

/* Números no padrão brasileiro: aceita "19,72" ou "19.72"; campo vazio = null; undefined = ainda inválido (ex.: "1,") */
function parseNum(s){
  s = String(s).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const v = parseFloat(s);
  return isFinite(v) && v >= 0 ? v : undefined;
}
const showNum = v => v == null ? "" : ptbr(String(v));
const safeId = s => String(s).replace(/\W/g, "_");

/* Cada painel é descrito por um contexto: onde ficam os dados, em qual elemento é desenhado e quais funções mostra */
const CTX_CLIENTE = { key: "c", root: "#prot", data: () => S.cliente, ids: null, onChange: () => { if (typeof multAplica === "function"){ multAplica(); multTela(); } render(); if (typeof updateTC === "function") updateTC(); } };
const CTX_CONC = { key: "k", root: "#cprot", data: () => S.concProt, ids: ["51", "50", "51N", "50N", "51G"], onChange: () => syncRecom() };

const ctxFuncs = ctx => ctx.ids ? FUNCS.filter(d => ctx.ids.includes(d.id)) : FUNCS;
const ctxOf = el => el.closest("#cprot") ? CTX_CONC : CTX_CLIENTE;

/* ---------- desenho ---------- */
function fieldHTML(ctx, def, set, data, f, off){
  const base = `${ctx.key}-${safeId(def.id)}-${set.key}`;
  const at = k => `id="f-${base}-${k}" data-fn="${def.id}" data-set="${set.key}" data-k="${k}"`;
  const dis = off ? "disabled" : "";
  const dim = off ? "dim" : "";
  if (f.t === "curve"){
    const dt = data.norm === "DT", tipos = TIPOS[data.norm] || [];
    return `<label for="f-${base}-norm">${f.lab}</label>
      <div class="cellrow">
        <div class="box ${dim}"><select ${at("norm")} ${dis} aria-label="Norma da curva">${NORMS.map(([k, t]) => `<option value="${k}" ${data.norm === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="box ${off || dt ? "dim" : ""}"><select ${at("tipo")} ${off || dt ? "disabled" : ""} aria-label="Tipo da curva">${tipos.length ? tipos.map(([k, t]) => `<option value="${k}" ${data.tipo === k ? "selected" : ""}>${t}</option>`).join("") : "<option>—</option>"}</select></div>
      </div>`;
  }
  if (f.t === "sel")
    return `<label for="f-${base}-${f.k}">${f.lab}</label>
      <div class="box ${dim}"><select ${at(f.k)} ${dis}>${f.opts.map(([k, t]) => `<option value="${k}" ${data[f.k] === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
  // num (o campo "dial" vira "Tempo (s)" quando a curva é de tempo definido)
  const dt = f.dial && data.norm === "DT";
  const lab = dt ? "Tempo" : f.lab, unit = dt ? "s" : f.unit;
  return `<label for="f-${base}-${f.k}">${lab}</label>
    <div class="box ${dim}"><input ${at(f.k)} type="text" inputmode="decimal" autocomplete="off" value="${showNum(data[f.k])}" ${dis}>${unit ? `<span class="u">${unit}</span>` : ""}</div>`;
}
function setHTML(ctx, def, set){
  const data = ctx.data().funcs[def.id][set.key];
  const rows = `<div class="xl">${set.fields.map(f => fieldHTML(ctx, def, set, data, f, false)).join("")}</div>`;
  if (!set.toggle)                                       // bloco sempre visível
    return `<div>${set.title ? `<div class="stage-top"><p class="stage-h">${set.title}</p></div>` : ""}${rows}</div>`;
  const key = def.id + "|" + set.key, on = !!data.on;    // bloco com botão "Habilitar": os campos abrem com animação
  return `<div class="sset" data-sset="${key}">
    <div class="stage-top"><p class="stage-h">${set.title || ""}</p>
      <button class="fbtn sm" type="button" data-toggle="${key}" aria-pressed="${on}" aria-label="Habilitar ${set.title || def.id}">Habilitar</button></div>
    <div class="swrap ${on ? "open" : ""}"><div class="sinner">${rows}</div></div>
  </div>`;
}
function funcHTML(ctx, def){
  const note = def.curve === "inst" ? `<p class="fnote">Dial 0 = atuação instantânea (desenhada em ${ptbr(T50_MIN)} s para aparecer no gráfico).</p>`
    : !def.curve ? `<p class="fnote">Dados guardados no projeto. Esta função ainda não é desenhada no gráfico.</p>`
    : def.curve === "oc" ? `<p class="fnote">Ip em ampères na tensão base. O estágio 2 só é desenhado depois de habilitado.</p>`
    : def.curve === "dir" ? `<p class="fnote">Desenhada no coordenograma de fase, tracejada e fora da curva resultante. Cada estágio só é desenhado com Ip e dial (ou tempo) preenchidos; em tempo definido, tempo vazio ou 0 desenha atuação instantânea. A direção e o ângulo ficam registrados, mas não alteram a curva.</p>` : "";
    return `<section class="func" aria-label="Função ${fnLabel(def.id)}">
    <h3 class="func-h">Função ${fnLabel(def.id)}: ${def.name}</h3>
    <div class="stages ${def.sets.length === 1 ? "one" : ""}">${def.sets.map(s => setHTML(ctx, def, s)).join("")}</div>${note}
  </section>`;
}
function cardHTML(ctx, def, open){
  return `<div class="fwrap ${open ? "open" : ""}" data-card="${def.id}"><div class="finner">${funcHTML(ctx, def)}</div></div>`;
}
const emptyNote = ctx => `<p class="note fempty" style="text-align:center" hidden>Nenhuma função habilitada. Escolha uma em "Funções de proteção".</p>`;
function renderPanel(ctx){
  const F = ctx.data().funcs, list = ctxFuncs(ctx), on = list.filter(d => F[d.id].en), root = $(ctx.root);
  root.innerHTML = `
    <section class="grp" aria-label="Funções de proteção">
      <h3 class="grp-h">Funções de proteção</h3>
      <div class="func">
        <p class="note" style="margin:0 0 10px">Clique para habilitar ou desabilitar cada função.</p>
        <div class="fgrid">${list.map(d => `<button type="button" class="fbtn" data-fn-btn="${d.id}" aria-pressed="${F[d.id].en}" title="Função ${fnLabel(d.id)}: ${d.name}">${fnLabel(d.id)}</button>`).join("")}</div>
      </div>
    </section>

    <section class="grp" aria-label="Ordem de ajuste da proteção">
      <h3 class="grp-h">Ordem de ajuste da proteção</h3>
      ${emptyNote(ctx)}
      <div class="fcards">${on.map(d => cardHTML(ctx, d, true)).join("")}</div>
    </section>`;
  root.querySelector(".fempty").hidden = on.length > 0;
}
const renderProtecao = () => { renderPanel(CTX_CLIENTE); renderPanel(CTX_CONC); };
// atualiza só o quadro de uma função (mantém o resto da tela e a animação intactos)
function refreshCard(ctx, id){
  const w = $(ctx.root).querySelector(`.fcards [data-card="${id}"]:not(.closing)`);
  if (w) w.querySelector(".finner").innerHTML = funcHTML(ctx, FUNC_BY_ID[id]);
}
// habilita / desabilita uma função com animação
function setEnabled(ctx, id, on){
  const def = FUNC_BY_ID[id], root = $(ctx.root), box = root.querySelector(".fcards"), list = ctxFuncs(ctx);
  ctx.data().funcs[id].en = on;
  const btn = root.querySelector(`[data-fn-btn="${id}"]`); if (btn) btn.setAttribute("aria-pressed", String(on));
  if (on){
    box.querySelectorAll(`[data-card="${id}"]`).forEach(c => c.remove());        // descarta um quadro que ainda estava fechando
    const w = document.createElement("div"); w.className = "fwrap"; w.dataset.card = id;
    w.innerHTML = `<div class="finner">${funcHTML(ctx, def)}</div>`;
    let ref = null;                                                               // mantém a ordem do menu
    for (let i = list.indexOf(def) + 1; i < list.length && !ref; i++) ref = box.querySelector(`[data-card="${list[i].id}"]:not(.closing)`);
    box.insertBefore(w, ref);
    w.getBoundingClientRect();                                                    // força o estado inicial antes de animar
    requestAnimationFrame(() => w.classList.add("open"));
  } else {
    const w = box.querySelector(`[data-card="${id}"]:not(.closing)`);
    if (w){
      w.classList.add("closing"); w.classList.remove("open");
      const rm = () => w.remove();
      w.addEventListener("transitionend", e => { if (e.target === w && e.propertyName === "grid-template-rows") rm(); });
      setTimeout(rm, 500);                                                        // reserva (ex.: movimento reduzido sem transição)
    }
  }
  root.querySelector(".fempty").hidden = list.some(d => ctx.data().funcs[d.id].en);
}

/* ---------- eventos (delegados em cada painel) ---------- */
const getSet = (ctx, el) => ctx.data().funcs[el.dataset.fn][el.dataset.set];

[CTX_CLIENTE, CTX_CONC].forEach(ctx => {
  const root = $(ctx.root);
  root.addEventListener("input", e => {
    const el = e.target;
    if (el.tagName !== "INPUT" || !el.dataset.fn) return;
    const v = parseNum(el.value); if (v === undefined) return;
    getSet(ctx, el)[el.dataset.k] = v;
    if (ctx === CTX_CLIENTE) multMao(el.dataset.fn, el.dataset.set, el.dataset.k, v !== null);   // valor digitado à mão: não é sobrescrito pelos multiplicadores
    ctx.onChange(); touch();
  });
  root.addEventListener("focusout", e => {          // ao sair do campo, mostra o número formatado (vírgula)
    const el = e.target; if (el.tagName !== "INPUT" || !el.dataset.fn) return;
    if (ctx === CTX_CLIENTE && typeof syncRecom === "function"){ if (syncRecom(false)) render(); multTela(); }
    el.value = showNum(getSet(ctx, el)[el.dataset.k]);
  });
  root.addEventListener("change", e => {
    const el = e.target; if (el.tagName !== "SELECT" || !el.dataset.fn) return;
    const d = getSet(ctx, el), k = el.dataset.k;
    d[k] = el.value;
    if (k === "norm"){
      const l = TIPOS[d.norm] || [];
      if (l.length && !l.some(([t]) => t === d.tipo)) d.tipo = l[0][0];    // o tipo precisa existir na norma escolhida
    }
    refreshCard(ctx, el.dataset.fn);
    const again = document.getElementById(el.id); if (again) again.focus();
    ctx.onChange(); touch();
  });
  root.addEventListener("click", e => {
    const m = e.target.closest("[data-fn-btn]");
    if (m){ setEnabled(ctx, m.dataset.fnBtn, !ctx.data().funcs[m.dataset.fnBtn].en); ctx.onChange(); touch(); return; }
    const b = e.target.closest("[data-toggle]"); if (!b) return;
    const [id, key] = b.dataset.toggle.split("|"), t = ctx.data().funcs[id][key];
    t.on = !t.on;
    b.setAttribute("aria-pressed", String(t.on));
    const box = root.querySelector(`[data-sset="${b.dataset.toggle}"] .swrap`);   // só alterna a classe: o CSS faz a animação
    if (box) box.classList.toggle("open", t.on);
    ctx.onChange(); touch();
  });
});
