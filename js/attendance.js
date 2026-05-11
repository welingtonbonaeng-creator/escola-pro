/* ===== MÓDULO FREQUÊNCIA ===== */
const AttendanceModule = (() => {

  let selectedStudent = null;

  function render() {
    if (!Auth.can('frequencia','ver')) { App.denied(); return; }
    const students = DB.get('students').filter(s => s.status !== 'formado');
    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 class="text-xl font-bold text-white">Controle de Frequência</h3>
          ${Auth.can('frequencia','criar')?`
          <button onclick="AttendanceModule.openMarkAll()" class="btn-primary">✅ Marcar Presença do Dia</button>`:''}
        </div>
        <div class="relative">
          <input type="text" placeholder="Buscar aluno…"
            class="input-field w-full pl-10" oninput="AttendanceModule.search(this.value)">
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        <div id="attendanceList">
          ${renderList(students)}
        </div>
      </div>`;
  }

  function renderList(students) {
    if (!students.length) return Utils.emptyState('Nenhum aluno ativo encontrado');
    return `
      <div class="space-y-2">
        ${students.map(s => {
          const freq = DB.findBy('attendance','alunoId',s.id);
          const presencas = freq.filter(f=>f.presente).length;
          const faltas = freq.filter(f=>!f.presente).length;
          const pct = freq.length ? Math.round((presencas/freq.length)*100) : 0;
          const mat = s.matriculas?.[0];
          const curso = mat ? DB.findById('courses', mat.cursoId) : null;
          const inadimplente = DB.findBy('financial','alunoId',s.id).some(p=>p.status==='atrasado');
          return `
          <div class="card cursor-pointer hover:border-primary-700/50 transition-colors" onclick="AttendanceModule.openStudentDetail('${s.id}')">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary-800 flex items-center justify-center font-bold text-primary-200 flex-shrink-0">
                ${Utils.initials(s.nome)}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-white">${s.nome}</span>
                  ${Utils.statusBadge(s.status)}
                  ${inadimplente?'<span class="badge badge-red">⚠️ Inadimplente</span>':''}
                </div>
                <div class="text-xs text-gray-400 mt-0.5">${curso?.nome||'Sem curso'} · ${Utils.formatPhone(s.telefone)}</div>
              </div>
              <div class="text-right hidden sm:block">
                <div class="text-lg font-bold ${pct>=75?'text-green-400':pct>=50?'text-yellow-400':'text-red-400'}">${pct}%</div>
                <div class="text-xs text-gray-500">${presencas}P · ${faltas}F</div>
              </div>
              <div class="flex gap-1">
                ${Auth.can('frequencia','criar')?`
                <button onclick="event.stopPropagation();AttendanceModule.quickMark('${s.id}',true)"  class="btn-success btn-sm" title="Presente">✅</button>
                <button onclick="event.stopPropagation();AttendanceModule.quickMark('${s.id}',false)" class="btn-danger btn-sm"  title="Falta">❌</button>`:''}
              </div>
            </div>
            <div class="mt-2">
              <div class="progress-bar"><div class="progress-fill ${pct>=75?'bg-green-500':pct>=50?'bg-yellow-500':'bg-red-500'}" style="width:${pct}%"></div></div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function openStudentDetail(id) {
    const s = DB.findById('students', id);
    if (!s) return;
    const freq = DB.findBy('attendance','alunoId',id).sort((a,b)=>new Date(b.data)-new Date(a.data));
    const presencas = freq.filter(f=>f.presente).length;
    const faltas = freq.filter(f=>!f.presente).length;
    const pct = freq.length ? Math.round((presencas/freq.length)*100) : 0;
    const mat = s.matriculas?.[0];
    const curso = mat ? DB.findById('courses', mat.cursoId) : null;
    const inadimplente = DB.findBy('financial','alunoId',id).some(p=>p.status==='atrasado');

    Utils.showModal(`
      <div class="p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">${s.nome}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>

        <!-- Status e resumo -->
        <div class="grid grid-cols-3 gap-3">
          <div class="card card-sm text-center"><div class="text-2xl font-bold text-green-400">${presencas}</div><div class="text-xs text-gray-400">Presenças</div></div>
          <div class="card card-sm text-center"><div class="text-2xl font-bold text-red-400">${faltas}</div><div class="text-xs text-gray-400">Faltas</div></div>
          <div class="card card-sm text-center"><div class="text-2xl font-bold ${pct>=75?'text-green-400':pct>=50?'text-yellow-400':'text-red-400'}">${pct}%</div><div class="text-xs text-gray-400">Frequência</div></div>
        </div>

        <div class="card card-sm">
          <div class="stat-row text-sm"><span class="text-gray-400">Curso</span><span class="text-white">${curso?.nome||'—'}</span></div>
          <div class="stat-row text-sm"><span class="text-gray-400">Status</span>${Utils.statusBadge(s.status)}</div>
          <div class="stat-row text-sm"><span class="text-gray-400">Início</span><span class="text-white">${Utils.formatDate(mat?.dataInicio)}</span></div>
          ${inadimplente?`<div class="mt-2 bg-red-900/30 border border-red-700/40 rounded-lg p-2 text-red-300 text-sm">⚠️ Aluno com parcelas em atraso</div>`:''}
        </div>

        <!-- Marcar presença manual -->
        ${Auth.can('frequencia','criar')?`
        <div>
          <p class="section-title">Registrar Presença</p>
          <div class="flex gap-2">
            <input type="date" id="freqDate" class="input-field flex-1" value="${new Date().toISOString().slice(0,10)}">
            <button onclick="AttendanceModule.markManual('${id}',true)"  class="btn-success">✅ Presente</button>
            <button onclick="AttendanceModule.markManual('${id}',false)" class="btn-danger">❌ Falta</button>
          </div>
        </div>`:''}

        <!-- Enviar mensagem via Chat interno -->
        <div>
          <p class="section-title">Enviar Mensagem ao Aluno</p>
          <div class="flex flex-wrap gap-2">
            <button onclick="AttendanceModule.sendWA('${id}','boas_vindas')"   class="btn-secondary btn-sm">👋 Boas-vindas</button>
            <button onclick="AttendanceModule.sendWA('${id}','lembrete')"      class="btn-secondary btn-sm">⏰ Lembrete de Aula</button>
            <button onclick="AttendanceModule.sendWA('${id}','falta')"         class="btn-secondary btn-sm">❌ Aviso de Falta</button>
            <button onclick="AttendanceModule.sendWA('${id}','reposicao')"     class="btn-secondary btn-sm">🔄 Reposição</button>
            <button onclick="AttendanceModule.sendWA('${id}','financeiro')"    class="btn-danger btn-sm">💰 Contato Financeiro</button>
          </div>
          <p class="text-xs text-gray-500 mt-1">💬 As mensagens são enviadas direto ao chat do aluno no portal</p>
        </div>

        <!-- Histórico -->
        <div>
          <p class="section-title">Histórico Recente</p>
          <div class="space-y-1 max-h-48 overflow-y-auto">
            ${freq.slice(0,20).map(f=>`
              <div class="flex items-center justify-between py-1.5 border-b border-gray-700/40 last:border-0 text-sm">
                <span class="text-gray-300">${Utils.formatDate(f.data)}</span>
                <span class="${f.presente?'text-green-400':'text-red-400'}">${f.presente?'✅ Presente':'❌ Falta'}</span>
                <span class="text-gray-500 text-xs">${f.tipo==='reposicao'?'🔄 Reposição':''}</span>
              </div>`).join('')}
            ${!freq.length?'<p class="text-gray-500 text-sm text-center py-4">Nenhum registro</p>':''}
          </div>
        </div>

        <div class="flex justify-end">
          <button onclick="Utils.closeModal()" class="btn-secondary">Fechar</button>
        </div>
      </div>`);
  }

  function quickMark(alunoId, presente) {
    const today = new Date().toISOString().slice(0,10);
    const existing = DB.get('attendance').find(f => f.alunoId===alunoId && f.data===today);
    if (existing) {
      existing.presente = presente;
      DB.save('attendance', existing);
    } else {
      DB.save('attendance', { alunoId, data:today, presente, tipo:'normal', obs:'', createdAt:new Date().toISOString() });
    }
    const s = DB.findById('students', alunoId);
    Utils.showToast(`${s?.nome} — ${presente?'Presente ✅':'Falta ❌'}`, presente?'success':'error');
    render();
  }

  function markManual(alunoId, presente) {
    const dateEl = document.getElementById('freqDate');
    const data = dateEl?.value || new Date().toISOString().slice(0,10);
    const existing = DB.get('attendance').find(f => f.alunoId===alunoId && f.data===data);
    if (existing) { existing.presente = presente; DB.save('attendance', existing); }
    else DB.save('attendance', { alunoId, data, presente, tipo:'normal', obs:'', createdAt:new Date().toISOString() });
    Utils.showToast(`Presença registrada para ${Utils.formatDate(data)}`, 'success');
    Utils.closeModal();
    render();
  }

  function openMarkAll() {
    const students = DB.get('students').filter(s=>s.status==='ativo');
    const today = new Date().toISOString().slice(0,10);
    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-white">Chamada do Dia — ${Utils.formatDate(today)}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white">✕</button>
        </div>
        <div class="space-y-2 mb-5 max-h-96 overflow-y-auto">
          ${students.map(s=>{
            const reg = DB.get('attendance').find(f=>f.alunoId===s.id&&f.data===today);
            return `
            <div class="flex items-center justify-between py-2 border-b border-gray-700/40">
              <span class="text-white text-sm">${s.nome}</span>
              <div class="flex gap-2">
                <button onclick="this.dataset.val='P';this.classList.add('bg-green-700');this.nextElementSibling.classList.remove('bg-red-700')" data-id="${s.id}" data-val="${reg?.presente===true?'P':''}" class="btn-sm border border-green-700 text-green-400 rounded px-3 ${reg?.presente===true?'bg-green-700':''}">P</button>
                <button onclick="this.dataset.val='F';this.classList.add('bg-red-700');this.previousElementSibling.classList.remove('bg-green-700')"  data-id="${s.id}" data-val="${reg?.presente===false?'F':''}" class="btn-sm border border-red-700 text-red-400 rounded px-3 ${reg?.presente===false?'bg-red-700':''}">F</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="flex justify-end gap-3">
          <button onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
          <button onclick="AttendanceModule.saveMarkAll('${today}')" class="btn-primary">Salvar Chamada</button>
        </div>
      </div>`);
  }

  function saveMarkAll(date) {
    const btns = document.querySelectorAll('[data-id][data-val]');
    btns.forEach(b => {
      if (!b.dataset.val) return;
      const presente = b.dataset.val === 'P';
      const alunoId = b.dataset.id;
      const ex = DB.get('attendance').find(f=>f.alunoId===alunoId&&f.data===date);
      if (ex) { ex.presente = presente; DB.save('attendance', ex); }
      else DB.save('attendance', { alunoId, data:date, presente, tipo:'normal', obs:'', createdAt:new Date().toISOString() });
    });
    Utils.closeModal();
    Utils.showToast('Chamada salva!','success');
    render();
  }

  function sendWA(alunoId, tipo) {
    const s = DB.findById('students', alunoId);
    if (!s) return;
    const msgs = {
      boas_vindas: `Olá, ${s.nome}! 😊 Bem-vindo(a) à nossa escola! Estamos muito felizes em tê-lo(a) conosco. Qualquer dúvida, é só chamar!`,
      lembrete:    `Oi, ${s.nome}! 👋 Lembrando que você tem aula hoje. Te esperamos! 🎓`,
      falta:       `Olá, ${s.nome}. Notamos sua ausência hoje. Sentimos sua falta! Precisando reagendar, é só falar. 😊`,
      reposicao:   `Olá, ${s.nome}! Você tem uma reposição pendente. Entre em contato para agendarmos o melhor horário. 📅`,
      financeiro:  `Olá, ${s.nome}. Identificamos uma pendência financeira no seu cadastro. Por favor, entre em contato para regularizarmos. 🙏`,
    };
    ChatModule.sendTemplate(alunoId, tipo, msgs[tipo] || '');
    Utils.showToast(`Mensagem enviada ao chat de ${s.nome} ✅`, 'success');
    Utils.closeModal();
  }

  function search(q) {
    const students = DB.get('students').filter(s =>
      s.status !== 'formado' &&
      s.nome.toLowerCase().includes(q.toLowerCase())
    );
    const el = document.getElementById('attendanceList');
    if (el) el.innerHTML = renderList(students);
  }

  return { render, openStudentDetail, quickMark, markManual, openMarkAll, saveMarkAll, sendWA, search };
})();
