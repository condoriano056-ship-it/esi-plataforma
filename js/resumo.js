/* resumo.js — resumo das funções de proteção do cliente (aba Coordenograma, coluna ao lado do gráfico).
   Formato provisório: uma linha por função habilitada, com os valores de cada estágio. Os ajustes são feitos na aba
   "Ordem de ajuste de proteção". */
"use strict";

function resumoCampo(f, d){
  if (f.t === "curve") return d.norm === "DT" ? "tempo definido" : `${d.norm} ${TIPOS[d.norm] ? (TIPOS[d.norm].find(x => x[0] === d.tipo) || [0, d.tipo])[1] : d.tipo}`;
  if (f.t === "sel") return (f.opts.find(o => o[0] === d[f.k]) || [0, d[f.k]])[1];
  const v = d[f.k]; if (v == null) return null;
  const dt = f.dial && d.norm === "DT";
  return `${showNum(v)}${(dt ? "s" : f.unit) ? " " + (dt ? "s" : f.unit) : ""}`;
}
function renderResumo(){
  const host = $("#resumo"); if (!host || !S) return;
  const linhas = [];
  FUNCS.forEach(def => {
    const fn = S.cliente.funcs[def.id]; if (!fn || !fn.en) return;
    def.sets.forEach(set => {
      const d = fn[set.key]; if (set.toggle && !d.on) return;
      const cel = set.fields.map(f => { const v = resumoCampo(f, d); return v == null ? "" : `<span class="rs-c"><i>${f.t === "curve" ? "Curva" : (f.dial && d.norm === "DT" ? "Tempo" : f.lab)}</i> ${v}</span>`; }).join("");
      linhas.push(`<tr><th scope="row">${fnLabel(def.id)}${set.title && def.sets.length > 1 ? `<small>${set.title}</small>` : ""}</th><td>${cel || '<span class="rs-v">sem valores</span>'}</td></tr>`);
    });
  });
  host.innerHTML = `<h3 class="prot-title">Relatório</h3>
    <p class="note" style="text-align:center">Documento com a capa, os dados da concessionária e da instalação, a ordem de ajuste e os coordenogramas em alta resolução.</p>
    <p class="relbtns"><button type="button" class="btn" data-rel id="btnRel">Gerar relatório</button> <button type="button" class="btn sm" data-rel id="btnRelBaixar">Baixar relatório (.html)</button></p>
    <p class="note" id="relStatus" role="status" style="text-align:center"></p>
    <h4 class="rs-sub">Resumo das funções do cliente</h4>
    ${linhas.length ? `<table class="resumo"><tbody>${linhas.join("")}</tbody></table>` : `<p class="note" style="text-align:center">Nenhuma função habilitada. Habilite e ajuste as funções na aba "Ordem de ajuste de proteção".</p>`}
    <p class="note" style="text-align:center"><button type="button" class="btn sm" data-tab="ajuste" id="btnGoAjuste">Abrir Ordem de ajuste de proteção</button></p>`;
}
(function(){ const h = $("#resumo"); if (h) h.addEventListener("click", e => { if (e.target.closest("#btnGoAjuste")) showTab("ajuste"); else if (e.target.closest("#btnRel")) gerarRelatorio(false); else if (e.target.closest("#btnRelBaixar")) gerarRelatorio(true); }); })();
