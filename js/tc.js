/* tc.js — "Dimensionamento do TC de proteção" (aba Dados da instalação). Estado em S.tc.
   Verificação de saturação (método do usuário):
     V_SAT calculado = Icc_máx / RTC × Z_carga  ≤  V_SAT nominal (tensão da classe, ex.: 10B50 → 50 V)
     Z_carga = Z_fiação + Z_relé + Z_TC
     Z_fiação = Z_cabo (Ω/km) × distância (m) / 1000 × 2
     Z_relé = (VA_fase + 3 × VA_neutro) / I_secundária²
     Z_TC = Z_burden × 0,2  (Z_burden = 1 Ω)
   Icc_máx = maior curto de fase do estudo (trifásica assimétrica; se faltar, a simétrica). RTC = I primária ÷ I secundária.
   Relação: Icc_máx ÷ 20 ≤ Iptc ≤ Imín ÷ 0,1 (sugerida = menor padronizada ≥ Icc_máx ÷ 20). Obrigatório: só Icc_máx ÷ 20; Imín ÷ 0,1 é boa prática (aviso). Ith = 80 × In, Id = 2,5 × Ith (artigos Mesh Engenharia / NBR 6856). */
"use strict";

const TC_RTC = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000];
const TC_CLASSES = [50, 100, 200, 400, 800];            // tensão de saturação nominal da classe, V (10B50 … 10B800)
/* Nomenclatura da classe: antiga (NBR 6856: 10B50) e nova entre parênteses (S VA 10P20, S = Tensão de saturação × I secundária ÷ 20) */
const tcNovo = (v, sec) => ptbr((Math.round(v * sec / 20 * 10) / 10).toString()) + "VA10P20";
const tcNome = (v, sec) => `10B${v} (${tcNovo(v, sec)})`;
const TC_SENS = 0.1;                                    // critério de sensibilidade: corrente primária ≤ Imín ÷ 0,1
const TC_FATOR_TC = 0.2;                                // Impedância do TC = Z_burden × 0,2
const tcBlank = () => ({ fator: 1.2, sec: 5, rtc: null, classe: null, zc: 4.7, cL: 10, vaF: 0.3, vaN: 0.3, zbur: 1, imin: null });
function tcNormalize(t){
  const o = tcBlank(); t = t || {};
  if (t.fator > 0) o.fator = t.fator;
  if (t.sec === 1) o.sec = 1;
  if (t.rtc > 0) o.rtc = t.rtc;
  if (TC_CLASSES.includes(t.classe)) o.classe = t.classe;
  ["zc", "cL", "vaF", "vaN", "zbur"].forEach(k => { if (t[k] >= 0 && t[k] != null) o[k] = t[k]; });
  if (t.imin > 0) o.imin = t.imin;
  return o;
}

