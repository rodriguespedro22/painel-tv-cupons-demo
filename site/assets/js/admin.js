// Administração — comportamento (script clássico, carregado no fim do <body>)
"use strict";
const CFG = Object.assign({ API_URL: "" }, window.PAINEL_CONFIG || {});
const DEMO = new URLSearchParams(location.search).get("demo") === "1";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NF = (o) => new Intl.NumberFormat("pt-BR", o);
const int = (v) => (v == null ? "–" : NF({ maximumFractionDigits: 0 }).format(v));
const brl = (v) => (v == null ? "–" : "R$ " + NF({ maximumFractionDigits: 0 }).format(v));
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "–");
const hora = (t) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "–");
function haQuanto(t) {
  if (!t) return "nunca";
  const m = Math.round((Date.now() - new Date(t)) / 60e3);
  return m < 2 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : m < 2880 ? "ontem" : `há ${Math.round(m / 1440)} dias`;
}
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const PERIODOS = { hoje: "Hoje (até a última atualização)", ontem: "Ontem (D-1)", "7dias": "Últimos 7 dias", "30dias": "Últimos 30 dias", semana: "Esta semana", semana_passada: "Semana passada", mes: "Este mês", mes_passado: "Mês passado", campanha: "Desde o início da campanha" };
function toast(msg, erro = false) { const t = $("#toast"); t.textContent = msg; t.className = "toast on" + (erro ? " erro" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 3600); }

// ---------------------------------------------------------------- servidor (ou simulação no modo demonstração)
async function chamar(corpo) {
  if (DEMO) return simular(corpo);
  try { return await Acesso.api(corpo); }
  catch (e) { if (Acesso.tratar(e)) return new Promise(() => {}); throw e; }
}
// janela simples (confirmações, formulários e credenciais)
function janela(html, largura = 520) {
  const m = document.createElement("div");
  m.className = "ac-modal";
  m.innerHTML = `<div class="ac-folha" role="dialog" aria-modal="true" style="width:min(${largura}px,100%)"><button class="fechar" aria-label="Fechar">×</button><div class="cont">${html}</div></div>`;
  const fechar = () => { m.remove(); removeEventListener("keydown", tecla, true); };
  const tecla = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); fechar(); } };
  m.addEventListener("click", (ev) => { if (ev.target === m || ev.target.closest(".fechar")) fechar(); });
  addEventListener("keydown", tecla, true);
  document.body.appendChild(m);
  m.querySelector("input,select,textarea,.btn.pri")?.focus();
  return { el: m.querySelector(".cont"), fechar };
}
function confirmar(titulo, texto, botao = "Confirmar", perigo = false) {
  return new Promise((ok) => {
    const j = janela(`<h3>${esc(titulo)}</h3><p class="ac-sub" style="margin:6px 0 20px">${texto}</p>
      <div class="acoes"><button class="btn" data-r="0">Cancelar</button><button class="btn ${perigo ? "exc" : "pri"}" data-r="1">${esc(botao)}</button></div>`, 460);
    j.el.onclick = (ev) => { const b = ev.target.closest("[data-r]"); if (!b) return; j.fechar(); ok(b.dataset.r === "1"); };
    j.el.querySelector('[data-r="1"]').focus();
  });
}

// ---------------------------------------------------------------- abas
const ABAS = [["cupons", "Cupons da campanha", "Quais cupons aparecem no painel"], ["usuarios", "Usuários", "Quem entra e o que cada um vê"],
  ["solicitacoes", "Solicitações", "Pedidos de acesso feitos na tela de login"],
  ["tvs", "TVs", "Telas autorizadas sem login"], ["acessos", "Acessos", "Registro de entradas e alterações"]];
let aba = (location.hash.slice(1) && ABAS.some(([k]) => k === location.hash.slice(1))) ? location.hash.slice(1) : "cupons";
const contagem = {};
function desenharAbas() {
  $("#abas").innerHTML = ABAS.map(([k, t]) => `<button data-aba="${k}" class="${k === aba ? "on" : ""}" aria-current="${k === aba}">${t}${contagem[k] != null ? `<span class="cont">${int(contagem[k])}</span>` : ""}</button>`).join("");
  $("#subtitulo").textContent = ABAS.find(([k]) => k === aba)[2];
}
addEventListener("hashchange", () => { const k = location.hash.slice(1); if (k !== aba && ABAS.some(([x]) => x === k)) { aba = k; abrirAba(); } });
$("#abas").onclick = (ev) => { const b = ev.target.closest("[data-aba]"); if (!b) return; aba = b.dataset.aba; history.replaceState(null, "", "#" + aba); abrirAba(); };
async function abrirAba() {
  desenharAbas(); $("#app").onclick = null;
  $("#app").innerHTML = '<div class="vazio">Carregando…</div>';
  try {
    if (aba === "cupons") { estado = await chamar({ acao: "estado" }); P = null; desenhar(); }
    else if (aba === "usuarios") { U = await chamar({ acao: "usuarios" }); desenharUsuarios(); }
    else if (aba === "solicitacoes") { S = await chamar({ acao: "solicitacoes" }); desenharSolicitacoes(); }
    else if (aba === "tvs") { T = await chamar({ acao: "tvs" }); desenharTvs(); }
    else if (aba === "acessos") { await carregarAcessos(); }
  } catch (e) { $("#app").innerHTML = `<div class="card"><h2>Não foi possível carregar</h2><div class="sub">${esc(e.message)}</div><button class="btn" type="button" id="tentarDeNovo">Tentar de novo</button></div>`; $("#tentarDeNovo").addEventListener("click", () => abrirAba()); }
}

// ---------------------------------------------------------------- regionais (seletor em chips)
// sel: null = todas · array = só estas
function chipsRegionais(sel, disponiveis, id) {
  const todas = !sel || !sel.length;
  const lista = [...new Set([...(disponiveis || []), ...(sel || [])])];
  return `<div class="regs" id="${id}"><label class="chip todas ${todas ? "on" : ""}"><input type="checkbox" value="*" ${todas ? "checked" : ""}>Todas as regionais</label>
    ${lista.map((r) => `<label class="chip ${!todas && sel.includes(r) ? "on" : ""}"><input type="checkbox" value="${esc(r)}" ${!todas && sel.includes(r) ? "checked" : ""}>${esc(r)}</label>`).join("")}</div>`;
}
function ligarChips(el) {
  el.onchange = (ev) => {
    const i = ev.target; if (!i.matches("input")) return;
    if (i.value === "*" && i.checked) $$("input", el).forEach((x) => (x.checked = x.value === "*"));
    else if (i.value !== "*" && i.checked) $("input[value='*']", el).checked = false;
    if (!$$("input:checked", el).length) $("input[value='*']", el).checked = true;
    $$("label", el).forEach((l) => l.classList.toggle("on", $("input", l).checked));
  };
}
const lerRegionais = (el) => ($("input[value='*']", el).checked ? null : $$("input:checked", el).map((i) => i.value));
const tagsRegionais = (r) => (r?.length ? r.map((x) => `<span class="regtag">${esc(x)}</span>`).join("") : '<span class="motivo">Todas</span>');

// =====================================================================  ABA 1 · CUPONS DA CAMPANHA (como antes)
let estado = null;
let filtro = "todos", busca = "", filtroTipo = "";
const tiposConhecidos = () => [...new Set([...(estado.tipos || []).map((t) => t.tipo).filter((t) => t !== "(sem tipo)"),
  ...String(estado.config?.campanha_tipos || "").split(",").map((t) => t.trim()).filter(Boolean)])];
