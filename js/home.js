/* home.js — aba "Página inicial": dados do cliente, da empresa contratada e concessionária.
   Os dados ficam em S.info e acompanham o projeto (salvamento local, JSON, desfazer/refazer). */
"use strict";

const PARTIES = [["cliente", "grp-cliente"], ["contratada", "grp-contratada"]];
const CONCESSIONARIAS = [["enel", "ENEL"], ["cpfl", "CPFL"], ["energisa", "ENERGISA"], ["neoenergia", "NEOENERGIA"]];          // para incluir outras: adicione [id, "Nome"] aqui
/* Imagens (logos e figuras): basta colocar o arquivo na pasta img/ com o nome certo (lista no LEIAME.md). Aceita .png, .svg, .jpg, .jpeg ou .webp;
   sem arquivo, aparece o ícone padrão. As cores da plataforma não mudam. */
const IMG_EXTS = ["png", "svg", "jpg", "jpeg", "webp"];
const IMG_ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/></svg>';
const imgAuto = (base, alt, nome) => `<img src="img/${base}.${IMG_EXTS[0]}" alt="${esc(alt)}" data-base="${base}" data-i="0"${nome ? ` data-nome="${esc(nome)}"` : ""}>`;
document.addEventListener("error", e => {          // tenta a próxima extensão; se nenhuma existir, mostra o ícone padrão
  const im = e.target; if (!im || im.tagName !== "IMG" || !im.dataset.base) return;
  const i = +im.dataset.i + 1;
  if (i < IMG_EXTS.length){ im.dataset.i = i; im.src = `img/${im.dataset.base}.${IMG_EXTS[i]}`; return; }
  const pai = im.parentElement, nome = im.dataset.nome; im.remove();
  if (pai) pai.insertAdjacentHTML("afterbegin", IMG_ICONE + (nome ? `<span>${esc(nome)}</span>` : ""));
}, true);
const INFO_FIELDS = [                                // mesmos campos para cliente e contratada
  { k: "nome",     label: "Nome / Razão social", type: "text",  full: true, auto: "name" },
  { k: "endereco", label: "Endereço",            type: "text",  full: true, auto: "street-address" },
  { k: "doc",      label: "CPF ou CNPJ",         type: "text",  mask: "doc", ph: "000.000.000-00 ou 00.000.000/0000-00" },
  { k: "email",    label: "E-mail",              type: "email", auto: "email", ph: "nome@empresa.com.br" },
  { k: "tel",      label: "Telefone",            type: "tel",   mask: "tel", ph: "(00) 00000-0000" }
];

/* ---------- máscaras ---------- */
const onlyDigits = s => String(s).replace(/\D/g, "");
function fmtCPF(d){
  let s = d.slice(0, 3);
  if (d.length > 3) s += "." + d.slice(3, 6);
  if (d.length > 6) s += "." + d.slice(6, 9);
  if (d.length > 9) s += "-" + d.slice(9, 11);
  return s;
}
function fmtCNPJ(a){
  let s = a.slice(0, 2);
  if (a.length > 2) s += "." + a.slice(2, 5);
  if (a.length > 5) s += "." + a.slice(5, 8);
  if (a.length > 8) s += "/" + a.slice(8, 12);
  if (a.length > 12) s += "-" + a.slice(12, 14);
  return s;
}
// CPF (11 dígitos) ou CNPJ (14 caracteres; aceita letras no formato alfanumérico, só os 2 últimos são dígitos)
function maskDoc(v){
  const a = String(v).toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (/^\d{0,11}$/.test(a)) return fmtCPF(a);
  return fmtCNPJ(a.slice(0, 14));
}
function maskTel(v){
  const d = onlyDigits(v).slice(0, 11);
  if (!d.length) return "";
  if (d.length <= 2) return "(" + d;
  if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
}

