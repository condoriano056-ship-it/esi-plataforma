/* login.js — comportamento da página de login: formulário e slides animados. */
"use strict";
(() => {
  const $ = s => document.querySelector(s);
  $("#lgAno").textContent = new Date().getFullYear();
  if (typeof ESI_LOGO !== "undefined") $("#lgLogo").src = ESI_LOGO.cor;

  /* ---------- login ---------- */
  const msg = (t, ok) => { const m = $("#lgMsg"); m.textContent = t || ""; m.classList.toggle("ok", !!ok); };
  const IR = "index.html";
  if (!AUTH.ativo()){
    const a = $("#lgAviso"); a.hidden = false;
    a.innerHTML = 'O login ainda não está configurado (veja o <b>LEIAME.md</b>). Enquanto isso, a plataforma abre sem senha. <a href="' + IR + '">Abrir a plataforma</a>';
    $("#lgEntrar").disabled = true;
  } else if (AUTH.sessao()){
    AUTH.validar().then(ok => { if (ok) location.replace(IR); });
  }
  $("#lgOlho").addEventListener("click", e => {
    const i = $("#lgSenha"), v = i.type === "password"; i.type = v ? "text" : "password";
    e.currentTarget.setAttribute("aria-pressed", String(v)); e.currentTarget.setAttribute("aria-label", v ? "Ocultar senha" : "Mostrar senha");
  });
  const ocupado = (b, on) => { const btn = $("#lgEntrar"); btn.disabled = on || !AUTH.ativo(); btn.classList.toggle("carregando", on); };
  $("#lgForm").addEventListener("submit", async e => {
    e.preventDefault(); msg("");
    const email = $("#lgEmail").value.trim(), senha = $("#lgSenha").value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg("Informe um e-mail válido."), $("#lgEmail").focus();
    if (!senha) return msg("Informe a senha."), $("#lgSenha").focus();
    ocupado(0, true);
    try { await AUTH.entrar(email, senha, $("#lgLembrar").checked); location.replace(IR); }
    catch (err) { msg(err.message); ocupado(0, false); $("#lgSenha").select(); }
  });
  $("#lgEsqueci").addEventListener("click", async () => {
    msg("");
    const email = $("#lgEmail").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg("Digite seu e-mail acima para receber o link de nova senha."), $("#lgEmail").focus();
    if (!AUTH.ativo()) return msg("O login ainda não está configurado.");
    try { await AUTH.recuperar(email); msg("Enviamos um link de redefinição para " + email + ". Confira também o spam.", true); }
    catch (err) { msg(err.message); }
  });

  /* ---------- slides ---------- */
  const show = $(".lg-show"), slides = [...document.querySelectorAll(".lg-slide")], bgs = [...document.querySelectorAll(".lg-bg")], dots = $("#lgDots");
  const DUR = 6500; let cur = 0, timer = 0;
  show.style.setProperty("--dur", DUR + "ms");
  slides.forEach((s, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "lg-dot"; b.setAttribute("role", "tab"); b.setAttribute("aria-label", "Slide " + (i + 1));
    b.addEventListener("click", () => ir(i, true)); dots.appendChild(b);
  });
  const ds = () => [...dots.children];
  function ir(n, manual){
    clearTimeout(timer);
    const ant = cur; cur = (n + slides.length) % slides.length;
    slides[ant].classList.remove("on"); slides[ant].classList.add("sai"); setTimeout(() => slides[ant].classList.remove("sai"), 900);
    bgs.forEach((b, i) => { b.classList.remove("on"); void b.offsetWidth; b.classList.toggle("on", i === cur); });
    slides[cur].classList.add("on");
    ds().forEach((d, i) => { d.classList.remove("on"); void d.offsetWidth; d.classList.toggle("on", i === cur); d.setAttribute("aria-selected", String(i === cur)); });
    if (!matchMedia("(prefers-reduced-motion:reduce)").matches || manual === undefined) timer = setTimeout(() => ir(cur + 1), DUR);
  }
  show.addEventListener("mouseenter", () => { show.classList.add("pausa"); clearTimeout(timer); });
  show.addEventListener("mouseleave", () => { show.classList.remove("pausa"); ir(cur); });
  ir(0);
})();
