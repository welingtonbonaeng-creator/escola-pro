/* ===== DASHBOARD ===== */
const DashboardModule = (() => {

  let charts = [];

  /* Mês selecionado (sempre 1º dia do mês) */
  const _now = new Date();
  let _mes = new Date(_now.getFullYear(), _now.getMonth(), 1);

  /* ── Navegação ── */
  function prevMes() { _mes = new Date(_mes.getFullYear(), _mes.getMonth()-1, 1); render(); }
  function nextMes() { _mes = new Date(_mes.getFullYear(), _mes.getMonth()+1, 1); render(); }
  function hojeBtn() { _mes = new Date(_now.getFullYear(), _now.getMonth(), 1); render(); }

  function render() {
    if (!Auth.can('dashboard','ver')) { App.denied(); return; }
    destroyCharts();

    const students  = DB.get('students');
    const parcelas  = DB.get('financial');
    const visits    = DB.get('visits').filter(v => v.status === 'visita');
    const freq      = DB.get('attendance');

    const hoje      = new Date();
    const mesAtual  = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const isFuture  = _mes > mesAtual;
    const isPast    = _mes < mesAtual;
    const isCurrent = !isFuture && !isPast;

    const mesStr  = `${_mes.getFullYear()}-${String(_mes.getMonth()+1).padStart(2,'0')}`;
    const mesNome = _mes.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });

    /* ── Métricas acadêmicas (sempre snapshot atual) ── */
    const ativos     = students.filter(s => s.status === 'ativo');
    const bloqueados = students.filter(s => s.status === 'bloqueado');
    const inativos   = students.filter(s => s.status === 'inativo');
    const formados   = students.filter(s => s.status === 'formado');

    /* ── Métricas financeiras do mês selecionado ── */
    /* Faturamento: pagas com dataPagamento no mês (passado/atual) | pendentes com vencimento no mês (futuro) */
    const pagasNoMes   = parcelas.filter(p => p.dataPagamento?.startsWith(mesStr));
    const vencNoMes    = parcelas.filter(p => p.vencimento?.startsWith(mesStr));
    const pendentesMes = vencNoMes.filter(p => p.status === 'pendente');
    const atrasadasMes = vencNoMes.filter(p => p.status === 'atrasado');

    const fatMes     = isFuture
      ? pendentesMes.reduce((a,p) => a+p.valor, 0)           /* receita prevista */
      : pagasNoMes.reduce((a,p) => a+p.valor, 0);             /* faturamento real */

    /* Em Atraso: parcelas ATRASADAS com vencimento ATÉ o fim do mês selecionado */
    const fimMes = new Date(_mes.getFullYear(), _mes.getMonth()+1, 0);
    const atrasadasTotal = parcelas.filter(p => {
      if (p.status !== 'atrasado') return false;
      return new Date(p.vencimento) <= fimMes;
    });
    const totalAtraso = atrasadasTotal.reduce((a,p) => a+(p.valor+(p.juros||0)), 0);

    /* Receita total esperada no mês (para projeção) */
    const receitaEsperadaMes = vencNoMes.reduce((a,p) => a+p.valor, 0);

    /* Inadimplentes */
    const inadimplentes = students.filter(s => parcelas.some(p => p.alunoId===s.id && p.status==='atrasado'));

    /* Frequência */
    const presencas = freq.filter(f => f.presente).length;
    const faltas    = freq.filter(f => !f.presente).length;
    const freqPct   = freq.length ? Math.round((presencas/freq.length)*100) : 0;

    /* Top cursos / funcionários */
    const cursoCounts = {};
    students.forEach(s => s.matriculas?.forEach(m => {
      (m.comboCursos||[{cursoId:m.cursoId}]).forEach(c => {
        if (c.cursoId) cursoCounts[c.cursoId] = (cursoCounts[c.cursoId]||0)+1;
      });
    }));
    const topCursos = Object.entries(cursoCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([id,n]) => ({ id, nome:DB.findById('courses',id)?.nome||id, n }));

    const funcCount = {};
    students.forEach(s => s.matriculas?.forEach(m => { if(m.funcionarioId) funcCount[m.funcionarioId]=(funcCount[m.funcionarioId]||0)+1; }));
    const topFunc = Object.entries(funcCount).sort((a,b)=>b[1]-a[1]).slice(0,3)
      .map(([id,n]) => ({ id, nome:DB.findById('employees',id)?.nome||id, n }));

    /* Receita mês a mês (últimos 6 meses para o gráfico) */
    const chartMeses = [];
    const chartVals  = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1);
      const ms = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const val = parcelas.filter(p=>p.dataPagamento?.startsWith(ms)).reduce((a,p)=>a+p.valor,0);
      chartMeses.push(d.toLocaleDateString('pt-BR',{month:'short'}));
      chartVals.push(parseFloat(val.toFixed(2)));
    }

    /* Indicador do período */
    const periodoLabel = isFuture
      ? `<span class="badge badge-blue">📊 Projeção</span>`
      : isCurrent
        ? `<span class="badge badge-green">📅 Mês Atual</span>`
        : `<span class="badge badge-gray">📁 Histórico</span>`;

    const fatLabel   = isFuture ? 'Receita Prevista' : 'Faturamento Real';
    const fatSub     = isFuture
      ? `${pendentesMes.length} parcela(s) no mês`
      : `Total do período: ${Utils.currency(fatMes)}`;
    const pendLabel  = isFuture ? '📅 Previsto no Mês' : '⏳ A Receber';
    const pendValue  = pendentesMes.reduce((a,p)=>a+p.valor,0);
    const pendSub    = `${pendentesMes.length} parcela(s) pendente(s)`;

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-5">

        <!-- Cabeçalho + Filtro de Período -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold text-white">Dashboard</h3>
            <p class="text-gray-400 text-xs">${hoje.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</p>
          </div>

          <!-- Navegador de mês -->
          <div class="flex items-center gap-2 bg-gray-800 border border-gray-700/50 rounded-xl px-3 py-2">
            <button onclick="DashboardModule.prevMes()" class="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-lg flex items-center justify-center transition-colors">‹</button>
            <span class="text-white font-semibold text-sm min-w-[130px] text-center capitalize">${mesNome}</span>
            <button onclick="DashboardModule.nextMes()" class="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-lg flex items-center justify-center transition-colors">›</button>
            ${!isCurrent?`<button onclick="DashboardModule.hojeBtn()" class="btn-secondary btn-sm ml-1 text-xs py-1 px-2">Hoje</button>`:''}
            <div class="ml-1">${periodoLabel}</div>
          </div>
        </div>

        ${isFuture ? `
        <!-- Banner de projeção -->
        <div class="bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span class="text-blue-300 text-sm">📊 <strong>Modo Projeção:</strong> valores baseados em parcelas previstas para este mês. Receita real pode variar.</span>
        </div>` : ''}

        ${isPast ? `
        <!-- Banner histórico -->
        <div class="bg-gray-700/30 border border-gray-600/40 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span class="text-gray-400 text-sm">📁 <strong>Histórico:</strong> dados reais do período ${mesNome}.</span>
        </div>` : ''}

        <!-- KPIs Financeiros -->
        <div>
          <p class="section-title">Financeiro ${mesNome} — clique para detalhes</p>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            ${kpiCard('💰', fatLabel, Utils.currency(fatMes), fatSub, 'border-green-500','text-green-400', `DashboardModule.openDetail('fat_mes')`)}
            ${kpiCard('🚨','Em Atraso', Utils.currency(totalAtraso), `${inadimplentes.length} aluno(s) inadimplente(s)`, 'border-red-500','text-red-400', `DashboardModule.openDetail('atrasado')`)}
            ${kpiCard(isFuture?'📅':'⏳', pendLabel, Utils.currency(pendValue), pendSub, 'border-yellow-500','text-yellow-400', `DashboardModule.openDetail('pendente')`)}
            ${isFuture
              ? kpiCard('📈','Total Esperado', Utils.currency(receitaEsperadaMes), `${vencNoMes.length} parcela(s) no mês`, 'border-primary-500','text-primary-400', `DashboardModule.openDetail('fat_mes')`)
              : kpiCard('📋','Visitas', visits.length, 'leads aguardando contato', 'border-primary-500','text-primary-400', `DashboardModule.openDetail('visitas')`)
            }
          </div>
        </div>

        <!-- KPIs Acadêmicos -->
        <div>
          <p class="section-title">Acadêmico (situação atual) — clique para detalhes</p>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            ${kpiCard('✅','Alunos Ativos',ativos.length,'matriculados','border-green-500','text-green-400',`DashboardModule.openDetail('ativos')`)}
            ${kpiCard('🔒','Bloqueados',bloqueados.length,'por inadimplência','border-red-500','text-red-400',`DashboardModule.openDetail('bloqueados')`)}
            ${kpiCard('🎓','Formados',formados.length,'cursos concluídos','border-blue-500','text-blue-400',`DashboardModule.openDetail('formados')`)}
            ${kpiCard('📈','Frequência Geral',freqPct+'%',`${presencas}P · ${faltas}F`,freqPct>=75?'border-green-500':freqPct>=50?'border-yellow-500':'border-red-500',freqPct>=75?'text-green-400':freqPct>=50?'text-yellow-400':'text-red-400',`DashboardModule.openDetail('frequencia')`)}
          </div>
        </div>

        <!-- Gráficos + Rankings -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Gráfico de rosca — situação alunos -->
          <div class="card">
            <h4 class="text-sm font-semibold text-gray-300 mb-4">Situação dos Alunos</h4>
            <canvas id="chartStatus" height="200"></canvas>
          </div>
          <!-- Gráfico de barras — receita últimos 6 meses -->
          <div class="card">
            <h4 class="text-sm font-semibold text-gray-300 mb-4">Receita — Últimos 6 Meses</h4>
            <canvas id="chartFin" height="200"></canvas>
          </div>
          <!-- Top cursos -->
          <div class="card cursor-pointer hover:border-primary-700/50 transition-colors" onclick="DashboardModule.openDetail('cursos')">
            <h4 class="text-sm font-semibold text-gray-300 mb-4">📚 Cursos Mais Vendidos <span class="text-xs text-gray-500">›</span></h4>
            <div class="space-y-3">
              ${topCursos.map((c,i) => `
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-300 truncate">${i+1}. ${c.nome}</span>
                  <span class="text-gray-400">${c.n}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill bg-primary-500" style="width:${topCursos[0].n?Math.round((c.n/topCursos[0].n)*100):0}%"></div></div>
              </div>`).join('')}
              ${!topCursos.length?'<p class="text-gray-500 text-sm">Sem dados</p>':''}
            </div>
          </div>
        </div>

        <!-- Funcionários + Auditoria + Projeção anual -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="card cursor-pointer hover:border-primary-700/50 transition-colors" onclick="DashboardModule.openDetail('funcionarios')">
            <h4 class="text-sm font-semibold text-gray-300 mb-4">👔 Desempenho Funcionários <span class="text-xs text-gray-500">›</span></h4>
            <div class="space-y-3">
              ${topFunc.map((f,i) => `
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-200">${i+1}º</div>
                <div class="flex-1">
                  <div class="text-sm text-white">${f.nome}</div>
                  <div class="progress-bar mt-1"><div class="progress-fill bg-primary-500" style="width:${topFunc[0].n?Math.round((f.n/topFunc[0].n)*100):0}%"></div></div>
                </div>
                <div class="text-sm font-bold text-primary-400">${f.n}</div>
              </div>`).join('')}
              ${!topFunc.length?'<p class="text-gray-500 text-sm">Sem dados</p>':''}
            </div>
          </div>

          <div class="card">
            <h4 class="text-sm font-semibold text-gray-300 mb-4">🕐 Atividade Recente</h4>
            <div id="auditLog"></div>
          </div>
        </div>

        ${isFuture ? `
        <!-- Projeção próximos 3 meses -->
        <div class="card">
          <h4 class="text-sm font-semibold text-gray-300 mb-4">📊 Projeção de Receita — Próximos Meses</h4>
          <div id="projecaoBlock">${_renderProjecao(parcelas, hoje)}</div>
        </div>` : ''}

      </div>`;

    Audit.renderLog(document.getElementById('auditLog'));
    _buildCharts(ativos.length, bloqueados.length, inativos.length, formados.length, chartMeses, chartVals);
  }

  /* ── Projeção de receita ── */
  function _renderProjecao(parcelas, hoje) {
    const rows = [];
    for (let i = 0; i <= 5; i++) {
      const d   = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const ms  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const nm  = d.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
      const vencMes = parcelas.filter(p => p.vencimento?.startsWith(ms));
      const prev  = vencMes.filter(p=>p.status==='pendente').reduce((a,p)=>a+p.valor,0);
      const conf  = vencMes.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
      const atr   = vencMes.filter(p=>p.status==='atrasado').reduce((a,p)=>a+p.valor+(p.juros||0),0);
      const total = prev + conf;
      const isAtual = i === 0;
      rows.push(`
      <div class="flex items-center gap-3 py-2 border-b border-gray-700/30 last:border-0 ${isAtual?'bg-primary-900/20 rounded-lg px-2':''}">
        <div class="w-28 flex-shrink-0">
          <p class="text-sm text-white font-medium capitalize">${nm.split(' ')[0]}</p>
          <p class="text-xs text-gray-500">${nm.split(' ').slice(1).join(' ')}</p>
        </div>
        <div class="flex-1 grid grid-cols-3 gap-2 text-xs">
          <div class="text-center">
            <p class="text-green-400 font-bold">${Utils.currency(conf)}</p>
            <p class="text-gray-500">Confirmado</p>
          </div>
          <div class="text-center">
            <p class="text-yellow-400 font-bold">${Utils.currency(prev)}</p>
            <p class="text-gray-500">Previsto</p>
          </div>
          <div class="text-center">
            <p class="text-primary-400 font-bold">${Utils.currency(total)}</p>
            <p class="text-gray-500">Total</p>
          </div>
        </div>
        <div class="w-24 hidden sm:block">
          <div class="progress-bar"><div class="bg-primary-500 h-full rounded-full" style="width:${total>0?Math.min(100,Math.round(conf/total*100)):0}%"></div></div>
          <p class="text-xs text-gray-500 mt-0.5 text-center">${total>0?Math.min(100,Math.round(conf/total*100)):0}% conf.</p>
        </div>
      </div>`);
    }
    return rows.join('');
  }

  /* ── KPI card ── */
  function kpiCard(icon, label, value, sub, border, color, onclick) {
    return `
    <div class="kpi-card border-l-4 ${border} cursor-pointer hover:scale-[1.02] transition-transform active:scale-[0.98]"
         onclick="${onclick}" title="Clique para detalhes">
      <div class="text-xs text-gray-400 mb-1">${icon} ${label}</div>
      <div class="kpi-value ${color}">${value}</div>
      <div class="kpi-label">${sub}</div>
      <div class="text-xs text-gray-600 mt-2">👆 ver detalhes</div>
    </div>`;
  }

  /* ── Gráficos ── */
  function _buildCharts(atv, blq, inat, form, meses, vals) {
    requestAnimationFrame(() => {
      try {
        const opts = { plugins:{ legend:{ labels:{ color:'#9ca3af', font:{size:11} } } } };
        charts.push(new Chart(document.getElementById('chartStatus').getContext('2d'), {
          type:'doughnut',
          data:{ labels:['Ativos','Bloqueados','Inativos','Formados'], datasets:[{ data:[atv,blq,inat,form], backgroundColor:['#10b981','#ef4444','#6b7280','#3b82f6'], borderWidth:0 }] },
          options:{ ...opts, cutout:'65%', onClick:(e,el)=>{ if(el.length){ const l=['ativos','bloqueados','inativo','formados']; openDetail(l[el[0].index]); } } }
        }));
        charts.push(new Chart(document.getElementById('chartFin').getContext('2d'), {
          type:'bar',
          data:{ labels:meses, datasets:[{ data:vals, backgroundColor:'#6366f1', borderRadius:5 }] },
          options:{ ...opts, plugins:{legend:{display:false}}, scales:{ y:{ ticks:{color:'#6b7280',callback:v=>'R$'+v.toLocaleString('pt-BR')}, grid:{color:'#374151'} }, x:{ ticks:{color:'#9ca3af'}, grid:{display:false} } } }
        }));
      } catch(err) { console.error(err); }
    });
  }

  /* ── Modais de detalhe ── */
  function openDetail(tipo) {
    const students = DB.get('students');
    const parcelas = DB.get('financial');
    const hoje     = new Date();
    const mesStr   = `${_mes.getFullYear()}-${String(_mes.getMonth()+1).padStart(2,'0')}`;
    const mesNome  = _mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    const isFuture = _mes > new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes   = new Date(_mes.getFullYear(), _mes.getMonth()+1, 0);

    const modais = {

      fat_mes: () => {
        const pagas   = isFuture
          ? parcelas.filter(p => p.vencimento?.startsWith(mesStr) && p.status==='pendente')
          : parcelas.filter(p => p.dataPagamento?.startsWith(mesStr));
        const total   = pagas.reduce((a,p)=>a+p.valor,0);
        const titulo  = isFuture ? `📊 Receita Prevista — ${mesNome}` : `💰 Faturamento Real — ${mesNome}`;
        const colPago = isFuture ? 'Vencimento' : 'Pago em';
        return {
          titulo,
          body:`
          <div class="mb-4 grid grid-cols-2 gap-3">
            <div class="card card-sm text-center"><div class="text-xl font-bold ${isFuture?'text-blue-400':'text-green-400'}">${Utils.currency(total)}</div><div class="text-xs text-gray-400">${isFuture?'Previsto':'Total Recebido'}</div></div>
            <div class="card card-sm text-center"><div class="text-xl font-bold text-white">${pagas.length}</div><div class="text-xs text-gray-400">Parcelas</div></div>
          </div>
          ${tableHtml(['Aluno','Parcela','Vencimento',colPago,'Forma','Valor'],
            pagas.map(p => {
              const s = DB.findById('students', p.alunoId);
              return [s?.nome||'—', `${p.numero}/${p.total}`, Utils.formatDate(p.vencimento),
                isFuture ? Utils.statusBadge(p.status) : Utils.formatDate(p.dataPagamento),
                _formaPag(p.formaPagamento),
                `<span class="${isFuture?'text-blue-400':'text-green-400'} font-bold">${Utils.currency(p.valor)}</span>`];
            })
          )}`
        };
      },

      atrasado: () => {
        const atr   = parcelas.filter(p => p.status==='atrasado' && new Date(p.vencimento)<=fimMes);
        const total = atr.reduce((a,p)=>a+(p.valor+(p.juros||0)),0);
        return {
          titulo:'🚨 Parcelas em Atraso',
          body:`
          <div class="mb-4 grid grid-cols-2 gap-3">
            <div class="card card-sm text-center"><div class="text-xl font-bold text-red-400">${Utils.currency(total)}</div><div class="text-xs text-gray-400">Total em Atraso</div></div>
            <div class="card card-sm text-center"><div class="text-xl font-bold text-red-400">${atr.length}</div><div class="text-xs text-gray-400">Parcelas</div></div>
          </div>
          ${tableHtml(['Aluno','Status','Parcela','Vencimento','Valor','Juros','Total'],
            atr.sort((a,b)=>new Date(a.vencimento)-new Date(b.vencimento)).map(p => {
              const s = DB.findById('students',p.alunoId);
              const diasAtr = Math.ceil((hoje-new Date(p.vencimento))/864e5);
              return [s?.nome||'—', Utils.statusBadge(s?.status), `${p.numero}/${p.total}`,
                `<span class="text-red-400">${Utils.formatDate(p.vencimento)}</span><br><span class="text-xs text-red-500">${diasAtr}d atraso</span>`,
                Utils.currency(p.valor), `<span class="text-red-400">${Utils.currency(p.juros||0)}</span>`,
                `<span class="text-red-400 font-bold">${Utils.currency(p.valor+(p.juros||0))}</span>`];
            })
          )}`
        };
      },

      pendente: () => {
        const pend  = parcelas.filter(p => p.vencimento?.startsWith(mesStr) && p.status==='pendente');
        const total = pend.reduce((a,p)=>a+p.valor,0);
        return {
          titulo: isFuture ? `📅 Previsto para ${mesNome}` : `⏳ Pendentes — ${mesNome}`,
          body:`
          <div class="mb-4 grid grid-cols-2 gap-3">
            <div class="card card-sm text-center"><div class="text-xl font-bold text-yellow-400">${Utils.currency(total)}</div><div class="text-xs text-gray-400">${isFuture?'Previsto':'A Receber'}</div></div>
            <div class="card card-sm text-center"><div class="text-xl font-bold text-yellow-400">${pend.length}</div><div class="text-xs text-gray-400">Parcelas</div></div>
          </div>
          ${tableHtml(['Aluno','Parcela','Vencimento','Forma','Valor'],
            pend.sort((a,b)=>new Date(a.vencimento)-new Date(b.vencimento)).map(p => {
              const s = DB.findById('students',p.alunoId);
              const diasPara = Math.ceil((new Date(p.vencimento)-hoje)/864e5);
              return [s?.nome||'—', `${p.numero}/${p.total}`,
                `${Utils.formatDate(p.vencimento)}<br><span class="text-xs text-gray-500">${diasPara>0?`em ${diasPara}d`:diasPara===0?'hoje':`${Math.abs(diasPara)}d atraso`}</span>`,
                _formaPag(p.formaPagamento),
                `<span class="text-yellow-400 font-bold">${Utils.currency(p.valor)}</span>`];
            })
          )}`
        };
      },

      visitas: () => {
        const vis = DB.get('visits').filter(v=>v.status==='visita');
        return {
          titulo:'📋 Visitas / Leads Pendentes',
          body:`
          <div class="mb-4"><span class="badge badge-yellow text-sm">${vis.length} visita(s) aguardando</span></div>
          ${tableHtml(['Nome','Idade','Telefone','E-mail','Cadastrado em'],
            vis.map(v=>[v.nome, Utils.calcAge(v.dataNascimento)+'a', Utils.formatPhone(v.telefone), v.email||'—', Utils.formatDate(v.createdAt)])
          )}`
        };
      },

      ativos: () => {
        const list = students.filter(s=>s.status==='ativo');
        return {
          titulo:'✅ Alunos Ativos',
          body: tableHtml(['Aluno','Curso','Turma','Início','Frequência'],
            list.map(s => {
              const mat  = s.matriculas?.[0];
              const curs = mat?.comboCursos?.map(c=>c.nome).join(', ') || DB.findById('courses',mat?.cursoId)?.nome||'—';
              const turm = mat ? DB.findById('grades',mat.turmaId)?.nome : '—';
              const frq  = DB.findBy('attendance','alunoId',s.id);
              const pct  = frq.length ? Math.round((frq.filter(f=>f.presente).length/frq.length)*100) : 0;
              return [s.nome, curs, turm||'—', Utils.formatDate(mat?.dataInicio),
                `<span class="${pct>=75?'text-green-400':pct>=50?'text-yellow-400':'text-red-400'} font-bold">${pct}%</span>`];
            })
          )
        };
      },

      bloqueados: () => {
        const list = students.filter(s=>s.status==='bloqueado');
        return {
          titulo:'🔒 Alunos Bloqueados',
          body: tableHtml(['Aluno','Telefone','Situação','Valor em Atraso'],
            list.map(s => {
              const atr = parcelas.filter(p=>p.alunoId===s.id&&p.status==='atrasado').reduce((a,p)=>a+(p.valor+(p.juros||0)),0);
              const sit = { parou_frequentar:'Parou de frequentar', nunca_frequentou:'Nunca frequentou', nunca_pagou:'Nunca pagou', frequenta_nao_paga:'Frequenta e não paga', spc:'SPC' };
              return [s.nome, Utils.formatPhone(s.telefone), sit[s.inadimplenciaSituacao]||'—',
                `<span class="text-red-400 font-bold">${Utils.currency(atr)}</span>`];
            })
          )
        };
      },

      formados: () => {
        const list = students.filter(s=>s.status==='formado');
        return {
          titulo:'🎓 Alunos Formados',
          body: tableHtml(['Aluno','Curso','Conclusão','Total Pago'],
            list.map(s=>{
              const mat  = s.matriculas?.[0];
              const curs = mat?.comboCursos?.map(c=>c.nome).join(', ') || DB.findById('courses',mat?.cursoId)?.nome||'—';
              const pago = parcelas.filter(p=>p.alunoId===s.id&&p.status==='pago').reduce((a,p)=>a+p.valor,0);
              return [s.nome, curs, Utils.formatDate(mat?.dataFim||s.updatedAt), `<span class="text-green-400">${Utils.currency(pago)}</span>`];
            })
          )
        };
      },

      frequencia: () => {
        const lista = students.map(s=>{
          const frq = DB.findBy('attendance','alunoId',s.id);
          const pres = frq.filter(f=>f.presente).length;
          const falt = frq.filter(f=>!f.presente).length;
          const pct  = frq.length ? Math.round((pres/frq.length)*100) : 0;
          return { s, pres, falt, pct };
        }).sort((a,b)=>a.pct-b.pct);
        return {
          titulo:'📈 Frequência — Todos os Alunos',
          body: tableHtml(['Aluno','Status','Presenças','Faltas','Frequência'],
            lista.map(({s,pres,falt,pct})=>[
              s.nome, Utils.statusBadge(s.status), pres, falt,
              `<div class="flex items-center gap-2">
                <div class="progress-bar w-16"><div class="progress-fill ${pct>=75?'bg-green-500':pct>=50?'bg-yellow-500':'bg-red-500'}" style="width:${pct}%"></div></div>
                <span class="${pct>=75?'text-green-400':pct>=50?'text-yellow-400':'text-red-400'} font-bold">${pct}%</span>
              </div>`
            ])
          )
        };
      },

      cursos: () => {
        const cursos = DB.get('courses');
        return {
          titulo:'📚 Detalhes por Curso',
          body: tableHtml(['Curso','Valor','Alunos','Ativos','Formados','Receita Total'],
            cursos.map(c=>{
              const alunos = students.filter(s=>s.matriculas?.some(m=>m.cursoId===c.id||m.comboCursos?.some(cc=>cc.cursoId===c.id)));
              const atv = alunos.filter(s=>s.status==='ativo').length;
              const frm = alunos.filter(s=>s.status==='formado').length;
              const rec = parcelas.filter(p=>p.status==='pago'&&alunos.some(s=>s.id===p.alunoId)).reduce((a,p)=>a+p.valor,0);
              return [c.nome, Utils.currency(c.valor), alunos.length, atv, frm, `<span class="text-green-400">${Utils.currency(rec)}</span>`];
            })
          )
        };
      },

      funcionarios: () => {
        const emps = DB.get('employees').filter(e=>e.id!=='emp_master');
        return {
          titulo:'👔 Desempenho por Funcionário',
          body: tableHtml(['Funcionário','Cargo','Matrículas','Receita Gerada'],
            emps.map(e=>{
              const mats = students.filter(s=>s.matriculas?.some(m=>m.funcionarioId===e.id));
              const rec  = mats.reduce((a,s)=>{
                const mp = s.matriculas?.find(m=>m.funcionarioId===e.id);
                return a+(mp?.valorFinal||mp?.valorTotal||0);
              },0);
              return [e.nome, e.cargo||'—', mats.length, `<span class="text-green-400">${Utils.currency(rec)}</span>`];
            })
          )
        };
      },
    };

    const modal = (modais[tipo] || modais['fat_mes'])();
    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-white">${modal.titulo}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        ${modal.body}
        <div class="flex justify-end mt-4">
          <button onclick="Utils.closeModal()" class="btn-secondary">Fechar</button>
        </div>
      </div>`);
  }

  /* ── Helpers ── */
  function tableHtml(headers, rows) {
    if (!rows.length) return Utils.emptyState('Nenhum registro encontrado');
    return `
    <div class="overflow-x-auto max-h-[55vh] overflow-y-auto rounded-xl border border-gray-700/50">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-gray-900">
          <tr>${headers.map(h=>`<th class="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(cells=>`
          <tr class="border-t border-gray-700/40 hover:bg-gray-700/20 transition-colors">
            ${cells.map(c=>`<td class="py-2 px-3 text-gray-200">${c}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function _formaPag(f) {
    return { pix:'Pix 🟢', cartao_debito:'Débito 💳', cartao_credito:'Crédito 💳', boleto:'Boleto 📄', dinheiro:'Dinheiro 💵', entrada:'Entrada' }[f] || f||'—';
  }

  function destroyCharts() {
    charts.forEach(c => { try { c.destroy(); } catch{} });
    charts = [];
  }

  return { render, openDetail, prevMes, nextMes, hojeBtn };
})();
