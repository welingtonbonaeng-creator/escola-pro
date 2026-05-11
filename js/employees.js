/* ===== MÓDULO FUNCIONÁRIOS ===== */
const EmployeesModule = (() => {

  const MODULES = [
    { key:'dashboard',   label:'Dashboard' },
    { key:'visitas',     label:'Visitas' },
    { key:'cursos',      label:'Cursos & Grades' },
    { key:'alunos',      label:'Alunos' },
    { key:'funcionarios',label:'Funcionários' },
    { key:'frequencia',  label:'Frequência' },
    { key:'financeiro',  label:'Financeiro' },
  ];
  const ACTIONS = ['ver','criar','editar','excluir'];

  function render() {
    if (!Auth.can('funcionarios','ver')) { App.denied(); return; }
    const employees = DB.get('employees');
    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold text-white">Funcionários</h3>
            <p class="text-gray-400 text-sm">${employees.length} funcionário(s)</p>
          </div>
          ${Auth.can('funcionarios','criar')?`<button onclick="EmployeesModule.openForm()" class="btn-primary">+ Novo Funcionário</button>`:''}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          ${employees.map(e => {
            const mats = DB.get('students').filter(s => s.matriculas?.some(m => m.funcionarioId === e.id)).length;
            return `
            <div class="card">
              <div class="flex items-start gap-3 mb-3">
                <div class="w-11 h-11 rounded-full ${e.isAdmin?'bg-primary-700':'bg-gray-600'} flex items-center justify-center font-bold text-white flex-shrink-0">
                  ${Utils.initials(e.nome)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h4 class="font-semibold text-white truncate">${e.nome}</h4>
                    ${e.isAdmin?'<span class="badge badge-purple text-xs">Admin</span>':''}
                  </div>
                  <p class="text-xs text-gray-400">${e.cargo||'—'}</p>
                </div>
                <span class="badge ${e.ativo!==false?'badge-green':'badge-gray'}">${e.ativo!==false?'Ativo':'Inativo'}</span>
              </div>
              <div class="text-xs text-gray-500 space-y-1 mb-3">
                <div>📱 ${Utils.formatPhone(e.telefone)}</div>
                <div>✉️ ${e.email||'—'}</div>
                <div>👤 Login: <code class="text-gray-300">${e.username}</code></div>
                <div>🎓 ${mats} matrícula(s) realizadas</div>
              </div>
              <div class="flex gap-2">
                ${Auth.can('funcionarios','editar')?`<button onclick="EmployeesModule.openForm('${e.id}')" class="btn-ghost btn-sm flex-1">✏️ Editar</button>`:''}
                ${Auth.can('funcionarios','editar')&&!e.isAdmin?`<button onclick="EmployeesModule.openPermissions('${e.id}')" class="btn-secondary btn-sm flex-1">🔐 Permissões</button>`:''}
                ${Auth.can('funcionarios','excluir')&&!e.isAdmin?`<button onclick="EmployeesModule.remove('${e.id}')" class="btn-danger btn-sm">🗑️</button>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function openForm(id = null) {
    const e = id ? DB.findById('employees', id) : null;
    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-white">${e?'Editar Funcionário':'Novo Funcionário'}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onsubmit="EmployeesModule.save(event,'${id||''}')" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2"><label class="form-label">Nome Completo *</label><input name="nome" required class="input-field" value="${e?.nome||''}"></div>
            <div><label class="form-label">Cargo / Função</label><input name="cargo" class="input-field" value="${e?.cargo||''}"></div>
            <div><label class="form-label">Documento (CPF)</label><input name="documento" class="input-field" value="${e?.documento||''}"></div>
            <div><label class="form-label">Telefone</label><input name="telefone" class="input-field" value="${e?.telefone||''}"></div>
            <div><label class="form-label">E-mail</label><input type="email" name="email" class="input-field" value="${e?.email||''}"></div>
            <div class="sm:col-span-2"><label class="form-label">Endereço</label><input name="endereco" class="input-field" value="${e?.endereco||''}"></div>
            <div><label class="form-label">Horário de Trabalho</label><input name="horario" class="input-field" value="${e?.horario||''}" placeholder="Ex: Seg–Sex 8h–18h"></div>
          </div>

          <div>
            <p class="section-title">Acesso ao Sistema</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label class="form-label">Usuário (login) *</label><input name="username" required class="input-field" value="${e?.username||''}"></div>
              <div><label class="form-label">Senha ${e?'(deixe em branco para não alterar)':' *'}</label><input type="password" name="password" ${!e?'required':''} class="input-field" placeholder="${e?'Nova senha':'Mínimo 4 caracteres'}"></div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <label class="toggle"><input type="checkbox" name="ativo" value="sim" ${(e?.ativo!==false)?'checked':''}><span class="toggle-slider"></span></label>
            <span class="text-sm text-gray-300">Funcionário ativo</span>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">${e?'Salvar':'Criar Funcionário'}</button>
          </div>
        </form>
      </div>`);
  }

  function save(e, id) {
    e.preventDefault();
    const d = Utils.formData(e.target);
    const old = id ? DB.findById('employees', id) : null;

    // Verificar username duplicado
    const all = DB.get('employees');
    if (all.find(emp => emp.id !== id && emp.username === d.username)) {
      Utils.showToast('Este nome de usuário já está em uso','error'); return;
    }

    const rec = {
      ...old,
      id: id||undefined,
      nome: d.nome, cargo: d.cargo, documento: d.documento,
      telefone: d.telefone, email: d.email, endereco: d.endereco, horario: d.horario,
      username: d.username,
      ativo: d.ativo === 'sim',
      permissoes: old?.permissoes || _defaultPerms(),
      isAdmin: old?.isAdmin || false
    };
    if (d.password) rec.password = btoa(d.password);
    else if (!id) { Utils.showToast('Informe uma senha','error'); return; }

    const saved = DB.save('employees', rec);
    // Atualizar sessão se for o próprio usuário
    if (Auth.currentUser?.id === saved.id) {
      Auth.currentUser = saved;
      sessionStorage.setItem('ep_session', JSON.stringify(saved));
    }
    Audit.log('funcionarios', id?'editar':'criar', saved.id, old, saved);
    Utils.closeModal();
    Utils.showToast(id?'Funcionário atualizado!':'Funcionário criado!','success');
    render();
  }

  function openPermissions(id) {
    const emp = DB.findById('employees', id);
    if (!emp) return;
    const p = emp.permissoes || _defaultPerms();
    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="text-lg font-bold text-white">Permissões — ${emp.nome}</h3>
            <p class="text-xs text-gray-400 mt-0.5">Defina o que este funcionário pode acessar</p>
          </div>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>
        <div class="space-y-3 mb-4">
          <div class="grid grid-cols-5 gap-2 text-xs text-gray-400 font-semibold uppercase text-center mb-2 px-1">
            <div class="text-left">Módulo</div>
            ${ACTIONS.map(a=>`<div>${a}</div>`).join('')}
          </div>
          ${MODULES.map(m => `
            <div class="grid grid-cols-5 gap-2 items-center bg-gray-700/30 rounded-lg px-3 py-2">
              <div class="text-sm text-gray-200">${m.label}</div>
              ${ACTIONS.map(a => {
                const checked = p[m.key]?.[a] === true;
                const disabled = m.key==='dashboard' && a!=='ver';
                return `<div class="flex justify-center">
                  <input type="checkbox" id="perm_${m.key}_${a}" data-mod="${m.key}" data-act="${a}"
                    ${checked?'checked':''} ${disabled?'disabled opacity-30':''} class="perm-cb">
                </div>`;
              }).join('')}
            </div>`).join('')}
        </div>

        <!-- Chat -->
        <div class="border-t border-gray-700/50 pt-4 mb-5">
          <p class="section-title mb-3">Chat com Alunos</p>
          <div class="flex items-center gap-3 bg-gray-700/30 rounded-lg px-3 py-3">
            <label class="toggle"><input type="checkbox" id="perm_recebe_chat" ${emp.recebe_chat?'checked':''}><span class="toggle-slider"></span></label>
            <div>
              <p class="text-sm text-gray-200 font-medium">💬 Receber mensagens dos alunos</p>
              <p class="text-xs text-gray-400 mt-0.5">Alunos poderão selecionar este funcionário no chat do portal</p>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
          <button onclick="EmployeesModule.savePermissions('${id}')" class="btn-primary">Salvar Permissões</button>
        </div>
      </div>`);
  }

  function savePermissions(id) {
    const emp = DB.findById('employees', id);
    if (!emp) return;
    const cbs = document.querySelectorAll('.perm-cb');
    const perms = {};
    MODULES.forEach(m => { perms[m.key] = {}; ACTIONS.forEach(a => { perms[m.key][a] = false; }); });
    cbs.forEach(cb => { if (!cb.disabled) perms[cb.dataset.mod][cb.dataset.act] = cb.checked; });
    emp.permissoes = perms;
    const chatCb = document.getElementById('perm_recebe_chat');
    emp.recebe_chat = chatCb?.checked || false;
    DB.save('employees', emp);
    Audit.log('funcionarios','editar',id,null,{permissoes:perms});
    Utils.closeModal();
    Utils.showToast('Permissões salvas!','success');
    render();
  }

  async function remove(id) {
    const e = DB.findById('employees', id);
    if (e?.isAdmin) { Utils.showToast('Não é possível excluir o administrador','error'); return; }
    if (!await Utils.confirm(`Excluir o funcionário "${e?.nome}"?`)) return;
    DB.remove('employees', id);
    Audit.log('funcionarios','excluir',id,e,null);
    Utils.showToast('Funcionário excluído','info');
    render();
  }

  function _defaultPerms() {
    const p = {};
    MODULES.forEach(m => { p[m.key] = { ver:true, criar:false, editar:false, excluir:false }; });
    return p;
  }

  return { render, openForm, save, openPermissions, savePermissions, remove };
})();
