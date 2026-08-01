(() => {
  "use strict";

  const SUPABASE_URL = "https://ytuzerdwjffqgzltjnoo.supabase.co";
  const SUPABASE_KEY = "sb_publishable_efnBKhPIePJ8dR-uEHfF7w_x25RIjJO";
  const DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
  const DAY_LABELS = { segunda: "Seg", terça: "Ter", quarta: "Qua", quinta: "Qui", sexta: "Sex", sábado: "Sáb", domingo: "Dom" };
  const MODE_LABELS = { home: "Home office", office: "Presencial", off: "Folga", custom: "Personalizado" };
  const MODE_DESCRIPTIONS = {
    home: "Acordar próximo do início do trabalho, fazer as refeições em casa e aproveitar o deslocamento poupado.",
    office: "Acordar às 07:00, sair às 07:30 e considerar deslocamento, alimentação levada e menor energia à noite.",
    off: "Dia sem expediente. Use para treino, preparação de comida, estudos, lazer ou recuperação.",
    custom: "Mantém as tarefas atuais e permite montar o dia sem um modelo automático."
  };

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const ui = {
    authMode: "login",
    activeTab: "jonathan",
    selectedDay: currentDay(),
    session: null,
    membership: null,
    household: null,
    data: null,
    channel: null,
    saveTimer: null,
    saving: false,
    recoveryMode: false
  };

  const $ = (id) => document.getElementById(id);

  function currentDay() {
    return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date().getDay()];
  }

  function mondayKey(date = new Date()) {
    const value = new Date(date);
    const weekday = value.getDay();
    const shift = weekday === 0 ? -6 : 1 - weekday;
    value.setDate(value.getDate() + shift);
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function task(time, title, notes = "", category = "rotina") {
    return { id: uid(), time, title, notes, category };
  }

  function subtractMinutes(time, amount) {
    const [hour, minute] = time.split(":").map(Number);
    const total = (hour * 60 + minute - amount + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function sleepHours(bedtime, wakeTime) {
    const [bh, bm] = bedtime.split(":").map(Number);
    const [wh, wm] = wakeTime.split(":").map(Number);
    let total = wh * 60 + wm - (bh * 60 + bm);
    if (total < 0) total += 1440;
    return total / 60;
  }

  function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return structuredClone(base);
    const output = structuredClone(base);
    Object.entries(patch).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) {
        output[key] = deepMerge(output[key], value);
      } else {
        output[key] = structuredClone(value);
      }
    });
    return output;
  }

  function settingsDefaults() {
    return {
      bedtime: "00:40",
      weekendWake: "09:30",
      work: {
        homeStart: "09:00",
        homeEnd: "18:00",
        officeWake: "07:00",
        officeLeave: "07:30",
        officeArrival: "08:50",
        officeStart: "09:00",
        officeEnd: "18:00",
        officeReturn: "19:20"
      },
      english: { days: ["terça", "quinta"], start: "18:00", end: "19:00" },
      gym: {
        start: "19:30",
        shortMinutes: 120,
        mediumMinutes: 135,
        longMinutes: 150,
        days: { segunda: "medium", quarta: "long", quinta: "short", sexta: "long", sábado: "long" }
      },
      salesforce: { fridayStart: "17:15", sundayCourseStart: "14:30", sundayPracticeStart: "15:45" },
      weights: { jonathanCurrent: 96, jonathanGoal: 87, isabellaCurrent: 59, isabellaGoal: 67 },
      isabella: { courseStart: "09:00", applicationsStart: "10:45", networkingStart: "14:00", portfolioStart: "15:30" }
    };
  }

  function workoutLabel(profile) {
    return profile === "short" ? "Treino curto" : profile === "medium" ? "Treino médio" : "Treino longo";
  }

  function workoutDuration(profile, settings) {
    return profile === "short" ? settings.gym.shortMinutes : profile === "medium" ? settings.gym.mediumMinutes : settings.gym.longMinutes;
  }

  function buildJonathanDay(day, mode, settings) {
    const list = [];
    const hasEnglish = settings.english.days.includes(day);
    const gymProfile = settings.gym.days[day];

    if (mode === "home") {
      list.push(task(subtractMinutes(settings.work.homeStart, 10), "Acordar e iniciar o dia", `Entrada no trabalho às ${settings.work.homeStart}`, "trabalho"));
      list.push(task(settings.work.homeStart, "Trabalho em home office", `Até ${settings.work.homeEnd}`, "trabalho"));
      list.push(task("12:30", "Almoço + Duolingo", "Duolingo por 10–15 minutos depois de comer.", "estudo"));
    } else if (mode === "office") {
      list.push(task(settings.work.officeWake, "Acordar", "Dia presencial.", "trabalho"));
      list.push(task(settings.work.officeLeave, "Sair de casa", `Chegada prevista às ${settings.work.officeArrival}`, "deslocamento"));
      list.push(task(settings.work.officeStart, "Trabalho presencial", `Até ${settings.work.officeEnd}`, "trabalho"));
      list.push(task("12:30", "Almoço + Duolingo", "Duolingo por 10–15 minutos.", "estudo"));
      list.push(task(settings.work.officeEnd, "Retorno para casa", `Chegada estimada por volta de ${settings.work.officeReturn}`, "deslocamento"));
    } else if (mode === "off") {
      list.push(task(settings.weekendWake, "Acordar e tomar café", "Dia sem expediente.", "pessoal"));
    }

    if (day === "sexta") {
      list.push(task(settings.salesforce.fridayStart, "Corporação Salesforce", "Bloco de 1 hora. Encerrar no horário.", "estudo"));
    }

    if (day === "domingo") {
      list.push(task("11:00", "Preparar refeições da semana", "Produzir bases para os dias de trabalho e treino.", "alimentação"));
      list.push(task(settings.salesforce.sundayCourseStart, "Corporação Salesforce", "Bloco de 1 hora.", "estudo"));
      list.push(task(settings.salesforce.sundayPracticeStart, "Prática Salesforce / Trailhead", "Aplicar o conteúdo por 45–60 minutos.", "estudo"));
      list.push(task("17:00", "Planejar a semana", "Revisar trabalho, treinos, inglês, alimentação e compromissos.", "planejamento"));
    }

    if (hasEnglish) {
      list.push(task(settings.english.start, "Aula de inglês", `Até ${settings.english.end}, junto com Isabella.`, "inglês"));
    }

    if (gymProfile) {
      list.push(task(mode === "office" ? "17:30" : hasEnglish ? "17:00" : "17:15", "Refeição pré-treino", "Refeição pronta para não chegar à academia com fome.", "alimentação"));
      list.push(task(settings.gym.start, workoutLabel(gymProfile), `${workoutDuration(gymProfile, settings)} minutos, junto com Isabella.`, "treino"));
      list.push(task(gymProfile === "short" ? "21:30" : "22:00", "Banho + jantar", "Jantar já preparado e porcionado.", "alimentação"));
    } else if (mode !== "off" && !hasEnglish) {
      list.push(task("20:00", "Jantar e noite leve", "Recuperação, organização pessoal e tempo livre.", "pessoal"));
    }

    list.push(task(settings.bedtime, "Dormir", mode === "office" ? "Proteger o sono antes ou depois do presencial." : "Horário habitual.", "sono"));
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }

  function buildIsabellaDay(day, settings) {
    const list = [];
    const hasEnglish = settings.english.days.includes(day);
    const gymProfile = settings.gym.days[day];

    if (!["sábado", "domingo"].includes(day)) {
      list.push(task(settings.isabella.courseStart, "Curso ou capacitação", "Bloco de 1h30 com início e fim definidos.", "estudo"));
      list.push(task(settings.isabella.applicationsStart, "Candidaturas qualificadas", "Meta de 3 a 5 vagas adequadas ao perfil.", "carreira"));
      list.push(task(settings.isabella.networkingStart, "LinkedIn e networking", "Fazer 1 contato útil ou acompanhar conversas.", "carreira"));
      list.push(task(settings.isabella.portfolioStart, "Currículo ou portfólio", "Um bloco objetivo, sem ocupar o dia inteiro.", "carreira"));
    } else {
      list.push(task(settings.weekendWake, "Acordar e tomar café", "Rotina mais leve.", "pessoal"));
    }

    if (day === "domingo") {
      list.push(task("11:00", "Preparar refeições da semana", "Dividir o preparo com Jonathan.", "alimentação"));
      list.push(task("17:00", "Planejar a semana", "Revisar vagas, cursos, treinos e compromissos.", "planejamento"));
    }

    if (hasEnglish) {
      list.push(task("17:00", "Lanche antes da aula", "Refeição compatível com a meta de ganho de peso.", "alimentação"));
      list.push(task(settings.english.start, "Aula de inglês", `Até ${settings.english.end}, junto com Jonathan.`, "inglês"));
    }

    if (gymProfile) {
      if (!hasEnglish) list.push(task(day === "sábado" ? "10:15" : "17:30", "Refeição pré-treino", "Porção maior e completa.", "alimentação"));
      list.push(task(day === "sábado" ? "11:00" : settings.gym.start, workoutLabel(gymProfile), `${workoutDuration(gymProfile, settings)} minutos, junto com Jonathan.`, "treino"));
      list.push(task(day === "sábado" ? "14:00" : gymProfile === "short" ? "21:30" : "22:00", "Banho + refeição pós-treino", "Refeição reforçada para ganho gradual de peso.", "alimentação"));
    } else if (!hasEnglish) {
      list.push(task("20:00", "Jantar e rotina pessoal", "Encerrar os blocos produtivos e descansar.", "pessoal"));
    }

    return list.sort((a, b) => a.time.localeCompare(b.time));
  }

  function createDefaultData() {
    const settings = settingsDefaults();
    const workModes = { segunda: "home", terça: "office", quarta: "office", quinta: "home", sexta: "home", sábado: "off", domingo: "off" };
    const tasks = { jonathan: {}, isabella: {} };
    DAYS.forEach((day) => {
      tasks.jonathan[day] = buildJonathanDay(day, workModes[day], settings);
      tasks.isabella[day] = buildIsabellaDay(day, settings);
    });
    return { version: 3, settings, workModes, tasks, completions: {} };
  }

  function normalizeData(raw) {
    const defaults = createDefaultData();
    const merged = deepMerge(defaults, raw || {});
    merged.tasks = merged.tasks || { jonathan: {}, isabella: {} };
    ["jonathan", "isabella"].forEach((person) => {
      merged.tasks[person] = merged.tasks[person] || {};
      DAYS.forEach((day) => {
        if (!Array.isArray(merged.tasks[person][day])) merged.tasks[person][day] = defaults.tasks[person][day];
        merged.tasks[person][day] = merged.tasks[person][day].map((item) => ({
          id: item.id || uid(),
          time: item.time || "12:00",
          title: item.title || "Nova tarefa",
          notes: item.notes || "",
          category: item.category || "rotina"
        }));
      });
    });
    merged.completions = merged.completions || {};
    merged.version = 3;
    return merged;
  }

  function completionKey(taskId) {
    return `${mondayKey()}:${taskId}`;
  }

  function isCompleted(taskId) {
    return Boolean(ui.data.completions[completionKey(taskId)]);
  }

  function setCompleted(taskId, completed) {
    ui.data.completions[completionKey(taskId)] = completed;
  }

  function showOnly(viewId) {
    ["authView", "setupView", "appView"].forEach((id) => $(id).classList.toggle("hidden", id !== viewId));
    $("appHeader").classList.toggle("hidden", viewId !== "appView");
    $("boot").classList.add("hidden");
  }

  function toast(message, type = "normal") {
    const node = $("toast");
    node.textContent = message;
    node.className = `toast show${type === "error" ? " error" : ""}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.className = "toast"; }, 2400);
  }

  function syncStatus(status, text) {
    const node = $("syncStatus");
    node.className = `sync-status ${status || ""}`.trim();
    node.innerHTML = `<i></i> ${esc(text)}`;
  }

  function translateError(error) {
    const message = String(error?.message || error || "Erro inesperado");
    const map = [
      ["Invalid login credentials", "E-mail ou senha inválidos."],
      ["Email not confirmed", "Confirme seu e-mail antes de entrar."],
      ["User already registered", "Este e-mail já possui uma conta."],
      ["Password should be at least", "A senha precisa ter pelo menos 6 caracteres."],
      ["invite code not found", "Código de convite não encontrado."],
      ["person profile already occupied", "Esse perfil já está sendo usado pela outra conta."],
      ["user already belongs to a routine", "Esta conta já está vinculada a uma rotina."],
      ["authentication required", "Sua sessão expirou. Entre novamente."]
    ];
    const match = map.find(([source]) => message.includes(source));
    return match ? match[1] : message;
  }

  function renderAuth() {
    showOnly("authView");
    const recovery = ui.recoveryMode;
    $("authView").innerHTML = `
      <div class="auth-card">
        <div class="boot-logo auth-logo">J&I</div>
        <h1>${recovery ? "Criar nova senha" : "Nossa Rotina"}</h1>
        <p>${recovery ? "Defina uma nova senha para sua conta." : "Jonathan e Isabella com logins separados e o mesmo cronograma sincronizado."}</p>
        ${recovery ? `
          <label class="field">Nova senha<input id="recoveryPassword" type="password" autocomplete="new-password" placeholder="Mínimo de 6 caracteres" /></label>
          <button id="recoverySubmit" class="button primary full" type="button" style="margin-top:12px">Atualizar senha</button>
        ` : `
          <div class="auth-switch">
            <button class="button ${ui.authMode === "login" ? "primary" : ""}" data-auth-mode="login" type="button">Entrar</button>
            <button class="button ${ui.authMode === "signup" ? "primary" : ""}" data-auth-mode="signup" type="button">Criar conta</button>
          </div>
          <div class="form-grid">
            <label class="field full">E-mail<input id="authEmail" type="email" autocomplete="email" placeholder="seuemail@exemplo.com" /></label>
            <label class="field full">Senha<input id="authPassword" type="password" autocomplete="${ui.authMode === "login" ? "current-password" : "new-password"}" placeholder="Mínimo de 6 caracteres" /></label>
          </div>
          <button id="authSubmit" class="button primary full" type="button" style="margin-top:12px">${ui.authMode === "login" ? "Entrar" : "Criar conta"}</button>
          <button id="forgotPassword" class="button full" type="button" style="margin-top:8px">Esqueci minha senha</button>
        `}
        <div id="authMessage" class="auth-message"></div>
      </div>`;

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => { ui.authMode = button.dataset.authMode; renderAuth(); });
    });

    if (recovery) {
      $("recoverySubmit").addEventListener("click", async () => {
        const password = $("recoveryPassword").value;
        if (password.length < 6) return setAuthMessage("A senha precisa ter pelo menos 6 caracteres.", true);
        const { error } = await db.auth.updateUser({ password });
        if (error) return setAuthMessage(translateError(error), true);
        ui.recoveryMode = false;
        setAuthMessage("Senha atualizada. Carregando sua rotina…", false);
        await routeSession((await db.auth.getSession()).data.session);
      });
      return;
    }

    $("authSubmit").addEventListener("click", submitAuth);
    $("forgotPassword").addEventListener("click", resetPassword);
    ["authEmail", "authPassword"].forEach((id) => {
      $(id).addEventListener("keydown", (event) => { if (event.key === "Enter") submitAuth(); });
    });
  }

  function setAuthMessage(message, error) {
    const node = $("authMessage");
    node.textContent = message;
    node.className = `auth-message${error ? " error" : ""}`;
  }

  async function submitAuth() {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    if (!email || !password) return setAuthMessage("Preencha e-mail e senha.", true);
    const button = $("authSubmit");
    button.disabled = true;
    button.textContent = "Aguarde…";

    try {
      if (ui.authMode === "login") {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await routeSession(data.session);
      } else {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href.split("#")[0] }
        });
        if (error) throw error;
        if (data.session) {
          await routeSession(data.session);
        } else {
          setAuthMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro.", false);
        }
      }
    } catch (error) {
      setAuthMessage(translateError(error), true);
    } finally {
      button.disabled = false;
      button.textContent = ui.authMode === "login" ? "Entrar" : "Criar conta";
    }
  }

  async function resetPassword() {
    const email = $("authEmail").value.trim();
    if (!email) return setAuthMessage("Informe seu e-mail primeiro.", true);
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split("#")[0] });
    setAuthMessage(error ? translateError(error) : "Enviamos o link de redefinição para seu e-mail.", Boolean(error));
  }

  function renderSetup() {
    showOnly("setupView");
    const guessedName = ui.session?.user?.email?.toLowerCase().includes("isabella") ? "Isabella" : "Jonathan";
    $("setupView").innerHTML = `
      <div class="auth-card">
        <div class="boot-logo auth-logo">J&I</div>
        <h1>Conectar a rotina</h1>
        <p>Uma pessoa cria o espaço. A outra entra usando o código de convite.</p>
        <div class="form-grid">
          <label class="field">Seu nome<input id="setupName" value="${guessedName}" /></label>
          <label class="field">Seu perfil<select id="setupPerson"><option value="jonathan">Jonathan</option><option value="isabella" ${guessedName === "Isabella" ? "selected" : ""}>Isabella</option></select></label>
          <label class="field full">Nome do espaço<input id="setupHousehold" value="Nossa Rotina" /></label>
          <label class="field full">Código de convite<input id="setupInvite" placeholder="Ex.: A1B2C3D4" maxlength="8" /></label>
        </div>
        <button id="createWorkspace" class="button primary full" type="button" style="margin-top:14px">Criar nossa rotina</button>
        <button id="joinWorkspace" class="button full" type="button" style="margin-top:8px">Entrar com código</button>
        <button id="setupLogout" class="button full" type="button" style="margin-top:8px">Sair desta conta</button>
        <div id="setupMessage" class="auth-message"></div>
      </div>`;

    $("createWorkspace").addEventListener("click", createWorkspace);
    $("joinWorkspace").addEventListener("click", joinWorkspace);
    $("setupLogout").addEventListener("click", () => db.auth.signOut());
  }

  function setSetupMessage(message, error) {
    const node = $("setupMessage");
    node.textContent = message;
    node.className = `auth-message${error ? " error" : ""}`;
  }

  async function createWorkspace() {
    const name = $("setupName").value.trim();
    const person = $("setupPerson").value;
    const householdName = $("setupHousehold").value.trim();
    if (!name) return setSetupMessage("Informe seu nome.", true);
    const button = $("createWorkspace");
    button.disabled = true;
    try {
      const { error } = await db.rpc("routine_create_household", {
        p_name: householdName,
        p_person_key: person,
        p_display_name: name
      });
      if (error) throw error;
      await loadWorkspace(true);
      toast("Rotina criada. Compartilhe o código de convite.");
    } catch (error) {
      setSetupMessage(translateError(error), true);
    } finally {
      button.disabled = false;
    }
  }

  async function joinWorkspace() {
    const name = $("setupName").value.trim();
    const person = $("setupPerson").value;
    const invite = $("setupInvite").value.trim().toUpperCase();
    if (!name || invite.length !== 8) return setSetupMessage("Informe seu nome e um código de 8 caracteres.", true);
    const button = $("joinWorkspace");
    button.disabled = true;
    try {
      const { error } = await db.rpc("routine_join_household", {
        p_invite_code: invite,
        p_person_key: person,
        p_display_name: name
      });
      if (error) throw error;
      await loadWorkspace(false);
      toast("Conta conectada à rotina.");
    } catch (error) {
      setSetupMessage(translateError(error), true);
    } finally {
      button.disabled = false;
    }
  }

  async function routeSession(session) {
    ui.session = session;
    if (!session) {
      teardownRealtime();
      ui.membership = null;
      ui.household = null;
      ui.data = null;
      renderAuth();
      return;
    }
    await loadWorkspace(false);
  }

  async function loadWorkspace(createdNow) {
    const { data: member, error: memberError } = await db
      .from("routine_members")
      .select("household_id,user_id,person_key,display_name,role")
      .eq("user_id", ui.session.user.id)
      .maybeSingle();

    if (memberError) {
      toast(translateError(memberError), "error");
      renderSetup();
      return;
    }
    if (!member) {
      renderSetup();
      return;
    }

    ui.membership = member;
    ui.activeTab = member.person_key;

    const [{ data: household, error: householdError }, { data: stateRow, error: stateError }] = await Promise.all([
      db.from("routine_households").select("id,name,invite_code").eq("id", member.household_id).single(),
      db.from("routine_state").select("household_id,schema_version,data,updated_at").eq("household_id", member.household_id).single()
    ]);

    if (householdError || stateError) {
      toast(translateError(householdError || stateError), "error");
      renderSetup();
      return;
    }

    ui.household = household;
    ui.data = normalizeData(stateRow.data);
    $("householdLabel").textContent = household.name;
    subscribeRealtime();
    renderApp();

    if (createdNow || !stateRow.data || Object.keys(stateRow.data).length === 0 || stateRow.schema_version < 3) {
      await saveRemote(true);
    }
  }

  function subscribeRealtime() {
    teardownRealtime();
    ui.channel = db
      .channel(`routine-${ui.household.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "routine_state",
        filter: `household_id=eq.${ui.household.id}`
      }, (payload) => {
        if (!payload.new?.data) return;
        ui.data = normalizeData(payload.new.data);
        syncStatus("", "Sincronizado");
        renderApp(false);
      })
      .subscribe();
  }

  function teardownRealtime() {
    if (ui.channel) db.removeChannel(ui.channel);
    ui.channel = null;
  }

  function queueSave(message = "Alteração salva") {
    clearTimeout(ui.saveTimer);
    syncStatus("saving", "Salvando…");
    ui.saveTimer = setTimeout(async () => {
      const ok = await saveRemote(false);
      if (ok) toast(message);
    }, 450);
  }

  async function saveRemote(silent) {
    if (!ui.household || !ui.data || ui.saving) return false;
    ui.saving = true;
    syncStatus("saving", "Salvando…");
    const { error } = await db
      .from("routine_state")
      .update({ data: ui.data, schema_version: 3 })
      .eq("household_id", ui.household.id);
    ui.saving = false;
    if (error) {
      syncStatus("error", "Erro ao salvar");
      if (!silent) toast(translateError(error), "error");
      return false;
    }
    syncStatus("", "Sincronizado");
    return true;
  }

  function renderNavigation() {
    const tabs = [["jonathan", "Jonathan"], ["isabella", "Isabella"], ["schedule", "Nosso cronograma"]];
    $("mainNav").innerHTML = tabs.map(([id, label]) => `
      <button class="nav-button ${ui.activeTab === id ? "active" : ""}" data-tab="${id}" type="button">${label}</button>
    `).join("");
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => { ui.activeTab = button.dataset.tab; renderApp(false); });
    });
  }

  function renderApp(scrollTop = true) {
    showOnly("appView");
    renderNavigation();
    $("appView").innerHTML = ui.activeTab === "schedule" ? renderSchedule() : renderPerson(ui.activeTab);
    bindAppEvents();
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function daySelector(person) {
    return `<div class="day-selector">${DAYS.map((day) => `
      <button class="day-button ${ui.selectedDay === day ? `active ${person}` : ""}" data-day="${day}" type="button">
        ${DAY_LABELS[day]}<small>${MODE_LABELS[ui.data.workModes[day]] || "Personalizado"}</small>
      </button>
    `).join("")}</div>`;
  }

  function personWakeTime(person, day) {
    if (person === "isabella") return ui.data.settings.isabella.courseStart;
    const mode = ui.data.workModes[day];
    if (mode === "office") return ui.data.settings.work.officeWake;
    if (mode === "home") return subtractMinutes(ui.data.settings.work.homeStart, 10);
    return ui.data.settings.weekendWake;
  }

  function completedStats(person, day) {
    const list = ui.data.tasks[person][day];
    const completed = list.filter((item) => isCompleted(item.id)).length;
    return { completed, total: list.length, percent: list.length ? Math.round(completed / list.length * 100) : 0 };
  }

  function renderPerson(person) {
    const day = ui.selectedDay;
    const list = ui.data.tasks[person][day];
    const stats = completedStats(person, day);
    const isJonathan = person === "jonathan";
    const wake = personWakeTime(person, day);
    const sleep = sleepHours(ui.data.settings.bedtime, wake);
    const weights = ui.data.settings.weights;
    const currentWeight = isJonathan ? weights.jonathanCurrent : weights.isabellaCurrent;
    const goalWeight = isJonathan ? weights.jonathanGoal : weights.isabellaGoal;
    const mode = ui.data.workModes[day];

    return `
      <p class="eyebrow ${person}">Rotina de ${isJonathan ? "Jonathan" : "Isabella"}</p>
      <h1 class="page-title">${day.charAt(0).toUpperCase() + day.slice(1)}</h1>
      <p class="page-subtitle">${isJonathan ? "Trabalho, deslocamento, estudos, alimentação, treino e sono." : "Capacitação, vagas, alimentação, treino e rotina pessoal."}</p>
      ${daySelector(person)}

      <section class="grid metrics-grid">
        ${metricCard("Progresso", `${stats.percent}%`, `${stats.completed} de ${stats.total} blocos`, false)}
        ${metricCard("Peso atual", `${currentWeight} kg`, `Meta: ${goalWeight} kg`, false)}
        ${metricCard(isJonathan ? "Modo do dia" : "Primeiro bloco", isJonathan ? MODE_LABELS[mode] : list[0]?.time || "Livre", isJonathan ? "Pode ser alterado" : list[0]?.title || "Sem tarefas", false)}
        ${metricCard("Sono disponível", `${sleep.toFixed(1)}h`, `${ui.data.settings.bedtime} até ${wake}`, sleep < 7)}
      </section>

      <section class="grid content-grid">
        <article class="card">
          <div class="card-header">
            <div><h2>Meu dia</h2><p>Marque, edite, exclua ou adicione qualquer bloco.</p></div>
            <button class="button ${person} small" data-add-task="${person}" type="button">+ Adicionar</button>
          </div>
          <div class="progress ${person}"><span style="width:${stats.percent}%"></span></div>
          <div class="timeline" style="margin-top:14px">
            ${list.length ? list.map((item) => taskRow(person, day, item)).join("") : `<div class="empty-state">Nenhuma tarefa para este dia.</div>`}
          </div>
        </article>

        <aside class="card">
          ${isJonathan ? renderWorkModeCard(day, mode) : renderIsabellaSummary(day)}
        </aside>
      </section>`;
  }

  function metricCard(label, value, note, alert) {
    return `<article class="card metric-card ${alert ? "alert" : ""}">
      <div class="metric-label">${esc(label)}</div>
      <div class="metric-value">${esc(value)}</div>
      <div class="metric-note">${esc(note)}</div>
    </article>`;
  }

  function taskRow(person, day, item) {
    const done = isCompleted(item.id);
    return `<article class="task-item">
      <div class="task-time ${person}">${esc(item.time)}</div>
      <button class="task-check ${done ? "done" : ""}" data-toggle-task="${item.id}" type="button">${done ? "✓" : ""}</button>
      <div>
        <div class="task-title ${done ? "done" : ""}">${esc(item.title)}</div>
        <div class="task-meta">${esc(item.notes || item.category)}</div>
      </div>
      <div class="task-actions">
        <button class="task-action" data-move-task="${person}|${day}|${item.id}|up" type="button" aria-label="Mover para cima">↑</button>
        <button class="task-action" data-move-task="${person}|${day}|${item.id}|down" type="button" aria-label="Mover para baixo">↓</button>
        <button class="task-action" data-edit-task="${person}|${day}|${item.id}" type="button" aria-label="Editar">✎</button>
      </div>
    </article>`;
  }

  function renderWorkModeCard(day, mode) {
    return `
      <div class="card-header"><div><h2>Modo de trabalho</h2><p>O modelo altera a estrutura completa do dia.</p></div></div>
      <div class="mode-grid">
        ${[["home", "⌂ Home"], ["office", "▦ Presencial"], ["off", "☼ Folga"], ["custom", "✦ Personalizado"]].map(([id, label]) => `
          <button class="mode-button ${mode === id ? "active" : ""}" data-work-mode="${id}" type="button">${label}</button>
        `).join("")}
      </div>
      <div class="mode-description">${esc(MODE_DESCRIPTIONS[mode])}</div>
      <button class="button primary full" data-apply-mode="${day}|${mode}" type="button" ${mode === "custom" ? "disabled" : ""}>Aplicar modelo ao dia</button>
      <div style="margin-top:14px">
        ${kv("Acordar", personWakeTime("jonathan", day))}
        ${kv("Dormir", ui.data.settings.bedtime)}
        ${kv("Inglês", ui.data.settings.english.days.includes(day) ? `${ui.data.settings.english.start}–${ui.data.settings.english.end}` : "Não")}
        ${kv("Treino", ui.data.settings.gym.days[day] ? workoutLabel(ui.data.settings.gym.days[day]) : "Descanso")}
      </div>
      <div class="notice">Ao aplicar um modelo, as tarefas de Jonathan deste dia serão substituídas. Isabella permanece separada.</div>`;
  }

  function renderIsabellaSummary(day) {
    const settings = ui.data.settings;
    return `
      <div class="card-header"><div><h2>Foco do dia</h2><p>Blocos produtivos com horário para terminar.</p></div></div>
      ${kv("Capacitação", settings.isabella.courseStart)}
      ${kv("Candidaturas", settings.isabella.applicationsStart)}
      ${kv("Networking", settings.isabella.networkingStart)}
      ${kv("Portfólio", settings.isabella.portfolioStart)}
      ${kv("Inglês", settings.english.days.includes(day) ? `${settings.english.start}–${settings.english.end}` : "Não")}
      ${kv("Treino", settings.gym.days[day] ? workoutLabel(settings.gym.days[day]) : "Descanso")}
      <button class="button isabella full" data-rebuild-isabella="${day}" type="button" style="margin-top:14px">Reaplicar modelo da Isabella</button>
      <div class="notice">A busca de emprego não deve ocupar o dia inteiro. Os blocos podem ser editados individualmente.</div>`;
  }

  function kv(label, value) {
    return `<div class="kv"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function renderSchedule() {
    return `
      <p class="eyebrow shared">Nosso cronograma</p>
      <h1 class="page-title">A semana lado a lado</h1>
      <p class="page-subtitle">As rotinas continuam separadas. Atividades compartilhadas aparecem no horário de cada pessoa.</p>
      <div class="week-grid" style="margin-top:20px">
        ${DAYS.map((day) => `
          <article class="week-day ${day === currentDay() ? "today" : ""}">
            <div class="week-day-header">
              <h3>${esc(day)}</h3>
              <span class="mode-pill">${esc(MODE_LABELS[ui.data.workModes[day]])}</span>
            </div>
            <div class="lanes">
              ${scheduleLane("jonathan", day)}
              ${scheduleLane("isabella", day)}
            </div>
          </article>`).join("")}
      </div>`;
  }

  function scheduleLane(person, day) {
    return `<section class="lane ${person}">
      <h4>${person === "jonathan" ? "Jonathan" : "Isabella"}</h4>
      ${ui.data.tasks[person][day].map((item) => `
        <div class="mini-task"><strong>${esc(item.time)} · ${esc(item.title)}</strong><small>${esc(item.notes)}</small></div>
      `).join("") || `<div class="mini-task"><small>Sem tarefas.</small></div>`}
    </section>`;
  }

  function bindAppEvents() {
    document.querySelectorAll("[data-day]").forEach((button) => {
      button.addEventListener("click", () => { ui.selectedDay = button.dataset.day; renderApp(false); });
    });
    document.querySelectorAll("[data-toggle-task]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.toggleTask;
        setCompleted(id, !isCompleted(id));
        renderApp(false);
        queueSave("Progresso atualizado");
      });
    });
    document.querySelectorAll("[data-add-task]").forEach((button) => {
      button.addEventListener("click", () => openTaskModal(button.dataset.addTask, ui.selectedDay));
    });
    document.querySelectorAll("[data-edit-task]").forEach((button) => {
      button.addEventListener("click", () => {
        const [person, day, id] = button.dataset.editTask.split("|");
        openTaskModal(person, day, id);
      });
    });
    document.querySelectorAll("[data-move-task]").forEach((button) => {
      button.addEventListener("click", () => {
        const [person, day, id, direction] = button.dataset.moveTask.split("|");
        moveTask(person, day, id, direction);
      });
    });
    document.querySelectorAll("[data-work-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        ui.data.workModes[ui.selectedDay] = button.dataset.workMode;
        renderApp(false);
        queueSave("Modo do dia atualizado");
      });
    });
    document.querySelectorAll("[data-apply-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const [day, mode] = button.dataset.applyMode.split("|");
        if (!confirm(`Substituir as tarefas de Jonathan em ${day} pelo modelo ${MODE_LABELS[mode]}?`)) return;
        ui.data.tasks.jonathan[day] = buildJonathanDay(day, mode, ui.data.settings);
        renderApp(false);
        queueSave("Modelo aplicado");
      });
    });
    document.querySelectorAll("[data-rebuild-isabella]").forEach((button) => {
      button.addEventListener("click", () => {
        const day = button.dataset.rebuildIsabella;
        if (!confirm(`Substituir as tarefas de Isabella em ${day} pelo modelo atualizado?`)) return;
        ui.data.tasks.isabella[day] = buildIsabellaDay(day, ui.data.settings);
        renderApp(false);
        queueSave("Modelo da Isabella aplicado");
      });
    });
  }

  function moveTask(person, day, id, direction) {
    const list = ui.data.tasks[person][day];
    const index = list.findIndex((item) => item.id === id);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return;
    [list[index], list[nextIndex]] = [list[nextIndex], list[index]];
    renderApp(false);
    queueSave("Ordem atualizada");
  }

  function openTaskModal(person, day, taskId = null) {
    const existing = taskId ? ui.data.tasks[person][day].find((item) => item.id === taskId) : null;
    const modalRoot = $("modalRoot");
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal">
          <div class="modal-header">
            <div><h2>${existing ? "Editar tarefa" : "Nova tarefa"}</h2><p>${person === "jonathan" ? "Jonathan" : "Isabella"} · ${day}</p></div>
            <button class="modal-close" data-close-modal type="button">×</button>
          </div>
          <div class="form-grid">
            <label class="field">Horário<input id="taskTime" type="time" value="${esc(existing?.time || "12:00")}" /></label>
            <label class="field">Categoria<select id="taskCategory">
              ${["trabalho","deslocamento","alimentação","estudo","inglês","treino","sono","carreira","planejamento","pessoal","rotina"].map((category) => `<option ${existing?.category === category ? "selected" : ""}>${category}</option>`).join("")}
            </select></label>
            <label class="field full">Título<input id="taskTitle" value="${esc(existing?.title || "")}" placeholder="Ex.: Aula de inglês" /></label>
            <label class="field full">Observações<textarea id="taskNotes" placeholder="Detalhes importantes">${esc(existing?.notes || "")}</textarea></label>
            ${existing ? "" : `<label class="checkbox-field field full"><input id="mirrorTask" type="checkbox" /> Adicionar também para ${person === "jonathan" ? "Isabella" : "Jonathan"}</label>`}
          </div>
          <div class="modal-actions">
            ${existing ? `<button id="deleteTask" class="button danger" type="button">Excluir</button>` : ""}
            <button class="button" data-close-modal type="button">Cancelar</button>
            <button id="saveTask" class="button primary" type="button">Salvar tarefa</button>
          </div>
        </section>
      </div>`;

    bindModalClose();
    $("saveTask").addEventListener("click", () => {
      const title = $("taskTitle").value.trim();
      if (!title) return toast("Informe o título da tarefa.", "error");
      const value = {
        id: existing?.id || uid(),
        time: $("taskTime").value || "12:00",
        title,
        notes: $("taskNotes").value.trim(),
        category: $("taskCategory").value
      };
      if (existing) {
        ui.data.tasks[person][day] = ui.data.tasks[person][day].map((item) => item.id === existing.id ? value : item);
      } else {
        ui.data.tasks[person][day].push(value);
        ui.data.tasks[person][day].sort((a, b) => a.time.localeCompare(b.time));
        if ($("mirrorTask")?.checked) {
          const other = person === "jonathan" ? "isabella" : "jonathan";
          ui.data.tasks[other][day].push({ ...value, id: uid(), notes: value.notes || `Compartilhado com ${person === "jonathan" ? "Jonathan" : "Isabella"}.` });
          ui.data.tasks[other][day].sort((a, b) => a.time.localeCompare(b.time));
        }
      }
      closeModal();
      renderApp(false);
      queueSave(existing ? "Tarefa atualizada" : "Tarefa criada");
    });

    if (existing) {
      $("deleteTask").addEventListener("click", () => {
        if (!confirm("Excluir esta tarefa?")) return;
        ui.data.tasks[person][day] = ui.data.tasks[person][day].filter((item) => item.id !== existing.id);
        delete ui.data.completions[completionKey(existing.id)];
        closeModal();
        renderApp(false);
        queueSave("Tarefa excluída");
      });
    }
  }

  function bindModalClose() {
    document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
    document.querySelector(".modal-backdrop")?.addEventListener("click", (event) => { if (event.target.classList.contains("modal-backdrop")) closeModal(); });
  }

  function closeModal() {
    $("modalRoot").innerHTML = "";
  }

  function openSettings() {
    const settings = ui.data.settings;
    $("modalRoot").innerHTML = `
      <div class="modal-backdrop">
        <section class="modal wide">
          <div class="modal-header">
            <div><h2>Ajustar toda a rotina</h2><p>Os modelos usam estes horários. Tarefas individuais continuam editáveis.</p></div>
            <button class="modal-close" data-close-modal type="button">×</button>
          </div>

          <section class="settings-section">
            <h3>Trabalho de Jonathan</h3>
            <div class="form-grid">
              <label class="field">Início home office<input data-settings-path="work.homeStart" type="time" value="${settings.work.homeStart}" /></label>
              <label class="field">Fim home office<input data-settings-path="work.homeEnd" type="time" value="${settings.work.homeEnd}" /></label>
              <label class="field">Acordar presencial<input data-settings-path="work.officeWake" type="time" value="${settings.work.officeWake}" /></label>
              <label class="field">Sair de casa<input data-settings-path="work.officeLeave" type="time" value="${settings.work.officeLeave}" /></label>
              <label class="field">Chegar à Funcional<input data-settings-path="work.officeArrival" type="time" value="${settings.work.officeArrival}" /></label>
              <label class="field">Início presencial<input data-settings-path="work.officeStart" type="time" value="${settings.work.officeStart}" /></label>
              <label class="field">Fim presencial<input data-settings-path="work.officeEnd" type="time" value="${settings.work.officeEnd}" /></label>
              <label class="field">Chegada em casa<input data-settings-path="work.officeReturn" type="time" value="${settings.work.officeReturn}" /></label>
            </div>
          </section>

          <section class="settings-section">
            <h3>Sono, inglês e academia</h3>
            <div class="form-grid">
              <label class="field">Dormir<input data-settings-path="bedtime" type="time" value="${settings.bedtime}" /></label>
              <label class="field">Acordar fim de semana<input data-settings-path="weekendWake" type="time" value="${settings.weekendWake}" /></label>
              <label class="field">Início inglês<input data-settings-path="english.start" type="time" value="${settings.english.start}" /></label>
              <label class="field">Fim inglês<input data-settings-path="english.end" type="time" value="${settings.english.end}" /></label>
              <label class="field">Início academia<input data-settings-path="gym.start" type="time" value="${settings.gym.start}" /></label>
              <label class="field">Treino curto, minutos<input data-settings-path="gym.shortMinutes" type="number" min="30" value="${settings.gym.shortMinutes}" /></label>
              <label class="field">Treino médio, minutos<input data-settings-path="gym.mediumMinutes" type="number" min="30" value="${settings.gym.mediumMinutes}" /></label>
              <label class="field">Treino longo, minutos<input data-settings-path="gym.longMinutes" type="number" min="30" value="${settings.gym.longMinutes}" /></label>
              <label class="field full">Dias de inglês<select id="englishDays" multiple size="7">
                ${DAYS.map((day) => `<option value="${day}" ${settings.english.days.includes(day) ? "selected" : ""}>${day}</option>`).join("")}
              </select></label>
            </div>
          </section>

          <section class="settings-section">
            <h3>Rotina da Isabella</h3>
            <div class="form-grid">
              <label class="field">Curso<input data-settings-path="isabella.courseStart" type="time" value="${settings.isabella.courseStart}" /></label>
              <label class="field">Candidaturas<input data-settings-path="isabella.applicationsStart" type="time" value="${settings.isabella.applicationsStart}" /></label>
              <label class="field">Networking<input data-settings-path="isabella.networkingStart" type="time" value="${settings.isabella.networkingStart}" /></label>
              <label class="field">Portfólio<input data-settings-path="isabella.portfolioStart" type="time" value="${settings.isabella.portfolioStart}" /></label>
            </div>
          </section>

          <section class="settings-section">
            <h3>Metas de peso</h3>
            <div class="form-grid">
              <label class="field">Jonathan atual<input data-settings-path="weights.jonathanCurrent" type="number" step="0.1" value="${settings.weights.jonathanCurrent}" /></label>
              <label class="field">Jonathan meta<input data-settings-path="weights.jonathanGoal" type="number" step="0.1" value="${settings.weights.jonathanGoal}" /></label>
              <label class="field">Isabella atual<input data-settings-path="weights.isabellaCurrent" type="number" step="0.1" value="${settings.weights.isabellaCurrent}" /></label>
              <label class="field">Isabella meta<input data-settings-path="weights.isabellaGoal" type="number" step="0.1" value="${settings.weights.isabellaGoal}" /></label>
            </div>
          </section>

          <section class="settings-section">
            <h3>Conta compartilhada</h3>
            <div class="invite-box">
              <div class="metric-label">Código para conectar a outra conta</div>
              <div class="invite-code"><strong>${esc(ui.household.invite_code)}</strong><button id="copyInvite" class="button small" type="button">Copiar</button></div>
            </div>
          </section>

          <div class="modal-actions">
            <button id="resetAll" class="button danger" type="button">Restaurar modelos</button>
            <button class="button" data-close-modal type="button">Cancelar</button>
            <button id="saveSettings" class="button primary" type="button">Salvar ajustes</button>
          </div>
        </section>
      </div>`;

    bindModalClose();
    $("copyInvite").addEventListener("click", async () => {
      await navigator.clipboard.writeText(ui.household.invite_code);
      toast("Código copiado");
    });
    $("saveSettings").addEventListener("click", saveSettingsFromModal);
    $("resetAll").addEventListener("click", () => {
      if (!confirm("Restaurar todos os modelos e apagar as personalizações de tarefas?")) return;
      const completions = ui.data.completions;
      ui.data = createDefaultData();
      ui.data.completions = completions;
      closeModal();
      renderApp(false);
      queueSave("Modelos restaurados");
    });
  }

  function setByPath(target, path, value) {
    const keys = path.split(".");
    let pointer = target;
    keys.slice(0, -1).forEach((key) => { pointer = pointer[key]; });
    pointer[keys.at(-1)] = value;
  }

  function saveSettingsFromModal() {
    document.querySelectorAll("[data-settings-path]").forEach((input) => {
      const numeric = input.type === "number";
      setByPath(ui.data.settings, input.dataset.settingsPath, numeric ? Number(input.value) : input.value);
    });
    ui.data.settings.english.days = Array.from($("englishDays").selectedOptions).map((option) => option.value);
    closeModal();
    renderApp(false);
    queueSave("Ajustes salvos");
  }

  $("settingsButton").addEventListener("click", openSettings);
  $("logoutButton").addEventListener("click", async () => { await db.auth.signOut(); });

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      ui.recoveryMode = true;
      ui.session = session;
      renderAuth();
      return;
    }
    if (event === "SIGNED_OUT") {
      await routeSession(null);
    }
  });

  async function init() {
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      await routeSession(data.session);
    } catch (error) {
      $("boot").classList.add("hidden");
      toast(translateError(error), "error");
      renderAuth();
    }
  }

  init();
})();
