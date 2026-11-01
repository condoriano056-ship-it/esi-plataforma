/* app.js — inicialização e navegação entre abas. Carrega o último projeto salvo no navegador (ou o exemplo). */
"use strict";

/* ---------- abas ----------
   Para criar uma nova aba: 1) botão .tab com data-tab="nome" em index.html, 2) <section class="view" id="tab-nome" hidden>,
   3) se precisar redesenhar ao abrir, trate o nome em showTab(). */
const TAB_IDS = ["hub", "mod", "inicio", "home", "conc", "inst", "ajuste", "coord"];
function showTab(name){
  let sec = name.startsWith("mod:") ? "mod" : name;
  if (!TAB_IDS.includes(sec) || (sec === "mod" && !modPorId(name.slice(4)))){ name = "hub"; sec = "hub"; }
  TAB_IDS.forEach(t => { $("#tab-" + t).hidden = t !== sec; });
  document.querySelectorAll("#snNav [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  const area = areaDe(name); document.body.dataset.area = area;            // só o módulo aberto fica expandido no menu
  document.querySelectorAll(".sn-group").forEach(g => { const on = g.dataset.area === area; g.classList.toggle("open", on); g.classList.toggle("ativo", on); g.querySelector(".sn-parent").setAttribute("aria-expanded", String(on)); g.hidden = area !== "hub" && !on; });
  $("#snTit").hidden = area !== "hub";            // dentro de um módulo, os outros módulos ficam ocultos
  document.body.classList.remove("sn-open"); window.scrollTo(0, 0);
  if (name === "hub") renderHub();
  if (sec === "mod") renderModulo(name.slice(4));
  if (name === "inicio") renderInicio();
  projMenu();
  if (name === "conc" && S) renderConc();
  if (name === "inst" && S) renderInst();
  if (name === "ajuste" && S && typeof renderCalc === "function") renderCalc();
  if (name === "coord" && S) render();       // o gráfico só mede o tamanho quando está visível
}
document.addEventListener("click", e => {            // abas, logo do cabeçalho e atalhos do rodapé
  const b = e.target.closest("[data-tab]"); if (!b) return;
  e.preventDefault(); showTab(b.dataset.tab);
});
/* menu lateral: grupos que abrem e fecham, gaveta no celular, menu do usuário */
document.addEventListener("click", e => {
  const b = e.target.closest(".sn-parent"); if (!b) return;
  const g = b.closest(".sn-group"), ab = !g.classList.contains("open"); g.classList.toggle("open", ab); b.setAttribute("aria-expanded", String(ab));
});
/* Menu lateral: no computador o botão ☰ recolhe/mostra a barra (lembra a escolha); no celular abre como gaveta. */
const snMovel = () => matchMedia("(max-width:900px)").matches;
try { if (localStorage.getItem("esi.menuOculto") === "1") document.body.classList.add("sn-hide"); } catch (e) {}
const snRotulo = () => { const b = $("#btnMenu"), oculto = document.body.classList.contains("sn-hide"), aberto = document.body.classList.contains("sn-open"), on = snMovel() ? aberto : !oculto;
  b.setAttribute("aria-expanded", String(on)); b.setAttribute("aria-label", on ? "Ocultar menu" : "Mostrar menu"); b.title = on ? "Ocultar menu" : "Mostrar menu"; };
$("#btnMenu").addEventListener("click", () => {
  if (snMovel()) document.body.classList.toggle("sn-open");
  else { const o = document.body.classList.toggle("sn-hide"); try { localStorage.setItem("esi.menuOculto", o ? "1" : "0"); } catch (e) {} }
  snRotulo(); setTimeout(() => dispatchEvent(new Event("resize")), 60);   // o gráfico reajusta ao novo espaço
});
addEventListener("resize", snRotulo); snRotulo();
$("#snBack").addEventListener("click", () => document.body.classList.remove("sn-open"));
const abrirSobre = () => { document.body.classList.remove("sn-open"); const d = $("#dlgSobre"); if (d.showModal) d.showModal(); else d.setAttribute("open", ""); };
$("#snSobre").addEventListener("click", abrirSobre);
$("#ubSobre").addEventListener("click", () => { $("#ubPop").hidden = true; abrirSobre(); });
$("#ubBtn").addEventListener("click", e => { const p = $("#ubPop"); p.hidden = !p.hidden; e.currentTarget.setAttribute("aria-expanded", String(!p.hidden)); });
document.addEventListener("click", e => { if (!e.target.closest("#userbox")){ $("#ubPop").hidden = true; $("#ubBtn").setAttribute("aria-expanded", "false"); } });
/* logos embutidas (logo.js) funcionam mesmo se a pasta img/ não estiver junto */
[["hdrLogo", "marcaCor"], ["ftLogo", "branco"], ["sbLogo", "cor"]].forEach(([id, k]) => { const el = document.getElementById(id); if (el && typeof ESI_LOGO !== "undefined") el.src = ESI_LOGO[k]; });
$("#ftAno").textContent = new Date().getFullYear();
$("#btnSobre").addEventListener("click", abrirSobre);
$("#btnSobreOk").addEventListener("click", () => $("#dlgSobre").close());
$("#dlgSobre").addEventListener("click", e => { if (e.target.id === "dlgSobre") e.target.close(); });

function renderConc(){
  const sel = S && S.info && S.info.conc, par = CONCESSIONARIAS.find(x => x[0] === sel), c = par && par[1];
  $("#concLogo").innerHTML = !c ? "" : imgAuto("logo-" + sel, c, c);
}

/* ---------- redesenho completo (ao carregar projeto, desfazer, exemplo...) ---------- */
function fullRender(){
  $("#pname").value = S.name;
  $("#basekv").value = showNum(S.baseKV);
  $("#baseS").value = showNum(S.baseS);
  showBaseA();
  $("#legend").checked = S.legend;
  $("#showall").checked = !!S.showAll;
  $("#json").value = "";
  syncView();
  renderHome();
  renderConc();
  renderRede();
  syncRecom(false);
  renderInst();
  renderProtecao();
  renderCalc();
  render();
}

new ResizeObserver(() => { if (S && !$("#tab-coord").hidden) render(); }).observe(wrap);

S = blank();                           // a plataforma abre sem estudo aberto; o estudo é escolhido na aba Boas-vindas
fullRender();
histInit();
/* usuário: e-mail do login, ou "Modo local" quando o login ainda não está configurado */
(() => {
  const u = $("#userbox"), s = typeof AUTH !== "undefined" && AUTH.ativo() ? AUTH.sessao() : null;
  u.hidden = false; $(".ub-mail", u).textContent = s ? s.email : "Modo local"; $("#ubAv").textContent = (s ? s.email : "L")[0].toUpperCase();
  if (!s) $("#ubSair").hidden = true; else $("#ubSair").addEventListener("click", AUTH.sair);
})();
showTab("hub");                        // sempre abre na primeira página (boas-vindas geral)
