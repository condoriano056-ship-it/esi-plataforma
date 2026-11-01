/* inrush.js — método de cálculo da corrente de inrush (aba Dados da Concessionária).
   O método vem pré-selecionado conforme a concessionária escolhida na página inicial; o usuário pode trocar.
   Fonte dos métodos e do método de cada concessionária: Mesh Engenharia, "Corrente de Inrush de Transformadores" (2023). */
"use strict";

/* Método padrão de cada concessionária (id da concessionária → nº do método). ENEL: não consta na fonte, sem padrão. */
const INRUSH_PADRAO = { cemig: 1, energisa: 2, cpfl: 4, neoenergia: 2, copel: 5 };

/* Fórmulas em HTML (mostradas na janelinha ao passar o mouse). */
const FR = (n, d) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
const I_ = (b, s) => `<i>${b}</i><sub>${s}</sub>`;
const INRUSH_METODOS = [
  { n: 1, nome: "Método 1", resumo: "Maior I<sub>mag</sub> + demais In", tipo: "Parcial",
    f: `${I_("I", "inrush")} = ${I_("I", "mag(maior)")} + Σ ${I_("In", "demais trafos")}` },
  { n: 2, nome: "Método 2", resumo: "Método 1 limitado pelo curto-circuito", tipo: "Real",
    f: `${I_("I", "inrush")} = ${FR("1", `${FR("1", I_("I", "método 1"))}<b>+</b>${FR("1", I_("I", "cc3φ assim."))}`)}` },
  { n: 3, nome: "Método 3", resumo: "Soma de todos os I<sub>mag</sub>", tipo: "Parcial",
    f: `${I_("I", "inrush")} = Σ ${I_("I", "mag (todos os trafos)")}` },
  { n: 4, nome: "Método 4", resumo: "Método 3 limitado pelo curto-circuito", tipo: "Real",
    f: `${I_("I", "inrush")} = ${FR("1", `${FR("1", I_("I", "método 3"))}<b>+</b>${FR("1", I_("I", "cc3φ assim."))}`)}` },
  { n: 5, nome: "Método 5", resumo: "8 × In(maior) + 4 × demais In", tipo: "Parcial",
    f: `${I_("I", "inrush")} = 8 × ${I_("I", "n(maior)")} + 4 × Σ ${I_("In", "demais trafos")}` },
];
const INRUSH_NOTA = `${I_("I", "mag")} = k × ${I_("I", "nominal")} &nbsp;(k = 10 óleo · 14 seco)`;

const inrushPadrao = () => INRUSH_PADRAO[S && S.info && S.info.conc] || 0;
const inrushEfetivo = () => S.inrushMetodo || inrushPadrao() || 0;     // 0 = nenhum escolhido
const concNome = () => { const p = CONCESSIONARIAS.find(x => x[0] === (S.info && S.info.conc)); return p ? p[1] : ""; };

function tipHTML(m){
  return `<div class="tip-t">${m.nome} <span>${m.tipo}</span></div><div class="tip-f">${m.f}</div><div class="tip-n">${INRUSH_NOTA}</div>`;
}

/* ---------- janelinha flutuante ---------- */
let tipEl = null;
function tipShow(m, anchor){
  if (!tipEl){ tipEl = document.createElement("div"); tipEl.className = "inrush-tip"; tipEl.setAttribute("role", "tooltip"); document.body.appendChild(tipEl); }
  tipEl.innerHTML = tipHTML(m); tipEl.style.display = "block";
  const a = anchor.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, g = 10;
  let x = a.right + g; if (x + w > innerWidth - 8) x = Math.max(8, a.left - w - g);          // à direita; se não couber, à esquerda
  if (x < 8 || x + w > innerWidth - 8) x = Math.min(Math.max(8, a.left), innerWidth - w - 8);   // telas estreitas: alinhado ao item
  let y = a.top + a.height / 2 - h / 2; y = Math.min(Math.max(8, y), innerHeight - h - 8);
  tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
}
function tipHide(){ if (tipEl) tipEl.style.display = "none"; }

