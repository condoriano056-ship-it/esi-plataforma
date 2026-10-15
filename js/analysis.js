/* analysis.js — tabela de seletividade: tempo de cada dispositivo na corrente de análise e margem entre eles */
"use strict";

function renderAnalysis(){
  const I = S.ifault, rows = [];
  if (I > 0){
    MODEL_CACHE.forEach(({ d, m }) => {
      if (m.kind !== "protect" && m.kind !== "damage") return;
      rows.push({ d, kind: m.kind, t: m.tAt(I) });
    });
  }
  const act = rows.filter(r => isFinite(r.t) && r.t > 0).sort((a, b) => a.t - b.t);
  const none = rows.filter(r => !(isFinite(r.t) && r.t > 0));
  let html = `<thead><tr><th>Dispositivo</th><th>Tipo</th><th class="n">t (s)</th><th class="n">Δt anterior (s)</th><th>Situação</th></tr></thead><tbody>`;
  if (!(I > 0)) html += `<tr><td colspan="5" class="note">Informe uma corrente de análise ou clique no gráfico.</td></tr>`;
  let prevProt = null;
  act.forEach(r => {
    let dt = "", st = "";
    if (r.kind === "protect"){
      if (prevProt){
        const x = r.t - prevProt.t; dt = fmt(x);
        st = x >= S.cti ? `<span class="st ok">SELETIVO</span>` : `<span class="st bad">${x < 0 ? "INVERTIDO" : "MARGEM BAIXA"}</span>`;
      } else st = `<span class="st inf">MAIS RÁPIDO</span>`;
      prevProt = r;
    } else st = `<span class="st inf">LIMITE SUPORTÁVEL</span>`;
    html += `<tr><td><i style="background:${r.d.color}"></i>${esc(r.d.name)}</td><td>${TYPES[r.d.type].label}</td><td class="n">${fmt(r.t)}</td><td class="n">${dt || "—"}</td><td>${st}</td></tr>`;
  });
  none.forEach(r => {
    html += `<tr><td><i style="background:${r.d.color}"></i>${esc(r.d.name)}</td><td>${TYPES[r.d.type].label}</td><td class="n">—</td><td class="n">—</td><td><span class="st inf">${r.kind === "protect" ? "NÃO ATUA" : "SEM LIMITE NESTA I"}</span></td></tr>`;
  });
  $("#tbl").innerHTML = html + "</tbody>";
  if (document.activeElement !== $("#ifault")) $("#ifault").value = S.ifault || "";
  if (document.activeElement !== $("#cti")) $("#cti").value = S.cti;
}
