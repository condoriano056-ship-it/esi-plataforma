/* chart.js — desenho do gráfico log-log (SVG), zoom/pan, cursor e dica com os tempos de cada dispositivo */
"use strict";

const svg = $("#chart"), wrap = $("#wrap"), tip = $("#tip");
const M = { l: 62, r: 16, t: 16, b: 46 };            // margens do gráfico (px)
let W = 800, H = 500, PW = 700, PH = 440, V = null;  // tamanho total, tamanho da área de plotagem e limites em log10
let MODEL_CACHE = [];                                // modelos dos dispositivos visíveis
let RENDER_FORCE = null;                             // { width, height }: desenha em tamanho fixo (usado pelo relatório)

const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function scales(){
  const a = S.axes;
  V = { x0: Math.log10(a.imin), x1: Math.log10(a.imax), y0: Math.log10(a.tmin), y1: Math.log10(a.tmax) };
}
// corrente/tempo -> pixel, e o inverso
const X  = I => M.l + (Math.log10(clamp(I, 1e-9, 1e12)) - V.x0) / (V.x1 - V.x0) * PW;
const Y  = t => M.t + PH - (Math.log10(clamp(t, 1e-9, 1e12)) - V.y0) / (V.y1 - V.y0) * PH;
const IX = px => Math.pow(10, V.x0 + (px - M.l) / PW * (V.x1 - V.x0));
const TY = py => Math.pow(10, V.y1 - (py - M.t) / PH * (V.y1 - V.y0));
const pathOf = pts => pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");

/* Filtro (abaixo do gráfico): mostra ou oculta cada curva resultante (cliente / concessionária): S.vis["res:c"|"res:k"] = false.
   As curvas individuais só aparecem na opção "Mostrar também as curvas individuais" e servem de chave de cores na legenda do gráfico. */
const grpOff = m => !!(S.vis && S.vis["res:" + String(m.key).split(":")[0]] === false);   // resultante do grupo oculta
const isVis = m => !m.key ? true : m.indiv ? !!S.showAll && !grpOff(m) : !(S.vis && S.vis[m.key] === false);
const listed = m => m.indiv ? !grpOff(m) : isVis(m);          // entra na legenda do gráfico e na leitura do mouse
let ALL_MODELS = [], _filterSig = "";
function computeModels(){
  ALL_MODELS = clienteModels(S.view);   // fase da concessionária: acrescentar aqui os modelos dos outros dispositivos
  MODEL_CACHE = ALL_MODELS.filter(({ m }) => isVis(m));
  renderFilter();
}
function renderFilter(){
  const box = $("#cfilter"); if (!box) return;
  const sig = ALL_MODELS.map(({ d, m }) => m.key + "|" + d.name + "|" + d.color + "|" + (d.dash || "") + "|" + isVis(m)).join(";");
  if (sig === _filterSig) return;
  _filterSig = sig;
  const list = ALL_MODELS.filter(({ m }) => m.key && !m.indiv);
  box.hidden = !list.length;
  box.innerHTML = list.length ? `<p class="cf-h">Curvas resultantes e correntes de curto · clique para mostrar ou ocultar</p><div class="cf-list">` + list.map(({ d, m }) => {
    const on = isVis(m);
    return `<button type="button" class="cf res" data-cf="${esc(m.key)}" aria-pressed="${on}">
      <svg width="24" height="8" aria-hidden="true"><line x1="1" x2="23" y1="4" y2="4" stroke="${d.color}" stroke-width="3" ${d.dash ? 'stroke-dasharray="5 3"' : ""}/></svg><span>${esc(d.name)}</span></button>`;
  }).join("") + `</div>` : "";
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-cf]"); if (!b) return;
  const m = ALL_MODELS.find(x => x.m.key === b.dataset.cf); if (!m) return;
  if (!S.vis) S.vis = {};
  S.vis[b.dataset.cf] = !isVis(m.m);
  render(); touch();
});