const tiposCampanha = () => String(estado.config?.campanha_tipos || "").split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
const sel = new Set();
function desenhar() {
  const e = estado, c = e.config || {}, cs = e.cupons || [];
  $("#dadosAte").textContent = "Dados até " + dataBR(e.dados_ate);
  const na = cs.filter((x) => x.na_campanha), novos7 = cs.filter((x) => x.primeiro_uso && (new Date(e.dados_ate) - new Date(x.primeiro_uso)) / 864e5 < 7);
  const auto = cs.filter((x) => x.na_campanha && x.motivo.startsWith("automático"));
  $("#app").innerHTML = `
  <div class="resumo" id="resumoCupons">${resumoCupons()}</div>
  <section class="card" id="planilha">${cardPlanilha()}</section>
  <section class="card" id="conferencia">${cardConferencia()}</section>
  <div class="grid2">
    <section class="card">
      <h2>Configuração</h2>
      <div class="sub">Vale para a TV e para o modo análise. A TV aplica as mudanças em até 5 minutos (ou na hora, se recarregar a página).</div>
      <div class="cfg">
        <label class="campo">Início da campanha<input type="date" id="cIni" value="${esc(c.campanha_inicio)}"></label>
        <label class="campo">Cupons novos entram sozinhos?<select id="cAuto"><option value="sim">Sim — todo cupom com 1º uso a partir do início</option><option value="nao">Não — só os incluídos à mão ou por regra</option></select></label>
        <label class="campo">Período que a TV mostra ao abrir<select id="cPer">${Object.entries(PERIODOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
        <label class="campo">Segundos por tela na TV<input type="number" id="cSeg" min="10" max="600" value="${esc(c.segundos_por_tela || 30)}"></label>
        <label class="campo">Períodos incluem o dia de hoje?<select id="cHoje"><option value="sim">Sim — 7 dias, semana, mês e campanha vão até agora</option><option value="nao">Não — vão só até ontem (dias fechados)</option></select></label>
      </div>
      <div class="campo" style="margin-top:16px">Tipos que formam a campanha
        <div class="tiposCfg" id="cTipos">${tiposConhecidos().map((t) => `<label class="chip ${tiposCampanha().includes(t.toUpperCase()) ? "on" : ""}"><input type="checkbox" value="${esc(t)}" ${tiposCampanha().includes(t.toUpperCase()) ? "checked" : ""}>${esc(t)}</label>`).join("") || '<span class="motivo">Nenhum tipo carregado ainda.</span>'}
          <input type="text" id="cTipoNovo" placeholder="+ outro tipo (ex.: 70Milhoes)" maxlength="60" style="width:230px"></div>
        <span class="motivo" style="font-weight:400">Marcando algum tipo, a campanha passa a ser <b>exatamente os cupons desses tipos</b> (a regra por data deixa de valer). Exceções e regras por nome continuam vencendo.</span>
      </div>
      <div class="linha" style="margin-top:14px"><button class="btn pri" id="salvarCfg">Salvar configuração</button></div>
    </section>
    <section class="card">
      <h2>Regras por nome</h2>
      <div class="sub">Para quando muitos cupons seguem um padrão. Exceções cupom a cupom (tabela abaixo) sempre vencem as regras.</div>
      <div class="ajuda">Use <code>%</code> como curinga: <code>ANIV70%</code> = começa com ANIV70 · <code>%70ANOS%</code> = contém 70ANOS · <code>TESTE%</code> = todos os de teste.
        Se um cupom cair numa regra de <b>excluir</b> e numa de <b>incluir</b>, ele fica <b>fora</b>.</div>
      <form class="linha" id="fRegra" style="margin:14px 0">
        <label class="campo" style="flex:1">Padrão<input type="text" id="rPad" maxlength="60" placeholder="ex.: ANIV70%" required></label>
        <label class="campo">Ação<select id="rAc"><option value="incluir">Incluir</option><option value="excluir">Excluir</option></select></label>
        <label class="campo" style="flex:1">Observação<input type="text" id="rObs" maxlength="200" placeholder="opcional"></label>
        <button class="btn pri">Adicionar</button>
      </form>
      ${(e.regras || []).length ? `<table><thead><tr><th>Padrão</th><th>Ação</th><th class="n">Cupons</th><th>Observação</th><th></th></tr></thead><tbody>
        ${e.regras.map((r) => `<tr><td class="cup">${esc(r.padrao)}</td><td><span class="bd ${r.acao === "incluir" ? "sim" : "nao"}">${r.acao}</span></td><td class="n">${int(r.cupons)}</td><td class="motivo">${esc(r.observacao || "")}</td>
          <td class="n"><button class="btn min exc" data-rem="${r.id}">Remover</button></td></tr>`).join("")}</tbody></table>` : '<div class="vazio">Nenhuma regra ainda.</div>'}
    </section>
  </div>
  ${cardCargas(e.cargas)}
  <section class="card">
    <h2>Cupons</h2>
    <div class="sub">Todos os cupons com nome já usados. Na campanha = aparece no painel. Clique em Incluir/Excluir para decidir cupom a cupom; “Automático” devolve a decisão para as regras.</div>
    <div class="linha" style="margin-bottom:12px">
      <input type="search" id="busca" placeholder="Buscar cupom…" value="${esc(busca)}" style="flex:1;min-width:220px">
      <select id="fTipo"><option value="">Todos os tipos</option>${(e.tipos || []).map((t) => `<option ${t.tipo === filtroTipo ? "selected" : ""}>${esc(t.tipo)}</option>`).join("")}</select>
      <div class="seg" id="seg">${[["todos", "Todos"], ["sim", "Na campanha"], ["nao", "Fora"], ["novos", "Novos (7 dias)"], ["manual", "Com ajuste manual"]].map(([k, v]) => `<button data-f="${k}" class="${filtro === k ? "on" : ""}">${v}</button>`).join("")}</div>
    </div>
    <div class="massa" id="massa"><b id="nSel"></b><span style="flex:1"></span>
      <button class="btn min" data-massa="incluir">Incluir na campanha</button><button class="btn min" data-massa="excluir">Excluir da campanha</button><button class="btn min" data-massa="automatico">Voltar ao automático</button><button class="btn min" data-massa="tipo">Definir tipo…</button><button class="btn min" data-massa="limpar">Desmarcar</button></div>
    <div class="tabela"><table><thead><tr><th style="width:34px"><input type="checkbox" id="todosCk" aria-label="Marcar todos"></th><th>Cupom</th><th>Tipo</th><th>Situação</th><th>Por quê</th><th>1º uso</th><th>Último uso</th><th class="n">Usos</th><th class="n">Venda</th><th></th></tr></thead><tbody id="linhas"></tbody></table></div>
  </section>`;
  $("#cAuto").value = c.novos_entram || "sim"; $("#cPer").value = c.tv_periodo || "campanha"; $("#cHoje").value = c.incluir_hoje || "sim";
  desenharLinhas();
  $("#salvarCfg").onclick = salvarCfg;
  $("#fRegra").onsubmit = async (ev) => { ev.preventDefault(); await acao({ acao: "regra", padrao: $("#rPad").value.trim(), definir: $("#rAc").value, obs: $("#rObs").value.trim() }, "Regra adicionada"); };
  $$("[data-rem]").forEach((b) => (b.onclick = async () => (await confirmar("Remover regra", "A regra deixa de valer para os próximos cálculos do painel.", "Remover", true)) && acao({ acao: "regra", remover: +b.dataset.rem }, "Regra removida")));
  $("#busca").oninput = (ev) => { busca = ev.target.value.trim().toUpperCase(); desenharLinhas(); };
  $("#fTipo").onchange = (ev) => { filtroTipo = ev.target.value; desenharLinhas(); };
  $("#cTipos").onchange = (ev) => { const l = ev.target.closest(".chip"); if (l) l.classList.toggle("on", ev.target.checked); };
  $("#seg").onclick = (ev) => { const b = ev.target.closest("[data-f]"); if (!b) return; filtro = b.dataset.f; $$("#seg button").forEach((x) => x.classList.toggle("on", x === b)); desenharLinhas(); };
  $("#massa").onclick = async (ev) => { const b = ev.target.closest("[data-massa]"); if (!b) return;
    if (b.dataset.massa === "limpar") { sel.clear(); return desenharLinhas(); }
    if (b.dataset.massa === "tipo") return definirTipo();
    const lista = [...sel]; await acao({ acao: "cupons", cupons: lista, definir: b.dataset.massa }, `${lista.length} cupom(ns) atualizado(s)`); sel.clear(); desenharLinhas(); };
  $("#todosCk").onchange = (ev) => { visiveis().forEach((x) => (ev.target.checked ? sel.add(x.cupom) : sel.delete(x.cupom))); desenharLinhas(); };
  ligarPlanilha();
  if (!P) carregarPlanilha();
  ligarConferencia();
  if (!C) carregarConferencia();
}

// cartões do topo: cupons cadastrados na planilha × uso (desde o início da campanha)
function resumoCupons() {
  const cs = estado?.cupons || [], fora = cs.filter((x) => !x.na_campanha).length;
  const v = (n) => (P && !P.erro ? int(n) : "…");
  const mf = P?.manuais_fora?.length ? ` <span title="${esc(P.manuais_fora.join(", "))}">+ ${P.manuais_fora.length} fora da planilha incluídos à mão</span>` : "";
  return `
    <div class="num"><b>${v(P?.cupons)}</b><span>cupons cadastrados na planilha de controle${mf}</span></div>
    <div class="num" style="--c:var(--lima)"><b>${v(P?.com_uso)}</b><span>tiveram pelo menos um uso${P?.utilizacoes != null ? ` · ${int(P.utilizacoes)} utilizações` : ""}</span></div>
    <div class="num" style="--c:var(--lj)"><b>${v(P?.sem_uso)}</b><span>ainda sem nenhum uso</span></div>
    <div class="num" style="--c:var(--ruim)"><b>${int(fora)}</b><span>cupons usados fora da campanha (não estão na planilha nem foram incluídos)</span></div>`;
}

