/* auth-config.js — configuração do login (Firebase Authentication).
   Enquanto apiKey estiver vazia, o login fica DESLIGADO e a plataforma abre direto (útil para testar localmente).
   Para ativar: crie um projeto no Firebase, ative "Authentication > E-mail/senha", copie a "Chave de API da Web"
   (Configurações do projeto) e cole abaixo. Essa chave é pública por natureza; não é segredo. Veja o LEIAME.md. */
"use strict";
window.AUTH_CONFIG = {
  apiKey: "AIzaSyAUp4zbjr9eiBulmSRs_ZBhoAwkc4Lq-AE"
};
