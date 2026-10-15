/* modulos.js — módulos da plataforma (menu lateral, página de boas-vindas geral e áreas de cada módulo).
   Para criar um módulo novo: acrescente um item em MODULOS. Se "pronto" for falso, a área mostra "em desenvolvimento". */
"use strict";

const svgI = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const MOD_IC = {
  hub:      svgI('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  protecao: svgI('<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  bt:       svgI('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
  mt:       svgI('<path d="M12 3v18M7 21h10M6 7h12M8 12h8M5 7l3 5M19 7l-3 5"/>'),
  tarifa:   svgI('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  spda:     svgI('<path d="M17 18a4 4 0 000-8 5 5 0 00-9.6-1.4A4 4 0 007 18"/><path d="M12 11l-2 4h3l-2 4"/>'),
  info:     svgI('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  seta:     svgI('<path d="M5 12h14M13 6l6 6-6 6"/>')
};
const MODULOS = [
  { id: "protecao", nome: "Estudo de proteção", ic: MOD_IC.protecao, pronto: true,
    desc: "Coordenograma, ordem de ajuste dos relés e relatório do estudo de proteção.",
    subs: [["inicio", "Boas-vindas"], ["home", "Cadastro do estudo"], ["conc", "Dados da Concessionária"], ["inst", "Dados da instalação"], ["ajuste", "Ordem de ajuste de proteção"], ["coord", "Coordenograma"]] },
  { id: "bt", nome: "Baixa tensão", ic: MOD_IC.bt, pronto: false,
    desc: "Dimensionamento de instalações elétricas de baixa tensão.",
    itens: ["Dimensionamento de condutores (ampacidade e queda de tensão)", "Quadros de distribuição e circuitos de tomadas e iluminação", "Proteção por disjuntores, DR e DPS", "Eletrodutos, eletrocalhas e leitos"] },
  { id: "mt", nome: "Média tensão", ic: MOD_IC.mt, pronto: false,
    desc: "Subestações, cabines de medição e entrada de energia em média tensão.",
    itens: ["Cabine primária e medição", "Subestação abrigada ou ao tempo", "Cálculo de curto-circuito", "Malha de aterramento"] },
  { id: "tarifa", nome: "Análise tarifária", ic: MOD_IC.tarifa, pronto: false,
    desc: "Enquadramento tarifário, demanda contratada e economia na fatura.",
    itens: ["Comparação das modalidades (convencional, branca, verde, azul)", "Demanda contratada ideal", "Correção de fator de potência", "Simulação de economia e payback"] },
  { id: "spda", nome: "SPDA", ic: MOD_IC.spda, pronto: false, embed: "spda/index.html",
    desc: "Análise de risco (NBR 5419-2:2026) e estratificação do solo (NBR 7117).",
    itens: ["Análise de risco", "Classe do SPDA e nível de proteção", "Captação, descidas e aterramento", "Medidas de proteção contra surtos (DPS)"] }
];
const modPorId = id => MODULOS.find(m => m.id === id);
const ativo = m => m.pronto || !!m.embed;
const modEntrada = m => m.pronto ? m.subs[0][0] : "mod:" + m.id;
/* a qual módulo pertence uma tela */
const areaDe = nome => nome === "hub" ? "hub" : nome.startsWith("mod:") ? nome.slice(4) : "protecao";

function montarMenu(){
  const car = '<svg class="sn-car" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 6 5-6z"/></svg>';
  $("#snNav").innerHTML =
    `<button class="sn-item" id="tabbtn-hub" data-tab="hub" type="button" aria-selected="true">${MOD_IC.hub}<span>Início</span></button>
     <p class="sn-tit" id="snTit">Módulos</p>` +
    MODULOS.map(m => {
      const subs = m.pronto ? m.subs : [["mod:" + m.id, m.embed ? "Análise de risco e solo" : "Visão geral"]];
      return `<div class="sn-group" data-area="${m.id}">
        <button class="sn-item sn-parent" type="button" aria-expanded="false">${m.ic}<span>${m.nome}${m.pronto ? '<small id="snNome">Nenhum estudo aberto</small>' : '<small>' + (m.embed ? "Disponível" : "Em breve") + '</small>'}</span>${car}</button>
        <div class="sn-sub" role="tablist" aria-label="${m.nome}">` +
        subs.map(([t, n]) => `<button class="sn-subitem" role="tab" id="tabbtn-${t.replace(":", "-")}" data-tab="${t}" type="button" aria-selected="false">${n}</button>`).join("") +
      `</div></div>`;
    }).join("");
}

/* ---------- página de boas-vindas geral ---------- */
function renderHub(){
  const nome = (typeof AUTH !== "undefined" && AUTH.ativo() && AUTH.sessao()) ? AUTH.sessao().email.split("@")[0] : "";
  $("#hubOla").textContent = nome ? "Olá, " + nome + "!" : "Olá!";
  $("#hubCards").innerHTML = MODULOS.map(m => `<button type="button" class="hub-card ${ativo(m) ? "" : "breve"}" data-tab="${modEntrada(m)}">
      <span class="hc-ic">${m.ic}</span>
      <span class="hc-tx"><b>${m.nome}</b><small>${m.desc}</small></span>
      <span class="hc-rod"><em class="chip ${ativo(m) ? "ok" : "br"}">${ativo(m) ? "Disponível" : "Em breve"}</em><i>${MOD_IC.seta}</i></span></button>`).join("");
  const rec = (typeof LIB !== "undefined" ? LIB.lista.slice().sort((a, b) => b.alterado - a.alterado).slice(0, 3) : []);
  $("#hubRec").hidden = !rec.length;
  $("#hubRecLista").innerHTML = rec.map(p => `<button type="button" class="hub-rec" data-abrir="${p.id}"><span><b>${esc(projTitulo(p))}</b><small>Estudo de proteção · alterado em ${iniData(p.alterado)}</small></span>${MOD_IC.seta}</button>`).join("");
}
/* ---------- área de um módulo ainda não disponível ---------- */
function renderModulo(id){
  const m = modPorId(id); if (!m) return;
  const host = $("#modConteudo");
  host.classList.toggle("emb", !!m.embed);
  if (m.embed){   /* módulo pronto que vive numa página própria (arquivo único, abre por duplo clique) */
    host.innerHTML = `<div class="mod-cab"><span class="hc-ic grande">${m.ic}</span>
        <div><h1>${m.nome}</h1><p class="lead">${m.desc}</p></div>
        <a class="btn" href="${m.embed}" target="_blank" rel="noopener">Abrir em tela cheia</a></div>
      <iframe class="mod-frame" src="${m.embed}" title="${m.nome}"></iframe>`;
    return;
  }
  host.innerHTML = `
    <div class="mod-cab"><span class="hc-ic grande">${m.ic}</span>
      <div><h1>${m.nome}</h1><p class="lead">${m.desc}</p></div></div>
    <div class="mod-aviso"><em class="chip br">Em desenvolvimento</em><p>Esta área ainda está sendo construída. Ela vai reunir:</p>
      <ul>${(m.itens || []).map(i => `<li>${i}</li>`).join("")}</ul></div>
    <button class="btn" type="button" data-tab="hub">← Voltar ao início</button>`;
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-abrir]"); if (a){ projAbrir(+a.dataset.abrir); }
});
montarMenu();
