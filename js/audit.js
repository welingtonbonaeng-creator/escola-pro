/* ===== AUDIT TRAIL ===== */
const Audit = {
  log(modulo, acao, registroId, antes, depois) {
    if (!Auth.currentUser) return;
    const entry = {
      id: DB._id(),
      funcionarioId: Auth.currentUser.id,
      funcionarioNome: Auth.currentUser.nome,
      modulo, acao, registroId,
      descricao: this._descricao(modulo, acao, depois || antes),
      antes: antes ? JSON.stringify(antes) : null,
      depois: depois ? JSON.stringify(depois) : null,
      createdAt: new Date().toISOString()
    };
    const all = DB.get('audit');
    all.unshift(entry);
    if (all.length > 500) all.splice(500);
    DB.set('audit', all);
  },

  _descricao(modulo, acao, data) {
    const nome = data?.nome || data?.registroId || '';
    const mapa = { visitas:'Visita', cursos:'Curso', alunos:'Aluno', funcionarios:'Funcionário', frequencia:'Frequência', financeiro:'Financeiro' };
    const mod = mapa[modulo] || modulo;
    const atos = { criar:'criado(a)', editar:'editado(a)', excluir:'excluído(a)', converter:'convertido(a) em aluno', bloquear:'bloqueado(a)', desbloquear:'desbloqueado(a)', pagar:'pagamento registrado' };
    return `${mod} ${nome} ${atos[acao] || acao}`.trim();
  },

  renderLog(container, filtro = {}) {
    let entries = DB.get('audit');
    if (filtro.modulo) entries = entries.filter(e => e.modulo === filtro.modulo);
    if (filtro.funcionarioId) entries = entries.filter(e => e.funcionarioId === filtro.funcionarioId);
    if (filtro.registroId) entries = entries.filter(e => e.registroId === filtro.registroId);

    if (!entries.length) {
      container.innerHTML = `<p class="text-gray-500 text-sm text-center py-6">Nenhum registro de auditoria</p>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-2">
        ${entries.slice(0, 50).map(e => `
          <div class="flex items-start gap-3 py-2 border-b border-gray-700/40 last:border-0">
            <div class="w-7 h-7 bg-primary-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span class="text-xs">${this._icon(e.acao)}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-200">${e.descricao}</p>
              <p class="text-xs text-gray-500 mt-0.5">${e.funcionarioNome} · ${Utils.formatDateTime(e.createdAt)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _icon(acao) {
    return { criar:'➕', editar:'✏️', excluir:'🗑️', converter:'🔄', bloquear:'🔒', desbloquear:'🔓', pagar:'💰' }[acao] || '📝';
  }
};
