# Coordenograma de Proteção

Abra `index.html` no navegador (duplo clique). Não precisa de servidor nem de instalação.
Depois de editar qualquer arquivo, salve e aperte F5 no navegador. O projeto em andamento fica salvo no próprio navegador.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html` | Estrutura da página e ordem de carregamento dos scripts |
| `css/style.css` | Visual e cores (cores e fonte nas variáveis do início: fundo branco gelo, azul marinho, Arial) |
| `js/util.js` | Funções auxiliares e formatação de números |
| `js/curves.js` | **Fórmulas das curvas** e os modelos (51, 50 do cliente; relé, disjuntor, transformador, cabo, motor para a fase da concessionária) |
| `js/funcoes.js` | **Catálogo das funções** (51, 50, 51N, 50N, 51G, 67, 59, 27, 47, 59N, 81O/U, 46, 32, 27-0) e seus campos |
| `js/protecao.js` | Painel **Proteção cliente**: menu de funções e quadros de preenchimento |
| `js/state.js` | Projeto atual, exemplo, salvamento local e desfazer/refazer |
| `js/chart.js` | Gráfico log-log, zoom, arrastar, cursor |
| `js/home.js` | **Página inicial**: dados do cliente, empresa contratada, concessionária (máscaras e validação de CPF/CNPJ, e-mail e telefone) |
| `js/ui.js` | Painel lateral, botões, exportação, atalhos |
| `js/app.js` | Inicialização e navegação entre abas |

## Onde mexer para ...

- **Trocar uma fórmula de curva ou incluir uma nova curva inversa:** `CURVES` em `js/curves.js` (t = dial·(A/(M^p−1)+B)).
- **Mudar os campos das funções 50/51:** `js/protecao.js` (tela) e `ST51_OFF`/`clienteExample` em `js/state.js` (dados).
- **Mudar cores, tamanhos e layout:** `css/style.css`.

- **Incluir outra concessionária:** lista `CONCESSIONARIAS` em `js/home.js`.
- **Incluir campos no cadastro:** lista `INFO_FIELDS` em `js/home.js` e o modelo `PARTY0` em `js/state.js`.
- **Criar uma nova aba:** instruções no topo de `js/app.js`.

## Imagens (logos e figuras)

Coloque os arquivos na pasta `img/` com estes nomes (aceita .png, .svg, .jpg, .jpeg ou .webp) e aperte Ctrl+F5:
`logo-enel`, `logo-cpfl`, `logo-energisa`, `logo-neoenergia` (concessionárias) e `finalidade-consumo`, `finalidade-consumo_geracao`, `finalidade-geracao` (finalidade do estudo).
Para outra concessionária, o nome é `logo-<id>` (o id é o primeiro item de `CONCESSIONARIAS` em `js/home.js`).

## Atalhos

Roda do mouse: zoom · arrastar: mover · duplo clique: restaurar eixos · Ctrl+Z / Ctrl+Y: desfazer / refazer.

## Identidade visual (ESI)
- Paleta: azul-marinho #0F2747 e azul vivo #1D68EE (tokens no início de `css/style.css`).
- Logos em `img/logo-esi-cor.png`, `img/logo-esi-branco.png`, `img/marca-esi-*.png`; cópias embutidas em `js/logo.js` (usadas no cabeçalho, rodapé, janela "Sobre" e capa do relatório).

## Login (login.html)
A tela de login usa o Firebase Authentication (gratuito). Enquanto `js/auth-config.js` estiver com `apiKey: ""`, o login fica desligado e a plataforma abre direto.

Para ativar:
1. Em https://console.firebase.google.com crie um projeto → **Authentication → Começar → E-mail/senha** (ativar).
2. **Authentication → Configurações → Ações do usuário**: desmarque **"Ativar criação (cadastro)"**, para que ninguém crie conta sozinho.
3. **Authentication → Usuários → Adicionar usuário**: cadastre e-mail e senha de quem pode entrar.
4. **Configurações do projeto → Geral → Chave de API da Web**: copie e cole em `js/auth-config.js`.
5. **Authentication → Configurações → Domínios autorizados**: inclua o endereço do GitHub Pages (usuario.github.io).
Lembre: o login controla o acesso à tela; o código-fonte do repositório público continua visível. Repositório privado se precisar esconder o código.

## Estrutura da plataforma
- Menu lateral: **Boas-vindas** (lista dos estudos) e **Estudo atual** (Cadastro, Dados da Concessionária, Dados da instalação, Ordem de ajuste, Coordenograma).
- Os estudos ficam guardados no navegador (chave `esi.estudos.v1`): criar, abrir, duplicar, finalizar e excluir pela aba Boas-vindas. A plataforma sempre abre em Boas-vindas.
- Telas em coluna única, centralizadas.

## Módulos
`js/modulos.js` define os módulos (Estudo de proteção, Baixa tensão, Média tensão, Análise tarifária, SPDA). A tela **Início** mostra os cartões de cada módulo; o menu lateral tem um grupo por módulo. Só o Estudo de proteção está pronto; os demais mostram "Em desenvolvimento". Para criar um módulo novo, acrescente um item em `MODULOS`.

## Módulo SPDA (RaioCalc embutido)

- O módulo **SPDA** abre a página `spda/index.html` dentro da plataforma (análise de risco NBR 5419-2:2026 e estratificação do solo NBR 7117).
- É um **arquivo único** (HTML, JS, CSS e imagens embutidos): abre por duplo clique, sem servidor e sem internet.
- Os dados (análises e clientes) ficam no `localStorage` do navegador, nas chaves `raiocalc.analises` e `raiocalc.clientes`.
- O código-fonte está em `D:\Documentos\Claudinho\site\raiocalc`. Para atualizar: `npm run build` (o `vite.config.ts` já gera arquivo único) e copie `dist/index.html` para `spda/index.html`.
- **Atenção:** `spda/index.html` contém a Tabela F.1 da ABNT (NG por município), licenciada só para uso pessoal. Não publique essa pasta (GitHub, e-mail, clientes) sem autorização da ABNT.