// ---------------------------------------------------------------- planilha de controle (SharePoint/OneDrive)
// O botão só registra o pedido. Quem lê e grava a planilha é o "executor": hoje o computador de carga
// (carga_local/planilha_sync.ps1); no futuro, a nuvem (Microsoft Graph). A tela não muda quando o executor mudar.
let P = null, pTimer = null;
const NOME_TAREFA = { cupons: "Sincronizar cupons", utilizados: "Atualizar utilizados" };
const nomeTarefa = (t) => (t.tipo === "cupons" && t.completo ? "Sincronizar tudo" : NOME_TAREFA[t.tipo]);
const VERSAO_SCRIPT = "1.2";   // versão atual do planilha_sync.ps1 (computador de carga)
const CAMPO_EXTRA = { criacao: "Criação do cupom", radio: "Rádio", limite_cpf: "Limite por CPF", pasta_audiencia: "Pasta da audiência", observacao: "Observação" };
const fmtValor = (v) => (v == null || v === "" ? "(vazio)" : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dataBR(v) : String(v));
async function carregarPlanilha() {
  try { P = await chamar({ acao: "planilha_estado" }); }
  catch (e) { P = { erro: e.message }; }
  if (aba !== "cupons" || !$("#planilha")) return;
  $("#planilha").innerHTML = cardPlanilha(); ligarPlanilha();
  if ($("#resumoCupons")) $("#resumoCupons").innerHTML = resumoCupons();
  clearTimeout(pTimer);
  const tinha = carregarPlanilha.abertas || 0; carregarPlanilha.abertas = P?.abertas?.length || 0;
  if (P && P.abertas?.length) pTimer = setTimeout(carregarPlanilha, 8000);   // acompanha até o computador concluir
  else if (tinha && P?.ultima_cupons) { try { estado = await chamar({ acao: "estado" }); C = null; const y = scrollY; desenhar(); scrollTo(0, y); toast("Planilha sincronizada"); } catch {} }
}
function executorAtual() {
  const ex = (P?.executores || [])[0];
  if (!ex) return { cor: "var(--ruim)", txt: "Nenhum computador conectado ainda — instale a atualização da carga (planilha_sync)." };
  const min = (Date.now() - new Date(ex.visto_em)) / 60e3, nome = ex.tipo === "nuvem" ? "Integração na nuvem" : "Computador de carga " + String(ex.executor).replace(/^notebook:/, "");
  if (min < 12) return { cor: "var(--bom)", txt: `${nome} · conectado (${haQuanto(ex.visto_em)})`, ok: true, antigo: (ex.versao || "0") < VERSAO_SCRIPT, pasta: ex.info?.pasta };
  return { cor: "var(--lj)", txt: `${nome} · sem contato ${haQuanto(ex.visto_em)}. O pedido fica na fila e roda quando ele ligar.` };
}
function resumoTarefa(t) {
  if (!t) return "ainda não rodou";
  if (t.status === "erro") return `<span style="color:var(--ruim)">erro em ${hora(t.concluido_em)}</span>`;
  const r = t.resultado || {};
  if (t.tipo === "cupons") {
    const mudou = [r.novos?.length && `${r.novos.length} novo(s)`, r.alterados?.length && `${r.alterados.length} alterado(s)`, r.removidos?.length && `${r.removidos.length} removido(s)`].filter(Boolean);
    // "alterados" só existe a partir da 9.5; antes disso não dá para afirmar "sem mudança"
    const nada = !mudou.length && Array.isArray(r.alterados) ? " · nenhuma mudança" : "";
    return `${hora(t.concluido_em)} · ${int(r.total)} cupons conferidos${r.completo ? " (tudo)" : ""}${mudou.length ? " · " + mudou.join(" · ") : nada}`;
  }
  return `${hora(t.concluido_em)} · ${int(r.alterados)} linha(s) alterada(s)`;
}
function cardPlanilha() {
  const cab = `<h2>Planilha de controle</h2>`;
  if (!P) return cab + '<div class="sub">Carregando…</div>';
  if (P.erro) return cab + `<div class="sub">Não foi possível ler a situação da planilha: ${esc(P.erro)}</div>`;
  const ex = executorAtual(), ab = P.abertas || [], uc = P.ultima_cupons, uu = P.ultima_utilizados;
  const r = uc?.resultado || {}, grupos = Object.entries(P.grupos || {}).sort((a, b) => b[1] - a[1]);
  const aviso = [];
  if (uc?.status === "erro") aviso.push(`<b style="color:var(--ruim)">Última sincronização com erro:</b> ${esc(uc.erro || "")}`);
  if (uu?.status === "erro") aviso.push(`<b style="color:var(--ruim)">Última atualização dos utilizados com erro:</b> ${esc(uu.erro || "")}`);
  if (r.duplicados?.length) aviso.push(`<b>Repetidos na planilha</b> (contados uma vez): <span class="pl-cods">${r.duplicados.map(esc).join(", ")}</span>`);
  if (r.novos?.length) aviso.push(`<b>Entraram na última sincronização:</b> <span class="pl-cods">${r.novos.slice(0, 40).map(esc).join(", ")}${r.novos.length > 40 ? "…" : ""}</span>`);
  if (ex.antigo) aviso.push(`<b style="color:var(--lj2)">O computador de carga está rodando uma versão antiga do script da planilha</b>${ex.pasta ? ` (pasta ${esc(ex.pasta)})` : ""}: algumas mudanças (como a base de clientes) não chegam ao painel.
    Na pasta <b>painel-tv-cupons\\scripts\\carga-local</b> do notebook, rode <b>4_instalar_agendamento.cmd</b> uma vez.`);
  if (r.alterados?.length && !r.detalhes?.length) aviso.push(`<b>Alterados na última sincronização:</b> <span class="pl-cods">${r.alterados.slice(0, 40).map(esc).join(", ")}${r.alterados.length > 40 ? "…" : ""}</span>`);
  if (r.detalhes?.length) aviso.push(`<b>O que mudou na última sincronização</b> (${int(r.alterados?.length || 0)} cupom(ns)):
    <div class="tabela pl-det"><table><thead><tr><th>Cupom</th><th>Campo</th><th>Antes</th><th>Agora</th></tr></thead><tbody>
    ${r.detalhes.slice(0, 200).map((d) => `<tr><td class="cup">${esc(d.cupom)}</td><td>${esc(CAMPO_EXTRA[d.campo] || d.campo)}</td><td class="motivo">${esc(fmtValor(d.antes))}</td><td><b>${esc(fmtValor(d.depois))}</b></td></tr>`).join("")}</tbody></table></div>`);
  if (r.removidos?.length) aviso.push(`<b>Saíram na última sincronização:</b> <span class="pl-cods">${r.removidos.slice(0, 40).map(esc).join(", ")}${r.removidos.length > 40 ? "…" : ""}</span>`);
  if ((P.manuais_fora || []).length) aviso.push(`<b>Na campanha sem estar na planilha</b> (incluídos à mão): <span class="pl-cods">${P.manuais_fora.map(esc).join(", ")}</span>`);
  return `${cab}
    <div class="pl-top"><div class="tx">
      <div class="sub" style="margin-bottom:6px"><b>${esc(P.config?.planilha_nome || "Controle Cupons 70 Milhoes.xlsx")}</b> é a lista oficial da campanha. Quem incluir uma linha na aba <b>Cupons</b> faz o cupom entrar no painel:
        sozinho, quando a planilha é salva, ou na hora pelo botão. <b>Sincronizar tudo</b> relê todas as linhas e colunas e mostra, campo a campo, o que mudou. A coluna <b>Utilizados</b> é preenchida com os números do painel 1× por dia (a partir das ${esc(P.config?.planilha_hora_utilizados || "07:00")}).</div>
      <div class="pl-exec" style="--c:${ex.cor}"><i></i>${esc(ex.txt)}</div></div>
      <div class="pl-bts"><button class="btn pri" id="plSync" ${ab.some((t) => t.tipo === "cupons") ? "disabled" : ""}>Sincronizar cupons</button>
        <button class="btn" id="plTudo" ${ab.some((t) => t.tipo === "cupons") ? "disabled" : ""} title="Relê todas as linhas e colunas da aba Cupons e mostra, campo a campo, o que mudou">Sincronizar tudo</button>
        <button class="btn" id="plUtil" ${ab.some((t) => t.tipo === "utilizados") ? "disabled" : ""}>Atualizar utilizados agora</button></div></div>
    ${ab.map((t) => `<div class="pl-and"><span class="gira"></span>${nomeTarefa(t)}: ${t.status === "executando" ? "em andamento no computador de carga…" : `pedido ${haQuanto(t.pedido_em)} — aguardando o computador de carga (até 5 min)`}</div>`).join("")}
    <div class="pl-nums">
      <div><b>${int(P.cupons)}</b><span>cupons na planilha${grupos.length ? " · " + grupos.map(([g, n]) => `${esc(g)} ${int(n)}`).join(" · ") : ""}</span></div>
      <div><b style="font-size:17px">${resumoTarefa(uc)}</b><span>última sincronização dos cupons</span></div>
      <div><b style="font-size:17px">${resumoTarefa(uu)}</b><span>últimos utilizados gravados na planilha</span></div>
    </div>
    ${aviso.length ? `<div class="ajuda pl-av">${aviso.join("<br>")}</div>` : ""}
    ${(P.historico || []).length ? `<details class="pl-hist"><summary>Histórico</summary><div class="tabela" style="max-height:260px;margin-top:8px"><table><thead><tr><th>Pedido</th><th>O quê</th><th>Origem</th><th>Por</th><th>Situação</th><th>Resultado</th></tr></thead><tbody>
      ${P.historico.map((t) => `<tr><td>${hora(t.pedido_em)}</td><td>${nomeTarefa(t)}</td><td>${{ botao: "Botão", automatico: "Automático", agenda: "Diário" }[t.origem] || esc(t.origem)}</td>
        <td class="motivo">${esc(t.pedido_por || "")}</td><td><span class="bd ${t.status === "ok" ? "sim" : t.status === "erro" ? "nao" : "ate"}">${esc(t.status)}</span></td>
        <td class="motivo">${t.status === "erro" ? esc(t.erro || "") : t.status === "ok" ? resumoTarefa(t).replace(/^[^·]*· /, "") : ""}</td></tr>`).join("")}</tbody></table></div></details>` : ""}`;
}
// ---------------------------------------------------------------- conferência planilha × vendas
// Dois desencontros que fazem um cupom "sumir" do painel: o cupom da planilha ainda não teve venda,
// ou a venda foi feita com um código um pouco diferente (ex.: EXPRESSFL241 no lugar de EXPRESS241).
let C = null;
async function carregarConferencia() {
  try { C = await chamar({ acao: "conferencia" }); }
  catch (e) { C = { erro: e.message }; }
  if (aba !== "cupons" || !$("#conferencia")) return;
  $("#conferencia").innerHTML = cardConferencia(); ligarConferencia();
}
function diasValendo(x, hoje) {
  if (!x.inicio) return '<span class="motivo">sem data</span>';
  if (x.inicio > hoje) return `<span class="motivo">começa ${dataBR(x.inicio)}</span>`;
  if (x.fim && x.fim < hoje) return `<span class="motivo">encerrado ${dataBR(x.fim)}</span>`;
  return x.dias === 0 ? "começou hoje" : `há ${int(x.dias)} dia(s)`;
}
function cardConferencia() {
  const cab = `<h2>Conferência dos cupons</h2>`;
  if (!C) return cab + '<div class="sub">Conferindo planilha × vendas…</div>';
  if (C.erro) return cab + `<div class="sub">Não foi possível conferir: ${esc(C.erro)}</div>`;
  const sv = C.sem_venda || [], fo = C.fora || [], hoje = C.hoje || new Date().toISOString().slice(0, 10);
  const comPar = fo.filter((f) => f.parece?.length).length;
  const tab = (cols, linhas, vazio) => linhas.length ? `<div class="tabela" style="max-height:340px"><table><thead><tr>${cols}</tr></thead><tbody>${linhas.join("")}</tbody></table></div>` : `<div class="vazio">${vazio}</div>`;
  return `${cab}
    <div class="sub">Por que um cupom da planilha não aparece no painel? Ou ele ainda não teve venda, ou a venda foi registrada com um código diferente do cadastrado.
      <b>${int(C.com_venda)}</b> de <b>${int(C.planilha)}</b> cupons da planilha já tiveram venda.</div>
    <div class="grid2 cf-grid">
      <div><h3 class="cf-t">Vendidos com código fora da planilha <span class="bd ${fo.length ? "ate" : "sim"}">${int(fo.length)}</span></h3>
        <div class="motivo" style="margin-bottom:8px">${comPar ? `${comPar === 1 ? "1 parece" : comPar + " parecem"} um cupom da planilha com o nome diferente — confira se foi digitado ou criado errado.` : "Códigos usados nas vendas que não estão na planilha."}</div>
        ${tab('<th>Código usado</th><th class="n">Usos</th><th>Último uso</th><th>Parece com</th>',
          fo.map((f) => `<tr${f.parece?.length ? ' class="cf-par"' : ""}><td class="cup">${esc(f.cupom)}</td><td class="n">${int(f.usos)}</td><td>${dataBR(f.ultimo)}</td>
            <td>${f.parece?.length ? f.parece.map((p) => `<b class="pl-cods">${esc(p)}</b>`).join(" ou ") : '<span class="motivo">—</span>'}</td></tr>`),
          "Todo código vendido está na planilha.")}</div>
      <div><h3 class="cf-t">Na planilha sem nenhuma venda <span class="bd ${sv.length ? "ate" : "sim"}">${int(sv.length)}</span></h3>
        <div class="motivo" style="margin-bottom:8px">Ficam fora das telas até a primeira venda. Os que valem há muitos dias merecem atenção.</div>
        <input type="search" id="cfBusca" placeholder="Buscar cupom…" style="width:100%;margin-bottom:8px">
        <div id="cfSem">${tabSemVenda(sv, hoje, "")}</div></div>
    </div>`;
}
function tabSemVenda(sv, hoje, q) {
  const l = q ? sv.filter((x) => x.cupom.includes(q)) : sv;
  if (!l.length) return `<div class="vazio">${q ? "Nenhum cupom encontrado." : "Todos os cupons da planilha já tiveram venda."}</div>`;
  return `<div class="tabela" style="max-height:300px"><table><thead><tr><th>Cupom</th><th>Grupo</th><th>Início</th><th>Valendo</th></tr></thead><tbody>
    ${l.map((x) => `<tr><td class="cup">${esc(x.cupom)}</td><td class="motivo">${esc(x.grupo || "")}</td><td>${dataBR(x.inicio)}</td><td>${diasValendo(x, hoje)}</td></tr>`).join("")}</tbody></table></div>`;
}
function ligarConferencia() {
  const b = $("#cfBusca");
  if (b && C && !C.erro) b.oninput = () => { $("#cfSem").innerHTML = tabSemVenda(C.sem_venda || [], C.hoje, b.value.trim().toUpperCase()); };
}
function ligarPlanilha() {
  const pedir = async (tipo, completo = false) => {
    try { P = await chamar({ acao: "planilha_pedir", tipo, completo }); toast(tipo === "cupons" ? `Pedido enviado. ${completo ? "A conferência completa" : "A lista"} atualiza em até 5 minutos.` : "Pedido enviado. Os utilizados são gravados em até 5 minutos."); }
    catch (e) { return toast(e.message, true); }
    $("#planilha").innerHTML = cardPlanilha(); ligarPlanilha(); clearTimeout(pTimer); pTimer = setTimeout(carregarPlanilha, 8000);
  };
  const s = $("#plSync"), u = $("#plUtil"), tudo = $("#plTudo");
  if (s) s.onclick = () => pedir("cupons");
  if (tudo) tudo.onclick = () => pedir("cupons", true);
  if (u) u.onclick = () => pedir("utilizados");
}
function definirTipo() {
  const j = janela(`<h3>Definir tipo</h3><p class="ac-sub" style="margin:4px 0 14px">Para ${sel.size} cupom(ns). Deixe em branco para tirar o tipo definido à mão. Quando o modelo trouxer o tipo, o do modelo passa a valer.</p>
    <form id="fTp" class="linha"><input type="text" id="tpNome" maxlength="60" placeholder="ex.: 70Milhoes" style="flex:1"><button class="btn pri">Salvar</button></form>`, 460);
  j.el.querySelector("#fTp").onsubmit = async (ev) => {
    ev.preventDefault(); const t = j.el.querySelector("#tpNome").value.trim(); j.fechar();
    await acao({ acao: "tipo", cupons: [...sel], tipo: t }, t ? `Tipo ${t} definido` : "Tipo manual removido"); sel.clear(); desenharLinhas();
  };
}
function visiveis() {
  const e = estado;
  return (e.cupons || []).filter((x) => (!busca || x.cupom.toUpperCase().includes(busca)) && (!filtroTipo || (x.tipo || "(sem tipo)") === filtroTipo) && (
    filtro === "todos" || (filtro === "sim" && x.na_campanha) || (filtro === "nao" && !x.na_campanha) || (filtro === "manual" && x.acao_manual) ||
    (filtro === "novos" && x.primeiro_uso && (new Date(e.dados_ate) - new Date(x.primeiro_uso)) / 864e5 < 7)));
}
function desenharLinhas() {
  const v = visiveis();
  $("#linhas").innerHTML = v.map((x) => `<tr>
    <td><input type="checkbox" data-ck="${esc(x.cupom)}" ${sel.has(x.cupom) ? "checked" : ""} aria-label="Marcar ${esc(x.cupom)}"></td>
    <td class="cup">${esc(x.cupom)}</td>
    <td>${x.tipo ? `<span class="tp">${esc(x.tipo)}</span>${x.tipo_origem === "manual" ? '<span class="motivo man" title="definido à mão"> ✎</span>' : ""}` : '<span class="motivo">—</span>'}</td>
    <td><span class="bd ${x.na_campanha ? "sim" : "nao"}">${x.na_campanha ? "Na campanha" : "Fora"}</span></td>
    <td class="motivo ${x.acao_manual ? "man" : ""}">${esc(x.motivo)}${x.observacao ? " · " + esc(x.observacao) : ""}</td>
    <td>${dataBR(x.primeiro_uso)}</td><td>${dataBR(x.ultimo_uso)}</td><td class="n">${int(x.vendas)}</td><td class="n">${brl(x.venda)}</td>
    <td class="n" style="white-space:nowrap">${x.na_campanha ? `<button class="btn min exc" data-um="excluir" data-c="${esc(x.cupom)}">Excluir</button>` : `<button class="btn min" data-um="incluir" data-c="${esc(x.cupom)}">Incluir</button>`}
      ${x.acao_manual ? `<button class="btn min" data-um="automatico" data-c="${esc(x.cupom)}" title="Tira o ajuste manual">Automático</button>` : ""}</td></tr>`).join("")
    || '<tr><td colspan="10" class="vazio">Nenhum cupom neste filtro.</td></tr>';
  $("#linhas").onclick = async (ev) => {
    const b = ev.target.closest("[data-um]");
    if (b) await acao({ acao: "cupons", cupons: [b.dataset.c], definir: b.dataset.um }, `${b.dataset.c}: ${b.dataset.um === "automatico" ? "volta ao automático" : b.dataset.um === "incluir" ? "incluído" : "excluído"}`);
  };
  $("#linhas").onchange = (ev) => { const c = ev.target.dataset.ck; if (!c) return; ev.target.checked ? sel.add(c) : sel.delete(c); atualizarMassa(); };
  atualizarMassa();
}
function cardCargas(l) {
  if (!l) return "";
  const nome = { "carga-auto": "Automática", "carga-local": "Manual", "edge-function": "Nuvem" };
  const ok = l.find((x) => x.status === "ok"), err = l[0] && l[0].status === "erro" ? l[0] : null;
  return `<section class="card">
    <h2>Cargas do Power BI</h2>
    <div class="sub">Última carga com sucesso: <b>${hora(ok && ok.fim)}</b>${ok && ok.dataset_atualizado_em ? ` · Power BI atualizado às <b>${hora(ok.dataset_atualizado_em)}</b>` : ""}.
      A carga automática roda no computador onde foi instalada (precisa estar ligado e com o usuário logado).</div>
    ${err ? `<div class="ajuda" style="border-color:var(--ruim)"><b>Último erro:</b> ${esc(err.mensagem || "")}</div>` : ""}
    <div class="tabela" style="max-height:260px"><table><thead><tr><th>Início</th><th>Tipo</th><th>Período</th><th>Power BI</th><th class="n">Linhas</th><th>Situação</th></tr></thead><tbody>
      ${l.map((x) => `<tr><td>${hora(x.inicio)}</td><td>${nome[x.origem_carga] || esc(x.origem_carga)}</td>
        <td>${x.periodo_de ? `${dataBR(x.periodo_de)} a ${dataBR(x.periodo_ate)}` : "–"}</td><td>${hora(x.dataset_atualizado_em)}</td>
        <td class="n">${x.linhas == null ? "–" : int(x.linhas)}</td>
        <td><span class="bd ${x.status === "ok" ? "sim" : x.status === "erro" ? "nao" : ""}" title="${esc(x.mensagem || "")}">${esc(x.status)}</span></td></tr>`).join("")}
    </tbody></table></div>
  </section>`;
}
function atualizarMassa() { $("#massa").classList.toggle("on", sel.size > 0); $("#nSel").textContent = `${sel.size} selecionado(s)`; }
async function salvarCfg() {
  const c = estado.config || {};
  const tps = $$("#cTipos input:checked").map((i) => i.value);
  const novo = $("#cTipoNovo").value.trim(); if (novo && !tps.some((t) => t.toUpperCase() === novo.toUpperCase())) tps.push(novo);
  const mud = [["campanha_inicio", $("#cIni").value], ["novos_entram", $("#cAuto").value], ["tv_periodo", $("#cPer").value], ["segundos_por_tela", String($("#cSeg").value)], ["incluir_hoje", $("#cHoje").value]].filter(([k, v]) => v && v !== c[k]);
  if (tps.join(",") !== (c.campanha_tipos || "")) mud.push(["campanha_tipos", tps.join(",")]);
  if (!mud.length) return toast("Nada mudou");
  for (const [k, v] of mud) if (!(await acao({ acao: "config", chave: k, valor: v }, null))) return;
  toast("Configuração salva");
}
async function acao(corpo, ok) {
  try { estado = await chamar(corpo); const y = scrollY; desenhar(); scrollTo(0, y); if (ok) toast(ok); return true; }
  catch (e) { toast(e.message, true); return false; }
}