function tcCalc(){
  const T = S.tc, r = {};
  const n = Math.max(1, Math.min(TR_MAX, S.nTrafos || 1)); let s = 0, ok = false;
  S.trafos.slice(0, n).forEach(t => { const c = trafoCalc(t); if (c.in1 != null){ s += c.in1 * (t.v1 > 0 && S.baseKV > 0 ? t.v1 / S.baseKV : 1); ok = true; } });
  r.itot = ok ? s : null;
  const v = typeof iccEstudo === "function" ? iccEstudo() : {}, pos = x => typeof x === "number" && isFinite(x) && x > 0;
  r.icc = pos(v.i3a) ? v.i3a : pos(v.i3) ? v.i3 : null; r.iccAssim = pos(v.i3a);
  r.ia = r.itot != null ? r.itot * T.fator : null;
  r.ib = r.icc != null ? r.icc / 20 : null;
  const alvo = r.ib || 0;
  r.sug = alvo > 0 ? (TC_RTC.find(x => x >= alvo) || Math.ceil(alvo / 100) * 100) : null;      // menor relação padronizada ≥ Icc máx ÷ 20 (obrigatório)
  r.ipn = T.rtc > 0 ? T.rtc : r.sug;
  r.rtc = r.ipn > 0 ? r.ipn / T.sec : null;
  r.erro20 = T.rtc > 0 && r.ib != null && T.rtc < r.ib;          // corrente primária informada abaixo de Icc máx ÷ 20
  r.auto = !(T.rtc > 0);
  r.zfio = T.zc / 1000 * T.cL * 2;
  r.zrele = (T.vaF + 3 * T.vaN) / (T.sec * T.sec);
  r.ztc = T.zbur * TC_FATOR_TC;
  r.zcarga = r.zfio + r.zrele + r.ztc;
  r.vsat = r.icc != null && r.rtc ? r.icc / r.rtc * r.zcarga : null;
  r.classeAuto = !T.classe && r.vsat != null ? (TC_CLASSES.find(x => x >= r.vsat) || null) : null;
  r.vnom = T.classe || r.classeAuto;
  // sensibilidade: corrente primária do TC ≤ corrente de partida do neutro (51N) do cliente ÷ 0,1
  const fn = id => { const f = S.cliente && S.cliente.funcs && S.cliente.funcs[id]; return f && f.en && f.s1 && f.s1.ip > 0 ? f.s1.ip : null; };
  r.iminAuto = fn("51N") != null ? fn("51N") : fn("51");          // padrão: partida do 51N do cliente (a menor); sem 51N, a do 51
  r.iminSrc = fn("51N") != null ? "51N" : fn("51") != null ? "51" : null;
  r.imin = T.imin > 0 ? T.imin : r.iminAuto;
  // faixa admissível da corrente primária do TC:  Icc máx ÷ 20  ≤  Iptc  ≤  Imín ÷ 0,1
  r.faixaMin = r.ib; r.faixaMax = r.imin != null ? r.imin / TC_SENS : null;
  r.faixaVazia = r.faixaMin != null && r.faixaMax != null && r.faixaMin > r.faixaMax;
  r.foraFaixa = r.sug != null && r.faixaMax != null && r.sug > r.faixaMax;
  r.erroMax = T.rtc > 0 && r.faixaMax != null && T.rtc > r.faixaMax;
  if (r.ipn > 0){ r.lim10 = TC_SENS * r.ipn; r.ipnMax = r.imin != null ? r.imin / TC_SENS : null; r.okSens = r.ipnMax != null ? r.ipn <= r.ipnMax : null; }
  if (r.ipn > 0){ r.ith = 80 * r.ipn; r.id = 2.5 * r.ith; }
  return r;
}

