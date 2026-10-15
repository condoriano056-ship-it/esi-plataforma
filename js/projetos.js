/* projetos.js — biblioteca de estudos (vários projetos guardados no navegador) e aba "Boas-vindas".
   Cada estudo guarda uma cópia completa do projeto (S). A edição salva sozinha (state.js → save → projSalvar). */
"use strict";

const LIB_KEY = "esi.estudos.v1";
const PROJ_STATUS = { andamento: "Em andamento", finalizado: "Finalizado" };
let LIB = (() => { try { const j = JSON.parse(localStorage.getItem(LIB_KEY) || "null"); if (j && Array.isArray(j.lista)) return j; } catch (e) {} return { prox: 1, atual: null, lista: [] }; })();
const libGravar = () => { try { localStorage.setItem(LIB_KEY, JSON.stringify(LIB)); } catch (e) {} };
const projAtual = () => LIB.lista.find(p => p.id === LIB.atual) || null;
const projTitulo = p => p.nome || p.cliente || "Estudo sem nome";
const copiaS = () => JSON.parse(JSON.stringify(S));

/* migração: projeto único salvo antes da biblioteca existir (só se tiver algo preenchido) */
(() => {
  if (LIB.lista.length || LIB.migrado) return;
  LIB.migrado = true;
  try {
    const j = JSON.parse(localStorage.getItem("coordenograma.v4") || "null");
    if (j && j.cliente && ((j.name || "").trim() || (j.info && j.info.cliente && j.info.cliente.nome))){
      LIB.lista.push({ id: LIB.prox++, criado: Date.now(), alterado: Date.now(), status: "andamento", dados: j, nome: j.name || "", cliente: (j.info && j.info.cliente && j.info.cliente.nome) || "", conc: j.info && j.info.conc, fin: j.info && j.info.fin });
    }
  } catch (e) {}
  libGravar();
})();

function projSalvar(){                       // chamado a cada salvamento automático
  let p = projAtual();
  if (!p){ p = { id: LIB.prox++, criado: Date.now(), status: "andamento" }; LIB.lista.push(p); LIB.atual = p.id; }
  p.dados = copiaS(); p.alterado = Date.now();
  p.nome = S.name || ""; p.cliente = (S.info && S.info.cliente && S.info.cliente.nome) || ""; p.conc = S.info && S.info.conc; p.fin = S.info && S.info.fin;
  libGravar(); projMenu();
}
const projFlush = () => { clearTimeout(_saveT); if (S && projAtual()) projSalvar(); };      // grava já o que estiver pendente antes de trocar de estudo

function projTrocar(novoS, id){
  projFlush();
  S = novoS; LIB.atual = id; libGravar();
  fullRender(); histInit(); projMenu();
}
function projNovo(){
  projFlush();
  S = blank(); LIB.atual = null; projSalvar();           // já entra na lista
  fullRender(); histInit(); projMenu();
  showTab("home");
  const f = document.querySelector("#grp-cliente input"); if (f) f.focus();
}
function projAbrir(id){ const p = LIB.lista.find(x => x.id === id); if (!p) return; projTrocar(normalize(p.dados), id); showTab("home"); }
function projDuplicar(id){
  const p = LIB.lista.find(x => x.id === id); if (!p) return; projFlush();
  const c = JSON.parse(JSON.stringify(p)); c.id = LIB.prox++; c.criado = c.alterado = Date.now(); c.status = "andamento";
  c.nome = (p.nome || p.cliente || "Estudo") + " (cópia)"; c.dados.name = c.nome; LIB.lista.push(c); libGravar(); renderInicio();
}
function projStatus(id){ const p = LIB.lista.find(x => x.id === id); if (!p) return; p.status = p.status === "finalizado" ? "andamento" : "finalizado"; libGravar(); renderInicio(); }
function projExcluir(id){
  const era = LIB.atual === id; LIB.lista = LIB.lista.filter(p => p.id !== id);
  if (era){ LIB.atual = null; S = blank(); fullRender(); histInit(); }
  libGravar(); projMenu(); renderInicio();
}
function projMenu(){                         // nome do estudo aberto no menu lateral
  const p = projAtual(), el = document.getElementById("snNome"); if (el) el.textContent = p ? projTitulo(p) : (S && (S.name || (S.info && S.info.cliente.nome)) ? (S.name || S.info.cliente.nome) : "Nenhum estudo aberto");
}

/* ---------- aba Boas-vindas ---------- */
let INI = { filtro: "todos", busca: "", ord: "rec", mostrar: 25, apagar: null };
const iniData = t => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const iniConc = id => { const c = CONCESSIONARIAS.find(x => x[0] === id); return c ? c[1] : ""; };
const iniFin = id => (FINALIDADES_LISTA.find(x => x[0] === id) || [])[1] || "";
const IC_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const IC_RELOGIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
const IC_LISTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>';

