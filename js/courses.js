/* ===== MÓDULO CURSOS & GRADES ===== */
const CoursesModule = (() => {

  let activeTab = 'cursos';

  function render() {
    if (!Auth.can('cursos','ver')) { App.denied(); return; }
    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 class="text-xl font-bold text-white">Cursos &amp; Grades</h3>
          <div class="flex gap-2">
            ${activeTab==='cursos' && Auth.can('cursos','criar')?`<button onclick="CoursesModule.openCursoForm()" class="btn-primary">+ Novo Curso</button>`:''}
            ${activeTab==='grades' && Auth.can('cursos','criar')?`<button onclick="CoursesModule.openGradeForm()" class="btn-primary">+ Nova Turma</button>`:''}
          </div>
        </div>
        <div class="tab-bar">
          <button class="tab-btn ${activeTab==='cursos'?'active':''}" onclick="CoursesModule.setTab('cursos')">📚 Cursos</button>
          <button class="tab-btn ${activeTab==='grades'?'active':''}" onclick="CoursesModule.setTab('grades')">📅 Turmas & Horários</button>
        </div>
        <div id="coursesTabContent">
          ${activeTab==='cursos'?renderCursos():renderGrades()}
        </div>
      </div>`;
  }

  function setTab(t) { activeTab = t; render(); }

  /* ── CURSOS ── */
  function renderCursos() {
    const cursos = DB.get('courses');
    if (!cursos.length) return Utils.emptyState('Nenhum curso cadastrado');
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${cursos.map(c => {
          const alunos = DB.get('students').filter(s => s.matriculas?.some(m => m.cursoId === c.id)).length;
          return `
          <div class="card">
            <div class="flex items-start justify-between mb-2">
              <h4 class="font-semibold text-white">${c.nome}</h4>
              <span class="badge ${c.ativo?'badge-green':'badge-gray'}">${c.ativo?'Ativo':'Inativo'}</span>
            </div>
            <p class="text-2xl font-bold text-primary-400 mb-2">${Utils.currency(c.valor)}</p>
            <p class="text-gray-400 text-sm mb-3 line-clamp-2">${c.descricao||'Sem descrição'}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">🎓 ${alunos} aluno(s)</span>
              <div class="flex gap-1">
                ${Auth.can('cursos','editar')?`<button onclick="CoursesModule.openCursoForm('${c.id}')" class="btn-ghost btn-sm">✏️</button>`:''}
                ${Auth.can('cursos','excluir')?`<button onclick="CoursesModule.removeCurso('${c.id}')" class="btn-danger btn-sm">🗑️</button>`:''}
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
          <h3 class="text-lg font-bold text-white">${c?'Editar Curso':'Novo Curso'}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onsubmit="CoursesModule.saveCurso(event,'${id||''}')" class="space-y-4">
          <div>
            <label class="form-label">Nome do Curso *</label>
            <input name="nome" required class="input-field" value="${c?.nome||''}" placeholder="Ex: Informática Básica">
          </div>
          <div>
            <label class="form-label">Valor (R$) *</label>
            <input type="number" name="valor" required min="0" step="0.01" class="input-field" value="${c?.valor||''}">
          </div>
          <div>
            <label class="form-label">Descrição / Resumo</label>
            <textarea name="descricao" rows="3" class="input-field resize-none" placeholder="Descreva o conteúdo do curso…">${c?.descricao||''}</textarea>
          </div>
          <div class="flex items-center gap-3">
            <label class="toggle"><input type="checkbox" name="ativo" value="sim" ${(c?.ativo!==false)?'checked':''}><span class="toggle-slider"></span></label>
            <span class="text-sm text-gray-300">Curso ativo</span>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">${c?'Salvar':'Criar Curso'}</button>
          </div>
        </form>
      </div>`);
  }

  function saveCurso(e, id) {
    e.preventDefault();
    const d = Utils.formData(e.target);
    // Verificar duplicidade
    const cursos = DB.get('courses');
    const similar = cursos.find(c => c.id !== id && Utils.isSimilar(c.nome, d.nome));
    if (similar) {
      Utils.showToast(`Já existe um curso similar: "${similar.nome}"`, 'error', 5000);
      return;
    }
    const old = id ? DB.findById('courses', id) : null;
    const rec = { id:id||undefined, nome:d.nome, valor:parseFloat(d.valor), descricao:d.descricao, ativo:d.ativo==='sim' };
    const saved = DB.save('courses', rec);
    Audit.log('cursos', id?'editar':'criar', saved.id, old, saved);
    Utils.closeModal();
    Utils.showToast(id?'Curso atualizado!':'Curso criado!','success');
    render();
  }

  async function removeCurso(id) {
    const c = DB.findById('courses', id);
    const usados = DB.get('students').some(s => s.matriculas?.some(m => m.cursoId === id));
    if (usados) { Utils.showToast('Não é possível excluir um curso com alunos matriculados','error'); return; }
    if (!await Utils.confirm(`Excluir o curso "${c?.nome}"?`)) return;
    DB.remove('courses', id);
    Audit.log('cursos','excluir',id,c,null);
    Utils.showToast('Curso excluído','info');
    render();
  }

  /* ── GRADES / TURMAS ── */
  function renderGrades() {
    const grades = DB.get('grades');
    if (!grades.length) return Utils.emptyState('Nenhuma turma cadastrada');
    const diasLabel = { seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb',dom:'Dom' };
    return `
      <div class="space-y-3">
        ${grades.map(g => {
          const alunosCount = DB.get('students').filter(s => s.matriculas?.some(m => m.turmaId === g.id)).length;
          const pct = g.vagasMaximas ? Math.round((alunosCount/g.vagasMaximas)*100) : 0;
          return `
          <div class="card">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="font-semibold text-white">${g.nome}</h4>
                  <span class="badge badge-blue text-xs">${g.horarioInicio} – ${g.horarioFim}</span>
                </div>
                <div class="flex flex-wrap gap-1 text-xs text-gray-400">
                  <span>📅 ${(g.diasSemana||[]).map(d=>diasLabel[d]||d).join(', ')}</span>
                  <span>·</span>
                  <span>💻 ${g.computadores} computadores</span>
                  <span>·</span>
                  <span>🎓 ${alunosCount}/${g.vagasMaximas} vagas</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="text-right">
                  <div class="text-xs text-gray-500 mb-1">${pct}% ocupado</div>
                  <div class="progress-bar w-24"><div class="progress-fill bg-primary-500" style="width:${pct}%"></div></div>
                </div>
                ${Auth.can('cursos','editar')?`<button onclick="CoursesModule.openGradeForm('${g.id}')" class="btn-ghost btn-sm">✏️</button>`:''}
                ${Auth.can('cursos','excluir')?`<button onclick="CoursesModule.removeGrade('${g.id}')" class="btn-danger btn-sm">🗑️</button>`:''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function openGradeForm(id = null) {
    const g = id ? DB.findById('grades', id) : null;
    const dias = ['seg','ter','qua','qui','sex','sab'];
    const labDias = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-white">${g?'Editar Turma':'Nova Turma'}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onsubmit="CoursesModule.saveGrade(event,'${id||''}')" class="space-y-4">
          <div>
            <label class="form-label">Nome da Turma *</label>
            <input name="nome" required class="input-field" value="${g?.nome||''}" placeholder="Ex: Turma Manhã">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Horário Início</label>
              <input type="time" name="horarioInicio" class="input-field" value="${g?.horarioInicio||'08:00'}">
            </div>
            <div>
              <label class="form-label">Horário Fim</label>
              <input type="time" name="horarioFim" class="input-field" value="${g?.horarioFim||'09:30'}">
            </div>
          </div>
          <div>
            <label class="form-label">Dias da Semana</label>
            <div class="flex flex-wrap gap-2 mt-1">
              ${dias.map((d,i) => `
                <label class="flex items-center gap-1.5 cursor-pointer bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition-colors">
                  <input type="checkbox" name="dias" value="${d}" ${(g?.diasSemana||[]).includes(d)?'checked':''} class="rounded">
                  ${labDias[i]}
                </label>`).join('')}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Vagas Máximas</label>
              <input type="number" name="vagasMaximas" min="1" class="input-field" value="${g?.vagasMaximas||12}">
            </div>
            <div>
              <label class="form-label">Nº de Computadores</label>
              <input type="number" name="computadores" min="1" class="input-field" value="${g?.computadores||12}">
            </div>
          </div>
          <div>
            <label class="form-label">Tipo</label>
            <select name="tipo" class="input-field">
              <option value="fixo" ${g?.tipo==='fixo'?'selected':''}>Horário Fixo</option>
              <option value="flexivel" ${g?.tipo==='flexivel'?'selected':''}>Horário Flexível</option>
              <option value="extra" ${g?.tipo==='extra'?'selected':''}>Aula Extra</option>
              <option value="reposicao" ${g?.tipo==='reposicao'?'selected':''}>Reposição</option>
              <option value="indisponivel" ${g?.tipo==='indisponivel'?'selected':''}>Indisponível</option>
            </select>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">${g?'Salvar':'Criar Turma'}</button>
          </div>
        </form>
      </div>`);
  }

  function saveGrade(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dias = fd.getAll('dias');
    const d = Utils.formData(e.target);
    const old = id ? DB.findById('grades', id) : null;
    const rec = { id:id||undefined, nome:d.nome, horarioInicio:d.horarioInicio, horarioFim:d.horarioFim, diasSemana:dias, vagasMaximas:parseInt(d.vagasMaximas), computadores:parseInt(d.computadores), tipo:d.tipo };
    const saved = DB.save('grades', rec);
    Audit.log('cursos', id?'editar':'criar', saved.id, old, saved);
    Utils.closeModal();
    Utils.showToast(id?'Turma atualizada!':'Turma criada!','success');
    render();
  }

  async function removeGrade(id) {
    const g = DB.findById('grades', id);
    const usados = DB.get('students').some(s => s.matriculas?.some(m => m.turmaId === id));
    if (usados) { Utils.showToast('Não é possível excluir uma turma com alunos matriculados','error'); return; }
    if (!await Utils.confirm(`Excluir a turma "${g?.nome}"?`)) return;
    DB.remove('grades', id);
    Audit.log('cursos','excluir',id,g,null);
    Utils.showToast('Turma excluída','info');
    render();
  }

  return { render, setTab, openCursoForm, saveCurso, removeCurso, openGradeForm, saveGrade, removeGrade };
})();