const tcF = (n, d = 2) => n == null || !isFinite(n) ? "—" : ptbr((Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toString());
const tcAt = ok => ok == null ? '<span class="tcs na">—</span>' : ok ? '<span class="tcs ok">✓ Atende</span>' : '<span class="tcs wn">⚠ Atenção</span>';   // boa prática: não é erro
const tcAb = { res: false, med: false };           // blocos recolhidos por padrão
const tcMoreBtn = k => `<button type="button" class="tcmore" data-fold="${k}" aria-expanded="${tcAb[k]}" aria-controls="tcfold-${k}">${tcAb[k] ? "VER MENOS ▴" : "VER MAIS ▾"}</button>`;
const tcSt = ok => ok == null ? '<span class="tcs na">—</span>' : ok ? '<span class="tcs ok">✓ Atende</span>' : '<span class="tcs no">✗ Não atende</span>';

/* Diagrama didático: TC com o primário (Icc), a RTC e o circuito do secundário (um retângulo: impedância do TC no lado de cima,
   dos condutores no lado direito e do relé embaixo); a tensão de saturação aparece entre os terminais. */
function tcDiagrama(r){
  const T = S.tc, W = 820, H = 424, cx = 262, cy = 177, R = 70, fm = (n, d) => tcF(n, d);
  const ok = r.vsat != null ? (r.vnom ? r.vsat <= r.vnom : false) : null, cl = ok === false ? "no" : "ok";
  const box = (x, y, w, h, val, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" class="dg-b ${c || ""}"/><text x="${x + w / 2}" y="${y + h / 2 + 7}" text-anchor="middle" class="dg-n ${c || ""}">${val}</text>`;
  const lab = (x, y, l1, l2, anc) => `<text x="${x}" y="${y}" text-anchor="${anc || "middle"}" class="dg-t"><tspan x="${x}">${l1}</tspan><tspan x="${x}" dy="15">${l2}</tspan></text>`;
  let o = `<svg class="tcsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagrama do TC com o circuito do secundário">
  <defs><marker id="dgA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dg-ar"/></marker></defs>`;
  // núcleo e voltas do secundário
  o += `<circle cx="${cx}" cy="${cy}" r="${R}" class="dg-core" style="stroke-width:30"/><circle cx="${cx}" cy="${cy}" r="${R + 15}" class="dg-ring"/><circle cx="${cx}" cy="${cy}" r="${R - 15}" class="dg-ring"/>`;
  [-10, 0, 10].forEach(d => o += `<circle cx="${cx}" cy="${cy}" r="${R + d}" class="dg-lam"/>`);
  const pt = a => [cx + R * Math.cos(a * Math.PI / 180), cy + R * Math.sin(a * Math.PI / 180)];
  for (let i = 0; i < 8; i++){ const a = -58 + i * 116 / 7; const [x, y] = pt(a); o += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="22" ry="5.5" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})" class="dg-coil"/>`; }
  const [tx, ty] = pt(-58), [bx, by] = pt(58), TOPY = 50, BOTY = 304, XT = 394, XR = 752, XM = (XT + XR) / 2, YM = (TOPY + BOTY) / 2;
  o += `<path d="M${(tx + 18).toFixed(1)} ${(ty - 12).toFixed(1)} L${XT} ${TOPY}" class="dg-w"/><path d="M${(bx + 18).toFixed(1)} ${(by + 12).toFixed(1)} L${XT} ${BOTY}" class="dg-w"/>`;
  o += `<circle cx="${XT}" cy="${TOPY}" r="4" class="dg-dot"/><circle cx="${XT}" cy="${BOTY}" r="4" class="dg-dot"/>`;
  // primário: entra pelo furo do núcleo, antes das voltas do secundário
  // enrolamento primário (poucas voltas, lado esquerdo do núcleo) alimentado pela corrente de curto
  for (const a of [147, 169, 191, 213]){ const [x, y] = pt(a); o += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="22" ry="5.5" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})" class="dg-coil"/>`; }
  o += lab(8, cy - 56, "Corrente de curto", "máxima [A]", "start") + box(8, cy - 24, 104, 48, fm(r.icc, 0));
  o += `<path d="M112 ${cy} H${cx - R - 26}" class="dg-p" marker-end="url(#dgA)"/><text x="${(112 + cx - R - 26) / 2}" y="${cy - 8}" text-anchor="middle" class="dg-s">primário</text>`;
  o += `<text x="${cx - 6}" y="${cy - 40}" text-anchor="middle" class="dg-t">RTC</text>` + box(cx - 38, cy - 33, 64, 30, fm(r.rtc, 1));
  o += `<text x="${cx - 6}" y="${cy + 10}" text-anchor="middle" class="dg-s">${r.ipn ? fm(r.ipn, 0) + " ÷ " + T.sec : ""}</text>`;
  o += lab(8, cy + 44, "Corrente nominal", "da instalação [A]", "start") + box(8, cy + 76, 104, 48, fm(r.itot, 1));
  // circuito do secundário: retângulo com as três impedâncias centradas nos lados
  o += `<path d="M${XT} ${TOPY} H${XR} V${BOTY} H${XT}" class="dg-w"/>`;
  o += `<text x="${XM}" y="${TOPY - 38}" text-anchor="middle" class="dg-t">Impedância do TC [Ω]</text><text x="${XM}" y="${TOPY - 24}" text-anchor="middle" class="dg-s">burden × 0,2</text>` + box(XM - 48, TOPY - 20, 96, 40, fm(r.ztc, 3));
  o += lab(XR - 58, YM - 12, "Impedância dos", "condutores [Ω]", "end") + `<text x="${XR - 58}" y="${YM + 24}" text-anchor="end" class="dg-s">${fm(T.zc, 2)} Ω/km × ${fm(T.cL, 1)} m × 2</text>` + box(XR - 48, YM - 20, 96, 40, fm(r.zfio, 3));
  o += box(XM - 48, BOTY - 20, 96, 40, fm(r.zrele, 3)) + `<text x="${XM}" y="${BOTY + 38}" text-anchor="middle" class="dg-t">Impedância do relé [Ω]</text><text x="${XM}" y="${BOTY + 53}" text-anchor="middle" class="dg-s">(${fm(T.vaF, 2)} + 3 × ${fm(T.vaN, 2)}) VA ÷ ${T.sec}²</text>`;
  // tensão de saturação: seta dupla entre os terminais, ligada à caixa por um traço
  const XA = XT + 24;
  o += `<path d="M${XT} ${BOTY - 5} V${TOPY + 5}" class="dg-p" marker-end="url(#dgA)" marker-start="url(#dgA)"/><path d="M${XT} ${YM + 14} H${XA + 20}" class="dg-d"/>`;
  o += lab(XA + 75, YM - 30, "Tensão de saturação", "calculada [V]") + box(XA + 20, YM - 8, 110, 44, fm(r.vsat, 1), cl);
  // identificação do TC
  const tag = (x, w, t, u) => `<rect x="${x}" y="376" width="${w}" height="32" rx="5" class="dg-tag"/><text x="${x + w / 2}" y="397" text-anchor="middle" class="dg-tg">${t}${u ? ` <tspan class="dg-tu">${u}</tspan>` : ""}</text>`;
  o += `<text x="8" y="397" class="dg-s">TC adotado</text>` + tag(90, 100, r.ipn ? fm(r.ipn, 0) : "—", "A") + tag(200, 120, r.vnom ? tcNovo(r.vnom, T.sec).replace("VA10P20", "") : "—", "VA") + tag(330, 110, r.vnom ? "10 P 20" : "—", "") + tag(450, 80, String(T.sec), "A");
  return o + "</svg>";
}
/* Passo a passo (ao lado do diagrama) */
function tcPassos(r){
  const fm = (n, d) => tcF(n, d), isec = r.icc != null && r.rtc ? r.icc / r.rtc : null, ok = r.vsat != null ? (r.vnom ? r.vsat <= r.vnom : false) : null;
  return `<aside class="tcpas"><h5>Impedância total secundária</h5><ol>
    <li><b>Corrente no secundário</b><span>Icc ÷ RTC = ${fm(r.icc, 0)} ÷ ${fm(r.rtc, 1)}</span><em>${fm(isec, 1)} A</em></li>
    <li><b>Impedância de carga</b><span>condutores + relé + TC = ${fm(r.zfio, 3)} + ${fm(r.zrele, 3)} + ${fm(r.ztc, 3)}</span><em>${fm(r.zcarga, 3)} Ω</em></li>
    <li><b>Tensão de saturação calculada</b><span>corrente no secundário × impedância de carga = ${fm(isec, 1)} × ${fm(r.zcarga, 3)}</span><em class="${ok === false ? "no" : ""}">${fm(r.vsat, 1)} V</em></li>
  </ol></aside>`;
}
function tcVeredito(r){
  const T = S.tc, fm = (n, d) => tcF(n, d), ok = r.vsat != null ? (r.vnom ? r.vsat <= r.vnom : false) : null;
  const txt = r.vsat == null ? "Informe os dados da rede (Icc) para verificar a saturação" : r.vnom ? `Tensão de saturação calculada ${fm(r.vsat, 1)} V ${ok ? "≤" : ">"} nominal ${r.vnom} V · classe ${tcNome(r.vnom, T.sec)}  ${ok ? "✓ o TC não satura" : "✗ o TC satura"}` : `Tensão de saturação calculada ${fm(r.vsat, 1)} V acima da maior classe (800 V)  ✗ o TC satura`;
  return `<div class="tcver ${r.vsat == null ? "" : ok ? "ok" : "no"}">${esc(txt)}</div>`;
}

