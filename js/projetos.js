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

const IC_MAIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const iniDia = t => new Date(t).toLocaleDateString("pt-BR");
function renderInicio(){
  const L = LIB.lista, n = { finalizado: L.filter(p => p.status === "finalizado").length, andamento: L.filter(p => p.status !== "finalizado").length };
  if ($("#iniIc") && typeof MOD_IC !== "undefined") $("#iniIc").innerHTML = MOD_IC.protecao;
  const ult = L.slice().sort((a, b) => b.alterado - a.alterado)[0];
  const tile = ic => `<span class="dsh-ic">${ic}</span>`;
  $("#iniCards").innerHTML = `
    <article class="dsh-card">
      <div class="dsh-ch">${tile(typeof MOD_IC !== "undefined" ? MOD_IC.protecao : "")}<div><p class="dsh-k">Coordenograma · Ajuste dos relés</p><h3>Novo estudo</h3></div></div>
      <p class="dsh-d">Cadastro do estudo, dados da concessionária e da instalação, ordem de ajuste e coordenograma.</p>
      <div class="dsh-cf"><small>${L.length} estudo(s)</small><button type="button" class="dsh-bt" id="btnNovo2">${IC_MAIS} Novo estudo</button></div>
    </article>
    <article class="dsh-card">
      <div class="dsh-ch">${tile(IC_RELOGIO)}<div><p class="dsh-k">Último estudo</p><h3>${ult ? esc(projTitulo(ult)) : "Nenhum estudo ainda"}</h3></div></div>
      <p class="dsh-d">${ult ? esc([ult.cliente && ult.cliente !== projTitulo(ult) ? ult.cliente : "", iniConc(ult.conc)].filter(Boolean).join(" · ") || "Sem cliente informado") + " · alterado em " + iniData(ult.alterado) : "Crie o primeiro estudo para começar a preencher os dados."}</p>
      <div class="dsh-cf"><small>${ult ? "ID " + ult.id : ""}</small>${ult ? `<button type="button" class="dsh-bt sec" data-acao="abrir-ult" data-id="${ult.id}">Abrir estudo</button>` : ""}</div>
    </article>
    <article class="dsh-card dsh-stat">
      <div class="dsh-sl"><span class="dsh-ic ok">${IC_OK}</span><div><small>Finalizados</small><b>${n.finalizado}</b></div></div>
      <div class="dsh-sl"><span class="dsh-ic">${IC_RELOGIO}</span><div><small>Em andamento</small><b>${n.andamento}</b></div></div>
    </article>`;
  $("#iniFiltros").innerHTML = [["todos", "Todos"], ["andamento", "Em andamento"], ["finalizado", "Finalizados"]]
    .map(([k, t]) => `<button type="button" class="${INI.filtro === k ? "on" : ""}" data-filtro="${k}" aria-pressed="${INI.filtro === k}">${t}</button>`).join("");

  const q = INI.busca.trim().toLowerCase();
  let V = L.filter(p => INI.filtro === "todos" || (INI.filtro === "finalizado" ? p.status === "finalizado" : p.status !== "finalizado"))
           .filter(p => !q || [String(p.id), projTitulo(p), p.cliente, iniConc(p.conc), iniFin(p.fin)].join(" ").toLowerCase().includes(q));
  V.sort(INI.ord === "az" ? (a, b) => projTitulo(a).localeCompare(projTitulo(b), "pt-BR") : INI.ord === "id" ? (a, b) => b.id - a.id : (a, b) => b.alterado - a.alterado);
  $("#iniCont").textContent = V.length + (V.length === 1 ? " estudo" : " estudos");

  if (!L.length){ $("#iniLista").innerHTML = `<p class="ini-nada">Nenhum estudo ainda. Clique em "Novo estudo" para começar.</p>`; return; }
  if (!V.length){ $("#iniLista").innerHTML = `<p class="ini-nada">Nenhum estudo encontrado com esse filtro.</p>`; return; }
  const sh = V.slice(0, INI.mostrar);
  $("#iniLista").innerHTML = `<div class="dsh-tw"><table class="dsh-tb"><thead><tr><th>Estudo</th><th>Concessionária</th><th>Criado</th><th>Alterado</th><th>Situação</th><th class="r">Ações</th></tr></thead><tbody>` + sh.map(p => {
    const fin = p.status === "finalizado", ap = INI.apagar === p.id, atual = p.id === LIB.atual;
    const sub = [p.cliente && p.cliente !== projTitulo(p) ? p.cliente : "", iniFin(p.fin)].filter(Boolean).join(" · ");
    return `<tr class="dsh-tr" data-id="${p.id}">
      <td><button type="button" class="dsh-nome" data-acao="abrir">${esc(projTitulo(p))}</button>${atual ? ' <em class="dsh-ag">aberto agora</em>' : ""}<div class="dsh-sub">ID ${p.id}${sub ? " · " + esc(sub) : ""}</div></td>
      <td>${esc(iniConc(p.conc)) || "—"}</td><td>${iniDia(p.criado)}</td><td>${iniDia(p.alterado)}</td>
      <td><span class="dsh-st ${fin ? "ok" : "run"}">${fin ? "Finalizado" : "Em andamento"}</span></td>
      <td class="r ac"><button type="button" class="ini-link" data-acao="abrir">Abrir</button><button type="button" class="ini-link" data-acao="duplicar">Duplicar</button><button type="button" class="ini-link" data-acao="status">${fin ? "Reabrir" : "Finalizar"}</button><button type="button" class="ini-link ${ap ? "perigo" : "cinza"}" data-acao="excluir">${ap ? "Confirmar" : "Excluir"}</button></td></tr>`;
  }).join("") + `</tbody></table></div>` + (V.length > sh.length ? `<div class="ini-mais"><button type="button" class="btn" data-acao="mais">Mostrar mais (${V.length - sh.length})</button></div>` : "");
}

document.addEventListener("click", e => {
  if (e.target.closest("#btnNovo, #btnNovo2")) return projNovo();
  const c = e.target.closest("#tab-inicio [data-filtro]"); if (c){ INI.filtro = c.dataset.filtro === INI.filtro && INI.filtro !== "todos" ? "todos" : c.dataset.filtro; INI.mostrar = 25; return renderInicio(); }
  const a = e.target.closest("#tab-inicio [data-acao]"); if (!a) return;
  const id = +((a.closest("[data-id]") || {}).dataset || {}).id, ac = a.dataset.acao;
  if (ac === "novo") return projNovo();
  if (ac === "mais"){ INI.mostrar += 25; return renderInicio(); }
  if (ac === "abrir" || ac === "abrir-ult") return projAbrir(id);
  if (ac === "duplicar") return projDuplicar(id);
  if (ac === "status") return projStatus(id);
  if (ac === "excluir"){
    if (INI.apagar === id){ INI.apagar = null; return projExcluir(id); }
    INI.apagar = id; renderInicio(); setTimeout(() => { if (INI.apagar === id){ INI.apagar = null; renderInicio(); } }, 4000);
  }
});
$("#iniBusca").addEventListener("input", e => { INI.busca = e.target.value; INI.mostrar = 25; renderInicio(); });
$("#iniOrd").addEventListener("change", e => { INI.ord = e.target.value; renderInicio(); });