// =====================================================================  ABA 2 · USUÁRIOS
let U = { usuarios: [], regionais: [] };
let fU = "todos", bU = "";
function situacao(u) {
  if (!u.ativo) return ["nao", "Inativo"];
  if (u.acesso_ate && u.acesso_ate < hojeBR()) return ["nao", "Acesso vencido"];
  if (u.trocar_senha) return ["ate", "Aguardando 1º acesso"];
  if (!u.tem_mfa) return ["ate", "Sem autenticador"];
  return ["sim", u.sessoes > 0 ? '<span class="on"></span>Conectado' : "Ativo"];
}
function desenharUsuarios() {
  const l = U.usuarios || [];
  contagem.usuarios = l.filter((u) => u.ativo).length; desenharAbas();
  const ativos = l.filter((u) => u.ativo), adm = l.filter((u) => u.perfil === "admin" && u.ativo), pend = l.filter((u) => u.ativo && (u.trocar_senha || !u.tem_mfa));
  $("#app").innerHTML = `
  <div class="resumo">
    <div class="num"><b>${int(ativos.length)}</b><span>usuários ativos</span></div>
    <div class="num" style="--c:var(--ve)"><b>${int(adm.length)}</b><span>administradores</span></div>
    <div class="num" style="--c:var(--lj)"><b>${int(pend.length)}</b><span>aguardando o 1º acesso (senha e autenticador)</span></div>
    <div class="num" style="--c:var(--lima)"><b>${int(l.filter((u) => u.sessoes > 0).length)}</b><span>conectados agora</span></div>
  </div>
  <div class="grid2 meio">
    <section class="card"><h2>Novo usuário</h2>
      <div class="sub">A pessoa recebe uma <b>senha provisória</b>. No primeiro acesso, o painel pede uma senha nova e a ativação do aplicativo autenticador no celular.</div>
      ${formUsuario({})}
    </section>
    <section class="card"><h2>Cadastrar vários</h2>
      <div class="sub">Uma pessoa por linha: <b>e-mail; nome; regionais</b>. Sem regionais = vê todas. Todos entram como usuário (não administrador).</div>
      <textarea id="lote" rows="7" placeholder="ana.souza@exemplo.com.br; Ana Souza; SERRA&#10;joao.lima@exemplo.com.br; João Lima; SUL, LITORAL&#10;diretoria@exemplo.com.br; Diretoria"></textarea>
      <div class="linha" style="margin-top:12px"><label class="campo" style="flex:1">Senha provisória para todos<input type="text" id="loteSenha" maxlength="72" placeholder="em branco = uma diferente para cada pessoa" autocomplete="off"></label>
        <button class="btn pri" id="loteOk">Cadastrar</button></div>
      <div id="loteRes"></div>
    </section>
  </div>
  <section class="card"><h2>Usuários</h2>
    <div class="sub">Mudanças de perfil ou de regionais encerram as sessões da pessoa, para valer na hora.</div>
    <div class="linha" style="margin-bottom:12px"><input type="search" id="bU" placeholder="Buscar nome ou e-mail…" value="${esc(bU)}" style="flex:1;min-width:220px">
      <div class="seg" id="fU">${[["todos", "Todos"], ["ativos", "Ativos"], ["pendentes", "1º acesso"], ["admin", "Administradores"], ["inativos", "Inativos"]].map(([k, v]) => `<button data-f="${k}" class="${fU === k ? "on" : ""}">${v}</button>`).join("")}</div></div>
    <div class="tabela"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Pode ver</th><th>Situação</th><th>Último acesso</th><th class="n">Ações</th></tr></thead><tbody id="uLinhas"></tbody></table></div>
  </section>`;
  ligarFormUsuario($("#app section.card"), null);
  $("#bU").oninput = (ev) => { bU = ev.target.value.trim().toLowerCase(); linhasUsuarios(); };
  $("#fU").onclick = (ev) => { const b = ev.target.closest("[data-f]"); if (!b) return; fU = b.dataset.f; $$("#fU button").forEach((x) => x.classList.toggle("on", x === b)); linhasUsuarios(); };
  $("#loteOk").onclick = cadastrarLote;
  linhasUsuarios();
}
function linhasUsuarios() {
  const l = (U.usuarios || []).filter((u) => (!bU || `${u.nome} ${u.email}`.toLowerCase().includes(bU)) && (fU === "todos" || (fU === "ativos" && u.ativo) ||
    (fU === "pendentes" && u.ativo && (u.trocar_senha || !u.tem_mfa)) || (fU === "admin" && u.perfil === "admin") || (fU === "inativos" && !u.ativo)));
  const eu = Acesso.estado.id;
  $("#uLinhas").innerHTML = l.map((u) => { const [cls, txt] = situacao(u); return `<tr>
    <td class="quem"><b>${esc(u.nome || "—")}${u.id === eu ? ' <span class="motivo">(você)</span>' : ""}</b><small>${esc(u.email)}</small></td>
    <td>${u.perfil === "admin" ? '<span class="bd adm">Administrador</span>' : '<span class="bd neu">Usuário</span>'}</td>
    <td>${u.perfil === "admin" ? '<span class="motivo">Tudo</span>' : tagsRegionais(u.regionais)}${u.acesso_ate ? `<div class="motivo">até ${dataBR(u.acesso_ate)}</div>` : ""}</td>
    <td><span class="bd ${cls}">${txt}</span></td>
    <td><span title="${esc(hora(u.ultimo_acesso))}">${haQuanto(u.ultimo_acesso)}</span></td>
    <td><div class="acoes"><button class="btn min" data-u="editar" data-id="${u.id}">Editar</button>
      ${u.id === eu ? "" : `<button class="btn min" data-u="redefinir" data-id="${u.id}" title="Nova senha provisória e novo cadastro do autenticador">Redefinir acesso</button>
      ${u.sessoes > 0 ? `<button class="btn min" data-u="encerrar" data-id="${u.id}">Encerrar sessão</button>` : ""}
      <button class="btn min exc" data-u="excluir" data-id="${u.id}">Excluir</button>`}</div></td></tr>`; }).join("")
    || '<tr><td colspan="6" class="vazio">Nenhum usuário neste filtro.</td></tr>';
  $("#uLinhas").onclick = (ev) => { const b = ev.target.closest("[data-u]"); if (b) acaoUsuario(b.dataset.u, U.usuarios.find((x) => x.id === b.dataset.id)); };
}
function formUsuario(u) {
  const novo = !u.id;
  return `<form class="fUsr" novalidate>
    <div class="cfg">
      <label class="campo">Nome<input type="text" name="nome" maxlength="120" value="${esc(u.nome || "")}" placeholder="Nome e sobrenome" required></label>
      <label class="campo">E-mail<input type="email" name="email" maxlength="254" value="${esc(u.email || "")}" ${novo ? (u._sol ? "readonly" : "") : "disabled"} placeholder="nome@exemplo.com.br" required></label>
      <label class="campo">Perfil<select name="perfil"><option value="usuario">Usuário — só vê o painel</option><option value="admin" ${u.perfil === "admin" ? "selected" : ""}>Administrador — vê tudo e gerencia</option></select></label>
      <label class="campo"><span>Acesso até <small>(opcional)</small></span><input type="date" name="acesso_ate" value="${esc(u.acesso_ate || "")}"></label>
    </div>
    <div class="campo bloco-reg" style="margin-top:14px">Regionais que pode ver ${chipsRegionais(u.regionais, U.regionais, "")}</div>
    ${novo ? `<label class="campo" style="margin-top:14px"><span>Senha provisória <small>(em branco = gerar automaticamente)</small></span><input type="text" name="senha" maxlength="72" autocomplete="off" placeholder="deixe em branco: uma senha diferente para cada pessoa (recomendado)"></label>`
      : `<label class="chip ${u.ativo ? "on" : ""}" style="margin-top:14px;align-self:flex-start"><input type="checkbox" name="ativo" ${u.ativo ? "checked" : ""}> Acesso ativo</label>`}
    <div class="linha" style="margin-top:16px;justify-content:flex-end"><button class="btn pri">${u._sol ? "Aprovar e criar acesso" : novo ? "Cadastrar usuário" : "Salvar alterações"}</button></div></form>`;
}
function ligarFormUsuario(alvo, u, aoSalvar) {
  const f = $(".fUsr", alvo), regs = $(".regs", f), bloco = $(".bloco-reg", f);
  ligarChips(regs);
  const ver = () => { bloco.style.display = f.perfil.value === "admin" ? "none" : ""; }; f.perfil.onchange = ver; ver();
  f.querySelector("[name=ativo]")?.addEventListener("change", (ev) => ev.target.closest(".chip").classList.toggle("on", ev.target.checked));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const corpo = { acao: "usuario_salvar", id: u?.id, nome: f.nome.value.trim(), email: f.email.value.trim(), perfil: f.perfil.value,
      regionais: f.perfil.value === "admin" ? null : lerRegionais(regs), acesso_ate: f.acesso_ate.value || null,
      ativo: u?.id ? f.ativo.checked : true, senha: f.senha?.value.trim() || undefined, solicitacao: u?._sol || undefined };
    if (!corpo.nome) return toast("Informe o nome.", true);
    if (!u && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(corpo.email)) return toast("Informe um e-mail válido.", true);
    const b = $(".btn.pri", f); b.disabled = true;
    try {
      const r = await chamar(corpo); U = { usuarios: r.usuarios, regionais: r.regionais };
      if (aoSalvar) aoSalvar();
      if (r.senha_provisoria) { if (u?._sol) abrirAba(); else desenharUsuarios(); mostrarCredenciais(corpo.nome, r.email || corpo.email, r.senha_provisoria, u?._sol ? "Acesso aprovado" : "Usuário cadastrado"); }
      else { desenharUsuarios(); toast("Alterações salvas"); }
    } catch (e) { toast(e.message, true); } finally { b.disabled = false; }
  };
}
function mostrarCredenciais(nome, email, senha, titulo) {
  const url = location.origin + location.pathname.replace(/admin(\.html)?$/, "");
  const msg = `Olá, ${String(nome || "").split(" ")[0] || ""}!\n\nSeu acesso ao Painel de Cupons da campanha Aurora está liberado.\n\nEndereço: ${url}\nE-mail: ${email}\nSenha provisória: ${senha}\n\nNo primeiro acesso, o painel vai pedir para você:\n1. Criar uma senha nova (só sua).\n2. Ativar o aplicativo autenticador no celular (Microsoft Authenticator ou Google Authenticator).\n\nQualquer dúvida, é só falar comigo.`;
  const j = janela(`<div class="ac-icone ok" style="font-size:30px;font-weight:900">✓</div><h3>${esc(titulo)}</h3><p class="ac-sub" style="margin:4px 0 8px">Envie estes dados <b>só para a própria pessoa</b> (no Teams, na conversa com ela). <b>A senha não aparece de novo</b> depois que você fechar esta janela.</p>
    <div class="credenciais"><span>E-mail</span><b>${esc(email)}</b><span>Senha</span><code>${esc(senha)}</code><span>Endereço</span><b>${esc(url)}</b></div>
    <textarea class="mensagem" readonly>${esc(msg)}</textarea>
    <div class="acoes" style="margin-top:12px"><button class="btn" data-c="senha">Copiar só a senha</button><button class="btn pri" data-c="msg">Copiar mensagem</button></div>`, 560);
  j.el.onclick = (ev) => { const b = ev.target.closest("[data-c]"); if (!b) return;
    navigator.clipboard?.writeText(b.dataset.c === "msg" ? msg : senha).then(() => toast("Copiado"), () => toast("Não foi possível copiar", true)); };
}
async function acaoUsuario(qual, u) {
  if (!u) return;
  try {
    if (qual === "editar") {
      const j = janela(`<h3>Editar usuário</h3><p class="ac-sub" style="margin:2px 0 14px">${esc(u.email)}</p>${formUsuario(u)}`, 640);
      ligarFormUsuario(j.el, u, j.fechar);
    } else if (qual === "redefinir") {
      if (!(await confirmar("Redefinir acesso", `<b>${esc(u.nome || u.email)}</b> recebe uma nova senha provisória e precisa cadastrar o autenticador de novo (útil quando a pessoa esquece a senha ou troca de celular). As sessões abertas são encerradas.`, "Redefinir"))) return;
      const r = await chamar({ acao: "usuario_redefinir", id: u.id }); U = r; desenharUsuarios();
      mostrarCredenciais(u.nome, u.email, r.senha_provisoria, "Acesso redefinido");
    } else if (qual === "encerrar") {
      U = await chamar({ acao: "usuario_encerrar", id: u.id }); desenharUsuarios(); toast("Sessões encerradas");
    } else if (qual === "excluir") {
      if (!(await confirmar("Excluir usuário", `<b>${esc(u.nome || u.email)}</b> perde o acesso e o cadastro é apagado. Para só bloquear por um tempo, use <b>Editar → Acesso ativo</b>.`, "Excluir", true))) return;
      U = await chamar({ acao: "usuario_excluir", id: u.id }); desenharUsuarios(); toast("Usuário excluído");
    }
  } catch (e) { toast(e.message, true); }
}
async function cadastrarLote() {
  const linhas = $("#lote").value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return toast("Cole ao menos uma linha.", true);
  if (linhas.length > 200) return toast("No máximo 200 por vez.", true);
  const senha = $("#loteSenha").value.trim(), conhecidas = new Set((U.regionais || []).map((r) => r.toUpperCase()));
  const res = [], b = $("#loteOk"); b.disabled = true;
  for (const [i, l] of linhas.entries()) {
    const [email = "", nome = "", regs = ""] = l.split(";").map((x) => x.trim());
    const regionais = regs ? regs.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean) : null;
    b.textContent = `Cadastrando ${i + 1} de ${linhas.length}…`;
    const desconhecidas = (regionais || []).filter((r) => !conhecidas.has(r));
    if (desconhecidas.length) { res.push({ email, ok: false, msg: "Regional não encontrada: " + desconhecidas.join(", ") }); continue; }
    try {
      const r = await chamar({ acao: "usuario_salvar", email, nome: nome || email.split("@")[0], perfil: "usuario", regionais, ativo: true, senha: senha || undefined });
      U = { usuarios: r.usuarios, regionais: r.regionais }; res.push({ email, nome, ok: true, senha: r.senha_provisoria });
    } catch (e) { res.push({ email, ok: false, msg: e.message }); }
  }
  b.disabled = false; b.textContent = "Cadastrar";
  const okL = res.filter((r) => r.ok);
  const tsv = "E-mail\tNome\tSenha provisória\n" + okL.map((r) => `${r.email}\t${r.nome}\t${r.senha}`).join("\n");
  desenharUsuarios();
  const j = janela(`<h3>Cadastro em lote</h3><p class="ac-sub" style="margin:4px 0 12px"><b>${okL.length}</b> cadastrado(s) · <b>${res.length - okL.length}</b> com problema. As senhas não aparecem de novo depois que você fechar.</p>
    <div class="tabela" style="max-height:340px"><table><thead><tr><th>E-mail</th><th>Resultado</th></tr></thead><tbody>
    ${res.map((r) => `<tr><td>${esc(r.email || "(vazio)")}</td><td>${r.ok ? `<code style="font-weight:800;color:var(--lj2)">${esc(r.senha)}</code>` : `<span class="motivo" style="color:var(--ruim)">${esc(r.msg)}</span>`}</td></tr>`).join("")}</tbody></table></div>
    <div class="acoes" style="margin-top:12px"><button class="btn pri" id="copTsv" ${okL.length ? "" : "disabled"}>Copiar lista (cola no Excel)</button></div>`, 620);
  j.el.querySelector("#copTsv").onclick = () => navigator.clipboard?.writeText(tsv).then(() => toast("Copiado"));
  if (okL.length === res.length) $("#lote").value = "";
}

