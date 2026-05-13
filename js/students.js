/* ===== MÓDULO ALUNOS ===== */
const StudentsModule = (() => {

  let filter = 'todos';

  /* ── Estado temporário do formulário de matrícula ── */
  let _mat = { cursos:[], comboDesc:0, extraDesc:0, entrada:[], restante:[], slots:[], editId:null };

  const FORMAS = { pix:'Pix', dinheiro:'Dinheiro', cartao_debito:'Cartão Débito', cartao_credito:'Cartão Crédito', boleto:'Boleto' };

  /* Parser monetário BR — aceita vírgula e ponto */
  function _parseBRL(v) { return Utils.parseBRL(v); }

  /* Máquinas da sala (espelha ScheduleModule.MAQUINAS) */
  const _MAQUINAS = typeof ScheduleModule !== 'undefined' ? ScheduleModule.MAQUINAS :
    [...Array(12).keys()].map((_,i)=>`COMPUTADOR ${String(i+1).padStart(2,'0')}`).concat(['EXCLUSIVIDADE AV1','EXCLUSIVIDADE AV2']);

  const _SLOT_DIAS     = [{key:'seg',lbl:'Seg'},{key:'ter',lbl:'Ter'},{key:'qua',lbl:'Qua'},{key:'qui',lbl:'Qui'},{key:'sex',lbl:'Sex'},{key:'sab',lbl:'Sáb'}];
  const _SLOT_HORARIOS = ['08:00-09:30','09:30-11:00','11:00-12:30','13:00-14:30','14:30-16:00','16:00-17:30'];
  const _DIAS_FULL     = {seg:'Segunda',ter:'Terça',qua:'Quarta',qui:'Quinta',sex:'Sexta',sab:'Sábado'};

  /* Grade de horários — retorna HTML da grade de seleção */
  function _renderSlotSelector() {
    const schedule = DB.get('schedule');
    const TOTAL = _MAQUINAS.length;

    let html = `<div class="overflow-x-auto -mx-1">
      <table class="w-full text-xs">
        <thead><tr>
          <th class="text-left text-gray-500 py-1 pr-3 font-normal whitespace-nowrap">Horário</th>
          ${_SLOT_DIAS.map(d=>`<th class="text-center text-gray-400 font-semibold py-1 px-1 min-w-[60px]">${d.lbl}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${_SLOT_HORARIOS.map(hor => `<tr>
            <td class="text-gray-500 pr-2 py-0.5 whitespace-nowrap">${hor}</td>
            ${_SLOT_DIAS.map(dia => {
              const occ  = schedule.filter(s=>s.dia===dia.key&&s.horario===hor&&s.alunoId!==_mat.editId).length;
              const free = Math.max(0, TOTAL - occ);
              const sel  = _mat.slots.some(s=>s.dia===dia.key&&s.horario===hor);
              let cls, txt;
              if (sel)          { cls='bg-primary-600 border-primary-500 text-white font-bold';          txt='✓'; }
              else if (free===0){ cls='bg-gray-700/20 border-gray-600/20 text-gray-700 cursor-not-allowed'; txt='Lotado'; }
              else if (free<=3) { cls='bg-red-900/30 border-red-700/30 text-red-400 hover:bg-red-800/40';   txt=free+''; }
              else if (free<=7) { cls='bg-yellow-900/30 border-yellow-700/30 text-yellow-300 hover:bg-yellow-800/40'; txt=free+''; }
              else              { cls='bg-green-900/30 border-green-700/30 text-green-400 hover:bg-green-800/40';     txt=free+''; }
              return `<td class="px-0.5 py-0.5">
                <button type="button" title="${free} vaga(s) livre(s)"
                  ${free>0||sel ? `onclick="StudentsModule.toggleSlot('${dia.key}','${hor}')"` : 'disabled'}
                  class="w-full rounded border py-2 text-xs transition-colors font-medium ${cls}">
                  ${txt}
                </button></td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
      <span>🟢 >7 vagas</span><span>🟡 1–7 vagas</span><span>🔴 Lotado</span><span class="text-primary-400">■ Selecionado</span>
    </div>`;

    if (_mat.slots.length > 0) {
      html += `<div class="mt-3 flex flex-wrap gap-2">
        ${_mat.slots.map(s=>`
          <span class="inline-flex items-center gap-1 bg-primary-900/50 text-primary-200 text-xs px-2.5 py-1.5 rounded-full border border-primary-700/40">
            📅 ${_DIAS_FULL[s.dia]||s.dia} · ${s.horario}
            <button type="button" onclick="StudentsModule.toggleSlot('${s.dia}','${s.horario}')" class="ml-1 text-primary-400 hover:text-white leading-none">×</button>
          </span>`).join('')}
      </div>`;
    } else {
      html += `<p class="text-xs text-gray-600 mt-2 italic">Nenhum horário selecionado — clique nas células disponíveis acima.</p>`;
    }
    return html;
  }

  function toggleSlot(dia, horario) {
    const idx = _mat.slots.findIndex(s=>s.dia===dia&&s.horario===horario);
    if (idx >= 0) _mat.slots.splice(idx, 1);
    else _mat.slots.push({ dia, horario });
    const el = document.getElementById('matSlotGrid');
    if (el) el.innerHTML = _renderSlotSelector();
  }

  /* Cálculo financeiro */
  function _calc() {
    const totalCursos  = _mat.cursos.reduce((s, c) => s + c.valor, 0);
    const comboDesc    = _mat.cursos.length > 1 ? (_mat.comboDesc || 0) : 0;
    const extraDesc    = _mat.extraDesc || 0;
    const valorFinal   = Math.max(0, totalCursos - comboDesc - extraDesc);
    const totalEntrada = _mat.entrada.reduce((s, e) => s + _parseBRL(e.valor), 0);
    const restante     = Math.max(0, valorFinal - totalEntrada);
    const totalRestanteAlocado = (_mat.restante||[]).reduce((s, r) => s + _parseBRL(r.valor), 0);
    const nP           = (_mat.restante||[]).length > 0 ? Math.max(...(_mat.restante||[]).map(r=>r.parcelas||1)) : 1;
    const valorParcela = nP > 0 && restante > 0 ? restante / nP : 0;
    return { totalCursos, comboDesc, extraDesc, valorFinal, totalEntrada, restante, totalRestanteAlocado, nP, valorParcela };
  }

  function _brl(v) {
    return 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2});
  }

  /* Atualiza as seções dinâmicas do formulário.
     skip: 'cursos' → não re-renderiza matCursosList (evita destruir input de valor durante digitação)
     skip: 'entrada' → não re-renderiza matEntradaList */
  function _refresh(skip = '') {
    const c = _calc();

    /* Lista de cursos */
    if (skip !== 'cursos') {
      const cursosEl = document.getElementById('matCursosList');
      if (cursosEl) {
        cursosEl.innerHTML = !_mat.cursos.length
          ? '<p class="text-gray-500 text-sm italic py-2">Nenhum curso selecionado</p>'
          : _mat.cursos.map((cur, i) => `
            <div class="flex items-center justify-between py-2 border-b border-gray-700/40 last:border-0">
              <span class="text-white text-sm font-medium flex-1 mr-3">${cur.nome}</span>
              <div class="flex items-center gap-2">
                <div class="relative w-32">
                  <span class="absolute left-2 top-2.5 text-gray-400 text-xs">R$</span>
                  <input type="text" inputmode="decimal" placeholder="0,00"
                    value="${cur.valor > 0 ? Number(cur.valor).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}"
                    class="input-field pl-7 py-1.5 text-sm text-primary-300 font-semibold"
                    oninput="StudentsModule.setCursoValor(${i},this.value)"
                    onblur="StudentsModule.formatCursoValor(${i},this)">
                </div>
                <button type="button" onclick="StudentsModule.removeCurso(${i})" class="text-red-400 hover:text-red-300 text-xl leading-none">×</button>
              </div>
            </div>`).join('');
      }
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
      if (c.restante > 0) {
        linhas.push(`<div class="flex justify-between border-t border-gray-600 pt-2"><span class="text-gray-300">Restante a pagar</span><span class="text-white font-bold">${_brl(c.restante)}</span></div>`);
        const diff = parseFloat((c.restante - c.totalRestanteAlocado).toFixed(2));
        if (diff > 0.01) linhas.push(`<div class="flex justify-between text-xs"><span class="text-orange-400">⚠ Não alocado</span><span class="text-orange-300">${_brl(diff)}</span></div>`);
        else if ((_mat.restante||[]).length > 0) linhas.push(`<div class="text-center text-green-400 text-xs py-1">✅ Restante totalmente alocado</div>`);
      } else if (c.valorFinal > 0 && c.totalEntrada >= c.valorFinal) linhas.push(`<div class="text-center text-green-400 text-xs py-1">✅ Valor totalmente coberto pela entrada</div>`);
      calcEl.innerHTML = `<div class="card bg-gray-700/40 space-y-1.5 text-sm mb-4">${linhas.join('')}</div>`;
    }

    /* Lista de entrada — só re-renderiza quando NÃO está digitando */
    if (skip !== 'entrada') {
      const entEl = document.getElementById('matEntradaList');
      if (entEl) {
        const PARC_OPTS_E = [1,2,3,4,5,6,8,10,12,15,18,24];
        entEl.innerHTML = !_mat.entrada.length
          ? '<p class="text-gray-500 text-xs italic pb-1">Sem entrada — valor integral em parcelas</p>'
          : _mat.entrada.map((en, i) => {
              const pOpts = PARC_OPTS_E.map(n=>`<option value="${n}" ${(en.parcelas||1)===n?'selected':''}>${n}x</option>`).join('');
              return `
            <div class="flex items-center gap-2 mb-2 flex-wrap sm:flex-nowrap">
              <span class="text-sm text-gray-300 w-28 flex-shrink-0">${FORMAS[en.tipo]||en.tipo}</span>
              <div class="relative flex-1 min-w-[100px]">
                <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                <input type="text" inputmode="decimal" placeholder="0,00"
                  value="${en.valor > 0 ? Number(en.valor).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}" class="input-field pl-8 text-sm"
                  oninput="StudentsModule.setEntradaValor(${i},this.value)"
                  onblur="StudentsModule.formatEntradaValor(${i},this)">
              </div>
              <select class="input-field w-20 text-xs py-1.5 flex-shrink-0" title="Parcelas"
                onchange="StudentsModule.setEntradaParcelas(${i},this.value)">
                ${pOpts}
              </select>
              <button type="button" onclick="StudentsModule.removeEntrada(${i})" class="text-red-400 hover:text-red-300 text-xl leading-none flex-shrink-0">×</button>
            </div>`;}).join('');
      }
    }

    /* Lista do restante (múltiplas formas) */
    if (skip !== 'restante') {
      const restEl = document.getElementById('matRestanteList');
      if (restEl) {
        const PARC_OPTS_R = [1,2,3,4,5,6,8,10,12,15,18,24];
        restEl.innerHTML = !(_mat.restante||[]).length
          ? '<p class="text-gray-500 text-xs italic pb-1">Sem formas adicionadas — adicione acima</p>'
          : (_mat.restante||[]).map((re, i) => {
              const pOpts = PARC_OPTS_R.map(n=>`<option value="${n}" ${(re.parcelas||1)===n?'selected':''}>${n}x</option>`).join('');
              return `
            <div class="flex items-center gap-2 mb-2 flex-wrap sm:flex-nowrap">
              <span class="text-sm text-gray-300 w-28 flex-shrink-0">${FORMAS[re.tipo]||re.tipo}</span>
              <div class="relative flex-1 min-w-[100px]">
                <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                <input type="text" inputmode="decimal" placeholder="0,00"
                  value="${re.valor > 0 ? Number(re.valor).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}" class="input-field pl-8 text-sm"
                  oninput="StudentsModule.setRestanteValor(${i},this.value)"
                  onblur="StudentsModule.formatRestanteValor(${i},this)">
              </div>
              <select class="input-field w-20 text-xs py-1.5 flex-shrink-0" title="Parcelas"
                onchange="StudentsModule.setRestanteParcelas(${i},this.value)">
                ${pOpts}
              </select>
              <button type="button" onclick="StudentsModule.removeRestante(${i})" class="text-red-400 hover:text-red-300 text-xl leading-none flex-shrink-0">×</button>
            </div>`;
            }).join('');
      }
    }

    /* Grade de horários */
    const slotEl = document.getElementById('matSlotGrid');
    if (slotEl) slotEl.innerHTML = _renderSlotSelector();

    /* Bloco restante */
    const restBoxEl = document.getElementById('matRestanteBox');
    if (restBoxEl) restBoxEl.classList.toggle('hidden', c.restante <= 0 && c.valorFinal > 0);
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

  function setComboDesc(v) { _mat.comboDesc = _parseBRL(v); _refresh(); }
  function setExtraDesc(v) { _mat.extraDesc = _parseBRL(v); _refresh(); }

  function addEntrada(tipo) {
    if (!tipo) return;
    _mat.entrada.push({ tipo, valor: 0, parcelas: 1 });
    _refresh();
  }

  function removeEntrada(i) { _mat.entrada.splice(i, 1); _refresh(); }

  function setEntradaValor(i, v) { _mat.entrada[i].valor = _parseBRL(v); _refresh('entrada'); }
  function formatEntradaValor(i, el) { const val = _mat.entrada[i]?.valor||0; if(val>0) el.value=val.toFixed(2).replace('.',','); }
  function setEntradaParcelas(i, v) { if (_mat.entrada[i]) _mat.entrada[i].parcelas = parseInt(v)||1; }

  function addRestante(tipo) {
    if (!tipo) return;
    const c = _calc();
    const jaAlocado = (_mat.restante||[]).reduce((a,r) => a + _parseBRL(r.valor), 0);
    const auto = parseFloat(Math.max(0, c.restante - jaAlocado).toFixed(2));
    (_mat.restante = _mat.restante||[]).push({ tipo, valor: auto, parcelas: 1 });
    _refresh();
  }
  function removeRestante(i) { (_mat.restante||[]).splice(i, 1); _refresh(); }
  function setRestanteValor(i, v) { if ((_mat.restante||[])[i]) { _mat.restante[i].valor = _parseBRL(v); _refresh('restante'); } }
  function formatRestanteValor(i, el) { const val = (_mat.restante||[])[i]?.valor||0; if(val>0) el.value=val.toFixed(2).replace('.',','); }
  function setRestanteParcelas(i, v) { if ((_mat.restante||[])[i]) _mat.restante[i].parcelas = parseInt(v)||1; }

  function setCursoValor(i, v) { _mat.cursos[i].valor = _parseBRL(v); _refresh('cursos'); }
  function formatCursoValor(i, el) { const val = _mat.cursos[i]?.valor||0; if(val>0) el.value=val.toFixed(2).replace('.',','); }

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
    const schedSlots = DB.get('schedule').filter(s=>s.alunoId===id);

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

        <!-- Horários de Estudo -->
        <div>
          <p class="section-title">📅 Horários de Estudo</p>
          ${schedSlots.length ? `
          <div class="flex flex-wrap gap-2">
            ${schedSlots.map(s=>{
              const maq = s.maquina||'';
              const diaLabel = {seg:'Segunda',ter:'Terça',qua:'Quarta',qui:'Quinta',sex:'Sexta',sab:'Sábado'}[s.dia]||s.dia;
              return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-900/40 border border-primary-700/40 text-xs text-primary-200">
                📅 ${diaLabel} · ${s.horario}${maq?` <span class="text-gray-500">· ${maq}</span>`:''}
              </span>`;
            }).join('')}
          </div>` : '<p class="text-gray-500 text-sm">Nenhum horário definido</p>'}
        </div>

        <!-- Frequência -->
        <div>
          <p class="section-title">Frequência</p>
          <div class="grid grid-cols-3 gap-3">
            <div class="card card-sm text-center"><div class="text-2xl font-bold text-green-400">${presencas}</div><div class="text-xs text-gray-400">Presenças</div></div>
            <div class="card card-sm text-center"><div class="text-2xl font-bold text-red-400">${faltas}</div><div class="text-xs text-gray-400">Faltas</div></div>
            <div class="card card-sm text-center"><div class="text-2xl font-bold text-white">${freq.length?Math.round((presencas/freq.length)*100):0}%</div><div class="text-xs text-gray-400">Frequência</div></div>
          </div>
        </div>

        <!-- Plano de Pagamento -->
        <div>
          <p class="section-title">💳 Plano de Pagamento</p>
          ${(()=>{
            const FLABEL = { pix:'Pix', dinheiro:'Dinheiro', cartao_debito:'Cartão Débito', cartao_credito:'Cartão Crédito', boleto:'Boleto' };
            const FICON  = { pix:'🟢', dinheiro:'💵', cartao_debito:'🔵', cartao_credito:'🟣', boleto:'🟡' };

            /* ── Linha de parcela individual ── */
            const _pRow = (p, isEntrada=false) => {
              const borda = p.status==='pago'?'border-l-green-500':p.status==='atrasado'?'border-l-red-500':'border-l-yellow-500';
              const label = isEntrada
                ? (p.obs || `Entrada — ${FLABEL[p.formaPagamento]||p.formaPagamento||'—'}`)
                : `Parcela ${p.numero}/${p.total}`;
              return `<div class="flex items-start justify-between bg-gray-700/20 rounded-lg px-3 py-2 border-l-2 ${borda} text-sm gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium ${isEntrada?'text-yellow-200':'text-gray-200'}">${label}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded bg-gray-600/60 text-gray-400">${FLABEL[p.formaPagamento]||p.formaPagamento||'—'}</span>
                  </div>
                  <div class="flex items-center gap-3 mt-0.5 text-xs flex-wrap">
                    <span class="text-gray-500">📅 Venc: <span class="${p.status==='atrasado'?'text-red-400 font-semibold':'text-gray-400'}">${Utils.formatDate(p.vencimento)}</span></span>
                    ${p.dataPagamento?`<span class="text-green-400">✅ Pago em: ${Utils.formatDate(p.dataPagamento)}</span>`:''}
                    ${(p.juros||0)>0?`<span class="text-red-400">+${Utils.currency(p.juros)} juros</span>`:''}
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="font-bold text-white">${Utils.currency(p.valor+(p.juros||0))}</span>
                  ${Utils.statusBadge(p.status)}
                </div>
              </div>`;
            };

            let html = '';

            /* ── 💵 Ato / Entrada ── */
            if (entradas.length) {
              const totalEnt  = entradas.reduce((a,p)=>a+p.valor,0);
              const pagoEnt   = entradas.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
              const formasEnt = [...new Set(entradas.map(p=>p.formaPagamento))];
              html += `<div class="mb-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-yellow-300 uppercase tracking-wide">💵 Ato / Entrada</span>
                  <span class="text-xs text-gray-500">${formasEnt.map(f=>`${FLABEL[f]||f}`).join(' + ')} · ${Utils.currency(totalEnt)} · ${Utils.currency(pagoEnt)} pago</span>
                </div>
                <div class="space-y-1.5">${entradas.map(p=>_pRow(p,true)).join('')}</div>
              </div>`;
            }

            /* ── 📅 Restante — agrupado por forma de pagamento ── */
            if (mensais.length) {
              const totalMens = mensais.reduce((a,p)=>a+p.valor,0);
              const pagoMens  = mensais.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
              const formasMens= [...new Set(mensais.map(p=>p.formaPagamento))];

              html += `<div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-blue-300 uppercase tracking-wide">📅 Parcelamento do Restante</span>
                  <span class="text-xs text-gray-500">${mensais.filter(p=>p.status==='pago').length}/${mensais.length} pagas · ${Utils.currency(pagoMens)} de ${Utils.currency(totalMens)}</span>
                </div>`;

              if (formasMens.length > 1) {
                /* Múltiplas formas → cada uma vira um bloco com cabeçalho */
                formasMens.forEach(forma => {
                  const grupo     = mensais.filter(p=>p.formaPagamento===forma);
                  const totG      = grupo.reduce((a,p)=>a+p.valor,0);
                  const pagoG     = grupo.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
                  const nParcG    = grupo.length;
                  const valorMed  = nParcG>0 ? totG/nParcG : 0;
                  html += `<div class="mb-3">
                    <div class="flex items-center gap-2 mb-1.5 px-1">
                      <span class="text-base">${FICON[forma]||'💳'}</span>
                      <span class="text-sm font-semibold text-white">${FLABEL[forma]||forma}</span>
                      <span class="text-xs text-gray-400">— ${nParcG}x de ${Utils.currency(valorMed)}</span>
                      <span class="ml-auto text-xs text-gray-500">${grupo.filter(p=>p.status==='pago').length}/${nParcG} pagas · ${Utils.currency(pagoG)} de ${Utils.currency(totG)}</span>
                    </div>
                    <div class="space-y-1.5 pl-2 border-l-2 border-blue-800/40">
                      ${grupo.map(p=>_pRow(p,false)).join('')}
                    </div>
                  </div>`;
                });
              } else {
                /* Forma única → cabeçalho simples + lista */
                const forma    = formasMens[0];
                const valorMed = mensais.length>0 ? totalMens/mensais.length : 0;
                html += `<div class="flex items-center gap-2 mb-2 px-1">
                  <span class="text-base">${FICON[forma]||'💳'}</span>
                  <span class="text-sm font-semibold text-white">${FLABEL[forma]||forma||'—'}</span>
                  <span class="text-xs text-gray-400">— ${mensais.length}x de ${Utils.currency(valorMed)}</span>
                </div>
                <div class="space-y-1.5">${mensais.map(p=>_pRow(p,false)).join('')}</div>`;
              }
              html += `</div>`;
            }

            return html || '<p class="text-gray-500 text-sm">Nenhum registro financeiro</p>';
          })()}
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
      comboDesc: mat?.comboDesc  || 0,
      extraDesc: mat?.desconto   || 0,
      entrada:   mat?.entrada    || [],
      restante:  mat?.restante   || [],
      slots:     id ? DB.get('schedule').filter(s=>s.alunoId===id).map(s=>({dia:s.dia,horario:s.horario})) : [],
      editId:    id || null
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
                  <input type="text" inputmode="decimal" class="input-field pl-8 text-sm"
                    placeholder="0,00" value="${_mat.comboDesc||''}"
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

          <!-- Horários de Estudo -->
          <div>
            <p class="section-title">📅 Horários de Estudo</p>
            <p class="text-xs text-gray-400 mb-3">Selecione os dias e horários que o aluno irá estudar. O número indica vagas disponíveis na sala.</p>
            <div id="matSlotGrid" class="bg-gray-800/40 rounded-xl p-3 border border-gray-700/30"></div>
          </div>

          <!-- Financeiro -->
          <div>
            <p class="section-title">Financeiro</p>

            <!-- Desconto extra -->
            <div class="flex items-center gap-3 mb-4">
              <label class="form-label mb-0 flex-shrink-0">Desconto extra</label>
              <div class="relative w-40">
                <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                <input type="text" inputmode="decimal" class="input-field pl-8 text-sm"
                  placeholder="0,00" value="${_mat.extraDesc||''}"
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

            <!-- Valor Restante (múltiplas formas, cada uma parcelável até 24x) -->
            <div id="matRestanteBox" class="bg-blue-900/15 border border-blue-700/30 rounded-xl p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="text-sm font-semibold text-blue-300">📅 Valor Restante</p>
                  <p class="text-xs text-gray-500 mt-0.5">Mescle formas e parcele em até 24x cada</p>
                </div>
                <select onchange="StudentsModule.addRestante(this.value);this.value=''" class="input-field w-auto text-xs py-1.5 pr-7">
                  <option value="">+ Forma de Pagamento</option>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Cartão Débito</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
              <div id="matRestanteList"></div>
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
      valorParcela:  parseFloat((c.valorParcela||0).toFixed(2)),
      valorTotal:  c.totalCursos,
      restante:    _mat.restante,
      formasPagamento: [
        ..._mat.entrada.map(en => ({ tipo: en.tipo, valor: en.valor, parcelas: en.parcelas||1 })),
        ...(_mat.restante||[]).map(re => ({ tipo: re.tipo, valor: re.valor, parcelas: re.parcelas||1 }))
      ],
      slots: _mat.slots.map(s => ({ dia: s.dia, horario: s.horario })),
      createdAt: matOld.createdAt || new Date().toISOString()
    };

    /* Busca o registro mais recente do DB para garantir que não usamos um `old` stale */
    const freshOld = id ? DB.findById('students', id) : null;
    const rec = {
      ...(freshOld || old || {}),
      id:        id || undefined,
      nome:      d.nome, dataNascimento: d.dataNascimento, sexo: d.sexo,
      tipoDoc:   d.tipoDoc, documento: d.documento,
      telefone:  d.telefone, email: d.email, status: d.status,
      matriculas: [mat],
      criadoPor: (freshOld || old)?.criadoPor || Auth.currentUser?.id
    };
    const saved = DB.save('students', rec);

    /* Atualiza grade de horários — remove slots desmarcados, cria novos */
    const _oldSchedSlots = DB.get('schedule').filter(s => s.alunoId === saved.id);
    _oldSchedSlots.forEach(s => {
      if (!_mat.slots.some(sl => sl.dia===s.dia && sl.horario===s.horario)) DB.remove('schedule', s.id);
    });
    _mat.slots.forEach(slot => {
      if (!_oldSchedSlots.find(s => s.dia===slot.dia && s.horario===slot.horario)) {
        const taken = DB.get('schedule').filter(s => s.dia===slot.dia && s.horario===slot.horario).map(s=>s.maquina);
        const machine = _MAQUINAS.find(m => !taken.includes(m)) || _MAQUINAS[0];
        DB.save('schedule', { dia:slot.dia, horario:slot.horario, maquina:machine, alunoId:saved.id, nomeAluno:saved.nome, tipo:'aluno', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
      }
    });

    /* Gerar registros financeiros se ainda não existem para esta matrícula
       (cobre tanto aluno novo quanto aluno convertido de visita que ainda não tinha matrícula) */
    const jaTemFinanceiro = DB.get('financial').some(p => p.matriculaId === matId);
    if (!jaTemFinanceiro) {
      const today = new Date().toISOString().slice(0,10);
      const novas = [];

      /* Entrada paga no ato (suporta parcelamento em cartão/boleto) */
      _mat.entrada.forEach(en => {
        const valorTotal = _parseBRL(en.valor);
        if (valorTotal <= 0) return;
        const nParc = en.parcelas || 1;
        const valorParc = parseFloat((valorTotal / nParc).toFixed(2));
        for (let p = 0; p < nParc; p++) {
          const venc = new Date(today);
          venc.setMonth(venc.getMonth() + p);
          novas.push({
            id: DB._id(), alunoId: saved.id, matriculaId: matId,
            numero: nParc > 1 ? p+1 : 0,
            total: nParc > 1 ? nParc : c.nP,
            valor: valorParc,
            vencimento: venc.toISOString().slice(0,10),
            dataPagamento: p === 0 ? today : null,
            status: p === 0 ? 'pago' : 'pendente',
            tipo: 'entrada',
            formaPagamento: en.tipo, juros: 0,
            obs: nParc > 1
              ? `Entrada ${p+1}/${nParc} — ${FORMAS[en.tipo]||en.tipo}`
              : `Entrada — ${FORMAS[en.tipo]||en.tipo}`,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        }
      });

      /* Valor restante — múltiplas formas, cada uma com parcelamento independente */
      const inicio = new Date(d.dataInicio);
      (_mat.restante||[]).forEach(re => {
        const valorTotal = _parseBRL(re.valor);
        if (valorTotal <= 0) return;
        const nParc = re.parcelas || 1;
        const valorParc = parseFloat((valorTotal / nParc).toFixed(2));
        for (let p = 0; p < nParc; p++) {
          const venc = new Date(inicio);
          venc.setMonth(venc.getMonth() + p);
          novas.push({
            id: DB._id(), alunoId: saved.id, matriculaId: matId,
            numero: p+1, total: nParc,
            valor: valorParc,
            vencimento: venc.toISOString().slice(0,10),
            dataPagamento: null, status: 'pendente', tipo: 'mensalidade',
            formaPagamento: re.tipo, juros: 0,
            obs: nParc > 1 ? `Parcela ${p+1}/${nParc} — ${FORMAS[re.tipo]||re.tipo}` : (FORMAS[re.tipo]||re.tipo),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        }
      });

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
    addCurso, removeCurso, setComboDesc, setExtraDesc, setCursoValor, formatCursoValor,
    addEntrada, removeEntrada, setEntradaValor, formatEntradaValor, setEntradaParcelas,
    addRestante, removeRestante, setRestanteValor, formatRestanteValor, setRestanteParcelas,
    toggleSlot
  };
})();
