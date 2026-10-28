// Painel TV / modo análise — comportamento (script clássico, carregado no fim do <body>)
/* exported aoCarregarGlossario */
/* global GLO, carregarGlossario, desenharGlossario, naPagGlo, celGlossario, desenharCelGlo, ligarGlossario, botaoGlossario, abrirGlossario, fecharGlossario, sairGlossario, ligarAjuda, creditoTexto */
"use strict";
const CFG = Object.assign({ API_URL: "", SEGUNDOS_POR_TELA: 30, HORA_ATUALIZACAO: "06:00", PAUSA_SEGUNDOS: 120, VOLTAR_PADRAO_MINUTOS: 10,
  MINUTOS_DADOS: 5, ALERTA_ATRASO_MINUTOS: 90, MOSTRAR_MARGEM: false,
  SEGUNDOS_POR_PAGINA: 8,          // (sem uso: as páginas da tela Filiais só mudam pelo usuário)
  FILIAIS_LINHAS: 15 }, window.PAINEL_CONFIG || {});   // linhas por coluna (2 colunas por página)
const Q = new URLSearchParams(location.search);
const DEMO = Q.get("demo") === "1";
// Acesso: login (e-mail + senha + autenticador), TV pareada ou link antigo (transição) — ver auth.js
let ACESSO = { tipo: DEMO ? "demo" : null };
let REG_PERM = null;                      // regionais que o usuário/TV pode ver (null = todas)
const rotuloTodas = () => (!REG_PERM ? "Todas as regionais" : REG_PERM.length === 1 ? REG_PERM[0] : "Todas as minhas regionais");
const ANALISE = Q.get("modo") === "analise";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NF = (o) => new Intl.NumberFormat("pt-BR", o);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (v) => (v == null ? "–" : NF({ maximumFractionDigits: 0 }).format(v));
const pct = (v, d = 1) => (v == null ? "–" : NF({ style: "percent", minimumFractionDigits: d, maximumFractionDigits: d }).format(v));
const pctAuto = (v) => (v == null ? "–" : pct(v, Math.abs(v) < 0.01 ? 2 : 1));
function brl(v, curto = true) {
  if (v == null) return "–";
  const a = Math.abs(v), f1 = NF({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (curto && a >= 1e9) return "R$ " + f1.format(v / 1e9) + " bi";
  if (curto && a >= 1e6) return "R$ " + f1.format(v / 1e6) + " mi";
  if (curto && a >= 1e4) return "R$ " + NF({ maximumFractionDigits: 0 }).format(v / 1e3) + " mil";
  return "R$ " + NF({ maximumFractionDigits: 0 }).format(v);
}
// números dos cartões principais: mais casas depois da vírgula (R$ 1,12 mi · R$ 50,5 mil)
function brlK(v) {
  if (v == null || isNaN(v)) return "–";
  const a = Math.abs(v), f = (x, d) => NF({ minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  if (a >= 1e6) return "R$ " + f(v / 1e6, 2) + " mi";
  if (a >= 1e4) return "R$ " + f(v / 1e3, 1) + " mil";
  return "R$ " + NF({ maximumFractionDigits: 0 }).format(v);
}
const dataBR = (s) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "–");
const dm = (s) => s.slice(8, 10) + "/" + s.slice(5, 7);
const semana = (s) => new Date(s + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });

// ---------------------------------------------------------------- celular: tela estreita usa o layout em coluna
const MQ_CEL = matchMedia("(max-width: 900px)");
const CEL = { verFiliais: false, datas: false };
function modoCel() { document.documentElement.classList.toggle("cel", MQ_CEL.matches); document.body.classList.toggle("cel", MQ_CEL.matches); if (ultimo && MQ_CEL.matches) desenharCel(ultimo); }
MQ_CEL.addEventListener?.("change", modoCel);

// ---------------------------------------------------------------- escala do palco
function escalar() { $("#stage").style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; }
addEventListener("resize", escalar); escalar();

// ---------------------------------------------------------------- estado (o link define a visão padrão)
const PERIODOS = [["hoje", "Hoje"], ["ontem", "Ontem"], ["7dias", "7 dias"], ["semana_passada", "Semana passada"], ["mes", "Este mês"], ["mes_passado", "Mês passado"]];
const PERIODOS_OCULTOS_BARRA = new Set(["7dias", "semana_passada", "mes_passado"]);   // fora da barra da TV para caber a tela nova (continuam no celular e nos links)
const lerEstado = () => ({
  tela: 0,
  periodo: Q.get("periodo") || "",        // vazio = o que estiver configurado no painel de administração
  inicio: Q.get("inicio") || "", fim: Q.get("fim") || "",
  cupons: (Q.get("cupons") || "").split(",").map((s) => s.trim()).filter(Boolean),
  tipos: (Q.get("tipos") || "").split(",").map((s) => s.trim()).filter(Boolean),
  situacao: ["ativo", "encerrado"].includes(Q.get("situacao")) ? Q.get("situacao") : "",   // só cupons ativos ou só encerrados (validade da planilha)
  regional: Q.get("regional") || "",
  filial: Q.get("filial") || "",          // ex.: 098-Camaqua (a regional vem junto)
  depto: Q.get("depto") || "", setor: Q.get("depto") ? Q.get("setor") || "" : "",   // filtro de departamento (e setor dentro dele)
  escopo: "todos",   // sempre todos os cupons (não filtra só os da campanha)
});
const PADRAO = lerEstado();
let est = lerEstado();
const chaveDados = (e) => JSON.stringify([e.periodo, e.inicio, e.fim, e.cupons, e.tipos, e.situacao, e.regional, e.filial, e.escopo, e.depto, e.setor]);
const diferenteDoPadrao = () => chaveDados(est) !== chaveDados(PADRAO);

// ---------------------------------------------------------------- dados
const cache = new Map();
// demonstração: o filtro de situação só tira das listas os cupons da outra situação (os totais fictícios não mudam)
function demoSituacao(d, s) {
  const ok = (c) => (d.vigencia || {})[String(c || "").toUpperCase()] === s;
  d.ranking = (d.ranking || []).filter((x) => ok(x.cupom));
  (d.clientes?.grupos || []).forEach((g) => { g.cupons = g.cupons.filter((x) => ok(x.cupom)); });
  if (d.midia) d.midia.cupons = (d.midia.cupons || []).filter((x) => ok(x.cupom));
  return d;
}
async function buscar(e, extra, auto = false) {
  if (DEMO) {
    if (extra?.acao === "cupons") return (await fetch("demo/cupons.json")).json();
    const arq = e.tipos.length ? "painel_tipo" : e.cupons.length ? "painel_filtro" : "painel_" + (e.periodo && e.periodo !== "personalizado" ? e.periodo : "campanha");
    const d = await (await fetch(`demo/${arq}.json`)).json();
    return e.situacao ? demoSituacao(d, e.situacao) : d;
  }
  const p = new URLSearchParams();
  if (extra) for (const k in extra) p.set(k, extra[k]);
  else {
    if (e.periodo) p.set("periodo", e.periodo);
    if (e.periodo === "personalizado") { p.set("inicio", e.inicio); p.set("fim", e.fim); }
    if (e.cupons.length) p.set("cupons", e.cupons.join(","));
    if (e.tipos.length) p.set("tipos", e.tipos.join(","));
    if (e.situacao) p.set("situacao", e.situacao);
    if (e.regional) p.set("regional", e.regional);
    if (e.filial) p.set("filial", e.filial);
    if (e.depto) { p.set("depto", e.depto); if (e.setor) p.set("setor", e.setor); }
    if (e.escopo === "todos") p.set("escopo", "todos");
  }
  const r = await fetch(CFG.API_URL + "?" + p, { headers: await Acesso.cabecalhos(auto), cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.erro || "HTTP " + r.status), { codigo: j.codigo || "", status: r.status });
  if (j.acesso) REG_PERM = j.acesso.regionais?.length ? j.acesso.regionais : null;
  return j;
}
let ultimo = null, pedido = 0, funcaoAntiga = false, HORA_TXT = "";
async function carregar(forcar = false, auto = false) {
  const k = chaveDados(est), n = ++pedido;
  try {
    let d = !forcar && cache.get(k);
    if (!d || Date.now() - d.t > 3 * 60e3) { d = { t: Date.now(), j: await buscar(est, null, auto) }; cache.set(k, d); }
    if (n !== pedido) return;          // chegou uma resposta antiga depois de outra escolha
    ultimo = d.j;
    funcaoAntiga = !ultimo.periodo?.codigo;
    if (!est.periodo && ultimo.periodo?.codigo) est.periodo = PADRAO.periodo = ultimo.periodo.codigo;
    const s = +ultimo.campanha?.segundos_por_tela; if (s >= 10) CFG.SEGUNDOS_POR_TELA = s;
    desenharTudo();
    carregarGlossario();   // a lista muda pouco: guarda por 30 min
    if (!LISTA_FIL) filiaisDisponiveis().then(() => { if (MQ_CEL.matches && ultimo) desenharCel(ultimo); });
    if (!LISTA_DEP && MQ_CEL.matches) deptosDisponiveis().then(() => { if (MQ_CEL.matches && ultimo) desenharCel(ultimo); });
  } catch (e) {
    if (!DEMO && Acesso.tratar(e)) return;                       // sessão terminou, TV desautorizada etc.
    if (e.codigo === "regional" && (est.regional || est.filial)) { aplicar({ regional: "", filial: "" }); return; }   // regional fora da permissão
    console.error("painel:", e);
    const msg = esc(String(e.message || e).replace(/([?&]k=)[^&\s]*/g, "$1***").slice(0, 140));
    $("#status").innerHTML = ultimo ? `<span class="badge alerta">Sem conexão · mostrando último dado</span>` : `<span class="badge alerta">Sem conexão com os dados</span> ${msg}`;
  }
}


// ---------------------------------------------------------------- filiais disponíveis para o filtro (com a regional)
let LISTA_FIL = null;
async function filiaisDisponiveis() {
  if (LISTA_FIL) return LISTA_FIL;
  try {
    if (DEMO) {
      const d = await (await fetch("demo/painel_campanha.json")).json();
      LISTA_FIL = (d.filiais || []).filter((x) => x.regional && x.regional !== "(sem regional)").map((x) => ({ filial: x.filial, regional: x.regional }));
    } else LISTA_FIL = await buscar(est, { acao: "filiais" });
    if (!Array.isArray(LISTA_FIL)) LISTA_FIL = null;
  } catch (e) { console.error("filiais:", e); LISTA_FIL = null; }
  return LISTA_FIL || [];
}
const rotuloFilial = (f) => { const p = partesFilial(f); return p.num ? `${p.num} ${p.nome}` : p.nome; };
const regionalDaFilial = (f) => (LISTA_FIL || []).find((x) => x.filial === f)?.regional || "";
const MODO_FIL = () => !!(ultimo && ultimo.filial_filtro);
// filtro de departamento/setor: valores = itens do departamento (setor); totais = venda do mesmo departamento (setor)
const nomeDep = (s) => titulo(String(s || "").replace(/^MOVEIS$/i, "Móveis"));
const DEP = () => (est.depto ? (est.setor ? nomeDep(est.setor) : nomeDep(est.depto)) : "");
const QUEM = () => (MODO_FIL() ? "da filial" : "da rede") + (DEP() ? ` em ${DEP()}` : "");
const QUEM_CURTO = () => (MODO_FIL() ? "Filial" : "Rede") + (DEP() ? ` · ${DEP()}` : "");

// conversão do cupom: usados desde o início ÷ "Base de clientes (qtd.)" da planilha (null = base não preenchida → fica em branco)
function conversao(d, cupom) {
  const l = d.limites && d.limites[String(cupom || "").trim().toUpperCase()];
  if (!l || !(+l.base > 0)) return null;
  return { base: +l.base, usos: +l.usos || 0, taxa: (+l.usos || 0) / +l.base };
}
const temConversao = (d) => !!d.limites && Object.values(d.limites).some((l) => +l?.base > 0);   // algum cupom com base de clientes
// situação do cupom pelas datas de validade da planilha (função painel → "vigencia"): bolinha verde = ativo, cinza vazada = encerrado
const SIT_TXT = { ativo: "Ativo", encerrado: "Encerrado" };
function sitCupom(cupom, s) {
  const v = s !== undefined && s !== null ? s : ultimo?.vigencia?.[String(cupom || "").trim().toUpperCase()];
  return SIT_TXT[v] ? v : null;   // "agendado" (ainda não começou) e cupom fora da planilha: sem bolinha
}
const bolinha = (cupom, s) => { const v = sitCupom(cupom, s); return v ? `<i class="sit${v === "encerrado" ? " off" : ""}" title="${SIT_TXT[v]}" aria-label="${SIT_TXT[v]}"></i>` : ""; };
const encCls = (cupom, s) => (sitCupom(cupom, s) === "encerrado" ? " enc" : "");
const legendaSit = () => (ultimo?.vigencia && Object.keys(ultimo.vigencia).length
  ? '<span class="leg-sit"><span><i class="sit"></i>ativo</span><span><i class="sit off"></i>encerrado</span></span>' : "");
const convTxt = (v) => (v == null ? "–" : pct(v, v > 0 && v < 0.001 ? 2 : 1));

// ---------------------------------------------------------------- desenho
function desenharTudo() {
  const d = ultimo; if (!d) return;
  desenharCabecalho(d); desenharRail();
  if (MQ_CEL.matches) desenharCel(d);
  const p = d.periodo || {};
  const aguardando = p.dias <= 0;
  $$(".tela").forEach((t) => t.classList.toggle("vazia", aguardando));
  if (aguardando) { FIL.lista = FIL.itens = []; FIL.paginas = 1; $("#mini").innerHTML = ""; return desenharAguardando(d); }
  desenharResultado(d); desenharMini(d); desenharRanking(d); desenharOnde(d); desenharFiliais(d); desenharMidia(d); desenharClientes(d);
}

function desenharCabecalho(d) {
  const p = d.periodo || {};
  $("#perTag").textContent = p.rotulo || "—";
  $("#perDatas").textContent = p.dias === 1 ? `${semana(p.fim)}, ${dataBR(p.fim)}` : p.dias > 1 ? `${dataBR(p.inicio)} a ${dataBR(p.fim)} · ${p.dias} dias` : "";
  const f = [];
  if (est.situacao) f.push(est.situacao === "ativo" ? "Cupons ativos" : "Cupons encerrados");
  if (est.tipos.length) f.push("Tipo " + est.tipos.join(", "));
  if (est.cupons.length) f.push(est.cupons.length <= 3 ? est.cupons.join(", ") : `${est.cupons.length} cupons`);
  if (est.filial) f.push(`Filial ${rotuloFilial(est.filial)}${est.regional ? " (" + est.regional + ")" : ""}`);
  else if (est.regional) f.push(est.regional);
  if (est.depto) f.push(est.setor ? `${nomeDep(est.setor)} (${nomeDep(est.depto)})` : nomeDep(est.depto));
  $("#perFiltro").textContent = f.length ? "· " + f.join(" · ") : "";
  const a = d.atualizacao || {}, uc = a.ultima_carga || {};
  // Hora de referência: quando o Power BI terminou de atualizar (se a carga informou) ou quando a carga terminou.
  const ref = uc.dataset_atualizado_em || uc.fim;
  const tRef = ref ? new Date(ref) : null;
  const hojeBR = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const hora = !tRef ? "–" : tRef.toLocaleString("pt-BR", tRef.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) === hojeBR
    ? { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }
    : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  HORA_TXT = hora === "–" ? "" : hora;
  $("#status").innerHTML = (DEMO ? '<span class="badge demo">DEMONSTRAÇÃO · dados fictícios</span>' : "") +
    (d.filial_filtro?.dados_desde && d.periodo?.inicio < d.filial_filtro.dados_desde ? `<span class="badge alerta" title="Os números por filial começam em ${dataBR(d.filial_filtro.dados_desde)}">Filial: dados desde ${dataBR(d.filial_filtro.dados_desde).slice(0, 5)}</span>` : "") +
    (() => { const df = d.depto_filtro; if (!df) return "";
      if (!df.totais_desde) return '<span class="badge alerta" title="A venda total e os números por filial do departamento chegam depois da carga nova (7_carregar_departamentos)">Depto: % e filiais após a carga nova</span>';
      return d.periodo?.inicio < df.totais_desde ? `<span class="badge alerta" title="A venda total e os números por filial do departamento começam em ${dataBR(df.totais_desde)}">Depto: filiais desde ${dataBR(df.totais_desde).slice(0, 5)}</span>` : ""; })() +
    (funcaoAntiga ? '<span class="badge alerta" title="Publique o novo código da função painel no Supabase">Função do Supabase desatualizada · períodos não funcionam</span>' : "") +
    `<span>Atualizado às <b>${hora}</b></span><span id="gloSlot">${botaoGlossario()}</span>` + (DEMO ? "" : Acesso.botaoUsuario());
}

function desenharAguardando(d) {
  const ini = d.campanha?.campanha_inicio, falta = ini ? Math.ceil((new Date(ini + "T03:00:00Z") - Date.now()) / 864e5) : null;
  const msg = d.periodo?.codigo === "campanha" && falta > 0
    ? `<div class="g">${falta}</div><div class="t">${falta === 1 ? "dia" : "dias"} para a campanha começar</div><div class="s">Início em ${dataBR(ini)} · use ▼ para ver outro período</div>`
    : `<div class="t">Este período ainda não tem dados</div><div class="s">Os números aparecem a cada atualização do Power BI · use ▼ para escolher outro período</div>`;
  $$(".tela").forEach((t) => { if (!t.querySelector(".aguarda")) t.insertAdjacentHTML("afterbegin", '<div class="aguarda"></div>'); t.querySelector(".aguarda").innerHTML = msg; });
  $$(".tela > :not(.aguarda)").forEach((el) => (el.style.display = "none"));
}
function limparAguardando() {
  $$(".aguarda").forEach((el) => el.remove());
  $$(".tela > *").forEach((el) => (el.style.display = ""));
}

function desenharResultado(d) {
  limparAguardando();
  const k = d.kpis || {}, p = d.periodo || {};
  const vt = k.ticket_sem ? k.ticket_com / k.ticket_sem - 1 : null;
  const tkRede = k.vendas_total > 0 ? k.venda_total / k.vendas_total : null;
  $("#hero").innerHTML = `
    <div class="kpi principal"><div class="rot">Cupons usados</div><div class="val">${int(k.vendas)}</div>
      <div class="det">notas com cupom${DEP() ? " e itens de " + esc(DEP()) : ""} · ${pctAuto(k.pct_vendas)} de todas as notas</div>
      <div class="tot"><span>Total de notas ${QUEM()}</span><b>${int(k.vendas_total)}</b></div></div>
    <div class="kpi" style="--c:var(--lj)"><div class="rot">Vendas com cupom</div><div class="val">${brlK(k.venda)}</div>
      <div class="det">${pctAuto(k.pct_venda)} da venda total ${QUEM()}</div>
      <div class="tot"><span>Venda total ${QUEM()}</span><b>${brlK(k.venda_total)}</b></div></div>
    <div class="kpi" style="--c:var(--lima)"><div class="rot">Desconto concedido</div><div class="val">${brlK(k.desconto)}</div>
      <div class="det">desconto médio de ${pct(k.desconto_pct)} no preço</div>
      <div class="tot"><span>Sobre a venda total ${QUEM()}</span><b>${k.venda_total > 0 ? pct(k.desconto / k.venda_total, 2) : "–"}</b></div></div>
    <div class="kpi" style="--c:var(--ve)"><div class="rot">Ticket com cupom</div><div class="val">${brl(k.ticket_com, false)}</div>
      <div class="det">${MODO_FIL() ? "não disponível por filial" : `sem cupom: ${brl(k.ticket_sem, false)}`} ${vt == null ? "" : `<span class="${vt >= 0 ? "up" : "down"}">${vt >= 0 ? "▲" : "▼"} ${pct(Math.abs(vt), 0)}</span>`}</div>
      <div class="tot"><span>Ticket ${QUEM()}</span><b>${brl(tkRede, false)}</b></div></div>`;
  const u = d.ultimo_dia || {}, top = (d.ranking || [])[0];
  const pDia = u.venda_total > 0 ? u.venda / u.venda_total : null;
  $("#faixa").innerHTML = p.dias > 1
    ? `<span class="rot">Último dia · ${dataBR(u.data)}</span><span><b>${int(u.vendas)}</b> cupons usados</span><span><b>${brlK(u.venda)}</b> em vendas</span><span><b>${brlK(u.desconto)}</b> de desconto</span>${pDia == null ? "" : `<span><b>${pctAuto(pDia)}</b> da venda total ${QUEM()} no dia</span>`}`
    : `<span class="rot">No dia</span><span><b>${int(k.cupons)}</b> cupons diferentes usados</span>${top ? `<span>Mais vendido: <b>${esc(top.cupom)}</b> · ${brlK(top.venda)}</span>` : ""}<span><b>${int(k.itens)}</b> itens com cupom</span>`;
  if (p.dias > 1) desenharSerie(d.serie || []); else desenharTopDia(d.ranking || []);
}

function desenharMini(d) {
  const k = d.kpis || {}, tkRede = k.vendas_total > 0 ? k.venda_total / k.vendas_total : null;
  const m = (cls, cor, rot, sub, val) => `<div class="m${cls}" style="--c:${cor}"><div class="r"><span>${rot}</span><span class="s">${sub}</span></div><div class="v">${val}</div></div>`;
  $("#mini").innerHTML =
    m(" principal", "var(--lima)", "Cupons usados", `<b>${pctAuto(k.pct_vendas)}</b> das notas`, int(k.vendas)) +
    m("", "var(--lj)", "Vendas com cupom", `<b>${pctAuto(k.pct_venda)}</b> de ${brlK(k.venda_total)}`, brlK(k.venda)) +
    m("", "var(--lima)", "Desconto concedido", `<b>${k.venda_total > 0 ? pct(k.desconto / k.venda_total, 2) : "–"}</b> da venda total`, brlK(k.desconto)) +
    m("", "var(--ve)", "Ticket com cupom", `${QUEM_CURTO()} <b>${brl(tkRede, false)}</b>`, brl(k.ticket_com, false));
}

function desenharTopDia(rk) {
  $("#tSerie").textContent = "Cupons que mais venderam no dia";
  $("#sSerie").textContent = "R$ em vendas dos itens com cupom";
  const el = $("#serie"), r = rk.slice(0, 8), max = Math.max(1, ...r.map((x) => +x.venda));
  el.innerHTML = r.length ? r.map((x) => `<div class="bar-row" style="--rotw:260px;margin:12px 0"><div class="nm" style="font-weight:800;color:var(--ve)">${esc(x.cupom)}</div>
      <div class="bx"><div class="b" style="background:var(--lj);width:${Math.max(1.5, (x.venda / max) * 70)}%"></div><div class="v"><b>${brl(x.venda)}</b> · ${int(x.vendas)} usos</div></div></div>`).join("")
    : '<div class="vazio">Nenhum cupom usado no dia.</div>';
}

function desenharSerie(serie) {
  const el = $("#serie");
  let pts = serie.map((s) => ({ data: String(s.data).slice(0, 10), venda: +s.venda || 0, vendas: +s.vendas || 0 }));
  const porSemana = pts.length > 62;
  if (porSemana) {
    const m = new Map();
    for (const p of pts) {
      const d = new Date(p.data + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const k = d.toISOString().slice(0, 10), o = m.get(k) || { venda: 0, vendas: 0 };
      o.venda += p.venda; o.vendas += p.vendas; m.set(k, o);
    }
    pts = [...m].map(([data, o]) => ({ data, ...o }));
  }
  $("#tSerie").textContent = porSemana ? "Venda e cupons por semana" : "Venda e cupons por dia";
  $("#sSerie").textContent = "Barras: R$ em vendas com cupom · embaixo: quantidade de cupons usados · " +
    (porSemana ? "semanas começando na segunda · em laranja, a semana mais recente (pode estar incompleta)" : "em laranja, o último dia do período");
  if (!pts.some((p) => p.venda)) { el.innerHTML = '<div class="vazio">Nenhum cupom usado no período.</div>'; return; }
  // embaixo de cada barra: a data e a quantidade de cupons (linha própria, sem disputar espaço com os valores)
  const W = el.clientWidth || 1780, H = el.clientHeight || 330, m = { l: 96, r: 12, t: 36, b: 74 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, max = Math.max(...pts.map((p) => p.venda));
  const bruto = max / 4, e = Math.pow(10, Math.floor(Math.log10(bruto))), passo = [1, 2, 2.5, 5, 10].map((x) => x * e).find((x) => x >= bruto);
  const topo = Math.ceil(max / passo) * passo, y = (v) => m.t + ih - (v / topo) * ih;
  const bw = iw / pts.length, gap = Math.min(8, bw * 0.25), iMax = pts.findIndex((p) => p.venda === max), passoRot = Math.ceil(pts.length / 16);
  const todosValores = bw >= 112;            // cabe "R$ 569 mil" em cima de cada barra
  const fsQ = bw >= 60 ? 20 : bw >= 44 ? 17 : 14;
  let s = "";
  for (let t = 0; t <= topo + 1e-9; t += passo)
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grade)" stroke-width="2"/><text x="${m.l - 12}" y="${y(t) + 7}" text-anchor="end" font-size="19" fill="var(--muted)">${brl(t).replace("R$ ", "")}</text>`;
  const yQ = H - 12, yD = m.t + ih + 28;
  s += `<rect x="${m.l}" y="${yQ - 24}" width="${iw}" height="34" rx="8" fill="rgba(11,74,31,.07)"/>`;
  s += `<text x="${m.l - 12}" y="${yQ}" text-anchor="end" font-size="16" font-weight="800" fill="var(--ve)">cupons</text>`;
  pts.forEach((p, i) => {
    const x = m.l + i * bw + gap / 2, w = Math.max(1, bw - gap), ult = i === pts.length - 1, cx = x + w / 2;
    s += `<rect x="${x}" y="${y(p.venda)}" width="${w}" height="${Math.max(0, y(0) - y(p.venda))}" rx="${Math.min(5, w / 3)}" fill="${ult ? "var(--lj)" : "var(--vc)"}"/>`;
    if (i % passoRot === 0 || ult) s += `<text x="${cx}" y="${yD}" text-anchor="middle" font-size="18" fill="var(--muted)">${dm(p.data)}</text>`;
    s += `<text x="${cx}" y="${yQ}" text-anchor="middle" font-size="${fsQ}" font-weight="900" fill="${ult ? "var(--lj2)" : "var(--ve)"}">${int(p.vendas)}</text>`;
    if (todosValores || i === iMax || ult) {
      const meio = 58, tx = Math.min(Math.max(cx, m.l + meio), W - m.r - meio);   // "R$ 185 mil" tem ~116 px: não deixa sair pelas bordas
      s += `<text x="${tx}" y="${y(p.venda) - 9}" text-anchor="middle" font-size="20" font-weight="800" fill="var(--tinta)">${brl(p.venda)}</text>`;
    }
  });
  el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Venda com cupom e quantidade de cupons no período">${s}</svg>`;
}

// Ranking de cupons. Quem usa o painel com mouse (login de pessoa ou ?modo=analise) vê a lista COMPLETA, com rolagem,
// busca pelo nome e filtro por grupo (CRM, Rádio, Influenciador…). A TV continua só com os maiores que cabem na tela.
const rankLivre = () => ANALISE || ACESSO.tipo === "usuario";
function desenharRanking(d) {
  const livre = rankLivre();
  $("#cardRank").classList.toggle("rk-livre", livre);
  if (livre) desenharRankingLivre(d); else desenharRankingTV(d);
  if (MODO_FIL()) desenharPosicao($("#regional"), d);
  else { $("#regTit").textContent = "Por regional"; $("#regSub").textContent = "Valores em R$ · % cupom = parte da venda da regional feita com cupom"; desenharRegional($("#regional"), d.regional || []); }
}
// uma linha da tabela do ranking (TV e lista completa): conversão = usados desde o início ÷ base de clientes
function linhaRanking(d, x, pos, max, cv) {
  const c = cv ? conversao(d, x.cupom) : null;
  return `<tr class="${encCls(x.cupom).trim()}"><td class="pos">${pos}</td><td class="cup">${bolinha(x.cupom)}${esc(x.cupom)}<span class="barra" style="width:${Math.max(3, (x.venda / max) * 100)}%"></span></td>
      <td>${int(x.vendas)}</td><td>${brl(x.venda)}</td><td>${MODO_FIL() ? brl(x.desconto) : brl(x.ticket, false)}</td>${!cv ? "" : c
    ? `<td class="cv"><div class="tx"><b>${convTxt(c.taxa)}</b><i style="--t:${Math.min(100, c.taxa * 100).toFixed(1)}%"></i></div><small>${int(c.usos)} de ${int(c.base)}</small></td>`
    : '<td class="cv"></td>'}</tr>`;
}
function desenharRankingTV(d) {
  const el = $("#ranking"), todos = d.ranking || [];
  const cabe = Math.max(5, Math.min(14, Math.floor(((el.clientHeight || 560) - 46) / 50)));
  const r = todos.slice(0, cabe), max = Math.max(1, ...r.map((x) => +x.venda));
  $("#rkSub").innerHTML = esc(`${int(todos.length)} cupons usados no período · ${todos.length > cabe ? cabe + " maiores" : "todos"}, por venda` +
    (temConversao(d) ? " · conversão = usados desde o início ÷ base de clientes" : "")) + legendaSit();
  const cv = temConversao(d);
  el.innerHTML = r.length ? `<table><thead><tr><th>#</th><th>Cupom</th><th>Usos</th><th>Venda</th><th>${MODO_FIL() ? "Desconto" : "Ticket"}</th>${cv ? "<th>Conversão</th>" : ""}</tr></thead><tbody>
    ${r.map((x, i) => linhaRanking(d, x, i + 1, max, cv)).join("")}</tbody></table>`
    : '<div class="vazio">Nenhum cupom usado no período.</div>';
  el.classList.toggle("conv", cv);
  const tb = $("tbody", el), tab = $("table", el);
  if (tb && el.clientHeight) {
    const fimCard = () => el.closest(".card").getBoundingClientRect().bottom + 1;   // a última linha pode ocupar a margem do card (igual a hoje)
    while (tb.rows.length > 5 && tb.rows[tb.rows.length - 1].getBoundingClientRect().bottom > fimCard()) tb.deleteRow(-1);
    const n = tb.rows.length;
    $("#rkSub").innerHTML = esc(`${int(todos.length)} cupons usados no período · ${todos.length > n ? n + " maiores" : "todos"}, por venda` +
      (cv ? " · conversão = usados desde o início ÷ base de clientes" : "")) + legendaSit();
  }
}

// ---- lista completa (pessoas): busca, grupo e rolagem
const RK = { busca: "", grupo: "" };
const RK_SEM_GRUPO = "__sem";
let rkMapa = { em: -1, m: null };
// grupo do cupom pela planilha de controle (a mesma lista do Glossário); cupom fora da planilha fica sem grupo
function grupoDoCupom(cupom) {
  if (!rkMapa.m || rkMapa.em !== GLO.carregadoEm) rkMapa = { em: GLO.carregadoEm, m: new Map((GLO.lista || []).map((x) => [String(x.cupom).toUpperCase(), x.g])) };
  return rkMapa.m.get(String(cupom || "").trim().toUpperCase()) || null;
}
const chaveGrupoRk = (x) => grupoDoCupom(x.cupom)?.chave || RK_SEM_GRUPO;
function chipsRanking(todos) {
  let h = "";
  if (Array.isArray(GLO.lista) && GLO.lista.length) {
    const m = new Map();
    for (const x of todos) {
      const g = grupoDoCupom(x.cupom), k = g ? g.chave : RK_SEM_GRUPO;
      if (!m.has(k)) m.set(k, { chave: k, nome: g ? g.nome : "Sem grupo", ordem: g ? g.ordem : 100, n: 0 });
      m.get(k).n++;
    }
    const chip = (chave, nome, n) => `<button type="button" class="rk-chip${chave === RK.grupo ? " on" : ""}" data-rkg="${esc(chave)}" aria-pressed="${chave === RK.grupo}">${esc(nome)} <small>${int(n)}</small></button>`;
    h = chip("", "Todos", todos.length) + [...m.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")).map((g) => chip(g.chave, g.nome, g.n)).join("");
  }
  return `<div class="rk-grupos" role="group" aria-label="Grupo do cupom">${h}</div>${legendaSit()}`;
}
function desenharRankingLivre(d, aoTopo = false) {
  const el = $("#ranking"), todos = (d.ranking || []).map((x, i) => ({ ...x, pos: i + 1 })), cv = temConversao(d), q = semAcento(RK.busca.trim());
  // grupo escolhido que não existe neste período (ou glossário indisponível): volta para todos
  if (!(Array.isArray(GLO.lista) && GLO.lista.length) || (RK.grupo && !todos.some((x) => chaveGrupoRk(x) === RK.grupo))) RK.grupo = "";
  const l = todos.filter((x) => (!RK.grupo || chaveGrupoRk(x) === RK.grupo) && (!q || semAcento(x.cupom).includes(q)));
  const max = Math.max(1, ...l.map((x) => +x.venda));
  const nomeG = RK.grupo ? grupoDoCupom(l[0]?.cupom || todos.find((x) => chaveGrupoRk(x) === RK.grupo)?.cupom)?.nome || "Sem grupo" : "";
  $("#rkSub").textContent = q || RK.grupo
    ? `${int(l.length)} de ${int(todos.length)} cupons${RK.grupo ? " · grupo " + nomeG : ""}${q ? ` · busca por “${RK.busca.trim()}”` : ""} · por venda`
    : `${int(todos.length)} cupons usados no período, por venda${cv ? " · conversão = usados desde o início ÷ base de clientes" : ""}`;
  const chips = $("#rkChips"); chips.innerHTML = chipsRanking(todos);
  el.innerHTML = l.length ? `<table><thead><tr><th>#</th><th>Cupom</th><th>Usos</th><th>Venda</th><th>${MODO_FIL() ? "Desconto" : "Ticket"}</th>${cv ? "<th>Conversão</th>" : ""}</tr></thead>
    <tbody>${l.map((x) => linhaRanking(d, x, x.pos, max, cv)).join("")}</tbody></table>`
    : `<div class="vazio">${todos.length ? "Nenhum cupom encontrado com essa busca." : "Nenhum cupom usado no período."}</div>`;
  el.classList.add("rk-rolagem"); el.classList.toggle("conv", cv);
  if (aoTopo) el.scrollTop = 0;
  const campo = $("#rkQ"); if (campo.value !== RK.busca) campo.value = RK.busca;
  $("#rkLimpar").hidden = !RK.busca;
  atualizarPeRanking(l.length);
}
// rodapé do ranking ("Mostrando 1 a 8 de 228 cupons") e aviso de rolagem; recalculados a cada rolagem
function atualizarPeRanking(n) {
  const el = $("#ranking"), pe = $("#rkPe"), mais = $("#rkMais");
  if (n == null) n = $$("tbody tr", el).length;
  const linhas = $$("tbody tr", el), th = $("thead", el), r = el.getBoundingClientRect();
  const topo = r.top + (th ? th.getBoundingClientRect().height : 0), base = r.bottom;
  let a = -1, b = -1;
  linhas.forEach((tr, i) => { const t = tr.getBoundingClientRect(); if (t.top >= topo - 1 && t.bottom <= base + 1) { if (a < 0) a = i; b = i; } });
  if (a < 0) { a = 0; b = Math.max(0, linhas.length - 1); }
  const cabeTudo = !linhas.length || (b - a + 1 >= linhas.length);
  const txt = !linhas.length ? "Nenhum cupom" : cabeTudo ? `${int(n)} ${n === 1 ? "cupom" : "cupons"}` : `Mostrando ${int(a + 1)} a ${int(b + 1)} de ${int(n)} cupons`;
  pe.innerHTML = `<span>${txt}</span><span>Atualizado a cada 30 minutos</span>`;
  mais.classList.toggle("on", el.scrollHeight > el.clientHeight + 4 && el.scrollTop < 8);
}
function ligarRanking() {
  const q = $("#rkQ"), el = $("#ranking"), refazer = () => { interagiu(); if (ultimo) desenharRankingLivre(ultimo, true); };
  q.addEventListener("input", () => { RK.busca = q.value; refazer(); });
  $("#rkLimpar").addEventListener("click", () => { RK.busca = ""; q.focus(); refazer(); });
  $("#rkChips").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-rkg]"); if (!b) return;
    RK.grupo = RK.grupo === b.dataset.rkg ? "" : b.dataset.rkg; refazer();
  });
  let quadro = 0;
  el.addEventListener("scroll", () => { if (quadro) return; quadro = requestAnimationFrame(() => { quadro = 0; atualizarPeRanking(); }); }, { passive: true });
  el.addEventListener("wheel", () => interagiu(), { passive: true });
  $("#rkMaisBt").addEventListener("click", () => { interagiu(); el.scrollBy({ top: Math.round(el.clientHeight * 0.8), behavior: "smooth" }); });
}
// o glossário (que traz o grupo de cada cupom) chega depois dos dados: redesenha a lista com os grupos
function aoCarregarGlossario() { if (ultimo && rankLivre()) desenharRankingLivre(ultimo); }
// filial escolhida: a posição dela entre as filiais da mesma regional (vizinhas acima e abaixo)
function desenharPosicao(el, d) {
  const l = prepararFiliais(d), reg = d.filial_filtro.regional || est.regional, i = l.findIndex((x) => x.filial === est.filial), eu = l[i];
  const com = l.filter((x) => x.venda > 0), sv = l.reduce((a, x) => a + x.venda, 0), stt = l.reduce((a, x) => a + x.venda_total, 0), media = stt > 0 ? sv / stt : null;
  $("#regTit").textContent = `Posição na regional ${reg}`;
  $("#regSub").textContent = eu && eu.pos ? `${eu.pos}º de ${com.length} filiais com cupom, pela venda com cupom · % verde = acima da média (${pctAuto(media)})`
    : `Sem cupom no período · ${com.length} filiais da regional usaram cupom`;
  if (!l.length) { el.innerHTML = '<div class="vazio">Sem vendas no período.</div>'; return; }
  const rh = 46, cabe = Math.max(5, Math.floor(((el.clientHeight || 600) - 44) / (rh + 1)));
  const ini = Math.max(0, Math.min(l.length - cabe, (i < 0 ? 0 : i) - Math.floor(cabe / 2))), vis = l.slice(ini, ini + cabe), max = Math.max(1, com[0]?.venda || 1);
  el.innerHTML = `<div style="--rh:${rh}px"><div class="reg-h top"><span>#</span><span>Filial</span><span>Cupons</span><span>Venda c/ cupom</span><span>Venda total</span><span>% cupom</span></div>
    ${vis.map((x) => `<div class="reg-r top${x.pos && x.pos <= 3 ? " podio" : ""}${x.venda > 0 ? "" : " sem"}${x.filial === est.filial ? " eu" : ""}" style="--w:${x.venda > 0 ? Math.max(1.5, (x.venda / max) * 100).toFixed(1) : 0}%">
      <span class="ps">${x.pos ?? "–"}</span><span class="nm">${x.num ? `<small>${esc(x.num)}</small>` : ""}${esc(x.nome)}</span>
      <span class="qt">${x.vendas ? int(x.vendas) : "–"}</span><span class="vc">${x.venda > 0 ? rs(x.venda) : "–"}</span><span class="vt">${rs(x.venda_total)}</span>
      <span class="pc${x.venda > 0 && media != null && x.pct >= media ? " acima" : ""}">${x.venda > 0 ? pctAuto(x.pct) : "–"}</span></div>`).join("")}</div>`;
}

function barras(el, rows, cat, extra, cor = "var(--vc)", lim = 12) {
  rows = rows.filter((r) => (+r.venda || 0) > 0).slice(0, lim);
  if (!rows.length) { el.innerHTML = '<div class="vazio">Sem uso de cupons.</div>'; return; }
  const max = Math.max(...rows.map((r) => +r.venda));
  el.innerHTML = rows.map((r) => `<div class="bar-row"><div class="nm">${esc(r[cat])}</div>
    <div class="bx"><div class="b" style="background:${cor};width:${Math.max(1.5, (r.venda / max) * 58)}%"></div><div class="v"><b>${brl(r.venda)}</b>${extra ? " " + extra(r) : ""}</div></div></div>`).join("");
}
function desenharRegional(el, regs) {
  // cupons usados · desconto · venda com cupom · venda total · % da venda com cupom (uma linha por regional + total)
  const l = regs.map((r) => ({ nome: r.regional || "(sem regional)", vendas: +r.vendas || 0, desconto: +r.desconto || 0, venda: +r.venda || 0,
    venda_total: r.venda_total == null ? null : +r.venda_total })).filter((r) => r.venda > 0 || (r.venda_total || 0) > 0)
    .sort((a, b) => b.venda - a.venda || (b.venda_total || 0) - (a.venda_total || 0));
  if (!l.length) { el.innerHTML = '<div class="vazio">Sem vendas no período.</div>'; return; }
  const soma = (k) => l.reduce((a, r) => a + (r[k] || 0), 0), temTotal = l.some((r) => r.venda_total != null);
  const tot = { nome: "Total", vendas: soma("vendas"), desconto: soma("desconto"), venda: soma("venda"), venda_total: temTotal ? soma("venda_total") : null };
  const pctDe = (r) => (r.venda_total > 0 ? r.venda / r.venda_total : null), media = pctDe(tot), max = Math.max(1, ...l.map((r) => r.venda));
  const linha = (r, total) => `<div class="reg-r${total ? " total" : ""}${r.venda > 0 ? "" : " sem"}" style="--w:${total ? 0 : Math.max(r.venda > 0 ? 1.5 : 0, (r.venda / max) * 100).toFixed(1)}%">
      <span class="nm">${esc(r.nome)}</span><span class="qt">${r.vendas ? int(r.vendas) : "–"}</span>
      <span class="vc">${r.venda > 0 ? rs(r.venda) : "–"}</span><span class="vt">${r.venda_total == null ? "–" : rs(r.venda_total)}</span>
      <span class="pc${!total && r.venda > 0 && media != null && pctDe(r) >= media ? " acima" : ""}">${r.venda > 0 && pctDe(r) != null ? pctAuto(pctDe(r)) : "–"}</span></div>`;
  const rh = Math.max(34, Math.min(58, Math.floor(((el.clientHeight || 600) - 44) / (l.length + 1)) - 1));
  el.innerHTML = `<div style="--rh:${rh}px"><div class="reg-h"><span>Regional</span><span>Cupons</span><span>Venda c/ cupom</span><span>Venda total</span><span>% cupom</span></div>
    ${l.map((r) => linha(r, false)).join("")}${l.length > 1 ? linha(tot, true) : ""}</div>`;
}
function desenharOnde(d) {
  // departamento e setor pela QUANTIDADE de cupons; enquanto a carga não trouxer a contagem, mostra em R$
  const dep = (d.departamento || []).filter((x) => +x.venda > 0), st0 = (d.setor || []).filter((x) => +x.venda > 0);
  const qtd = dep.some((x) => +x.vendas > 0) || st0.some((x) => +x.vendas > 0);
  const med = qtd ? (x) => +x.vendas || 0 : (x) => +x.venda || 0;
  const fmt = qtd ? (v) => `${int(v)} cupons` : (v) => brl(v);
  $("#deptoSub").textContent = qtd ? "Cupons usados em notas com itens do departamento" : "Venda dos itens com cupom (a quantidade de cupons aparece depois da próxima carga)";
  $("#setorSub").textContent = qtd ? "Do que mais usa cupom ao que menos usa · cupons usados em notas com itens do setor" : "Do que mais vende ao que menos vende · itens com cupom";
  $("#setorTit").textContent = est.depto ? (est.setor ? `Setor ${nomeDep(est.setor)}` : `Setores de ${nomeDep(est.depto)}`) : "Por setor";
  if (MODO_FIL() && !dep.length) {
    const msg = (t) => `<div class="vazio" style="font-size:21px;padding:24px 10px">${t}</div>`;
    $("#deptoSub").textContent = "Cupons usados em notas com itens do departamento";
    $("#setorSub").textContent = "Do que mais usa cupom ao que menos usa";
    $("#depto").innerHTML = msg(d.depto_filtro?.filiais_desde || (ultimo?.departamento || []).length ? "Sem uso de cupons nesta filial." : "Departamento e setor por filial chegam com a carga nova (7_carregar_departamentos).<br>Até lá, escolha a regional " + esc(d.filial_filtro.regional || "") + " para ver este recorte.");
    $("#setor").innerHTML = ""; $("#cardSetor").style.display = "none"; $("#cardDepto").style.flex = "1";
    return desenharTop10(d);
  }
  $("#cardSetor").style.display = "flex"; $("#cardDepto").style.flex = "";
  const de = $("#depto"), dl = dep.map((x) => ({ ...x, q: med(x) })).sort((a, b) => b.q - a.q).slice(0, 6), dmx = Math.max(1, ...dl.map((x) => x.q));
  de.innerHTML = dl.length ? dl.map((x) => `<div class="bar-row"><div class="nm">${esc(x.departamento)}</div>
    <div class="bx"><div class="b" style="background:var(--ve);width:${Math.max(1.5, (x.q / dmx) * 62)}%"></div><div class="v"><b>${fmt(x.q)}</b></div></div></div>`).join("")
    : '<div class="vazio">Sem uso de cupons.</div>';
  // setores: ranking completo em duas colunas; o que não couber vira "+N setores"
  const el = $("#setor"), st = st0.map((x) => ({ ...x, q: med(x) })).filter((x) => x.q > 0).sort((a, b) => b.q - a.q);
  if (!st.length) el.innerHTML = '<div class="vazio">Sem uso de cupons.</div>';
  else {
    const linhas = Math.max(4, Math.floor((el.clientHeight - 30) / 45)), cabe = linhas * 2;
    const vis = st.slice(0, st.length > cabe ? cabe - 1 : cabe), max = st[0].q, resto = st.length - vis.length;
    el.innerHTML = `<div class="setores" style="--linhas:${linhas}">${vis.map((x, i) => `<div class="st"><span class="p">${i + 1}</span>
        <span class="nm">${esc(x.setor)}<small>${esc(x.n_deptos > 1 ? "vários" : x.departamento)}</small></span><span class="v">${qtd ? int(x.q) : brl(x.q)}</span>
        <span></span><span class="mini" style="width:${Math.max(2, (x.q / max) * 100)}%"></span></div>`).join("")}
        ${resto > 0 ? `<div class="mais">+ ${resto} setores menores · ${fmt(st.slice(vis.length).reduce((a, x) => a + x.q, 0))}</div>` : ""}</div>`;
  }
  desenharTop10(d);
}
function desenharTop10(d) {
  const el = $("#top10");
  if (!Array.isArray(d.filiais)) { el.innerHTML = '<div class="vazio">Ranking de filiais ainda não ligado.</div>'; return; }
  $("#topTit").textContent = MODO_FIL() ? `Top 10 filiais da regional ${d.filial_filtro.regional || ""}` : "Top 10 filiais";
  const l = prepararFiliais(d), com = l.filter((x) => x.venda > 0), top = com.slice(0, 10);
  if (!top.length) { el.innerHTML = '<div class="vazio">Nenhuma filial usou cupom no período.</div>'; return; }
  const sv = l.reduce((a, x) => a + x.venda, 0), stt = l.reduce((a, x) => a + x.venda_total, 0), media = stt > 0 ? sv / stt : null;
  const max = top[0].venda || 1, rh = Math.max(36, Math.min(56, Math.floor(((el.clientHeight || 560) - 44) / top.length) - 1));
  el.innerHTML = `<div style="--rh:${rh}px"><div class="reg-h top"><span>#</span><span>Filial</span><span>Cupons</span><span>Venda c/ cupom</span><span>Venda total</span><span>% cupom</span></div>
    ${top.map((x) => `<div class="reg-r top${x.pos <= 3 ? " podio" : ""}${x.filial === est.filial ? " eu" : ""}" style="--w:${Math.max(1.5, (x.venda / max) * 100).toFixed(1)}%">
      <span class="ps">${x.pos}</span><span class="nm">${x.num ? `<small>${esc(x.num)}</small>` : ""}${esc(x.nome)}</span>
      <span class="qt">${int(x.vendas)}</span><span class="vc">${rs(x.venda)}</span><span class="vt">${rs(x.venda_total)}</span>
      <span class="pc${media != null && x.pct >= media ? " acima" : ""}">${pctAuto(x.pct)}</span></div>`).join("")}</div>`;
}

// ---------------------------------------------------------------- tela 4: ranking de filiais
// TV: todas as filiais, em páginas de 2 colunas. A rotação automática mostra só a página 1;
// as outras páginas só aparecem quando o usuário troca (◀ ▶ no controle ou clique nos números).
// Modo análise: uma tabela só, com busca e ordenação por qualquer coluna.
const FIL_COLUNAS = 2;   // 2 colunas largas: cabem cupons, venda com cupom, venda total e %
const FIL = { lista: [], itens: [], pag: 0, paginas: 1, linhas: 18, porPag: 36, rh: 36, media: null, ord: "pos", desc: false, busca: "" };
const telaFil = () => telas.indexOf($("#telaFiliais"));
const naPaginacao = () => !ANALISE && !GLO.aberto && est.tela === telaFil() && FIL.paginas > 1;
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const MINUSCULAS = new Set(["a", "as", "o", "os", "da", "das", "de", "do", "dos", "e", "em", "na", "no"]);
function titulo(s) {                       // "SANTANA DO LIVRAMENTO" ou "Sao Sebastiao Do Cai" → "Santana do Livramento" / "Sao Sebastiao do Cai"
  if (s !== s.toUpperCase()) return s.split(/(\s+)/).map((w, i) => (i > 0 && MINUSCULAS.has(w.toLowerCase()) ? w.toLowerCase() : w)).join("");
  return s.toLowerCase().split(/(\s+|-)/).map((w, i) => /^(ii|iii|iv|vi|vii|cd|rs|sc|pr)$/.test(w) ? w.toUpperCase()
    : i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
function partesFilial(rotulo) {           // "101-Vila Aurora" → { num: "080", nome: "Vila Aurora" } · "102 - PORTO SERENO" → { num: "163", nome: "Portão" }
  const s = String(rotulo ?? "").trim(), m = s.match(/^(\d{1,4})\s*[-–—·:]\s*(.+)$/);
  if (m) return { num: m[1], nome: titulo(m[2].trim()) };
  const r = s.match(/^(.+?)\s*[-–—·:]\s*(\d{1,4})$/);   // "PORTO SERENO - 163"
  if (r) return { num: r[2], nome: titulo(r[1].trim()) };
  return /^\d+$/.test(s) ? { num: s, nome: "Filial " + s } : { num: "", nome: titulo(s) || "(sem filial)" };
}
function prepararFiliais(d) {
  const l = (d.filiais || []).map((x) => {
    const venda = +x.venda || 0, vt = +x.venda_total || 0, vendas = +x.vendas || 0, nt = +x.vendas_total || 0, p = partesFilial(x.filial);
    return { filial: String(x.filial ?? ""), regional: x.regional || "", venda, vendas, desconto: +x.desconto || 0, venda_total: vt, vendas_total: nt,
      pct: vt > 0 ? venda / vt : null, pctN: nt > 0 ? vendas / nt : null, num: p.num, nome: p.nome };
  }).filter((x) => x.venda > 0 || x.venda_total > 0);
  l.sort((a, b) => b.venda - a.venda || b.venda_total - a.venda_total || a.nome.localeCompare(b.nome, "pt-BR"));
  let pos = 0; for (const x of l) x.pos = x.venda > 0 ? ++pos : null;   // só quem usou cupom tem posição
  return l;
}
const rs = (v) => { const a = Math.abs(v || 0), f = (x, d) => NF({ minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  return a >= 1e6 ? f(v / 1e6, 1) + " mi" : a >= 1e4 ? f(v / 1e3, 0) + " mil" : a >= 1e3 ? f(v / 1e3, 1) + " mil" : f(v || 0, 0); };   // valor curto, sem "R$"
const avisoFil = (t, s) => `<div class="fil-aviso" style="grid-column:1/-1;align-self:center"><div class="t">${t}</div><div class="s">${s}</div></div>`;

function desenharFiliais(d) {
  const topo = $("#filTopo"), corpo = $("#filCorpo");
  if (!Array.isArray(d.filiais)) {          // banco ainda sem o SQL das filiais
    FIL.lista = FIL.itens = []; FIL.paginas = 1; topo.innerHTML = ""; corpo.className = "fil-grade";
    corpo.innerHTML = avisoFil("O ranking de filiais ainda não está ligado", "Falta rodar no Supabase o SQL 009 (ranking de filiais). Depois disso, a próxima carga do Power BI já traz os números.");
    return;
  }
  const l = FIL.lista = prepararFiliais(d);
  if (!l.length) {
    FIL.itens = []; FIL.paginas = 1; topo.innerHTML = ""; corpo.className = "fil-grade";
    corpo.innerHTML = avisoFil("Ainda sem números por filial neste período", "Eles aparecem a partir da próxima carga do Power BI. Se o problema continuar, confira a carga no computador (ver_status).");
    return;
  }
  const com = l.filter((x) => x.venda > 0).length, sem = l.length - com;
  const sv = l.reduce((a, x) => a + x.venda, 0), st = l.reduce((a, x) => a + x.venda_total, 0);
  FIL.media = st > 0 ? sv / st : null;
  topo.innerHTML = `<div class="fil-resumo">
      <div class="k"><small>${est.regional ? esc(est.regional) + " · filiais com cupom" : "Filiais com cupom"}</small><b>${int(com)}<i>de ${int(l.length)}</i></b></div>
      <div class="k"><small>Sem cupom no período</small><b>${int(sem)}<i>filiais</i></b></div>
      <div class="k destaque"><small>Média da venda com cupom</small><b>${pctAuto(FIL.media)}<i>da venda das filiais</i></b></div></div>` +
    (ANALISE ? "" : `<div class="fil-pag" id="filPag"></div>`);
  if (ANALISE) return desenharFiliaisTabela();
  // TV: lista corrida (com cupom → separador → sem cupom), cortada em páginas de 2 colunas
  FIL.itens = sem && com ? [...l.slice(0, com), { div: true }, ...l.slice(com)] : l;
  const cheia = FIL_COLUNAS * Math.max(6, CFG.FILIAIS_LINHAS);
  FIL.linhas = FIL.itens.length > cheia ? cheia / FIL_COLUNAS : Math.max(6, Math.ceil(FIL.itens.length / FIL_COLUNAS));
  FIL.porPag = FIL_COLUNAS * FIL.linhas;
  FIL.paginas = Math.max(1, Math.ceil(FIL.itens.length / FIL.porPag));
  const alt = corpo.clientHeight || 560;  // altura útil: card (padding 16 + borda 2) e cabeçalho (34)
  FIL.rh = Math.max(28, Math.min(48, Math.floor((alt - 52) / FIL.linhas)));
  desenharPaginaFiliais(false);
}

const paginaDaFilial = () => { const i = est.filial ? FIL.itens.findIndex((x) => x.filial === est.filial) : -1; return i < 0 ? 0 : Math.floor(i / FIL.porPag); };
function desenharPaginaFiliais(animar) {
  const corpo = $("#filCorpo");
  if (ANALISE || !FIL.itens.length) return;
  FIL.pag = Math.max(0, Math.min(FIL.pag, FIL.paginas - 1));
  const ini = FIL.pag * FIL.porPag, pg = FIL.itens.slice(ini, ini + FIL.porPag), max = FIL.lista[0].venda || 1;
  const linha = (x) => x.div ? `<div class="fil-div">Sem cupom no período · por venda total</div>` :
    `<div class="fil-r${x.pos && x.pos <= 3 ? " podio" : ""}${x.venda > 0 ? "" : " sem"}${x.filial === est.filial ? " eu" : ""}" style="--w:${x.venda > 0 ? Math.max(1.5, (x.venda / max) * 100).toFixed(1) : 0}%">
      <span class="p">${x.pos ?? "–"}</span><span class="nm">${x.num ? `<small>${esc(x.num)}</small>` : ""}${esc(x.nome)}</span>
      <span class="qt">${x.vendas ? int(x.vendas) : "–"}</span>
      <span class="vc">${x.venda > 0 ? rs(x.venda) : "sem cupom"}</span><span class="vt">${rs(x.venda_total)}</span>
      <span class="pc${x.venda > 0 && FIL.media != null && x.pct >= FIL.media ? " acima" : ""}">${x.venda > 0 ? pctAuto(x.pct) : "–"}</span></div>`;
  const cab = `<div class="fil-h"><span>#</span><span>Filial · valores em R$</span><span>Cupons</span><span>Venda c/ cupom</span><span>Venda total</span><span>% cupom</span></div>`;
  corpo.className = "fil-grade";
  corpo.style.setProperty("--rh", FIL.rh + "px");
  corpo.style.setProperty("--fs", Math.max(19, Math.min(21, Math.round(FIL.rh * 0.56))) + "px");   // menos linhas → letra maior (colunas em "em" crescem junto)
  corpo.innerHTML = Array.from({ length: FIL_COLUNAS }, (_, c) => pg.slice(c * FIL.linhas, (c + 1) * FIL.linhas))
    .map((c) => (c.length ? `<div class="card fil-col">${cab}${c.map(linha).join("")}</div>` : "<div></div>")).join("");
  if (animar) { void corpo.offsetWidth; corpo.classList.add("troca"); }
  desenharIndicadorFil();
}

function desenharIndicadorFil() {
  const el = $("#filPag"); if (!el) return;
  const ini = FIL.pag * FIL.porPag, fim = Math.min(FIL.itens.length, ini + FIL.porPag);
  const antes = FIL.itens.slice(0, ini).filter((x) => !x.div).length, aqui = FIL.itens.slice(ini, fim).filter((x) => !x.div).length;
  el.innerHTML = `<div class="t"><span>Filiais <b>${int(antes + 1)}–${int(antes + aqui)}</b> de ${int(FIL.lista.length)}</span>
      ${FIL.paginas > 1 ? `<span>página <b>${FIL.pag + 1}</b> de ${FIL.paginas}</span>` : ""}</div>
    <div class="seg" title="Clique para ir à página">${Array.from({ length: FIL.paginas }, (_, i) => `<button class="pg${i < FIL.pag ? " feito" : i === FIL.pag ? " atual" : ""}" data-pg="${i}">${i + 1}</button>`).join("")}</div>
    ${FIL.media != null ? `<div class="leg">% em <b>verde</b>: acima da média (${pctAuto(FIL.media)})</div>` : ""}`;
}

const COLS_FIL = [   // [chave, título, classe, valor exibido]
  ["pos", "#", "pos", (x) => x.pos ?? "–"],
  ["nome", "Filial", "nm", (x) => `${x.num ? `<small>${esc(x.num)}</small>` : ""}${esc(x.nome)}`],
  ["regional", "Regional", "rg", (x) => esc(x.regional)],
  ["vendas", "Cupons usados", "", (x) => (x.vendas ? int(x.vendas) : "–")],
  ["venda", "Venda com cupom", "vc", (x) => (x.venda > 0 ? brl(x.venda) : "–")],
  ["venda_total", "Venda total", "", (x) => brl(x.venda_total)],
  ["pct", "% da venda com cupom", "", (x) => (x.venda > 0 ? pctAuto(x.pct) : "–")],
  ["pctN", "% das vendas (notas) com cupom", "", (x) => (x.vendas > 0 ? pctAuto(x.pctN) : "–")],
];
function desenharFiliaisTabela() {
  const corpo = $("#filCorpo");
  if (!$("#filTab")) {   // monta uma vez só: a busca não perde o foco quando os dados atualizam
    corpo.className = "fil-grade"; corpo.style.gridTemplateColumns = "1fr"; corpo.style.alignItems = "stretch";   // a tabela ocupa a altura toda e rola por dentro
    corpo.innerHTML = `<div class="card fil-tab" id="filTab"><div class="barra-ferr"><h3>Ranking de filiais</h3>
        <span class="sub" style="margin:0">Clique no título da coluna para ordenar · # = posição pela venda com cupom</span>
        <input type="search" id="filBusca" placeholder="Buscar filial, número ou regional…" autocomplete="off"></div>
      <div class="rolar"><table><thead><tr>${COLS_FIL.map(([k, t, c]) => `<th data-k="${k}" class="${c}">${t}</th>`).join("")}</tr></thead><tbody id="filLinhas"></tbody></table></div>
      <div class="rodape" id="filRodape"></div></div>`;
    $("#filBusca").value = FIL.busca;
    $("#filBusca").oninput = (ev) => { FIL.busca = ev.target.value; desenharLinhasFil(); };
    $("#filTab thead").onclick = (ev) => {
      const k = ev.target.closest("th")?.dataset.k; if (!k) return;
      if (FIL.ord === k) FIL.desc = !FIL.desc; else { FIL.ord = k; FIL.desc = !["pos", "nome", "regional"].includes(k); }
      desenharLinhasFil();
    };
  }
  desenharLinhasFil();
}
function desenharLinhasFil() {
  const q = semAcento(FIL.busca.trim()), k = FIL.ord, sinal = FIL.desc ? -1 : 1;
  const vazio = (v) => v == null;
  const l = FIL.lista.filter((x) => !q || semAcento(`${x.num} ${x.nome} ${x.regional}`).includes(q)).sort((a, b) => {
    const va = a[k], vb = b[k];
    if (vazio(va) !== vazio(vb)) return vazio(va) ? 1 : -1;            // sem valor sempre no fim
    const c = typeof va === "string" ? va.localeCompare(vb, "pt-BR") : (va ?? 0) - (vb ?? 0);
    return c * sinal || b.venda_total - a.venda_total;
  });
  $$("#filTab th").forEach((th) => (th.dataset.k === k ? th.setAttribute("aria-sort", FIL.desc ? "descending" : "ascending") : th.removeAttribute("aria-sort")));
  $("#filLinhas").innerHTML = l.map((x) => `<tr class="${x.venda > 0 ? "" : "sem"}${x.pos && x.pos <= 3 ? " podio" : ""}"${x.filial === est.filial ? ' style="outline:3px solid var(--lj);outline-offset:-3px"' : ""}>${COLS_FIL.map(([, , c, f]) => `<td class="${c}">${f(x)}</td>`).join("")}</tr>`).join("")
    || `<tr><td colspan="${COLS_FIL.length}" style="text-align:center;color:var(--muted)">Nenhuma filial encontrada.</td></tr>`;
  const sem = FIL.lista.filter((x) => !(x.venda > 0)).length;
  $("#filRodape").textContent = `${int(l.length)} de ${int(FIL.lista.length)} filiais na lista · ${int(sem)} sem cupom no período`;
}


// ---------------------------------------------------------------- tela 5: rádio e influenciadores
// Limite (cupons disponibilizados) vem da planilha de controle; usos vêm do banco. Acumulado desde o início,
// não muda com o período escolhido. Taxa de conversão = usados ÷ disponibilizados (no grupo: soma ÷ soma).
const telaMidia = () => telas.indexOf($("#telaMidia"));
const MD_GRUPOS = [["Rádio", "Rádio", "var(--lj)", "var(--lj2)"], ["Influenciador", "Influenciadores", "var(--vc)", "var(--bom)"]];
const temMidia = () => !!(ultimo && ultimo.midia && (ultimo.midia.grupos || []).length);
function midiaPrep(d) {
  const m = d.midia || {}, gs = m.grupos || [], cs = m.cupons || [];
  return MD_GRUPOS.map(([chave, nome, cor, cor2]) => {
    const g = gs.find((x) => x.grupo === chave) || null;
    const l = cs.filter((x) => x.grupo === chave).map((x) => ({ ...x, usos: +x.usos || 0, limite: +x.limite || 0, venda: +x.venda || 0,
      taxa: x.taxa == null ? null : +x.taxa })).sort((a, b) => b.usos - a.usos || b.venda - a.venda || a.cupom.localeCompare(b.cupom));   // conversão oculta nesta tela (15/10/2026)
    return { chave, nome, cor, cor2, g, l };
  });
}
function desenharMidia(d) {
  const topo = $("#mdTopo"), corpo = $("#mdCorpo"), nota = $("#mdNota");
  if (!d.midia) {
    topo.innerHTML = ""; nota.textContent = "";
    corpo.innerHTML = avisoFil("Rádio e Influenciadores ainda sem dados", "Publique a função do banco que traz os cupons da planilha de controle.");
    return;
  }
  const gr = midiaPrep(d);
  topo.innerHTML = gr.map(({ nome, cor, cor2, g }) => {
    if (!g) return `<div class="md-g" style="--c:${cor};--c2:${cor2}"><div class="md-cab"><span class="nm">${nome}</span></div><div class="vazio" style="padding:30px 0">Nenhum cupom deste grupo na planilha.</div></div>`;
    const tx = g.taxa == null ? null : +g.taxa, falta = Math.max(0, (+g.limite || 0) - (+g.usos || 0));
    return `<div class="md-g" style="--c:${cor};--c2:${cor2}">
      <div class="md-cab"><span class="nm">${nome}</span><span class="qt">${int(g.cupons)} cupons · <b>${int(g.ativos)}</b> já usados</span></div>
      <div class="md-meio sem-taxa">
        <div class="md-uso"><div class="t"><b>${int(g.usos)}</b> usados de <b>${int(g.limite)}</b> disponibilizados</div>
          <div class="md-bar"><i style="width:${tx == null ? 0 : Math.min(100, Math.max(tx > 0 ? 0.8 : 0, tx * 100)).toFixed(2)}%"></i></div>
          <div class="s">Ainda disponíveis: <b>${int(falta)}</b></div></div></div>
      <div class="md-pe"><span>Vendas com cupom<b>${brlK(+g.venda)}</b></span><span>Desconto<b>${brlK(+g.desconto)}</b></span>
        <span>Ticket<b>${brl(g.ticket == null ? null : +g.ticket, false)}</b></span><span>Últimos 7 dias<b>${int(g.usos_7d)} usos</b></span></div></div>`;
  }).join("");
  const fil = (d.midia.filiais || []);
  corpo.innerHTML = gr.map(({ chave, cor, g, l }) => {
    const radio = chave === "Rádio", com = l.filter((x) => x.usos > 0), top = com.slice(0, 5), sem = l.length - com.length;
    const todasF = fil.filter((x) => x.grupo === chave), fl = todasF.slice(0, 5), nFil = g ? +g.filiais_com_uso || 0 : 0;
    const euF = est.filial ? todasF.find((x) => x.filial === est.filial && +x.pos > 5) : null;   // a filial escolhida fora do top 5
    const cup = !l.length ? '<div class="md-vazio">Nenhum cupom deste grupo na planilha.</div>'
      : `<div class="md-h"><span>#</span><span>Cupom</span><span>Usados</span><span>Limite</span><span>Venda</span></div>
        ${top.map((x, i) => `<div class="md-r${i < 3 ? " podio" : ""}${encCls(x.cupom)}">
          <span class="p">${i + 1}</span>
          <span class="nm">${bolinha(x.cupom)}${esc(x.cupom)}${x.cidade ? `<small>${esc(titulo(x.cidade))}</small>` : ""}${x.visivel ? '<em title="Cupom aberto no app: os usos não vêm só desta divulgação">aberto no app</em>' : ""}</span>
          <span class="qt">${int(x.usos)}</span><span class="lm">${int(x.limite)}</span>
          <span class="vd">${x.venda > 0 ? brl(x.venda) : "–"}</span></div>`).join("")}
        ${!top.length ? '<div class="md-vazio">Nenhum cupom usado ainda.</div>' : top.length < 5 && sem ? `<div class="md-vazio">Os outros ${int(sem)} cupons ainda não foram usados.</div>` : ""}`;
    const fils = !fl.length ? '<div class="md-vazio">Nenhuma filial usou estes cupons ainda.</div>'
      : `<div class="md-fh"><span>#</span><span>Filial</span><span>Usados</span><span>Venda</span><span>Mais usado</span></div>
        ${[...fl, ...(euF ? [{ sep: true }, euF] : [])].map((x, i) => { if (x.sep) return '<div class="md-fr sep"><span></span><span>…</span></div>';
          const pf = partesFilial(x.filial); return `<div class="md-fr${+x.pos <= 3 ? " podio" : ""}${x.filial === est.filial ? " eu" : ""}">
          <span class="p">${x.pos || i + 1}</span><span class="nm">${pf.num ? `<small>${esc(pf.num)}</small>` : ""}${esc(pf.nome)}</span>
          <span class="qt">${int(x.usos)}</span><span class="vd">${brl(+x.venda)}</span>
          <span class="ct">${esc(x.cupom_top || "")}${+x.n_cupons > 1 ? ` <span style="color:var(--muted);font-weight:600">+${+x.n_cupons - 1}</span>` : ""}</span></div>`; }).join("")}
        ${fl.length < 5 && nFil ? `<div class="md-vazio">Só ${int(nFil)} ${nFil === 1 ? "filial usou" : "filiais usaram"} estes cupons até agora.</div>` : ""}`;
    return `<div class="card md-col" style="--c:${cor}">
      <div class="md-sec"><h3>Top 5 cupons ${radio ? "das rádios" : "dos influenciadores"}<small>${legendaSit()}pelos mais usados · <b>${int(com.length)}</b> de ${int(l.length)} já usados</small></h3>${cup}</div>
      <div class="md-sec"><h3>Top 5 filiais ${MODO_FIL() ? "da regional · " + (radio ? "rádio" : "influenciadores") : radio ? "com cupons de rádio" : "com cupons de influenciadores"}<small>por cupons usados · <b>${int(nFil)}</b> ${nFil === 1 ? "filial usou" : "filiais usaram"}</small></h3>${fils}</div></div>`;
  }).join("");
  const reg = est.filial ? "filial " + rotuloFilial(est.filial) : est.regional || (REG_PERM ? rotuloTodas() : "");
  const sinc = d.midia.sincronizado_em ? new Date(d.midia.sincronizado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  nota.innerHTML = `Acumulado desde o início dos cupons (não muda com o período)${reg ? ` · usos em <b>${esc(reg)}</b>` : ""}${DEP() ? ` · só notas com itens de <b>${esc(DEP())}</b>` : ""} · disponibilizados = limite de usos da planilha de controle${sinc ? ` (atualizada em ${sinc})` : ""}`;
}
function celMidia(d) {
  if (!d.midia) return "";
  const gr = midiaPrep(d).filter((x) => x.g);
  if (!gr.length) return "";
  return `<div class="bloco"><h2>Rádio e Influenciadores</h2><div class="s">Acumulado desde o início</div>
    ${gr.map(({ nome, cor, g, l }) => {
      const tx = g.taxa == null ? null : +g.taxa, com = l.filter((x) => x.usos > 0), top = com.slice(0, 5), fl = (d.midia.filiais || []).filter((x) => x.grupo === g.grupo).slice(0, 5);   // tx: usados ÷ disponibilizados (só a barra)
      return `<div style="margin-top:10px"><div style="font-weight:900;color:var(--ve);font-size:16px">${nome} <span style="font-weight:600;color:var(--muted);font-size:13px">· ${int(g.cupons)} cupons, ${int(g.ativos)} já usados</span></div>
        <div class="md-c sem-taxa"><div class="us"><b>${int(g.usos)}</b> usados de <b>${int(g.limite)}</b><br>${brlK(+g.venda)} em vendas</div>
          <div class="bar"><i style="width:${tx == null ? 0 : Math.min(100, Math.max(tx > 0 ? 1 : 0, tx * 100)).toFixed(1)}%;background:${cor}"></i></div></div>
        ${top.map((x, i) => `<div class="ln${i < 3 ? " podio" : ""}"><span class="po">${i + 1}</span><span class="n">${bolinha(x.cupom)}${esc(x.cupom)}${x.cidade ? ` <small>${esc(titulo(x.cidade))}</small>` : ""}</span><span class="q"><b>${int(x.usos)}</b> ${x.usos === 1 ? "uso" : "usos"}${x.venda > 0 ? " · " + brl(x.venda) : ""}</span></div>`).join("")}
        <div class="mais">${int(com.length)} de ${int(l.length)} cupons já usados</div>
        ${fl.length ? `<div style="font-weight:800;color:var(--ve);font-size:14px;margin-top:8px">Top filiais</div>${fl.map((x, i) => { const pf = partesFilial(x.filial); return `<div class="ln${i < 3 ? " podio" : ""}${x.filial === est.filial ? " eu" : ""}"><span class="po">${i + 1}</span><span class="n">${pf.num ? `<small>${esc(pf.num)}</small>` : ""}${esc(pf.nome)}</span><span class="q"><b>${int(x.usos)}</b> ${+x.usos === 1 ? "uso" : "usos"} · ${esc(x.cupom_top || "")}</span></div>`; }).join("")}` : ""}</div>`;
    }).join("")}</div>`;
}

// ---------------------------------------------------------------- tela 6: primeira compra × recuperação de clientes
// Segue o período e a regional/filial escolhidos (igual à tela Resultado). Quais cupons entram em cada lado
// vem do banco (tabela cupom_objetivo + restrição "Classificação = Novo" da planilha).
// Conversão = usados desde o início ÷ "Base de clientes (qtd.)" da planilha; sem base preenchida, a célula fica em branco.
const telaClientes = () => telas.indexOf($("#telaClientes"));
const temClientes = () => !!(ultimo && ultimo.clientes && (ultimo.clientes.grupos || []).length);
const CL_ESTILO = {
  primeira_compra: { cor: "var(--vc)", cor2: "var(--bom)", corP: "var(--ve)", bg: "rgba(27,138,47,.10)", ds: "Clientes novos, que nunca compraram na Aurora" },
  recuperacao: { cor: "var(--lj)", cor2: "var(--lj2)", corP: "#A84F00", bg: "rgba(239,125,0,.12)", ds: "Clientes que pararam de comprar e voltaram" },
};
function clientesPrep(d) {
  const c = d.clientes || {}, t = c.totais || {};
  return (c.grupos || []).map((g) => {
    const k = g.kpis || {}, e = CL_ESTILO[g.objetivo] || CL_ESTILO.primeira_compra;
    const cups = (g.cupons || []).map((x) => ({ ...x, vendas: +x.vendas || 0, venda: +x.venda || 0, limite: x.limite == null ? null : +x.limite,
      usos_total: +x.usos_total || 0, base: +x.base > 0 ? +x.base : null, ticket: x.ticket == null ? null : +x.ticket }))
      .map((x) => ({ ...x, conv: x.base ? x.usos_total / x.base : null }));
    return { ...g, e, cups, k: { vendas: +k.vendas || 0, venda: +k.venda || 0, desconto: +k.desconto || 0, ticket: k.ticket == null ? null : +k.ticket,
      desconto_pct: k.desconto_pct == null ? null : +k.desconto_pct }, t };
  });
}
function desenharClientes(d) {
  const corpo = $("#clCorpo"), nota = $("#clNota");
  if (!d.clientes) {
    nota.textContent = "";
    corpo.innerHTML = avisoFil("Primeira compra e recuperação ainda sem dados", "Falta rodar no Supabase o SQL 018 (primeira compra × recuperação).");
    return;
  }
  const p = d.periodo || {};
  corpo.innerHTML = clientesPrep(d).map((g) => {
    const { e, k, t, cups } = g, vt = +t.venda_total || 0, nt = +t.vendas_total || 0, tkRede = nt > 0 ? vt / nt : null;
    const partCup = +t.cupons_vendas > 0 ? k.vendas / +t.cupons_vendas : null, vTk = k.ticket != null && tkRede ? k.ticket / tkRede - 1 : null;
    const u = g.ultimo_dia || {};
    const kp = (cls, rot, val, det, cor) => `<div class="k${cls}"${cor ? ` style="--kc:${cor}"` : ""}><div class="r">${rot}</div><div class="v">${val}</div><div class="d">${det}</div></div>`;
    const kpis = kp(" p", "Cupons usados", int(k.vendas), `<b>${pctAuto(nt > 0 ? k.vendas / nt : null)}</b> das notas`) +
      kp("", "Vendas com cupom", brlK(k.venda), `<b>${pctAuto(vt > 0 ? k.venda / vt : null)}</b> da venda total`, "var(--lj)") +
      kp("", "Desconto concedido", brlK(k.desconto), `médio de <b>${k.desconto_pct == null ? "–" : pct(k.desconto_pct)}</b> no preço`, "var(--lima)") +
      kp("", "Ticket com cupom", brl(k.ticket, false), MODO_FIL() ? "não disponível por filial"
        : `${QUEM_CURTO()} <b>${brl(tkRede, false)}</b>${vTk == null ? "" : ` <span class="${vTk >= 0 ? "up" : "down"}">${vTk >= 0 ? "▲" : "▼"} ${pct(Math.abs(vTk), 0)}</span>`}`, "var(--ve)");
    // cupons do grupo: os que mais venderam no período (até 4 linhas)
    const vis = cups.slice(0, 4), resto = cups.length - vis.length;
    const cup = !cups.length ? '<div class="cl-vazio">Nenhum cupom deste grupo cadastrado.</div>'
      : `<div class="cl-h"><span>Cupom</span><span>Usos</span><span>Venda</span><span>Ticket</span><span>Conversão</span></div>
        ${vis.map((x) => `<div class="cl-r${x.vendas > 0 ? "" : " zero"}${encCls(x.cupom)}"><span class="nm">${bolinha(x.cupom)}${esc(x.cupom)}</span><span class="qt">${x.vendas ? int(x.vendas) : "–"}</span>
          <span class="vd">${x.venda > 0 ? brl(x.venda) : "–"}</span><span class="tk">${x.ticket == null ? "–" : brl(x.ticket, false)}</span>
          ${x.conv != null ? `<span class="cv" title="${int(x.usos_total)} usados desde o início · base de ${int(x.base)} clientes"><b>${convTxt(x.conv)}</b><i style="--t:${Math.min(100, x.conv * 100).toFixed(1)}%"></i></span>` : '<span class="cv"></span>'}</div>`).join("")}
        ${resto > 0 ? `<div class="cl-mais">+ ${int(resto)} ${resto === 1 ? "cupom" : "cupons"} · ${int(cups.slice(4).reduce((a, x) => a + x.vendas, 0))} usos</div>` : ""}`;
    // top 5 departamentos (pela quantidade de cupons; em R$ enquanto a carga não trouxer a contagem)
    let dep, depTit = "Por departamento", depSub = "cupons usados";
    if (est.depto && Array.isArray(g.setores)) {
      const sl = g.setores.filter((x) => +x.vendas > 0 || +x.venda > 0).map((x) => ({ nome: x.setor, q: +x.vendas || 0 })).sort((a, b) => b.q - a.q), top = sl.slice(0, 5), mx = Math.max(1, top[0]?.q || 1);
      depTit = est.setor ? `Setor ${nomeDep(est.setor)}` : sl.length > 5 ? `Top 5 setores de ${nomeDep(est.depto)}` : `Setores de ${nomeDep(est.depto)}`;
      dep = !top.length ? '<div class="cl-vazio">Nenhum cupom usado no período.</div>'
        : top.map((x) => `<div class="cl-dp"><span class="nm">${esc(nomeDep(x.nome))}</span><span class="q">${int(x.q)}${k.vendas > 0 ? `<small>${pct(Math.min(1, x.q / k.vendas), 0)} dos usos</small>` : ""}</span>
          <span class="br"><i style="width:${Math.max(2, (x.q / mx) * 100).toFixed(1)}%"></i></span></div>`).join("");
    } else if (!Array.isArray(g.departamentos)) dep = `<div class="cl-vazio">Departamento ainda não chega por filial na carga. Para ver, escolha a regional ${esc(d.filial_filtro?.regional || "")}.</div>`;
    else {
      const dl = g.departamentos.filter((x) => +x.venda > 0), qtd = dl.some((x) => +x.vendas > 0);
      const l = dl.map((x) => ({ nome: x.departamento, q: qtd ? +x.vendas || 0 : +x.venda || 0 })).sort((a, b) => b.q - a.q).slice(0, 5), mx = Math.max(1, l[0]?.q || 1);
      dep = !l.length ? '<div class="cl-vazio">Nenhum cupom usado no período.</div>'
        : l.map((x) => `<div class="cl-dp"><span class="nm">${esc(nomeDep(x.nome))}</span><span class="q">${qtd ? int(x.q) : brl(x.q)}${qtd && k.vendas > 0 ? `<small>${pct(x.q / k.vendas, 0)} dos usos</small>` : ""}</span>
          <span class="br"><i style="width:${Math.max(2, (x.q / mx) * 100).toFixed(1)}%"></i></span></div>`).join("");
    }
    // top 5 filiais (com a filial escolhida no fim, se estiver fora do top 5)
    const fl = (g.filiais || []).map((x) => ({ ...x, pos: +x.pos, usos: +x.usos || 0, venda: +x.venda || 0 })), top = fl.filter((x) => x.pos <= 5);
    const euF = est.filial ? fl.find((x) => x.filial === est.filial && x.pos > 5) : null, nFil = +g.n_filiais || 0;
    const fils = !top.length ? '<div class="cl-vazio">Nenhuma filial usou estes cupons no período.</div>'
      : `<div class="cl-fh"><span>#</span><span>Filial</span><span>Usos</span><span>Venda</span></div>
        ${[...top, ...(euF ? [{ sep: true }, euF] : [])].map((x) => { if (x.sep) return '<div class="cl-fr sep"><span></span><span>…</span></div>';
          const pf = partesFilial(x.filial); return `<div class="cl-fr${x.pos <= 3 ? " podio" : ""}${x.filial === est.filial ? " eu" : ""}">
          <span class="p">${x.pos}</span><span class="nm">${pf.num ? `<small>${esc(pf.num)}</small>` : ""}${esc(pf.nome)}<em>${esc(x.cupom_top || "")}${+x.n_cupons > 1 ? ` +${+x.n_cupons - 1}` : ""}</em></span>
          <span class="qt">${int(x.usos)}</span><span class="vd">${brl(x.venda)}</span></div>`; }).join("")}`;
    const ud = p.dias > 1 && u.data ? ` · último dia (${dataBR(u.data).slice(0, 5)}): <b>${int(+u.vendas || 0)}</b> ${+u.vendas === 1 ? "uso" : "usos"}` : "";
    return `<div class="cl-col" style="--c:${e.cor};--c2:${e.cor2};--cp:${e.corP};--cbg:${e.bg}">
      <div class="cl-cab"><div class="tt"><div class="nm">${esc(g.nome)}</div><div class="ds">${e.ds}${ud}</div></div>
        <div class="pt"><b>${pctAuto(partCup)}</b><small>dos cupons usados ${MODO_FIL() ? "na filial" : "no período"}</small></div></div>
      <div class="cl-k">${kpis}</div>
      <div class="cl-sec cl-cup"><h3>Cupons<small>${legendaSit()}por usos no período · conversão = usados desde o início ÷ base de clientes</small></h3>${cup}</div>
      <div class="cl-baixo">
        <div class="cl-sec"><h3>${esc(depTit)}<small>${Array.isArray(g.departamentos) || est.depto ? depSub : ""}</small></h3>${dep}</div>
        <div class="cl-sec"><h3>Top 5 filiais<small><b>${int(nFil)}</b> ${nFil === 1 ? "filial usou" : "filiais usaram"}${MODO_FIL() ? " na regional" : ""}</small></h3>${fils}</div></div></div>`;
  }).join("");
  const nomes = clientesPrep(d).map((g) => `${g.nome}: ${g.cups.map((x) => x.cupom).join(", ") || "—"}`).join(" · ");
  const reg = est.filial ? "filial " + rotuloFilial(est.filial) : est.regional || (REG_PERM ? rotuloTodas() : "");
  nota.innerHTML = `${esc(p.rotulo || "Período escolhido")}${reg ? ` · <b>${esc(reg)}</b>` : ""}${DEP() ? ` · <b>${esc(DEP())}</b>` : ""} · ${esc(nomes)}`;
  // valores grandes (ex.: R$ 1,25 mi) diminuem a fonte até caber no cartão
  $$("#clCorpo .cl-k .v").forEach((v) => { let f = 36; while (v.scrollWidth > v.clientWidth && f > 24) v.style.fontSize = (f -= 2) + "px"; });
  // a altura da linha das filiais acompanha o espaço que sobrou
  $$("#clCorpo .cl-baixo .cl-sec:last-child").forEach((sec) => {
    const n = sec.querySelectorAll(".cl-fr:not(.sep)").length; if (!n || !sec.clientHeight) return;
    const livre = sec.clientHeight - sec.querySelector("h3").offsetHeight - (sec.querySelector(".cl-fh")?.offsetHeight || 0) - 14;
    sec.style.setProperty("--rh", Math.max(36, Math.min(54, Math.floor(livre / Math.max(5, n)))) + "px");
  });
}
function celClientes(d) {
  if (!(d.clientes && (d.clientes.grupos || []).length)) return "";
  return `<div class="bloco"><h2>Primeira compra e recuperação</h2><div class="s">No período escolhido · conversão = usados desde o início ÷ base de clientes</div>
    ${clientesPrep(d).map((g) => {
      const { e, k, t, cups } = g, vt = +t.venda_total || 0, nt = +t.vendas_total || 0;
      const fl = (g.filiais || []).filter((x) => +x.pos <= 5), dl = Array.isArray(g.departamentos) ? g.departamentos.filter((x) => +x.venda > 0).slice(0, 5) : [];
      return `<div style="margin-top:12px;border-left:5px solid ${e.cor};padding-left:10px"><div style="font-weight:900;color:var(--ve);font-size:17px">${esc(g.nome)}</div>
        <div class="cl-k2"><div><small>Cupons usados</small><b>${int(k.vendas)}</b><span>${pctAuto(nt > 0 ? k.vendas / nt : null)} das notas</span></div>
          <div><small>Vendas com cupom</small><b>${brlK(k.venda)}</b><span>${pctAuto(vt > 0 ? k.venda / vt : null)} da venda total</span></div>
          <div><small>Desconto</small><b>${brlK(k.desconto)}</b><span>médio ${k.desconto_pct == null ? "–" : pct(k.desconto_pct)}</span></div>
          <div><small>Ticket com cupom</small><b>${brl(k.ticket, false)}</b><span>${MODO_FIL() ? "não disponível por filial" : "Aurora " + brl(nt > 0 ? vt / nt : null, false)}</span></div></div>
        ${cups.slice(0, 6).map((x) => `<div class="ln"><span></span><span class="n" style="grid-column:2/4">${bolinha(x.cupom)}${esc(x.cupom)}</span><span></span><span class="q" style="grid-column:2/4;text-align:left"><b>${int(x.vendas)}</b> usos · ${brl(x.venda)}${x.conv != null ? ` · conv. <b>${convTxt(x.conv)}</b>` : ""}</span></div>`).join("")}
        ${dl.length ? `<div style="font-weight:800;color:var(--ve);font-size:14px;margin-top:8px">Por departamento</div>${dl.map((x, i) => `<div class="ln"><span class="po">${i + 1}</span><span class="n">${esc(nomeDep(x.departamento))}</span><span class="q"><b>${+x.vendas > 0 ? int(+x.vendas) + " cupons" : brl(+x.venda)}</b></span></div>`).join("")}` : ""}
        ${fl.length ? `<div style="font-weight:800;color:var(--ve);font-size:14px;margin-top:8px">Top filiais</div>${fl.map((x) => { const pf = partesFilial(x.filial); return `<div class="ln${+x.pos <= 3 ? " podio" : ""}${x.filial === est.filial ? " eu" : ""}"><span class="po">${x.pos}</span><span class="n">${pf.num ? `<small>${esc(pf.num)}</small>` : ""}${esc(pf.nome)}</span><span class="q"><b>${int(+x.usos)}</b> ${+x.usos === 1 ? "uso" : "usos"} · ${brl(+x.venda)}</span></div>`; }).join("")}` : ""}</div>`;
    }).join("")}</div>`;
}

// ---------------------------------------------------------------- celular
function desenharCel(d) {
  const el = $("#cel"), k = d.kpis || {}, p = d.periodo || {}, u = d.ultimo_dia || {};
  const tkRede = k.vendas_total > 0 ? k.venda_total / k.vendas_total : null, vt = k.ticket_sem ? k.ticket_com / k.ticket_sem - 1 : null;
  const regs = [...new Set([...(d.regional || []).map((r) => r.regional), ...(LISTA_FIL || []).map((x) => x.regional)])].filter((r) => r && r !== "(sem regional)" && (!REG_PERM || REG_PERM.includes(r))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const fils = (LISTA_FIL || []).filter((x) => (!est.regional || x.regional === est.regional) && (!REG_PERM || REG_PERM.includes(x.regional)))
    .map((x) => ({ ...x, ...partesFilial(x.filial) })).sort((a, b) => a.regional.localeCompare(b.regional, "pt-BR") || (+a.num || 9999) - (+b.num || 9999));
  if (est.filial && !fils.some((x) => x.filial === est.filial)) fils.unshift({ filial: est.filial, regional: est.regional, ...partesFilial(est.filial) });
  const gruposF = [...new Set(fils.map((x) => x.regional))];
  if (est.regional && !regs.includes(est.regional)) regs.unshift(est.regional);
  const datas = p.dias === 1 ? `${semana(p.fim)}, ${dataBR(p.fim)}` : p.dias > 1 ? `${dataBR(p.inicio)} a ${dataBR(p.fim)} · ${p.dias} dias` : "";
  const hora = HORA_TXT;
  const ln = (o) => `<div class="ln${o.podio ? " podio" : ""}${o.eu ? " eu" : ""}">${o.po != null ? `<span class="po">${o.po}</span>` : "<span></span>"}<span class="n"${o.dois ? ' style="grid-column:2/4"' : ""}>${o.n}</span>${o.dois ? "<span></span>" : ""}<span class="q"${o.dois ? ' style="grid-column:2/4;text-align:left"' : ""}>${o.q}</span>${o.w != null ? `<span></span><span class="br${o.verde ? " v" : ""}" style="width:${Math.max(2, o.w * 100).toFixed(1)}%"></span>` : ""}</div>`;
  let h = `<div class="topo"><img src="assets/img/campanha.svg" alt=""><div><h1>Cupons da campanha</h1><div class="at">${DEMO ? "DEMONSTRAÇÃO · dados fictícios · " : ""}${hora ? "Atualizado às " + esc(hora) : ""}</div></div><div style="margin-left:auto">${DEMO ? "" : Acesso.botaoUsuario()}</div></div>
    <div class="filtros"><div class="chips">${PERIODOS.map(([c, n]) => `<button class="chip${c === est.periodo ? " on" : ""}" data-cp="${c}">${n}</button>`).join("")}<button class="chip${est.periodo === "personalizado" || CEL.datas ? " on" : ""}" data-cdatas="1">📅 Datas</button></div>
      ${CEL.datas ? `<div class="cel-datas"><label>De<input type="date" id="celDIni" value="${esc(est.inicio || p.inicio || "")}"></label><label>Até<input type="date" id="celDFim" value="${esc(est.fim || p.fim || "")}"></label><button class="chip on" data-cdok="1">Aplicar</button></div>` : ""}
      <select id="celReg" aria-label="Regional"${REG_PERM?.length === 1 ? " disabled" : ""}><option value="">${esc(rotuloTodas())}</option>${regs.map((r) => `<option${r === est.regional ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>
      ${fils.length ? `<select id="celFil" aria-label="Filial"><option value="">${est.regional ? "Todas as filiais da " + esc(est.regional) : "Filial: todas"}</option>${gruposF.map((g) => `<optgroup label="${esc(g)}">${fils.filter((x) => x.regional === g).map((x) => `<option value="${esc(x.filial)}"${x.filial === est.filial ? " selected" : ""}>${esc(x.num ? x.num + " " + x.nome : x.nome)}</option>`).join("")}</optgroup>`).join("")}</select>` : ""}
      ${(LISTA_DEP || []).length ? `<select id="celDep" aria-label="Departamento"><option value="">Departamento: todos</option>${LISTA_DEP.map((x) => `<optgroup label="${esc(nomeDep(x.departamento))}"><option value="${esc(x.departamento)}|"${est.depto === x.departamento && !est.setor ? " selected" : ""}>${esc(nomeDep(x.departamento))} (inteiro)</option>${(x.setores || []).map((y) => `<option value="${esc(x.departamento)}|${esc(y.setor)}"${est.depto === x.departamento && est.setor === y.setor ? " selected" : ""}>${esc(nomeDep(y.setor))}</option>`).join("")}</optgroup>`).join("")}</select>` : ""}
      <div class="per"><b>${esc(p.rotulo || "")}</b> · ${esc(datas)}${DEP() ? ` · <b>${esc(DEP())}</b>` : ""}</div>${d.filial_filtro ? `<div class="nota-fil">Filial ${esc(rotuloFilial(est.filial))} · ticket, departamento e setor não estão disponíveis por filial${d.filial_filtro.dados_desde && p.inicio < d.filial_filtro.dados_desde ? " · dados só desde " + dataBR(d.filial_filtro.dados_desde) : ""}</div>` : ""}</div>`;
  if (!(p.dias > 0)) { el.innerHTML = h + '<div class="bloco"><div class="vazio">Este período ainda não tem dados.</div></div>'; return ligarCel(); }
  h += `<div class="kpis">
    <div class="k p"><div class="r">Cupons usados</div><div class="v">${int(k.vendas)}</div><div class="d"><b>${pctAuto(k.pct_vendas)}</b> das ${int(k.vendas_total)} notas</div></div>
    <div class="k" style="--c:var(--lj)"><div class="r">Vendas com cupom</div><div class="v">${brlK(k.venda)}</div><div class="d"><b>${pctAuto(k.pct_venda)}</b> de ${brlK(k.venda_total)}</div></div>
    <div class="k" style="--c:var(--lima)"><div class="r">Desconto</div><div class="v">${brlK(k.desconto)}</div><div class="d"><b>${k.venda_total > 0 ? pct(k.desconto / k.venda_total, 2) : "–"}</b> da venda total</div></div>
    <div class="k" style="--c:var(--ve)"><div class="r">Ticket com cupom</div><div class="v">${brl(k.ticket_com, false)}</div><div class="d">${QUEM_CURTO()} <b>${brl(tkRede, false)}</b>${vt == null ? "" : ` · <span class="${vt >= 0 ? "up" : "down"}">${vt >= 0 ? "▲" : "▼"} ${pct(Math.abs(vt), 0)}</span> sem cupom`}</div></div></div>`;
  if (p.dias > 1) {
    const pDia = u.venda_total > 0 ? u.venda / u.venda_total : null;
    h += `<div class="ud"><span class="t">Último dia · ${dataBR(u.data)}</span><span><b>${int(u.vendas)}</b>cupons usados</span><span><b>${brlK(u.venda)}</b>em vendas</span>
      <span><b>${brlK(u.desconto)}</b>de desconto</span><span><b>${pDia == null ? "–" : pctAuto(pDia)}</b>da venda do dia</span></div>`;
    const se = (d.serie || []).slice(-31).reverse(), mx = Math.max(1, ...se.map((x) => +x.venda || 0));
    h += `<div class="bloco"><h2>Por dia</h2><div class="s">Venda com cupom e quantidade de cupons · mais recente primeiro</div>
      ${se.map((x) => ln({ n: `${dm(String(x.data).slice(0, 10))} <small>${semana(String(x.data).slice(0, 10)).slice(0, 3)}</small>`, q: `<b>${brl(+x.venda)}</b> · ${int(x.vendas)} cupons`, w: (+x.venda || 0) / mx, verde: true })).join("")}</div>`;
  }
  const rk = (d.ranking || []), r10 = rk.slice(0, 10), rmx = Math.max(1, ...r10.map((x) => +x.venda));
  h += `<div class="bloco"><h2>Cupons que mais venderam</h2><div class="s">${int(rk.length)} cupons usados no período</div>
    ${r10.length ? r10.map((x, i) => { const c = conversao(d, x.cupom); return ln({ po: i + 1, podio: i < 3, n: bolinha(x.cupom) + esc(x.cupom), q: `<b>${brl(+x.venda)}</b> · ${int(x.vendas)} usos${c ? ` · conv. <b>${convTxt(c.taxa)}</b>` : ""}`, w: x.venda / rmx }); }).join("") : '<div class="vazio">Nenhum cupom usado.</div>'}</div>`;
  // departamento e setor em quantidade de cupons (em R$ enquanto a carga não trouxer a contagem)
  const dep = (d.departamento || []).filter((x) => +x.venda > 0), st = (d.setor || []).filter((x) => +x.venda > 0);
  const qtd = dep.some((x) => +x.vendas > 0) || st.some((x) => +x.vendas > 0), m = (x) => (qtd ? +x.vendas || 0 : +x.venda || 0), f = (v) => (qtd ? `<b>${int(v)}</b> cupons` : `<b>${brl(v)}</b>`);
  const dl = dep.map((x) => ({ ...x, q: m(x) })).sort((a, b) => b.q - a.q), sl = st.map((x) => ({ ...x, q: m(x) })).filter((x) => x.q > 0).sort((a, b) => b.q - a.q);
  if (dl.length) {
    const dmx = Math.max(1, dl[0].q), smx = Math.max(1, sl[0]?.q || 1);
    h += `<div class="bloco"><h2>Por departamento e setor</h2><div class="s">${qtd ? "Cupons usados em notas com itens de cada departamento / setor" : "Venda dos itens com cupom"}</div>
      ${dl.map((x) => ln({ n: esc(x.departamento), q: f(x.q), w: x.q / dmx, verde: true })).join("")}
      <div style="height:8px"></div>${sl.slice(0, 10).map((x, i) => ln({ po: i + 1, n: `${esc(x.setor)} <small>${esc(x.n_deptos > 1 ? "vários" : x.departamento)}</small>`, q: f(x.q), w: x.q / smx })).join("")}
      ${sl.length > 10 ? `<div class="mais">+ ${sl.length - 10} setores menores</div>` : ""}</div>`;
  }
  // filiais: todas as da regional (ou top 10 sem filtro), com botão para ver todas
  if (Array.isArray(d.filiais)) {
    const l = prepararFiliais(d), com = l.filter((x) => x.venda > 0), sv = l.reduce((a, x) => a + x.venda, 0), stt = l.reduce((a, x) => a + x.venda_total, 0), media = stt > 0 ? sv / stt : null;
    const lim = CEL.verFiliais ? l.length : est.regional ? Math.min(l.length, 15) : 10, vis = l.slice(0, lim), fmx = Math.max(1, com[0]?.venda || 1);
    h += `<div class="bloco"><h2>Filiais${est.regional ? " · " + esc(est.regional) : ""}</h2><div class="s">${int(com.length)} de ${int(l.length)} filiais usaram cupom · % = parte da venda da filial feita com cupom (média ${pctAuto(media)})</div>
      ${(est.filial && !vis.some((x) => x.filial === est.filial) ? [...vis, ...l.filter((x) => x.filial === est.filial)] : vis).map((x) => ln({ dois: true, eu: x.filial === est.filial, po: x.pos ?? "–", podio: x.pos && x.pos <= 3, n: `${x.num ? `<small>${esc(x.num)}</small>` : ""}${esc(x.nome)}`,
        q: x.venda > 0 ? `<b>${brl(x.venda)}</b> · ${int(x.vendas)} cup. · <span class="pc${media != null && x.pct >= media ? " acima" : ""}">${pctAuto(x.pct)}</span>` : `sem cupom · venda ${brl(x.venda_total)}`,
        w: x.venda > 0 ? x.venda / fmx : null })).join("")}
      ${l.length > lim ? `<button class="btn-mais" data-mais="1">Ver todas as ${int(l.length)} filiais</button>` : ""}</div>`;
  }
  h += celMidia(d);
  h += celClientes(d);
  h += celGlossario();
  h += `<div class="rod">Os números são atualizados a cada 30 minutos.<br>Em alguns momentos, podem chegar com um pequeno atraso.<span class="cred">${creditoTexto()}</span></div>`;
  el.innerHTML = h; ligarCel(); desenharCelGlo();
}
function ligarCel() {
  const el = $("#cel");
  el.onclick = (ev) => {
    const c = ev.target.closest("[data-cp]"); if (c) { CEL.datas = false; aplicar({ periodo: c.dataset.cp }); return; }
    if (ev.target.closest("[data-cdatas]")) { CEL.datas = !CEL.datas; desenharCel(ultimo); return; }
    if (ev.target.closest("[data-cdok]")) {   // datas escolhidas no celular (início ≤ fim)
      let a = $("#celDIni").value, b = $("#celDFim").value; if (!a || !b) return;
      if (a > b) [a, b] = [b, a];
      CEL.datas = false; aplicar({ periodo: "personalizado", inicio: a, fim: b }); return;
    }
    if (ev.target.closest("[data-mais]")) { CEL.verFiliais = true; desenharCel(ultimo); }
  };
  const s = $("#celReg"); if (s) s.onchange = () => { CEL.verFiliais = false; aplicar({ regional: s.value, filial: "" }); };
  const sd = $("#celDep"); if (sd) sd.onchange = () => { CEL.verFiliais = false; const [dp, st] = sd.value.split("|"); aplicar({ depto: dp || "", setor: dp ? st || "" : "" }); };
  const sf = $("#celFil"); if (sf) sf.onchange = () => { CEL.verFiliais = false; aplicar({ filial: sf.value, regional: sf.value ? regionalDaFilial(sf.value) || est.regional : est.regional }); };
}

// ---------------------------------------------------------------- barra de controle
const telas = $$(".tela:not(.tela-extra)");   // o Glossário fica fora da rotação (abre pelo botão do cabeçalho)
function desenharRail() {
  $("#gTelas").innerHTML = telas.map((t, i) => `<button class="it ${i === est.tela ? "on" : ""}" data-tela="${i}"><span class="num">${i + 1}</span>${t.dataset.titulo}</button>`).join("");
  // na barra da TV, "7 dias" e "Mês passado" ficam ocultos (só aparecem se forem o período em uso)
  $("#gPer").innerHTML = PERIODOS.filter(([c]) => !PERIODOS_OCULTOS_BARRA.has(c) || c === est.periodo).map(([c, n]) => `<button class="it ${c === est.periodo ? "on" : ""}" data-periodo="${c}">${n}</button>`).join("") +
    (ANALISE ? `<button class="it ${est.periodo === "personalizado" ? "on" : ""}" data-acao="datas" title="Escolher datas">📅 Datas</button>` : "");
  const bc = $("#bCupons"), br = $("#bRegional");
  const sitRot = est.situacao === "ativo" ? "ativos" : est.situacao === "encerrado" ? "encerrados" : "";
  bc.textContent = est.cupons.length ? `Cupons: ${est.cupons.length === 1 ? est.cupons[0] : est.cupons.length + " escolhidos"}`
    : est.tipos.length ? `Tipo: ${est.tipos.length === 1 ? est.tipos[0] : est.tipos.length + " tipos"}${sitRot ? " · " + sitRot : ""}` : `Cupons: ${sitRot || "todos"}`;
  bc.classList.toggle("ativo", !!est.cupons.length || !!est.tipos.length || !!est.situacao);
  br.textContent = est.filial ? rotuloFilial(est.filial) : est.regional || (REG_PERM ? rotuloTodas() : "Regional: todas");   // nome curto: a barra é estreita
  br.title = est.filial ? `Filial ${rotuloFilial(est.filial)} · ${est.regional}` : est.regional ? "Regional: " + est.regional : "";
  br.classList.toggle("ativo", !!est.regional || !!est.filial);
  const bd = $("#bDepto");
  bd.textContent = est.depto ? (est.setor ? nomeDep(est.setor) : nomeDep(est.depto)) : "Depto: todos";
  bd.title = est.depto ? `Departamento ${nomeDep(est.depto)}${est.setor ? " · setor " + nomeDep(est.setor) : ""}` : "";
  bd.classList.toggle("ativo", !!est.depto);
  if (foco.zona === "rail") marcarFoco();
}

// ---------------------------------------------------------------- rotação, pausa e volta à visão padrão
let t0 = performance.now(), pausadoAte = 0, ultimaAcao = Date.now();
function mostrar(i, manual = false, voltando = false) {
  sairGlossario();   // trocar de tela fecha o Glossário
  est.tela = (i + telas.length) % telas.length;
  if (est.tela === telaFil() && !ANALISE) { FIL.pag = voltando ? FIL.paginas - 1 : paginaDaFilial(); desenharPaginaFiliais(false); }
  telas.forEach((t, j) => t.classList.toggle("ativa", j === est.tela));
  $("#mini").classList.toggle("on", est.tela !== 0 && est.tela !== telaMidia() && est.tela !== telaClientes());
  $$("#gTelas .it").forEach((b, j) => b.classList.toggle("on", j === est.tela));
  t0 = performance.now();
  if (manual) interagiu();
}
function proximaTela(i) {   // pula as telas sem dados (Filiais sem números por filial; Rádio/Influenciadores sem a função nova)
  for (let n = 1; n <= telas.length; n++) {
    const j = (i + n) % telas.length;
    if (j === telaFil() && !FIL.lista.length) continue;
    if (j === telaMidia() && !temMidia()) continue;
    if (j === telaClientes() && !temClientes()) continue;
    return j;
  }
  return (i + 1) % telas.length;
}
function interagiu() {
  ultimaAcao = Date.now();
  if (!ANALISE) pausadoAte = Date.now() + CFG.PAUSA_SEGUNDOS * 1000;
  $("#dica").style.opacity = 1;
}
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
function anel(frac, cor) {
  const r = 22, c = 2 * Math.PI * r;
  return `<svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="6"/>
    <circle cx="28" cy="28" r="${r}" fill="none" stroke="${cor}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 28 28)"/></svg>`;
}
function tick() {
  const agora = Date.now();
  // Todas as telas (inclusive Filiais) ficam o tempo normal de tela; a página das Filiais não muda sozinha.
  const dur = CFG.SEGUNDOS_POR_TELA * 1000;
  if (ANALISE) {
    $("#giro").innerHTML = `<div class="txt"><small>Modo análise</small></div>`;
  } else if (agora < pausadoAte || foco.zona) {
    t0 = performance.now();   // ao voltar a girar, a tela atual conta o tempo do zero
    const falta = foco.zona ? CFG.PAUSA_SEGUNDOS * 1000 : pausadoAte - agora;
    $("#giro").innerHTML = anel(1 - falta / (CFG.PAUSA_SEGUNDOS * 1000), "var(--lj)") +
      `<div class="txt">⏸ Pausado<small>${foco.zona ? "escolhendo…" : "volta a girar em " + mmss(falta)}</small></div>`;
  } else {
    const el = performance.now() - t0;
    // sem números por filial (SQL ainda não rodado ou carga antiga), a TV pula a tela Filiais
    if (el >= dur) mostrar(proximaTela(est.tela));
    const pagTxt = naPaginacao() ? [FIL.pag, FIL.paginas] : naPagGlo() ? [GLO.pag, GLO.paginas] : null;
    $("#giro").innerHTML = anel(Math.min(1, el / dur), "var(--lima)") + (pagTxt
      ? `<div class="txt">Página ${pagTxt[0] + 1} de ${pagTxt[1]}<small>próxima tela em ${mmss(dur - el)}</small></div>`
      : `<div class="txt">Próxima tela<small>em ${mmss(dur - el)}</small></div>`);
  }
  // TV: 10 min sem ninguém mexer → volta para a visão padrão (período e filtros do link)
  if (!ANALISE && !MQ_CEL.matches && !foco.zona && diferenteDoPadrao() && agora - ultimaAcao > CFG.VOLTAR_PADRAO_MINUTOS * 60e3) {
    const tela = est.tela; est = { ...PADRAO, cupons: [...PADRAO.cupons], tipos: [...PADRAO.tipos], tela }; desenharRail(); carregar();
  }
  if (agora - ultimaAcao > 20e3) $("#dica").style.opacity = 0.55;
}
setInterval(tick, 250);

function aplicar(mud) {
  Object.assign(est, mud);
  if (ANALISE || MQ_CEL.matches) {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries({ periodo: est.periodo, inicio: est.periodo === "personalizado" ? est.inicio : "", fim: est.periodo === "personalizado" ? est.fim : "",
      cupons: est.cupons.join(","), tipos: est.tipos.join(","), situacao: est.situacao, regional: est.regional, filial: est.filial, depto: est.depto, setor: est.setor, escopo: "" })) v ? p.set(k, v) : p.delete(k);
    history.replaceState(null, "", "?" + p);   // o link com a escolha pode ser salvo e usado na TV
  }
  desenharRail(); carregar();
}

// ---------------------------------------------------------------- navegação por controle remoto / teclado
// Fora dos filtros:  ◀ ▶ troca tela (nas telas Filiais e Glossário, passa as páginas) · OK/Espaço pausa · ▼ entra na barra · 1-6 vai direto à tela · 7 abre/fecha o Glossário
// Na barra:          ◀ ▶ anda · OK escolhe · ▲ ou Voltar sai
// Na janela:         ▲ ▼ anda · OK marca · Voltar fecha
const foco = { zona: null, i: 0 };
const itensZona = () => (foco.zona === "rail" ? $$("#rail .it") : foco.zona === "janela" ? $$("#folha [data-f]") : []);
function marcarFoco() {
  $$(".foco").forEach((e) => e.classList.remove("foco"));
  const it = itensZona(); if (!it.length) return;
  foco.i = Math.max(0, Math.min(foco.i, it.length - 1));
  it[foco.i].classList.add("foco"); it[foco.i].scrollIntoView({ block: "nearest" });
}
function entrarRail() {
  foco.zona = "rail";
  const it = $$("#rail .it"); foco.i = Math.max(0, it.findIndex((b) => b.dataset.periodo === est.periodo));
  marcarFoco();
}
function sairFoco() { foco.zona = null; $$(".foco").forEach((e) => e.classList.remove("foco")); }
const TECLA = { 37: "esq", 39: "dir", 38: "cima", 40: "baixo", 13: "ok", 32: "ok", 27: "voltar", 8: "voltar", 461: "voltar", 10009: "voltar", 179: "ok", 415: "ok", 19: "ok" };
addEventListener("keydown", (ev) => {
  if (ev.target.matches?.("input") && ![13, 27, 38, 40].includes(ev.keyCode)) return;   // digitando na busca
  const t = TECLA[ev.keyCode] || (/^[1-9]$/.test(ev.key) ? "num" : null);
  if (!t) return;
  ev.preventDefault();
  const estavaPausado = Date.now() < pausadoAte;
  interagiu();
  if (foco.zona === "janela") {
    const it = itensZona();
    if (t === "cima" || t === "esq") { foco.i--; marcarFoco(); }
    else if (t === "baixo" || t === "dir") { foco.i++; marcarFoco(); }
    else if (t === "ok") it[foco.i]?.click();
    else if (t === "voltar") fecharJanela();
    return;
  }
  if (foco.zona === "rail") {
    if (t === "esq") { foco.i--; marcarFoco(); }
    else if (t === "dir") { foco.i++; marcarFoco(); }
    else if (t === "ok") itensZona()[foco.i]?.click();
    else if (t === "cima" || t === "voltar") sairFoco();
    return;
  }
  // Na tela Filiais, ◀ ▶ passam as páginas do ranking; na primeira/última página, trocam de tela.
  // No Glossário, o mesmo: ◀ ▶ passam as páginas da lista.
  if (t === "esq") {
    if (naPaginacao() && FIL.pag > 0) { FIL.pag--; desenharPaginaFiliais(true); }
    else if (naPagGlo() && GLO.pag > 0) { GLO.pag--; desenharGlossario(); }
    else mostrar(est.tela - 1, true, true);
  } else if (t === "dir") {
    if (naPaginacao() && FIL.pag < FIL.paginas - 1) { FIL.pag++; desenharPaginaFiliais(true); }
    else if (naPagGlo() && GLO.pag < GLO.paginas - 1) { GLO.pag++; desenharGlossario(); }
    else mostrar(est.tela + 1, true);
  }
  else if (t === "baixo") entrarRail();
  else if (t === "num" && +ev.key <= telas.length) mostrar(+ev.key - 1, true);
  else if (t === "num" && +ev.key === telas.length + 1) { if (GLO.aberto) fecharGlossario(); else abrirGlossario(); }   // tecla 7: Glossário
  else if (t === "ok") { if (estavaPausado) { pausadoAte = 0; t0 = performance.now(); } }   // OK alterna pausar / voltar a girar
  else if (t === "voltar") { if (GLO.aberto) fecharGlossario(); else { pausadoAte = 0; t0 = performance.now(); } }
});
addEventListener("pointerdown", () => interagiu());
$("#filTopo").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-pg]"); if (!b) return;
  FIL.pag = +b.dataset.pg; interagiu(); desenharPaginaFiliais(true);
});
$("#rail").addEventListener("click", (ev) => {
  const b = ev.target.closest(".it"); if (!b) return;
  interagiu();
  if (b.dataset.tela) mostrar(+b.dataset.tela, true);
  else if (b.dataset.periodo) aplicar({ periodo: b.dataset.periodo });
  else if (b.dataset.acao === "cupons") abrirCupons();
  else if (b.dataset.acao === "regional") abrirRegional();
  else if (b.dataset.acao === "depto") abrirDepto();
  else if (b.dataset.acao === "datas") abrirDatas();
});

// ---------------------------------------------------------------- janelas de escolha
function abrirJanela(html, focoInicial = 0) {
  $("#folha").innerHTML = html; $("#janela").classList.add("on");
  foco.zona = "janela"; foco.i = focoInicial; marcarFoco();
}
function fecharJanela() { $("#janela").classList.remove("on"); entrarRail(); }
$("#janela").addEventListener("click", (ev) => { if (ev.target.id === "janela") fecharJanela(); });

let listaCupons = null;
async function abrirCupons() {
  if (!listaCupons) { try { listaCupons = await buscar(est, { acao: "cupons" }); } catch { listaCupons = []; } }
  const sel = new Set(est.cupons), selT = new Set(est.tipos); let escopo = est.escopo, q = "", sit = est.situacao;
  const temSit = !!(ultimo?.vigencia && Object.keys(ultimo.vigencia).length);
  const SITS = [["", "Todos"], ["ativo", "Ativos"], ["encerrado", "Encerrados"]];
  const tipos = [...new Set(listaCupons.map((c) => c.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const desenhar = () => {
    $("#lstT").innerHTML = tipos.map((t) => `<button class="opc tp ${selT.has(t) ? "sel" : ""}" data-f data-t="${esc(t)}"><span class="ck">${selT.has(t) ? "✓" : ""}</span>${esc(t)}
      <span class="dt">${listaCupons.filter((c) => c.tipo === t).length} cupons</span></button>`).join("");
    $("#blocoT").style.display = tipos.length ? "" : "none";
    $("#lstS").innerHTML = SITS.map(([v, n]) => `<button class="opc tp ${sit === v ? "sel" : ""}" data-f data-s="${v}"><span class="ck">${sit === v ? "●" : ""}</span>${v ? bolinha(null, v) : ""}${n}
      <span class="dt">${int(v ? listaCupons.filter((c) => sitCupom(c.cupom) === v).length : listaCupons.length)} cupons</span></button>`).join("");
    $("#blocoS").style.display = temSit ? "" : "none";
    const vis = listaCupons.filter((c) => (escopo === "todos" || c.na_campanha || sel.has(c.cupom)) && (!selT.size || selT.has(c.tipo) || sel.has(c.cupom))
      && (!sit || sitCupom(c.cupom) === sit || sel.has(c.cupom)) && (!q || c.cupom.toUpperCase().includes(q)))
      .sort((a, b) => sel.has(b.cupom) - sel.has(a.cupom) || b.venda - a.venda);
    $("#lst").innerHTML = vis.map((c) => `<button class="opc ${sel.has(c.cupom) ? "sel" : ""}" data-f data-c="${esc(c.cupom)}"><span class="ck">${sel.has(c.cupom) ? "✓" : ""}</span>
      <span>${bolinha(c.cupom)}${esc(c.cupom)}${c.tipo ? `<span class="tpn">${esc(c.tipo)}</span>` : ""}</span><span class="dt">${brl(c.venda)} · desde ${dataBR(c.primeiro_uso)}</span></button>`).join("")
      || '<div class="vazio">Nenhum cupom encontrado.</div>';
    $("#resumo").textContent = [sit ? (sit === "ativo" ? "só ativos" : "só encerrados") : "", selT.size ? `${selT.size} tipo(s)` : "", sel.size ? `${sel.size} cupom(ns)` : ""].filter(Boolean).join(" + ") || "Nada escolhido = todos os cupons";
  };
  abrirJanela(`<h2>Escolher cupons</h2><div class="ajuda">▲ ▼ para andar · OK para marcar · Voltar para fechar · escolha um tipo inteiro ou cupons específicos</div>
    <div id="blocoS"><div class="rotT">Situação</div><div class="lista tipos" id="lstS"></div></div>
    <div id="blocoT"><div class="rotT">Tipos</div><div class="lista tipos" id="lstT"></div></div>
    ${ANALISE ? '<input type="search" id="busca" placeholder="Buscar cupom pelo nome…">' : ""}
    <div class="rotT">Cupons</div><div class="lista" id="lst"></div>
    <div class="acoes"><span id="resumo" style="margin-right:auto;align-self:center;font-size:20px;color:var(--muted)"></span>
      <button class="btn" data-f id="bLimpar">Limpar</button><button class="btn pri" data-f id="bAplicar">Aplicar</button></div>`);
  desenhar(); marcarFoco();
  const redesenhar = () => { const i = foco.i; desenhar(); foco.i = i; marcarFoco(); };
  $("#folha").onclick = (ev) => {
    const sb = ev.target.closest("[data-s]");
    if (sb) { sit = sb.dataset.s; return redesenhar(); }
    const t = ev.target.closest("[data-t]");
    if (t) { const v = t.dataset.t; selT.has(v) ? selT.delete(v) : selT.add(v); return redesenhar(); }
    const o = ev.target.closest("[data-c]");
    if (o) { const c = o.dataset.c; sel.has(c) ? sel.delete(c) : sel.add(c); return redesenhar(); }
    if (ev.target.closest("#bLimpar")) { sel.clear(); selT.clear(); sit = ""; return redesenhar(); }
    if (ev.target.closest("#bAplicar")) { $("#janela").classList.remove("on"); sairFoco(); aplicar({ cupons: [...sel], tipos: [...selT], situacao: sit, escopo }); }
  };
  const b = $("#busca"); if (b) b.oninput = () => { q = b.value.trim().toUpperCase(); desenhar(); };
}
async function abrirRegional() {
  const lf = await filiaisDisponiveis();
  const deDados = (ultimo?.regional || []).map((r) => r.regional);
  const regs = [...new Set([...lf.map((x) => x.regional), ...deDados])].filter((r) => r && r !== "(sem regional)" && (!REG_PERM || REG_PERM.includes(r)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const porReg = new Map(regs.map((r) => [r, lf.filter((x) => x.regional === r).map((x) => ({ ...x, ...partesFilial(x.filial) }))
    .sort((a, b) => (+a.num || 9999) - (+b.num || 9999) || a.nome.localeCompare(b.nome, "pt-BR"))]));
  const abertas = new Set(regs.length === 1 ? regs : est.filial && est.regional ? [est.regional] : []);
  let q = "";
  const casa = (x) => { if (!q) return true; const dig = q.replace(/\D/g, ""); return semAcento(`${x.num} ${x.nome} ${x.regional}`).includes(q) || (dig && dig === q && +x.num === +dig); };
  const desenhar = () => {
    let h = "";
    if (regs.length > 1 && !q) h += `<button class="opc ${!est.regional && !est.filial ? "sel" : ""}" data-f data-r=""><span class="ck">${!est.regional && !est.filial ? "✓" : ""}</span>${esc(rotuloTodas())}</button>`;
    for (const r of regs) {
      const fs = porReg.get(r) || [], vis = q ? fs.filter(casa) : fs, regCasa = !q || semAcento(r).includes(q);
      if (q && !vis.length && !regCasa) continue;
      const aberta = q ? vis.length > 0 : abertas.has(r), selR = est.regional === r && !est.filial;
      h += `<div class="reg-linha"><button class="opc ${selR ? "sel" : ""}" data-f data-r="${esc(r)}"><span class="ck">${selR ? "✓" : ""}</span>${esc(r)}<span class="dt">regional inteira</span></button>`;
      if (fs.length && !q) h += `<button class="opc abre${aberta ? " on" : ""}" data-f data-ab="${esc(r)}">${aberta ? "▾" : "▸"} ${int(fs.length)} filiais</button>`;
      h += "</div>";
      if (aberta) h += (q ? vis : fs).map((x) => { const sel = est.filial === x.filial;
        return `<button class="opc fil ${sel ? "sel" : ""}" data-f data-fil="${esc(x.filial)}" data-reg="${esc(r)}"><span class="ck">${sel ? "✓" : ""}</span><small>${esc(x.num || "")}</small>${esc(x.nome)}${q ? `<span class="rg">${esc(r)}</span>` : ""}</button>`; }).join("");
    }
    $("#lstR").innerHTML = h || '<div class="vazio">Nenhuma filial encontrada.</div>';
  };
  abrirJanela(`<h2>Escolher regional ou filial</h2><div class="ajuda">▲ ▼ para andar · OK para escolher · ▸ abre as filiais da regional</div>
    <input type="search" id="buscaR" placeholder="Buscar filial pelo número, cidade ou regional…" autocomplete="off">
    <div class="lista" id="lstR"></div>`);
  desenhar();
  const itens = () => $$("#folha [data-f]");
  const alvo = itens().findIndex((b) => (est.filial ? b.dataset.fil === est.filial : b.dataset.r === est.regional && b.dataset.r !== undefined));
  foco.i = Math.max(0, alvo); marcarFoco();
  if (!lf.length) $("#lstR").insertAdjacentHTML("beforeend", '<div class="vazio" style="font-size:18px;padding:12px">Lista de filiais indisponível no momento.</div>');
  $("#folha").onclick = (ev) => {
    const ab = ev.target.closest("[data-ab]");
    if (ab) { const r = ab.dataset.ab; abertas.has(r) ? abertas.delete(r) : abertas.add(r); const i = foco.i; desenhar(); foco.i = i; marcarFoco(); return; }
    const f = ev.target.closest("[data-fil]");
    if (f) { $("#janela").classList.remove("on"); sairFoco(); CEL.verFiliais = false; aplicar({ regional: f.dataset.reg, filial: f.dataset.fil }); return; }
    const o = ev.target.closest("[data-r]");
    if (o) { $("#janela").classList.remove("on"); sairFoco(); aplicar({ regional: o.dataset.r, filial: "" }); }
  };
  const b = $("#buscaR"); b.oninput = () => { q = semAcento(b.value.trim()); desenhar(); foco.i = 0; marcarFoco(); };
}
// ---------------------------------------------------------------- departamentos e setores (para o filtro)
let LISTA_DEP = null;
async function deptosDisponiveis() {
  if (LISTA_DEP) return LISTA_DEP;
  try {
    if (DEMO) {
      const d = ultimo || {};
      LISTA_DEP = (d.departamento || []).map((x) => ({ departamento: x.departamento, setores: (d.setor || []).filter((s) => s.departamento === x.departamento).map((s) => ({ setor: s.setor })) }));
    } else LISTA_DEP = await buscar(est, { acao: "deptos" });
    if (!Array.isArray(LISTA_DEP)) LISTA_DEP = null;
  } catch (e) { console.error("deptos:", e); LISTA_DEP = null; }
  return LISTA_DEP || [];
}
async function abrirDepto() {
  const ld = await deptosDisponiveis();
  const abertos = new Set(est.depto ? [est.depto] : ld.length === 1 ? [ld[0].departamento] : []);
  const desenhar = () => {
    let h = `<button class="opc ${!est.depto ? "sel" : ""}" data-f data-dp=""><span class="ck">${!est.depto ? "✓" : ""}</span>Todos os departamentos</button>`;
    for (const x of ld) {
      const dp = x.departamento, ss = x.setores || [], aberto = abertos.has(dp), selD = est.depto === dp && !est.setor;
      h += `<div class="reg-linha"><button class="opc ${selD ? "sel" : ""}" data-f data-dp="${esc(dp)}"><span class="ck">${selD ? "✓" : ""}</span>${esc(nomeDep(dp))}<span class="dt">departamento inteiro</span></button>`;
      if (ss.length) h += `<button class="opc abre${aberto ? " on" : ""}" data-f data-abd="${esc(dp)}">${aberto ? "▾" : "▸"} ${int(ss.length)} setores</button>`;
      h += "</div>";
      if (aberto) h += ss.map((y) => { const sel = est.depto === dp && est.setor === y.setor;
        return `<button class="opc fil ${sel ? "sel" : ""}" data-f data-dp="${esc(dp)}" data-st="${esc(y.setor)}"><span class="ck">${sel ? "✓" : ""}</span>${esc(nomeDep(y.setor))}</button>`; }).join("");
    }
    $("#lstD").innerHTML = h;
  };
  abrirJanela(`<h2>Escolher departamento ou setor</h2><div class="ajuda">▲ ▼ para andar · OK para escolher · ▸ abre os setores do departamento · vale para todas as telas</div>
    <div class="lista" id="lstD"></div>`);
  desenhar();
  const alvo = $$("#folha [data-f]").findIndex((b) => b.dataset.dp === est.depto && (b.dataset.st || "") === est.setor);
  foco.i = Math.max(0, alvo); marcarFoco();
  if (!ld.length) $("#lstD").insertAdjacentHTML("beforeend", '<div class="vazio" style="font-size:18px;padding:12px">Lista de departamentos indisponível no momento.</div>');
  $("#folha").onclick = (ev) => {
    const ab = ev.target.closest("[data-abd]");
    if (ab) { const r = ab.dataset.abd; abertos.has(r) ? abertos.delete(r) : abertos.add(r); const i = foco.i; desenhar(); foco.i = i; marcarFoco(); return; }
    const o = ev.target.closest("[data-dp]");
    if (o) { $("#janela").classList.remove("on"); sairFoco(); CEL.verFiliais = false; aplicar({ depto: o.dataset.dp, setor: o.dataset.dp ? o.dataset.st || "" : "" }); }
  };
}
function abrirDatas() {
  const p = ultimo?.periodo || {};
  abrirJanela(`<h2>Escolher datas</h2><div class="ajuda">Qualquer intervalo de dias</div>
    <div class="datas"><label>De<input type="date" id="dIni" value="${est.inicio || p.inicio || ""}"></label><label>Até<input type="date" id="dFim" value="${est.fim || p.fim || ""}"></label></div>
    <div class="acoes"><button class="btn" data-f id="bCanc">Cancelar</button><button class="btn pri" data-f id="bOk">Aplicar</button></div>`, 1);
  $("#folha").onclick = (ev) => {
    if (ev.target.closest("#bCanc")) return fecharJanela();
    if (ev.target.closest("#bOk") && $("#dIni").value && $("#dFim").value) {
      const [a, b] = [$("#dIni").value, $("#dFim").value].sort();   // aceita as datas em qualquer ordem
      $("#janela").classList.remove("on"); sairFoco(); aplicar({ periodo: "personalizado", inicio: a, fim: b });
    }
  };
}

// ---------------------------------------------------------------- início e atualização automática
function agendarRecarga() {
  const [h, m] = CFG.HORA_ATUALIZACAO.split(":").map(Number);
  const agora = new Date(), alvo = new Date(agora); alvo.setHours(h, m, 0, 0);
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
  setTimeout(() => location.reload(), alvo - agora);            // recarrega a página todo dia (pega versões novas do site)
  setInterval(() => { cache.clear(); carregar(true, true); }, Math.max(1, CFG.MINUTOS_DADOS) * 60e3);   // busca dados novos a cada poucos minutos (não conta como uso da sessão)
  // Celular bloqueado, aba em segundo plano ou internet caída: o navegador congela a página e a busca
  // automática para. Ao voltar, busca na hora (sem precisar de F5). Se passou do horário da recarga diária, recarrega.
  const abriuEm = Date.now();
  let ultimaVolta = 0;
  function atualizarAoVoltar() {
    if (document.visibilityState === "hidden") return;
    if (Date.now() - ultimaVolta < 30e3) return;                   // evita buscas repetidas (foco + visibilidade juntos)
    ultimaVolta = Date.now();
    const ultimaRecarga = new Date(); ultimaRecarga.setHours(h, m, 0, 0);
    if (ultimaRecarga > Date.now()) ultimaRecarga.setDate(ultimaRecarga.getDate() - 1);
    if (abriuEm < ultimaRecarga.getTime()) return location.reload();   // perdeu a recarga diária enquanto estava congelada
    cache.clear(); carregar(true, true);
  }
  document.addEventListener("visibilitychange", atualizarAoVoltar);
  window.addEventListener("focus", atualizarAoVoltar);
  window.addEventListener("online", () => { ultimaVolta = 0; atualizarAoVoltar(); });
  window.addEventListener("pageshow", (ev) => { if (ev.persisted) { ultimaVolta = 0; atualizarAoVoltar(); } });
}
(async function iniciar() {
  if (!DEMO) {
    ACESSO = await Acesso.iniciar({ destino: "painel" });      // login / TV / link antigo
    REG_PERM = ACESSO.regionais?.length ? ACESSO.regionais : null;
    if (est.regional && REG_PERM && !REG_PERM.includes(est.regional)) est.regional = PADRAO.regional = "";
  }
  modoCel();
  ligarGlossario();
  ligarRanking();
  ligarAjuda();
  // as alturas das linhas são medidas no desenho: quando a fonte do site termina de carregar, redesenha com as medidas certas
  if (document.fonts) document.fonts.ready.then(() => { if (ultimo) desenharTudo(); });
  desenharRail(); mostrar(0);
  if (ANALISE) $("#dica").innerHTML = "Clique nos botões da barra · <kbd>◀ ▶</kbd> trocam de tela";
  await carregar();
  agendarRecarga();
})();