// =====================================================================  ABA · SOLICITAÇÕES DE ACESSO
// Pedidos feitos na tela de login. Aprovar = criar o usuário (senha provisória própria) e enviar a senha só para a pessoa.
let S = { solicitacoes: [], regionais: [] };
function desenharSolicitacoes() {
  const l = S.solicitacoes || [], pend = l.filter((x) => x.status === "pendente"), feitas = l.filter((x) => x.status !== "pendente");
  contagem.solicitacoes = pend.length; desenharAbas();
  $("#app").innerHTML = `
  <section class="card"><h2>Pendentes</h2>
    <div class="sub">Antes de aprovar, confira no Teams se a pessoa que te chamou usa <b>o mesmo e-mail</b> da solicitação. A senha provisória é gerada na hora, diferente para cada pessoa: envie só para ela.</div>
    <div class="tabela"><table><thead><tr><th>Pessoa</th><th>Pedido</th><th>Origem</th><th class="n">Ações</th></tr></thead><tbody>
    ${pend.map((x) => `<tr><td class="quem"><b>${esc(x.nome)}</b><small>${esc(x.email)}</small>${x.ja_cadastrado ? '<div class="motivo" style="color:var(--lj2)">Já tem cadastro: veja na aba Usuários</div>' : ""}</td>
      <td><span title="${esc(hora(x.criada_em))}">${haQuanto(x.atualizada_em)}</span>${x.pedidos > 1 ? `<div class="motivo">pediu ${int(x.pedidos)} vezes</div>` : ""}</td>
      <td class="motivo">${esc(x.ip || "")}</td>
      <td><div class="acoes">${x.ja_cadastrado ? "" : `<button class="btn min pri" data-s="aprovar" data-id="${x.id}">Aprovar</button>`}<button class="btn min exc" data-s="recusar" data-id="${x.id}">${x.ja_cadastrado ? "Arquivar" : "Recusar"}</button></div></td></tr>`).join("")
      || '<tr><td colspan="4" class="vazio">Nenhuma solicitação pendente.</td></tr>'}
    </tbody></table></div></section>
  <section class="card"><h2>Decididas nos últimos 60 dias</h2>
    <div class="sub">Recusadas são apagadas depois de 90 dias; aprovadas, depois de 180.</div>
    <div class="tabela"><table><thead><tr><th>Pessoa</th><th>Decisão</th><th>Quando</th><th>Por</th></tr></thead><tbody>
    ${feitas.map((x) => `<tr><td class="quem"><b>${esc(x.nome)}</b><small>${esc(x.email)}</small></td>
      <td>${x.status === "aprovada" ? '<span class="bd sim">Aprovada</span>' : `<span class="bd nao">Recusada</span>${x.motivo ? `<div class="motivo">${esc(x.motivo)}</div>` : ""}`}</td>
      <td>${esc(hora(x.decidida_em))}</td><td class="motivo">${esc(x.decidida_por_nome || "")}</td></tr>`).join("")
      || '<tr><td colspan="4" class="vazio">Nada decidido ainda.</td></tr>'}
    </tbody></table></div></section>`;
  $("#app").onclick = async (ev) => {
    const b = ev.target.closest("[data-s]"); if (!b) return;
    const x = pend.find((y) => String(y.id) === b.dataset.id); if (!x) return;
    if (b.dataset.s === "aprovar") {
      if (!U.regionais?.length) U.regionais = S.regionais || [];
      const j = janela(`<h3>Aprovar acesso</h3><p class="ac-sub" style="margin:2px 0 14px">Escolha o perfil e as regionais que <b>${esc(x.nome)}</b> pode ver. Depois, envie a senha provisória para a pessoa pelo Teams.</p>
        ${formUsuario({ nome: x.nome, email: x.email, _sol: x.id })}`, 640);
      ligarFormUsuario(j.el, { nome: x.nome, email: x.email, _sol: x.id }, j.fechar);
    } else {
      const j = janela(`<h3>${x.ja_cadastrado ? "Arquivar" : "Recusar"} solicitação</h3><p class="ac-sub" style="margin:2px 0 14px"><b>${esc(x.nome)}</b> · ${esc(x.email)}</p>
        <label class="campo">Motivo <small>(opcional, só para o seu controle)</small><input type="text" id="sMot" maxlength="200" placeholder="${x.ja_cadastrado ? "já tinha cadastro" : "ex.: não é da equipe"}"></label>
        <div class="acoes" style="margin-top:16px"><button class="btn" data-r="0">Cancelar</button><button class="btn exc" data-r="1">${x.ja_cadastrado ? "Arquivar" : "Recusar"}</button></div>`, 480);
      j.el.onclick = async (e2) => { const r = e2.target.closest("[data-r]"); if (!r) return; if (r.dataset.r !== "1") return j.fechar();
        r.disabled = true;
        try { S = await chamar({ acao: "solicitacao_recusar", id: x.id, motivo: $("#sMot", j.el).value.trim() || (x.ja_cadastrado ? "já tinha cadastro" : "") }); j.fechar(); desenharSolicitacoes(); toast(x.ja_cadastrado ? "Arquivada" : "Solicitação recusada"); }
        catch (err) { r.disabled = false; toast(err.message, true); } };
    }
  };
}