function gridSVG(){
  const g = [], c1 = tok("--grid-major"), c2 = tok("--grid-minor"), ink = tok("--axis"), mut = tok("--muted");
  const ticks = (v0, v1, horizontal) => {
    const span = v1 - v0;
    for (let e = Math.floor(v0); e <= Math.ceil(v1); e++){
      for (let m = 1; m <= 9; m++){
        const lv = e + Math.log10(m);
        if (lv < v0 - 1e-9 || lv > v1 + 1e-9) continue;
        const val = m * Math.pow(10, e), major = m === 1;
        const lab = major || span <= 1 || (span <= 2.2 && (m === 2 || m === 5));
        if (horizontal){
          const y = Y(val);
          g.push(`<line x1="${M.l}" x2="${M.l + PW}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? c1 : c2}" stroke-width="${major ? 1 : .8}"/>`);
          if (lab) g.push(`<text x="${M.l - 7}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${major ? ink : mut}">${fmtAxis(val)}</text>`);
        } else {
          const x = X(val);
          g.push(`<line y1="${M.t}" y2="${M.t + PH}" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" stroke="${major ? c1 : c2}" stroke-width="${major ? 1 : .8}"/>`);
          if (lab) g.push(`<text x="${x.toFixed(1)}" y="${M.t + PH + 16}" text-anchor="middle" font-size="11" fill="${major ? ink : mut}">${fmtAxis(val)}</text>`);
        }
      }
    }
  };
  ticks(V.x0, V.x1, false); ticks(V.y0, V.y1, true);
  return g.join("");
}

