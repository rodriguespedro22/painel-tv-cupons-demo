/* =====================================================================
   Painel de Cupons · acesso
   - Pessoas: e-mail + senha + código do aplicativo autenticador (MFA).
     1º acesso: troca da senha provisória e ativação do autenticador.
   - TV: pareada uma vez por código (sem MFA e sem tempo de sessão).
   - Solicitar acesso (14/10/2026): nome + e-mail corporativo; só registra o pedido para o administrador aprovar.
   - O link antigo com chave (?k=) foi desligado: só entra quem fizer login ou TV autorizada.
   Usado por index.html e admin.html.  API: window.Acesso
   ===================================================================== */
(function () {
  "use strict";
  const CFG = window.PAINEL_CONFIG || {};
  const LS = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  };
  const SS = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* idem */ } },
  };
  const K_TV = "painelTv", K_TV_PEND = "painelTvPendente", K_ANTIGA = "painelChave", K_ATIV = "painelAtividade", K_MSG = "painelMsg";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- ícones
  const I = {
    escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
    olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    olhoX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    cadeado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    chave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L20 3M16 7l3 3M14 9l2 2"/></svg>',
    engrenagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    grafico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
    sair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  };

  // ---------------------------------------------------------------- Supabase e API
  let sb = null;
  function cliente() {
    if (sb) return sb;
    if (!window.supabase?.createClient) throw new Error("Biblioteca de login não carregou (assets/vendor/supabase.js).");
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_CHAVE_PUBLICA) throw new Error("Preencha SUPABASE_URL e SUPABASE_CHAVE_PUBLICA no assets/js/config.js.");
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_CHAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "painel-cupons-auth" },
    });
    return sb;
  }
  async function tokenAtual() {
    const { data } = await cliente().auth.getSession();
    return data.session?.access_token || "";
  }
  class ErroApi extends Error { constructor(m, codigo, status) { super(m); this.codigo = codigo; this.status = status; } }
  async function api(corpo, cab = {}) {
    let r;
    try {
      r = await fetch(CFG.API_URL, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", ...cab }, body: JSON.stringify(corpo) });
    } catch { throw new ErroApi("Sem conexão com o servidor. Confira a internet e tente de novo.", "rede", 0); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErroApi(j.erro || "Erro " + r.status, j.codigo || "", r.status);
    return j;
  }
  async function apiUsuario(corpo) { return api(corpo, { Authorization: "Bearer " + (await tokenAtual()) }); }

  // ---------------------------------------------------------------- estado público
  let estado = { tipo: null };
  async function cabecalhos(auto = false) {
    if (estado.tipo === "tv") return { "x-tv-token": LS.get(K_TV) || "" };
    if (estado.tipo === "chave_antiga") return { "x-painel-token": estado.chave };
    if (estado.tipo === "usuario") {
      // atualização automática só deixa de contar como uso se a pessoa não mexeu na tela nos últimos 10 min
      const parado = Date.now() - (+LS.get(K_ATIV) || 0) > 10 * 60e3;
      return { Authorization: "Bearer " + (await tokenAtual()), ...(auto && parado ? { "x-auto": "1" } : {}) };
    }
    return {};
  }

  // ---------------------------------------------------------------- moldura da tela de acesso
  let raiz = null;
  function montar() {
    if (raiz) return raiz;
    document.documentElement.style.overflow = "hidden";
    raiz = document.createElement("div");
    raiz.className = "ac";
    raiz.setAttribute("role", "dialog");
    raiz.setAttribute("aria-modal", "true");
    raiz.setAttribute("aria-label", "Acesso ao painel");
    raiz.innerHTML = `<div class="ac-caixa">
      <aside class="ac-marca">
        <img class="camp" src="assets/img/campanha.svg" alt="Campanha Aurora · R$ 10 milhões em cupons">
        <h1>Painel de<br><em>cupons</em></h1>
        <p>Resultado da campanha de Aurora: cupons usados, vendas, regionais e filiais, atualizado ao longo do dia.</p>
        <span class="ac-selo">${I.escudo} Acesso restrito · Rede Aurora</span>
      </aside>
      <section class="ac-lado"><div class="ac-topo"><div id="acPassos"></div><img src="assets/img/logo.svg" alt="Rede Aurora"></div><div id="acCorpo"></div></section>
    </div>`;
    document.body.appendChild(raiz);
    return raiz;
  }
  function desmontar() { raiz?.remove(); raiz = null; document.documentElement.style.overflow = ""; }
  function passos(atual) {   // atual: 0 nenhum · 1 senha · 2 autenticador
    const el = raiz.querySelector("#acPassos");
    if (!atual) { el.innerHTML = ""; return; }
    const p = (n, t) => `<span class="${n < atual ? "ok" : n === atual ? "on" : ""}"><i>${n < atual ? "✓" : n}</i>${t}</span>`;
    el.innerHTML = `<div class="ac-passos" aria-label="Primeiro acesso">${p(1, "Senha")}<b></b>${p(2, "Autenticador")}</div>`;
  }
  function corpo(html) {
    const el = raiz.querySelector("#acCorpo");
    el.innerHTML = `<div class="ac-corpo">${html}</div>`;
    const f = el.querySelector("input:not([type=hidden]), .ac-btn"); f?.focus({ preventScroll: true });
    return el;
  }
  const caixaMsg = (texto, tipo = "erro") => texto ? `<div class="ac-msg ${tipo}" role="${tipo === "erro" ? "alert" : "status"}">${tipo === "erro" ? I.alerta : I.info}<span>${esc(texto)}</span></div>` : "";
  function mostrarErro(el, texto) {
    el.querySelector(".ac-msg")?.remove();
    el.querySelector(".ac-erro-aqui")?.insertAdjacentHTML("afterbegin", caixaMsg(texto));
  }
  function ocupado(btn, sim) { btn.disabled = sim; btn.classList.toggle("carregando", sim); }
  function campoSenha(id, rot, auto, extra = "") {
    return `<label class="ac-campo"><span>${rot}</span><div class="ac-entrada"><input type="password" id="${id}" autocomplete="${auto}" required ${extra}>
      <button type="button" class="ver" data-ver="${id}" aria-label="Mostrar senha">${I.olho}</button></div></label>`;
  }
  function ligarVer(el) {
    el.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = () => {
      const i = el.querySelector("#" + b.dataset.ver), mostrar = i.type === "password";
      i.type = mostrar ? "text" : "password"; b.innerHTML = mostrar ? I.olhoX : I.olho; b.setAttribute("aria-label", mostrar ? "Esconder senha" : "Mostrar senha");
    }));
  }
  function traduzirErroAuth(e) {
    const m = String(e?.message || e || "");
    if (/invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/banned/i.test(m)) return "Este usuário está desativado. Fale com o administrador.";
    if (/rate limit|too many/i.test(m)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    if (/invalid totp|invalid code|expired/i.test(m)) return "Código incorreto ou vencido. Confira o código mais recente no aplicativo.";
    if (/fetch|network/i.test(m)) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
    return m || "Não foi possível concluir. Tente de novo.";
  }

  // ---------------------------------------------------------------- passos do login
  function passoEntrar(msg, info) {
    passos(0);
    return new Promise((ok) => {
      const el = corpo(`<h2>Entrar</h2><p class="ac-sub">Use o e-mail e a senha cadastrados pelo administrador do painel.</p>
        <form id="acF" novalidate><div class="ac-erro-aqui">${caixaMsg(msg)}${caixaMsg(info, "info")}</div>
          <label class="ac-campo"><span>E-mail</span><div class="ac-entrada"><input type="email" id="acEmail" autocomplete="username" inputmode="email" required placeholder="nome@exemplo.com.br"></div></label>
          ${campoSenha("acSenha", "Senha", "current-password")}
          <button class="ac-btn" id="acOk">Entrar</button></form>
        <button type="button" class="ac-btn sec ac-solicitar" id="acSol">Não tem acesso? <b>Solicitar acesso</b></button>
        <div class="ac-rodape"><span class="ac-link" style="text-decoration:none;cursor:default;font-weight:600">Esqueceu a senha? Fale com o administrador.</span>
          ${CFG.PERMITIR_TV === false ? "" : `<button class="ac-link ac-tvlink" id="acTv">${I.tv} Esta tela é uma TV</button>`}</div>`);
      ligarVer(el);
      const ultimo = LS.get("painelUltimoEmail"); if (ultimo) { el.querySelector("#acEmail").value = ultimo; el.querySelector("#acSenha").focus(); }
      el.querySelector("#acSol").onclick = () => ok("solicitar");
      el.querySelector("#acTv")?.addEventListener("click", () => location.assign(location.pathname.replace(/admin(\.html)?$/, "") + "?tv=parear"));
      el.querySelector("#acF").onsubmit = async (ev) => {
        ev.preventDefault();
        const email = el.querySelector("#acEmail").value.trim().toLowerCase(), senha = el.querySelector("#acSenha").value, b = el.querySelector("#acOk");
        if (!email || !senha) return mostrarErro(el, "Preencha o e-mail e a senha.");
        ocupado(b, true);
        const { error } = await cliente().auth.signInWithPassword({ email, password: senha });
        ocupado(b, false);
        if (error) { mostrarErro(el, traduzirErroAuth(error)); el.querySelector("#acSenha").select(); return; }
        LS.set("painelUltimoEmail", email);
        ok();
      };
    });
  }

  // ---------------------------------------------------------------- solicitar acesso
  // Mesma regra do banco (nome_proprio): "pedro RODRIGUES da cunha" → "Pedro Rodrigues da Cunha"
  const PARTICULAS = new Set(["da", "das", "de", "do", "dos", "e"]);
  function nomeProprio(t) {
    return String(t || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).map((w, i) => (i > 0 && PARTICULAS.has(w.toLowerCase()) ? w.toLowerCase()
      : w.split(/([-'’])/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(""))).join(" ");
  }
  const EMAIL_CORP = /^[a-z0-9][a-z0-9._%+-]*@(exemplo\.com\.br)$/;
  const NOME_OK = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]*( [A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]*)+$/;   // sem \p{L}: TVs antigas não entendem
  function passoSolicitar() {
    passos(0);
    return new Promise((ok) => {
      const el = corpo(`<h2>Solicitar acesso</h2><p class="ac-sub">Preencha com o seu <b>nome completo</b> e o seu <b>e-mail corporativo</b>. O administrador do painel confere e libera o acesso.</p>
        <form id="acFP" novalidate autocomplete="on"><div class="ac-erro-aqui"></div>
          <label class="ac-campo"><span>Nome completo</span><div class="ac-entrada"><input type="text" id="acPNome" autocomplete="name" maxlength="120" required placeholder="Ex.: Pedro Rodrigues da Cunha"></div></label>
          <div class="ac-previa" id="acPPrev" aria-live="polite"></div>
          <label class="ac-campo"><span>E-mail corporativo</span><div class="ac-entrada"><input type="email" id="acPEmail" autocomplete="email" inputmode="email" maxlength="120" required placeholder="nome@exemplo.com.br ou nome@exemplo.com.br"></div></label>
          <label class="ac-hp" aria-hidden="true">Site<input type="text" id="acPSite" tabindex="-1" autocomplete="off"></label>
          <button class="ac-btn" id="acPOk">Enviar solicitação</button></form>
        <div class="ac-rodape"><button type="button" class="ac-link" id="acPVolta">← Voltar para o login</button></div>`);
      const nome = el.querySelector("#acPNome"), email = el.querySelector("#acPEmail"), prev = el.querySelector("#acPPrev");
      nome.oninput = () => { const n = nomeProprio(nome.value); prev.innerHTML = n && n !== nome.value.trim() ? `Vai ficar assim: <b>${esc(n)}</b>` : ""; };
      el.querySelector("#acPVolta").onclick = () => ok();
      el.querySelector("#acFP").onsubmit = async (ev) => {
        ev.preventDefault();
        const n = nomeProprio(nome.value), e = email.value.trim().toLowerCase(), b = el.querySelector("#acPOk");
        if (!NOME_OK.test(n)) { nome.focus(); return mostrarErro(el, "Informe o nome completo (nome e sobrenome), só com letras."); }
        if (!EMAIL_CORP.test(e)) { email.focus(); return mostrarErro(el, "Use o seu e-mail corporativo: termina em @exemplo.com.br ou @exemplo.com.br."); }
        ocupado(b, true);
        try { await api({ acao: "solicitar_acesso", nome: n, email: e, site: el.querySelector("#acPSite").value }); }
        catch (err) { ocupado(b, false); return mostrarErro(el, err.message); }
        LS.set("painelUltimoEmail", e);
        const fim = corpo(`<div class="ac-icone ok">${I.escudo}</div><h2>Solicitação enviada</h2>
          <p class="ac-sub">Agora <b>chame o administrador do painel no Teams</b>, usando o mesmo e-mail (<b>${esc(e)}</b>), e avise que você fez a solicitação.</p>
          <p class="ac-sub">Depois da liberação, você recebe por lá a <b>senha provisória</b>. No primeiro acesso, o painel pede uma senha nova e a ativação do aplicativo autenticador no celular.</p>
          <button class="ac-btn sec" id="acPFim">Voltar para o login</button>`);
        fim.querySelector("#acPFim").onclick = () => ok();
      };
    });
  }

  function regrasSenha(s, c) {
    return [["10 caracteres ou mais", s.length >= 10], ["letras e números", /[A-Za-zÀ-ÿ]/.test(s) && /\d/.test(s)],
      ["diferente da provisória", s.length > 0 && !/^aurora-/i.test(s)], ["as duas iguais", s.length > 0 && s === c]];
  }
  // primeira=true: troca obrigatória da senha provisória (tela de acesso); false: pelo menu (janela)
  function formSenha(alvo, primeira, aoConcluir) {
    alvo.innerHTML = `${primeira ? `<h2>Crie a sua senha</h2><p class="ac-sub">A senha que você recebeu é provisória. Escolha uma senha só sua — ela não aparece para ninguém, nem para o administrador.</p>`
      : `<h3>Trocar senha</h3><p class="ac-sub" style="margin-bottom:16px">A nova senha vale a partir do próximo acesso.</p>`}
      <form id="acFS" novalidate><div class="ac-erro-aqui"></div>
        ${campoSenha("acN1", "Nova senha", "new-password", 'maxlength="72"')}
        ${campoSenha("acN2", "Repita a nova senha", "new-password", 'maxlength="72"')}
        <ul class="ac-regras" id="acRegras"></ul>
        <button class="ac-btn" id="acOkS">${primeira ? "Salvar e continuar" : "Salvar nova senha"}</button></form>`;
    ligarVer(alvo);
    const n1 = alvo.querySelector("#acN1"), n2 = alvo.querySelector("#acN2");
    const atualizar = () => { alvo.querySelector("#acRegras").innerHTML = regrasSenha(n1.value, n2.value).map(([t, v]) => `<li class="${v ? "ok" : ""}">${t}</li>`).join(""); };
    n1.oninput = n2.oninput = atualizar; atualizar(); n1.focus();
    alvo.querySelector("#acFS").onsubmit = async (ev) => {
      ev.preventDefault();
      const falta = regrasSenha(n1.value, n2.value).find(([, v]) => !v);
      if (falta) return mostrarErro(alvo, falta[0] === "as duas iguais" ? "As duas senhas não são iguais." : "A senha precisa ter " + falta[0] + ".");
      const b = alvo.querySelector("#acOkS"); ocupado(b, true);
      try { await apiUsuario({ acao: "trocar_senha", senha: n1.value }); aoConcluir(); }
      catch (e) { mostrarErro(alvo, e.message); }
      finally { ocupado(b, false); }
    };
  }
  function passoSenha() {
    passos(1);
    return new Promise((ok) => formSenha(corpo("").querySelector(".ac-corpo"), true, ok));
  }

  // campo de 6 dígitos: digita, cola, apaga; completa = envia
  function campoCodigo(el, aoCompletar) {
    const caixa = el.querySelector(".ac-otp"), ins = [...caixa.querySelectorAll("input")];
    const valor = () => ins.map((i) => i.value).join("");
    const marcar = () => ins.forEach((i) => i.classList.toggle("cheio", !!i.value));
    ins.forEach((inp, i) => {
      inp.addEventListener("input", () => {
        const d = inp.value.replace(/\D/g, "");
        if (d.length > 1) { d.slice(0, 6 - i).split("").forEach((c, k) => (ins[i + k].value = c)); }
        else inp.value = d;
        caixa.classList.remove("erro"); marcar();
        const prox = ins.find((x) => !x.value); (prox || ins[5]).focus();
        if (valor().length === 6) aoCompletar(valor());
      });
      inp.addEventListener("keydown", (ev) => {
        if (ev.key === "Backspace" && !inp.value && i > 0) { ins[i - 1].value = ""; ins[i - 1].focus(); marcar(); ev.preventDefault(); }
        if (ev.key === "ArrowLeft" && i > 0) ins[i - 1].focus();
        if (ev.key === "ArrowRight" && i < 5) ins[i + 1].focus();
      });
      inp.addEventListener("paste", (ev) => {
        const d = (ev.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (!d) return; ev.preventDefault();
        d.split("").forEach((c, k) => { if (ins[k]) ins[k].value = c; }); marcar();
        (ins[d.length] || ins[5]).focus();
        if (d.length === 6) aoCompletar(d);
      });
    });
    ins[0].focus();
    return { limpar: () => { ins.forEach((x) => (x.value = "")); marcar(); caixa.classList.add("erro"); ins[0].focus(); }, valor };
  }
  const htmlCodigo = () => `<div class="ac-otp" role="group" aria-label="Código de 6 dígitos">${Array.from({ length: 6 },
    (_, i) => `<input inputmode="numeric" autocomplete="${i ? "off" : "one-time-code"}" maxlength="6" aria-label="Dígito ${i + 1}">`).join("")}</div>`;

  async function passoAtivarMfa(eu) {
    passos(2);
    const c = cliente();
    let el = corpo(`<h2>Proteja o seu acesso</h2><p class="ac-sub">Preparando…</p>`);
    // tentativas anteriores não concluídas atrapalham um novo cadastro
    const { data: fl } = await c.auth.mfa.listFactors();
    for (const f of (fl?.all || []).filter((x) => x.status !== "verified")) await c.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "Painel de cupons " + new Date().toISOString().slice(0, 16),
      issuer: CFG.NOME_AUTENTICADOR || "Aurora Cupons" });
    if (error) { await passoAviso("Não foi possível ativar o autenticador", traduzirErroAuth(error), "Tentar de novo"); return; }
    const segredo = data.totp.secret.replace(/(.{4})/g, "$1 ").trim();
    // o QR vem como SVG "cru" (data:image/svg+xml;utf-8,<svg…>); recodificado, abre em qualquer navegador
    const qr = String(data.totp.qr_code || "");
    const m = qr.match(/^data:image\/svg\+xml;(?:utf-8|charset=utf-8),([\s\S]*)$/i);
    const qrSrc = m && /^\s*</.test(m[1]) ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(m[1]) : qr;
    return new Promise((ok) => {
      el = corpo(`<h2>Proteja o seu acesso</h2><p class="ac-sub">Além da senha, o painel pede um código que muda a cada 30 segundos no seu celular. É feito uma vez só.</p>
        <div class="ac-mfa"><div class="ac-qr"><img alt="QR Code para o aplicativo autenticador" src="${esc(qrSrc)}"></div>
          <ol class="ac-etapas"><li><span>Instale no celular o <b>Microsoft Authenticator</b> ou o <b>Google Authenticator</b>.</span></li>
            <li><span>No aplicativo, toque em <b>+</b> e <b>escaneie este QR Code</b>.</span></li>
            <li><span>Digite abaixo o <b>código de 6 números</b> que aparecer.</span></li></ol>
          <div class="ac-chave"><span>Sem câmera? Digite a chave:</span><code>${esc(segredo)}</code><button type="button" class="ac-copiar" id="acCop">Copiar</button></div></div>
        <div class="ac-erro-aqui"></div>${htmlCodigo()}
        <button class="ac-btn" id="acOkM">Confirmar e entrar</button>
        <div class="ac-rodape"><button class="ac-link" id="acOutra">Sair e usar outra conta</button></div>`);
      el.querySelector("#acCop").onclick = (ev) => { navigator.clipboard?.writeText(data.totp.secret).then(() => (ev.target.textContent = "Copiado ✓")); };
      el.querySelector("#acOutra").onclick = async () => { await c.auth.signOut({ scope: "local" }); ok(); };
      let enviando = false;
      const enviar = async (cod) => {
        if (enviando || !/^\d{6}$/.test(cod)) return; enviando = true;
        const b = el.querySelector("#acOkM"); ocupado(b, true);
        const { error: e } = await c.auth.mfa.challengeAndVerify({ factorId: data.id, code: cod });
        ocupado(b, false); enviando = false;
        if (e) { mostrarErro(el, traduzirErroAuth(e)); cc.limpar(); return; }
        ok();
      };
      const cc = campoCodigo(el, enviar);
      el.querySelector("#acOkM").onclick = () => enviar(cc.valor());
    });
  }

  async function passoCodigo(eu) {
    passos(0);
    const c = cliente();
    const { data: fl } = await c.auth.mfa.listFactors();
    const fator = (fl?.totp || [])[0];
    if (!fator) return passoAtivarMfa(eu);
    return new Promise((ok) => {
      const el = corpo(`<h2>Código de verificação</h2><p class="ac-sub">Olá, <b>${esc(String(eu.nome || "").split(" ")[0])}</b>. Abra o aplicativo autenticador no celular e digite o código de 6 números do <b>Aurora Cupons</b>.</p>
        <div class="ac-erro-aqui"></div>${htmlCodigo()}<button class="ac-btn" id="acOkC">Entrar</button>
        <div class="ac-rodape"><button class="ac-link" id="acOutra">Sair e usar outra conta</button>
          <span style="font-size:13.5px;color:var(--muted)">Trocou de celular? Peça ao administrador para redefinir o acesso.</span></div>`);
      el.querySelector("#acOutra").onclick = async () => { await c.auth.signOut({ scope: "local" }); ok(); };
      let enviando = false;
      const enviar = async (cod) => {
        if (enviando || !/^\d{6}$/.test(cod)) return; enviando = true;
        const b = el.querySelector("#acOkC"); ocupado(b, true);
        const { error } = await c.auth.mfa.challengeAndVerify({ factorId: fator.id, code: cod });
        ocupado(b, false); enviando = false;
        if (error) { mostrarErro(el, traduzirErroAuth(error)); cc.limpar(); return; }
        ok();
      };
      const cc = campoCodigo(el, enviar);
      el.querySelector("#acOkC").onclick = () => enviar(cc.valor());
    });
  }

  function passoAviso(titulo, texto, botao = "Voltar ao início", sair = true, extra = "") {
    passos(0);
    return new Promise((ok) => {
      const el = corpo(`<div class="ac-icone">${I.cadeado}</div><h2>${esc(titulo)}</h2><p class="ac-sub">${esc(texto)}</p>${extra}<button class="ac-btn sec" id="acV">${esc(botao)}</button>`);
      el.querySelector("#acV").onclick = async () => { if (sair) await cliente().auth.signOut({ scope: "local" }); ok(); };
    });
  }

  // ---------------------------------------------------------------- fluxo completo
  async function fluxoLogin(destino) {
    montar();
    const c = cliente();
    let msg = SS.get(K_MSG) || "", info = ""; SS.set(K_MSG, null);
    for (;;) {
      const { data: { session } } = await c.auth.getSession();
      if (!session) { if ((await passoEntrar(msg, info)) === "solicitar") await passoSolicitar(); msg = info = ""; continue; }
      let eu;
      try { eu = await apiUsuario({ acao: "eu" }); }
      catch (e) {
        if (e.codigo === "sem_acesso") { await passoAviso("Acesso não liberado", e.message); continue; }
        if (e.status === 401 || e.status === 403) { await c.auth.signOut({ scope: "local" }); msg = e.message; continue; }
        await passoAviso("Não foi possível entrar", e.message, "Tentar de novo", false); continue;
      }
      if (eu.trocar_senha) { await passoSenha(); info = ""; continue; }
      if (!eu.tem_mfa) { await passoAtivarMfa(eu); continue; }
      if (eu.aal !== "aal2") { await passoCodigo(eu); continue; }
      if (destino === "admin" && eu.perfil !== "admin") {
        await passoAviso("Área do administrador", "Seu usuário não é administrador. Você pode acessar o painel normalmente.", "Ir para o painel", false);
        location.assign("./"); return new Promise(() => {});
      }
      estado = { tipo: "usuario", ...eu };
      desmontar();
      vigiarInatividade(eu.sessao?.inativo_horas || 720);
      return estado;
    }
  }

  // inatividade: sem clique/tecla por X horas (em qualquer aba) → sai. O servidor também confere.
  const prazo = (h) => (h >= 48 && h % 24 === 0 ? `${h / 24} dias` : `${h} h`);
  function vigiarInatividade(horas) {
    const marcar = () => { const a = +LS.get(K_ATIV) || 0; if (Date.now() - a > 30e3) LS.set(K_ATIV, String(Date.now())); };
    marcar();
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) => addEventListener(t, marcar, { passive: true }));
    setInterval(() => {
      const a = +LS.get(K_ATIV) || Date.now();
      if (Date.now() - a > horas * 3600e3) sair(`Sessão encerrada após ${prazo(horas)} sem uso. Entre de novo.`);
    }, 60e3);
  }

  async function sair(mensagem) {
    try { if (estado.tipo === "usuario") await apiUsuario({ acao: "sair" }); } catch { /* segue saindo */ }
    try { await cliente().auth.signOut({ scope: "local" }); } catch { /* idem */ }
    if (mensagem) SS.set(K_MSG, mensagem);
    location.reload();
  }

  // Erro vindo da API de dados: decide se é caso de entrar de novo. true = tratado.
  function tratar(e) {
    const c = e?.codigo || "";
    if (estado.tipo === "tv" && (c === "tv_invalida" || c === "tv_pendente")) { LS.set(K_TV, null); location.replace(location.pathname + "?tv=parear"); return true; }
    if (estado.tipo === "chave_antiga" && (e?.status === 401 || c === "login")) {
      LS.set(K_ANTIGA, null); SS.set(K_MSG, "O link antigo não vale mais. Entre com o seu usuário."); location.reload(); return true;
    }
    if (estado.tipo === "usuario" && ["login", "sessao", "mfa", "trocar_senha", "sem_acesso"].includes(c)) {
      cliente().auth.signOut({ scope: "local" }).finally(() => { SS.set(K_MSG, e.message); location.reload(); });
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- TV
  function telaTv(html) {
    let el = document.querySelector(".ac-tv");
    if (!el) {
      el = document.createElement("div"); el.className = "ac-tv";
      el.innerHTML = `<aside class="lado"><img src="assets/img/campanha.svg" alt=""><h1>Painel de cupons<br>nesta TV</h1>
        <p>A TV fica conectada direto, sem senha. O administrador pode desligar o acesso dela a qualquer momento.</p></aside><main class="main" id="acTvMain"></main>`;
      document.body.appendChild(el); document.documentElement.style.overflow = "hidden";
    }
    el.querySelector("#acTvMain").innerHTML = html;
  }
  async function parearTv() {
    if (LS.get(K_TV)) { location.replace(location.pathname); return new Promise(() => {}); }
    telaTv(`<div class="rot">Configurar TV</div><h2>Gerando código…</h2>`);
    for (;;) {
      let seg = LS.get(K_TV_PEND), st = null;
      try {
        if (seg) st = await api({ acao: "tv_status" }, { "x-tv-token": seg });
        if (!st || st.status !== "pendente" || !st.codigo) {
          const n = await api({ acao: "tv_parear_iniciar" });
          seg = n.segredo; LS.set(K_TV_PEND, seg); st = { status: "pendente", codigo: n.codigo, expira_em: n.expira_em };
        }
      } catch (e) {
        telaTv(`<div class="rot">Configurar TV</div><h2>Sem conexão</h2><div class="estado">${esc(e.message)} · tentando de novo…</div>`);
        await espera(15e3); continue;
      }
      const letras = st.codigo.split("").map((ch) => (ch === "-" ? '<span class="tr"></span>' : `<span>${esc(ch)}</span>`)).join("");
      telaTv(`<div class="rot">Configurar TV</div><h2>Digite este código na administração</h2>
        <div class="codigo" aria-label="Código ${esc(st.codigo)}">${letras}</div>
        <ol class="passos"><li><span>No computador, abra o painel e entre como <b>administrador</b>.</span></li>
          <li><span>Vá em <b>Administração → TVs → Cadastrar TV</b>.</span></li>
          <li><span>Digite o código acima e escolha o nome e as regionais desta TV.</span></li></ol>
        <div class="estado"><span class="pulso"></span><span id="acTvSt">Aguardando confirmação…</span></div>`);
      const fim = new Date(st.expira_em).getTime();
      for (;;) {
        await espera(4000);
        const resta = Math.max(0, Math.round((fim - Date.now()) / 1000));
        const t = document.getElementById("acTvSt");
        if (t) t.textContent = `Aguardando confirmação · o código vale mais ${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, "0")}`;
        let s;
        try { s = await api({ acao: "tv_status" }, { "x-tv-token": seg }); } catch { continue; }
        if (s.status === "ativa") {
          LS.set(K_TV, seg); LS.set(K_TV_PEND, null);
          if (t) t.innerHTML = `<span class="ok">Pronto! TV “${esc(s.nome || "")}” autorizada.</span> Abrindo o painel…`;
          await espera(1800); location.replace(location.pathname); return new Promise(() => {});
        }
        if (s.status !== "pendente" || resta <= 0) { LS.set(K_TV_PEND, null); break; }   // venceu: gera outro
      }
    }
  }

  // ---------------------------------------------------------------- menu do usuário
  const iniciais = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  function botaoUsuario() {
    if (estado.tipo !== "usuario") return "";
    return `<button type="button" class="ac-chip" data-acesso-menu title="${esc(estado.email)}"><i>${esc(iniciais(estado.nome))}</i><span>${esc(String(estado.nome).split(" ")[0])}</span></button>`;
  }
  document.addEventListener("click", (ev) => { if (ev.target.closest?.("[data-acesso-menu]")) menu(); });
  function janela(html) {
    const m = document.createElement("div");
    m.className = "ac-modal";
    m.innerHTML = `<div class="ac-folha" role="dialog" aria-modal="true"><button class="fechar" aria-label="Fechar">×</button><div class="cont">${html}</div></div>`;
    const fechar = () => { m.remove(); removeEventListener("keydown", tecla, true); };
    const tecla = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); fechar(); } };
    m.addEventListener("click", (ev) => { if (ev.target === m || ev.target.closest(".fechar")) fechar(); });
    addEventListener("keydown", tecla, true);
    document.body.appendChild(m);
    return { el: m.querySelector(".cont"), fechar };
  }
  function menu() {
    if (estado.tipo !== "usuario") return;
    const e = estado, naAdmin = /\/admin(\.html)?$/.test(location.pathname);
    const naAnalise = !naAdmin && new URLSearchParams(location.search).get("modo") === "analise";
    const regs = e.regionais?.length ? e.regionais.map((r) => `<span class="ac-etq reg">${esc(r)}</span>`).join("") : '<span class="ac-etq">Todas as regionais</span>';
    const j = janela(`<div class="ac-quem"><div class="ac-avatar">${esc(iniciais(e.nome))}</div><div><b>${esc(e.nome)}</b><small>${esc(e.email)}</small></div></div>
      <div class="ac-etiquetas">${e.perfil === "admin" ? '<span class="ac-etq adm">Administrador</span>' : ""}${regs}</div>
      <div class="ac-opcoes">
        ${naAnalise ? `<a class="ac-opcao" href="./">${I.tv}<span>Tela da TV<small>telas girando sozinhas</small></span></a>`
          : `<a class="ac-opcao" href="./?modo=analise">${I.grafico}<span>Modo análise<small>escolher datas, cupons, regional e departamento</small></span></a>`}
        ${e.perfil === "admin" && !naAdmin ? `<a class="ac-opcao" href="admin">${I.engrenagem}<span>Administração<small>cupons, usuários, TVs e acessos</small></span></a>` : ""}
        <button class="ac-opcao" id="acTrocar">${I.chave}<span>Trocar senha</span></button>
        <button class="ac-opcao sair" id="acSair">${I.sair}<span>Sair</span></button></div>
      <div class="ac-nota">${(e.sessao?.max_horas || 720) === (e.sessao?.inativo_horas || 720) ? `O acesso vale por ${prazo(e.sessao?.max_horas || 720)}. Depois disso, o painel pede login de novo.` : `A sessão termina depois de ${prazo(e.sessao?.max_horas || 720)} ou de ${prazo(e.sessao?.inativo_horas || 720)} sem uso.`}</div>`);
    j.el.querySelector("#acSair").onclick = () => sair();
    j.el.querySelector("#acTrocar").onclick = () => {
      formSenha(j.el, false, () => { j.el.innerHTML = `<div class="ac-icone ok">${I.escudo}</div><h3>Senha alterada</h3><p class="ac-sub">Use a nova senha no próximo acesso.</p>`; });
    };
  }

  // ---------------------------------------------------------------- início
  // destino: "painel" (index) ou "admin". Resolve quando o acesso estiver liberado.
  async function iniciar({ destino = "painel" } = {}) {
    const Q = new URLSearchParams(location.search);
    try {
      if (destino === "painel") {
        if (Q.get("tv") === "parear") return parearTv();
        if (LS.get(K_TV)) { estado = { tipo: "tv" }; return estado; }
        // o link antigo com chave (?k=) foi desligado: apaga o que tiver ficado guardado e pede login
        LS.set(K_ANTIGA, null);
        if (Q.has("k")) { const u = new URL(location.href); u.searchParams.delete("k"); history.replaceState(null, "", u.pathname + u.search + u.hash);
          SS.set(K_MSG, "O link antigo não vale mais. Entre com o seu usuário."); }
      }
      return await fluxoLogin(destino);
    } catch (e) {
      montar(); await passoAviso("Não foi possível abrir o login", String(e.message || e), "Recarregar", false); location.reload();
      return new Promise(() => {});
    }
  }

  window.Acesso = {
    iniciar, cabecalhos, tratar, sair, menu, botaoUsuario, api: apiUsuario,
    get estado() { return estado; },
    esqueceTv() { LS.set(K_TV, null); LS.set(K_TV_PEND, null); },
  };
})();