// =====================================================================  ABA 3 · TVs
let T = { tvs: [], regionais: [] };
const conectada = (t) => t.ultimo_uso && Date.now() - new Date(t.ultimo_uso) < 15 * 60e3;
function desenharTvs() {
  const l = T.tvs || [], at = l.filter((t) => t.status === "ativa");
  contagem.tvs = at.length; desenharAbas();
  $("#app").innerHTML = `
  <div class="resumo">
    <div class="num"><b>${int(at.length)}</b><span>TVs autorizadas</span></div>
    <div class="num" style="--c:var(--lima)"><b>${int(at.filter(conectada).length)}</b><span>conectadas agora (últimos 15 min)</span></div>
    <div class="num" style="--c:var(--ruim)"><b>${int(l.length - at.length)}</b><span>revogadas</span></div>
  </div>
  <div class="grid2 meio">
    <section class="card"><h2>Cadastrar TV</h2>
      <div class="sub">A TV fica conectada direto, sem senha, sem código do celular e sem tempo de sessão. Ela só mostra o painel — não entra na administração.</div>
      <ol class="passosTv"><li><span>Na TV, abra o endereço do painel e escolha <b>“Esta tela é uma TV”</b> (ou abra <b>${esc(location.origin)}/?tv=parear</b>).</span></li>
        <li><span>Aparece um <b>código de 8 letras e números</b>, válido por 15 minutos.</span></li><li><span>Digite o código aqui, dê um nome e escolha as regionais.</span></li></ol>
      <form id="fTv" novalidate><div class="cfg">
        <label class="campo">Código que aparece na TV<input type="text" id="tvCod" class="cod" maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false"></label>
        <label class="campo">Nome da TV<input type="text" id="tvNome" maxlength="80" placeholder="ex.: TV Diretoria · 2º andar"></label></div>
        <div class="campo" style="margin-top:14px">Regionais que a TV mostra ${chipsRegionais(null, T.regionais, "tvRegs")}</div>
        <div class="linha" style="margin-top:16px;justify-content:flex-end"><button class="btn pri">Autorizar TV</button></div></form>
    </section>
    <section class="card"><h2>Bom saber</h2>
      <div class="ajuda" style="display:grid;gap:8px">
        <span><b>Revogar</b> desliga a TV na hora: ela volta para a tela do código.</span>
        <span><b>Trocar de aparelho:</b> revogue a TV antiga e cadastre a nova.</span>
        <span>A TV guarda a autorização só no navegador dela. Limpar os dados do navegador da TV exige cadastrar de novo.</span>
        <span>“Conectada agora” = a TV buscou dados nos últimos 15 minutos.</span></div>
    </section>
  </div>
  <section class="card"><h2>TVs</h2>
    <div class="tabela"><table><thead><tr><th>Nome</th><th>Mostra</th><th>Situação</th><th>Último contato</th><th>Autorizada em</th><th class="n">Ações</th></tr></thead><tbody>
    ${l.map((t) => `<tr><td class="quem"><b>${esc(t.nome || "TV")}</b><small>${esc((t.navegador || "").slice(0, 60))}</small></td><td>${tagsRegionais(t.regionais)}</td>
      <td>${t.status === "ativa" ? (conectada(t) ? '<span class="bd sim"><span class="on"></span>Conectada</span>' : '<span class="bd neu">Autorizada</span>') : '<span class="bd nao">Revogada</span>'}</td>
      <td><span title="${esc(hora(t.ultimo_uso))}">${haQuanto(t.ultimo_uso)}</span>${t.ultimo_ip ? `<div class="motivo">IP ${esc(t.ultimo_ip)}</div>` : ""}</td><td>${hora(t.aprovada_em)}</td>
      <td><div class="acoes">${t.status === "ativa" ? `<button class="btn min" data-t="editar" data-id="${t.id}">Editar</button><button class="btn min exc" data-t="revogar" data-id="${t.id}">Revogar</button>`
        : `<button class="btn min exc" data-t="excluir" data-id="${t.id}">Excluir</button>`}</div></td></tr>`).join("") || '<tr><td colspan="6" class="vazio">Nenhuma TV cadastrada ainda.</td></tr>'}
    </tbody></table></div></section>`;
  ligarChips($("#tvRegs"));
  const cod = $("#tvCod");
  cod.oninput = () => { const v = cod.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); cod.value = v.length > 4 ? v.slice(0, 4) + "-" + v.slice(4) : v; };
  $("#fTv").onsubmit = async (ev) => {
    ev.preventDefault();
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cod.value)) return toast("Digite o código de 8 letras e números que aparece na TV.", true);
    try { T = await chamar({ acao: "tv_aprovar", codigo: cod.value, nome: $("#tvNome").value.trim() || "TV", regionais: lerRegionais($("#tvRegs")) }); desenharTvs(); toast("TV autorizada. Em alguns segundos ela abre o painel."); }
    catch (e) { toast(e.message, true); }
  };
  $("#app").onclick = async (ev) => {
    const b = ev.target.closest("[data-t]"); if (!b) return;
    const t = T.tvs.find((x) => String(x.id) === b.dataset.id); if (!t) return;
    try {
      if (b.dataset.t === "editar") {
        const j = janela(`<h3>Editar TV</h3><form id="fTvE" style="margin-top:12px"><label class="campo">Nome<input type="text" id="eNome" maxlength="80" value="${esc(t.nome)}"></label>
          <div class="campo" style="margin-top:14px">Regionais ${chipsRegionais(t.regionais, T.regionais, "eRegs")}</div>
          <div class="linha" style="margin-top:16px;justify-content:flex-end"><button class="btn pri">Salvar</button></div></form>`, 600);
        ligarChips(j.el.querySelector("#eRegs"));
        j.el.querySelector("#fTvE").onsubmit = async (e2) => { e2.preventDefault();
          try { T = await chamar({ acao: "tv_salvar", id: t.id, nome: j.el.querySelector("#eNome").value.trim(), regionais: lerRegionais(j.el.querySelector("#eRegs")) }); j.fechar(); desenharTvs(); toast("TV atualizada"); }
          catch (e) { toast(e.message, true); } };
      } else if (b.dataset.t === "revogar") {
        if (!(await confirmar("Revogar TV", `A TV <b>${esc(t.nome)}</b> deixa de mostrar o painel na hora e volta para a tela do código.`, "Revogar", true))) return;
        T = await chamar({ acao: "tv_revogar", id: t.id }); desenharTvs(); toast("TV revogada");
      } else if (b.dataset.t === "excluir") {
        T = await chamar({ acao: "tv_excluir", id: t.id }); desenharTvs(); toast("TV excluída");
      }
    } catch (e) { toast(e.message, true); }
  };
}