function render(){
  if (!RENDER_FORCE && typeof renderResumo === "function") renderResumo();
  const r = RENDER_FORCE || wrap.getBoundingClientRect();
  W = Math.max(300, r.width); H = Math.max(260, r.height);
  PW = W - M.l - M.r; PH = H - M.t - M.b;
  scales(); computeModels();
  const ink = tok("--axis"), plot = tok("--plot"), acc = tok("--accent");
  const out = [];
  out.push(`<defs><clipPath id="clipP"><rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}"/></clipPath></defs>`);
  out.push(`<rect width="${W}" height="${H}" fill="${plot}"/>`);
  out.push(gridSVG());
  out.push(`<g clip-path="url(#clipP)">`);
  // 1) faixas (tolerância, fusão–total)
  MODEL_CACHE.forEach(({ d, m }) => m.bands.forEach(b => {
    out.push(`<path d="${pathOf(b.up.concat(b.lo.slice().reverse()))}Z" fill="${d.color}" fill-opacity=".14" stroke="none"/>`);
  }));
  // 2) linhas verticais (as de curto-circuito sobem da base do gráfico até v.tEnd; as demais cruzam o gráfico inteiro)
  MODEL_CACHE.forEach(({ d, m }) => m.vls.forEach(v => {
    const x = X(v.I), yTop = v.tEnd ? Math.min(M.t + PH, Math.max(M.t, Y(v.tEnd))) : M.t, dash = v.dash ? `stroke-dasharray="${v.dash}"` : "";
    out.push(`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yTop.toFixed(1)}" y2="${M.t + PH}" stroke="${d.color}" stroke-width="1.5" ${dash}/>`);
    const xt = x + (v.side === "r" ? 14 : -4);
    if (v.tEnd){                       // rótulo paralelo à linha, a partir da base do gráfico; a fonte diminui se o texto não couber na altura da linha
      const hLinha = M.t + PH - yTop - 8, mc = (render.cv = render.cv || document.createElement("canvas")).getContext("2d");
      mc.font = "10px Arial, Helvetica, sans-serif";
      const fs = Math.max(8, Math.min(10, 10 * hLinha / Math.max(1, mc.measureText(v.label).width)));
      out.push(`<text transform="translate(${xt.toFixed(1)} ${(M.t + PH - 5 - (v.off || 0)).toFixed(1)}) rotate(-90)" text-anchor="start" font-size="${fs.toFixed(1)}" fill="${d.color}">${esc(v.label)}</text>`);
    }
    else out.push(`<text transform="translate(${xt.toFixed(1)} ${M.t + 8 + (v.off || 0)}) rotate(-90)" text-anchor="end" font-size="11" fill="${d.color}">${esc(v.label)}</text>`);
  }));
  // 3) curvas
  MODEL_CACHE.forEach(({ d, m }) => m.segs.forEach(sg => {
    out.push(`<path d="${pathOf(sg.pts)}" fill="none" stroke="${sg.color || d.color}" stroke-width="${sg.w || 2}" ${sg.op ? `stroke-opacity="${sg.op}"` : ""} ${sg.dash ? `stroke-dasharray="${sg.dash}"` : ""} stroke-linejoin="round" stroke-linecap="round"/>`);
  }));
  // 4) pontos (rótulos verticais abaixo do símbolo; pontos sobrepostos têm o rótulo deslocado, com linha de chamada)
  const PT = [];
  MODEL_CACHE.forEach(({ d, m }) => m.pts.forEach(p => PT.push({ d, p, x: X(p.I), y: Y(p.t) })));
  const grp = [];
  PT.forEach(o => { if (!o.p.vert){ o.k = 0; return; } const g = grp.find(q => Math.abs(q.x - o.x) < 12 && Math.abs(q.y - o.y) < 12); if (g){ o.k = g.n++; } else { grp.push({ x: o.x, y: o.y, n: 1 }); o.k = 0; } });
  // amostras (em pixels) das curvas desenhadas, para os rótulos não ficarem em cima delas
  const AM = [];
  MODEL_CACHE.forEach(({ m }) => m.segs.forEach(sg => {
    for (let i = 1; i < sg.pts.length; i++){
      const x0 = X(sg.pts[i - 1][0]), y0 = Y(sg.pts[i - 1][1]), x1 = X(sg.pts[i][0]), y1 = Y(sg.pts[i][1]);
      if (![x0, y0, x1, y1].every(isFinite)) continue;
      const n = Math.min(400, Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2)));
      for (let j = 0; j <= n; j++) AM.push([x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n]);
    }
  }));
  const mcv = (render.cv = render.cv || document.createElement("canvas")).getContext("2d"); mcv.font = "10px Arial, Helvetica, sans-serif";
  const colide = r => AM.some(([ax, ay]) => ax >= r[0] - 2 && ax <= r[2] + 2 && ay >= r[1] - 2 && ay <= r[3] + 2);
  const sobre = (r, q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1];
  const colocados = [];
  PT.forEach(({ d, p, x, y, k }) => {
    out.push(`<path d="M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z" fill="${d.color}" stroke="${plot}" stroke-width="1.2"/>`);
    if (!p.vert){ out.push(`<text x="${(x + 9).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" fill="${d.color}">${esc(p.label)}</text>`); return; }
    const L = mcv.measureText(p.label).width;
    // candidatos: abaixo ou acima do símbolo, deslocados para os lados em passos de 14 px (com linha de chamada); fica o primeiro sem cruzar curva nem outro rótulo
    let esc1 = null, melhor = null;
    const extras = [0, 14, -14, 28, -28, 42, -42, 56, -56];
    for (const lado of (k ? [1, -1] : [1, -1])) for (const ex of extras){
      const dx = k * 16 + ex, tx = x + dx + 3.5, ty = lado > 0 ? y + 10 + (dx ? 8 : 0) : y - 10 - (dx ? 8 : 0);
      const r = lado > 0 ? [tx - 9, ty, tx + 3, ty + L] : [tx - 9, ty - L, tx + 3, ty];
      if (r[0] < M.l || r[2] > M.l + PW || r[1] < M.t || r[3] > M.t + PH) continue;
      if (colide(r) || colocados.some(q => sobre(r, q))) continue;
      esc1 = { dx, tx, ty, lado, r }; break;
    }
    if (!esc1){ const dx = k * 16, tx = x + dx + 3.5, ty = y + 10 + (dx ? 8 : 0); esc1 = { dx, tx, ty, lado: 1, r: [tx - 9, ty, tx + 3, ty + L] }; }   // sem espaço livre: posição padrão
    colocados.push(esc1.r);
    if (esc1.dx) out.push(`<polyline points="${x.toFixed(1)},${(y + esc1.lado * 6).toFixed(1)} ${(x + esc1.dx).toFixed(1)},${(y + esc1.lado * 14).toFixed(1)} ${(x + esc1.dx).toFixed(1)},${(esc1.ty - esc1.lado).toFixed(1)}" fill="none" stroke="#111827" stroke-width=".8"/>`);
    out.push(`<text transform="translate(${esc1.tx.toFixed(1)} ${esc1.ty.toFixed(1)}) rotate(-90)" text-anchor="${esc1.lado > 0 ? "end" : "start"}" font-size="10" fill="#111827">${esc(p.label)}</text>`);
  });
  out.push(`</g>`);
  out.push(`<rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" fill="none" stroke="${ink}" stroke-width="1.2"/>`);
  out.push(`<text x="${M.l + PW / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="${ink}">Corrente (A)${S.baseKV > 0 ? " · base " + ptbr(S.baseKV) + " kV" : ""}</text>`);
  out.push(`<text transform="translate(15 ${M.t + PH / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="${ink}">Tempo (s)</text>`);
  if (!MODEL_CACHE.length) out.push(`<text x="${M.l + PW / 2}" y="${M.t + PH / 2}" text-anchor="middle" font-size="13" fill="${tok("--muted")}">${ALL_MODELS.length ? "Todas as curvas estão ocultas. Use o filtro abaixo do gráfico." : "Nenhuma função desta visão está habilitada ou preenchida."}</text>`);
  // 6) legenda
  if (S.legend){
    const items = ALL_MODELS.filter(({ m }) => listed(m) && !m.noLegend && (m.legend || m.segs.length || m.pts.length || m.vls.length));
    if (items.length){
      const FS = 10.5, RH = 15, mc = (render.cv = render.cv || document.createElement("canvas")).getContext("2d");
      mc.font = FS + "px Arial, Helvetica, sans-serif";                                   // mede o texto de verdade: o quadro acompanha o maior nome
      const tw = Math.max(...items.map(({ d }) => mc.measureText(d.name).width));
      const w = Math.min(PW - 20, Math.ceil(tw) + 58), h = items.length * RH + 8;
      const x0 = M.l + PW - w - 10, y0 = M.t + 10;
      out.push(`<g><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="4" fill="${plot}" fill-opacity=".92" stroke="${tok("--line")}"/>`);
      items.forEach(({ d, m }, i) => {
        const y = y0 + 14 + i * RH;
        if (!m.segs.length && !m.vls.length && m.pts.length){
          const cx = x0 + 25, cy = y - 3.5;
          out.push(`<path d="M${cx} ${cy - 5}L${cx + 5} ${cy}L${cx} ${cy + 5}L${cx - 5} ${cy}Z" fill="${d.color}" stroke="${plot}" stroke-width="1"/><text x="${x0 + 48}" y="${y}" font-size="10.5" fill="${ink}">${esc(d.name)}</text>`);
          return;
        }
        const dsh = d.dash ? `stroke-dasharray="${d.dash}"` : "", marc = m.vls.length > 0;
        out.push(`<line x1="${x0 + 8}" x2="${x0 + 42}" y1="${y - 3.5}" y2="${y - 3.5}" stroke="${d.color}" stroke-width="${marc ? 2 : 3}" ${dsh}/><text x="${x0 + 48}" y="${y}" font-size="10.5" fill="${ink}">${esc(d.name)}</text>`);
      });
      out.push(`</g>`);
    }
  }
  out.push(`<g id="cross" style="display:none"><line id="cx" y1="${M.t}" y2="${M.t + PH}" stroke="${ink}" stroke-opacity=".55" stroke-dasharray="2 3"/><line id="cy" x1="${M.l}" x2="${M.l + PW}" stroke="${ink}" stroke-opacity=".55" stroke-dasharray="2 3"/><circle id="dc" r="5" display="none" stroke="${plot}" stroke-width="1.5"/><circle id="dk" r="5" display="none" stroke="${plot}" stroke-width="1.5"/></g>`);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = out.join("");
  syncAxisInputs();
}

