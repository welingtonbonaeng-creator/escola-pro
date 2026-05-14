/* ===== CHAT INTERNO — Gestor ↔ Funcionários ===== */
const StaffChatModule = (() => {

  let _targetId        = null; // ID do interlocutor selecionado
  let _mediaRecorder   = null;
  let _recChunks       = [];
  let _isRecording     = false;
  let _recTimer        = null;
  let _recSeconds      = 0;
  let _mobileShowChat  = false; // controla coluna visível no mobile

  /* ─── DB helpers ─── */
  function _msgs(id1, id2) {
    return DB.get('internal_messages')
      .filter(m => (m.fromId===id1&&m.toId===id2)||(m.fromId===id2&&m.toId===id1))
      .sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  }

  function _unread(fromId, toId) {
    return DB.get('internal_messages').filter(m=>m.fromId===fromId&&m.toId===toId&&!m.readAt).length;
  }

  function _markRead(fromId, toId) {
    const all = DB.get('internal_messages');
    let changed = false;
    all.forEach(m => { if(m.fromId===fromId&&m.toId===toId&&!m.readAt){ m.readAt=new Date().toISOString(); changed=true; } });
    if (changed) DB.set('internal_messages', all);
  }

  function _save(toId, type, content, fileName=null) {
    const rec = {
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      fromId: Auth.currentUser.id,
      toId, type, content, fileName,
      timestamp: new Date().toISOString(),
      readAt: null
    };
    DB.save('internal_messages', rec);
    return rec;
  }

  function _admins() {
    return DB.get('employees').filter(e=>e.isAdmin&&e.ativo!==false);
  }
  function _employees() {
    return DB.get('employees').filter(e=>!e.isAdmin&&e.id!=='emp_master'&&e.ativo!==false);
  }

  /* ─── HTML helpers ─── */
  function _esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function _bubbles(msgs, myId) {
    if (!msgs.length) return `
      <div class="flex flex-col items-center justify-center h-full text-center py-12">
        <p class="text-5xl mb-3">💬</p>
        <p class="text-gray-500 text-sm">Nenhuma mensagem ainda.</p>
        <p class="text-xs text-gray-600 mt-1">Diga olá!</p>
      </div>`;

    return msgs.map(m => {
      const mine  = m.fromId === myId;
      const sender = !mine ? (DB.findById('employees', m.fromId)?.nome || '?') : null;
      const d = new Date(m.timestamp);
      const time  = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

      let body = '';
      if      (m.type==='text')  body = `<p class="text-sm whitespace-pre-wrap break-words">${_esc(m.content)}</p>`;
      else if (m.type==='image') body = `<img src="${m.content}" alt="imagem" class="max-w-full max-h-56 rounded-xl cursor-pointer object-cover" onclick="StaffChatModule.viewImg('${m.id}')">`;
      else if (m.type==='audio') body = `<audio controls src="${m.content}" class="w-full" style="min-width:200px;max-width:300px"></audio>`;
      else if (m.type==='video') body = `<video controls src="${m.content}" class="max-w-full max-h-48 rounded-xl"></video>`;

      return `
      <div class="flex ${mine?'justify-end':'justify-start'} mb-2">
        <div class="max-w-xs sm:max-w-sm">
          ${!mine?`<p class="text-xs text-gray-500 mb-0.5 px-1 font-medium">${_esc(sender)}</p>`:''}
          <div class="px-3 py-2 rounded-2xl ${mine?'bg-primary-700 text-white rounded-br-sm':'bg-gray-700 text-gray-100 rounded-bl-sm'}">
            ${body}
          </div>
          <p class="text-xs text-gray-600 mt-0.5 ${mine?'text-right':'text-left'} px-1">${time}</p>
        </div>
      </div>`;
    }).join('');
  }

  function _inputBar(toId) {
    return `
      <!-- Barra de gravação -->
      <div id="recBar" class="hidden items-center gap-2 bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2 mb-2">
        <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"></span>
        <span class="text-red-300 text-sm flex-1">Gravando… <span id="recClock">0s</span></span>
        <button onclick="StaffChatModule.stopRec('${toId}')" class="btn-danger btn-sm px-3">⏹ Enviar</button>
        <button onclick="StaffChatModule.cancelRec()" class="btn-ghost btn-sm px-2 text-gray-400">✕</button>
      </div>

      <div class="flex items-end gap-2">
        <!-- Anexar -->
        <div class="relative flex-shrink-0">
          <button onclick="StaffChatModule.toggleMenu()" class="p-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all" title="Enviar mídia">📎</button>
          <div id="attachMenu" class="hidden absolute bottom-12 left-0 z-20 bg-gray-800 border border-gray-700/50 rounded-xl shadow-2xl p-1 w-44">
            <label class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700/70 cursor-pointer text-sm text-gray-200">
              📷 Imagem
              <input type="file" accept="image/*" capture="environment" class="hidden" onchange="StaffChatModule.sendFile(event,'${toId}','image')">
            </label>
            <label class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700/70 cursor-pointer text-sm text-gray-200">
              🎬 Vídeo
              <input type="file" accept="video/*" class="hidden" onchange="StaffChatModule.sendFile(event,'${toId}','video')">
            </label>
            <button onclick="StaffChatModule.startRec('${toId}')" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700/70 text-sm text-gray-200 text-left">
              🎙️ Gravar Áudio
            </button>
          </div>
        </div>

        <!-- Texto -->
        <textarea id="scInput" rows="1" placeholder="Mensagem…"
          class="flex-1 input-field resize-none overflow-y-auto"
          style="min-height:40px;max-height:96px"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();StaffChatModule.sendTxt('${toId}')}"
          oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,96)+'px'"></textarea>

        <button onclick="StaffChatModule.sendTxt('${toId}')" class="btn-primary px-4 py-2 flex-shrink-0">➤</button>
      </div>`;
  }

  function _chatPanel(targetId, targetName) {
    const myId = Auth.currentUser.id;
    const msgs = _msgs(myId, targetId);
    _markRead(targetId, myId);
    return `
      <div class="flex flex-col h-full">
        <div class="flex items-center gap-3 p-3 border-b border-gray-700/50 flex-shrink-0">
          <button onclick="StaffChatModule.backToList()" class="lg:hidden p-1 text-gray-400 hover:text-white" title="Voltar">←</button>
          <div class="w-9 h-9 rounded-full bg-primary-800 flex items-center justify-center font-bold text-primary-200 text-sm flex-shrink-0">${Utils.initials(targetName)}</div>
          <p class="font-semibold text-white truncate">${_esc(targetName)}</p>
        </div>
        <div id="scMsgs" class="flex-1 overflow-y-auto p-4" style="min-height:0">
          ${_bubbles(msgs, myId)}
        </div>
        <div class="p-3 border-t border-gray-700/50 flex-shrink-0">
          ${_inputBar(targetId)}
        </div>
      </div>`;
  }

  /* ─── RENDER GESTOR ─── */
  function renderManagerView() {
    const emps = _employees();
    const myId = Auth.currentUser.id;

    // No mobile: se chat selecionado, mostra só o chat
    const showList = !_mobileShowChat || !_targetId;
    const showChat = _mobileShowChat  || !!_targetId;

    document.getElementById('mainContent').innerHTML = `
      <div class="flex gap-0 overflow-hidden rounded-2xl border border-gray-700/40" style="height:calc(100vh - 140px)">

        <!-- Lista de funcionários -->
        <div class="${showList?'flex':'hidden'} lg:flex flex-col w-full lg:w-64 xl:w-72 flex-shrink-0 border-r border-gray-700/40 bg-gray-800/60">
          <div class="p-3 border-b border-gray-700/40">
            <p class="font-semibold text-white text-sm">👔 Equipe (${emps.length})</p>
          </div>
          <div class="flex-1 overflow-y-auto divide-y divide-gray-700/30">
            ${emps.length === 0
              ? `<p class="text-gray-500 text-sm text-center py-10">Nenhum funcionário ativo</p>`
              : emps.map(e => {
                  const u = _unread(e.id, myId);
                  const sel = _targetId === e.id;
                  return `
                  <button onclick="StaffChatModule.select('${e.id}')"
                    class="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-700/40 transition-all ${sel?'bg-primary-900/40 border-l-2 border-primary-500':''}">
                    <div class="relative flex-shrink-0">
                      <div class="w-10 h-10 rounded-full bg-primary-800 flex items-center justify-center font-bold text-primary-200 text-sm">${Utils.initials(e.nome)}</div>
                      ${u>0?`<span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">${u}</span>`:''}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-white truncate">${_esc(e.nome)}</p>
                      <p class="text-xs text-gray-500 truncate">${e.cargo||'Funcionário'}</p>
                    </div>
                  </button>`;
                }).join('')
            }
          </div>
        </div>

        <!-- Área de chat -->
        <div class="${showChat?'flex':'hidden'} lg:flex flex-col flex-1 bg-gray-900/40" id="scChatArea">
          ${_targetId
            ? _chatPanel(_targetId, DB.findById('employees',_targetId)?.nome||'Funcionário')
            : `<div class="flex flex-col items-center justify-center h-full text-center">
                <p class="text-5xl mb-3">💬</p>
                <p class="text-gray-400 text-sm">Selecione um funcionário para conversar</p>
               </div>`
          }
        </div>
      </div>`;

    setTimeout(_scrollBottom, 60);
  }

  /* ─── RENDER FUNCIONÁRIO ─── */
  function renderEmployeeView() {
    const admins = _admins();
    if (!admins.length) {
      document.getElementById('mainContent').innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-center">
          <p class="text-4xl mb-3">💬</p>
          <p class="text-gray-400 text-sm">Nenhum gestor disponível no sistema.</p>
        </div>`;
      return;
    }
    if (!_targetId || !admins.find(a=>a.id===_targetId)) _targetId = admins[0].id;

    document.getElementById('mainContent').innerHTML = `
      <div class="flex flex-col border border-gray-700/40 rounded-2xl overflow-hidden" style="height:calc(100vh - 140px)">
        ${_chatPanel(_targetId, DB.findById('employees',_targetId)?.nome||'Gestor')}
      </div>`;

    setTimeout(_scrollBottom, 60);
  }

  /* ─── render principal ─── */
  function render() {
    if (!Auth.logged) { App.denied(); return; }
    if (Auth.isEmployee) renderEmployeeView();
    else                 renderManagerView();
  }

  /* ─── Ações públicas ─── */
  function select(empId) {
    _targetId       = empId;
    _mobileShowChat = true;
    renderManagerView();
    setTimeout(_scrollBottom, 80);
  }

  function backToList() {
    _mobileShowChat = false;
    renderManagerView();
  }

  function sendTxt(toId) {
    const inp = document.getElementById('scInput');
    const txt = inp?.value.trim();
    if (!txt) return;
    _save(toId, 'text', txt);
    inp.value = ''; inp.style.height='auto';
    _refresh(toId);
  }

  function sendFile(ev, toId, type) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const maxMB = type==='video' ? 25 : 8;
    if (file.size > maxMB*1024*1024) {
      Utils.showToast(`Arquivo muito grande. Máximo ${maxMB}MB para ${type==='video'?'vídeo':'imagem'}.`,'error'); return;
    }
    document.getElementById('attachMenu')?.classList.add('hidden');
    Utils.showToast('Enviando…','info');
    if (type === 'image') {
      _compress(file).then(b64 => { _save(toId,'image',b64,file.name); _refresh(toId); });
    } else {
      const r = new FileReader();
      r.onload = e => { _save(toId,type,e.target.result,file.name); _refresh(toId); };
      r.readAsDataURL(file);
    }
  }

  async function startRec(toId) {
    document.getElementById('attachMenu')?.classList.add('hidden');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      _recChunks = [];
      _mediaRecorder = new MediaRecorder(stream);
      _mediaRecorder.ondataavailable = e => _recChunks.push(e.data);
      _mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t=>t.stop());
        clearInterval(_recTimer);
        const blob = new Blob(_recChunks,{type:'audio/webm'});
        const r = new FileReader();
        r.onload = e => { _save(toId,'audio',e.target.result,'audio.webm'); _isRecording=false; _refresh(toId); };
        r.readAsDataURL(blob);
        const bar = document.getElementById('recBar');
        if (bar) bar.classList.replace('flex','hidden');
      };
      _mediaRecorder.start();
      _isRecording = true; _recSeconds = 0;
      const bar = document.getElementById('recBar');
      if (bar) bar.classList.replace('hidden','flex');
      _recTimer = setInterval(()=>{
        _recSeconds++;
        const el = document.getElementById('recClock');
        if (el) el.textContent = _recSeconds+'s';
        if (_recSeconds >= 120) stopRec(toId);
      },1000);
    } catch(_){ Utils.showToast('Não foi possível acessar o microfone','error'); }
  }

  function stopRec(toId) {
    if (_mediaRecorder && _isRecording) _mediaRecorder.stop();
  }

  function cancelRec() {
    if (_mediaRecorder && _isRecording) {
      _mediaRecorder.ondataavailable = null;
      _mediaRecorder.onstop = ()=>{};
      _mediaRecorder.stop();
      _isRecording = false;
      clearInterval(_recTimer);
    }
    const bar = document.getElementById('recBar');
    if (bar) bar.classList.replace('flex','hidden');
  }

  function toggleMenu() {
    const m = document.getElementById('attachMenu');
    if (m) m.classList.toggle('hidden');
  }

  function viewImg(msgId) {
    const m = DB.get('internal_messages').find(x=>x.id===msgId);
    if (!m) return;
    Utils.showModal(`
      <div class="p-4">
        <div class="flex justify-end mb-2"><button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white text-xl">✕</button></div>
        <img src="${m.content}" class="max-w-full max-h-[80vh] rounded-xl mx-auto">
      </div>`);
  }

  function _refresh(toId) {
    const myId = Auth.currentUser.id;
    const msgs = _msgs(myId, toId);
    _markRead(toId, myId);
    const el = document.getElementById('scMsgs');
    if (el) { el.innerHTML = _bubbles(msgs, myId); setTimeout(_scrollBottom, 30); }
    // Atualiza badge na lista do gestor
    const btns = document.querySelectorAll('[data-sc-emp]');
    btns.forEach(b => {
      const id = b.dataset.scEmp;
      const u  = _unread(id, myId);
      b.textContent = u||''; b.style.display = u>0?'flex':'none';
    });
  }

  function _scrollBottom() {
    const el = document.getElementById('scMsgs');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function _compress(file, maxW=1200, q=0.80) {
    return new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, maxW/img.width);
          const c = document.createElement('canvas');
          c.width = img.width*s; c.height = img.height*s;
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          resolve(c.toDataURL('image/jpeg',q));
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  function totalUnread() {
    if (!Auth.logged) return 0;
    /* Exclui mensagens automáticas do sistema (fromId='system') — essas ficam no painel de Notificações */
    return DB.get('internal_messages').filter(m=>m.toId===Auth.currentUser.id&&!m.readAt&&m.fromId!=='system').length;
  }

  return { render, renderManagerView, renderEmployeeView, select, backToList, sendTxt, sendFile, startRec, stopRec, cancelRec, toggleMenu, viewImg, totalUnread };
})();
