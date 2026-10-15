/* relatorio.js — Relatório do projeto (aba Coordenograma, botão "Gerar relatório").
   Monta um documento HTML (capa, concessionária, instalação, ordem de ajuste e coordenogramas em alta resolução),
   que abre em nova aba para imprimir / salvar em PDF, ou baixa como arquivo .html. */
"use strict";

const RL_N = v => v == null || !isFinite(v) ? "—" : ptbr((Math.round(v * 100) / 100).toString());
const RL_TXT = s => { s = String(s == null ? "" : s).trim(); return s ? esc(s) : "—"; };
const RL_SEMTAG = s => String(s).replace(/<[^>]*>/g, "");
const RL_LISTA_FIN = { consumo: "Consumo", consumo_geracao: "Consumo + Geração", geracao: "Geração" };
const rlTab = (cab, linhas, cls) => `<table class="${cls || ""}"><thead><tr>${cab.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const rlKV = pares => `<table class="kv"><tbody>${pares.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;

/* Texto de um campo (valor + unidade quando for tempo definido) */
function rlCel(def, f, d){
  if (f.t === "curve") return d.norm === "DT" ? "Tempo definido" : esc(d.norm + " " + ((TIPOS[d.norm] || []).find(x => x[0] === d.tipo) || [0, d.tipo])[1]);
  if (f.t === "sel") return esc(((f.opts.find(o => o[0] === d[f.k]) || [0, d[f.k]])[1]));
  const v = d[f.k]; if (v == null) return "—";
  return showNum(v) + (f.dial && d.norm === "DT" ? " s" : "");
}
const rlCab = f => f.t === "curve" ? "Curva" : f.dial ? "Dial / Tempo" : RL_SEMTAG(f.lab).replace(/^Ip\d$/, "Ip") + (f.unit ? " (" + f.unit + ")" : "");

/* Funções habilitadas do cliente: uma tabela por função. A coluna "Estágio" só aparece quando algum estágio usa tempo definido (e sempre na 81O/U) */
function rlFuncoes(C, ids){
  const partes = [];
  FUNCS.forEach(def => {
    if (ids && !ids.includes(def.id)) return;
    const fn = C.funcs[def.id]; if (!fn || !fn.en) return;
    const sets = def.sets.filter(s => !s.toggle || fn[s.key].on); if (!sets.length) return;
    const est = def.id === "81O/U" || sets.some(s => fn[s.key].norm === "DT");
    const cab = (est ? ["Estágio"] : []).concat(sets[0].fields.map(rlCab));
    const linhas = sets.map(s => (est ? [esc(s.title || "Único")] : []).concat(s.fields.map(f => rlCel(def, f, fn[s.key]))));
    partes.push(`<div class="fn"><h4>Função ${esc(fnLabel(def.id))} — ${esc(def.name)}</h4>${rlTab(cab, linhas)}</div>`);
  });
  return partes.join("") || `<p class="vazio">Nenhuma função habilitada.</p>`;
}
/* Proteções da concessionária: todas numa única tabela, sem coluna de estágio */
function rlFuncoesUnica(C, ids){
  const linhas = [];
  FUNCS.forEach(def => {
    if (ids && !ids.includes(def.id)) return;
    const fn = C.funcs[def.id]; if (!fn || !fn.en) return;
    const sets = def.sets.filter(s => !s.toggle || fn[s.key].on);
    sets.forEach((s, i) => {
      const d = fn[s.key], inst = def.curve === "inst";
      linhas.push([esc(fnLabel(def.id)) + (sets.length > 1 ? ` <small>(estágio ${i + 1})</small>` : ""), d.ip == null ? "—" : showNum(d.ip),
        inst ? "Instantânea" : rlCel(def, s.fields.find(f => f.t === "curve") || {}, d),
        inst ? (d.dial == null ? "—" : showNum(d.dial) + " s") : rlCel(def, s.fields.find(f => f.dial) || { k: "dial" }, d)]);
    });
  });
  return linhas.length ? rlTab(["Função", "Pickup (A)", "Curva", "Dial / Tempo"], linhas) : `<p class="vazio">Nenhuma função habilitada.</p>`;
}

function rlCapa(){
  const c = S.info.cliente, e = S.info.contratada, conc = (CONCESSIONARIAS.find(x => x[0] === S.info.conc) || [0, "—"])[1];
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const bloco = (t, p) => `<div class="cb"><h3>${t}</h3>${rlKV([["Nome / Razão social", RL_TXT(p.nome)], ["Endereço", RL_TXT(p.endereco)], ["CPF / CNPJ", RL_TXT(p.doc)], ["E-mail", RL_TXT(p.email)], ["Telefone", RL_TXT(p.tel)]])}</div>`;
  return `<section class="capa">
    <div class="capa-top"><img class="capa-logo" src="${ESI_LOGO.cor}" alt="ESI — Engenharia de Soluções Inteligentes"><p class="kicker">Estudo de proteção e coordenação</p><h1>${RL_TXT(S.name)}</h1><p class="sub">Relatório do projeto · ${esc(hoje)}</p></div>
    <div class="capa-mid">${bloco("Cliente", c)}${bloco("Empresa responsável pelo estudo", e)}</div>
    <div class="capa-bot">${rlKV([["Concessionária", esc(conc)], ["Finalidade do estudo", esc(RL_LISTA_FIN[S.info.fin] || "—")], ["Tensão de base", RL_N(S.baseKV) + " kV"]])}</div>
  </section>`;
}

function rlConc(){
  const conc = (CONCESSIONARIAS.find(x => x[0] === S.info.conc) || [0, "—"])[1], v = iccEstudo(), m = typeof inrushEfetivo === "function" ? inrushEfetivo() : 0;
  const prem = rlKV([["Concessionária", esc(conc)], ["Tensão de base (linha-linha)", RL_N(S.baseKV) + " kV"], ["Potência de base", S.baseS > 0 ? RL_N(S.baseS) + " MVA" : "—"],
    ["Corrente de inrush", m ? `<span class="form">${(INRUSH_METODOS.find(x => x.n === m) || {}).f || "—"}</span>` : "—"]]);
  let icc = `<h4>Correntes de curto-circuito do estudo</h4>` + rlTab(["Tipo", "Corrente (A)"], ICC_DEF.map(([k, lab]) => [esc(k === "iftmin" ? lab + " (" + RL_N(S.rf) + " Ω)" : lab), RL_N(v[k])]), "num");
  icc += `<p class="nota">${S.redeModo === "icc" ? "Valores informados diretamente pela concessionária (corrente de curto direta)." : "Calculadas a partir das impedâncias de sequência dos trechos, em série" + (zBase() ? ", com bases de " + RL_N(S.baseKV) + " kV e " + RL_N(S.baseS) + " MVA." : ".") + " As assimétricas são valores estimados pelo X/R da sequência positiva."}</p>`;
  if (S.redeModo !== "icc"){
    const u = zUnit();
    icc += `<h4>Impedâncias de sequência dos trechos (${u})</h4>` + rlTab(["Trecho", "R<sub>1</sub>", "X<sub>1</sub>", "R<sub>0</sub>", "X<sub>0</sub>"], S.trechos.map((t, i) => ["Trecho " + (i + 1), RL_N(t.r1), RL_N(t.x1), RL_N(t.r0), RL_N(t.x0)]), "num");
  }
  return `<section class="sec"><h2><span>1</span>Dados da concessionária</h2>${prem}
    <h3>Proteção da concessionária</h3>${rlFuncoesUnica(S.concProt, ["51", "50", "51N", "50N", "51G"])}
    <h3>Curto-circuito</h3>${icc}</section>`;
}

function rlInst(){
  const n = Math.max(1, Math.min(TR_MAX, S.nTrafos || 1)), L = S.trafos.slice(0, n);
  let totKva = 0;
  const linhas = L.map((t, i) => {
    const r = trafoCalc(t); totKva += t.kva > 0 ? t.kva : 0;
    const b = t.b > 0 ? t.b : TR_B_PADRAO[t.ref];
    return [esc((t.nome || "").trim() || "T" + (i + 1)), RL_N(t.kva), RL_N(t.v1), RL_N(t.v2), esc(t.lig), esc((TR_REFRIG.find(x => x[0] === t.ref) || [0, ""])[1]),
      RL_N(r.zUsado) + (r.zTip ? "*" : ""), RL_N(b) + (t.b > 0 ? "" : "*"), RL_N(r.in1), RL_N(r.in2), RL_N(r.imag), RL_N(r.ian1), RL_N(r.nan1)];
  });
  linhas.push([`<b>Total</b>`, `<b>${RL_N(totKva)}</b>`, "", "", "", "", "", "", "", "", "", "", ""]);
  const tr = rlTab(["Identificação", "Potência (kVA)", "V<sub>1</sub> (kV)", "V<sub>2</sub> (V)", "Ligação", "Refrig.", "Z (%)", "Fator k", "In prim. (A)", "In sec. (A)", "I magnet. (A)", "I ANSI (A)", "I NANSI (A)"], linhas, "num trafos")
    + `<p class="nota">* valor típico adotado (campo em branco). Correntes primárias na tensão do próprio transformador.</p>`;
  const D = demCalc(), d = S.dem || {};
  const dem = [["Finalidade do estudo", esc(RL_LISTA_FIN[S.info.fin] || "—")], ["Demanda contratada", d.contratada > 0 ? RL_N(d.contratada) + " kW" : "—"]];
  if (D.ger) dem.push(["Demanda de geração", d.geracao > 0 ? RL_N(d.geracao) + " kW" : "—"], ["Potência de geração", d.pger > 0 ? RL_N(d.pger) + " kW" : "—"], ["Tipo de paralelismo", d.par === "zero" ? "Sem exportação (grid zero)" : "Com exportação"]);
  dem.push(["Demanda base adotada", D.base ? RL_N(D.base) + " kW" : "—"], ["Corrente da demanda em BT" + (D.V2 ? " (" + RL_N(D.V2) + " V)" : ""), D.ibt != null ? RL_N(D.ibt) + " A" : "—"],
    ["Corrente nominal da demanda em MT (" + RL_N(D.V) + " kV)", D.ibase != null ? RL_N(D.ibase) + " A" : "—"]);
  if (D.ger) dem.push(["Corrente nominal de geração em MT", D.ipg != null ? RL_N(D.ipg) + " A" : "—"]);
  const ir = typeof inrushTotal === "function" ? inrushTotal() : null;
  dem.push(["Corrente de inrush total (" + RL_N(S.baseKV) + " kV)", ir ? RL_N(ir.I) + " A (método " + ir.metodo + ")" : "—"]);
  let tc = "";
  try {
    const r = tcCalc();
    if (r.ipn > 0) tc = `<h3>TC de proteção</h3>` + rlKV([["Relação de transformação", RL_N(r.ipn) + "-" + RL_N(S.tc.sec) + " A (RTC " + RL_N(r.rtc) + ")"], ["Classe de exatidão", r.vnom ? esc(tcNome(r.vnom, S.tc.sec)) : "—"]])
      + `<div class="tcfig">${tcDiagrama(r)}</div>`;
  } catch (e) {}
  return `<section class="sec"><h2><span>2</span>Dados da instalação</h2>
    <h3>Transformadores</h3>${tr}<h3>Demanda e geração</h3>${rlKV(dem)}${tc}</section>`;
}

function rlAjuste(){
  return `<section class="sec"><h2><span>3</span>Ordem de ajuste de proteção — cliente</h2>
    <p class="nota">Parâmetros de todas as funções habilitadas. Correntes na tensão de base de ${RL_N(S.baseKV)} kV.</p>${rlFuncoes(S.cliente)}</section>`;
}

/* ---------- coordenogramas em alta resolução ---------- */
const RL_W = 1100, RL_H = 700, RL_ESCALA = 3;
function rlSvgTexto(view){
  const v0 = S.view, f0 = RENDER_FORCE; let txt = "";
  try { S.view = view; RENDER_FORCE = { width: RL_W, height: RL_H }; render(); txt = svg.innerHTML; }
  finally { RENDER_FORCE = f0; S.view = v0; render(); }
  txt = txt.replace(/<g id="cross"[\s\S]*<\/g>$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${RL_W}" height="${RL_H}" viewBox="0 0 ${RL_W} ${RL_H}" font-family="Arial, Helvetica, sans-serif">${txt}</svg>`;
}
function rlPng(svgTxt){
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = RL_W * RL_ESCALA; c.height = RL_H * RL_ESCALA;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/png"));
    };
    img.onerror = () => falha(new Error("Não foi possível desenhar o coordenograma."));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt);
  });
}
async function rlGraficos(){
  const out = [];
  for (const [view, nome] of [["fase", "Coordenograma de fase"], ["neutro", "Coordenograma de neutro"]]) out.push({ nome, png: await rlPng(rlSvgTexto(view)) });
  return out;
}