function syncAxisInputs(){
  const a = S.axes;
  [["imin", a.imin], ["imax", a.imax], ["tmin", a.tmin], ["tmax", a.tmax]].forEach(([k, v]) => {
    const el = $("#" + k); if (document.activeElement !== el) el.value = +v.toPrecision(4);
  });
}

/* ---------- interação: zoom, pan, clique, cursor ---------- */
let drag = null;
const localXY = e => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const inPlot = (x, y) => x >= M.l && x <= M.l + PW && y >= M.t && y <= M.t + PH;
function setAxes(x0, x1, y0, y1){
  S.axes = { imin: Math.pow(10, x0), imax: Math.pow(10, x1), tmin: Math.pow(10, y0), tmax: Math.pow(10, y1) };
}
function resetAxes(){ S.axes = { ...AXES0 }; render(); touch(); }

svg.addEventListener("pointerdown", e => {
  const [x, y] = localXY(e); if (!inPlot(x, y)) return;
  drag = { x, y, v: { ...V }, moved: false };
  svg.setPointerCapture(e.pointerId);
});
svg.addEventListener("pointermove", e => {
  const [x, y] = localXY(e);
  if (drag){
    const dx = x - drag.x, dy = y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved){
      const ddx = dx / PW * (drag.v.x1 - drag.v.x0), ddy = dy / PH * (drag.v.y1 - drag.v.y0);
      setAxes(drag.v.x0 - ddx, drag.v.x1 - ddx, drag.v.y0 + ddy, drag.v.y1 + ddy);
      render(); hover(x, y); return;
    }
  }
  hover(x, y);
});
svg.addEventListener("pointerup", e => {
  if (drag && !drag.moved){
    /* clique simples: sem ação por enquanto */
  } else if (drag) touch();
  drag = null;
});
svg.addEventListener("pointerleave", () => { const c = $("#cross"); if (c) c.style.display = "none"; tip.style.display = "none"; });
svg.addEventListener("dblclick", resetAxes);
svg.addEventListener("wheel", e => {
  const [x, y] = localXY(e); if (!inPlot(x, y)) return;
  e.preventDefault();
  const f = Math.exp(clamp(e.deltaY, -200, 200) * 0.0015);
  const cx = V.x0 + (x - M.l) / PW * (V.x1 - V.x0), cy = V.y1 - (y - M.t) / PH * (V.y1 - V.y0);
  const nx0 = cx + (V.x0 - cx) * f, nx1 = cx + (V.x1 - cx) * f, ny0 = cy + (V.y0 - cy) * f, ny1 = cy + (V.y1 - cy) * f;
  if (nx1 - nx0 < 0.2 || ny1 - ny0 < 0.2 || nx1 - nx0 > 14 || ny1 - ny0 > 14) return;
  setAxes(nx0, nx1, ny0, ny1); render(); touch();
}, { passive: false });

