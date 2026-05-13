/* ===== MÓDULO DESEMPENHO ===== */
const PerformanceModule = (() => {

  let activeTab = 'geral';
  let _periodo  = 'mes_atual';
  let _dataInicio = '';
  let _dataFim    = '';

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const ORIGENS_LABEL = {
    instagram:'Instagram', facebook:'Facebook / Meta', whatsapp:'WhatsApp',
    indicacao:'Indicação', olx:'OLX', plantao:'Plantão', google:'Google',
    site:'Site', outro:'Outro'
  };

  /* ── Range ── */
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
    const d = (date||'').slice(0,10);
    return d >= range.from && d <= range.to;
  }

  function _currentMes() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  }

  /* ── Metas helpers ── */
  function _metaEscola(mes) {
    return DB.get('goals').find(g => g.tipo === 'escola' && g.mes === mes) || { metaReceita:0, metaMatriculas:0 };
  }
  function _metaFunc(funcId, mes) {
    return DB.get('goals').find(g => g.tipo === 'funcionario' && g.funcionarioId === funcId && g.mes === mes) || { metaMatriculas:0, metaReceita:0 };
  }

  /* ── RENDER ── */
  function render() {
    if (!Auth.can('financeiro','ver') && !Auth.can('alunos','ver')) { App.denied(); return; }

    /* Funcionários não-admin só acessam suas próprias abas */
    if (Auth.isEmployee && activeTab === 'geral') activeTab = 'comercial';

    const range = _getRange();

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <h3 class="text-xl font-bold text-white">📊 Desempenho${Auth.isEmployee ? ' — ' + (Auth.currentUser?.nome || '') : ''}</h3>

        <!-- Filtro de período -->
        <div class="flex flex-wrap gap-2 items-center">
          ${['semana','mes_atual','mes_anterior','personalizado'].map(p => {
            const lbl = {semana:'📅 Semana',mes_atual:'📆 Este Mês',mes_anterior:'◀ Mês Anterior',personalizado:'🗓️ Período'}[p];
            return `<button onclick="PerformanceModule.setPeriodo('${p}')" class="tab-btn ${_periodo===p?'active':''}">${lbl}</button>`;
          }).join('')}
          ${_periodo==='personalizado'?`
          <input type="date" value="${_dataInicio}" onchange="PerformanceModule.setDataInicio(this.value)" class="input-field py-1.5 text-sm w-36">
          <span class="text-gray-500 text-sm">até</span>
          <input type="date" value="${_dataFim}" onchange="PerformanceModule.setDataFim(this.value)" class="input-field py-1.5 text-sm w-36">`:''}
        </div>

        <!-- Sub-tabs -->
        <div class="tab-bar">
          ${!Auth.isEmployee ? `<button class="tab-btn ${activeTab==='geral'?'active':''}" onclick="PerformanceModule.setTab('geral')">🏫 Geral</button>` : ''}
          <button class="tab-btn ${activeTab==='comercial'?'active':''}" onclick="PerformanceModule.setTab('comercial')">🤝 ${Auth.isEmployee ? 'Minhas Vendas' : 'Comercial'}</button>
          <button class="tab-btn ${activeTab==='metas'?'active':''}"     onclick="PerformanceModule.setTab('metas')">🎯 ${Auth.isEmployee ? 'Minhas Metas' : 'Metas'}</button>
        </div>

        <div id="perfContent">
          ${activeTab==='geral' ? _renderGeral(range) : activeTab==='comercial' ? _renderComercial(range) : _renderMetas()}
        </div>
      </div>`;
  }

  /* ══════════════ GERAL ══════════════ */
  function _renderGeral(range) {
    const financial = DB.get('financial');
    const students  = DB.get('students');
    const mes       = _currentMes();
    const meta      = _metaEscola(mes);
    const hoje      = new Date();

    /* KPIs do período */
    const pago      = financial.filter(p => p.status==='pago' && _inRange(p.dataPagamento, range)).reduce((a,p)=>a+p.valor,0);
    const aReceber  = financial.filter(p => p.status==='pendente').reduce((a,p)=>a+p.valor,0);
    const emAtraso  = financial.filter(p => p.status==='atrasado').reduce((a,p)=>a+(p.valor+(p.juros||0)),0);
    const matsRange = students.filter(s => s.matriculas?.[0] && _inRange(s.matriculas[0].dataInicio, range));
    const ticket    = matsRange.length ? matsRange.reduce((a,s)=>a+(s.matriculas[0].valorFinal||s.matriculas[0].valorTotal||0),0)/matsRange.length : 0;

    /* Inadimplência global */
    const totalEsperado = financial.filter(p=>p.tipo!=='entrada'||p.numero!==0).reduce((a,p)=>a+p.valor,0);
    const inadPct = totalEsperado > 0 ? Math.round((emAtraso/totalEsperado)*100) : 0;

    /* Meta mensal */
    const metaPago  = financial.filter(p=>p.status==='pago'&&p.dataPagamento?.startsWith(mes)).reduce((a,p)=>a+p.valor,0);
    const metaPct   = meta.metaReceita > 0 ? Math.min(100, Math.round((metaPago/meta.metaReceita)*100)) : 0;
    const metaFalta = meta.metaReceita > 0 ? Math.max(0, meta.metaReceita - metaPago) : 0;
    const matsMes   = students.filter(s=>s.matriculas?.[0]&&s.matriculas[0].dataInicio?.startsWith(mes)).length;
    const matMetaPct = meta.metaMatriculas > 0 ? Math.min(100, Math.round((matsMes/meta.metaMatriculas)*100)) : 0;

    /* Projeção 6 meses */
    const projecao = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth()+i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const pagoMes    = financial.filter(p=>p.status==='pago'&&p.dataPagamento?.startsWith(mk)).reduce((a,p)=>a+p.valor,0);
      const prevMes    = financial.filter(p=>p.status==='pendente'&&p.vencimento?.startsWith(mk)).reduce((a,p)=>a+p.valor,0);
      projecao.push({ lbl:`${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, pago:pagoMes, prev:prevMes, total:pagoMes+prevMes, atual:i===0 });
    }
    const maxProj = Math.max(...projecao.map(p=>p.total), 1);

    return `
      <!-- KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div class="kpi-card">
          <div class="text-green-400 text-xs font-semibold uppercase mb-1">💰 Faturado</div>
          <div class="kpi-value text-green-400">${Utils.currency(pago)}</div>
          <div class="text-xs text-gray-500 mt-1">${matsRange.length} matrículas no período</div>
        </div>
        <div class="kpi-card">
          <div class="text-yellow-400 text-xs font-semibold uppercase mb-1">⏳ A Receber</div>
          <div class="kpi-value text-yellow-400">${Utils.currency(aReceber)}</div>
          <div class="text-xs text-gray-500 mt-1">parcelas futuras</div>
        </div>
        <div class="kpi-card">
          <div class="text-red-400 text-xs font-semibold uppercase mb-1">🚨 Em Atraso</div>
          <div class="kpi-value text-red-400">${Utils.currency(emAtraso)}</div>
          <div class="text-xs text-gray-500 mt-1">índice ${inadPct}%</div>
        </div>
        <div class="kpi-card">
          <div class="text-blue-400 text-xs font-semibold uppercase mb-1">🎟️ Ticket Médio</div>
          <div class="kpi-value text-blue-400">${Utils.currency(ticket)}</div>
          <div class="text-xs text-gray-500 mt-1">por matrícula</div>
        </div>
      </div>

      <!-- Meta do Mês -->
      ${meta.metaReceita > 0 || meta.metaMatriculas > 0 ? `
      <div class="card mb-4">
        <p class="font-semibold text-white mb-4">🎯 Meta — ${MESES[hoje.getMonth()]} ${hoje.getFullYear()}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${meta.metaReceita > 0 ? `
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-gray-400 text-sm">Receita</span>
              <span class="text-xs ${metaPct>=100?'text-green-400':'text-gray-400'}">${Utils.currency(metaPago)} / ${Utils.currency(meta.metaReceita)}</span>
            </div>
            <div class="progress-bar h-3 mb-1"><div class="progress-fill ${metaPct>=100?'bg-green-500':metaPct>=70?'bg-yellow-500':'bg-red-500'}" style="width:${metaPct}%"></div></div>
            <div class="flex justify-between">
              <span class="text-xs ${metaPct>=100?'text-green-400':'text-gray-500'}">${metaPct>=100?'✅ Meta atingida!':'Faltam '+Utils.currency(metaFalta)}</span>
              <span class="text-white font-bold text-sm">${metaPct}%</span>
            </div>
          </div>` : ''}
          ${meta.metaMatriculas > 0 ? `
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-gray-400 text-sm">Matrículas</span>
              <span class="text-xs ${matMetaPct>=100?'text-green-400':'text-gray-400'}">${matsMes} / ${meta.metaMatriculas}</span>
            </div>
            <div class="progress-bar h-3 mb-1"><div class="progress-fill ${matMetaPct>=100?'bg-green-500':matMetaPct>=70?'bg-yellow-500':'bg-red-500'}" style="width:${matMetaPct}%"></div></div>
            <div class="flex justify-between">
              <span class="text-xs ${matMetaPct>=100?'text-green-400':'text-gray-500'}">${matMetaPct>=100?'✅ Meta atingida!':'Faltam '+(meta.metaMatriculas-matsMes)+' matrículas'}</span>
              <span class="text-white font-bold text-sm">${matMetaPct}%</span>
            </div>
          </div>` : ''}
        </div>
      </div>` : `
      <div class="card mb-4 border border-dashed border-gray-600 text-center py-5">
        <p class="text-gray-500 text-sm">Sem meta definida para este mês.</p>
        <button onclick="PerformanceModule.setTab('metas')" class="btn-ghost btn-sm mt-2">Definir metas →</button>
      </div>`}

      <!-- Matrículas no período -->
      <div class="card mb-4">
        <p class="font-semibold text-white mb-3">🎓 Matrículas no Período (${matsRange.length})</p>
        ${matsRange.length === 0 ? Utils.emptyState('Nenhuma matrícula neste período') : `
        <div class="space-y-2">
          ${matsRange.slice(0,8).map(s => {
            const mat   = s.matriculas[0];
            const curso = mat.comboCursos?.[0]?.nome || DB.findById('courses', mat.cursoId)?.nome || '—';
            const func  = mat.funcionarioId ? DB.findById('employees', mat.funcionarioId) : null;
            return `<div class="flex items-center justify-between text-sm border-b border-gray-700/30 pb-2 last:border-0">
              <div>
                <span class="text-white font-medium">${s.nome}</span>
                <span class="text-gray-500 text-xs ml-2">${curso}</span>
                ${func?`<span class="text-gray-600 text-xs ml-2">· ${func.nome}</span>`:''}
              </div>
              <div class="text-right flex-shrink-0">
                <span class="text-primary-300 font-semibold">${Utils.currency(mat.valorFinal||mat.valorTotal||0)}</span>
                <span class="text-gray-500 ml-2 text-xs">${Utils.formatDate(mat.dataInicio)}</span>
              </div>
            </div>`;
          }).join('')}
          ${matsRange.length > 8 ? `<p class="text-xs text-gray-600 text-center pt-1">+ ${matsRange.length-8} outras</p>` : ''}
        </div>`}
      </div>

      <!-- Inadimplência -->
      <div class="card mb-4">
        <p class="font-semibold text-white mb-3">⚠️ Índice de Inadimplência</p>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="bg-red-900/20 rounded-xl p-3">
            <div class="text-2xl font-bold text-red-400">${inadPct}%</div>
            <div class="text-xs text-gray-400 mt-1">Índice</div>
          </div>
          <div class="bg-gray-700/30 rounded-xl p-3">
            <div class="text-2xl font-bold text-white">${Utils.currency(emAtraso)}</div>
            <div class="text-xs text-gray-400 mt-1">Em atraso</div>
          </div>
          <div class="bg-gray-700/30 rounded-xl p-3">
            <div class="text-2xl font-bold text-white">${DB.get('students').filter(s=>DB.get('financial').some(p=>p.alunoId===s.id&&p.status==='atrasado')).length}</div>
            <div class="text-xs text-gray-400 mt-1">Inadimplentes</div>
          </div>
        </div>
      </div>

      <!-- Projeção de Receita -->
      <div class="card">
        <p class="font-semibold text-white mb-4">📈 Projeção de Receita — Próximos 6 Meses</p>
        <div class="space-y-3">
          ${projecao.map(p => `
          <div class="flex items-center gap-3">
            <span class="text-xs w-12 flex-shrink-0 font-medium ${p.atual?'text-primary-300':'text-gray-400'}">${p.lbl}</span>
            <div class="flex-1 relative h-6 bg-gray-700/40 rounded overflow-hidden">
              <div class="absolute top-0 left-0 h-full bg-primary-700/50 rounded transition-all" style="width:${maxProj>0?Math.round((p.total/maxProj)*100):0}%"></div>
              <div class="absolute top-0 left-0 h-full bg-green-500/70 rounded transition-all" style="width:${maxProj>0?Math.round((p.pago/maxProj)*100):0}%"></div>
            </div>
            <span class="text-white text-xs font-semibold w-28 text-right flex-shrink-0">
              ${Utils.currency(p.total)}
              ${p.pago > 0 && p.total > p.pago ? `<span class="text-green-400"> (${Utils.currency(p.pago)}✓)</span>` : ''}
            </span>
          </div>`).join('')}
        </div>
        <div class="flex gap-4 mt-3 text-xs text-gray-500">
          <span><span class="inline-block w-3 h-3 rounded bg-green-500/70 mr-1 align-middle"></span>Recebido</span>
          <span><span class="inline-block w-3 h-3 rounded bg-primary-700/50 mr-1 align-middle"></span>Previsto total</span>
        </div>
      </div>`;
  }

  /* ══════════════ COMERCIAL ══════════════ */
  function _renderComercial(range) {
    const visits    = DB.get('visits');
    const students  = DB.get('students');
    const mes       = _currentMes();
    const empId     = Auth.currentUser?.id;
    const isEmp     = Auth.isEmployee;

    /* Para funcionários não-admin, filtra apenas os próprios leads */
    const allEmployees = DB.get('employees').filter(e=>e.ativo!==false);
    const employees    = isEmp ? allEmployees.filter(e=>e.id===empId) : allEmployees;

    const leadsRange = visits.filter(v =>
      _inRange(v.createdAt, range) && (!isEmp || v.vendedorId === empId)
    );
    const convertidosRange = visits.filter(v =>
      v.status==='aluno' && _inRange(v.convertidoEm||v.createdAt, range) && (!isEmp || v.vendedorId === empId)
    );

    const totalLeads = leadsRange.length;
    const totalConv  = convertidosRange.length;
    const convGlobal = totalLeads > 0 ? Math.round((totalConv/totalLeads)*100) : 0;

    /* Origem dos leads no período */
    const origemMap = {};
    leadsRange.forEach(v => { const o=v.origem||'outro'; origemMap[o]=(origemMap[o]||0)+1; });

    /* Por vendedor/atendente */
    const empRows = employees.map(emp => {
      const visEmp  = leadsRange.filter(v=>v.vendedorId===emp.id);
      const convEmp = convertidosRange.filter(v=>v.vendedorId===emp.id);
      const matsEmp = students.filter(s=>s.matriculas?.[0]?.funcionarioId===emp.id&&_inRange(s.matriculas[0].dataInicio,range));
      const recEmp  = matsEmp.reduce((a,s)=>a+(s.matriculas[0].valorFinal||s.matriculas[0].valorTotal||0),0);
      const conv    = visEmp.length > 0 ? Math.round((convEmp.length/visEmp.length)*100) : 0;
      const metaE   = _metaFunc(emp.id, mes);
      const metaPct = metaE.metaMatriculas > 0 ? Math.round((matsEmp.length/metaE.metaMatriculas)*100) : null;
      return { emp, visEmp:visEmp.length, convEmp:convEmp.length, matsEmp:matsEmp.length, recEmp, conv, metaE, metaPct };
    }).filter(r=>r.visEmp>0||r.matsEmp>0);

    /* Geradores (free text) — leads gerados + conversão */
    const gerMap = {};
    leadsRange.forEach(v => {
      if (!v.geradorNome) return;
      if (!gerMap[v.geradorNome]) gerMap[v.geradorNome] = { total:0, conv:0 };
      gerMap[v.geradorNome].total++;
      if (v.status==='aluno') gerMap[v.geradorNome].conv++;
    });

    return `
      <!-- Funil Geral -->
      <div class="card mb-4">
        <p class="font-semibold text-white mb-4">📊 Funil de Conversão no Período</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
          <div class="p-3 bg-gray-700/30 rounded-xl">
            <div class="text-3xl font-bold text-white">${totalLeads}</div>
            <div class="text-xs text-gray-400 mt-1">Leads Cadastrados</div>
          </div>
          <div class="p-3 bg-gray-700/30 rounded-xl">
            <div class="text-3xl font-bold text-green-400">${totalConv}</div>
            <div class="text-xs text-gray-400 mt-1">Convertidos em Aluno</div>
          </div>
          <div class="col-span-2 sm:col-span-1 p-3 bg-primary-900/40 border border-primary-700/30 rounded-xl">
            <div class="text-3xl font-bold text-primary-300">${convGlobal}%</div>
            <div class="text-xs text-gray-400 mt-1">Taxa de Conversão</div>
          </div>
        </div>
        ${totalLeads > 0 ? `
        <div class="mt-4">
          <div class="flex justify-between text-xs text-gray-500 mb-1"><span>0</span><span>Leads → Alunos</span><span>${totalLeads}</span></div>
          <div class="progress-bar h-4 relative">
            <div class="progress-fill bg-primary-600 h-full" style="width:100%"></div>
            <div class="absolute top-0 left-0 h-full bg-green-500" style="width:${convGlobal}%"></div>
          </div>
          <div class="flex gap-4 mt-1 text-xs text-gray-500">
            <span><span class="inline-block w-2 h-2 rounded bg-primary-600 mr-1 align-middle"></span>Total leads</span>
            <span><span class="inline-block w-2 h-2 rounded bg-green-500 mr-1 align-middle"></span>Convertidos</span>
          </div>
        </div>` : ''}
      </div>

      <!-- Origem dos Leads -->
      ${Object.keys(origemMap).length > 0 ? `
      <div class="card mb-4">
        <p class="font-semibold text-white mb-3">📍 Origem dos Leads</p>
        <div class="space-y-2">
          ${Object.entries(origemMap).sort((a,b)=>b[1]-a[1]).map(([o,n]) => {
            const pct = totalLeads > 0 ? Math.round((n/totalLeads)*100) : 0;
            return `<div class="flex items-center gap-3">
              <span class="text-gray-300 text-sm w-28 flex-shrink-0">${ORIGENS_LABEL[o]||o}</span>
              <div class="flex-1 progress-bar h-4"><div class="progress-fill bg-primary-500" style="width:${pct}%"></div></div>
              <span class="text-white text-xs font-semibold w-6 text-right">${n}</span>
              <span class="text-gray-500 text-xs w-8">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Por Vendedor / Atendente -->
      <div class="card mb-4">
        <p class="font-semibold text-white mb-3">🏆 ${isEmp ? 'Meu Desempenho' : 'Desempenho por Vendedor/Atendente'}</p>
        ${empRows.length === 0 ? `<p class="text-gray-500 text-sm text-center py-4">Nenhum dado no período.<br><span class="text-xs">Certifique-se de vincular visitas e matrículas aos funcionários.</span></p>` : `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="table-header">
              <th class="text-left">Funcionário</th>
              <th class="text-center">Leads</th>
              <th class="text-center">Convertidos</th>
              <th class="text-center">Matrículas</th>
              <th class="text-center hidden sm:table-cell">Conversão</th>
              <th class="text-right hidden md:table-cell">Receita</th>
              <th class="text-center hidden lg:table-cell">Meta</th>
            </tr></thead>
            <tbody>
              ${empRows.map(r=>`
              <tr class="table-row">
                <td>
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-200 flex-shrink-0">${Utils.initials(r.emp.nome)}</div>
                    <span class="text-white font-medium">${r.emp.nome}</span>
                  </div>
                </td>
                <td class="text-center text-gray-300">${r.visEmp}</td>
                <td class="text-center text-green-400 font-semibold">${r.convEmp}</td>
                <td class="text-center">
                  <span class="text-primary-300 font-bold">${r.matsEmp}</span>
                </td>
                <td class="text-center hidden sm:table-cell">
                  <span class="badge ${r.conv>=50?'badge-green':r.conv>=25?'badge-yellow':'badge-red'}">${r.conv}%</span>
                </td>
                <td class="text-right hidden md:table-cell text-primary-300 font-semibold">${Utils.currency(r.recEmp)}</td>
                <td class="text-center hidden lg:table-cell">
                  ${r.metaPct!==null ? `
                  <div class="flex items-center gap-1 justify-center">
                    <div class="progress-bar w-14 h-2"><div class="progress-fill ${r.metaPct>=100?'bg-green-500':'bg-primary-500'}" style="width:${Math.min(100,r.metaPct)}%"></div></div>
                    <span class="text-xs ${r.metaPct>=100?'text-green-400':'text-gray-400'}">${r.matsEmp}/${r.metaE.metaMatriculas}</span>
                  </div>` : '<span class="text-gray-700 text-xs">—</span>'}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>

      <!-- Geradores de Lead -->
      ${Object.keys(gerMap).length > 0 ? `
      <div class="card">
        <p class="font-semibold text-white mb-3">🌟 Geradores / Captadores</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="table-header">
              <th class="text-left">Nome</th>
              <th class="text-center">Leads</th>
              <th class="text-center">Convertidos</th>
              <th class="text-center">Taxa</th>
            </tr></thead>
            <tbody>
              ${Object.entries(gerMap).sort((a,b)=>b[1].total-a[1].total).map(([nome,d])=>`
              <tr class="table-row">
                <td class="text-white font-medium">${nome}</td>
                <td class="text-center text-gray-300">${d.total}</td>
                <td class="text-center text-green-400 font-semibold">${d.conv}</td>
                <td class="text-center">
                  <span class="badge ${d.total>0&&Math.round((d.conv/d.total)*100)>=50?'badge-green':d.total>0&&Math.round((d.conv/d.total)*100)>=25?'badge-yellow':'badge-gray'}">
                    ${d.total>0?Math.round((d.conv/d.total)*100):0}%
                  </span>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}`;
  }

  /* ══════════════ METAS ══════════════ */
  function _renderMetas() {
    const mes       = _currentMes();
    const d         = new Date();
    const mesLabel  = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    const meta      = _metaEscola(mes);
    const isEmp     = Auth.isEmployee;
    const allEmployees = DB.get('employees').filter(e=>e.ativo!==false);
    const employees = isEmp ? allEmployees.filter(e=>e.id===Auth.currentUser?.id) : allEmployees;

    /* Funcionário não-admin vê apenas a própria meta (somente leitura) */
    if (isEmp) {
      const emp = employees[0];
      if (!emp) return Utils.emptyState('Funcionário não encontrado');
      const me = _metaFunc(emp.id, mes);
      const matsMes = DB.get('students').filter(s=>s.matriculas?.[0]?.funcionarioId===emp.id&&s.matriculas[0].dataInicio?.startsWith(mes)).length;
      const recMes  = DB.get('students').filter(s=>s.matriculas?.[0]?.funcionarioId===emp.id&&s.matriculas[0].dataInicio?.startsWith(mes))
                        .reduce((a,s)=>a+(s.matriculas[0].valorFinal||s.matriculas[0].valorTotal||0),0);
      const matPct  = me.metaMatriculas > 0 ? Math.min(100,Math.round((matsMes/me.metaMatriculas)*100)) : 0;
      const recPct  = me.metaReceita   > 0 ? Math.min(100,Math.round((recMes/me.metaReceita)*100))   : 0;
      return `
        <div class="card">
          <div class="flex items-center gap-3 mb-5">
            <div class="w-10 h-10 rounded-full bg-primary-800 flex items-center justify-center font-bold text-primary-200">${Utils.initials(emp.nome)}</div>
            <div>
              <p class="font-semibold text-white">${emp.nome}</p>
              <p class="text-xs text-gray-400">${emp.cargo||'Funcionário'} · ${mesLabel}</p>
            </div>
          </div>
          ${me.metaMatriculas > 0 || me.metaReceita > 0 ? `
          <div class="space-y-5">
            ${me.metaMatriculas > 0 ? `
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-300 text-sm font-medium">🎓 Matrículas</span>
                <span class="text-xs ${matPct>=100?'text-green-400':'text-gray-400'}">${matsMes} / ${me.metaMatriculas}</span>
              </div>
              <div class="progress-bar h-4 mb-1"><div class="progress-fill ${matPct>=100?'bg-green-500':matPct>=70?'bg-yellow-500':'bg-red-500'}" style="width:${matPct}%"></div></div>
              <div class="flex justify-between">
                <span class="text-xs ${matPct>=100?'text-green-400':'text-gray-500'}">${matPct>=100?'✅ Meta atingida!':'Faltam '+(me.metaMatriculas-matsMes)+' matrículas'}</span>
                <span class="text-white font-bold text-sm">${matPct}%</span>
              </div>
            </div>` : ''}
            ${me.metaReceita > 0 ? `
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-300 text-sm font-medium">💰 Receita</span>
                <span class="text-xs ${recPct>=100?'text-green-400':'text-gray-400'}">${Utils.currency(recMes)} / ${Utils.currency(me.metaReceita)}</span>
              </div>
              <div class="progress-bar h-4 mb-1"><div class="progress-fill ${recPct>=100?'bg-green-500':recPct>=70?'bg-yellow-500':'bg-red-500'}" style="width:${recPct}%"></div></div>
              <div class="flex justify-between">
                <span class="text-xs ${recPct>=100?'text-green-400':'text-gray-500'}">${recPct>=100?'✅ Meta atingida!':'Faltam '+Utils.currency(me.metaReceita-recMes)}</span>
                <span class="text-white font-bold text-sm">${recPct}%</span>
              </div>
            </div>` : ''}
          </div>` : `
          <div class="text-center py-6 border border-dashed border-gray-600 rounded-xl">
            <p class="text-gray-500 text-sm">Nenhuma meta definida para este mês.</p>
            <p class="text-xs text-gray-600 mt-1">Fale com o administrador para definir suas metas.</p>
          </div>`}
        </div>`;
    }

    return `
      <!-- Meta Geral da Escola -->
      <div class="card mb-4">
        <p class="font-semibold text-white mb-4">🏫 Meta da Escola — ${mesLabel}</p>
        <form onsubmit="PerformanceModule.saveMetaEscola(event)" class="space-y-4">
          <input type="hidden" name="mes" value="${mes}">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="form-label">Meta de Receita (R$)</label>
              <div class="relative">
                <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                <input type="text" inputmode="decimal" name="metaReceita" class="input-field pl-8"
                  value="${meta.metaReceita > 0 ? meta.metaReceita.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}"
                  placeholder="Ex: 5.000,00">
              </div>
            </div>
            <div>
              <label class="form-label">Meta de Matrículas</label>
              <input type="number" name="metaMatriculas" min="0" class="input-field"
                value="${meta.metaMatriculas||''}" placeholder="Ex: 10">
            </div>
          </div>
          <div class="flex justify-end">
            <button type="submit" class="btn-primary">💾 Salvar Meta da Escola</button>
          </div>
        </form>
      </div>

      <!-- Metas por Funcionário -->
      <div class="card">
        <p class="font-semibold text-white mb-4">👥 Metas por Funcionário — ${mesLabel}</p>
        ${!allEmployees.length ? Utils.emptyState('Nenhum funcionário cadastrado') : `
        <div class="space-y-3">
          ${allEmployees.map(emp => {
            const me = _metaFunc(emp.id, mes);
            return `
            <div class="border border-gray-700/40 rounded-xl p-4">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-200 flex-shrink-0">${Utils.initials(emp.nome)}</div>
                <div>
                  <span class="font-medium text-white">${emp.nome}</span>
                  <span class="text-gray-500 text-xs ml-2">${emp.cargo||'Funcionário'}</span>
                </div>
              </div>
              <form onsubmit="PerformanceModule.saveMetaFuncionario('${emp.id}','${mes}',event)" class="grid grid-cols-2 gap-3">
                <div>
                  <label class="form-label">Meta de Matrículas</label>
                  <input type="number" name="metaMatriculas" min="0" class="input-field" value="${me.metaMatriculas||''}" placeholder="0">
                </div>
                <div>
                  <label class="form-label">Meta de Receita</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-400 text-xs">R$</span>
                    <input type="text" inputmode="decimal" name="metaReceita" class="input-field pl-8"
                      value="${me.metaReceita > 0 ? me.metaReceita.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}"
                      placeholder="0,00">
                  </div>
                </div>
                <div class="col-span-2 flex justify-end">
                  <button type="submit" class="btn-primary btn-sm">Salvar</button>
                </div>
              </form>
            </div>`;
          }).join('')}
        </div>`}
      </div>`;
  }

  /* ── Ações ── */
  function setTab(t) { activeTab = t; render(); }

  function setPeriodo(p) {
    _periodo = p;
    if (p !== 'personalizado') { _dataInicio = ''; _dataFim = ''; }
    render();
  }

  function setDataInicio(v) { _dataInicio = v; render(); }
  function setDataFim(v)    { _dataFim    = v; render(); }

  function saveMetaEscola(e) {
    e.preventDefault();
    const d   = Utils.formData(e.target);
    const mes = d.mes || _currentMes();
    const existing = DB.get('goals').find(g=>g.tipo==='escola'&&g.mes===mes);
    DB.save('goals', { id:existing?.id||undefined, tipo:'escola', mes, metaReceita:Utils.parseBRL(d.metaReceita), metaMatriculas:parseInt(d.metaMatriculas)||0 });
    Utils.showToast('Meta da escola salva!','success');
    render();
  }

  function saveMetaFuncionario(funcId, mes, e) {
    e.preventDefault();
    const d = Utils.formData(e.target);
    const existing = DB.get('goals').find(g=>g.tipo==='funcionario'&&g.funcionarioId===funcId&&g.mes===mes);
    DB.save('goals', { id:existing?.id||undefined, tipo:'funcionario', funcionarioId:funcId, mes, metaMatriculas:parseInt(d.metaMatriculas)||0, metaReceita:Utils.parseBRL(d.metaReceita) });
    Utils.showToast('Meta salva!','success');
    render();
  }

  return { render, setTab, setPeriodo, setDataInicio, setDataFim, saveMetaEscola, saveMetaFuncionario };
})();