// =====================================================================  ABA 4 · ACESSOS
const EVENTOS = {
  entrada: ["Entrou", "var(--bom)"], saida: ["Saiu", "var(--muted)"], negado: ["Acesso negado", "var(--ruim)"],
  sessao_expirada: ["Sessão encerrada (limite)", "var(--lj)"], sessao_inativa: ["Sessão encerrada (sem uso)", "var(--lj)"], senha_trocada: ["Trocou a senha", "var(--ve)"], planilha_cupons: ["Pediu sincronizar cupons", "var(--vc)"], planilha_utilizados: ["Pediu atualizar utilizados", "var(--vc)"],
  usuario_criado: ["Cadastrou usuário", "var(--ve)"], usuario_alterado: ["Alterou usuário", "var(--ve)"], usuario_redefinido: ["Redefiniu acesso", "var(--lj2)"],
  usuario_excluido: ["Excluiu usuário", "var(--ruim)"], usuario_sessoes_encerradas: ["Encerrou sessões", "var(--lj2)"],
  tv_aprovar: ["Autorizou TV", "var(--ve)"], tv_salvar: ["Alterou TV", "var(--ve)"], tv_revogar: ["Revogou TV", "var(--ruim)"], tv_excluir: ["Excluiu TV", "var(--ruim)"],
  solicitacao: ["Solicitou acesso", "var(--lj)"], solicitacao_recusada: ["Recusou solicitação", "var(--ruim)"],
  admin_cupons: ["Cupons da campanha", "var(--lima)"], admin_regra: ["Regra de cupom", "var(--lima)"], admin_tipo: ["Tipo de cupom", "var(--lima)"], admin_config: ["Configuração", "var(--lima)"],
};
let fA = "";
async function carregarAcessos() {
  if (!U.usuarios?.length) { try { U = await chamar({ acao: "usuarios" }); } catch { /* lista de nomes é opcional */ } }
  const r = await chamar({ acao: "acessos", limite: 300, usuario: fA || undefined });
  const nomes = new Map((U.usuarios || []).map((u) => [u.id, u.nome || u.email]));
  const det = (a) => {
    const d = a.detalhe || {}, p = [];
    if (d.alvo) p.push(nomes.get(d.alvo) || d.email || "usuário");
    if (d.email && !d.alvo) p.push(d.email);
    if (d.nome) p.push(d.nome);
    if (d.regionais !== undefined && (a.evento.startsWith("tv_") || a.evento.startsWith("usuario_"))) p.push(d.regionais?.length ? d.regionais.join(", ") : "todas as regionais");
    if (d.cupons?.length) p.push(d.cupons.slice(0, 4).join(", ") + (d.cupons.length > 4 ? "…" : ""));
    if (d.definir) p.push(d.definir); if (d.padrao) p.push(d.padrao);
    if (d.chave) p.push(`${d.chave} = ${d.valor}`);
    if (d.motivo) p.push(d.motivo);
    if (d.navegador) p.push(/Mobile|Android|iPhone/i.test(d.navegador) ? "celular" : "computador");
    return p.join(" · ");
  };
  $("#app").innerHTML = `<section class="card"><h2>Registro de acessos</h2>
    <div class="sub">Entradas, saídas, acessos negados e alterações feitas na administração. Fica guardado por 180 dias.</div>
    <div class="linha" style="margin-bottom:12px"><select id="fA"><option value="">Todas as pessoas</option>${(U.usuarios || []).map((u) => `<option value="${u.id}" ${u.id === fA ? "selected" : ""}>${esc(u.nome || u.email)}</option>`).join("")}</select>
      <button class="btn" id="atuA">Atualizar</button></div>
    <div class="tabela" style="max-height:72vh"><table><thead><tr><th>Quando</th><th>Quem</th><th>O que</th><th>Detalhe</th><th>IP</th></tr></thead><tbody>
    ${(r.acessos || []).map((a) => { const [t, c] = EVENTOS[a.evento] || [a.evento, "var(--muted)"]; return `<tr><td style="white-space:nowrap">${hora(a.em)}</td>
      <td>${esc(nomes.get(a.usuario_id) || a.quem || (a.tv_id ? "TV " + a.tv_id : "—"))}</td><td><span class="ev" style="--c:${c}">${esc(t)}</span></td>
      <td class="motivo">${esc(det(a))}</td><td class="motivo">${esc(a.ip || "")}</td></tr>`; }).join("") || '<tr><td colspan="5" class="vazio">Nada registrado ainda.</td></tr>'}
    </tbody></table></div></section>`;
  $("#fA").onchange = (ev) => { fA = ev.target.value; carregarAcessos(); };
  $("#atuA").onclick = () => carregarAcessos();
}

