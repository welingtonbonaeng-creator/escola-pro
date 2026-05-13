/* ===== MÓDULO FINANCEIRO ===== */
const FinancialModule = (() => {

  let activeTab = 'todos';

  function render() {
    if (!Auth.can('financeiro','ver')) { App.denied(); return; }
    const all = DB.get('students');
    const parcelas = DB.get('financial');
    const atrasados = all.filter(s => parcelas.some(p => p.alunoId===s.id && p.status==='atrasado'));
    const emDia = all.filter(s => s.status==='ativo' && !parcelas.some(p=>p.alunoId===s.id&&p.status==='atrasado'));

    // Totais
    const recebido = parcelas.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
    const pendente  = parcelas.filter(p=>p.status==='pendente').reduce((a,p)=>a+p.valor,0);
    const atrasado  = parcelas.filter(p=>p.status==='atrasado').reduce((a,p)=>a+(p.valor+p.juros),0);

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <h3 class="text-xl font-bold text-white">Financeiro / Inadimplência</h3>

        <!-- KPIs -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="kpi-card">
            <div class="text-green-400 text-xs font-semibold uppercase mb-1">💰 Recebido</div>
            <div class="kpi-value text-green-400">${Utils.currency(recebido)}</div>
          </div>
          <div class="kpi-card">
            <div class="text-yellow-400 text-xs font-semibold uppercase mb-1">⏳ Pendente</div>
            <div class="kpi-value text-yellow-400">${Utils.currency(pendente)}</div>
          </div>
          <div class="kpi-card">
            <div class="text-red-400 text-xs font-semibold uppercase mb-1">🚨 Em Atraso</div>
            <div class="kpi-value text-red-400">${Utils.currency(atrasado)}</div>
          </div>
          <div class="kpi-card">
            <div class="text-gray-400 text-xs font-semibold uppercase mb-1">👥 Inadimplentes</div>
            <div class="kpi-value">${atrasados.length}</div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="tab-bar">
          <button class="tab-btn ${activeTab==='todos'?'active':''}"        onclick="FinancialModule.setTab('todos')">Todos (${all.length})</button>
          <button class="tab-btn ${activeTab==='inadimplente'?'active':''}" onclick="FinancialModule.setTab('inadimplente')">🚨 Inadimplentes (${atrasados.length})</button>
          <button class="tab-btn ${activeTab==='em_dia'?'active':''}"       onclick="FinancialModule.setTab('em_dia')">✅ Em Dia (${emDia.length})</button>
        </div>

        <div class="relative">
          <input type="text" placeholder="Buscar aluno…"
            class="input-field w-full pl-10" oninput="FinancialModule.search(this.value)">
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>

        <div id="financialList">
          ${renderList(getFiltered())}
        </div>
      </div>`;
  }

  function setTab(t) { activeTab = t; render(); }

  function getFiltered() {
    const all = DB.get('students');
    const parcelas = DB.get('financial');
    if (activeTab==='inadimplente') return all.filter(s=>parcelas.some(p=>p.alunoId===s.id&&p.status==='atrasado'));
    if (activeTab==='em_dia') return all.filter(s=>s.status==='ativo'&&!parcelas.some(p=>p.alunoId===s.id&&p.status==='atrasado'));
    return all;
  }

  function renderList(students) {
    if (!students.length) return Utils.emptyState('Nenhum aluno nesta categoria');
    const parcelas = DB.get('financial');
    return `
      <div class="space-y-2">
        ${students.map(s => {
          const ps = parcelas.filter(p=>p.alunoId===s.id);
          const pago    = ps.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
          const atrasado= ps.filter(p=>p.status==='atrasado').reduce((a,p)=>a+(p.valor+(p.juros||0)),0);
          const pendente= ps.filter(p=>p.status==='pendente').reduce((a,p)=>a+p.valor,0);
          const mat = s.matriculas?.[0];
          const curso = mat ? DB.findById('courses', mat.cursoId) : null;
          const inadimplente = ps.some(p=>p.status==='atrasado');
          return `
          <div class="card ${inadimplente?'border-red-900/50 bg-red-950/10':''}">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-white">${s.nome}</span>
                  ${Utils.statusBadge(s.status)}
                  ${inadimplente?'<span class="badge badge-red">⚠️ Inadimplente</span>':''}
                  ${s.statusFinanceiro==='SPC'?'<span class="badge badge-red">🔴 SPC</span>':''}
                </div>
                <div class="text-xs text-gray-400 mt-1">${curso?.nome||'Sem curso'} · ${Utils.formatPhone(s.telefone)}</div>
                ${s.inadimplenciaSituacao?`<div class="text-xs text-red-400 mt-0.5">Situação: ${_situacaoLabel(s.inadimplenciaSituacao)}</div>`:''}
              </div>
              <div class="flex items-center gap-4 text-sm">
                <div class="text-center"><div class="text-green-400 font-bold">${Utils.currency(pago)}</div><div class="text-xs text-gray-500">Pago</div></div>
                <div class="text-center"><div class="text-yellow-400 font-bold">${Utils.currency(pendente)}</div><div class="text-xs text-gray-500">Pendente</div></div>
                ${atrasado>0?`<div class="text-center"><div class="text-red-400 font-bold">${Utils.currency(atrasado)}</div><div class="text-xs text-gray-500">Em Atraso</div></div>`:''}
                <div class="flex gap-1">
                  <button onclick="FinancialModule.openDetail('${s.id}')" class="btn-ghost btn-sm">💳 Detalhe</button>
                  ${inadimplente && Auth.can('financeiro','editar')?`<button onclick="FinancialModule.toggleBlock('${s.id}')" class="btn-danger btn-sm" title="${s.status==='bloqueado'?'Desbloquear':'Bloquear'}">${s.status==='bloqueado'?'🔓':'🔒'}</button>`:''}
                </div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function openDetail(id) {
    const s = DB.findById('students', id);
    if (!s) return;
    const allParcelas  = DB.get('financial').filter(p => p.alunoId === id);
    const entradas     = allParcelas.filter(p => p.tipo === 'entrada').sort((a,b) => (a.numero||0)-(b.numero||0));
    const mensais      = allParcelas.filter(p => p.tipo !== 'entrada').sort((a,b) => {
      const fa = a.formaPagamento||'', fb = b.formaPagamento||'';
      return fa !== fb ? fa.localeCompare(fb) : (a.numero||0)-(b.numero||0);
    });
    const mat    = s.matriculas?.[0];
    const cursos = mat?.comboCursos?.length ? mat.comboCursos :
      (mat?.cursoId ? [DB.findById('courses', mat.cursoId)].filter(Boolean) : []);
    const turma  = mat ? DB.findById('grades',     mat.turmaId)      : null;
    const func   = mat ? DB.findById('employees',  mat.funcionarioId): null;

    const totalContrato = mat?.valorFinal || mat?.valorTotal || 0;
    const totalGeral    = allParcelas.reduce((a,p) => a + p.valor + (p.juros||0), 0);
    const pago          = allParcelas.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
    const pendente      = allParcelas.filter(p=>p.status==='pendente').reduce((a,p)=>a+p.valor,0);
    const atrasado      = allParcelas.filter(p=>p.status==='atrasado').reduce((a,p)=>a+p.valor+(p.juros||0),0);
    const inadimplente  = allParcelas.some(p=>p.status==='atrasado');
    const progPct       = totalGeral > 0 ? Math.min(100, Math.round((pago/totalGeral)*100)) : 0;

    const FLABEL = { pix:'Pix', dinheiro:'Dinheiro', cartao_debito:'Cartão Débito', cartao_credito:'Cartão Crédito', boleto:'Boleto' };

    const _row = (p, isEntrada=false) => {
      const borda = p.status==='pago' ? 'border-l-green-500' : p.status==='atrasado' ? 'border-l-red-500' : 'border-l-yellow-500';
      return `
      <div class="bg-gray-700/20 rounded-lg px-3 py-2.5 border-l-2 ${borda} text-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium ${isEntrada?'text-yellow-200':'text-gray-200'}">
                ${p.obs || (isEntrada ? 'Entrada' : `Parcela ${p.numero}/${p.total}`)}
              </span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-gray-600/60 text-gray-400">${FLABEL[p.formaPagamento]||p.formaPagamento||'—'}</span>
            </div>
            <div class="flex items-center gap-3 mt-1 text-xs flex-wrap">
              <span class="text-gray-500">📅 Venc: <span class="${p.status==='atrasado'?'text-red-400 font-semibold':'text-gray-400'}">${Utils.formatDate(p.vencimento)}</span></span>
              ${p.dataPagamento?`<span class="text-green-400">✅ Pago em: ${Utils.formatDate(p.dataPagamento)}</span>`:''}
              ${(p.juros||0)>0?`<span class="text-red-400">+ ${Utils.currency(p.juros)} juros</span>`:''}
            </div>
          </div>
          <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="font-bold text-white">${Utils.currency(p.valor+(p.juros||0))}</span>
              ${Utils.statusBadge(p.status)}
            </div>
            ${p.status!=='pago' && Auth.can('financeiro','criar')?
              `<button onclick="FinancialModule.registerPayment('${id}','${p.id}')" class="btn-success btn-sm">💰 Pagar</button>`:''}
          </div>
        </div>
      </div>`;
    };

    /* Agrupa parcelas do restante por forma de pagamento se houver múltiplas */
    const formasUsadas = [...new Set(mensais.map(p=>p.formaPagamento))];
    const mensaisHtml  = formasUsadas.length > 1
      ? formasUsadas.map(forma => {
          const grupo     = mensais.filter(p=>p.formaPagamento===forma);
          const totG      = grupo.reduce((a,p)=>a+p.valor+(p.juros||0),0);
          const pagoG     = grupo.filter(p=>p.status==='pago').reduce((a,p)=>a+p.valor,0);
          const pagoCount = grupo.filter(p=>p.status==='pago').length;
          return `
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2 px-1">
              <span class="text-xs font-semibold text-blue-300 uppercase tracking-wide">${FLABEL[forma]||forma} — ${grupo.length}x</span>
              <span class="text-xs text-gray-500">${Utils.currency(totG)} total · ${Utils.currency(pagoG)} pago (${pagoCount}/${grupo.length})</span>
            </div>
            <div class="space-y-1.5 pl-2 border-l-2 border-blue-800/40">
              ${grupo.map(p=>_row(p,false)).join('')}
            </div>
          </div>`;
        }).join('')
      : `<div class="space-y-1.5">${mensais.map(p=>_row(p,false)).join('')}</div>`;

    /* Próximo vencimento em aberto */
    const proxVenc = allParcelas
      .filter(p=>p.status!=='pago')
      .sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||''))[0];

    Utils.showModal(`
      <div class="p-6 space-y-5">

        <!-- Cabeçalho -->
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-lg font-bold text-white">${s.nome}</h3>
            <p class="text-xs text-gray-500 mt-0.5">${s.telefone ? Utils.formatPhone(s.telefone) : ''} ${s.email ? '· '+s.email : ''}</p>
            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
              ${Utils.statusBadge(s.status)}
              ${inadimplente?'<span class="badge badge-red">⚠️ Inadimplente</span>':''}
            </div>
          </div>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white text-lg flex-shrink-0">✕</button>
        </div>

        <!-- Resumo da Matrícula -->
        <div class="card card-sm text-sm space-y-1.5">
          <p class="section-title mb-2">📋 Matrícula</p>
          ${cursos.length?`<div class="stat-row"><span class="text-gray-400">Curso(s)</span><span class="text-white text-right">${cursos.map(c=>c.nome||c).join(', ')}</span></div>`:''}
          ${turma?`<div class="stat-row"><span class="text-gray-400">Turma</span><span class="text-white">${turma.nome}</span></div>`:''}
          ${mat?.dataInicio?`<div class="stat-row"><span class="text-gray-400">Início</span><span class="text-white">${Utils.formatDate(mat.dataInicio)}</span></div>`:''}
          ${func?`<div class="stat-row"><span class="text-gray-400">Atendente</span><span class="text-white">${func.nome}</span></div>`:''}
          ${(mat?.comboDesc||0)>0?`<div class="stat-row"><span class="text-gray-400">Desc. combo</span><span class="text-green-400">- ${Utils.currency(mat.comboDesc)}</span></div>`:''}
          ${(mat?.desconto||0)>0?`<div class="stat-row"><span class="text-gray-400">Desc. extra</span><span class="text-green-400">- ${Utils.currency(mat.desconto)}</span></div>`:''}
          <div class="stat-row border-t border-gray-600 pt-2">
            <span class="text-gray-400">Valor do Contrato</span>
            <span class="text-primary-300 font-bold text-base">${Utils.currency(totalContrato)}</span>
          </div>
        </div>

        <!-- Situação Financeira -->
        <div class="card card-sm text-sm space-y-3">
          <p class="section-title mb-1">💰 Situação Financeira</p>
          <div>
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-gray-400">Progresso de pagamento</span>
              <span class="font-bold ${progPct>=100?'text-green-400':'text-white'}">${progPct}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2.5">
              <div class="h-2.5 rounded-full transition-all ${progPct>=100?'bg-green-500':inadimplente?'bg-red-500':'bg-primary-500'}"
                style="width:${progPct}%"></div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center bg-green-900/20 rounded-xl p-2.5">
              <div class="text-green-400 font-bold">${Utils.currency(pago)}</div>
              <div class="text-xs text-gray-500 mt-0.5">✅ Pago</div>
            </div>
            <div class="text-center bg-yellow-900/20 rounded-xl p-2.5">
              <div class="text-yellow-400 font-bold">${Utils.currency(pendente)}</div>
              <div class="text-xs text-gray-500 mt-0.5">⏳ Pendente</div>
            </div>
            <div class="text-center ${atrasado>0?'bg-red-900/20':'bg-gray-700/20'} rounded-xl p-2.5">
              <div class="${atrasado>0?'text-red-400':'text-gray-600'} font-bold">${Utils.currency(atrasado)}</div>
              <div class="text-xs text-gray-500 mt-0.5">🚨 Em Atraso</div>
            </div>
          </div>
          ${proxVenc?`
          <div class="stat-row border-t border-gray-600 pt-2">
            <span class="text-gray-400">Próx. vencimento</span>
            <span class="${proxVenc.status==='atrasado'?'text-red-400 font-semibold':'text-white'}">${Utils.formatDate(proxVenc.vencimento)} — ${Utils.currency(proxVenc.valor)}</span>
          </div>`:''}
        </div>

        ${s.inadimplenciaSituacao?`
        <div>
          <p class="section-title">⚠️ Situação da Inadimplência</p>
          <div class="flex items-center gap-3">
            <span class="badge badge-red">${_situacaoLabel(s.inadimplenciaSituacao)}</span>
            ${Auth.can('financeiro','editar')?`
            <select onchange="FinancialModule.updateSituacao('${id}',this.value)" class="input-field flex-1">
              <option value="">Selecione...</option>
              <option value="parou_frequentar"   ${s.inadimplenciaSituacao==='parou_frequentar'?'selected':''}>Parou de frequentar</option>
              <option value="nunca_frequentou"   ${s.inadimplenciaSituacao==='nunca_frequentou'?'selected':''}>Nunca frequentou</option>
              <option value="nunca_pagou"        ${s.inadimplenciaSituacao==='nunca_pagou'?'selected':''}>Nunca pagou</option>
              <option value="frequenta_nao_paga" ${s.inadimplenciaSituacao==='frequenta_nao_paga'?'selected':''}>Frequenta e não paga</option>
              <option value="spc"                ${s.inadimplenciaSituacao==='spc'?'selected':''}>SPC</option>
            </select>`:''}
          </div>
        </div>`:''}

        <!-- Ato / Entrada -->
        ${entradas.length?`
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="section-title mb-0">💵 Ato / Entrada</p>
            <span class="text-xs text-gray-500">${entradas.length} registro(s) · ${Utils.currency(entradas.reduce((a,p)=>a+p.valor,0))}</span>
          </div>
          <div class="space-y-1.5">
            ${entradas.map(p=>_row(p,true)).join('')}
          </div>
        </div>`:''}

        <!-- Parcelas do Restante -->
        ${mensais.length?`
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="section-title mb-0">📅 Parcelas do Restante</p>
            <span class="text-xs text-gray-500">${mensais.filter(p=>p.status==='pago').length}/${mensais.length} pagas · ${Utils.currency(mensais.reduce((a,p)=>a+p.valor,0))} total</span>
          </div>
          ${mensaisHtml}
        </div>`:''}

        ${!entradas.length&&!mensais.length?'<p class="text-gray-500 text-sm text-center py-4">Nenhum registro financeiro cadastrado</p>':''}

        <!-- Contato -->
        <div class="flex flex-col sm:flex-row gap-2">
          ${s.telefone?`
          <a href="https://wa.me/55${(s.telefone||'').replace(/\D/g,'')}" target="_blank"
            class="btn-success flex-1 text-center text-sm py-2">📱 WhatsApp Aluno</a>`:''}
          ${s.responsavel?.telefone?`
          <a href="https://wa.me/55${(s.responsavel.telefone||'').replace(/\D/g,'')}" target="_blank"
            class="btn-secondary flex-1 text-center text-sm py-2">📱 WhatsApp Responsável</a>`:''}
        </div>

        <div class="flex justify-end gap-3">
          <button onclick="Utils.closeModal()" class="btn-secondary">Fechar</button>
          ${inadimplente && Auth.can('financeiro','editar')?`
          <button onclick="FinancialModule.toggleBlock('${id}');Utils.closeModal()" class="btn-danger">
            ${s.status==='bloqueado'?'🔓 Desbloquear':'🔒 Bloquear'}
          </button>`:''}
        </div>
      </div>`);
  }

  function registerPayment(alunoId, parcelaId) {
    const parcela = DB.findById('financial', parcelaId);
    if (!parcela) return;
    Utils.showModal(`
      <div class="p-6">
        <h3 class="text-lg font-bold text-white mb-4">Registrar Pagamento</h3>
        <div class="card card-sm mb-4">
          <p class="text-gray-400 text-sm">Parcela ${parcela.numero}/${parcela.total} — Venc: ${Utils.formatDate(parcela.vencimento)}</p>
          <p class="text-2xl font-bold text-white mt-1">${Utils.currency(parcela.valor)}</p>
          ${parcela.juros>0?`<p class="text-red-400 text-sm">+ ${Utils.currency(parcela.juros)} de juros</p>`:''}
        </div>
        <div class="space-y-3">
          <div><label class="form-label">Data do Pagamento</label><input type="date" id="payDate" class="input-field" value="${new Date().toISOString().slice(0,10)}"></div>
          <div><label class="form-label">Forma de Pagamento</label>
            <select id="payMethod" class="input-field">
              <option value="pix">Pix</option><option value="cartao_debito">Cartão Débito</option>
              <option value="cartao_credito">Cartão Crédito</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
          <button onclick="FinancialModule.confirmPayment('${alunoId}','${parcelaId}')" class="btn-success">Confirmar Pagamento</button>
        </div>
      </div>`);
  }

  function confirmPayment(alunoId, parcelaId) {
    const parcela = DB.findById('financial', parcelaId);
    if (!parcela) return;
    parcela.status = 'pago';
    parcela.dataPagamento = document.getElementById('payDate').value;
    parcela.formaPagamento = document.getElementById('payMethod').value;
    parcela.updatedAt = new Date().toISOString();
    DB.save('financial', parcela);

    // Verificar se ainda há inadimplência
    const ps = DB.get('financial').filter(p=>p.alunoId===alunoId);
    const aindaInadimplente = ps.some(p=>p.status==='atrasado');
    if (!aindaInadimplente) {
      const student = DB.findById('students', alunoId);
      if (student && student.status==='bloqueado') {
        student.status = 'ativo';
        DB.save('students', student);
      }
    }
    Audit.log('financeiro','pagar',parcelaId,{status:'pendente'},{status:'pago'});
    Utils.closeModal();
    Utils.showToast('Pagamento registrado com sucesso!','success');
    render();
  }

  async function toggleBlock(id) {
    const s = DB.findById('students', id);
    if (!s) return;
    const bloqueando = s.status !== 'bloqueado';
    if (!await Utils.confirm(`${bloqueando?'Bloquear':'Desbloquear'} o aluno "${s.nome}"?`)) return;
    s.status = bloqueando ? 'bloqueado' : 'ativo';
    if (bloqueando && !s.inadimplenciaSituacao) s.inadimplenciaSituacao = 'frequenta_nao_paga';
    DB.save('students', s);
    Audit.log('alunos', bloqueando?'bloquear':'desbloquear', id, null, {status:s.status});
    Utils.showToast(`Aluno ${bloqueando?'bloqueado':'desbloqueado'}`, bloqueando?'error':'success');
    render();
  }

  function updateSituacao(id, situacao) {
    if (!situacao) return;
    const s = DB.findById('students', id);
    if (!s) return;
    s.inadimplenciaSituacao = situacao;
    if (situacao === 'spc') s.statusFinanceiro = 'SPC';
    DB.save('students', s);
    Utils.showToast('Situação atualizada','success');
  }

  function search(q) {
    const students = getFiltered().filter(s =>
      s.nome.toLowerCase().includes(q.toLowerCase()) ||
      (s.telefone||'').includes(q)
    );
    const el = document.getElementById('financialList');
    if (el) el.innerHTML = renderList(students);
  }

  function _situacaoLabel(s) {
    return { parou_frequentar:'Parou de frequentar', nunca_frequentou:'Nunca frequentou', nunca_pagou:'Nunca pagou', frequenta_nao_paga:'Frequenta e não paga', spc:'Negativado (SPC)' }[s] || s;
  }

  return { render, setTab, openDetail, registerPayment, confirmPayment, toggleBlock, updateSituacao, search };
})();
