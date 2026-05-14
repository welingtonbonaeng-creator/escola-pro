/* ===== SISTEMA DE NOTIFICAÇÕES AUTOMÁTICAS ===== */
const NotificationSystem = {

  _defaults: {
    boas_vindas:
      'Olá, {nome}! 🎉 Seja muito bem-vindo(a) à nossa escola! Estamos muito felizes em tê-lo(a) aqui. Qualquer dúvida é só mandar mensagem para a nossa equipe. 😊',
    boas_vindas_aula:
      ' Sua(s) aula(s) será(ão) {dias} às {horario}. Te esperamos! 🎓',
    inadimplencia_aluno:
      'Olá, {nome}! 💰 Identificamos uma pendência financeira no seu cadastro. Por favor, entre em contato com nossa secretaria para regularizar. Estamos aqui para ajudar! 🙏',
    inadimplencia_staff:
      '⚠️ Aluno(a) {nome} está em inadimplência. Valor em atraso: R$ {valor}. Vencimento mais antigo: {data}.',
    falta_aluno:
      'Olá, {nome}! 📅 Notamos que você faltou à sua aula em {data}. Entre em contato para agendar uma reposição e não ficar com aulas pendentes. Conte com a gente! 😊',
    falta_staff:
      '📋 O aluno(a) {nome} faltou em {data} e ainda não agendou reposição de aula.',
  },

  _get(key) {
    const saved = Auth.getSetting('notif_' + key);
    return (saved !== null && saved !== '') ? saved : (this._defaults[key] || '');
  },

  _replace(tpl, vars) {
    return Object.entries(vars).reduce((s, [k, v]) => s.split('{' + k + '}').join(v), tpl);
  },

  /* ── Boas-vindas: chamado no primeiro login do aluno ── */
  checkWelcome(student) {
    const fresh = DB.findById('students', student.id) || student;
    if (fresh.welcomeSent) return;

    const firstName = student.nome.split(' ')[0];
    let msg = this._replace(this._get('boas_vindas'), { nome: firstName });

    const slots = DB.get('schedule').filter(sl => sl.alunoId === student.id);
    if (slots.length > 0) {
      const diasMap = { seg:'Segunda', ter:'Terça', qua:'Quarta', qui:'Quinta', sex:'Sexta', sab:'Sábado', dom:'Domingo' };
      const ORDEM   = ['seg','ter','qua','qui','sex','sab','dom'];
      const uniqueDias = [...new Set(slots.map(s => s.dia))].sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));
      const horarios   = [...new Set(slots.map(s => s.horario))].sort();
      msg += this._replace(this._get('boas_vindas_aula'), {
        dias:    uniqueDias.map(d => diasMap[d] || d).join(', '),
        horario: horarios.join(' / ')
      });
    }

    DB.save('chat_messages', {
      alunoId:       student.id,
      remetenteId:   'system',
      remetenteTipo: 'funcionario',
      mensagem:      msg,
      templateKey:   'boas_vindas',
      lido:          false,
      createdAt:     new Date().toISOString()
    });

    fresh.welcomeSent = true;
    DB.save('students', fresh);
    if (Auth.currentStudent) Auth.currentStudent.welcomeSent = true;
  },

  /* ── Inadimplência: alunos com ≥2 dias de atraso ── */
  _checkDelinquency() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 2);
    cutoff.setHours(23, 59, 59, 999);

    const byStudent = {};
    DB.get('financial')
      .filter(p => p.status === 'atrasado' && !p.inadimplenciaNotificada && new Date(p.vencimento) <= cutoff)
      .forEach(p => { (byStudent[p.alunoId] = byStudent[p.alunoId] || []).push(p); });

    Object.entries(byStudent).forEach(([alunoId, parcelas]) => {
      const student = DB.findById('students', alunoId);
      if (!student) return;

      const total  = parcelas.reduce((n, p) => n + p.valor + (p.juros || 0), 0);
      const oldest = parcelas.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))[0];

      DB.save('chat_messages', {
        alunoId,
        remetenteId:   'system',
        remetenteTipo: 'funcionario',
        mensagem:      this._replace(this._get('inadimplencia_aluno'), { nome: student.nome.split(' ')[0] }),
        templateKey:   'financeiro',
        lido:          false,
        createdAt:     new Date().toISOString()
      });

      this._notifyStaff(
        this._replace(this._get('inadimplencia_staff'), {
          nome:  student.nome,
          valor: total.toFixed(2),
          data:  Utils.formatDate(oldest.vencimento)
        }),
        alunoId
      );

      parcelas.forEach(p => { p.inadimplenciaNotificada = true; DB.save('financial', p); });
    });
  },

  /* ── Faltas sem reposição ── */
  _checkAbsences() {
    const todayStr = new Date().toISOString().split('T')[0];
    const attendance = DB.get('attendance');

    attendance
      .filter(f => !f.presente && f.tipo !== 'reposicao' && !f.reposicaoNotificada && f.data <= todayStr)
      .forEach(falta => {
        const hasReposicao = attendance.some(r =>
          r.alunoId === falta.alunoId && r.tipo === 'reposicao' && r.data > falta.data
        );

        if (hasReposicao) {
          falta.reposicaoNotificada = true;
          DB.save('attendance', falta);
          return;
        }

        const student = DB.findById('students', falta.alunoId);
        if (!student) return;

        DB.save('chat_messages', {
          alunoId:       falta.alunoId,
          remetenteId:   'system',
          remetenteTipo: 'funcionario',
          mensagem:      this._replace(this._get('falta_aluno'), {
            nome: student.nome.split(' ')[0],
            data: Utils.formatDate(falta.data)
          }),
          templateKey:   'reposicao',
          lido:          false,
          createdAt:     new Date().toISOString()
        });

        this._notifyStaff(
          this._replace(this._get('falta_staff'), {
            nome: student.nome,
            data: Utils.formatDate(falta.data)
          }),
          falta.alunoId
        );

        falta.reposicaoNotificada = true;
        DB.save('attendance', falta);
      });
  },

  _notifyStaff(mensagem, alunoId) {
    DB.get('employees')
      .filter(e => e.id !== 'emp_master' && e.ativo !== false && (e.isAdmin || e.recebe_alertas))
      .forEach(emp => {
        DB.save('internal_messages', {
          fromId:    'system',
          toId:      emp.id,
          type:      'text',
          content:   mensagem,
          alunoId,
          timestamp: new Date().toISOString(),
          readAt:    null
        });
      });
  },

  /* ── Retorna alertas persistentes ativos (consultados em tempo real) ── */
  _getActiveAlerts() {
    const attendance = DB.get('attendance');
    const financial  = DB.get('financial');

    const delinquencies = {};
    financial.filter(p => p.status === 'atrasado').forEach(p => {
      if (!delinquencies[p.alunoId]) delinquencies[p.alunoId] = { parcelas: [], total: 0 };
      delinquencies[p.alunoId].parcelas.push(p);
      delinquencies[p.alunoId].total += p.valor + (p.juros || 0);
    });

    const absencePending = attendance.filter(f =>
      !f.presente && f.tipo !== 'reposicao' &&
      !attendance.some(r => r.alunoId === f.alunoId && r.tipo === 'reposicao' && r.data > f.data)
    );

    return { delinquencies, absencePending };
  },

  /* ── Roda todas as verificações ── */
  checkAll() {
    this._checkDelinquency();
    this._checkAbsences();
  },

  /* ── Painel de configurações (admin) ── */
  renderSettings() {
    const { delinquencies, absencePending } = this._getActiveAlerts();
    const dEntries  = Object.entries(delinquencies);
    const employees = DB.get('employees').filter(e => e.id !== 'emp_master' && e.ativo !== false);
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const tpls = [
      { key:'boas_vindas',         label:'🎉 Boas-vindas — mensagem principal',       desc:'Variáveis: {nome}' },
      { key:'boas_vindas_aula',    label:'📅 Boas-vindas — complemento dias/horário', desc:'Variáveis: {dias}, {horario}' },
      { key:'inadimplencia_aluno', label:'💰 Inadimplência → Aluno',                  desc:'Variáveis: {nome}' },
      { key:'inadimplencia_staff', label:'⚠️ Inadimplência → Equipe',                desc:'Variáveis: {nome}, {valor}, {data}' },
      { key:'falta_aluno',         label:'❌ Falta → Aluno',                           desc:'Variáveis: {nome}, {data}' },
      { key:'falta_staff',         label:'📋 Falta sem reposição → Equipe',           desc:'Variáveis: {nome}, {data}' },
    ];

    document.getElementById('mainContent').innerHTML = `
    <div class="space-y-6 pb-8">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h3 class="text-xl font-bold text-white">🔔 Notificações Automáticas</h3>
        <button onclick="NotificationSystem.runNow()" class="btn-secondary btn-sm">▶ Verificar agora</button>
      </div>

      <!-- Alertas persistentes ativos -->
      <div class="space-y-3">
        <p class="section-title">Alertas ativos</p>

        ${dEntries.length === 0 && absencePending.length === 0 ? `
        <div class="card text-center py-6">
          <div class="text-3xl mb-2">✅</div>
          <p class="text-green-400 font-semibold">Nenhum alerta ativo</p>
          <p class="text-gray-400 text-sm mt-1">Sem inadimplências ou faltas pendentes de reposição.</p>
        </div>` : ''}

        ${dEntries.length > 0 ? `
        <div class="card bg-red-900/20 border border-red-700/40">
          <p class="text-red-300 font-semibold mb-3">💰 ${dEntries.length} aluno(s) em inadimplência</p>
          <div class="space-y-0">
            ${dEntries.map(([alunoId, info]) => {
              const s = DB.findById('students', alunoId);
              return s ? `<div class="flex justify-between text-sm py-1.5 border-b border-red-900/30 last:border-0">
                <span class="text-gray-200">${s.nome}</span>
                <span class="text-red-400 font-medium">R$ ${info.total.toFixed(2)}</span>
              </div>` : '';
            }).join('')}
          </div>
        </div>` : ''}

        ${absencePending.length > 0 ? `
        <div class="card bg-yellow-900/20 border border-yellow-700/40">
          <p class="text-yellow-300 font-semibold mb-3">📋 ${absencePending.length} falta(s) sem reposição</p>
          <div class="space-y-0">
            ${absencePending.map(f => {
              const s = DB.findById('students', f.alunoId);
              return s ? `<div class="flex justify-between text-sm py-1.5 border-b border-yellow-900/30 last:border-0">
                <span class="text-gray-200">${s.nome}</span>
                <span class="text-yellow-400">${Utils.formatDate(f.data)}</span>
              </div>` : '';
            }).join('')}
          </div>
        </div>` : ''}
      </div>

      <!-- Quem recebe alertas -->
      <div class="card">
        <p class="section-title">👥 Quem recebe alertas da equipe</p>
        <p class="text-xs text-gray-400 mb-3">Funcionários que recebem avisos de inadimplência e falta no chat interno. Administradores sempre recebem.</p>
        <div class="space-y-0">
          ${employees.map(e => `
          <div class="flex items-center justify-between py-2.5 border-b border-gray-700/20 last:border-0">
            <div>
              <p class="text-sm text-white">${e.nome}</p>
              <p class="text-xs text-gray-500">${e.cargo || (e.isAdmin ? 'Administrador' : 'Funcionário')}</p>
            </div>
            <label class="relative inline-flex items-center ${e.isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}">
              <input type="checkbox" ${(e.isAdmin || e.recebe_alertas) ? 'checked' : ''} ${e.isAdmin ? 'disabled' : ''}
                onchange="NotificationSystem.toggleAlerts('${e.id}', this.checked)"
                class="sr-only peer">
              <div class="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-primary-600
                after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
                peer-checked:after:translate-x-4"></div>
            </label>
          </div>`).join('')}
        </div>
      </div>

      <!-- Templates de mensagem -->
      <div>
        <p class="section-title mb-3">✏️ Modelos de mensagem</p>
        <div class="space-y-3">
          ${tpls.map(t => `
          <div class="card">
            <p class="font-semibold text-white text-sm mb-0.5">${t.label}</p>
            <p class="text-xs text-gray-500 mb-2">${t.desc}</p>
            <textarea id="notif_tpl_${t.key}" rows="3"
              class="input-field w-full text-sm resize-y">${esc(this._get(t.key))}</textarea>
            <div class="flex gap-2 mt-2">
              <button onclick="NotificationSystem.saveTemplate('${t.key}')" class="btn-primary btn-sm">💾 Salvar</button>
              <button onclick="NotificationSystem.resetTemplate('${t.key}')" class="btn-secondary btn-sm">↩ Restaurar padrão</button>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  },

  saveTemplate(key) {
    const el = document.getElementById('notif_tpl_' + key);
    if (!el) return;
    Auth.setSetting('notif_' + key, el.value);
    Utils.showToast('✅ Template salvo!', 'success');
  },

  resetTemplate(key) {
    Auth.setSetting('notif_' + key, '');
    const el = document.getElementById('notif_tpl_' + key);
    if (el) el.value = this._defaults[key] || '';
    Utils.showToast('Padrão restaurado!', 'success');
  },

  toggleAlerts(empId, checked) {
    const emp = DB.findById('employees', empId);
    if (!emp) return;
    emp.recebe_alertas = checked;
    DB.save('employees', emp);
  },

  runNow() {
    this.checkAll();
    Utils.showToast('✅ Verificações executadas!', 'success');
    setTimeout(() => this.renderSettings(), 400);
  },
};