function renderInicio(){
  const L = LIB.lista, n = { finalizado: L.filter(p => p.status === "finalizado").length, andamento: L.filter(p => p.status !== "finalizado").length };
  $("#iniCards").innerHTML = [
    ["finalizado", "ok", IC_OK, n.finalizado, "Finalizados"],
    ["andamento", "run", IC_RELOGIO, n.andamento, "Em andamento"],
    ["todos", "all", IC_LISTA, L.length, "Ver todos"]
  ].map(([k, cl, ic, v, t]) => `<button type="button" class="ini-card ${cl}" data-filtro="${k}" aria-pressed="${INI.filtro === k}"><span class="ic">${ic}</span><span><b>${v}</b><small>${t}</small></span></button>`).join("");

  const q = INI.busca.trim().toLowerCase();
  let V = L.filter(p => INI.filtro === "todos" || (INI.filtro === "finalizado" ? p.status === "finalizado" : p.status !== "finalizado"))
           .filter(p => !q || [String(p.id), projTitulo(p), p.cliente, iniConc(p.conc), iniFin(p.fin)].join(" ").toLowerCase().includes(q));
  V.sort(INI.ord === "az" ? (a, b) => projTitulo(a).localeCompare(projTitulo(b), "pt-BR") : INI.ord === "id" ? (a, b) => b.id - a.id : (a, b) => b.alterado - a.alterado);
  $("#iniCont").textContent = V.length + (V.length === 1 ? " ESTUDO" : " ESTUDOS");

  if (!L.length){
    $("#iniLista").innerHTML = `<div class="ini-vazio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
      <h2>Nenhum estudo criado ainda</h2><p>Crie o primeiro estudo para preencher o cadastro, os dados da instalação e a ordem de ajuste.</p>
      <button class="btn-novo" type="button" data-acao="novo">Criar novo estudo</button></div>`;
    return;
  }
  if (!V.length){ $("#iniLista").innerHTML = `<p class="ini-nada">Nenhum estudo encontrado com esse filtro.</p>`; return; }
  const sh = V.slice(0, INI.mostrar);
  $("#iniLista").innerHTML = sh.map(p => {
    const det = [p.cliente && p.cliente !== projTitulo(p) ? p.cliente : "", iniConc(p.conc), iniFin(p.fin)].filter(Boolean).join(" · ");
    const fin = p.status === "finalizado", ap = INI.apagar === p.id, atual = p.id === LIB.atual;
    return `<article class="ini-row" data-id="${p.id}">
      <div class="ir-main">
        <span class="ir-id">ID ${p.id}${atual ? ' <em>· aberto agora</em>' : ""}</span>
        <h3>${esc(projTitulo(p))}</h3>
        <p class="ir-det"><i class="dot ${fin ? "ok" : "run"}"></i>${esc(det || "Sem cliente informado")}<span class="ir-data">Alterado em ${iniData(p.alterado)}</span></p>
      </div>
      <div class="ir-side">
        <span class="badge ${fin ? "ok" : "run"}">${fin ? "FINALIZADO" : "EM ANDAMENTO"}</span>
        <div class="ir-acoes">
          <button type="button" class="ini-link" data-acao="abrir">Abrir estudo</button>
          <button type="button" class="ini-link" data-acao="duplicar">Duplicar</button>
          <button type="button" class="ini-link" data-acao="status">${fin ? "Reabrir" : "Marcar como finalizado"}</button>
          <button type="button" class="ini-link ${ap ? "perigo" : "cinza"}" data-acao="excluir">${ap ? "Confirmar exclusão" : "Excluir"}</button>
        </div>
      </div></article>`;
  }).join("") + (V.length > sh.length ? `<div class="ini-mais"><button type="button" class="btn" data-acao="mais">Mostrar mais (${V.length - sh.length})</button></div>` : "");
}

document.addEventListener("click", e => {
  if (e.target.closest("#btnNovo, #btnNovo2")) return projNovo();
  const c = e.target.closest("#tab-inicio [data-filtro]"); if (c){ INI.filtro = c.dataset.filtro === INI.filtro && INI.filtro !== "todos" ? "todos" : c.dataset.filtro; INI.mostrar = 25; return renderInicio(); }
  const a = e.target.closest("#tab-inicio [data-acao]"); if (!a) return;
  const id = +(a.closest(".ini-row") || {}).dataset?.id, ac = a.dataset.acao;
  if (ac === "novo") return projNovo();
  if (ac === "mais"){ INI.mostrar += 25; return renderInicio(); }
  if (ac === "abrir") return projAbrir(id);
  if (ac === "duplicar") return projDuplicar(id);
  if (ac === "status") return projStatus(id);
  if (ac === "excluir"){
    if (INI.apagar === id){ INI.apagar = null; return projExcluir(id); }
    INI.apagar = id; renderInicio(); setTimeout(() => { if (INI.apagar === id){ INI.apagar = null; renderInicio(); } }, 4000);
  }
});
$("#iniBusca").addEventListener("input", e => { INI.busca = e.target.value; INI.mostrar = 25; renderInicio(); });
$("#iniOrd").addEventListener("change", e => { INI.ord = e.target.value; renderInicio(); });
