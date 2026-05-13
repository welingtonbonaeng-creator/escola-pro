/* ===== MÓDULO CURSOS ===== */
const CoursesModule = (() => {

  function render() {
    if (!Auth.can('cursos','ver')) { App.denied(); return; }
    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 class="text-xl font-bold text-white">Cursos</h3>
          ${Auth.can('cursos','criar') ? `<button onclick="CoursesModule.openCursoForm()" class="btn-primary">+ Novo Curso</button>` : ''}
        </div>
        ${renderCursos()}
      </div>`;
  }

  /* ── CURSOS ── */
  function renderCursos() {
    const cursos = DB.get('courses');
    if (!cursos.length) return Utils.emptyState('Nenhum curso cadastrado');
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${cursos.map(c => {
          const alunos = DB.get('students').filter(s => s.matriculas?.some(m => m.cursoId === c.id || (m.comboCursos||[]).some(cc=>cc.cursoId===c.id))).length;
          return `
          <div class="card">
            <div class="flex items-start justify-between mb-2">
              <h4 class="font-semibold text-white">${c.nome}</h4>
              <span class="badge ${c.ativo ? 'badge-green' : 'badge-gray'}">${c.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <p class="text-2xl font-bold text-primary-400 mb-2">${Utils.currency(c.valor)}</p>
            <p class="text-gray-400 text-sm mb-3 line-clamp-2">${c.descricao || 'Sem descrição'}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">🎓 ${alunos} aluno(s)</span>
              <div class="flex gap-1">
                ${Auth.can('cursos','editar')  ? `<button onclick="CoursesModule.openCursoForm('${c.id}')" class="btn-ghost btn-sm">✏️</button>` : ''}
                ${Auth.can('cursos','excluir') ? `<button onclick="CoursesModule.removeCurso('${c.id}')" class="btn-danger btn-sm">🗑️</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function openCursoForm(id = null) {
    const c = id ? DB.findById('courses', id) : null;
    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-white">${c ? 'Editar Curso' : 'Novo Curso'}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onsubmit="CoursesModule.saveCurso(event,'${id||''}')" class="space-y-4">
          <div>
            <label class="form-label">Nome do Curso *</label>
            <input name="nome" required class="input-field" value="${c?.nome||''}" placeholder="Ex: Informática Básica">
          </div>
          <div>
            <label class="form-label">Valor (R$) *</label>
            <input type="text" inputmode="decimal" name="valor" required class="input-field" placeholder="Ex: 450,00" value="${c?.valor||''}">
          </div>
          <div>
            <label class="form-label">Descrição / Resumo</label>
            <textarea name="descricao" rows="3" class="input-field resize-none" placeholder="Descreva o conteúdo do curso…">${c?.descricao||''}</textarea>
          </div>
          <div class="flex items-center gap-3">
            <label class="toggle">
              <input type="checkbox" name="ativo" value="sim" ${c?.ativo !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span class="text-sm text-gray-300">Curso ativo</span>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">${c ? 'Salvar' : 'Criar Curso'}</button>
          </div>
        </form>
      </div>`);
  }

  function saveCurso(e, id) {
    e.preventDefault();
    const d = Utils.formData(e.target);
    const cursos = DB.get('courses');
    const similar = cursos.find(c => c.id !== id && Utils.isSimilar(c.nome, d.nome));
    if (similar) { Utils.showToast(`Já existe um curso similar: "${similar.nome}"`, 'error', 5000); return; }
    const old = id ? DB.findById('courses', id) : null;
    const rec = { id: id || undefined, nome: d.nome, valor: Utils.parseBRL(d.valor), descricao: d.descricao, ativo: d.ativo === 'sim' };
    const saved = DB.save('courses', rec);
    Audit.log('cursos', id ? 'editar' : 'criar', saved.id, old, saved);
    Utils.closeModal();
    Utils.showToast(id ? 'Curso atualizado!' : 'Curso criado!', 'success');
    render();
  }

  async function removeCurso(id) {
    const c = DB.findById('courses', id);
    const usados = DB.get('students').some(s => s.matriculas?.some(m => m.cursoId === id || (m.comboCursos||[]).some(cc=>cc.cursoId===id)));
    if (usados) { Utils.showToast('Não é possível excluir um curso com alunos matriculados', 'error'); return; }
    if (!await Utils.confirm(`Excluir o curso "${c?.nome}"?`)) return;
    DB.remove('courses', id);
    Audit.log('cursos', 'excluir', id, c, null);
    Utils.showToast('Curso excluído', 'info');
    render();
  }

  return { render, openCursoForm, saveCurso, removeCurso };
})();
