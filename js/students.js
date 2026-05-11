/* ===== MÓDULO ALUNOS ===== */
const StudentsModule = (() => {

  let filter = 'todos';

  /* ── Estado temporário do formulário de matrícula ── */
  let _mat = { cursos:[], comboDesc:0, extraDesc:0, entrada:[], nParcelas:1, formaParcela:'pix' };

  const FORMAS = { pix:'Pix', dinheiro:'Dinheiro', cartao_debito:'Cartão Débito', cartao_credito:'Cartão Crédito', boleto:'Boleto' };

  /* Cálculo financeiro */
  function _calc() {
    const totalCursos  = _mat.cursos.reduce((s, c) => s + c.valor, 0);
    const comboDesc    = _mat.cursos.length > 1 ? (_mat.comboDesc || 0) : 0;
    const extraDesc    = _mat.extraDesc || 0;
    const valorFinal   = Math.max(0, totalCursos - comboDesc - extraDesc);
    const totalEntrada = _mat.entrada.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
    const restante     = Math.max(0, valorFinal - totalEntrada);
    const nP           = Math.max(1, parseInt(_mat.nParcelas) || 1);
    const valorParcela = restante > 0 ? restante / nP : 0;
    return { totalCursos, comboDesc, extraDesc, valorFinal, totalEntrada, restante, nP, valorParcela };
  }

  function _brl(v) {
    return 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2});
  }

  /* Atualiza as seções dinâmicas do formulário */
  function _refresh() {
    const c = _calc();

    /* Lista de cursos */
    const cursosEl = document.getElementById('matCursosList');
    if (cursosEl) {
      cursosEl.innerHTML = !_mat.cursos.length
        ? '<p class="text-gray-500 text-sm italic py-2">Nenhum curso selecionado</p>'
        : _mat.cursos.map((cur, i) => `
          <div class="flex items-center justify-between py-2 border-b border-gray-700/40 last:border-0">
            <span class="text-white text-sm font-medium">${cur.nome}</span>
            <div class="flex items-center gap-3">
              <span class="text-primary-300 font-semibold text-sm">${_brl(cur.valor)}</span>
              <button type="button" onclick="StudentsModule.removeCurso(${i})" class="text-red-400 hover:text-red-300 text-xl leading-none">×</button>
            </div>
          </div>`).join('');
    }

    /* Linha de combo (só com 2+ cursos) */
    const comboRow = document.getElementById('matComboRow');
    if (comboRow) comboRow.classList.toggle('hidden', _mat.cursos.length < 2);

    /* Resumo financeiro */
    const calcEl = document.getElementById('matCalcBox');
    if (calcEl) {
      const linhas = [];
      if (_mat.cursos.length > 1) linhas.push(`<div class="flex justify-between"><span class="text-gray-400">Subtotal (${_mat.cursos.length} cursos)</span><span class="text-gray-200">${_brl(c.totalCursos)}</span></div>`);
      else if (c.totalCursos) linhas.push(`<div class="flex justify-between"><span class="text-gray-400">Valor do curso</span><span class="text-gray-200">${_brl(c.totalCursos)}</span></div>`);
      if (c.comboDesc > 0) linhas.push(`<div class="flex justify-between"><span class="text-gray-400">Desconto combo</span><span class="text-green-400">- ${_brl(c.comboDesc)}</span></div>`);
      if (c.extraDesc > 0) linhas.push(`<div class="flex justify-between"><span class="text-gray-400">Desconto extra</span><span class="text-green-400">- ${_brl(c.extraDesc)}</span></div>`);
      linhas.push(`<div class="flex justify-between border-t border-gray-600 pt-2 font-bold text-base"><span class="text-white">Valor Final</span><span class="text-primary-300">${_brl(c.valorFinal)}</span></div>`);
      if (c.totalEntrada > 0) linhas.push(`<div class="flex justify-between"><span class="text-gray-400">(-) Entrada paga</span><span class="text-yellow-300">- ${_brl(c.totalEntrada)}</span></div>`);
      if (c.restante > 0) linhas.push(`<div class="flex justify-between border-t border-gray-600 pt-2"><span class="text-gray-300">Restante em ${c.nP}x</span><span class="text-white font-bold">${_brl(c.valorParcela)}<span class="text-xs text-gray-400">/mês</span></span></div>`);
      else if (c.valorFinal > 0 && c.totalEntrada >= c.valorFinal) linhas.push(`<div class="text-center text-green-400 text-xs py-1">✅ Valor totalmente coberto pela entrada</div>`);
      calcEl.innerHTML = `<div class="card bg-gray-700/40 space-y-1.5 text-sm mb-4">${linhas.join('')}</div>`;
    }

    /* Lista de entrada */
    const entEl = document.getElementById('matEntradaList');
    if (entEl) {
      entEl.innerHTML = !_mat.entrada.length
        ? '<p class="text-gray-500 text-xs italic pb-1">Sem entrada — valor integral em parcelas</p>'
        : _mat.entrada.map((en, i) => `
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm text-gray-300 w-32 flex-shrink-0">${FORMAS[en.tipo]||en.tipo}</span>
            <div class="relative flex-1">
              <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
              <input type="number" min="0" step="0.01" placeholder="0,00"
                value="${en.valor||''}" class="input-field pl-8 text-sm"
                oninput="StudentsModule.setEntradaValor(${i},this.value)">
            </div>
            <button type="button" onclick="StudentsModule.removeEntrada(${i})" class="text-red-400 hover:text-red-300 text-xl leading-none flex-shrink-0">×</button>
          </div>`).join('');
    }

    /* Bloco parcelas */
    const parcEl = document.getElementById('matParcelasBox');
    if (parcEl) parcEl.classList.toggle('hidden', c.restante <= 0 && c.valorFinal > 0);
  }

  /* ── Ações do formulário ── */
  function addCurso(cursoId) {
    if (!cursoId) return;
    if (_mat.cursos.find(c => c.cursoId === cursoId)) { Utils.showToast('Curso já adicionado','error'); return; }
    const cur = DB.findById('courses', cursoId);
    if (!cur) return;
    _mat.cursos.push({ cursoId: cur.id, nome: cur.nome, valor: cur.valor });
    _refresh();
  }

  function removeCurso(i) {
    _mat.cursos.splice(i, 1);
    if (_mat.cursos.length < 2) _mat.comboDesc = 0;
    _refresh();
  }

  function setComboDesc(v) { _mat.comboDesc = parseFloat(v)||0; _refresh(); }
  function setExtraDesc(v) { _mat.extraDesc = parseFloat(v)||0; _refresh(); }

  function addEntrada(tipo) {
    if (!tipo) return;
    _mat.entrada.push({ tipo, valor: 0 });
    _refresh();
  }

  function removeEntrada(i) { _mat.entrada.splice(i, 1); _refresh(); }
  function setEntradaValor(i, v) { _mat.entrada[i].valor = parseFloat(v)||0; _refresh(); }
  function setNParcelas(v) { _mat.nParcelas = parseInt(v)||1; _refresh(); }
  function setFormaParcela(v) { _mat.formaParcela = v; }

  /* ── RENDER ── */
  function render() {
    if (!Auth.can('alunos','ver')) { App.denied(); return; }
    const all = DB.get('students');
    const counts = {
      todos:all.length,
      ativo:all.filter(s=>s.status==='ativo').length,
      bloqueado:all.filter(s=>s.status==='bloqueado').length,
      inativo:all.filter(s=>s.status==='inativo').length,
      formado:all.filter(s=>s.status==='formado').length
    };
    let students = filter === 'todos' ? all : all.filter(s => s.status === filter);

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold text-white">Alunos</h3>
            <p class="text-gray-400 text-sm">${all.length} aluno(s) no total</p>
          </div>
          ${Auth.can('alunos','criar')?`<button onclick="StudentsModule.openForm()" class="btn-primary">+ Novo Aluno</button>`:''}
        </div>
        <div class="flex flex-wrap gap-2">
          ${[['todos','Todos',counts.todos],['ativo','Ativos',counts.ativo],['bloqueado','Bloqueados',counts.bloqueado],['inativo','Inativos',counts.inativo],['formado','Formados',counts.formado]].map(([v,l,n])=>`
            <button onclick="StudentsModule.setFilter('${v}')" class="tab-btn ${filter===v?'active':''}">${l} <span class="ml-1 text-xs opacity-70">${n}</span></button>`).join('')}
        </div>
        <div class="relative">
          <input type="text" placeholder="Buscar por nome, telefone, CPF…" class="input-field w-full pl-10" oninput="StudentsModule.search(this.value)">
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        <div class="card overflow-x-auto p-0" id="studentsList">${renderList(students)}</div>
      </div>`;
  }

  function setFilter(f) { filter = f; render(); }

  function renderList(students) {
    if (!students.length) return Utils.emptyState('Nenhum aluno nesta categoria');
    return `
      <table class="w-full">
        <thead><tr class="table-header">
          <th>Aluno</th><th class="hidden sm:table-cell">Curso(s)</th>
          <th class="hidden md:table-cell">Turma</th><th>Status</th><th class="text-right pr-4">Ações</th>
        </tr></thead>
        <tbody>
          ${students.map(s => {
            const mat     = s.matriculas?.[0];
            const cursos  = mat?.comboCursos?.length ? mat.comboCursos : (mat?.cursoId ? [DB.findById('courses',mat.cursoId)].filter(Boolean) : []);
            const turma   = mat ? DB.findById('grades', mat.turmaId) : null;
            const fin     = DB.findBy('financial','alunoId',s.id);
            const inadimplente = fin.some(p => p.status === 'atrasado');
            const nomeCursos = cursos.map(c=>c.nome||c).join(', ') || '—';
            return `
            <tr class="table-row ${inadimplente&&s.status!=='formado'?'bg-red-900/10':''}">
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-200">${Utils.initials(s.nome)}</div>
                  <div>
                    <div class="font-medium text-white text-sm">${s.nome}</div>
                    <div class="text-xs text-gray-400">${Utils.formatPhone(s.telefone)}</div>
                  </div>
                </div>
              </td>
              <td class="hidden sm:table-cell text-sm text-gray-300">${nomeCursos}</td>
              <td class="hidden md:table-cell text-sm text-gray-400">${turma?.nome||'—'}</td>
              <td>
                ${Utils.statusBadge(s.status)}
                ${inadimplente&&s.status!=='formado'?'<span class="badge badge-red ml-1 text-xs">⚠️ Inadimplente</span>':''}
              </td>
              <td class="text-right pr-3">
                <div class="flex items-center justify-end gap-1">
                  <button onclick="StudentsModule.openDetail('${s.id}')" class="btn-ghost btn-sm">👁️</button>
                  ${Auth.can('alunos','editar')?`<button onclick="StudentsModule.openForm('${s.id}')" class="btn-ghost btn-sm">✏️</button>`:''}
                  ${Auth.can('alunos','excluir')?`<button onclick="StudentsModule.remove('${s.id}')" class="btn-danger btn-sm">🗑️</button>`:''}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  /* ── DETALHE DO ALUNO ── */
  function openDetail(id) {
    const s = DB.findById('students', id);
    if (!s) return;
    const mat     = s.matriculas?.[0];
    const cursos  = mat?.comboCursos?.length ? mat.comboCursos : (mat?.cursoId ? [DB.findById('courses',mat.cursoId)].filter(Boolean).map(c=>({nome:c.nome,valor:c.valor})) : []);
    const turma   = mat ? DB.findById('grades', mat.turmaId) : null;
    const parcelas = DB.findBy('financial','alunoId',id);
    const func    = mat ? DB.findById('employees', mat.funcionarioId) : null;
    const freq    = DB.findBy('attendance','alunoId',id);
    const presencas = freq.filter(f=>f.presente).length;
    const faltas    = freq.filter(f=>!f.presente).length;
    const entradas  = parcelas.filter(p=>p.tipo==='entrada');
    const mensais   = parcelas.filter(p=>p.tipo!=='entrada');

    Utils.showModal(`
      <div class="p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">${s.nome}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>

        <div class="card card-sm flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-primary-800 flex items-center justify-center text-lg font-bold text-primary-200 flex-shrink-0">${Utils.initials(s.nome)}</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-white">${s.nome}</div>
            <div class="text-sm text-gray-400">${Utils.formatPhone(s.telefone)} · ${s.email||'—'}</div>
            <div class="text-sm text-gray-400">${Utils.formatDate(s.dataNascimento)} (${Utils.calcAge(s.dataNascimento)} anos)</div>
          </div>
          <div class="flex-shrink-0">${Utils.statusBadge(s.status)}</div>
        </div>

        ${mat ? `
        <!-- Matrícula / Cursos -->
        <div>
          <p class="section-title">Matrícula</p>
          <div class="card card-sm space-y-2 text-sm">
            ${cursos.length > 1 ? `
            <div class="pb-2 border-b border-gray-700/40">
              <p class="text-gray-400 text-xs mb-1">Cursos (Combo)</p>
              ${cursos.map(c=>`
              <div class="flex justify-between py-1">
                <span class="text-white">${c.nome}</span>
                <span class="text-gray-300">${Utils.currency(c.valor)}</span>
              </div>`).join('')}
              <div class="flex justify-between pt-1 font-semibold border-t border-gray-700/40 mt-1">
                <span class="text-gray-300">Subtotal</span>
                <span class="text-white">${Utils.currency(cursos.reduce((s,c)=>s+c.valor,0))}</span>
              </div>
            </div>` : `
            <div class="stat-row"><span class="text-gray-400">Curso</span><span class="text-white font-medium">${cursos[0]?.nome||'—'}</span></div>`}
            <div class="stat-row"><span class="text-gray-400">Turma</span><span class="text-white">${turma?.nome||'—'} ${turma?`(${turma.horarioInicio}–${turma.horarioFim})`:''}</span></div>
            <div class="stat-row"><span class="text-gray-400">Início</span><span class="text-white">${Utils.formatDate(mat.dataInicio)}</span></div>
            <div class="stat-row"><span class="text-gray-400">Atendente</span><span class="text-white">${func?.nome||'—'}</span></div>
            ${mat.comboDesc>0?`<div class="stat-row"><span class="text-gray-400">Desc. combo</span><span class="text-green-400">- ${Utils.currency(mat.comboDesc)}</span></div>`:''}
            ${mat.desconto>0?`<div class="stat-row"><span class="text-gray-400">Desc. extra</span><span class="text-green-400">- ${Utils.currency(mat.desconto)}</span></div>`:''}
            <div class="stat-row"><span class="text-gray-400">Valor Final</span><span class="text-primary-300 font-bold text-base">${Utils.currency(mat.valorFinal||mat.valorTotal)}</span></div>
            ${mat.totalEntrada>0?`<div class="stat-row"><span class="text-gray-400">Entrada paga</span><span class="text-yellow-300">${Utils.currency(mat.totalEntrada)}</span></div>`:''}
            ${mat.totalParcelas>0&&(mat.valorFinal||mat.valorTotal)>mat.totalEntrada?`<div class="stat-row"><span class="text-gray-400">Parcelas</span><span class="text-white">${mat.totalParcelas}x de ${Utils.currency(mat.valorParcela)}</span></div>`:''}
          </div>
        </div>` : '<p class="text-gray-500 text-sm">Sem matrícula ativa</p>'}

        <!-- Frequência -->
        <div>
          <p class="section-title">Frequência</p>
          <div class="grid grid-cols-3 gap-3">
            <div class="card card-sm text-center"><div class="text-2xl font-bold text-green-400">${presencas}</div><div class="text-xs text-gray-400">Presenças</div></div>
            <div class="card card-sm text-center"><div class="text-2xl font-bold text-red-400">${faltas}</div><div class="text-xs text-gray-400">Faltas</div></div>
            <div class="card card-sm text-center"><div class="text-2xl font-bold text-white">${freq.length?Math.round((presencas/freq.length)*100):0}%</div><div class="text-xs text-gray-400">Frequência</div></div>
          </div>
        </div>

        <!-- Financeiro -->
        <div>
          <p class="section-title">Parcelas</p>
          ${entradas.length ? `
          <p class="text-xs text-yellow-400 mb-2">💵 Entrada paga no ato:</p>
          ${entradas.map(p=>`
          <div class="flex items-center justify-between py-1.5 border-b border-gray-700/30 text-sm">
            <span class="text-gray-400">${p.obs||'Entrada'}</span>
            <div class="flex items-center gap-2"><span class="text-yellow-300 font-medium">${Utils.currency(p.valor)}</span>${Utils.statusBadge(p.status)}</div>
          </div>`).join('')}
          <div class="mb-3"></div>` : ''}
          ${mensais.length ? `
          <p class="text-xs text-gray-400 mb-2">📅 Parcelas mensais:</p>
          <div class="space-y-1">
            ${mensais.map(p=>`
            <div class="flex items-center justify-between py-1.5 border-b border-gray-700/30 last:border-0 text-sm">
              <div>
                <span class="text-gray-300">Parcela ${p.numero}/${p.total}</span>
                <span class="text-gray-500 ml-2 text-xs">Venc: ${Utils.formatDate(p.vencimento)}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-white">${Utils.currency(p.valor)}</span>
                ${Utils.statusBadge(p.status)}
              </div>
            </div>`).join('')}
          </div>` : ''}
        </div>

        ${s.responsavel?`
        <div>
          <p class="section-title">Responsável Financeiro</p>
          <div class="card card-sm text-sm space-y-1">
            <p class="text-white font-medium">${s.responsavel.nome}</p>
            <p class="text-gray-400">${Utils.formatPhone(s.responsavel.telefone)} · ${s.responsavel.email||'—'}</p>
          </div>
        </div>`:''}

        <div class="flex justify-end gap-3">
          <button onclick="Utils.closeModal()" class="btn-secondary">Fechar</button>
          ${Auth.can('alunos','editar')?`<button onclick="Utils.closeModal();StudentsModule.openForm('${id}')" class="btn-primary">✏️ Editar</button>`:''}
        </div>
      </div>`);
  }

  /* ── FORMULÁRIO DE MATRÍCULA ── */
  function openForm(id = null) {
    const s   = id ? DB.findById('students', id) : null;
    const cursos    = DB.get('courses').filter(c => c.ativo);
    const turmas    = DB.get('grades');
    const employees = DB.get('employees').filter(e => e.ativo !== false);
    const mat = s?.matriculas?.[0];

    /* Inicializa estado */
    _mat = {
      cursos: mat?.comboCursos?.length
        ? mat.comboCursos
        : (mat?.cursoId ? [{ cursoId:mat.cursoId, nome: DB.findById('courses',mat.cursoId)?.nome||'', valor: DB.findById('courses',mat.cursoId)?.valor||0 }] : []),
      comboDesc:    mat?.comboDesc   || 0,
      extraDesc:    mat?.desconto    || 0,
      entrada:      mat?.entrada     || [],
      nParcelas:    mat?.totalParcelas || 1,
      formaParcela: mat?.formasPagamento?.find(f=>f.tipo!=='entrada')?.tipo || 'pix'
    };

    const cursosOpts = cursos.map(c =>
      `<option value="${c.id}">${c.nome} — R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</option>`
    ).join('');

    const turmasOpts = turmas.map(t =>
      `<option value="${t.id}" ${mat?.turmaId===t.id?'selected':''}>${t.nome} (${t.horarioInicio}–${t.horarioFim})</option>`
    ).join('');

    const empOpts = employees.map(e =>
      `<option value="${e.id}" ${mat?.funcionarioId===e.id?'selected':''}>${e.nome}</option>`
    ).join('');

    const parcelasOpts = [1,2,3,4,5,6,8,10,12].map(n =>
      `<option value="${n}" ${_mat.nParcelas===n?'selected':''}>${n}x</option>`
    ).join('');

    Utils.showModal(`<div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-white">${s?'Editar Aluno':'Novo Aluno / Matrícula'}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <form onsubmit="StudentsModule.save(event,'${id||''}')" class="space-y-5">

          <!-- Dados Pessoais -->
          <div>
            <p class="section-title">Dados Pessoais</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="sm:col-span-2"><label class="form-label">Nome Completo *</label><input name="nome" required class="input-field" value="${s?.nome||''}"></div>
              <div><label class="form-label">Data de Nascimento</label><input type="date" name="dataNascimento" class="input-field" value="${s?.dataNascimento||''}"></div>
              <div><label class="form-label">Sexo</label>
                <select name="sexo" class="input-field">
                  <option value="M" ${s?.sexo==='M'?'selected':''}>Masculino</option>
                  <option value="F" ${s?.sexo==='F'?'selected':''}>Feminino</option>
                </select>
              </div>
              <div><label class="form-label">Telefone *</label><input name="telefone" required class="input-field" value="${s?.telefone||''}"></div>
              <div><label class="form-label">E-mail</label><input type="email" name="email" class="input-field" value="${s?.email||''}"></div>
              <div><label class="form-label">Tipo Doc.</label>
                <select name="tipoDoc" class="input-field">
                  <option value="CPF" ${s?.tipoDoc==='CPF'?'selected':''}>CPF</option>
                  <option value="RG"  ${s?.tipoDoc==='RG'?'selected':''}>RG</option>
                </select>
              </div>
              <div><label class="form-label">Documento</label><input name="documento" class="input-field" value="${s?.documento||''}"></div>
              <div><label class="form-label">Status</label>
                <select name="status" class="input-field">
                  <option value="ativo"     ${(!s||s.status==='ativo')?'selected':''}>Ativo</option>
                  <option value="inativo"   ${s?.status==='inativo'?'selected':''}>Inativo</option>
                  <option value="bloqueado" ${s?.status==='bloqueado'?'selected':''}>Bloqueado</option>
                  <option value="formado"   ${s?.status==='formado'?'selected':''}>Formado</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Cursos -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="section-title mb-0">Cursos</p>
              <select onchange="StudentsModule.addCurso(this.value);this.value=''" class="input-field w-auto text-xs py-1.5 pr-8">
                <option value="">+ Adicionar Curso</option>
                ${cursosOpts}
              </select>
            </div>
            <div id="matCursosList" class="min-h-[36px]"></div>

            <!-- Desconto combo (2+ cursos) -->
            <div id="matComboRow" class="hidden mt-3 bg-primary-900/20 border border-primary-700/30 rounded-xl p-3">
              <p class="text-primary-300 text-xs font-semibold mb-2">🎁 Combo de Cursos — Desconto Especial</p>
              <div class="flex items-center gap-3">
                <label class="form-label mb-0 flex-shrink-0">Desconto do combo</label>
                <div class="relative w-40">
                  <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                  <input type="number" min="0" step="0.01" class="input-field pl-8 text-sm"
                    placeholder="0,00" value="${_mat.comboDesc||0}"
                    oninput="StudentsModule.setComboDesc(this.value)">
                </div>
              </div>
            </div>
          </div>

          <!-- Turma & Atendente -->
          <div>
            <p class="section-title">Turma & Atendente</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label class="form-label">Turma</label>
                <select name="turmaId" class="input-field">
                  <option value="">Selecione</option>
                  ${turmasOpts}
                </select>
              </div>
              <div><label class="form-label">Data de Início</label>
                <input type="date" name="dataInicio" class="input-field"
                  value="${mat?.dataInicio?.slice(0,10)||new Date().toISOString().slice(0,10)}">
              </div>
              <div class="sm:col-span-2"><label class="form-label">Atendente (Matrícula)</label>
                <select name="funcionarioId" class="input-field">
                  ${empOpts}
                </select>
              </div>
            </div>
          </div>

          <!-- Financeiro -->
          <div>
            <p class="section-title">Financeiro</p>

            <!-- Desconto extra -->
            <div class="flex items-center gap-3 mb-4">
              <label class="form-label mb-0 flex-shrink-0">Desconto extra</label>
              <div class="relative w-40">
                <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                <input type="number" min="0" step="0.01" class="input-field pl-8 text-sm"
                  placeholder="0,00" value="${_mat.extraDesc||0}"
                  oninput="StudentsModule.setExtraDesc(this.value)">
              </div>
            </div>

            <!-- Resumo calculado -->
            <div id="matCalcBox"></div>

            <!-- Valor de Ato / Entrada -->
            <div class="bg-yellow-900/15 border border-yellow-700/30 rounded-xl p-4 mb-3">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="text-sm font-semibold text-yellow-300">💵 Valor de Ato (Entrada)</p>
                  <p class="text-xs text-gray-500 mt-0.5">Pago no momento da matrícula — pode mesclar formas</p>
                </div>
                <select onchange="StudentsModule.addEntrada(this.value);this.value=''" class="input-field w-auto text-xs py-1.5 pr-7">
                  <option value="">+ Forma de Pagamento</option>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Cartão Débito</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
              <div id="matEntradaList"></div>
            </div>

            <!-- Parcelas mensais -->
            <div id="matParcelasBox" class="bg-blue-900/15 border border-blue-700/30 rounded-xl p-4">
              <p class="text-sm font-semibold text-blue-300 mb-3">📅 Parcelas Mensais (Restante)</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="form-label">Número de Parcelas</label>
                  <select class="input-field" onchange="StudentsModule.setNParcelas(this.value)">
                    ${parcelasOpts}
                  </select>
                </div>
                <div>
                  <label class="form-label">Forma de Pagamento</label>
                  <select class="input-field" onchange="StudentsModule.setFormaParcela(this.value)">
                    <option value="pix"           ${_mat.formaParcela==='pix'?'selected':''}>Pix</option>
                    <option value="boleto"         ${_mat.formaParcela==='boleto'?'selected':''}>Boleto</option>
                    <option value="cartao_debito"  ${_mat.formaParcela==='cartao_debito'?'selected':''}>Cartão Débito</option>
                    <option value="cartao_credito" ${_mat.formaParcela==='cartao_credito'?'selected':''}>Cartão Crédito</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">${s?'Salvar Alterações':'✅ Matricular Aluno'}</button>
          </div>
        </form>
      </div>`);

    setTimeout(() => _refresh(), 20);
  }

  /* ── SALVAR ── */
  function save(e, id) {
    e.preventDefault();
    const d = Utils.formData(e.target);
    const old = id ? DB.findById('students', id) : null;

    if (!_mat.cursos.length) { Utils.showToast('Selecione ao menos um curso','error'); return; }

    const c = _calc();
    const c2 = c; // alias

    if (c.totalEntrada > c.valorFinal + 0.01) {
      Utils.showToast('A entrada não pode ser maior que o valor final','error'); return;
    }

    const matOld = old?.matriculas?.[0] || {};
    const matId  = matOld.id || DB._id();

    const mat = {
      ...matOld,
      id:          matId,
      comboCursos: _mat.cursos,
      cursoId:     _mat.cursos[0]?.cursoId,
      turmaId:     d.turmaId,
      dataInicio:  d.dataInicio,
      funcionarioId: d.funcionarioId,
      comboDesc:   c.comboDesc,
      desconto:    c.extraDesc,
      entrada:     _mat.entrada,
      totalEntrada: c.totalEntrada,
      valorFinal:  c.valorFinal,
      totalParcelas: c.nP,
      valorParcela:  parseFloat(c.valorParcela.toFixed(2)),
      valorTotal:  c.totalCursos,
      formasPagamento: [
        ..._mat.entrada.map(en => ({ tipo: en.tipo, valor: en.valor })),
        ...(c.restante > 0 ? [{ tipo: _mat.formaParcela, valor: c.restante }] : [])
      ],
      createdAt: matOld.createdAt || new Date().toISOString()
    };

    const rec = {
      ...old,
      id:        id||undefined,
      nome:      d.nome, dataNascimento: d.dataNascimento, sexo: d.sexo,
      tipoDoc:   d.tipoDoc, documento: d.documento,
      telefone:  d.telefone, email: d.email, status: d.status,
      matriculas: [mat],
      criadoPor: old?.criadoPor || Auth.currentUser?.id
    };
    const saved = DB.save('students', rec);

    /* Gerar registros financeiros (apenas em nova matrícula) */
    if (!id) {
      const today = new Date().toISOString().slice(0,10);
      const novas = [];

      /* Entrada paga no ato */
      _mat.entrada.forEach(en => {
        if (en.valor > 0) {
          novas.push({
            id: DB._id(), alunoId: saved.id, matriculaId: matId,
            numero: 0, total: c.nP, valor: parseFloat(en.valor.toFixed(2)),
            vencimento: today, dataPagamento: today,
            status: 'pago', tipo: 'entrada',
            formaPagamento: en.tipo, juros: 0,
            obs: `Entrada — ${FORMAS[en.tipo]||en.tipo}`,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        }
      });

      /* Parcelas mensais */
      if (c.restante > 0 && c.nP > 0) {
        const inicio = new Date(d.dataInicio);
        for (let i = 0; i < c.nP; i++) {
          const venc = new Date(inicio);
          venc.setMonth(venc.getMonth() + i);
          novas.push({
            id: DB._id(), alunoId: saved.id, matriculaId: matId,
            numero: i+1, total: c.nP,
            valor: parseFloat(c.valorParcela.toFixed(2)),
            vencimento: venc.toISOString().slice(0,10),
            dataPagamento: null, status: 'pendente', tipo: 'mensalidade',
            formaPagamento: _mat.formaParcela, juros: 0, obs: '',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        }
      }

      const existentes = DB.get('financial').filter(p => p.matriculaId !== matId);
      DB.set('financial', [...existentes, ...novas]);
    }

    Audit.log('alunos', id?'editar':'criar', saved.id, old, saved);
    Utils.closeModal();
    Utils.showToast(id?'Aluno atualizado!':'Aluno matriculado com sucesso! 🎓','success');
    render();
  }

  async function remove(id) {
    const s = DB.findById('students', id);
    if (!await Utils.confirm(`Excluir o aluno "${s?.nome}"? Todos os dados serão removidos.`)) return;
    DB.remove('students', id);
    DB.set('financial', DB.get('financial').filter(p => p.alunoId !== id));
    DB.set('attendance', DB.get('attendance').filter(f => f.alunoId !== id));
    Audit.log('alunos','excluir',id,s,null);
    Utils.showToast('Aluno excluído','info');
    render();
  }

  function search(q) {
    const all = DB.get('students');
    let students = filter==='todos' ? all : all.filter(s => s.status===filter);
    const lq = q.toLowerCase();
    if (q) students = students.filter(s =>
      s.nome.toLowerCase().includes(lq) ||
      (s.telefone||'').includes(q) ||
      (s.documento||'').includes(q)
    );
    const el = document.getElementById('studentsList');
    if (el) el.innerHTML = renderList(students);
  }

  return {
    render, setFilter, openForm, openDetail, save, remove, search,
    addCurso, removeCurso, setComboDesc, setExtraDesc,
    addEntrada, removeEntrada, setEntradaValor, setNParcelas, setFormaParcela
  };
})();