/* ---------- lista suspensa ---------- */
function renderInrush(){
  const host = $("#inrushDD"); if (!host) return;
  const ef = inrushEfetivo(), pad = inrushPadrao(), nome = concNome(), cur = INRUSH_METODOS.find(m => m.n === ef);
  host.innerHTML = `<button type="button" class="dd-btn" id="inrushBtn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="h-inr inrushBtn">
      <span class="dd-cur">${cur ? `<b>${cur.nome}</b> · ${cur.resumo}` : "Selecione o método"}</span><span class="dd-car" aria-hidden="true">▾</span></button>
    ${cur && cur.n === pad && nome ? `<div class="dd-sub">Padrão da ${esc(nome)}</div>` : cur && pad ? `<div class="dd-sub">Alterado manualmente · padrão da ${esc(nome)}: Método ${pad}</div>` : !cur && nome ? `<div class="dd-sub">A ${esc(nome)} não tem método padrão cadastrado</div>` : ""}
    <ul class="dd-list" role="listbox" aria-label="Método da corrente de inrush" hidden>${INRUSH_METODOS.map(m =>
      `<li role="option" tabindex="-1" data-n="${m.n}" aria-selected="${m.n === ef}"><span class="dd-n"><b>${m.nome}</b> · ${m.resumo}</span>${m.n === pad ? `<span class="dd-badge">padrão ${esc(nome)}</span>` : ""}</li>`).join("")}</ul>`;
}
function ddOpen(on){
  const l = $("#inrushDD .dd-list"), b = $("#inrushBtn"); if (!l) return;
  l.hidden = !on; b.setAttribute("aria-expanded", String(on)); if (!on) tipHide();
}
function applyInrush(){ renderInrush(); }

(function(){
  const host = $("#inrushDD"); if (!host) return;
  host.addEventListener("click", e => {
    const li = e.target.closest("li[data-n]");
    if (li){
      const n = +li.dataset.n; S.inrushMetodo = n === inrushPadrao() ? null : n;     // escolher o padrão volta ao automático
      renderInrush(); touch(); const b = $("#inrushBtn"); if (b) b.focus(); return;
    }
    if (e.target.closest("#inrushBtn")){ const open = $("#inrushDD .dd-list").hidden; ddOpen(open); if (open){ const s = $("#inrushDD li[aria-selected=true]") || $("#inrushDD li"); s && s.focus(); } }
  });
  /* janelinha com a fórmula: ao passar o mouse (ou focar) sobre o item ou sobre o botão */
  host.addEventListener("mouseover", e => {
    const li = e.target.closest("li[data-n]"), b = e.target.closest("#inrushBtn");
    const n = li ? +li.dataset.n : b ? inrushEfetivo() : 0, m = INRUSH_METODOS.find(x => x.n === n);
    if (m) tipShow(m, li || b); else tipHide();
  });
  host.addEventListener("mouseleave", tipHide);
  host.addEventListener("focusin", e => { const li = e.target.closest("li[data-n]"); if (li) tipShow(INRUSH_METODOS.find(x => x.n === +li.dataset.n), li); });
  host.addEventListener("keydown", e => {
    const li = e.target.closest("li[data-n]"), l = $("#inrushDD .dd-list");
    if (e.key === "Escape"){ ddOpen(false); const b = $("#inrushBtn"); b && b.focus(); return; }
    if (e.target.id === "inrushBtn" && (e.key === "ArrowDown" || e.key === "ArrowUp")){ e.preventDefault(); ddOpen(true); const s = $("#inrushDD li[aria-selected=true]") || $("#inrushDD li"); s && s.focus(); return; }
    if (!li) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); const o = [...l.children], i = o.indexOf(li) + (e.key === "ArrowDown" ? 1 : -1); (o[(i + o.length) % o.length]).focus(); }
    if (e.key === "Enter" || e.key === " "){ e.preventDefault(); li.click(); }
  });
  document.addEventListener("click", e => { if (!e.target.closest("#inrushDD")) ddOpen(false); });
  document.addEventListener("scroll", tipHide, true);
})();