/* Medidores: barra = valor, marca tracejada = limite (100 %); a escala vai até 150 % do limite. */
function tcVisual(r){
  const G = [];
  if (r.itot != null && r.ipn) G.push({ rot: "Corrente nominal da instalação", v: r.itot, lim: r.ipn, un: "A", limRot: "corrente primária do TC", d: 1 });
  if (r.vsat != null && r.vnom) G.push({ rot: "Tensão de saturação calculada (Icc_máx ÷ RTC × Impedância de carga)", v: r.vsat, lim: r.vnom, un: "V", limRot: "tensão de saturação nominal da classe", d: 1 });
  let o = `<div class="tcdg">${tcDiagrama(r)}${tcPassos(r)}</div>${tcVeredito(r)}`;
  if (!G.length) return o;
  if (r.ipn && r.ipnMax != null) G.push({ rot: "Sensibilidade: corrente primária do TC", v: r.ipn, lim: r.ipnMax, un: "A", limRot: "51N do cliente ÷ 0,1 (boa prática)", d: 1, soft: true });
  const W = 900, RH = 54, X0 = 12, TW = W - 24, f = 1.5, H = G.length * RH + 6;
  const aberto = tcAb.med;
  o += `<div class="tcrh tcsp2"><h4>Medidores</h4>${tcMoreBtn("med")}</div><div class="swrap tcfold ${aberto ? "open" : ""}" id="tcfold-med"><div class="sinner"><svg class="tcsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Medidores do TC">`;
  G.forEach((g, i) => {
    const y = i * RH + 4, pct = g.v / g.lim, ok = g.min ? pct >= 0.9999999 : pct <= 1.0000001, cn = ok ? "ok" : g.soft ? "wn" : "no", sy = ok ? "✓" : g.soft ? "⚠" : "✗", w = Math.min(pct, f) / f * TW, xl = X0 + TW / f;
    o += `<text x="${X0}" y="${y + 12}" class="tcg-l">${esc(g.rot)}</text>`;
    o += `<text x="${W - 12}" y="${y + 12}" text-anchor="end" class="tcg-v ${cn}">${tcF(g.v, g.d)} / ${tcF(g.lim, g.d)} ${g.un} · ${Math.round(pct * 100)} % ${sy}</text>`;
    o += `<rect x="${X0}" y="${y + 19}" width="${TW}" height="14" rx="2" class="tcg-t"/>`;
    o += `<rect x="${X0}" y="${y + 19}" width="${Math.max(2, w).toFixed(1)}" height="14" rx="2" class="tcg-b ${cn}"/>`;
    o += `<line x1="${xl.toFixed(1)}" x2="${xl.toFixed(1)}" y1="${y + 15}" y2="${y + 37}" class="tcg-m"/>`;
    o += `<text x="${xl.toFixed(1)}" y="${y + 47}" text-anchor="middle" class="tcg-s">limite: ${esc(g.limRot)}</text>`;
  });
  return o + "</svg></div></div>";
}