/* ---------- validação ---------- */
function validCPF(d){
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++){
    let s = 0; for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i);
    if ((s * 10 % 11) % 10 !== +d[t]) return false;
  }
  return true;
}
function validCNPJ(a){
  if (!/^[0-9A-Z]{12}\d{2}$/.test(a) || /^(.)\1{13}$/.test(a)) return false;
  const val = c => c.charCodeAt(0) - 48;
  for (let n = 12; n < 14; n++){
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0; for (let i = 0; i < n; i++) s += val(a[i]) * w[i];
    const r = s % 11, dv = r < 2 ? 0 : 11 - r;
    if (dv !== +a[n]) return false;
  }
  return true;
}
function infoError(k, v){
  v = String(v).trim(); if (!v) return "";
  if (k === "doc"){
    const a = v.toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (/^\d+$/.test(a) && a.length <= 11) return a.length < 11 ? "CPF incompleto." : validCPF(a) ? "" : "CPF inválido.";
    return a.length < 14 ? "CNPJ incompleto." : validCNPJ(a) ? "" : "CNPJ inválido.";
  }
  if (k === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "E-mail inválido.";
  if (k === "tel"){
    const d = onlyDigits(v);
    return (d.length === 10 || d.length === 11) && +d.slice(0, 2) >= 11 ? "" : "Telefone incompleto. Use DDD + número.";
  }
  return "";
}

/* ---------- desenho dos campos ---------- */
function renderHome(){
  renderFin();
  PARTIES.forEach(([p, gid]) => {
    $("#" + gid).innerHTML = INFO_FIELDS.map(f => {
      const id = `info-${p}-${f.k}`;
      return `<label class="fld ${f.full ? "full" : ""}" for="${id}"><span>${f.label}</span>
        <input id="${id}" type="${f.type}" value="${esc(S.info[p][f.k] || "")}" data-party="${p}" data-k="${f.k}"
          ${f.auto ? `autocomplete="${f.auto}"` : 'autocomplete="off"'} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""} ${f.mask === "tel" ? 'inputmode="tel"' : ""}>
        <div class="err" id="err-${p}-${f.k}" role="alert"></div></label>`;
    }).join("");
  });
  $("#concGrid").innerHTML = CONCESSIONARIAS.map(([k, n]) => `<button type="button" class="ctile" role="radio" data-conc="${k}" aria-checked="${S.info.conc === k}">
      <span class="cimg" aria-hidden="true">${imgAuto("logo-" + k, n)}</span>
      <span class="cname">${esc(n)}</span></button>`).join("");
  homeProgress();
}
function homeProgress(){
  const total = PARTIES.length * INFO_FIELDS.length;
  let n = 0; PARTIES.forEach(([p]) => INFO_FIELDS.forEach(f => { if (String(S.info[p][f.k] || "").trim()) n++; }));
  $("#homeStatus").textContent = n + " de " + total + " campos preenchidos";
}
function showError(el){
  const err = infoError(el.dataset.k, el.value);
  $("#err-" + el.dataset.party + "-" + el.dataset.k).textContent = err;
  el.classList.toggle("bad", !!err);
  return err;
}

$("#tab-home").addEventListener("input", e => {
  const el = e.target; if (!el.dataset.party) return;
  const f = INFO_FIELDS.find(x => x.k === el.dataset.k);
  let v = el.value;
  if (f.mask){
    const prev = onlyDigits(S.info[el.dataset.party][f.k]);
    const isDel = e.inputType && e.inputType.startsWith("deleteContent");
    if (f.mask === "tel" && isDel && onlyDigits(v) === prev && prev.length) v = prev.slice(0, -1);   // apagar um separador remove o dígito anterior
    v = f.mask === "doc" ? maskDoc(v) : maskTel(v);
    el.value = v;
  }
  S.info[el.dataset.party][f.k] = v;
  if (el.classList.contains("bad")) showError(el);   // limpa o erro assim que o campo ficar válido
  homeProgress(); touch();
});
$("#tab-home").addEventListener("focusout", e => { if (e.target.dataset && e.target.dataset.party) showError(e.target); });
/* Finalidade do estudo: três cartões iguais aos da concessionária. As figuras vêm de img/finalidade-<id>.png. */
const FINALIDADES_LISTA = [["consumo", "Consumo"], ["consumo_geracao", "Consumo + Geração"], ["geracao", "Geração"]];
function renderFin(){
  $("#finGrp").innerHTML = FINALIDADES_LISTA.map(([k, n]) => `<button type="button" class="ctile" role="radio" data-fin="${k}" aria-checked="${S.info.fin === k}">
      <span class="cimg" aria-hidden="true">${imgAuto("finalidade-" + k, n)}</span>
      <span class="cname">${esc(n)}</span></button>`).join("");
}
function applyFin(){
  document.querySelectorAll("#finGrp [data-fin]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.fin === S.info.fin)));
}
$("#finGrp").addEventListener("click", e => {
  const b = e.target.closest("[data-fin]"); if (!b) return;
  S.info.fin = b.dataset.fin; applyFin(); if (typeof renderDem === "function") renderDem(); if (typeof syncRecom === "function") syncRecom(); touch();
});
$("#concGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-conc]"); if (!b) return;
  S.info.conc = b.dataset.conc; S.inrushMetodo = null;      // trocou de concessionária: volta ao método padrão dela
  document.querySelectorAll("#concGrid [data-conc]").forEach(x => x.setAttribute("aria-checked", String(x === b)));
  renderConc(); applyInrush(); if (typeof syncRecom === "function") syncRecom(); touch();
});
$("#btnGoCoord").addEventListener("click", () => showTab("conc"));
$("#btnGoInst").addEventListener("click", () => showTab("inst"));
