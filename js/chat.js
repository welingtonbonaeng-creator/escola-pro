/* ===== MÓDULO CHAT (Funcionários) ===== */
const ChatModule = (() => {

  function render() {
    const students = DB.get('students').filter(s => s.status !== 'formado');
    const allMsgs  = DB.get('chat_messages');

    /* Ordena alunos por mensagem mais recente */
    const sorted = students.map(s => {
      const msgs   = allMsgs.filter(m => m.alunoId === s.id)
                            .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
      const unread = msgs.filter(m => !m.lido && m.remetenteTipo === 'aluno').length;
      return { s, last: msgs[0], unread };
    }).sort((a,b) => {
      if (!a.last && !b.last) return 0;
      if (!a.last) return 1;
      if (!b.last) return -1;
      return new Date(b.last.createdAt) - new Date(a.last.createdAt);
    });

    const totalUnread = sorted.reduce((n, x) => n + x.unread, 0);

    const staffUnread = typeof StaffChatModule !== 'undefined' ? StaffChatModule.totalUnread() : 0;

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold text-white">💬 Chat com Alunos</h3>
            <p class="text-gray-400 text-sm">${totalUnread ? `<span class="text-red-400 font-semibold">${totalUnread} mensagem(ns) não lida(s)</span>` : 'Todas as mensagens lidas'}</p>
          </div>
          ${(Auth.isAdmin||Auth.isMaster) ? `
          <button onclick="App.navigate('staffchat')" class="btn-secondary flex items-center gap-2 self-start">
            👔 Chat com Equipe
            ${staffUnread > 0 ? `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">${staffUnread}</span>` : ''}
          </button>` : ''}
        </div>

        ${!sorted.length ? Utils.emptyState('Nenhum aluno ativo encontrado') : `
        <div class="space-y-2">
          ${sorted.map(({s, last, unread}) => `
          <div class="card cursor-pointer hover:border-primary-700/50 transition-all" onclick="ChatModule.openThread('${s.id}')">
            <div class="flex items-center gap-3">
              <div class="relative flex-shrink-0">
                <div class="w-11 h-11 rounded-full bg-primary-800 flex items-center justify-center font-bold text-primary-200">
                  ${Utils.initials(s.nome)}
                </div>
                ${unread ? `<span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">${unread}</span>` : ''}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <p class="font-medium text-white text-sm">${s.nome}</p>
                  ${last ? `<span class="text-xs text-gray-500 flex-shrink-0">${Utils.formatDate(last.createdAt)}</span>` : ''}
                </div>
                <p class="text-xs ${unread ? 'text-gray-200 font-medium' : 'text-gray-400'} truncate mt-0.5">
                  ${last ? (last.remetenteTipo === 'funcionario' ? '✉️ ' : '🎓 ') + last.mensagem : 'Sem mensagens ainda'}
                </p>
              </div>
              <span class="text-gray-600 text-lg">›</span>
            </div>
          </div>`).join('')}
        </div>`}
      </div>`;
  }

  function openThread(alunoId) {
    const s = DB.findById('students', alunoId);
    if (!s) return;

    /* Marca mensagens do aluno como lidas */
    DB.get('chat_messages')
      .filter(m => m.alunoId === alunoId && !m.lido && m.remetenteTipo === 'aluno')
      .forEach(m => { m.lido = true; DB.save('chat_messages', m); });

    const msgs = DB.get('chat_messages')
      .filter(m => m.alunoId === alunoId)
      .sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt));

    Utils.showModal(`
      <div class="flex flex-col" style="height:580px">
        <!-- Header -->
        <div class="p-4 border-b border-gray-700/50 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary-800 flex items-center justify-center font-bold text-primary-200">
              ${Utils.initials(s.nome)}
            </div>
            <div>
              <p class="font-semibold text-white">${s.nome}</p>
              <p class="text-xs text-gray-400">${s.telefone} · ${Utils.statusBadge(s.status)}</p>
            </div>
          </div>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        <!-- Messages -->
        <div id="empChatThread" class="flex-1 overflow-y-auto p-4 space-y-3">
          ${msgs.length ? msgs.map(m => _bubbleHtml(m)).join('') : `
          <div class="flex items-center justify-center h-full">
            <p class="text-gray-500 text-sm text-center">Nenhuma mensagem ainda.<br>Inicie o contato abaixo.</p>
          </div>`}
        </div>

        <!-- Templates rápidos -->
        <div class="px-4 pt-2 pb-1 flex flex-wrap gap-1.5 flex-shrink-0 border-t border-gray-700/30">
          <button onclick="ChatModule.sendTemplate('${alunoId}','boas_vindas','Olá, ${s.nome}! 😊 Bem-vindo(a) à nossa escola! Qualquer dúvida, é só chamar!');ChatModule.openThread('${alunoId}')" class="btn-secondary btn-sm">👋 Boas-vindas</button>
          <button onclick="ChatModule.sendTemplate('${alunoId}','lembrete','Oi, ${s.nome}! 👋 Lembrando que você tem aula hoje. Te esperamos! 🎓');ChatModule.openThread('${alunoId}')" class="btn-secondary btn-sm">⏰ Lembrete</button>
          <button onclick="ChatModule.sendTemplate('${alunoId}','falta','Olá, ${s.nome}. Notamos sua ausência hoje. Sentimos sua falta! 😊');ChatModule.openThread('${alunoId}')" class="btn-secondary btn-sm">❌ Falta</button>
          <button onclick="ChatModule.sendTemplate('${alunoId}','reposicao','Olá, ${s.nome}! Você tem reposição pendente. Entre em contato para agendar. 📅');ChatModule.openThread('${alunoId}')" class="btn-secondary btn-sm">🔄 Reposição</button>
          <button onclick="ChatModule.sendTemplate('${alunoId}','financeiro','Olá, ${s.nome}. Há uma pendência financeira no seu cadastro. Por favor, regularize. 🙏');ChatModule.openThread('${alunoId}')" class="btn-danger btn-sm">💰 Financeiro</button>
        </div>

        <!-- Input -->
        <div class="p-3 border-t border-gray-700/50 flex gap-2 flex-shrink-0">
          <input type="text" id="empChatInput" placeholder="Escreva uma mensagem…" class="input-field flex-1"
            onkeydown="if(event.key==='Enter')ChatModule.sendFromModal('${alunoId}')">
          <button onclick="ChatModule.sendFromModal('${alunoId}')" class="btn-primary px-4">Enviar</button>
        </div>
      </div>`);

    setTimeout(() => {
      const el = document.getElementById('empChatThread');
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
  }

  function _bubbleHtml(m) {
    const isMe = m.remetenteTipo === 'funcionario';
    const label = _templateLabel(m.templateKey);
    return `
    <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
      <div class="${isMe ? 'chat-bubble-me' : 'chat-bubble-other'} px-4 py-2.5 max-w-[80%]">
        ${!isMe ? `<p class="text-xs text-primary-300 font-semibold mb-1">🎓 Aluno</p>` : ''}
        ${label  ? `<p class="text-xs text-indigo-300 mb-1 italic">${label}</p>` : ''}
        <p class="text-sm">${m.mensagem}</p>
        <p class="text-xs opacity-40 mt-1 text-right">${Utils.formatDate(m.createdAt)}</p>
      </div>
    </div>`;
  }

  function _templateLabel(key) {
    const map = { boas_vindas:'👋 Boas-vindas', lembrete:'⏰ Lembrete de Aula', falta:'❌ Aviso de Falta', reposicao:'🔄 Reposição', financeiro:'💰 Contato Financeiro' };
    return map[key] || '';
  }

  function sendFromModal(alunoId) {
    const input = document.getElementById('empChatInput');
    const msg = input?.value.trim();
    if (!msg) return;
    _save(alunoId, msg, null);
    openThread(alunoId);
  }

  function sendTemplate(alunoId, templateKey, mensagem) {
    _save(alunoId, mensagem, templateKey);
  }

  function _save(alunoId, mensagem, templateKey) {
    DB.save('chat_messages', {
      alunoId,
      remetenteId:   Auth.currentUser?.id,
      remetenteTipo: 'funcionario',
      mensagem,
      templateKey:   templateKey || null,
      lido:          false,
      createdAt:     new Date().toISOString()
    });
  }

  function getUnreadCount() {
    return DB.get('chat_messages').filter(m => !m.lido && m.remetenteTipo === 'aluno').length;
  }

  return { render, openThread, sendFromModal, sendTemplate, getUnreadCount };
})();