const RL_CSS = `
:root{--p1:#9DBBF2;--p2:#BFD3F7;--p3:#D7E3FA;--p4:#EAF1FD;--panel:#fff;--ink:#000;--muted:#44536D;--anchor:#0F2747;--edge:#9DBBF2}
.fr{display:inline-flex;flex-direction:column;align-items:stretch;vertical-align:middle;margin:0 2px;text-align:center}.fr>span:first-child{border-bottom:1px solid #000;padding:0 4px 1px}.fr>span:last-child{padding:1px 4px 0}
.form{font-size:13px}td small{color:#44536D}.tcfig{max-width:150mm;margin:8px auto 0;page-break-inside:avoid}
.tcsvg{display:block;width:100%;height:auto}
.tcsvg .dg-core{fill:none;stroke:var(--p3);stroke-width:36}
.tcsvg .dg-ring{fill:none;stroke:var(--p1);stroke-width:1.5}
.tcsvg .dg-lam{fill:none;stroke:var(--p2);stroke-width:1}
.tcsvg .dg-coil{fill:none;stroke:var(--anchor);stroke-width:2}
.tcsvg .dg-w{fill:none;stroke:var(--anchor);stroke-width:2.2}
.tcsvg .dg-p{fill:none;stroke:var(--anchor);stroke-width:2.2}
.tcsvg .dg-ar{fill:var(--anchor)}
.tcsvg .dg-dot{fill:var(--anchor)}
.tcsvg .dg-b{fill:var(--panel);stroke:var(--anchor);stroke-width:2}
.tcsvg .dg-b.no{stroke:#B42318}
.tcsvg .dg-n{font-size:20px;font-weight:700;fill:var(--ink);font-variant-numeric:tabular-nums}
.tcsvg .dg-n.no{fill:#B42318}
.tcsvg .dg-t{font-size:13px;font-weight:700;fill:var(--anchor)}
.tcsvg .dg-s{font-size:11px;fill:var(--muted)}
.tcsvg .dg-c{font-size:13px;fill:var(--ink)}
.tcsvg .dg-cb{font-weight:700;fill:var(--anchor)} .tcsvg .dg-cb.no{fill:#B42318}
.tcsvg .dg-tag{fill:var(--panel);stroke:var(--anchor);stroke-width:1.6;stroke-dasharray:6 3}
.tcsvg .dg-tg{font-size:16px;font-weight:700;fill:var(--ink)} .tcsvg .dg-tu{fill:var(--anchor)}
.tcsvg .dg-v{fill:var(--p4);stroke:var(--edge)} .tcsvg .dg-v.ok{stroke:var(--anchor)} .tcsvg .dg-v.no{fill:#FDECEA;stroke:#B42318}
.tcsvg .dg-vt{font-size:15px;font-weight:700;fill:var(--muted)} .tcsvg .dg-vt.ok{fill:var(--anchor)} .tcsvg .dg-vt.no{fill:#B42318}
.tcsvg .dg-d{fill:none;stroke:var(--anchor);stroke-width:1.4;stroke-dasharray:3 3}

@page{size:A4;margin:14mm}@page land{size:A4 landscape;margin:10mm}
*{box-sizing:border-box}html{background:#EAF1FD}
body{margin:0 auto;max-width:210mm;background:#fff;color:#000;font:12px/1.45 Arial,Helvetica,sans-serif;padding:0 14mm}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;justify-content:flex-end;background:#0F2747;margin:0 -14mm;padding:8px 14mm}
.bar span{color:#fff;margin-right:auto;font-weight:700}.bar button{background:#fff;color:#0F2747;border:0;border-radius:6px;padding:7px 12px;font:700 12px Arial;cursor:pointer}
h1,h2,h3,h4{color:#0F2747;margin:0}
.capa{min-height:260mm;display:flex;flex-direction:column;justify-content:space-between;padding:18mm 0 6mm;page-break-after:always}
.kicker{margin:0 0 8px;letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:#44536D}
.capa-logo{height:26mm;width:auto;display:block;margin:0 0 14mm -2mm}.capa h1{font-size:34px;line-height:1.15;border-bottom:4px solid #1D68EE;padding-bottom:14px}.sub{color:#44536D;margin:10px 0 0}
.capa-mid{display:grid;gap:22px}.cb h3{font-size:14px;margin-bottom:6px}
table{width:100%;border-collapse:collapse;margin:8px 0 6px}
th,td{border:1px solid #D7E3FA;padding:5px 7px;text-align:left;vertical-align:top;font-size:11.5px}
thead th{background:#EAF1FD;color:#0F2747}
.kv th{width:42%;background:#EAF1FD;color:#0F2747;font-weight:700}
.num td:not(:first-child),.num th:not(:first-child){text-align:right}.trafos th,.trafos td{font-size:10px;padding:4px 4px}
.sec{page-break-before:always}.sec h2{font-size:20px;display:flex;gap:10px;align-items:center;border-bottom:2px solid #9DBBF2;padding-bottom:8px;margin-bottom:10px}
.sec h2 span{background:#0F2747;color:#fff;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:14px}
.sec h3{font-size:14px;margin:16px 0 4px}.fn{page-break-inside:avoid;margin:10px 0}.fn h4{font-size:12.5px}
.nota{color:#44536D;font-size:11px;margin:4px 0}.vazio{color:#44536D}
.land{page:land;page-break-before:always;text-align:center}.land h2{font-size:18px;margin:0 0 6px;text-align:left}
.land img{width:100%;height:auto;display:block;border:1px solid #D7E3FA}
.land p{font-size:11px;color:#44536D;text-align:left}
@media print{html{background:#fff}body{max-width:none;padding:0}.bar{display:none}}
@media screen{body{box-shadow:0 0 14px rgba(15,39,71,.18);margin-bottom:24px}.land{margin-top:30px}}
`;

