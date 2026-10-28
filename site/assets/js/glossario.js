/* =====================================================================
   Painel de Cupons · Glossário (aberto pelo botão do cabeçalho; fora da rotação das telas)
   Lista todos os cupons da planilha de controle com Grupo, Restrição, Benefício,
   Compra mínima e Tipo (oculto ou não), com busca pelo nome e filtro por grupo.
   - Dados: GET ?acao=glossario (tabela cupom_planilha, alimentada pelo "Sincronizar cupons").
     Modo demonstração: demo/glossario.json (cupons fictícios).
   - Carregado ANTES de painel.js: aqui só há declarações; as funções usam, na hora da
     chamada, utilidades definidas em painel.js ($, esc, int, semAcento, buscar, est, telas…).
   ===================================================================== */
/* global $, $$, esc, int, semAcento, buscar, est, interagiu, DEMO, MQ_CEL */
/* global mostrar, bolinha, encCls, sitCupom, aoCarregarGlossario */
/* exported GLO, carregarGlossario, desenharGlossario, naPagGlo, celGlossario, desenharCelGlo, ligarGlossario, botaoGlossario, abrirGlossario, fecharGlossario, sairGlossario */

const GLO = { lista: null, grupo: "", sit: "", busca: "", pag: 0, paginas: 1, porPag: 20, carregadoEm: 0, celMais: false, aberto: false };
const temGlossario = () => Array.isArray(GLO.lista) && GLO.lista.length > 0;
const naPagGlo = () => GLO.aberto && GLO.paginas > 1;

// ---------------------------------------------------------------- abrir / fechar (fora da rotação das telas)
// Abre pelo botão do cabeçalho (ao lado do usuário; na TV, no lugar dele) ou pela tecla 7 do controle.
// Na TV, sem ninguém mexer, a rotação volta sozinha depois da pausa normal e fecha o Glossário.
const ICONE_LIVRO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 11h6"/></svg>';
const ICONE_VOLTAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
function botaoGlossario() {
  if (!temGlossario()) return "";
  return GLO.aberto ? `<button type="button" class="gl-abrir on" data-glo-abrir title="Voltar às telas do painel">${ICONE_VOLTAR}Voltar ao painel</button>`
    : `<button type="button" class="gl-abrir" data-glo-abrir title="Regras de cada cupom">${ICONE_LIVRO}Glossário</button>`;
}
const atualizarBotaoGlo = () => { const s = $("#gloSlot"); if (s) s.innerHTML = botaoGlossario(); };
function abrirGlossario() {
  if (!temGlossario()) return;
  GLO.aberto = true;
  $$(".tela").forEach((t) => t.classList.remove("ativa"));
  $("#telaGlossario").classList.add("ativa");
  $("#mini").classList.remove("on");
  $$("#gTelas .it").forEach((b) => b.classList.remove("on"));
  desenharGlossario(); atualizarBotaoGlo(); interagiu();
}
// usado por mostrar(): fecha sem trocar de tela
function sairGlossario() {
  if (!GLO.aberto) return;
  GLO.aberto = false;
  $("#telaGlossario").classList.remove("ativa");
  atualizarBotaoGlo();
}
const fecharGlossario = () => mostrar(est.tela, true);

// Grupos conhecidos da planilha (coluna "Grupo"): ordem na lista, cor e frase curta.
// Grupo novo na planilha aparece sozinho, com cor neutra e o resumo calculado das regras.
const GLO_GRUPOS = [
  { chave: "CRM", nome: "CRM", cor: "var(--ve)", frase: "Cada cupom tem regra própria", antigos: ["INSTITUCIONAL"] },   // grupo renomeado na planilha em 15/10/2026
  { chave: "INFLUENCIADOR", nome: "Influenciador", cor: "var(--lima)", frase: "Um por influenciador" },
  { chave: "RADIO", nome: "Rádio", cor: "var(--lj)", frase: "Um por emissora" },
  { chave: "FILIAL", nome: "Filial", cor: "var(--vc)", frase: "Um por loja" },   // + "(PREFIXO + nº da filial)", calculado dos dados
];
function grupoInfo(nomePlanilha) {
  const n = semAcento(nomePlanilha);
  const g = GLO_GRUPOS.find((x) => [x.chave, ...(x.antigos || [])].some((c) => n.startsWith(c)));
  return g ? { ...g, ordem: GLO_GRUPOS.indexOf(g) } : { chave: n || "SEM GRUPO", nome: nomePlanilha || "Sem grupo", cor: "var(--muted)", frase: "", ordem: 99 };
}

