/* ui.js — barra do gráfico, opções, salvar/abrir/exportar e atalhos */
"use strict";

function say(msg){ const el = $("#status"); el.textContent = msg; clearTimeout(say.t); say.t = setTimeout(() => el.textContent = "", 4500); }

/* ---------- opções do projeto e eixos ---------- */
$("#pname").addEventListener("input", e => { S.name = e.target.value; touch(); });
function showBaseA(){                                       // corrente de base = Sb / (√3·Vb), calculada na hora
  const kv = S.baseKV, mva = S.baseS;
  $("#baseA").value = kv > 0 && mva > 0 ? ptbr((Math.round(mva * 1000 / (Math.sqrt(3) * kv) * 100) / 100).toString()) : "";
}
$("#basekv").addEventListener("input", e => { const v = parseNum(e.target.value); if (v > 0){ S.baseKV = v; showBaseA(); updateZNote(); updateIccDef(); if (typeof syncRecom === "function") syncRecom(false); render(); touch(); } });
$("#baseS").addEventListener("input", e => { const v = parseNum(e.target.value); if (v === undefined || v === 0) return; S.baseS = v; showBaseA(); updateZNote(); updateIccDef(); touch(); });
$("#baseS").addEventListener("focusout", e => { e.target.value = showNum(S.baseS); });
$("#basekv").addEventListener("focusout", e => { e.target.value = showNum(S.baseKV); });
$("#showall").addEventListener("change", e => { S.showAll = e.target.checked; S.vis = {}; render(); touch(); });
$("#legend").addEventListener("change", e => { S.legend = e.target.checked; render(); touch(); });
["imin", "imax", "tmin", "tmax"].forEach(k => $("#" + k).addEventListener("input", e => {
  const v = parseFloat(e.target.value); if (!(v > 0)) return;
  const a = Object.assign({}, S.axes, { [k]: v });
  if (a.imax > a.imin * 1.5 && a.tmax > a.tmin * 1.5){ S.axes = a; render(); touch(); }
}));
// visão do gráfico: Fase (51/50), Neutro (51N/50N)
function syncView(){ $("#ctitle").textContent = "Coordenograma de " + ({ fase: "fase", neutro: "neutro" }[S.view] || "fase"); document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === S.view))); }
$("#viewSeg").addEventListener("click", e => {
  const b = e.target.closest("[data-view]"); if (!b) return;
  S.view = b.dataset.view; syncView(); render(); touch();
});
$("#btnReset").addEventListener("click", resetAxes);
$("#btnUndo").addEventListener("click", undo);
$("#btnRedo").addEventListener("click", redo);
$("#btnSample").addEventListener("click", () => { S.cliente = clienteExample(); fullRender(); histPush(); save(); say("Valores de exemplo restaurados."); });
$("#btnClear").addEventListener("click", () => {
  const b = $("#btnClear");
  if (b.dataset.arm !== "1"){ b.dataset.arm = "1"; b.textContent = "Confirmar?"; setTimeout(() => { b.dataset.arm = ""; b.textContent = "Zerar funções"; }, 3000); return; }
  b.dataset.arm = ""; b.textContent = "Zerar funções"; S.cliente = clienteEmpty(); fullRender(); histPush(); save();
});
// fecha o painel "Mais opções" ao clicar fora dele
document.addEventListener("click", e => { const d = $("#more"); if (d.open && !d.contains(e.target)) d.open = false; });

/* ---------- salvar, abrir e exportar ---------- */
const jsonText = () => JSON.stringify(S, null, 2);
const fileBase = () => (S.name || "coordenograma").replace(/[^\w\-]+/g, "_");
function download(name, blob){
  try {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  } catch (e) { return false; }
}
async function copyText(txt){
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) {}
  const ta = $("#json"); ta.value = txt; ta.select(); try { return document.execCommand("copy"); } catch (e) { return false; }
}
$("#btnCopy").addEventListener("click", async () => {
  $("#json").value = jsonText();
  say((await copyText(jsonText())) ? "JSON copiado." : "Selecione o texto da caixa e copie (Ctrl+C).");
});
$("#btnLoad").addEventListener("click", () => {
  try { S = normalize(JSON.parse($("#json").value)); fullRender(); histPush(); save(); say("Projeto carregado."); }
  catch (e) { say("JSON inválido: " + e.message); }
});
$("#btnFile").addEventListener("click", () => $("#fileIn").click());
$("#fileIn").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { S = normalize(JSON.parse(r.result)); fullRender(); histPush(); save(); say("Projeto aberto."); } catch (err) { say("Arquivo inválido."); } };
  r.readAsText(f); e.target.value = "";
});
$("#btnSaveFile").addEventListener("click", () => {
  $("#json").value = jsonText();
  say(download(fileBase() + ".json", new Blob([jsonText()], { type: "application/json" })) ? "Arquivo .json baixado." : "Download indisponível; use Copiar JSON.");
});
function svgString(){
  const s = svg.cloneNode(true);
  s.setAttribute("xmlns", "http://www.w3.org/2000/svg"); s.setAttribute("width", W); s.setAttribute("height", H);
  s.removeAttribute("style"); const c = s.querySelector("#cross"); if (c) c.remove();
  return new XMLSerializer().serializeToString(s);
}
$("#btnSvg").addEventListener("click", () => {
  say(download(fileBase() + ".svg", new Blob([svgString()], { type: "image/svg+xml" })) ? "SVG baixado." : "Download indisponível.");
});
$("#btnPng").addEventListener("click", () => {
  const img = new Image();
  img.onload = () => {
    const k = 2, cv = document.createElement("canvas"); cv.width = W * k; cv.height = H * k;
    const cx = cv.getContext("2d"); cx.scale(k, k); cx.drawImage(img, 0, 0);
    cv.toBlob(async b => {
      if (!b){ say("Não foi possível gerar o PNG."); return; }
      let copied = false;
      try { await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); copied = true; } catch (e) {}
      const ok = download(fileBase() + ".png", b);
      say(copied ? "PNG baixado e copiado (cole no Word/Excel/PowerPoint)." : ok ? "PNG baixado." : "Exportação indisponível.");
    });
  };
  img.onerror = () => say("Não foi possível gerar o PNG.");
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString());
});

/* ---------- atalhos: Ctrl+Z desfaz, Ctrl+Y / Ctrl+Shift+Z refaz (fora de campos de texto) ---------- */
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const t = e.target, typing = t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && ["text", "number", "email", "tel"].includes(t.type));
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey){ e.preventDefault(); undo(); }
  else if (k === "y" || (k === "z" && e.shiftKey)){ e.preventDefault(); redo(); }
});
