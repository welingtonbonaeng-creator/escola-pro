/* ===== APP CONTROLLER ===== */
const App = {
  currentModule: 'dashboard',
  _sidebarCollapsed: false,

  init() {
    Auth.init();

    /* Restaura sessão de aluno */
    if (Auth.loggedStudent) {
      this._showStudentPortal();
      return;
    }

    /* Login funcionário */
    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const result   = Auth.login(username, password);
      if (result.ok) {
        if (result.isMaster || Auth.isMaster) {
          this._showMaster();
        } else {
          this._showApp();
        }
      } else {
        const el = document.getElementById('loginError');
        el.textContent = result.msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
      }
    });

    /* Login aluno */
    document.getElementById('studentLoginForm').addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('studentUsername').value.trim();
      const password = document.getElementById('studentPassword').value;
      const result   = Auth.studentLogin(username, password);
      if (result.ok) {
        this._showStudentPortal();
      } else {
        const el = document.getElementById('studentLoginError');
        el.textContent = result.msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
      }
    });

    if (Auth.logged) {
      Auth.isMaster ? this._showMaster() : this._showApp();
    }

    setInterval(() => {
      const el = document.getElementById('headerTime');
      if (el) el.textContent = new Date().toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
    }, 1000);
  },

  /* ── Tab de login ── */
  loginTab(tab) {
    const empSection = document.getElementById('employeeLoginSection');
    const stuSection = document.getElementById('studentLoginSection');
    const empBtn = document.getElementById('ltab-employee');
    const stuBtn = document.getElementById('ltab-student');
    if (tab === 'employee') {
      empSection.classList.remove('hidden');
      stuSection.classList.add('hidden');
      empBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all bg-primary-600 text-white';
      stuBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all text-gray-400 hover:text-white';
    } else {
      stuSection.classList.remove('hidden');
      empSection.classList.add('hidden');
      stuBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all bg-primary-600 text-white';
      empBtn.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all text-gray-400 hover:text-white';
    }
  },

  /* ── Portal do Aluno ── */
  _showStudentPortal() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('studentPortalScreen').classList.remove('hidden');
    document.getElementById('studentPortalName').textContent = Auth.currentStudent?.nome || 'Aluno';
    StudentPortal.tab('aulas');
  },

  studentLogout() {
    Auth.studentLogout();
    document.getElementById('studentPortalScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('studentUsername').value = '';
    document.getElementById('studentPassword').value = '';
  },

  /* ── Tela Master ── */
  _showMaster() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');

    /* Ocultar sidebar normal e mostrar tela master */
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('pageTitle').textContent = '🔐 Painel Master';
    document.getElementById('userName').textContent = 'Master';
    document.getElementById('userRole').textContent = 'Controle Total';
    document.getElementById('userInitial').textContent = 'M';

    this._renderMaster();
  },

  _renderMaster() {
    const locked = Auth.getSetting('system_locked') === 'true';
    document.getElementById('mainContent').innerHTML = `
      <div class="min-h-screen flex items-center justify-center">
        <div class="w-full max-w-md space-y-6">

          <!-- Card principal -->
          <div class="card text-center p-8">
            <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4
              ${locked ? 'bg-red-900/50 border-2 border-red-600' : 'bg-green-900/50 border-2 border-green-600'}">
              <span class="text-4xl">${locked ? '🔒' : '🔓'}</span>
            </div>

            <h2 class="text-2xl font-bold text-white mb-1">Painel Master</h2>
            <p class="text-gray-400 text-sm mb-6">Controle de acesso global ao sistema</p>

            <!-- Status atual -->
            <div class="mb-6 py-3 px-4 rounded-xl ${locked ? 'bg-red-900/30 border border-red-700/50' : 'bg-green-900/30 border border-green-700/50'}">
              <p class="font-semibold ${locked ? 'text-red-300' : 'text-green-300'}">
                ${locked ? '🔒 SISTEMA BLOQUEADO' : '✅ SISTEMA LIBERADO'}
              </p>
              <p class="text-xs ${locked ? 'text-red-400' : 'text-green-400'} mt-1">
                ${locked
                  ? 'Nenhum funcionário consegue fazer login agora'
                  : 'Todos os acessos funcionando normalmente'}
              </p>
            </div>

            <!-- Toggle -->
            <button onclick="App.toggleSystemLock(${locked})"
              class="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300
                ${locked
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-red-700 hover:bg-red-600 text-white'}">
              ${locked ? '🔓 Liberar Todos os Acessos' : '🔒 Bloquear Todos os Acessos'}
            </button>

            <p class="text-gray-500 text-xs mt-4">
              Esta ação afeta todos os funcionários imediatamente
            </p>
          </div>

          <!-- Info -->
          <div class="card p-5">
            <p class="section-title">Funcionários no sistema</p>
            <div class="space-y-2" id="masterEmpList">
              ${this._renderEmpList()}
            </div>
          </div>

          <!-- Sair -->
          <button onclick="App.logout()" class="w-full btn-secondary py-3">
            🚪 Sair do Painel Master
          </button>
        </div>
      </div>`;
  },

  _renderEmpList() {
    const employees = DB.get('employees').filter(e => e.id !== 'emp_master');
    if (!employees.length) return '<p class="text-gray-500 text-sm">Nenhum funcionário</p>';
    return employees.map(e => `
      <div class="flex items-center justify-between py-2">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold">
            ${Utils.initials(e.nome)}
          </div>
          <div>
            <p class="text-sm text-white">${e.nome}</p>
            <p class="text-xs text-gray-500">${e.cargo || '—'} · ${e.username}</p>
          </div>
        </div>
        <span class="badge ${e.ativo !== false ? 'badge-green' : 'badge-gray'}">
          ${e.ativo !== false ? 'Ativo' : 'Inativo'}
        </span>
      </div>`).join('');
  },

  async toggleSystemLock(currentlyLocked) {
    const newValue = currentlyLocked ? 'false' : 'true';
    const msg = currentlyLocked
      ? 'Liberar o acesso de todos os funcionários?'
      : 'Bloquear o acesso de TODOS os funcionários agora?';

    if (!await Utils.confirm(msg)) return;

    await Auth.setSetting('system_locked', newValue);
    Utils.showToast(
      newValue === 'true' ? '🔒 Sistema bloqueado!' : '🔓 Acessos liberados!',
      newValue === 'true' ? 'error' : 'success'
    );
    this._renderMaster();
  },

  /* ── App normal ── */
  async _showApp() {
    if (typeof STORAGE_MODE !== 'undefined' && STORAGE_MODE === 'supabase') {
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appScreen').classList.remove('hidden');
      document.getElementById('mainContent').innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 gap-3">
          <div class="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-gray-400 text-sm">Sincronizando com Supabase…</p>
        </div>`;
      await DB.loadFromSupabase();
    }

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('sidebar').style.display = '';
    document.getElementById('userName').textContent = Auth.currentUser?.nome || 'Usuário';
    document.getElementById('userRole').textContent = Auth.currentUser?.cargo || (Auth.currentUser?.isAdmin ? 'Administrador' : 'Funcionário');
    document.getElementById('userInitial').textContent = Utils.initials(Auth.currentUser?.nome || '?');

    document.querySelectorAll('.nav-item').forEach(item => {
      const mod = item.dataset.module;
      if (mod === 'chat') return;
      if (mod === 'myperformance') { item.style.display = Auth.isEmployee ? '' : 'none'; return; }
      if (mod === 'staffchat')     { item.style.display = Auth.isEmployee ? '' : 'none'; return; }
      item.style.display = (mod && !Auth.can(this._permKey(mod),'ver')) ? 'none' : '';
    });

    const mods = ['dashboard','visits','courses','students','employees','attendance','financial'];
    const first = mods.find(m => Auth.can(this._permKey(m),'ver')) || 'dashboard';
    this.navigate(first);
  },

  /* Mapeia nome do módulo (nav/inglês) para chave de permissão (português) */
  _permKey(mod) {
    const map = {
      visits:'visitas', courses:'cursos', students:'alunos',
      employees:'funcionarios', attendance:'frequencia', financial:'financeiro',
      schedule:'alunos', performance:'financeiro'
    };
    return map[mod] || mod;
  },

  navigate(module) {
    if (module === 'myperformance' || module === 'staffchat') {
      /* staffchat: funcionários acessam direto; admins acessam via botão no chat */
      if (module === 'staffchat' && Auth.isEmployee && !Auth.logged) { this.denied(); return; }
      if (module === 'myperformance' && !Auth.isEmployee) { this.denied(); return; }
    } else {
      const _checkMod = this._permKey(module);
      if (!Auth.can(_checkMod,'ver')) { this.denied(); return; }
    }
    this.currentModule = module;
    this.closeSidebar();

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.module === module);
    });

    const titles = { dashboard:'Dashboard', visits:'Visitas', courses:'Cursos', students:'Alunos', employees:'Funcionários', schedule:'Grade de Horário', attendance:'Frequência', financial:'Financeiro', chat:'Chat com Alunos', performance:'Desempenho', myperformance:'Meu Desempenho', staffchat:'Chat com Equipe' };
    document.getElementById('pageTitle').textContent = titles[module] || module;

    const map = {
      dashboard:     () => DashboardModule.render(),
      visits:        () => VisitsModule.render(),
      courses:       () => CoursesModule.render(),
      students:      () => StudentsModule.render(),
      employees:     () => EmployeesModule.render(),
      schedule:      () => ScheduleModule.render(),
      attendance:    () => AttendanceModule.render(),
      financial:     () => FinancialModule.render(),
      chat:          () => ChatModule.render(),
      performance:   () => PerformanceModule.render(),
      myperformance: () => MyPerformanceModule.render(),
      staffchat:     () => StaffChatModule.render(),
    };
    if (map[module]) map[module]();
  },

  denied() {
    document.getElementById('mainContent').innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 text-center">
        <div class="text-5xl mb-4">🔒</div>
        <h3 class="text-lg font-semibold text-white mb-2">Acesso Negado</h3>
        <p class="text-gray-400 text-sm">Você não tem permissão para acessar este módulo.</p>
      </div>`;
  },

  logout() {
    Auth.logout();
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('sidebar').style.display = '';
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
  },

  toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    const isOpen = !sb.classList.contains('-translate-x-full');
    sb.classList.toggle('-translate-x-full', isOpen);
    ov.classList.toggle('hidden', isOpen);
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.add('hidden');
  },

  /* ── Recolher sidebar no desktop ── */
  collapseSidebar() {
    this._sidebarCollapsed = !this._sidebarCollapsed;
    const sb        = document.getElementById('sidebar');
    const main      = document.getElementById('mainWrapper');
    const labels    = document.querySelectorAll('.nav-label');
    const logo      = document.getElementById('sidebarLogo');
    const logoSmall = document.getElementById('sidebarLogoSmall');
    const btn       = document.getElementById('collapseBtn');

    if (this._sidebarCollapsed) {
      sb.style.width = '4rem';
      if (main) main.style.marginLeft = '4rem';
      labels.forEach(l => l.classList.add('hidden'));
      if (logo)      logo.classList.add('hidden');
      if (logoSmall) { logoSmall.classList.remove('hidden'); logoSmall.classList.add('flex'); }
      if (btn)  btn.textContent = '»';
      document.querySelectorAll('.nav-item').forEach(el => { el.style.justifyContent = 'center'; el.style.padding = '10px 0'; });
    } else {
      sb.style.width = '16rem';
      if (main) main.style.marginLeft = '';
      labels.forEach(l => l.classList.remove('hidden'));
      if (logo)      logo.classList.remove('hidden');
      if (logoSmall) { logoSmall.classList.add('hidden'); logoSmall.classList.remove('flex'); }
      if (btn)  btn.textContent = '«';
      document.querySelectorAll('.nav-item').forEach(el => { el.style.justifyContent = ''; el.style.padding = ''; });
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
