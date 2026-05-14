/* ===== AUTH ===== */
const Auth = {
  currentUser: null,
  currentStudent: null,

  init() {
    const s = sessionStorage.getItem('ep_session');
    if (s) try { this.currentUser = JSON.parse(s); } catch {}
    const st = sessionStorage.getItem('ep_student_session');
    if (st) try { this.currentStudent = JSON.parse(st); } catch {}
  },

  login(username, password) {
    const employees = DB.get('employees');
    const user = employees.find(e =>
      e.username === username &&
      e.password === btoa(password) &&
      e.ativo !== false
    );
    if (!user) return { ok: false, msg: 'Usuário ou senha inválidos' };

    /* Master sempre entra */
    if (user.id === 'emp_master') {
      this.currentUser = user;
      sessionStorage.setItem('ep_session', JSON.stringify(user));
      return { ok: true, user, isMaster: true };
    }

    /* Verifica se sistema está bloqueado */
    const settings = DB.get('system_settings');
    const locked = settings.find(s => s.key === 'system_locked');
    if (locked?.value === 'true') {
      return { ok: false, msg: '🔒 Sistema bloqueado pelo administrador master. Tente mais tarde.' };
    }

    this.currentUser = user;
    sessionStorage.setItem('ep_session', JSON.stringify(user));
    return { ok: true, user };
  },

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('ep_session');
  },

  studentLogin(username, password) {
    const encoded = btoa(password);
    const authRec = DB.get('student_auth').find(a => a.username === username && a.password === encoded);
    if (!authRec) return { ok: false, msg: 'Usuário ou senha incorretos' };
    const student = DB.findById('students', authRec.alunoId);
    if (!student) return { ok: false, msg: 'Aluno não encontrado no sistema' };
    if (student.status === 'bloqueado') return { ok: false, msg: '🔒 Acesso bloqueado. Regularize suas pendências.' };
    if (student.status === 'inativo') return { ok: false, msg: 'Matrícula inativa. Fale com a secretaria.' };
    this.currentStudent = student;
    sessionStorage.setItem('ep_student_session', JSON.stringify(student));
    /* Dispara boas-vindas no primeiro login */
    if (typeof NotificationSystem !== 'undefined') {
      setTimeout(() => NotificationSystem.checkWelcome(student), 300);
    }
    return { ok: true };
  },

  studentLogout() {
    this.currentStudent = null;
    sessionStorage.removeItem('ep_student_session');
  },

  get loggedStudent() { return !!this.currentStudent; },

  can(module, action = 'ver') {
    if (!this.currentUser) return false;
    if (this.currentUser.id === 'emp_master') return true;
    if (this.currentUser.isAdmin) return true;
    return this.currentUser.permissoes?.[module]?.[action] === true;
  },

  get logged()      { return !!this.currentUser; },
  get isAdmin()     { return this.currentUser?.isAdmin === true; },
  get isMaster()    { return this.currentUser?.id === 'emp_master'; },
  get isEmployee()  { return this.logged && !this.isMaster && !this.isAdmin; },

  /* Lê/grava configuração do sistema (localStorage + Supabase) */
  getSetting(key) {
    const s = DB.get('system_settings');
    return s.find(r => r.key === key)?.value ?? null;
  },

  async setSetting(key, value) {
    const all = DB.get('system_settings');
    const i = all.findIndex(r => r.key === key);
    const rec = { key, value, updated_at: new Date().toISOString() };
    if (i >= 0) all[i] = rec; else all.push(rec);
    DB.set('system_settings', all);

    /* Sincroniza com Supabase */
    if (_sb) {
      await _sb.from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() });
    }
  }
};