function hover(x, y){
  const cross = $("#cross"); if (!cross) return;
  if (!inPlot(x, y)){ cross.style.display = "none"; tip.style.display = "none"; return; }
  cross.style.display = "";
  $("#cx").setAttribute("x1", x); $("#cx").setAttribute("x2", x);
  $("#cy").setAttribute("y1", y); $("#cy").setAttribute("y2", y);
  const I = IX(x), t = TY(y);
  let h = `<div class="h">I = ${fmt(I)} A · t = ${fmt(t)} s</div>`;
  // variação de tempo entre a curva resultante da concessionária e a do cliente, na mesma corrente
  const rc = ALL_MODELS.find(({ m }) => m.key === "res:c" && listed(m)), rk = ALL_MODELS.find(({ m }) => m.key === "res:k" && listed(m));
  const tc = rc ? rc.m.tAt(I) : Infinity, tk = rk ? rk.m.tAt(I) : Infinity;
  const dt = isFinite(tc) && isFinite(tk) ? tk - tc : null;
  const fs = v => isFinite(v) ? fmt(v) + " s" : "—";
  const dot = (id, cur, t) => { const el = $("#" + id); if (!el) return; if (cur && isFinite(t)){ el.setAttribute("cx", x); el.setAttribute("cy", Y(t)); el.setAttribute("fill", cur.d.color); el.setAttribute("display", "inline"); } else el.setAttribute("display", "none"); };
  dot("dc", rc, tc); dot("dk", rk, tk);
  h += `<div class="r"><i style="background:${rc ? rc.d.color : "transparent"}"></i><span>Tempo cliente</span><em>${fs(tc)}</em></div>`;
  h += `<div class="r"><i style="background:${rk ? rk.d.color : "transparent"}"></i><span>Tempo concessionária</span><em>${fs(tk)}</em></div>`;
  h += `<div class="r"><i style="background:transparent"></i><span><b>Δt (Concessionária − Cliente)</b></span><em><b>${dt == null ? "—" : Math.abs(dt) < 1e-9 ? "0 s" : (dt > 0 ? "+" : "−") + fmt(Math.abs(dt)) + " s"}</b></em></div>`;
  tip.innerHTML = h; tip.style.display = "block";
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = (x + 16 + tw > W ? x - tw - 14 : x + 16) + "px";
  tip.style.top = (y + 16 + th > H ? y - th - 14 : y + 16) + "px";
}