function renderTC(){
  const host = $("#instTC"); if (!host) return;
  const T = S.tc;
  const campo = (id, k, rot, un, extra) => `<label class="fld"><span>${rot}${extra ? ` <em class="opc" id="tc-${id}-aut">${extra}</em>` : ""}</span><div class="box"><input id="tc-${id}" data-k="${k}" type="text" inputmode="decimal" autocomplete="off">${un ? `<span class="u">${un}</span>` : ""}</div></label>`;
  if (!host.dataset.pronto){
    host.dataset.pronto = "1";
    host.innerHTML = `<div class="tcgrid">
      <div class="tcin">
        <h4>Dados</h4>
        ${campo("fator", "fator", "Fator sobre a corrente nominal", "×", "(térmico usual: 1,2)")}
        <label class="fld"><span>Corrente secundária nominal</span><div class="box"><select id="tc-sec" data-k="sec"><option value="5">5 A</option><option value="1">1 A</option></select></div></label>
        ${campo("rtc", "rtc", "Corrente primária adotada", "A", "(automática)")}
        <label class="fld"><span>Tensão de saturação nominal (classe) <em class="opc">(automática: a menor que atende)</em></span><div class="box"><select id="tc-classe" data-k="classe"><option value="">Automática</option>${TC_CLASSES.map(v => `<option value="${v}">${tcNome(v, T.sec)} · ${v} V</option>`).join("")}</select></div></label>
        ${campo("imin", "imin", "Corrente de partida do neutro (51N) do cliente", "A", "(em branco: usa a do coordenograma)")}
        ${campo("zc", "zc", "Impedância do cabo", "Ω/km")}
        ${campo("cL", "cL", "Distância TC–relé (ida)", "m", "(× 2 no cálculo)")}
        ${campo("vaF", "vaF", "Consumo do relé: fase", "VA")}
        ${campo("vaN", "vaN", "Consumo do relé: neutro", "VA", "(× 3 no cálculo)")}
        ${campo("zbur", "zbur", "Z burden do TC", "Ω", "(Impedância do TC = Z_burden × 0,2)")}
      </div>
      <div class="tcout" id="tcRes"></div>
    </div>`;
  }
  const set = (id, v) => { const el = $("#" + id); if (el && document.activeElement !== el) el.value = v; };
  set("tc-fator", showNum(T.fator)); set("tc-sec", String(T.sec)); set("tc-rtc", showNum(T.rtc)); set("tc-classe", T.classe ? String(T.classe) : "");
  ["zc", "cL", "vaF", "vaN", "zbur", "imin"].forEach(k => set("tc-" + k, showNum(T[k])));
  updateTC();
}
function updateTC(){
  const el = $("#tcRes"); if (!el) return;
  const T = S.tc, r = tcCalc(), rtcI = $("#tc-rtc"), sec = T.sec;
  if (rtcI){
    rtcI.placeholder = r.sug ? showNum(r.sug) : "";
    if (r.auto && document.activeElement !== rtcI) rtcI.value = r.sug ? showNum(r.sug) : "";     // preenchida automaticamente com a sugerida
    const bx = rtcI.closest(".box"); if (bx) bx.classList.toggle("dim", r.auto);
    const nt = $("#tc-rtc-aut"); if (nt) nt.textContent = r.auto ? "(automática)" : "(informada; apague para voltar à automática)";
  }
  const imI = $("#tc-imin"); if (imI) imI.placeholder = r.iminAuto ? showNum(r.iminAuto) : "";
  const sel = $("#tc-classe"); if (sel) [...sel.options].forEach(o => { if (o.value) o.textContent = `${tcNome(+o.value, sec)} · ${o.value} V`; });
  const linha = (rot, val, un, st, dica) => `<tr><th scope="row"${dica ? ` title="${esc(dica)}"` : ""}>${rot}</th><td>${val}${un ? ` <span class="u">${un}</span>` : ""}</td><td>${st || ""}</td></tr>`;
  const okI = r.itot != null && r.ipn ? r.ipn >= r.itot : null;
  const okV = r.vsat != null ? (r.vnom ? r.vsat <= r.vnom : false) : null;
  const classeTxt = r.vnom ? tcNome(r.vnom, sec) : "acima de 10B800";
  const dicas = [];
  if (okV === false){
    dicas.push("Reduzir Impedância de carga: aumentar a seção do cabo (menor Ω/km), diminuir a distância ou usar dois cabos em paralelo.");
    dicas.push("Aumentar a relação do TC (diminui a corrente no secundário na Icc máxima), conferindo se o relé continua enxergando a corrente de carga.");
    if (T.classe) dicas.push("Escolher uma classe de maior Tensão de saturação nominal.");
  }
  if (r.okSens === false) dicas.push(`Atenção (boa prática, não é erro): a corrente primária do TC (${tcF(r.ipn, 0)} A) é maior que a partida do neutro (${tcF(r.imin, 1)} A) ÷ 0,1 = ${tcF(r.ipnMax, 1)} A, então o relé fica menos sensível. Se possível, usar relação de até ${tcF(r.ipnMax, 0)} A (mantendo Icc máx ÷ 20 = ${tcF(r.ib, 1)} A) ou reduzir a partida do 51N.`);
  if (okI === false) dicas.push("Corrente primária menor que a nominal da instalação: adotar relação maior.");
  const erro = (r.erro20 ? `<div class="tcerr" role="alert"><b>Erro: ajuste a corrente primária do TC.</b> A corrente primária adotada (${tcF(T.rtc, 0)} A) é menor que Icc máxima ÷ 20 (${tcF(r.ib, 1)} A): com ela o TC passa de 20× a corrente nominal no curto máximo e satura. Adote no mínimo <b>${tcF(r.ib, 1)} A</b> (relação padronizada sugerida: <b>${tcF(r.sug, 0)}-${sec}</b>) ou apague o campo para usar a automática.</div>` : "")
    + (r.faixaVazia ? `<div class="tcwarn" role="note"><b>Atenção:</b> Icc máxima ÷ 20 (${tcF(r.faixaMin, 1)} A) é maior que Imín ÷ 0,1 (${tcF(r.faixaMax, 1)} A), então o critério de sensibilidade (boa prática) não pode ser atendido junto com o de curto-circuito. Vale o de curto-circuito; se possível, reduza a partida do 51N.</div>`
      : !r.erro20 && r.okSens === false ? `<div class="tcwarn" role="note"><b>Atenção (sensibilidade):</b> a corrente primária adotada (${tcF(r.ipn, 0)} A) é maior que Imín ÷ 0,1 (${tcF(r.faixaMax, 1)} A). É uma boa prática, não um erro: o TC continua válido pelo critério de curto-circuito.</div>` : "");
  el.innerHTML = `${erro}<h4>Verificação visual</h4><div class="tcvis">${tcVisual(r)}</div>
  <div class="tcrh tcsp"><h4>Resultado</h4>${tcMoreBtn("res")}</div><div class="swrap tcfold ${tcAb.res ? "open" : ""}" id="tcfold-res"><div class="sinner"><table class="tcres"><tbody>
    ${linha("Corrente nominal da instalação", tcF(r.itot), "A", "", "Soma das correntes nominais primárias dos transformadores, na tensão base")}
    ${linha("Corrente nominal × fator", tcF(r.ia), "A")}
    ${linha("Limite inferior: Icc máxima ÷ 20", tcF(r.ib), "A", "", "Critério de curto-circuito: Iptc ≥ Icc máx ÷ 20")}
    ${linha("Limite superior: Imín ÷ 0,1", tcF(r.faixaMax), "A", "", "Boa prática de sensibilidade (não é obrigatória): Iptc ≤ Imín ÷ 0,1 (Imín = corrente de partida do neutro (51N) do cliente)")}
    ${linha("<b>Faixa recomendada</b>", r.faixaMin != null && r.faixaMax != null ? `<b>${tcF(r.faixaMin, 1)} ≤ Iptc ≤ ${tcF(r.faixaMax, 1)}</b>` : "—", "A", r.faixaVazia ? tcAt(false) : "", "Icc máx ÷ 20 ≤ Iptc ≤ Imín ÷ 0,1")}
    ${linha("<b>Relação sugerida</b>", r.sug ? `<b>${tcF(r.sug, 0)}-${sec}</b>` : "—", "A", "", "Menor relação padronizada ≥ Icc máx ÷ 20")}
    ${linha("<b>Relação adotada</b>", r.ipn ? `<b>${tcF(r.ipn, 0)}-${sec}</b>` : "—", "A")}
    ${linha("RTC", tcF(r.rtc, 2))}
    ${linha("Corrente primária ≥ Icc máxima ÷ 20", r.ib != null && r.ipn ? tcF(r.ipn / r.ib, 2) + "×" : "—", "", tcSt(r.ib != null && r.ipn ? !r.erro20 && r.ipn >= r.ib : null), "A corrente primária adotada deve ser sempre maior ou igual a Icc máxima ÷ 20")}
    ${linha("Corrente primária ≥ corrente nominal", r.itot != null && r.ipn ? tcF(r.ipn / r.itot, 2) + "×" : "—", "", tcSt(okI))}
    ${linha("Corrente de partida do neutro (51N) do cliente", tcF(r.imin, 2), "A", "", T.imin > 0 ? "Informada" : `Corrente de partida do ${r.iminSrc || "51N"} do cliente (aba Coordenograma)`)}
    ${linha("<b>Sensibilidade</b> (Iptc ≤ Imín ÷ 0,1)", r.ipn && r.ipnMax != null ? `${tcF(r.ipn, 0)} ≤ ${tcF(r.ipnMax, 1)}` : "—", "A", tcAt(r.okSens), "Corrente primária do TC deve ser menor ou igual à partida do 51N do cliente ÷ 0,1")}
    ${linha("Corrente primária máxima p/ sensibilidade", tcF(r.ipnMax, 0), "A", "", "Partida do 51N do cliente ÷ 0,1")}
    ${linha("Fator térmico", tcF(T.fator, 2) + "×", "", "", "Corrente contínua máxima = fator × corrente nominal primária")}
    ${linha("Corrente térmica de curta duração (Ith)", tcF(r.ith != null ? r.ith / 1000 : null, 1), "kA · 1 s", "", "Ith = 80 × In (TC de média tensão)")}
    ${linha("Corrente dinâmica (Id)", tcF(r.id != null ? r.id / 1000 : null, 1), "kA pico", "", "Id = 2,5 × Ith")}
    ${linha("Impedância dos condutores", tcF(r.zfio, 3), "Ω", "", "Z_cabo × distância × 2")}
    ${linha("Impedância do relé", tcF(r.zrele, 3), "Ω", "", "(VA fase + 3 × VA neutro) ÷ I secundária²")}
    ${linha("Impedância do TC", tcF(r.ztc, 3), "Ω", "", "Z_burden × 0,2")}
    ${linha("<b>Impedância de carga</b>", `<b>${tcF(r.zcarga, 3)}</b>`, "Ω", "", "Impedância dos condutores + Impedância do relé + Impedância do TC")}
    ${linha("Icc máxima considerada", tcF(r.icc, 0), "A", "", r.iccAssim ? "Trifásica assimétrica do estudo" : "Trifásica simétrica (a assimétrica não está disponível)")}
    ${linha("<b>Tensão de saturação calculada</b>", `<b>${tcF(r.vsat, 2)}</b>`, "V", "", "Icc_máx ÷ RTC × Impedância de carga")}
    ${linha("<b>Tensão de saturação nominal (classe)</b>", `<b>${r.vnom ? r.vnom : "—"}</b>${r.vnom ? "" : ""}`, "V", tcSt(okV), "Deve ser maior ou igual ao Tensão de saturação calculada")}
    ${linha("<b>Classe de exatidão</b>", `<b>${classeTxt}</b>${T.classe ? "" : " (automática)"}`)}
  </tbody></table></div></div>
  ${dicas.length ? `<div class="tcdica"><b>Como corrigir</b><ul>${dicas.map(d => `<li>${d}</li>`).join("")}</ul></div>` : ""}
  <p class="note">${r.icc == null ? "Informe a tensão e a potência de base e os dados da rede na aba Dados da Concessionária para ter a Icc e verificar a saturação. " : ""}Critério: Tensão de saturação calculada ≤ Tensão de saturação nominal. Z_burden e 0,2 conforme o método adotado; consumos do relé conforme o manual do fabricante.</p>`;
}
(function(){
  const host = $("#instTC"); if (!host) return;
  host.addEventListener("click", e => {
    const b = e.target.closest("[data-fold]"); if (!b) return;
    const k = b.dataset.fold; tcAb[k] = !tcAb[k];
    const w = $("#tcfold-" + k); if (w) w.classList.toggle("open", tcAb[k]);
    b.setAttribute("aria-expanded", String(tcAb[k])); b.textContent = tcAb[k] ? "VER MENOS ▴" : "VER MAIS ▾";
  });
  host.addEventListener("input", e => {
    const el = e.target, k = el.dataset.k; if (!k || el.tagName === "SELECT") return;
    const v = parseNum(el.value); if (v === undefined) return;
    S.tc[k] = v; if (k === "fator" && !(v > 0)) S.tc[k] = tcBlank()[k]; else if (k !== "rtc" && v == null) S.tc[k] = 0; updateTC(); touch();
  });
  host.addEventListener("change", e => {
    const el = e.target, k = el.dataset.k; if (!k || el.tagName !== "SELECT") return;
    S.tc[k] = k === "classe" ? (+el.value || null) : +el.value; updateTC(); touch();
  });
  host.addEventListener("focusout", e => { const el = e.target; if (el.tagName === "INPUT" && el.dataset.k){ const v = S.tc[el.dataset.k]; el.value = showNum(v); updateTC(); } });
  const t = $("#instTrafos"); if (t){ ["input", "change"].forEach(ev => t.addEventListener(ev, () => updateTC())); }
})();