// =====================================================================  demonstração (nada é gravado)
let base = null;
async function simular(c) {
  await new Promise((r) => setTimeout(r, 150));
  if (!base) {
    base = await (await fetch("demo/admin.json")).json(); base.manual = {};
    base.cupons.forEach((x) => { if (x.acao_manual) base.manual[x.cupom] = { acao: x.acao_manual, obs: x.observacao }; });
    const agora = Date.now(), iso = (m) => new Date(agora - m * 60e3).toISOString();
    base.regionais = ["COSTA DOURADA", "LESTE", "COSTA AZUL", "CAPITAL", "VALE VERDE", "OESTE", "SERRA ALTA", "CAMPOS DO SUL", "RIOS"];
    base.usuarios = [
      { id: "u1", email: "admin@exemplo.com.br", nome: "Administrador", perfil: "admin", regionais: null, ativo: true, trocar_senha: false, tem_mfa: true, sessoes: 1, ultimo_acesso: iso(1) },
      { id: "u2", email: "ana.souza@exemplo.com.br", nome: "Ana Souza", perfil: "usuario", regionais: ["SERRA ALTA"], ativo: true, trocar_senha: false, tem_mfa: true, sessoes: 0, ultimo_acesso: iso(190) },
      { id: "u3", email: "joao.lima@exemplo.com.br", nome: "João Lima", perfil: "usuario", regionais: ["CAMPOS DO SUL", "COSTA AZUL"], ativo: true, trocar_senha: true, tem_mfa: false, sessoes: 0, ultimo_acesso: null },
      { id: "u4", email: "diretoria@exemplo.com.br", nome: "Diretoria Comercial", perfil: "usuario", regionais: null, ativo: true, trocar_senha: false, tem_mfa: true, sessoes: 2, ultimo_acesso: iso(12), acesso_ate: "2026-12-31" },
      { id: "u5", email: "carla.m@exemplo.com.br", nome: "Carla Menezes", perfil: "usuario", regionais: ["RIOS"], ativo: false, trocar_senha: false, tem_mfa: true, sessoes: 0, ultimo_acesso: iso(9000) }];
    base.tvs = [{ id: 1, nome: "TV Diretoria · 2º andar", status: "ativa", regionais: null, ultimo_uso: iso(2), ultimo_ip: "203.0.113.5", aprovada_em: iso(4000), navegador: "Mozilla/5.0 (SMART-TV; Tizen 6.5)" },
      { id: 2, nome: "TV Regional Serra Alta", status: "ativa", regionais: ["SERRA ALTA"], ultimo_uso: iso(600), aprovada_em: iso(3000), navegador: "Mozilla/5.0 (Linux; Android TV 11)" },
      { id: 3, nome: "TV sala de reunião (antiga)", status: "revogada", regionais: null, ultimo_uso: iso(20000), aprovada_em: iso(40000) }];
    base.acessos = [["entrada", "u1", 1], ["admin_config", "u1", 30, { chave: "tv_periodo", valor: "mes" }], ["tv_aprovar", "u1", 4000, { nome: "TV Diretoria · 2º andar", regionais: null }],
      ["entrada", "u4", 12, { navegador: "iPhone" }], ["negado", "u5", 300, { motivo: "inativo" }], ["sessao_inativa", "u2", 500], ["usuario_criado", "u1", 900, { alvo: "u3", regionais: ["CAMPOS DO SUL", "COSTA AZUL"] }]]
      .map(([evento, u, m, detalhe], i) => ({ id: i, evento, usuario_id: u, em: iso(m), detalhe: detalhe || null, ip: "187.4.1." + (10 + i) }));
  }
  const L = () => ({ usuarios: JSON.parse(JSON.stringify(base.usuarios)), regionais: base.regionais });
  const TV = () => ({ tvs: JSON.parse(JSON.stringify(base.tvs)), regionais: base.regionais });
  if (c.acao === "usuarios") return L();
  if (c.acao === "solicitacoes" || c.acao === "solicitacao_recusar") {
    base.sol ??= [{ id: 1, nome: "Mariana Teixeira", email: "mariana.teixeira@exemplo.com.br", status: "pendente", pedidos: 1, ip: "203.0.113.21", criada_em: new Date(Date.now() - 50 * 60e3).toISOString(), atualizada_em: new Date(Date.now() - 50 * 60e3).toISOString() },
      { id: 2, nome: "Carlos Eduardo dos Santos", email: "carlos.santos@exemplo.com.br", status: "pendente", pedidos: 2, ip: "203.0.113.8", criada_em: new Date(Date.now() - 300 * 60e3).toISOString(), atualizada_em: new Date(Date.now() - 20 * 60e3).toISOString() },
      { id: 3, nome: "Ana Souza", email: "ana.souza@exemplo.com.br", status: "pendente", pedidos: 1, ja_cadastrado: true, ip: "203.0.113.32", criada_em: new Date(Date.now() - 90 * 60e3).toISOString(), atualizada_em: new Date(Date.now() - 90 * 60e3).toISOString() },
      { id: 4, nome: "Roberta Lima", email: "roberta.lima@exemplo.com.br", status: "aprovada", decidida_em: new Date(Date.now() - 2 * 864e5).toISOString(), decidida_por_nome: "Administrador" }];
    if (c.acao === "solicitacao_recusar") Object.assign(base.sol.find((x) => x.id === c.id), { status: "recusada", motivo: c.motivo, decidida_em: new Date().toISOString(), decidida_por_nome: "Administrador" });
    return { solicitacoes: JSON.parse(JSON.stringify(base.sol)), regionais: base.regionais };
  }
  if (c.acao === "usuario_salvar") {
    if (!c.id && c.solicitacao && base.sol) Object.assign(base.sol.find((x) => x.id === c.solicitacao) || {}, { status: "aprovada", decidida_em: new Date().toISOString(), decidida_por_nome: "Administrador" });
    if (!c.id) { const senha = c.senha || "Aurora-" + Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6);
      base.usuarios.push({ id: "n" + Date.now() + Math.random(), email: c.email, nome: c.nome, perfil: c.perfil, regionais: c.regionais, ativo: true, trocar_senha: true, tem_mfa: false, sessoes: 0, ultimo_acesso: null, acesso_ate: c.acesso_ate });
      return { email: c.email, senha_provisoria: senha, ...L() }; }
    Object.assign(base.usuarios.find((u) => u.id === c.id), { nome: c.nome, perfil: c.perfil, regionais: c.regionais, ativo: c.ativo, acesso_ate: c.acesso_ate }); return L();
  }
  if (c.acao === "usuario_redefinir") { Object.assign(base.usuarios.find((u) => u.id === c.id), { trocar_senha: true, tem_mfa: false, sessoes: 0 }); return { senha_provisoria: "Aurora-k7Mq-4xPt", ...L() }; }
  if (c.acao === "usuario_encerrar") { base.usuarios.find((u) => u.id === c.id).sessoes = 0; return L(); }
  if (c.acao === "usuario_excluir") { base.usuarios = base.usuarios.filter((u) => u.id !== c.id); return L(); }
  if (c.acao === "tvs") return TV();
  if (c.acao === "tv_aprovar") { base.tvs.push({ id: Date.now(), nome: c.nome, status: "ativa", regionais: c.regionais, aprovada_em: new Date().toISOString(), ultimo_uso: new Date().toISOString() }); return TV(); }
  if (c.acao === "tv_salvar") { Object.assign(base.tvs.find((t) => t.id === c.id), { nome: c.nome, regionais: c.regionais }); return TV(); }
  if (c.acao === "tv_revogar") { base.tvs.find((t) => t.id === c.id).status = "revogada"; return TV(); }
  if (c.acao === "tv_excluir") { base.tvs = base.tvs.filter((t) => t.id !== c.id); return TV(); }
  if (c.acao === "planilha_estado" || c.acao === "planilha_pedir") {
    const agora = Date.now(), iso = (m) => new Date(agora - m * 60e3).toISOString();
    base.pl ??= { cupons: 252, com_uso: 68, sem_uso: 184, utilizacoes: 1247, grupos: { "Filial (DEMOFL)": 145, "Rádio": 79, CRM: 29 }, manuais_fora: ["ANIVEROUTUBRO", "PRIMEIRACOMPRA10", "VOLTE30"],
      executores: [{ executor: "notebook:LB8YWCVJ4", tipo: "notebook", versao: "1.2", visto_em: iso(2) }], abertas: [], config: { planilha_nome: "Controle Cupons 70 Milhoes.xlsx", planilha_hora_utilizados: "07:00" },
      ultima_cupons: { tipo: "cupons", status: "ok", concluido_em: iso(95), resultado: { total: 252, novos: ["BEIRARIO70"], removidos: [], duplicados: ["MARCIO70"] } },
      ultima_utilizados: { tipo: "utilizados", status: "ok", concluido_em: iso(700), resultado: { alterados: 64 } } };
    base.pl.historico = [base.pl.ultima_cupons, base.pl.ultima_utilizados].map((t, i) => ({ ...t, id: i, origem: i ? "agenda" : "automatico", pedido_em: t.concluido_em, pedido_por: "automático" }));
    if (c.acao === "planilha_pedir") base.pl.abertas = [{ tipo: c.tipo, completo: !!c.completo, status: "pendente", pedido_em: new Date().toISOString() }];
    else if (base.pl.abertas.length) { const t = base.pl.abertas[0]; base.pl.abertas = []; t.status = "ok"; t.concluido_em = new Date().toISOString();
      t.resultado = t.tipo === "cupons" ? { total: 252, novos: [], removidos: [], alterados: ["DEMOFL23"], duplicados: ["MARCIO70"], completo: t.completo,
        detalhes: [{ cupom: "DEMOFL23", campo: "Fim da validade", antes: "2026-10-31", depois: "2026-11-15" }, { cupom: "DEMOFL23", campo: "observacao", antes: null, depois: "Prorrogado" }] } : { alterados: 12 }; base.pl["ultima_" + t.tipo] = t; }
    return JSON.parse(JSON.stringify(base.pl));
  }
  if (c.acao === "conferencia") return { hoje: "2026-10-22", planilha: 252, com_venda: 68,   // datas fixas: a imagem de referência do teste não muda com o dia
    sem_venda: [{ cupom: "DEMOFL90", grupo: "Filial", inicio: "2026-10-02", fim: null, dias: 20 }, { cupom: "DEMORADIO7", grupo: "Rádio", inicio: "2026-10-16", fim: null, dias: 6 },
      { cupom: "DEMOCRM3", grupo: "CRM", inicio: "2026-10-25", fim: null, dias: -3 }],
    fora: [{ cupom: "DEMOXFL12", usos: 14, ultimo: "2026-10-21", parece: ["DEMOX12"] }, { cupom: "TESTE1", usos: 2, ultimo: "2026-10-13", parece: [] }] };
  if (c.acao === "acessos") return { acessos: base.acessos.filter((a) => !c.usuario || a.usuario_id === c.usuario) };
  // cupons da campanha: mesma regra de decisão do banco (cupom_situacao)
  if (c.acao === "cupons") for (const cp of c.cupons) c.definir === "automatico" ? delete base.manual[cp] : (base.manual[cp] = { acao: c.definir, obs: c.obs });
  if (c.acao === "regra") c.remover ? (base.regras = base.regras.filter((r) => r.id !== c.remover)) : base.regras.push({ id: Date.now(), padrao: c.padrao.toUpperCase(), acao: c.definir, observacao: c.obs });
  if (c.acao === "config") base.config[c.chave] = c.valor;
  if (c.acao === "tipo") base.cupons.forEach((x) => { if (c.cupons.includes(x.cupom)) { if (c.tipo) { x.tipo = c.tipo; x.tipo_origem = "manual"; } else if (x.tipo_origem === "manual") { x.tipo = null; x.tipo_origem = null; } } });
  const like = (s, p) => new RegExp("^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i").test(s);
  const ini = base.config.campanha_inicio, auto = base.config.novos_entram !== "nao";
  const tps = String(base.config.campanha_tipos || "").split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  base.cupons.forEach((x) => {
    const m = base.manual[x.cupom], rs = base.regras.filter((r) => like(x.cupom, r.padrao));
    const ex = rs.some((r) => r.acao === "excluir"), inc = rs.some((r) => r.acao === "incluir");
    x.acao_manual = m?.acao || null; x.observacao = m?.obs || null;
    const doTipo = !!x.tipo && tps.includes(x.tipo.toUpperCase());
    x.na_campanha = m ? m.acao === "incluir" : ex ? false : inc ? true : tps.length ? doTipo : auto && x.primeiro_uso >= ini;
    x.motivo = m ? (m.acao === "incluir" ? "incluído manualmente" : "excluído manualmente") : ex ? "excluído por regra" : inc ? "incluído por regra"
      : tps.length ? (doTipo ? "tipo " + x.tipo : x.tipo ? `tipo ${x.tipo} não é da campanha` : "sem tipo")
      : auto && x.primeiro_uso >= ini ? "automático (novo na campanha)" : "fora (usado antes da campanha)";
  });
  base.regras.forEach((r) => (r.cupons = base.cupons.filter((x) => like(x.cupom, r.padrao)).length));
  const g = {}; base.cupons.forEach((x) => { const t = x.tipo || "(sem tipo)"; g[t] ??= { tipo: t, cupons: 0, na_campanha: 0, venda: 0, tem_manual: false };
    g[t].cupons++; g[t].na_campanha += x.na_campanha ? 1 : 0; g[t].venda += +x.venda || 0; g[t].tem_manual ||= x.tipo_origem === "manual"; });
  base.tipos = Object.values(g).sort((a, b) => b.venda - a.venda);
  const { usuarios, tvs, acessos, regionais, manual, pl, ...resto } = base;
  return JSON.parse(JSON.stringify(resto));
}

// ---------------------------------------------------------------- início
(async function iniciar() {
  if (DEMO) {
    $("#modoDemo").innerHTML = '<span class="demo">DEMONSTRAÇÃO · nada é gravado</span>';
    Object.defineProperty(window, "Acesso", { value: { estado: { id: "u1" }, botaoUsuario: () => "", tratar: () => false } });
  } else {
    await Acesso.iniciar({ destino: "admin" });
    $("#usuario").innerHTML = Acesso.botaoUsuario();
  }
  abrirAba();
  // contador de solicitações pendentes na aba (sem abrir a aba)
  if (aba !== "solicitacoes") chamar({ acao: "solicitacoes" }).then((r) => { S = r; contagem.solicitacoes = (r.solicitacoes || []).filter((x) => x.status === "pendente").length || null; desenharAbas(); }).catch(() => {});
})();
