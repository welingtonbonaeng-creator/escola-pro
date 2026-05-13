/* ===== MÓDULO GRADE DE HORÁRIO ===== */
const ScheduleModule = (() => {

  const MAQUINAS = [
    'COMPUTADOR 01', 'COMPUTADOR 02', 'COMPUTADOR 03', 'COMPUTADOR 04',
    'COMPUTADOR 05', 'COMPUTADOR 06', 'COMPUTADOR 07', 'COMPUTADOR 08',
    'COMPUTADOR 09', 'COMPUTADOR 10', 'COMPUTADOR 11', 'COMPUTADOR 12',
    'EXCLUSIVIDADE AV1', 'EXCLUSIVIDADE AV2',
  ];

  const HORARIOS = [
    { key: '08:00-09:30', label: '08:00 às 09:30' },
    { key: '09:30-11:00', label: '09:30 às 11:00' },
    { key: '11:00-12:30', label: '11:00 às 12:30' },
    { key: '13:00-14:30', label: '13:00 às 14:30' },
    { key: '14:30-16:00', label: '14:30 às 16:00' },
    { key: '16:00-17:30', label: '16:00 às 17:30' },
  ];

  const DIAS = [
    { key: 'seg', label: 'Segunda' },
    { key: 'ter', label: 'Terça'   },
    { key: 'qua', label: 'Quarta'  },
    { key: 'qui', label: 'Quinta'  },
    { key: 'sex', label: 'Sexta'   },
    { key: 'sab', label: 'Sábado'  },
  ];

  let _diaAtivo    = 'seg';
  let _filtroMaq   = '';
  let _filtroHor   = '';

  function _slots() { return DB.get('schedule'); }

  function _findSlot(dia, horario, maquina) {
    return _slots().find(s => s.dia === dia && s.horario === horario && s.maquina === maquina) || null;
  }

  /* ── Render principal ── */
  function render() {
    if (!Auth.can('alunos', 'ver')) { App.denied(); return; }

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">

        <!-- Cabeçalho -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold text-white">Grade de Horário</h3>
            <p class="text-gray-400 text-sm">SALA 01 — ${MAQUINAS.length} máquinas</p>
          </div>
        </div>

        <!-- Filtros -->
        <div class="card p-4">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🔍 Filtrar Disponibilidade</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="form-label">Máquina</label>
              <select class="input-field" onchange="ScheduleModule.setFiltro('maq',this.value)">
                <option value="">Todas as Máquinas</option>
                ${MAQUINAS.map(m => `<option value="${m}" ${_filtroMaq === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Horário</label>
              <select class="input-field" onchange="ScheduleModule.setFiltro('hor',this.value)">
                <option value="">Todos os Horários</option>
                ${HORARIOS.map(h => `<option value="${h.key}" ${_filtroHor === h.key ? 'selected' : ''}>${h.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ${(_filtroMaq || _filtroHor) ? `<button onclick="ScheduleModule.clearFiltros()" class="btn-secondary btn-sm mt-3">✕ Limpar Filtros</button>` : ''}
        </div>

        <!-- Resumo por dia -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          ${_renderResumoCards()}
        </div>

        <!-- Tabs de dia -->
        <div class="flex flex-wrap gap-2">
          ${DIAS.map(d => {
            const ocup = _slots().filter(s => s.dia === d.key).length;
            const total = MAQUINAS.length * HORARIOS.length;
            const disp = total - ocup;
            return `<button onclick="ScheduleModule.setDia('${d.key}')" class="tab-btn ${_diaAtivo === d.key ? 'active' : ''}">
              ${d.label}<span class="ml-1.5 text-xs opacity-60">${disp} livres</span>
            </button>`;
          }).join('')}
        </div>

        <!-- Grade -->
        <div class="card overflow-x-auto p-0">
          ${_renderGrid(_diaAtivo)}
        </div>

        <!-- Legenda -->
        <div class="card p-3 flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span class="font-semibold">Legenda:</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-800/60 border border-green-600/40 inline-block"></span>Disponível</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-primary-800/60 border border-primary-600/40 inline-block"></span>Aluno Matriculado</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-yellow-800/60 border border-yellow-600/40 inline-block"></span>Visita Agendada</span>
        </div>
      </div>`;
  }

  function _renderResumoCards() {
    const slots = _slots();
    return DIAS.map(d => {
      const ocup  = slots.filter(s => s.dia === d.key).length;
      const total = MAQUINAS.length * HORARIOS.length;
      const disp  = total - ocup;
      const pct   = Math.round((ocup / total) * 100);
      const col   = disp > 40 ? 'text-green-400' : disp > 20 ? 'text-yellow-400' : disp > 0 ? 'text-orange-400' : 'text-red-400';
      const bar   = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-primary-500';
      return `
        <div onclick="ScheduleModule.setDia('${d.key}')"
          class="card p-3 text-center cursor-pointer transition-all hover:ring-1 hover:ring-primary-500 ${_diaAtivo === d.key ? 'ring-1 ring-primary-500 bg-primary-900/10' : ''}">
          <div class="text-xs font-semibold text-gray-300 mb-1">${d.label}</div>
          <div class="text-2xl font-bold ${col}">${disp}</div>
          <div class="text-xs text-gray-500">livres / ${total}</div>
          <div class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full rounded-full ${bar}" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function _renderGrid(dia) {
    const slots   = _slots().filter(s => s.dia === dia);
    const maquinas = _filtroMaq ? [_filtroMaq] : MAQUINAS;
    const horarios = _filtroHor ? HORARIOS.filter(h => h.key === _filtroHor) : HORARIOS;

    return `
      <table class="w-full text-xs" style="min-width:580px">
        <thead>
          <tr class="bg-gray-800/80 border-b border-gray-700/50">
            <th class="text-left px-3 py-3 text-gray-400 font-semibold sticky left-0 bg-gray-800 border-r border-gray-700/40 z-10 min-w-[130px]">Máquina</th>
            ${horarios.map(h => `
              <th class="px-2 py-3 text-center text-gray-400 font-semibold min-w-[105px] border-l border-gray-700/20 leading-tight whitespace-pre-line">${h.label.replace(' às ', '\nàs ')}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${maquinas.map((maq, i) => {
            const isExclu = maq.startsWith('EXCLUSIVIDADE');
            const rowBg   = isExclu ? 'bg-violet-900/5' : (i % 2 ? 'bg-gray-800/20' : '');
            return `
            <tr class="border-b border-gray-700/20 hover:bg-gray-700/10 transition-colors ${rowBg}">
              <td class="px-3 py-2 sticky left-0 border-r border-gray-700/40 z-10 ${isExclu ? 'bg-violet-900/20' : 'bg-gray-800/80'}">
                <div class="font-semibold ${isExclu ? 'text-violet-300' : 'text-gray-200'} text-xs">${maq}</div>
                <div class="text-gray-600 text-xs">SALA 01</div>
              </td>
              ${horarios.map(h => {
                const slot = slots.find(s => s.horario === h.key && s.maquina === maq);
                if (slot) {
                  const isVis = slot.tipo === 'visita';
                  const cls = isVis
                    ? 'bg-yellow-900/30 border-yellow-700/50 text-yellow-200 hover:bg-yellow-900/50'
                    : 'bg-primary-900/30 border-primary-700/50 text-primary-200 hover:bg-primary-900/50';
                  return `
                  <td class="px-1 py-1.5 border-l border-gray-700/20">
                    <div onclick="ScheduleModule.openSlot('${dia}','${h.key}','${maq}')"
                      class="rounded-md px-1.5 py-1 border ${cls} cursor-pointer transition-all text-center">
                      <div class="font-medium truncate text-xs leading-tight">${slot.nomeAluno}</div>
                      <div class="text-xs opacity-50 mt-0.5">${isVis ? '👁️ visita' : '🎓 aluno'}</div>
                    </div>
                  </td>`;
                } else {
                  return `
                  <td class="px-1 py-1.5 border-l border-gray-700/20">
                    <div onclick="ScheduleModule.openSlot('${dia}','${h.key}','${maq}')"
                      class="rounded-md px-1.5 py-1 border border-green-900/30 bg-green-900/10 cursor-pointer hover:bg-green-900/30 hover:border-green-700/40 transition-all text-center min-h-[38px] flex items-center justify-center">
                      <span class="text-green-600 text-xs">✓ livre</span>
                    </div>
                  </td>`;
                }
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  /* ── Ações ── */
  function setDia(dia)  { _diaAtivo = dia; render(); }

  function setFiltro(key, val) {
    if (key === 'maq') _filtroMaq = val;
    else _filtroHor = val;
    render();
  }

  function clearFiltros() { _filtroMaq = ''; _filtroHor = ''; render(); }

  function openSlot(dia, horario, maquina) {
    const slot     = _findSlot(dia, horario, maquina);
    const diaLabel = DIAS.find(d => d.key === dia)?.label    || dia;
    const horLabel = HORARIOS.find(h => h.key === horario)?.label || horario;

    if (slot) {
      const isVis = slot.tipo === 'visita';
      Utils.showModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-white">Slot Ocupado</h3>
            <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
          </div>
          <div class="card card-sm space-y-2 text-sm mb-5 ${isVis ? 'bg-yellow-900/10' : 'bg-primary-900/10'}">
            <div class="stat-row"><span class="text-gray-400">Máquina</span><span class="text-white font-medium">${maquina}</span></div>
            <div class="stat-row"><span class="text-gray-400">Dia</span><span class="text-white">${diaLabel}</span></div>
            <div class="stat-row"><span class="text-gray-400">Horário</span><span class="text-white">${horLabel}</span></div>
            <div class="stat-row"><span class="text-gray-400">Nome</span><span class="text-white font-semibold">${slot.nomeAluno}</span></div>
            <div class="stat-row"><span class="text-gray-400">Tipo</span>
              <span class="badge ${isVis ? 'badge-yellow' : 'badge-primary'}">${isVis ? '👁️ Visita' : '🎓 Aluno'}</span>
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <button onclick="Utils.closeModal()" class="btn-secondary">Fechar</button>
            ${Auth.can('alunos','editar') ? `<button onclick="ScheduleModule.removeSlot('${slot.id}')" class="btn-danger">🗑️ Liberar Slot</button>` : ''}
          </div>
        </div>`);
    } else {
      const estudantes = DB.get('students').filter(s => s.status === 'ativo');
      const visitas    = DB.get('visits').filter(v => v.status === 'visita');

      Utils.showModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-white">Slot Disponível</h3>
            <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
          </div>
          <div class="card card-sm space-y-1 text-sm mb-5 bg-green-900/10">
            <div class="stat-row"><span class="text-gray-400">Máquina</span><span class="text-white">${maquina}</span></div>
            <div class="stat-row"><span class="text-gray-400">Dia</span><span class="text-white">${diaLabel}</span></div>
            <div class="stat-row"><span class="text-gray-400">Horário</span><span class="text-green-400 font-medium">${horLabel} ✓</span></div>
          </div>
          ${Auth.can('alunos','editar') ? `
          <div class="space-y-3">
            <!-- Novo aluno direto da grade -->
            <button onclick="Utils.closeModal();App.navigate('students');setTimeout(()=>StudentsModule.openForm(null,{dia:'${dia}',horario:'${horario}'}),150)"
              class="w-full py-3 px-4 rounded-xl bg-primary-700 hover:bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
              ➕ Matricular Novo Aluno neste Horário
            </button>

            <div class="flex items-center gap-3">
              <div class="flex-1 border-t border-gray-700/50"></div>
              <span class="text-gray-600 text-xs">ou atribuir existente</span>
              <div class="flex-1 border-t border-gray-700/50"></div>
            </div>

            <div>
              <label class="form-label">Aluno Matriculado</label>
              <select id="slotAlunoSel" class="input-field" onchange="if(this.value)document.getElementById('slotVisitaSel').value=''">
                <option value="">— Selecione um aluno —</option>
                ${estudantes.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Visita Agendada</label>
              <select id="slotVisitaSel" class="input-field" onchange="if(this.value)document.getElementById('slotAlunoSel').value=''">
                <option value="">— Selecione uma visita —</option>
                ${visitas.map(v => `<option value="${v.id}">${v.nome}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-5">
            <button onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
            <button onclick="ScheduleModule.assignSlot('${dia}','${horario}','${maquina}')" class="btn-primary">✅ Atribuir Slot</button>
          </div>` : `<p class="text-center text-gray-500 text-sm py-2">Slot disponível</p>`}
        </div>`);
    }
  }

  function assignSlot(dia, horario, maquina) {
    const alunoId  = document.getElementById('slotAlunoSel')?.value;
    const visitaId = document.getElementById('slotVisitaSel')?.value;
    if (!alunoId && !visitaId) { Utils.showToast('Selecione um aluno ou visita', 'error'); return; }

    let nome, tipo, refId;
    if (alunoId) {
      const a = DB.findById('students', alunoId);
      if (!a) { Utils.showToast('Aluno não encontrado', 'error'); return; }
      nome = a.nome; tipo = 'aluno'; refId = alunoId;
    } else {
      const v = DB.findById('visits', visitaId);
      if (!v) { Utils.showToast('Visita não encontrada', 'error'); return; }
      nome = v.nome; tipo = 'visita'; refId = visitaId;
    }

    if (_findSlot(dia, horario, maquina)) { Utils.showToast('Este slot já está ocupado', 'error'); return; }

    DB.save('schedule', { dia, horario, maquina, alunoId: tipo === 'aluno' ? refId : null, visitaId: tipo === 'visita' ? refId : null, nomeAluno: nome, tipo });
    Utils.closeModal();
    Utils.showToast('Slot atribuído com sucesso! ✅', 'success');
    render();
  }

  async function removeSlot(slotId) {
    const slot = DB.findById('schedule', slotId);
    if (!await Utils.confirm(`Liberar o slot de "${slot?.nomeAluno || '?'}"?`)) return;
    DB.remove('schedule', slotId);
    Utils.closeModal();
    Utils.showToast('Slot liberado', 'info');
    render();
  }

  /* ── Widget embed: mostra disponibilidade resumida por dia/horário ── */
  function renderMiniDisponivel() {
    const slots = _slots();
    return `
      <div class="space-y-1.5">
        ${DIAS.map(d => {
          const cols = HORARIOS.map(h => {
            const ocup = slots.filter(s => s.dia === d.key && s.horario === h.key).length;
            const disp = MAQUINAS.length - ocup;
            const cls = disp === 0
              ? 'bg-red-900/30 border-red-800/50 text-red-400'
              : disp <= 4
              ? 'bg-orange-900/20 border-orange-800/40 text-orange-300'
              : disp <= 8
              ? 'bg-yellow-900/20 border-yellow-800/40 text-yellow-300'
              : 'bg-green-900/20 border-green-700/40 text-green-300';
            const horShort = h.label.split(' às ')[0];
            return `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border ${cls}" title="${h.label} — ${disp} vagas livres">
              ${horShort}<span class="opacity-70 ml-0.5">${disp > 0 ? disp + '✓' : '✗'}</span>
            </span>`;
          }).join('');
          return `
            <div class="flex flex-wrap items-center gap-1">
              <span class="text-xs font-semibold text-gray-500 w-14 flex-shrink-0">${d.label}</span>
              ${cols}
            </div>`;
        }).join('')}
        <p class="text-xs text-gray-600 mt-1">Número = vagas livres nas ${MAQUINAS.length} máquinas · ✗ = lotado</p>
      </div>`;
  }

  return {
    render, setDia, setFiltro, clearFiltros,
    openSlot, assignSlot, removeSlot,
    renderMiniDisponivel,
    MAQUINAS, HORARIOS, DIAS,
  };
})();