function relatorioHTML(graficos, comBarra){
  const barra = comBarra ? `<div class="bar"><span>Relatório do projeto</span><button type="button" id="rlImp">Imprimir / Salvar em PDF</button><button type="button" id="rlDl">Baixar HTML</button></div>` : "";
  const gr = graficos.map((g, i) => `<section class="land"><h2>${i + 4}. ${g.nome}</h2><img alt="${g.nome}" src="${g.png}"><p>Base ${RL_N(S.baseKV)} kV · eixos: corrente de ${RL_N(S.axes.imin)} a ${RL_N(S.axes.imax)} A, tempo de ${RL_N(S.axes.tmin)} a ${RL_N(S.axes.tmax)} s.</p></section>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório — ${esc(S.name)}</title><style>${RL_CSS}</style></head><body>${barra}${rlCapa()}${rlConc()}${rlInst()}${rlAjuste()}${gr}</body></html>`;
}
const RL_SCRIPT = `<script>document.getElementById("rlImp").onclick=function(){window.print()};document.getElementById("rlDl").onclick=function(){var b=document.querySelector(".bar");var h=document.documentElement.cloneNode(true);var x=h.querySelector(".bar");if(x)x.remove();var s=h.querySelectorAll("script");s.forEach(function(e){e.remove()});var u=URL.createObjectURL(new Blob(["<!doctype html>"+h.outerHTML],{type:"text/html"}));var a=document.createElement("a");a.href=u;a.download="relatorio.html";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},2000)};<\/script>`;

async function gerarRelatorio(baixar){
  const btns = document.querySelectorAll("[data-rel]"), status = $("#relStatus");
  const w = baixar ? null : window.open("", "_blank");
  if (!baixar && w) w.document.write("<p style='font:14px Arial;padding:24px'>Gerando o relatório…</p>");
  btns.forEach(b => b.disabled = true); if (status) status.textContent = "Gerando relatório…";
  try {
    const gr = await rlGraficos();
    if (baixar){
      const u = URL.createObjectURL(new Blob([relatorioHTML(gr, false)], { type: "text/html" })), a = document.createElement("a");
      a.href = u; a.download = "relatorio-" + (S.name || "projeto").replace(/[^\w\-]+/g, "_") + ".html"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 3000);
      if (status) status.textContent = "Relatório baixado.";
    } else if (w){
      w.document.open(); w.document.write(relatorioHTML(gr, true).replace("</body>", RL_SCRIPT + "</body>")); w.document.close();
      if (status) status.textContent = "";
    } else if (status) status.textContent = "O navegador bloqueou a nova aba. Libere pop-ups ou use \"Baixar relatório\".";
  } catch (e) {
    if (w) w.close();
    if (status) status.textContent = "Não foi possível gerar o relatório: " + e.message;
  } finally { btns.forEach(b => b.disabled = false); }
}
