/* direcional.js — representação gráfica da função 67 (área de cálculo da aba "Ordem de ajuste de proteção").
   Diagrama fasorial: V_pol como referência (0°), reta do ângulo de torque máximo (MTA), região de operação (semiplano de ±90° em torno do MTA)
   e região de restrição (o semiplano oposto), mais os fasores das correntes de curto-circuito, da carga e da geração.
   Ligação em quadratura (90°): para a corrente da fase A, V_pol = V_BC. A tensão da fase A está 90° adiantada de V_BC;
   a corrente de curto atrasa a tensão da fase pelo ângulo da impedância (φ = atan(X1/R1)); logo, em relação a V_pol,
   a corrente de curto fica adiantada de 90° − φ. A carga (kVA dos transformadores) tem fp 0,9 indutivo: a corrente atrasa a tensão da fase de 25,8°, ficando adiantada de 90° − 25,8° = 64,2° em relação a V_pol; a geração (kW, sem reativo: fp 1) exportando fica a 270° de V_pol, no sentido oposto ao da carga.
   O comprimento dos fasores segue escala logarítmica (as correntes diferem em ordens de grandeza). S.dirSentido: "ccw" (padrão, como na figura de referência) ou "cw". */
"use strict";

const DIR_COR = { icc3: "#B42318", icc2: "#C2650A", carga: "#1F77B4", ger: "#7C3AED", pol: "#0F2747", mta: "#0F2747" };

function dirFasores(){
  const v = typeof iccEstudo === "function" ? iccEstudo() : {}, D = demCalc(), xr = typeof xrRede === "function" ? xrRede() : null;
  const phi = xr ? Math.atan(xr) * 180 / Math.PI : null, phiUsado = phi != null ? phi : 75, th = 90 - phiUsado;       // ângulo da corrente de curto em relação a V_pol
  const L = [];
  const add = (id, nome, curto, I, ang) => { if (typeof I === "number" && isFinite(I) && I > 0) L.push({ id, nome, curto, I, ang }); };
  add("icc3", "Icc trifásica", "Icc 3F", v.i3, th);
  add("icc2", "Icc bifásica", "Icc 2F", v.i2, th);
  // carga: potência dos transformadores (kVA) → fator de potência 0,9 indutivo: a corrente atrasa a tensão da fase em acos(0,9) = 25,8°, ou seja, 90° − 25,8° de V_pol.
  // A geração (kW, sem reativo: fp 1) exportando tem sentido oposto ao da carga com fp 1: 90° + 180° = 270° de V_pol.
  let itot = null, kvaT = 0; try { itot = tcCalc().itot; } catch (e) {}
  S.trafos.slice(0, Math.max(1, Math.min(TR_MAX, S.nTrafos || 1))).forEach(t => { kvaT += t.kva > 0 ? t.kva : 0; });
  const fpC = 0.9, phiC = Math.acos(fpC) * 180 / Math.PI, angC = 90 - phiC;
  add("carga", `Carga: transformadores (${fmtN(kvaT)} kVA, fp 0,9 ind.)`, "Carga", itot, angC);
  // geração: potência de geração (kW) ÷ √3 ÷ kV de base. Em kW não há reativo: fp 1. Exportando, a corrente está em oposição de fase à tensão (fp 1 no sentido contrário): 90° + 180° = 270° de V_pol
  const dm = S.dem || {}, iG = dm.pger > 0 && D.V ? dm.pger / (Math.sqrt(3) * D.V) : null;
  const avisos = [];
  if (!(itot > 0)) avisos.push("Vetor de carga não exibido: informe a potência e a tensão dos transformadores (Dados da instalação).");
  if (!D.ger) avisos.push("Vetor de geração não exibido: a finalidade do estudo é só consumo (Página inicial).");
  else if (!iG) avisos.push("Vetor de geração não exibido: informe a potência de geração em Dados da instalação.");
  const avisoGer = avisos.join(" ");
  if (D.ger && iG) add("ger", `Geração: ${fmtN(dm.pger)} kW (fp 1, sentido oposto ao da carga)`, "Geração", iG, 270);
  return { L, phi, phiUsado, th, phiC: phiC, angC: angC, avisoGer };
}

