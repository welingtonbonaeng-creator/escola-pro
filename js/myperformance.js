/* ===== MÓDULO MEU DESEMPENHO ===== */
const MyPerformanceModule = (() => {

  let _periodo    = 'mes_atual';
  let _dataInicio = '';
  let _dataFim    = '';

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  function _getRange() {
    const n = new Date(), y = n.getFullYear(), m = n.getMonth();
    if (_periodo === 'semana') {
      const d = new Date(n);
      const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
      d.setDate(d.getDate() + diff);
      const from = d.toISOString().slice(0,10);
      d.setDate(d.getDate() + 6);
      return { from, to: d.toISOString().slice(0,10) };
    }
    if (_periodo === 'mes_anterior') {
      const pm = m === 0 ? 11 : m-1, py = m === 0 ? y-1 : y;
      return { from:`${py}-${String(pm+1).padStart(2,'0')}-01`, to:new Date(py,pm+1,0).toISOString().slice(0,10) };
    }
    if (_periodo === 'personalizado') return { from:_dataInicio, to:_dataFim };
    return { from:`${y}-${String(m+1).padStart(2,'0')}-01`, to:new Date(y,m+1,0).toISOString().slice(0,10) };
  }

  function _inRange(date, range) {
    if (!date || !range.from || !range.to) return false;
    return date.slice(0,10) >= range.from && date.slice(0,10) <= range.to;
  }

  function _currentMes() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  }

  function render() {
    if (!Auth.logged) { App.denied(); return; }
    const emp = Auth.currentUser;

    const range    = _getRange();
    const mes      = _currentMes();
    const hoje     = new Date();
    const visits   = DB.get('visits');
    const students = DB.get('students');

    /* ── Leads no período ── */
    const meusLeads    = visits.filter(v => v.vendedorId === emp.id && _inRange(v.createdAt, range));
    const meusConv     = visits.filter(v => v.vendedorId === emp.id && v.status === 'aluno' && _inRange(v.convertidoEm || v.createdAt, range));
    const leadsAtivos  = meusLeads.filter(v => v.status !== 'aluno');
    const convPct      = meusLeads.length > 0 ? Math.round((meusConv.length / meusLeads.length) * 100) : 0;

    /* ── Matrículas no período ── */
    const minhasMats   = students.filter(s => s.matriculas?.[0]?.funcionarioId === emp.id && _inRange(s.matriculas[0].dataInicio, range));
    const minhaReceita = minhasMats.reduce((a,s) => a + (s.matriculas[0].valorFinal || s.matriculas[0].valorTotal || 0), 0);

    /* ── Metas do mês ── */
    const meta    = DB.get('goals').find(g => g.tipo === 'funcionario' && g.funcionarioId === emp.id && g.mes === mes) || { metaMatriculas:0, metaReceita:0 };
    const matsMes = students.filter(s => s.matriculas?.[0]?.funcionarioId === emp.id && s.matriculas[0].dataInicio?.startsWith(mes)).length;
    const recMes  = students.filter(s => s.matriculas?.[0]?.funcionarioId === emp.id && s.matriculas[0].dataInicio?.startsWith(mes))
                     .reduce((a,s) => a + (s.matriculas[0].valorFinal || s.matriculas[0].valorTotal || 0), 0);
    const matPct  = meta.metaMatriculas > 0 ? Math.min(100, Math.round((matsMes / meta.metaMatriculas) * 100)) : 0;
    const recPct  = meta.metaReceita   > 0 ? Math.min(100, Math.round((recMes  / meta.metaReceita)   * 100)) : 0;

    const tempCores  = { frio:'text-blue-400', morno:'text-yellow-400', quente:'text-orange-400', muito_quente:'text-red-400' };
    const tempLabel  = { frio:'❄️ Frio', morno:'🌡️ Morno', quente:'🔥 Quente', muito_quente:'🚀 M. Quente' };

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">

        <!-- Header pessoal -->
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-primary-800 flex items-center justify-center font-bold text-primary-200 text-lg flex-shrink-0">
            ${Utils.initials(emp.nome)}
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">${emp.nome}</h3>
            <p class="text-gray-400 text-sm">${emp.cargo || 'Funcionário'}</p>
          </div>
        </div>

        <!-- Filtro de período -->
        <div class="flex flex-wrap gap-2 items-center">
          ${['semana','mes_atual','mes_anterior','personalizado'].map(p => {
            const lbl = {semana:'📅 Semana', mes_atual:'📆 Este Mês', mes_anterior:'◀ Mês Anterior', personalizado:'🗓️ Período'}[p];
            return `<button onclick="MyPerformanceModule.setPeriodo('${p}')" class="tab-btn ${_periodo===p?'active':''}">${lbl}</button>`;
          }).join('')}
          ${_periodo === 'personalizado' ? `
            <input type="date" value="${_dataInicio}" onchange="MyPerformanceModule.setDataInicio(this.value)" class="input-field py-1.5 text-sm w-36">
            <span class="text-gray-500 text-sm">até</span>
            <input type="date" value="${_dataFim}"    onchange="MyPerformanceModule.setDataFim(this.value)"    class="input-field py-1.5 text-sm w-36">
          ` : ''}
        </div>

        <!-- KPIs -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="kpi-card">
            <div class="text-blue-400 text-xs font-semibold uppercase mb-1">📋 Meus Leads</div>
            <div class="kpi-value text-blue-400">${meusLeads.length}</div>
            <div class="text-xs text-gray-500 mt-1">no período</div>
          </div>
          <div class="kpi-card">
            <div class="text-green-400 text-xs font-semibold uppercase mb-1">✅ Convertidos</div>
            <div class="kpi-value text-green-400">${meusConv.length}</div>
            <div class="text-xs text-gray-500 mt-1">taxa ${convPct}%</div>
          </div>
          <div class="kpi-card">
            <div class="text-primary-300 text-xs font-semibold uppercase mb-1">🎓 Matrículas</div>
            <div class="kpi-value text-primary-300">${minhasMats.length}</div>
            <div class="text-xs text-gray-500 mt-1">no período</div>
          </div>
          <div class="kpi-card">
            <div class="text-yellow-400 text-xs font-semibold uppercase mb-1">💰 Receita</div>
            <div class="kpi-value text-yellow-400">${Utils.currency(minhaReceita)}</div>
            <div class="text-xs text-gray-500 mt-1">no período</div>
          </div>
        </div>

        <!-- Funil pessoal -->
        ${meusLeads.length > 0 ? `
        <div class="card">
          <p class="font-semibold text-white mb-4">🔽 Meu Funil de Conversão</p>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="text-gray-400 text-sm w-36 flex-shrink-0">Leads recebidos</span>
              <div class="flex-1 progress-bar h-5"><div class="progress-fill bg-blue-600" style="width:100%"></div></div>
              <span class="text-blue-300 text-sm font-bold w-8 text-right">${meusLeads.length}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-gray-400 text-sm w-36 flex-shrink-0">Convertidos em aluno</span>
              <div class="flex-1 progress-bar h-5"><div class="progress-fill bg-green-500" style="width:${convPct}%"></div></div>
              <span class="text-green-400 text-sm font-bold w-8 text-right">${meusConv.length}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-gray-400 text-sm w-36 flex-shrink-0">Matrículas fechadas</span>
              <div class="flex-1 progress-bar h-5"><div class="progress-fill bg-primary-500" style="width:${meusLeads.length > 0 ? Math.round((minhasMats.length/meusLeads.length)*100) : 0}%"></div></div>
              <span class="text-primary-300 text-sm font-bold w-8 text-right">${minhasMats.length}</span>
            </div>
          </div>
          <div class="mt-3 text-center">
            <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold
              ${convPct >= 50 ? 'bg-green-900/40 text-green-300 border border-green-700/40' :
                convPct >= 25 ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40' :
                                'bg-gray-700/40 text-gray-400 border border-gray-600/40'}">
              Taxa de conversão: ${convPct}%
            </span>
          </div>
        </div>` : ''}

        <!-- Metas do mês -->
        <div class="card">
          <p class="font-semibold text-white mb-4">🎯 Minhas Metas — ${MESES[hoje.getMonth()]} ${hoje.getFullYear()}</p>
          ${meta.metaMatriculas > 0 || meta.metaReceita > 0 ? `
          <div class="space-y-5">
            ${meta.metaMatriculas > 0 ? `
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-300 text-sm font-medium">🎓 Matrículas</span>
                <span class="text-xs ${matPct>=100?'text-green-400':'text-gray-400'}">${matsMes} de ${meta.metaMatriculas}</span>
              </div>
              <div class="progress-bar h-4 mb-1">
                <div class="progress-fill ${matPct>=100?'bg-green-500':matPct>=70?'bg-yellow-500':'bg-red-500'}" style="width:${matPct}%"></div>
              </div>
              <div class="flex justify-between">
                <span class="text-xs ${matPct>=100?'text-green-400':'text-gray-500'}">${matPct>=100?'✅ Meta atingida!':'Faltam '+(meta.metaMatriculas-matsMes)+' matrículas'}</span>
                <span class="text-white font-bold text-sm">${matPct}%</span>
              </div>
            </div>` : ''}
            ${meta.metaReceita > 0 ? `
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-300 text-sm font-medium">💰 Receita</span>
                <span class="text-xs ${recPct>=100?'text-green-400':'text-gray-400'}">${Utils.currency(recMes)} de ${Utils.currency(meta.metaReceita)}</span>
              </div>
              <div class="progress-bar h-4 mb-1">
                <div class="progress-fill ${recPct>=100?'bg-green-500':recPct>=70?'bg-yellow-500':'bg-red-500'}" style="width:${recPct}%"></div>
              </div>
              <div class="flex justify-between">
                <span class="text-xs ${recPct>=100?'text-green-400':'text-gray-500'}">${recPct>=100?'✅ Meta atingida!':'Faltam '+Utils.currency(meta.metaReceita-recMes)}</span>
                <span class="text-white font-bold text-sm">${recPct}%</span>
              </div>
            </div>` : ''}
          </div>` : `
          <div class="text-center py-6 border border-dashed border-gray-600 rounded-xl">
            <p class="text-4xl mb-2">🎯</p>
            <p class="text-gray-500 text-sm">Nenhuma meta definida para este mês.</p>
            <p class="text-xs text-gray-600 mt-1">Fale com o administrador para definir suas metas.</p>
          </div>`}
        </div>

        <!-- Minhas últimas matrículas -->
        <div class="card">
          <p class="font-semibold text-white mb-3">🎓 Minhas Últimas Matrículas <span class="text-gray-500 text-sm font-normal">(${minhasMats.length} no período)</span></p>
          ${minhasMats.length === 0 ? `
          <div class="text-center py-6 border border-dashed border-gray-600 rounded-xl">
            <p class="text-gray-500 text-sm">Nenhuma matrícula neste período.</p>
          </div>` : `
          <div class="space-y-2">
            ${minhasMats.slice().sort((a,b) => (b.matriculas[0].dataInicio||'').localeCompare(a.matriculas[0].dataInicio||'')).slice(0,10).map(s => {
              const mat   = s.matriculas[0];
              const curso = mat.comboCursos?.[0]?.nome || DB.findById('courses', mat.cursoId)?.nome || '—';
              return `<div class="flex items-center justify-between text-sm border-b border-gray-700/30 pb-2 last:border-0">
                <div class="min-w-0 flex-1">
                  <span class="text-white font-medium">${s.nome}</span>
                  <span class="text-gray-500 text-xs ml-2 truncate">${curso}</span>
                </div>
                <div class="text-right flex-shrink-0 ml-3">
                  <span class="text-primary-300 font-semibold">${Utils.currency(mat.valorFinal||mat.valorTotal||0)}</span>
                  <span class="text-gray-500 ml-2 text-xs">${Utils.formatDate(mat.dataInicio)}</span>
                </div>
              </div>`;
            }).join('')}
            ${minhasMats.length > 10 ? `<p class="text-xs text-gray-600 text-center pt-1">+ ${minhasMats.length-10} outras</p>` : ''}
          </div>`}
        </div>

        <!-- Meus leads ativos -->
        ${leadsAtivos.length > 0 ? `
        <div class="card">
          <p class="font-semibold text-white mb-3">📋 Meus Leads em Aberto <span class="text-gray-500 text-sm font-normal">(${leadsAtivos.length})</span></p>
          <div class="space-y-2">
            ${leadsAtivos.slice(0,8).map(v => `
            <div class="flex items-center justify-between text-sm border-b border-gray-700/30 pb-2 last:border-0">
              <div class="min-w-0 flex-1">
                <span class="text-white font-medium">${v.nome}</span>
                <span class="text-gray-500 text-xs ml-2">${Utils.formatPhone(v.telefone)}</span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="text-xs ${tempCores[v.temperatura||'']||'text-gray-600'}">${tempLabel[v.temperatura||'']||'—'}</span>
                <span class="text-gray-600 text-xs">${Utils.formatDate(v.createdAt)}</span>
              </div>
            </div>`).join('')}
            ${leadsAtivos.length > 8 ? `<p class="text-xs text-gray-600 text-center pt-1">+ ${leadsAtivos.length-8} outros</p>` : ''}
          </div>
        </div>` : ''}

      </div>`;
  }

  function setPeriodo(p) {
    _periodo = p;
    if (p !== 'personalizado') { _dataInicio = ''; _dataFim = ''; }
    render();
  }

  function setDataInicio(v) { _dataInicio = v; render(); }
  function setDataFim(v)    { _dataFim    = v; render(); }

  return { render, setPeriodo, setDataInicio, setDataFim };
})();
