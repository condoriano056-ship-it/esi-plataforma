/* auth.js — sessão de usuário via Firebase Authentication (API REST, sem biblioteca externa).
   Carregado em index.html (guarda a entrada) e em login.html (faz o login). */
"use strict";
const AUTH = (() => {
  const KEY = "esi.sessao", cfg = () => (window.AUTH_CONFIG && window.AUTH_CONFIG.apiKey) || "";
  const IDT = "https://identitytoolkit.googleapis.com/v1/accounts:", STS = "https://securetoken.googleapis.com/v1/token";
  const ERROS = {
    INVALID_LOGIN_CREDENTIALS: "E-mail ou senha incorretos.", INVALID_PASSWORD: "E-mail ou senha incorretos.", EMAIL_NOT_FOUND: "E-mail ou senha incorretos.",
    INVALID_EMAIL: "Informe um e-mail válido.", USER_DISABLED: "Este usuário está desativado. Fale com o administrador.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Muitas tentativas. Aguarde alguns minutos e tente de novo.", MISSING_PASSWORD: "Informe a senha.",
    NETWORK: "Sem conexão com o serviço de login. Verifique sua internet."
  };
  const msg = c => ERROS[String(c).split(" ")[0]] || "Não foi possível entrar. Tente novamente.";
  const store = lembrar => lembrar ? localStorage : sessionStorage;
  function lerSessao(){
    for (const st of [sessionStorage, localStorage]){ try { const j = JSON.parse(st.getItem(KEY) || "null"); if (j && j.refresh) return { ...j, st }; } catch (e) {} }
    return null;
  }
  async function post(url, body, form){
    let r;
    try { r = await fetch(url, { method: "POST", headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" }, body: form ? new URLSearchParams(body) : JSON.stringify(body) }); }
    catch (e) { throw new Error(msg("NETWORK")); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(msg((j.error && j.error.message) || ""));
    return j;
  }
  return {
    ativo: () => !!cfg(),
    sessao: lerSessao,
    async entrar(email, senha, lembrar){
      const j = await post(IDT + "signInWithPassword?key=" + cfg(), { email, password: senha, returnSecureToken: true });
      try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
      store(lembrar).setItem(KEY, JSON.stringify({ email: j.email, refresh: j.refreshToken, uid: j.localId, t: Date.now() }));
    },
    async recuperar(email){ await post(IDT + "sendOobCode?key=" + cfg(), { requestType: "PASSWORD_RESET", email }); },
    sair(){ try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {} location.replace("login.html"); },
    /* confirma no servidor que a conta ainda é válida (usuário removido/desativado perde o acesso) */
    async validar(){
      const s = lerSessao(); if (!s) return false;
      try {
        const r = await fetch(STS + "?key=" + cfg(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refresh }) });
        if (r.ok){ const j = await r.json(); s.st.setItem(KEY, JSON.stringify({ email: s.email, refresh: j.refresh_token || s.refresh, uid: s.uid, t: Date.now() })); return true; }
        return false;
      } catch (e) { return true; }        // sem internet: mantém a sessão já aberta
    }
  };
})();

/* Guarda de entrada: só atua em páginas que declaram <body data-protegida>. */
document.addEventListener("DOMContentLoaded", () => {
  if (!document.body.hasAttribute("data-protegida") || !AUTH.ativo()) return;
  const bloquear = () => location.replace("login.html");
  if (!AUTH.sessao()) return bloquear();
  AUTH.validar().then(ok => { if (!ok) AUTH.sair(); });
});