function dirDiagrama(stKey){
  const F = S.cliente.funcs["67"], st = F[stKey], rev = st.dir === "reversa", cw = S.dirSentido === "cw", sg = cw ? -1 : 1;
  const mtaInformado = st.ang != null && isFinite(st.ang), mta = mtaInformado ? st.ang : 45;
  const { L, phi, phiUsado, th, phiC, angC, avisoGer } = dirFasores();
  const CX = 200, CY = 200, RD = 168, RV = 150, uid = "d67" + stKey;
  const P = (b, r) => [CX + r * Math.cos(sg * b * Math.PI / 180), CY - r * Math.sin(sg * b * Math.PI / 180)];   // b em graus a partir de V_pol (sentido ccw, ou cw se invertido)
  const f1 = n => n.toFixed(1);
  // escala logarítmica dos comprimentos (fasores e anéis de pickup)
  const vals = L.map(x => x.I).concat(st.ip > 0 ? [st.ip] : []);
  const lo = Math.min(...vals) / 1.6, hi = Math.max(...vals) * 1.02, rad = I => vals.length < 2 || hi <= lo ? RV * 0.7 : 24 + (RV - 24) * (Math.log10(I) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  const op = rev ? mta + 180 : mta;                  // centro da região de operação
  const [ax, ay] = P(op - 90, RD), [bx, by] = P(op + 90, RD), [cx2, cy2] = P(op + 270, RD);
  const swp = cw ? 1 : 0;
  const semi = (a0, a1) => { const [x0, y0] = P(a0, RD), [x1, y1] = P(a1, RD); return `M${CX} ${CY} L${f1(x0)} ${f1(y0)} A${RD} ${RD} 0 0 ${swp} ${f1(x1)} ${f1(y1)} Z`; };
  let o = `<svg class="dirsvg" viewBox="0 0 400 400" role="img" aria-label="Diagrama fasorial da função 67">
    <defs><pattern id="${uid}h" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#fff"/><rect width="4.5" height="9" fill="#F4B6B0"/></pattern>
    ${["pol", "mta", "icc3", "icc2", "carga", "ger"].map(k => `<marker id="${uid}-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${DIR_COR[k]}"/></marker>`).join("")}</defs>`;
  o += `<circle cx="${CX}" cy="${CY}" r="${RD}" fill="#fff"/>`;
  o += `<path d="${semi(op - 90, op + 90)}" fill="#7FCB9F" fill-opacity=".75"/><path d="${semi(op + 90, op + 270)}" fill="url(#${uid}h)"/>`;
  o += `<line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(cx2 === ax ? bx : bx)}" y2="${f1(by)}" stroke="#333" stroke-width="1.6"/>`;   // fronteira (perpendicular ao MTA)
  // escala angular a cada 10°, números a cada 30° (ângulo a partir de V_pol)
  for (let d = 0; d < 360; d += 10){
    const big = d % 30 === 0, [x0, y0] = P(d, RD), [x1, y1] = P(d, RD + (big ? 9 : 5));
    o += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="#555" stroke-width="${big ? 1.2 : .7}"/>`;
    if (big){ const [tx, ty] = P(d, RD + 20); o += `<text x="${f1(tx)}" y="${f1(ty + 3.5)}" text-anchor="middle" class="dir-n">${d}°</text>`; }
  }
  o += `<circle cx="${CX}" cy="${CY}" r="${RD}" fill="none" stroke="#555" stroke-width="1.2"/>`;
  // anéis de pickup (corrente abaixo do anel não atua, mesmo dentro da região de operação)
  if (st.ip > 0){ const r = rad(st.ip); o += `<circle cx="${CX}" cy="${CY}" r="${f1(r)}" fill="none" stroke="#0F2747" stroke-width="1.2" stroke-dasharray="2 3"/>`;
    const [tx, ty] = P(op - 90 + 16, r); o += `<text x="${f1(tx)}" y="${f1(ty)}" class="dir-s" text-anchor="middle">Ip ${fmtN(st.ip)} A</text>`; }
  // eixo do MTA (tracejado, atravessando o centro) e arco do ângulo
  const [m0x, m0y] = P(mta, RD - 4), [m1x, m1y] = P(mta + 180, RD - 4);
  o += `<line x1="${f1(m1x)}" y1="${f1(m1y)}" x2="${f1(m0x)}" y2="${f1(m0y)}" stroke="${DIR_COR.mta}" stroke-width="1.5" stroke-dasharray="7 4"/>`;
  const [r0x, r0y] = P(0, 62), [r1x, r1y] = P(mta, 62);
  o += `<path d="M${f1(r0x)} ${f1(r0y)} A62 62 0 0 ${swp} ${f1(r1x)} ${f1(r1y)}" fill="none" stroke="${DIR_COR.mta}" stroke-width="1.3"/>`;
  const [lx, ly] = P(mta / 2, 82); o += `<text x="${f1(lx)}" y="${f1(ly + 4)}" text-anchor="middle" class="dir-t">${showNum(mta)}°</text>`;
  const [mtx, mty] = P(mta, RD - 26); o += `<text x="${f1(mtx)}" y="${f1(mty)}" text-anchor="middle" class="dir-s" transform="rotate(${f1(-sg * mta + (Math.cos(sg * mta * Math.PI / 180) < 0 ? 180 : 0))} ${f1(mtx)} ${f1(mty)})" dy="-4">MTA</text>`;
  // V_pol (referência)
  const [vx, vy] = P(0, RV + 6);
  o += `<line x1="${CX}" y1="${CY}" x2="${f1(vx)}" y2="${f1(vy)}" stroke="${DIR_COR.pol}" stroke-width="3" marker-end="url(#${uid}-pol)"/><text x="${f1(vx - 6)}" y="${f1(vy - 9)}" text-anchor="end" class="dir-t">V<tspan dy="3" font-size="9">pol</tspan></text>`;
  // fasores de corrente
  const usados = [];
  L.forEach(x => {
    const r = rad(x.I), [tx, ty] = P(x.ang, r), c = DIR_COR[x.id];
    o += `<line x1="${CX}" y1="${CY}" x2="${f1(tx)}" y2="${f1(ty)}" stroke="${c}" stroke-width="2.4" marker-end="url(#${uid}-${x.id})"/>`;
    const n = usados.filter(a => Math.abs(a - x.ang) < 8).length; usados.push(x.ang);
    const [lx2, ly2] = P(x.ang, r + 14);
    o += `<text x="${f1(lx2)}" y="${f1(ly2 + 3.5 + n * 12)}" text-anchor="middle" class="dir-i" fill="${c}">${esc(x.curto)}</text>`;
  });
  o += `<circle cx="${CX}" cy="${CY}" r="3.5" fill="#000"/></svg>`;
  // quadro de leitura: cada fasor está na região de operação? passa do pickup?
  const dentro = ang => Math.cos((ang - op) * Math.PI / 180) > 0;
  const linhas = L.map(x => {
    const ok = dentro(x.ang), passa = st.ip > 0 ? x.I > st.ip : null;
    const res = !ok ? `<span class="tcs no">restrição · não atua</span>` : passa === false ? `<span class="tcs wn">operação, mas abaixo do Ip</span>` : passa ? `<span class="tcs ok">operação · atua</span>` : `<span class="tcs na">operação (sem Ip)</span>`;
    return `<tr><td><i class="dir-sw" style="background:${DIR_COR[x.id]}"></i>${esc(x.nome)}</td><td>${fmtN(x.I)} A</td><td>${showNum(Math.round(((x.ang % 360) + 360) % 360))}°</td><td>${res}</td></tr>`;
  }).join("");
  const titulo = `Estágios 1 e 2 · direção ${rev ? "reversa" : "frente"} · MTA ${showNum(mta)}°${mtaInformado ? "" : " (exemplo: ângulo não informado)"}`;
  return `<div class="dirbox"><p class="cq-t">${titulo}</p>${o}
    <div class="dirleg"><span><i class="dir-sw" style="background:#7FCB9F"></i>Região de operação</span><span><i class="dir-sw hat"></i>Região de restrição</span><span><i class="dir-sw line"></i>Eixo do MTA</span><span><i class="dir-sw dot"></i>Anel do pickup (Ip)</span></div>
    ${L.length ? `<table class="dirtab"><thead><tr><th>Fasor</th><th>Módulo</th><th>Ângulo de V<sub>pol</sub></th><th>Resultado</th></tr></thead><tbody>${linhas}</tbody></table>` : `<p class="fnote">Preencha as correntes de curto-circuito (Dados da Concessionária) e a demanda (Dados da instalação) para ver os fasores.</p>`}
    <p class="fnote">Carga: fp 0,9 indutivo (φ = ${showNum(Math.round(phiC * 10) / 10)}°) → ${showNum(Math.round(angC * 10) / 10)}° de V<sub>pol</sub>${S.info.fin !== "consumo" ? `; geração: 270° (fp 1, sentido oposto ao da carga)` : ""}.${avisoGer ? ` <b>${avisoGer}</b>` : ""}</p>
    <p class="fnote">${phi != null ? `Ângulo da corrente de curto: 90° − φ = 90° − ${showNum(Math.round(phi * 10) / 10)}° = <b>${showNum(Math.round(th * 10) / 10)}°</b> em relação a V<sub>pol</sub> (φ = atan(X<sub>1</sub>/R<sub>1</sub>) da rede).` : `Impedâncias da rede não informadas: ângulo da corrente de curto estimado em 90° − 75° = 15° (φ assumido em 75°).`}</p></div>`;
}

function dirDiagramaHTML(){
  const F = S.cliente.funcs["67"]; if (!F || !F.en) return "";
  const est = ["s1"];                                // o estágio 2 usa o mesmo diagrama
  return `<div class="cq dirwrap"><div class="dirhead"><p class="cq-t">Representação gráfica</p>
      <button type="button" class="btn sm" data-sentido="1" title="Alterna o sentido em que os ângulos são medidos (depende do fabricante do relé)">Ângulos: ${S.dirSentido === "cw" ? "horário" : "anti-horário"}</button></div>
    <p class="fnote">Atua quando a corrente passa do Ip e está a menos de 90° do eixo de torque máximo (MTA), isto é, na região de operação: torque ∝ |I| · |V<sub>pol</sub>| · cos(θ − MTA) &gt; 0. Ligação em quadratura: para a fase A, V<sub>pol</sub> = V<sub>BC</sub>. Comprimentos dos fasores em escala logarítmica. Confirme no manual do relé o sentido de medição do ângulo e a referência de V<sub>pol</sub>.</p>
    <div class="dirgrid">${est.map(dirDiagrama).join("")}</div></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-sentido]"); if (!b || !S) return;
  S.dirSentido = S.dirSentido === "cw" ? "ccw" : "cw"; touch(); renderCalc(true);
});