// "Acima de R$599" → "Acima de R$ 599"; "R$2999" → "R$ 2.999" (só a exibição; a planilha não muda)
const gloValor = (s) => String(s ?? "").replace(/R\$\s?(\d[\d.]*)/g, (_, n) => "R$ " + int(+n.replace(/\./g, "")));
const gloSemMinimo = (m) => !m || /sem m[ií]nimo/i.test(m);
const gloOculto = (x) => (/^n[aã]o/i.test(x || "") ? false : /oculto/i.test(x || "") ? true : null);
// "10% de desconto, limitado a R$ 70" → "10% até R$ 70"; "R$ 70 de desconto" → "R$ 70"
const gloBenCurto = (b) => gloValor(b).replace(/\s*de desconto,?\s*/i, " ").replace(/limitado a/i, "até").replace(/\s+/g, " ").trim();
const gloBenHtml = (b) => esc(gloValor(b)).replace(/^(R\$ [\d.]+|\d+%)/, "<b>$1</b>");

function prepararGlossario(l) {
  return l.filter((x) => x && x.cupom).map((x) => {
    const g = grupoInfo(x.grupo);
    return { cupom: String(x.cupom), g, restricao: x.restricao || "—", beneficio: x.beneficio || "—",
      minimo: gloSemMinimo(x.compra_minima) ? "Sem mínimo" : gloValor(x.compra_minima), oculto: gloOculto(x.exibicao), situacao: x.situacao ?? null, usos: x.usos ?? null };
  }).sort((a, b) => a.g.ordem - b.g.ordem || a.g.nome.localeCompare(b.g.nome, "pt-BR") || a.cupom.localeCompare(b.cupom, "pt-BR", { numeric: true }));
}

// Resumo da regra de um grupo: a combinação mais comum; se quase todos seguem a mesma, cita as exceções.
function resumoGrupo(itens) {
  const cont = new Map();
  for (const x of itens) {
    const k = gloBenCurto(x.beneficio) + (x.minimo === "Sem mínimo" ? "" : " acima de " + x.minimo.replace(/^acima de\s*/i, ""));
    cont.set(k, (cont.get(k) || 0) + 1);
  }
  const l = [...cont].sort((a, b) => b[1] - a[1]);
  if (!l.length) return "";
  if (l.length === 1) return l[0][0];
  if (l.length === 2 && l[1][1] / itens.length > 0.1) return `${l[0][0]} ou ${l[1][0]}`;
  if (l[0][1] / itens.length >= 0.9) { const exc = itens.length - l[0][1]; return `${l[0][0]} · ${exc} ${exc === 1 ? "exceção" : "exceções"}`; }
  return "";
}

function prefixoComum(l) {
  if (!l.length) return "";
  let p = l[0];
  for (const c of l) while (p && !c.startsWith(p)) p = p.slice(0, -1);
  return p.replace(/\d+$/, "");
}

async function carregarGlossario(forcar = false) {
  if (!forcar && GLO.lista && Date.now() - GLO.carregadoEm < 30 * 60e3) return;
  try {
    const j = DEMO ? await (await fetch("demo/glossario.json")).json() : await buscar(est, { acao: "glossario" }, true);
    // função antiga (sem a ação "glossario") devolve os dados do painel: a tela fica fora da rotação
    GLO.lista = Array.isArray(j) ? prepararGlossario(j) : [];
    GLO.carregadoEm = Date.now();
  } catch (e) { console.error("glossário:", e); if (!GLO.lista) GLO.lista = []; }
  desenharGlossario(); atualizarBotaoGlo();
  aoCarregarGlossario();   // o Ranking usa o grupo de cada cupom
  if (MQ_CEL.matches) desenharCelGlo();
}

