/* ===== PORTAL DO ALUNO ===== */
const StudentPortal = {

  tab(t) {
    ['aulas','pendencias','reposicoes','chat'].forEach(id => {
      const btn = document.getElementById(`ptab-${id}`);
      if (btn) btn.classList.toggle('active', id === t);
    });
    const content = document.getElementById('studentPortalContent');
    if (!content) return;
    switch (t) {
      case 'aulas':      content.innerHTML = this._renderAulas();      break;
      case 'pendencias': content.innerHTML = this._renderPendencias(); break;
      case 'reposicoes': content.innerHTML = this._renderReposicoes(); break;
      case 'chat':
        content.innerHTML = this._renderChat();
        this._afterChatRender();
        break;
    }
  },

  _student() {
    /* Sempre busca dado fresco do DB */
    const id = Auth.currentStudent?.id;
    return id ? (DB.findById('students', id) || Auth.currentStudent) : null;
  },

  /* ── ABA AULAS ── */
  _renderAulas() {
    const s = this._student();
    if (!s) return '';
    const mat   = s.matriculas?.[0];
    const curso = mat ? DB.findById('courses', mat.cursoId) : null;
    const turma = mat ? DB.findById('grades',  mat.turmaId) : null;

    const diasMap  = { seg:'Segunda', ter:'Terça', qua:'Quarta', qui:'Quinta', sex:'Sexta', sab:'Sábado', dom:'Domingo' };
    const ORDEM    = ['seg','ter','qua','qui','sex','sab','dom'];

    /* Fonte verdadeira: slots individuais gravados na grade de horários */
    const slots = DB.get('schedule').filter(sl => sl.alunoId === s.id);

    /* Agrupa por horário → lista os dias de cada horário em ordem */
    let diasHorario = '—';
    if (slots.length > 0) {
      const grupos = {};
      slots.forEach(sl => { (grupos[sl.horario] = grupos[sl.horario]||[]).push(sl.dia); });
      diasHorario = Object.entries(grupos)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([hor, ds]) => {
          const sorted = [...ds].sort((a,b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));
          return sorted.map(d => diasMap[d]||d).join(', ') + ' · ' + hor;
        }).join('<br>');
    } else if (turma) {
      /* Fallback para alunos sem slots (legado) */
      const ds = (turma.diasSemana||[]).map(d => diasMap[d]||d).join(', ');
      diasHorario = ds + (turma.horarioInicio ? ' · ' + turma.horarioInicio + '–' + turma.horarioFim : '');
    }

    const freq      = DB.findBy('attendance','alunoId',s.id);
    const presencas = freq.filter(f=>f.presente).length;
    const faltas    = freq.filter(f=>!f.presente).length;
    const pct       = freq.length ? Math.round((presencas/freq.length)*100) : 0;
    const cor       = pct>=75?'text-green-400':pct>=50?'text-yellow-400':'text-red-400';
    const barColor  = pct>=75?'bg-green-500':pct>=50?'bg-yellow-500':'bg-red-500';

    return `
    <div class="space-y-4">
      ${mat ? `
      <div class="card">
        <p class="section-title">Meu Curso</p>
        <div class="space-y-2.5">
          <div class="flex justify-between text-sm"><span class="text-gray-400">Curso</span><span class="text-white font-semibold">${curso?.nome||'—'}</span></div>
          <div class="flex justify-between text-sm"><span class="text-gray-400">Turma</span><span class="text-white">${turma?.nome||'—'}</span></div>
          <div class="flex justify-between text-sm"><span class="text-gray-400">Dias & Horários</span><span class="text-white text-right" style="max-width:60%">${diasHorario}</span></div>
          <div class="flex justify-between text-sm"><span class="text-gray-400">Início</span><span class="text-white">${Utils.formatDate(mat.dataInicio)}</span></div>
        </div>
      </div>` : `<div class="card text-center py-6"><p class="text-gray-400">Nenhuma matrícula ativa</p></div>`}

      <div class="card">
        <p class="section-title">Minha Frequência</p>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="bg-gray-700/50 rounded-xl p-3 text-center"><div class="text-2xl font-bold text-green-400">${presencas}</div><div class="text-xs text-gray-400 mt-1">Presenças</div></div>
          <div class="bg-gray-700/50 rounded-xl p-3 text-center"><div class="text-2xl font-bold text-red-400">${faltas}</div><div class="text-xs text-gray-400 mt-1">Faltas</div></div>
          <div class="bg-gray-700/50 rounded-xl p-3 text-center"><div class="text-2xl font-bold ${cor}">${pct}%</div><div class="text-xs text-gray-400 mt-1">Freq.</div></div>
        </div>
        <div class="progress-bar h-3"><div class="${barColor} h-full rounded-full transition-all" style="width:${pct}%"></div></div>
        ${pct < 75 ? `<p class="text-xs text-yellow-400 mt-2">⚠️ Frequência abaixo de 75%. Procure a secretaria.</p>` : `<p class="text-xs text-green-400 mt-2">✅ Frequência regular. Continue assim!</p>`}
      </div>

      ${freq.length ? `
      <div class="card">
        <p class="section-title">Últimos Registros</p>
        <div class="space-y-1 max-h-52 overflow-y-auto">
          ${freq.sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,15).map(f=>`
          <div class="flex items-center justify-between py-1.5 border-b border-gray-700/30 last:border-0 text-sm">
            <span class="text-gray-300">${Utils.formatDate(f.data)}</span>
            <span class="${f.presente?'text-green-400':'text-red-400'}">${f.presente?'✅ Presente':'❌ Falta'}</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;
  },

  /* ── ABA PENDÊNCIAS ── */
  _renderPendencias() {
    const s = this._student();
    const parcelas = DB.findBy('financial','alunoId',s.id);
    const pendentes = parcelas.filter(p=>p.status!=='pago').sort((a,b)=>new Date(a.vencimento)-new Date(b.vencimento));
    const totalDev  = pendentes.reduce((n,p)=>n+p.valor+(p.juros||0),0);

    if (!pendentes.length) return `
    <div class="card text-center py-10">
      <div class="text-5xl mb-3">✅</div>
      <p class="text-green-400 font-semibold text-lg">Tudo em dia!</p>
      <p class="text-gray-400 text-sm mt-1">Você não tem pendências financeiras.</p>
    </div>`;

    return `
    <div class="space-y-3">
      <div class="card bg-red-900/20 border border-red-700/40">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-red-300 font-semibold">⚠️ ${pendentes.length} parcela(s) pendente(s)</p>
            <p class="text-red-400 text-sm mt-0.5">Total: R$ ${totalDev.toFixed(2)}</p>
          </div>
          <button onclick="StudentPortal.contactFinanceiro()" class="btn-danger btn-sm">💬 Falar com Financeiro</button>
        </div>
      </div>
      ${pendentes.map(p=>`
      <div class="card ${p.status==='atrasado'?'border-red-700/50 bg-red-900/10':''}">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-white font-medium">Parcela ${p.numero}/${p.total}</p>
            <p class="text-sm text-gray-400">Vencimento: ${Utils.formatDate(p.vencimento)}</p>
            ${p.juros ? `<p class="text-xs text-red-400 mt-0.5">+ Multa/juros: R$ ${(p.juros||0).toFixed(2)}</p>` : ''}
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-white">R$ ${p.valor.toFixed(2)}</p>
            <span class="badge ${p.status==='atrasado'?'badge-red':'badge-yellow'} mt-1">${p.status==='atrasado'?'⚠️ Atrasado':'⏳ Pendente'}</span>
          </div>
        </div>
      </div>`).join('')}
    </div>`;
  },

  /* ── ABA REPOSIÇÕES ── */
  _renderReposicoes() {
    const s = this._student();
    const faltas = DB.findBy('attendance','alunoId',s.id)
      .filter(f=>!f.presente)
      .sort((a,b)=>new Date(b.data)-new Date(a.data));

    if (!faltas.length) return `
    <div class="card text-center py-10">
      <div class="text-5xl mb-3">🎉</div>
      <p class="text-green-400 font-semibold text-lg">Sem faltas!</p>
      <p class="text-gray-400 text-sm mt-1">Você não tem reposições pendentes.</p>
    </div>`;

    return `
    <div class="space-y-3">
      <div class="card bg-yellow-900/20 border border-yellow-700/40">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-yellow-300 font-semibold">📋 ${faltas.length} falta(s) registrada(s)</p>
            <p class="text-yellow-400 text-sm mt-0.5">Solicite reposição via chat.</p>
          </div>
          <button onclick="StudentPortal.solicitarReposicao()" class="btn-secondary btn-sm">🔄 Solicitar Reposição</button>
        </div>
      </div>
      ${faltas.map(f=>`
      <div class="card card-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-white text-sm font-medium">${Utils.formatDate(f.data)}</p>
            <p class="text-xs text-gray-400 mt-0.5">${f.tipo==='reposicao'?'Reposição realizada':'Falta registrada'}</p>
          </div>
          <span class="badge ${f.tipo==='reposicao'?'badge-green':'badge-red'}">${f.tipo==='reposicao'?'✅ Reposta':'❌ Falta'}</span>
        </div>
      </div>`).join('')}
    </div>`;
  },

  /* ── ABA CHAT ── */
  _renderChat() {
    const s = this._student();
    const empRecebe = DB.get('employees').filter(e => e.recebe_chat && e.ativo !== false && e.id !== 'emp_master');
    const msgs = DB.get('chat_messages')
      .filter(m => m.alunoId === s.id)
      .sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt));

    return `
    <div class="flex flex-col gap-3" style="height:calc(100vh - 200px); min-height:400px">
      <!-- Destinatários -->
      <div class="card p-3 flex-shrink-0">
        <p class="text-xs text-gray-400 mb-1">Equipe disponível:</p>
        <div class="flex flex-wrap gap-2">
          ${empRecebe.map(e=>`<span class="badge badge-green text-xs">👤 ${e.nome}</span>`).join('')}
          ${!empRecebe.length?'<span class="text-gray-500 text-xs">Nenhum funcionário disponível</span>':''}
        </div>
      </div>

      <!-- Thread -->
      <div class="card flex-1 flex flex-col p-0 overflow-hidden">
        <div id="studentChatThread" class="flex-1 overflow-y-auto p-4 space-y-3">
          ${msgs.length ? msgs.map(m => {
            const isMe = m.remetenteTipo === 'aluno';
            const emp  = !isMe ? DB.findById('employees', m.remetenteId) : null;
            const label = _chatTemplateLabel(m.templateKey);
            return `
            <div class="flex ${isMe?'justify-end':'justify-start'}">
              <div class="${isMe?'chat-bubble-me':'chat-bubble-other'} px-4 py-2.5 max-w-[85%]">
                ${!isMe ? `<p class="text-xs text-primary-300 font-semibold mb-1">👤 ${emp?.nome||'Escola'}</p>` : ''}
                ${label ? `<p class="text-xs text-indigo-300 italic mb-1">${label}</p>` : ''}
                <p class="text-sm">${m.mensagem}</p>
                <p class="text-xs opacity-40 mt-1 text-right">${Utils.formatDate(m.createdAt)}</p>
              </div>
            </div>`;
          }).join('') : `<p class="text-center text-gray-500 py-10 text-sm">Envie uma mensagem para nossa equipe 👇</p>`}
        </div>
        <div class="border-t border-gray-700/50 p-3 flex gap-2 flex-shrink-0">
          <input type="text" id="studentChatInput" placeholder="Escreva sua mensagem…" class="input-field flex-1"
            onkeydown="if(event.key==='Enter')StudentPortal.sendChat()">
          <button onclick="StudentPortal.sendChat()" class="btn-primary px-4">Enviar</button>
        </div>
      </div>
    </div>`;
  },

  _afterChatRender() {
    setTimeout(() => {
      const el = document.getElementById('studentChatThread');
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
    /* Marca mensagens de funcionários como lidas */
    const s = this._student();
    DB.get('chat_messages')
      .filter(m => m.alunoId === s.id && !m.lido && m.remetenteTipo === 'funcionario')
      .forEach(m => { m.lido = true; DB.save('chat_messages', m); });
  },

  sendChat() {
    const s = this._student();
    const input = document.getElementById('studentChatInput');
    const msg = input?.value.trim();
    if (!msg) return;
    DB.save('chat_messages', {
      alunoId:       s.id,
      remetenteId:   s.id,
      remetenteTipo: 'aluno',
      mensagem:      msg,
      templateKey:   null,
      lido:          false,
      createdAt:     new Date().toISOString()
    });
    this.tab('chat');
  },

  solicitarReposicao() {
    const s = this._student();
    DB.save('chat_messages', {
      alunoId:       s.id,
      remetenteId:   s.id,
      remetenteTipo: 'aluno',
      mensagem:      '🔄 Olá! Gostaria de solicitar uma reposição de aula. Poderia me informar os horários disponíveis?',
      templateKey:   null,
      lido:          false,
      createdAt:     new Date().toISOString()
    });
    Utils.showToast('Solicitação enviada!', 'success');
    this.tab('chat');
  },

  contactFinanceiro() {
    const s = this._student();
    DB.save('chat_messages', {
      alunoId:       s.id,
      remetenteId:   s.id,
      remetenteTipo: 'aluno',
      mensagem:      '💰 Olá! Tenho dúvidas sobre minha situação financeira. Podem me ajudar a regularizar?',
      templateKey:   null,
      lido:          false,
      createdAt:     new Date().toISOString()
    });
    Utils.showToast('Mensagem enviada ao financeiro!', 'success');
    this.tab('chat');
  }
};

function _chatTemplateLabel(key) {
  const map = { boas_vindas:'👋 Boas-vindas', lembrete:'⏰ Lembrete de Aula', falta:'❌ Aviso de Falta', reposicao:'🔄 Reposição', financeiro:'💰 Contato Financeiro' };
  return map[key] || '';
}
