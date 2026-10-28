/* Ajuda, novidades e crédito do time
   - Crédito discreto "Desenvolvido pelo time de CRM" no canto da tela (TV e computador) e no rodapé do celular.
   - Bolinha "?" (só modo análise e celular; nunca na TV): aba Ajuda (contato) e aba Novidades (novidades.js).
   Carregado depois de novidades.js e antes de painel.js; ligarAjuda() é chamado em iniciar(). */
/* global $, esc, ANALISE, MQ_CEL, NOVIDADES, AJUDA_CONTATO */
/* exported ligarAjuda, creditoTexto */

const AJ = { aberto: false, aba: "ajuda", el: null, cred: null };
const AJ_CHAVE = "painel.novidadesVistas";

const creditoTexto = () => `Projeto de demonstração · <b>dados fictícios</b>`;
const ajVersao = () => (NOVIDADES[0] && NOVIDADES[0].versao) || "";

function ajLer() { try { return localStorage.getItem(AJ_CHAVE) || ""; } catch { return ""; } }
function ajGravar(v) { try { localStorage.setItem(AJ_CHAVE, v); } catch { /* sem armazenamento: só não lembra */ } }
const ajTemNovo = () => ajVersao() && ajLer() !== ajVersao();

function ajQuando(s) {
  const [d, h] = String(s).split("T");
  const [, m, dia] = d.split("-");
  return `${dia}/${m}` + (h ? ` · ${h.slice(0, 2)}h${h.slice(3, 5)}` : "");
}

const AJ_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 4.1"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>';
const AJ_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>';

function ajCorpoAjuda() {
  return `<h4>Precisa de ajuda?</h4>
    <p>Dúvidas sobre os números, os cupons ou o acesso ao painel? Fale com o <b>time de CRM</b>.</p>
    <button type="button" class="mail" data-aj-copiar>${AJ_MAIL}<span>${esc(AJUDA_CONTATO)}</span><small>clique para copiar</small></button>
    <ul class="dicas">
      <li><span><b>Glossário</b> (${MQ_CEL.matches ? "no fim da página" : "botão no topo"}): regras de cada cupom.</span></li>
      <li><span><b>Datas</b> (${MQ_CEL.matches ? "filtros" : "barra de baixo"}): escolha qualquer período.</span></li>
      <li><span>Os números são atualizados a cada 30 minutos.</span></li>
    </ul>`;
}

function ajCorpoNovidades() {
  return `<div class="vers">` + NOVIDADES.map((n, i) =>
    `<div class="ver${i ? "" : " atual"}"><div class="q">${ajQuando(n.quando)}${i ? "" : " <em>versão atual</em>"}</div>` +
    `<ul>${n.itens.map((t) => `<li>${t}</li>`).join("")}</ul></div>`).join("") + `</div>`;
}

function ajDesenhar() {
  const el = AJ.el;
  const novo = ajTemNovo();
  el.querySelector(".lb-ajuda").setAttribute("aria-expanded", String(AJ.aberto));
  el.querySelector(".lb-ajuda .pt").hidden = !novo;
  const pop = el.querySelector(".lb-pop");
  pop.hidden = !AJ.aberto;
  if (!AJ.aberto) return;
  pop.innerHTML = `<div class="tabs" role="tablist">
      <button type="button" role="tab" data-aj-aba="ajuda" aria-selected="${AJ.aba === "ajuda"}" class="${AJ.aba === "ajuda" ? "on" : ""}">Ajuda</button>
      <button type="button" role="tab" data-aj-aba="novidades" aria-selected="${AJ.aba === "novidades"}" class="${AJ.aba === "novidades" ? "on" : ""}">Novidades${novo ? ' <span class="nv">novo</span>' : ""}</button>
      <button type="button" class="x" data-aj-fechar aria-label="Fechar">×</button>
    </div>
    <div class="corpo">${AJ.aba === "ajuda" ? ajCorpoAjuda() : ajCorpoNovidades()}</div>
    <div class="rod"><span>${creditoTexto()}</span><span>versão ${esc(ajVersao())}</span></div>`;
}

function ajAbrir(aba) {
  AJ.aberto = true;
  if (aba) AJ.aba = aba;
  if (AJ.aba === "novidades") ajGravar(ajVersao());
  ajDesenhar();
}
function ajFechar() { if (!AJ.aberto) return; AJ.aberto = false; ajDesenhar(); }

async function ajCopiar(bt) {
  let ok = false;
  try { await navigator.clipboard.writeText(AJUDA_CONTATO); ok = true; } catch { ok = false; }
  const s = bt.querySelector("small");
  s.textContent = ok ? "copiado ✓" : "copie o endereço ao lado";
  setTimeout(() => { if (s.isConnected) s.textContent = "clique para copiar"; }, 2200);
}

/* Bolinha no palco (computador) ou fixa na tela (celular); na TV, só o crédito. */
function ajPosicionar() {
  const cel = MQ_CEL.matches;
  const mostra = ANALISE || cel;
  AJ.el.hidden = !mostra;
  AJ.cred.classList.toggle("com-ajuda", mostra);
  const pai = cel ? document.body : $("#stage");
  if (AJ.el.parentNode !== pai) pai.appendChild(AJ.el);
  if (!mostra) ajFechar(); else if (AJ.aberto) ajDesenhar();
}

function ligarAjuda() {
  const stage = $("#stage");
  AJ.cred = document.createElement("div");
  AJ.cred.className = "lb-cred";
  AJ.cred.innerHTML = `<i></i>${creditoTexto()}`;
  stage.appendChild(AJ.cred);

  AJ.el = document.createElement("div");
  AJ.el.id = "ajuda";
  AJ.el.innerHTML = `<button type="button" class="lb-ajuda" aria-label="Ajuda e novidades" aria-haspopup="dialog" aria-expanded="false" title="Ajuda e novidades">${AJ_ICO}<span class="pt" hidden></span></button>
    <div class="lb-pop" role="dialog" aria-label="Ajuda e novidades" hidden></div>`;
  stage.appendChild(AJ.el);

  AJ.el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.classList.contains("lb-ajuda")) return AJ.aberto ? ajFechar() : ajAbrir(ajTemNovo() ? "novidades" : "ajuda");
    if (t.dataset.ajAba) return ajAbrir(t.dataset.ajAba);
    if (t.hasAttribute("data-aj-fechar")) return ajFechar();
    if (t.hasAttribute("data-aj-copiar")) return ajCopiar(t);
  });
  document.addEventListener("click", (e) => { if (AJ.aberto && e.target.isConnected && !AJ.el.contains(e.target)) ajFechar(); });
  document.addEventListener("keydown", (e) => {
    if (AJ.aberto && e.key === "Escape") { e.stopPropagation(); ajFechar(); AJ.el.querySelector(".lb-ajuda").focus(); }
  }, true);
  MQ_CEL.addEventListener("change", ajPosicionar);
  ajPosicionar();
  ajDesenhar();
}