const gloFiltrados = () => {
  const q = semAcento(GLO.busca.trim());
  return (GLO.lista || []).filter((x) => (!GLO.grupo || x.g.chave === GLO.grupo) && (!GLO.sit || sitCupom(x.cupom, x.situacao) === GLO.sit)
    && (!q || semAcento(x.cupom).includes(q)));
};
// filtro de situação (Todos · Ativos · Encerrados), com a contagem do grupo escolhido
const GLO_SITS = [["", "Todos"], ["ativo", "Ativos"], ["encerrado", "Encerrados"]];
const gloTemSit = () => (GLO.lista || []).some((x) => sitCupom(x.cupom, x.situacao));
function gloSitHtml(cel) {
  if (!gloTemSit()) return "";
  const base = (GLO.lista || []).filter((x) => !GLO.grupo || x.g.chave === GLO.grupo);
  return GLO_SITS.map(([v, n]) => { const qt = v ? base.filter((x) => sitCupom(x.cupom, x.situacao) === v).length : base.length;
    return `<button type="button" class="${cel ? "chip" : "gl-sb"}${GLO.sit === v ? " on" : ""}" data-gls="${v}" aria-pressed="${GLO.sit === v}">${v ? bolinha(null, v) : ""}${n}${cel ? " · " : " <b>"}${int(qt)}${cel ? "" : "</b>"}</button>`; }).join("");
}
function gruposGlossario() {
  const m = new Map();
  for (const x of GLO.lista || []) { if (!m.has(x.g.chave)) m.set(x.g.chave, { ...x.g, itens: [] }); m.get(x.g.chave).itens.push(x); }
  return [...m.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((g) => {
      // o prefixo dos cupons por loja vem dos dados (que exigem login), não fica escrito no código público do site
      const pre = g.chave === "FILIAL" ? prefixoComum(g.itens.map((x) => x.cupom)) : "";
      const frase = pre.length >= 3 ? `${g.frase} (${pre} + nº da filial)` : g.frase;
      return { ...g, desc: [frase, g.chave === "CRM" ? "" : resumoGrupo(g.itens)].filter(Boolean).join(" · ") || "Regras variadas" };
    });
}
// 22/10/2026: cupom da planilha que ainda não teve nenhuma venda (por isso não aparece nas outras telas).
// Na TV, um selo "0" compacto (a coluna Tipo é estreita); no celular, a etiqueta por extenso.
const gloSemVenda = (x, curto) => (x.usos !== 0 ? "" : curto
  ? '<span class="gl-zero" title="Sem vendas até agora" aria-label="Sem vendas até agora">0</span>'
  : '<span class="gl-sv">sem vendas</span>');
const gloTipo = (o) => (o === true ? '<span class="gl-ex oc">Oculto</span>' : o === false ? '<span class="gl-ex vis">Não oculto</span>' : '<span class="mut">—</span>');

// ---------------------------------------------------------------- TV / computador
function desenharGlossario() {
  const corpo = $("#glLinhas"); if (!corpo) return;
  const total = (GLO.lista || []).length, l = gloFiltrados();
  GLO.paginas = Math.max(1, Math.ceil(l.length / GLO.porPag));
  GLO.pag = Math.max(0, Math.min(GLO.pag, GLO.paginas - 1));
  const ini = GLO.pag * GLO.porPag, pg = l.slice(ini, ini + GLO.porPag);
  corpo.innerHTML = pg.map((x, i) => `<tr class="${encCls(x.cupom, x.situacao).trim()}"><td class="pos">${ini + i + 1}</td><td class="gl-cp">${bolinha(x.cupom, x.situacao)}${esc(x.cupom)}</td>
      <td><span class="gl-gr" style="--c:${x.g.cor}">${esc(x.g.nome)}</span></td><td>${esc(x.restricao)}</td>
      <td>${gloBenHtml(x.beneficio)}</td><td class="${x.minimo === "Sem mínimo" ? "mut" : ""}">${esc(x.minimo)}</td><td>${gloTipo(x.oculto)}${gloSemVenda(x, true)}</td></tr>`).join("")
    || `<tr><td colspan="7" class="gl-vazio">${total ? "Nenhum cupom encontrado com essa busca." : "A planilha de controle ainda não foi sincronizada."}</td></tr>`;
  const gs = $("#glSits"); if (gs) { gs.innerHTML = gloSitHtml(false); gs.hidden = !gs.innerHTML; }
  $("#glGrupos").innerHTML = [{ chave: "", nome: "Todos", cor: "var(--lima)", desc: "Todos os cupons da planilha de controle", itens: GLO.lista || [] }, ...gruposGlossario()]
    .map((g) => `<button type="button" class="gl-gb${g.chave === GLO.grupo ? " on" : ""}" data-glg="${esc(g.chave)}" style="--c:${g.cor}">
      <span class="t">${esc(g.nome)}</span><b>${int(g.itens.length)}</b><small>${esc(g.desc)}</small></button>`).join("");
  const filtrado = GLO.busca.trim() || GLO.grupo || GLO.sit;
  const info = !l.length ? "Nenhum cupom" : filtrado ? `<b>${int(l.length)}</b> ${l.length === 1 ? "cupom" : "cupons"}${GLO.busca.trim() ? ` com “${esc(GLO.busca.trim())}”` : ""}`
    : `Cupons <b>${int(ini + 1)}–${int(ini + pg.length)}</b> de ${int(total)}`;
  $("#glPag").innerHTML = `<div class="gl-pinfo"><span>${info}</span>${GLO.paginas > 1 ? `<span>página <b>${GLO.pag + 1}</b> de ${GLO.paginas}</span>` : ""}</div>
    ${GLO.paginas > 1 ? `<div class="gl-dots">${Array.from({ length: GLO.paginas }, (_, i) => `<button type="button" class="${i === GLO.pag ? "on" : ""}" data-glp="${i}">${i + 1}</button>`).join("")}</div>` : ""}`;
  const campo = $("#glBusca"); if (campo && campo.value !== GLO.busca) campo.value = GLO.busca;
  $("#glLimpar").hidden = !GLO.busca;
}

function ligarGlossario() {
  const sec = $("#telaGlossario"); if (!sec) return;
  document.addEventListener("click", (ev) => { if (ev.target.closest("[data-glo-abrir]")) GLO.aberto ? fecharGlossario() : abrirGlossario(); });
  $("#glBusca").addEventListener("input", (ev) => { GLO.busca = ev.target.value; GLO.pag = 0; interagiu(); desenharGlossario(); });
  sec.addEventListener("click", (ev) => {
    const g = ev.target.closest("[data-glg]"), p = ev.target.closest("[data-glp]"), st = ev.target.closest("[data-gls]");
    if (st) { GLO.sit = st.dataset.gls; GLO.pag = 0; }
    else if (g) { GLO.grupo = GLO.grupo === g.dataset.glg ? "" : g.dataset.glg; GLO.pag = 0; }
    else if (p) GLO.pag = +p.dataset.glp;
    else if (ev.target.closest("#glLimpar")) { GLO.busca = ""; GLO.pag = 0; $("#glBusca").focus(); }
    else return;
    interagiu(); desenharGlossario();
  });
}

// ---------------------------------------------------------------- celular
const celGlossario = () => (temGlossario() ? '<div class="bloco" id="celGlo"></div>' : "");
function desenharCelGlo() {
  const el = $("#celGlo"); if (!el) return;
  const l = gloFiltrados(), lim = GLO.celMais ? l.length : 30;
  el.innerHTML = `<h2>Glossário dos cupons</h2><div class="s">Regras de cada cupom da planilha de controle · Oculto: o cliente precisa informar o código</div>
    <input type="search" id="celGloBusca" placeholder="Buscar cupom pelo nome" autocomplete="off" aria-label="Buscar cupom" value="${esc(GLO.busca)}">
    <div class="chips">${[{ chave: "", nome: "Todos", itens: GLO.lista }, ...gruposGlossario()].map((g) => `<button class="chip${g.chave === GLO.grupo ? " on" : ""}" data-glg="${esc(g.chave)}">${esc(g.nome)} · ${int(g.itens.length)}</button>`).join("")}</div>
    ${gloTemSit() ? `<div class="chips">${gloSitHtml(true)}</div>` : ""}
    <div id="celGloLista">${l.slice(0, lim).map((x) => `<div class="gl-cel${encCls(x.cupom, x.situacao)}"><div class="c"><b>${bolinha(x.cupom, x.situacao)}${esc(x.cupom)}</b><span class="gl-gr" style="--c:${x.g.cor}">${esc(x.g.nome)}</span>${gloTipo(x.oculto)}</div>
      <div class="r">${gloBenHtml(x.beneficio)} · ${esc(x.minimo)}</div><div class="r mut">${esc(x.restricao)}${gloSemVenda(x)}</div></div>`).join("") || '<div class="vazio">Nenhum cupom encontrado.</div>'}</div>
    ${l.length > lim ? `<button class="btn-mais" data-glmais="1">Ver todos os ${int(l.length)} cupons</button>` : ""}`;
  $("#celGloBusca").oninput = (ev) => { GLO.busca = ev.target.value; const pos = ev.target.selectionStart; desenharCelGlo(); const c = $("#celGloBusca"); c.focus(); c.setSelectionRange(pos, pos); };
  el.onclick = (ev) => {
    const g = ev.target.closest("[data-glg]"), st = ev.target.closest("[data-gls]");
    if (st) { ev.stopPropagation(); GLO.sit = st.dataset.gls; desenharCelGlo(); }
    else if (g) { ev.stopPropagation(); GLO.grupo = GLO.grupo === g.dataset.glg ? "" : g.dataset.glg; desenharCelGlo(); }
    else if (ev.target.closest("[data-glmais]")) { ev.stopPropagation(); GLO.celMais = true; desenharCelGlo(); }
  };
}
