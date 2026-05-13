/* ===== MÓDULO VISITAS ===== */
const VisitsModule = (() => {

  const TEMP = {
    '':           { label:'— Sem classificação', short:'— S/ class.',   cls:'bg-gray-700/50 text-gray-400 border-gray-600/40' },
    frio:         { label:'❄️ Frio',             short:'❄️ Frio',       cls:'bg-blue-900/50 text-blue-300 border-blue-700/40' },
    morno:        { label:'🌡️ Morno',            short:'🌡️ Morno',     cls:'bg-yellow-900/50 text-yellow-300 border-yellow-700/40' },
    quente:       { label:'🔥 Quente',           short:'🔥 Quente',     cls:'bg-orange-900/50 text-orange-300 border-orange-700/40' },
    muito_quente: { label:'🚀 Muito Quente',     short:'🚀 M. Quente',  cls:'bg-red-900/50 text-red-300 border-red-700/40' },
  };

  const ORIGENS = [
    { key: '',           label: '— Não informado' },
    { key: 'instagram',  label: '📸 Instagram' },
    { key: 'facebook',   label: '👍 Facebook / Meta Ads' },
    { key: 'whatsapp',   label: '📱 WhatsApp' },
    { key: 'indicacao',  label: '🤝 Indicação' },
    { key: 'olx',        label: '📌 OLX' },
    { key: 'plantao',    label: '🏢 Plantão de Vendas' },
    { key: 'google',     label: '🔍 Google' },
    { key: 'site',       label: '🌐 Site' },
    { key: 'outro',      label: '💬 Outro' },
  ];

  let _filters = { q:'', temp:'', de:'', ate:'' };

  /* ── helpers ── */
  function _getAll()     { return DB.get('visits').filter(v => v.status === 'visita'); }
  function _getFiltered() {
    let list = _getAll();
    const { q, temp, de, ate } = _filters;
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter(v =>
        v.nome.toLowerCase().includes(lq) ||
        (v.telefone||'').includes(q) ||
        (v.email||'').toLowerCase().includes(lq)
      );
    }
    if (temp) list = list.filter(v => (v.temperatura||'') === temp);
    if (de)   list = list.filter(v => v.createdAt >= de);
    if (ate)  list = list.filter(v => v.createdAt <= ate + 'T23:59:59');
    return list;
  }

  function _tempBadge(t) {
    const cfg = TEMP[t||''] || TEMP[''];
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cfg.cls}">${cfg.short}</span>`;
  }

  function _refreshList() {
    const filtered = _getFiltered();
    const el = document.getElementById('visitsList');
    if (el) el.innerHTML = renderList(filtered);
    const cnt = document.getElementById('visCount');
    if (cnt) cnt.textContent = `${filtered.length} de ${_getAll().length} lead(s)`;
  }

  /* ── render principal ── */
  function render() {
    if (!Auth.can('visitas','ver')) { App.denied(); return; }
    const all      = _getAll();
    const filtered = _getFiltered();

    const chipBtn = (val, lbl) => {
      const cnt    = val ? all.filter(v => (v.temperatura||'') === val).length : all.length;
      const active = _filters.temp === val;
      return `<button onclick="VisitsModule.setFilter('temp','${val}')"
        class="px-3 py-1 rounded-full text-xs font-medium border transition-all
          ${active
            ? 'bg-primary-600 border-primary-500 text-white'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-primary-500'}">
        ${lbl} <span class="opacity-60">(${cnt})</span>
      </button>`;
    };

    document.getElementById('mainContent').innerHTML = `
      <div class="space-y-4">

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold text-white">Visitas / Leads</h3>
            <p class="text-gray-400 text-sm" id="visCount">${filtered.length} de ${all.length} lead(s)</p>
          </div>
          ${Auth.can('visitas','criar') ? `<button onclick="VisitsModule.openForm()" class="btn-primary">+ Nova Visita</button>` : ''}
        </div>

        <!-- Painel de Filtros -->
        <div class="card p-4 space-y-3">

          <!-- Busca -->
          <div class="relative">
            <input type="text" placeholder="Buscar por nome, telefone ou e-mail…"
              class="input-field w-full pl-10" value="${_filters.q}"
              oninput="VisitsModule.setFilter('q',this.value)">
            <span class="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          </div>

          <!-- Chips temperatura -->
          <div class="flex flex-wrap gap-2">
            ${chipBtn('','🏷️ Todos')}
            ${chipBtn('frio','❄️ Frio')}
            ${chipBtn('morno','🌡️ Morno')}
            ${chipBtn('quente','🔥 Quente')}
            ${chipBtn('muito_quente','🚀 Muito Quente')}
          </div>

          <!-- Período + export -->
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="form-label text-xs">Cadastrado de</label>
              <input type="date" class="input-field text-sm" value="${_filters.de}"
                onchange="VisitsModule.setFilter('de',this.value)">
            </div>
            <div>
              <label class="form-label text-xs">Até</label>
              <input type="date" class="input-field text-sm" value="${_filters.ate}"
                onchange="VisitsModule.setFilter('ate',this.value)">
            </div>
            <button onclick="VisitsModule.clearFilters()" class="btn-secondary btn-sm self-end">✕ Limpar</button>
            <button onclick="VisitsModule.exportWord()" class="btn-secondary btn-sm self-end">📄 Exportar Word</button>
          </div>
        </div>

        <!-- Lista -->
        <div class="card overflow-x-auto p-0" id="visitsList">
          ${renderList(filtered)}
        </div>
      </div>`;
  }

  function _origemBadge(key) {
    const o = ORIGENS.find(x => x.key === (key||'')) || ORIGENS[0];
    if (!key) return '<span class="text-gray-600 text-xs">—</span>';
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-700/60 border border-gray-600/40 text-gray-300">${o.label}</span>`;
  }

  function renderList(visits) {
    if (!visits.length) return Utils.emptyState('Nenhum lead encontrado com os filtros aplicados');
    return `
      <table class="w-full">
        <thead><tr class="table-header">
          <th>Nome</th>
          <th class="hidden sm:table-cell">Temperatura</th>
          <th class="hidden md:table-cell">Origem</th>
          <th class="hidden lg:table-cell">Atendente</th>
          <th class="hidden lg:table-cell text-center">Obs.</th>
          <th class="text-right pr-4">Ações</th>
        </tr></thead>
        <tbody>
          ${visits.map(v => {
            const atendente = v.vendedorId ? DB.findById('employees', v.vendedorId) : null;
            return `
          <tr class="table-row">
            <td>
              <div class="font-medium text-white">${v.nome}</div>
              <div class="text-xs text-gray-400">${Utils.calcAge(v.dataNascimento)} anos · ${v.sexo==='M'?'Masculino':'Feminino'}</div>
              <div class="sm:hidden mt-0.5">${_tempBadge(v.temperatura)}</div>
            </td>
            <td class="hidden sm:table-cell">${_tempBadge(v.temperatura)}</td>
            <td class="hidden md:table-cell">${_origemBadge(v.origem)}</td>
            <td class="hidden lg:table-cell text-gray-400 text-sm">${atendente?.nome || '—'}</td>
            <td class="hidden lg:table-cell text-center">
              ${(v.observacoes||[]).length
                ? `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-800 text-primary-200 text-xs font-bold">${(v.observacoes||[]).length}</span>`
                : '<span class="text-gray-600 text-xs">—</span>'}
            </td>
            <td class="text-right pr-3">
              <div class="flex items-center justify-end gap-1">
                <button onclick="VisitsModule.openDetail('${v.id}')" class="btn-ghost btn-sm" title="Detalhes e Observações">📋</button>
                ${Auth.can('visitas','editar') ? `<button onclick="VisitsModule.openForm('${v.id}')" class="btn-ghost btn-sm">✏️</button>` : ''}
                <button onclick="VisitsModule.convertToStudent('${v.id}')" class="btn-success btn-sm" title="Converter em Aluno">🎓</button>
                ${Auth.can('visitas','excluir') ? `<button onclick="VisitsModule.remove('${v.id}')" class="btn-danger btn-sm">🗑️</button>` : ''}
              </div>
            </td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  /* ── filtros ── */
  function setFilter(key, val) {
    _filters[key] = val;
    if (key === 'temp') render();   // atualiza chips ativos
    else _refreshList();
  }

  function clearFilters() {
    _filters = { q:'', temp:'', de:'', ate:'' };
    render();
  }

  /* ── modal de detalhes + observações ── */
  function openDetail(id) {
    const v = DB.findById('visits', id);
    if (!v) return;
    const obs = (v.observacoes||[]).slice().reverse();

    const tempBtn = (val, lbl) =>
      `<button onclick="VisitsModule.setTemperatura('${id}','${val}')"
        class="px-3 py-1.5 rounded-full text-xs font-medium border transition-all
          ${(v.temperatura||'') === val
            ? 'bg-primary-600 border-primary-500 text-white'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-primary-500'}">
        ${lbl}
      </button>`;

    const atendente = v.vendedorId ? DB.findById('employees', v.vendedorId) : null;
    const origemLabel = ORIGENS.find(x => x.key === (v.origem||''))?.label || '—';

    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="text-lg font-bold text-white">${v.nome}</h3>
            <p class="text-gray-400 text-sm">${Utils.formatPhone(v.telefone)}${v.email ? ' · '+v.email : ''} · Cadastro: ${Utils.formatDate(v.createdAt)}</p>
          </div>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        <!-- Origem & Atendimento -->
        <div class="mb-5">
          <p class="section-title mb-2">📋 Origem & Atendimento</p>
          <div class="card card-sm grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div class="text-center">
              <p class="text-gray-500 text-xs mb-1">Origem do Lead</p>
              <p class="text-white font-medium">${origemLabel}</p>
            </div>
            <div class="text-center">
              <p class="text-gray-500 text-xs mb-1">Atendente / Vendedor</p>
              <p class="text-white font-medium">${atendente?.nome || '—'}</p>
            </div>
            <div class="text-center">
              <p class="text-gray-500 text-xs mb-1">Gerador / Captador</p>
              <p class="text-white font-medium">${v.geradorNome || '—'}</p>
            </div>
          </div>
        </div>

        <!-- Temperatura -->
        <div class="mb-5">
          <p class="section-title mb-2">🌡️ Temperatura do Lead</p>
          <div class="flex flex-wrap gap-2">
            ${tempBtn('','— Sem classificação')}
            ${tempBtn('frio','❄️ Frio')}
            ${tempBtn('morno','🌡️ Morno')}
            ${tempBtn('quente','🔥 Quente')}
            ${tempBtn('muito_quente','🚀 Muito Quente')}
          </div>
        </div>

        <!-- Observações -->
        <div>
          <p class="section-title mb-2">📝 Observações (${(v.observacoes||[]).length})</p>

          <div class="flex gap-2 mb-3">
            <input type="text" id="obsInput" placeholder="Nova observação sobre este lead…" class="input-field flex-1"
              onkeydown="if(event.key==='Enter')VisitsModule.addObservacao('${id}')">
            <button onclick="VisitsModule.addObservacao('${id}')" class="btn-primary px-4">Adicionar</button>
          </div>

          <div class="space-y-2 max-h-64 overflow-y-auto">
            ${obs.length ? obs.map(o => `
              <div class="bg-gray-800/60 border border-gray-700/40 rounded-xl p-3">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm text-gray-200 flex-1">${o.texto}</p>
                  ${Auth.can('visitas','excluir')
                    ? `<button onclick="VisitsModule.removeObservacao('${id}','${o.id}')" class="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 mt-0.5" title="Remover">✕</button>`
                    : ''}
                </div>
                <p class="text-xs text-gray-500 mt-1.5">${o.autor} · ${Utils.formatDate(o.createdAt)}</p>
              </div>`).join('')
            : `<div class="text-center py-8">
                <p class="text-gray-500 text-sm">Nenhuma observação ainda.</p>
                <p class="text-gray-600 text-xs mt-1">Adicione notas sobre o interesse, objeções, próximos passos…</p>
              </div>`}
          </div>
        </div>
      </div>`);

    setTimeout(() => { const el = document.getElementById('obsInput'); if (el) el.focus(); }, 80);
  }

  function setTemperatura(id, temp) {
    const v = DB.findById('visits', id);
    if (!v) return;
    v.temperatura = temp || null;
    DB.save('visits', v);
    Utils.showToast('Temperatura atualizada!', 'success');
    openDetail(id);
    _refreshList();
  }

  function addObservacao(id) {
    const input = document.getElementById('obsInput');
    const texto = input?.value.trim();
    if (!texto) return;
    const v = DB.findById('visits', id);
    if (!v) return;
    if (!v.observacoes) v.observacoes = [];
    v.observacoes.push({
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      texto,
      autor:     Auth.currentUser?.nome || 'Funcionário',
      createdAt: new Date().toISOString()
    });
    DB.save('visits', v);
    openDetail(id);
    _refreshList();
  }

  function removeObservacao(visitId, obsId) {
    const v = DB.findById('visits', visitId);
    if (!v) return;
    v.observacoes = (v.observacoes||[]).filter(o => o.id !== obsId);
    DB.save('visits', v);
    openDetail(visitId);
    _refreshList();
  }

  /* ── exportar Word ── */
  function exportWord() {
    const visits = _getFiltered();
    if (!visits.length) { Utils.showToast('Nenhum lead para exportar com os filtros atuais','error'); return; }

    const tLabel = k => (TEMP[k||''] || TEMP['']).label;
    const today  = new Date().toLocaleDateString('pt-BR');
    const filterDesc = [
      _filters.temp ? 'Temperatura: ' + tLabel(_filters.temp) : '',
      _filters.de   ? 'De: ' + _filters.de : '',
      _filters.ate  ? 'Até: ' + _filters.ate : '',
      _filters.q    ? `Busca: "${_filters.q}"` : '',
    ].filter(Boolean).join(' | ');

    const rows = visits.map(v => {
      const obsText = (v.observacoes||[])
        .slice().reverse()
        .map(o => `• ${Utils.formatDate(o.createdAt)} — ${o.texto}`)
        .join('\n');
      return `<tr>
        <td>${v.nome}</td>
        <td>${Utils.formatPhone(v.telefone)}</td>
        <td>${v.email||'—'}</td>
        <td>${tLabel(v.temperatura)}</td>
        <td>${Utils.formatDate(v.createdAt)}</td>
        <td style="white-space:pre-line;font-size:9pt">${obsText||'—'}</td>
      </tr>`;
    }).join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>Leads — EscolaPro</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  body  { font-family:Calibri,Arial,sans-serif; font-size:11pt; margin:2cm; }
  h1    { font-size:15pt; color:#1e3a5f; margin-bottom:3pt; }
  .sub  { color:#555; font-size:9pt; margin-bottom:16pt; }
  table { border-collapse:collapse; width:100%; }
  th    { background:#1e3a5f; color:#fff; padding:7px 10px; font-size:10pt; text-align:left; }
  td    { padding:6px 10px; font-size:10pt; border-bottom:1px solid #dde; vertical-align:top; }
  tr:nth-child(even) td { background:#f6f8fc; }
</style>
</head>
<body>
<h1>Relatório de Leads — EscolaPro</h1>
<p class="sub">Exportado em ${today} &nbsp;|&nbsp; ${visits.length} lead(s)${filterDesc ? ' &nbsp;|&nbsp; Filtros: ' + filterDesc : ''}</p>
<table>
<thead>
  <tr>
    <th>Nome</th><th>Telefone</th><th>E-mail</th><th>Temperatura</th><th>Cadastro</th><th>Observações</th>
  </tr>
</thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;

    const blob = new Blob(['﻿' + html], { type:'application/msword' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `leads_${today.replace(/\//g,'-')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Utils.showToast(`${visits.length} lead(s) exportado(s) com sucesso ✅`, 'success');
  }

  /* ── formulário ── */
  function openForm(id = null) {
    const v        = id ? DB.findById('visits', id) : null;
    const isEdit   = !!v;
    const employees = DB.get('employees').filter(e => e.ativo !== false);

    Utils.showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-white">${isEdit?'Editar Visita':'Nova Visita'}</h3>
          <button onclick="Utils.closeModal()" class="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <form id="visitForm" class="space-y-5" onsubmit="VisitsModule.save(event,'${id||''}')">

          <!-- Temperatura -->
          <div>
            <p class="section-title">🌡️ Temperatura do Lead</p>
            <select name="temperatura" class="input-field mt-1">
              ${Object.entries(TEMP).map(([k,cfg]) =>
                `<option value="${k}" ${(v?.temperatura||'') === k ? 'selected' : ''}>${cfg.label}</option>`
              ).join('')}
            </select>
          </div>

          <!-- Origem & Atendimento -->
          <div>
            <p class="section-title">📋 Origem & Atendimento</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label">Origem do Lead</label>
                <select name="origem" class="input-field">
                  ${ORIGENS.map(o => `<option value="${o.key}" ${(v?.origem||'') === o.key ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">Atendente / Vendedor</label>
                <select name="vendedorId" class="input-field">
                  <option value="">— Selecione —</option>
                  ${employees.map(e => `<option value="${e.id}" ${v?.vendedorId === e.id ? 'selected' : ''}>${e.nome}</option>`).join('')}
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="form-label">Gerador / Captador do Lead</label>
                <input name="geradorNome" class="input-field" placeholder="Nome de quem captou este lead"
                  value="${v?.geradorNome || ''}">
              </div>
            </div>
          </div>

          <div>
            <p class="section-title">Dados Pessoais</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="sm:col-span-2">
                <label class="form-label">Nome Completo *</label>
                <input name="nome" required class="input-field" value="${v?.nome||''}">
              </div>
              <div>
                <label class="form-label">Data de Nascimento *</label>
                <input type="date" name="dataNascimento" required class="input-field" value="${v?.dataNascimento||''}"
                  onchange="VisitsModule.onBirthChange(this.value)">
              </div>
              <div>
                <label class="form-label">Sexo *</label>
                <select name="sexo" required class="input-field">
                  <option value="">Selecione</option>
                  <option value="M" ${v?.sexo==='M'?'selected':''}>Masculino</option>
                  <option value="F" ${v?.sexo==='F'?'selected':''}>Feminino</option>
                </select>
              </div>
              <div>
                <label class="form-label">Tipo de Documento</label>
                <select name="tipoDoc" class="input-field">
                  <option value="CPF" ${v?.tipoDoc==='CPF'?'selected':''}>CPF</option>
                  <option value="RG"  ${v?.tipoDoc==='RG' ?'selected':''}>RG</option>
                </select>
              </div>
              <div>
                <label class="form-label">Número do Documento</label>
                <input name="documento" class="input-field" value="${v?.documento||''}">
              </div>
            </div>
          </div>

          <div>
            <p class="section-title">Endereço</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label">CEP</label>
                <div class="flex gap-2">
                  <input name="cep" id="visCep" class="input-field flex-1" value="${v?.cep||''}"
                    placeholder="00000-000" maxlength="9" oninput="Utils.maskCEP(this)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();VisitsModule.buscarCEP();}">
                  <button type="button" onclick="VisitsModule.buscarCEP()" class="btn-secondary px-3 text-sm">Buscar</button>
                </div>
              </div>
              <div>
                <label class="form-label">Número</label>
                <input name="numero" class="input-field" value="${v?.numero||''}">
              </div>
              <div class="sm:col-span-2">
                <label class="form-label">Endereço (Rua)</label>
                <input name="endereco" id="visEnd" class="input-field" value="${v?.endereco||''}">
              </div>
              <div>
                <label class="form-label">Bairro</label>
                <input name="bairro" id="visBairro" class="input-field" value="${v?.bairro||''}">
              </div>
              <div>
                <label class="form-label">Cidade</label>
                <input name="cidade" id="visCidade" class="input-field" value="${v?.cidade||''}">
              </div>
              <div>
                <label class="form-label">Estado</label>
                <input name="estado" id="visEstado" class="input-field" value="${v?.estado||''}">
              </div>
            </div>
          </div>

          <div>
            <p class="section-title">Contato</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label">Telefone / WhatsApp *</label>
                <input name="telefone" required class="input-field" value="${v?.telefone||''}" placeholder="(21) 99999-9999">
              </div>
              <div>
                <label class="form-label">E-mail</label>
                <input type="email" name="email" class="input-field" value="${v?.email||''}">
              </div>
            </div>
          </div>

          <!-- Responsável (menor) -->
          <div id="respSection" class="${Utils.isMinor(v?.dataNascimento)?'':'hidden'}">
            <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
              <div class="flex items-center justify-between mb-3">
                <p class="text-yellow-400 text-sm font-semibold">⚠️ Menor de Idade — Responsável Financeiro</p>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="temResponsavel" id="temResp" value="sim" ${v?.responsavel?'checked':''}
                    onchange="VisitsModule.toggleResp(this.checked)">
                  <span class="text-sm text-gray-300">Possui responsável?</span>
                </label>
              </div>
              <div id="respFields" class="${v?.responsavel?'':'hidden'} grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label class="form-label">Nome</label><input name="resp_nome" class="input-field" value="${v?.responsavel?.nome||''}"></div>
                <div><label class="form-label">Documento</label><input name="resp_doc" class="input-field" value="${v?.responsavel?.documento||''}"></div>
                <div><label class="form-label">Telefone</label><input name="resp_tel" class="input-field" value="${v?.responsavel?.telefone||''}"></div>
                <div><label class="form-label">E-mail</label><input name="resp_email" class="input-field" value="${v?.responsavel?.email||''}"></div>
                <div class="sm:col-span-2"><label class="form-label">Endereço completo</label><input name="resp_end" class="input-field" value="${v?.responsavel?.endereco||''}"></div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="Utils.closeModal()" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">${isEdit?'Salvar':'Cadastrar'}</button>
          </div>
        </form>
      </div>`);
  }

  function onBirthChange(val) {
    const s = document.getElementById('respSection');
    if (s) s.classList.toggle('hidden', !Utils.isMinor(val));
  }

  function toggleResp(on) {
    const f = document.getElementById('respFields');
    if (f) f.classList.toggle('hidden', !on);
  }

  async function buscarCEP() {
    const cepEl = document.getElementById('visCep');
    if (!cepEl) return;
    const cep = cepEl.value.replace(/\D/g,'');
    if (cep.length !== 8) { Utils.showToast('Digite um CEP válido de 8 dígitos','error'); return; }
    try {
      const d = await Utils.fetchCEP(cep);
      const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||''; };
      set('visEnd', d.logradouro);
      set('visBairro', d.bairro);
      set('visCidade', d.localidade);
      set('visEstado', d.uf);
      Utils.showToast('Endereço preenchido!','success');
    } catch { Utils.showToast('CEP não encontrado','error'); }
  }

  function save(e, id) {
    e.preventDefault();
    const d   = Utils.formData(e.target);
    const old = id ? DB.findById('visits', id) : null;
    let responsavel = null;
    if (d.temResponsavel === 'sim') {
      responsavel = { nome:d.resp_nome, documento:d.resp_doc, telefone:d.resp_tel, email:d.resp_email, endereco:d.resp_end };
    }
    const rec = {
      id:id||undefined,
      nome:d.nome, dataNascimento:d.dataNascimento, sexo:d.sexo,
      tipoDoc:d.tipoDoc, documento:d.documento,
      cep:d.cep, endereco:d.endereco, numero:d.numero, bairro:d.bairro, cidade:d.cidade, estado:d.estado,
      telefone:d.telefone, email:d.email, responsavel,
      temperatura:  d.temperatura || null,
      origem:       d.origem       || null,
      vendedorId:   d.vendedorId   || null,
      geradorNome:  d.geradorNome  || null,
      observacoes:  old?.observacoes || [],
      status:       'visita',
      criadoPor:    id ? old?.criadoPor : Auth.currentUser?.id,
      createdAt:    old?.createdAt || new Date().toISOString(),
    };
    const saved = DB.save('visits', rec);
    Audit.log('visitas', id?'editar':'criar', saved.id, old, saved);
    Utils.closeModal();
    Utils.showToast(id?'Visita atualizada!':'Visita cadastrada com sucesso!','success');
    render();
  }

  async function remove(id) {
    const v = DB.findById('visits', id);
    if (!await Utils.confirm(`Excluir visita de ${v?.nome}? Esta ação não pode ser desfeita.`)) return;
    Audit.log('visitas','excluir',id,v,null);
    DB.remove('visits', id);
    Utils.showToast('Visita excluída','info');
    render();
  }

  async function convertToStudent(visitId) {
    const v = DB.findById('visits', visitId);
    if (!v) return;
    if (!await Utils.confirm(`Converter "${v.nome}" em aluno? O histórico de visita será mantido.`)) return;
    v.status = 'aluno'; v.convertidoEm = new Date().toISOString(); v.convertidoPor = Auth.currentUser?.id;
    DB.save('visits', v);
    const student = {
      visitaId:visitId, nome:v.nome, dataNascimento:v.dataNascimento, sexo:v.sexo,
      tipoDoc:v.tipoDoc, documento:v.documento, cep:v.cep, endereco:v.endereco,
      numero:v.numero, bairro:v.bairro, cidade:v.cidade, estado:v.estado,
      telefone:v.telefone, email:v.email, responsavel:v.responsavel,
      status:'ativo', matriculas:[], criadoPor:Auth.currentUser?.id
    };
    const saved = DB.save('students', student);
    Audit.log('alunos','criar',saved.id,null,saved);
    Audit.log('visitas','converter',visitId,{status:'visita'},{status:'aluno'});

    /* Credenciais automáticas */
    const firstName = v.nome.split(' ')[0].toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/g,'');
    const lastName  = (v.nome.split(' ')[1]||'').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/g,'');
    const autoUser  = (firstName + (lastName ? '.'+lastName : '')) || `aluno${Date.now().toString(36)}`;
    const autoPass  = String(Math.floor(100000 + Math.random() * 900000));
    const alunoId   = saved.id;

    Utils.showModal(`
      <div class="p-6 text-center">
        <div class="text-5xl mb-3">🎓</div>
        <h3 class="text-xl font-bold text-white mb-1">${v.nome} agora é aluno!</h3>
        <p class="text-gray-400 text-sm mb-5">Deseja criar um login de acesso para o aluno?</p>

        <div class="card bg-primary-900/30 border border-primary-700/40 text-left mb-5">
          <p class="section-title mb-3">Credenciais geradas automaticamente</p>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-gray-400 text-sm">Usuário</span>
              <div class="flex items-center gap-2">
                <code class="bg-gray-700 px-3 py-1.5 rounded text-primary-300 text-sm">${autoUser}</code>
                <button onclick="navigator.clipboard.writeText('${autoUser}').then(()=>Utils.showToast('Copiado!','success'))" class="btn-ghost btn-sm">📋</button>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-400 text-sm">Senha</span>
              <div class="flex items-center gap-2">
                <code class="bg-gray-700 px-3 py-1.5 rounded text-primary-300 text-sm">${autoPass}</code>
                <button onclick="navigator.clipboard.writeText('${autoPass}').then(()=>Utils.showToast('Copiado!','success'))" class="btn-ghost btn-sm">📋</button>
              </div>
            </div>
          </div>
          <p class="text-xs text-yellow-500 mt-3">⚠️ Anote a senha antes de fechar — ela não pode ser recuperada.</p>
        </div>

        <div class="flex gap-3">
          <button onclick="Utils.closeModal();App.navigate('students')" class="btn-secondary flex-1">Não criar agora</button>
          <button onclick="VisitsModule.confirmCreateLogin('${alunoId}','${autoUser}','${autoPass}')" class="btn-primary flex-1">✅ Criar Login do Aluno</button>
        </div>
      </div>`);
  }

  function confirmCreateLogin(alunoId, username, password) {
    const jaExiste = DB.get('student_auth').find(a => a.username === username);
    const finalUser = jaExiste ? username + Math.floor(100+Math.random()*900) : username;
    DB.save('student_auth', {
      alunoId,
      username:  finalUser,
      password:  btoa(password),
      createdAt: new Date().toISOString()
    });
    Utils.closeModal();
    Utils.showToast(`Login criado: ${finalUser} 🔑`, 'success');
    App.navigate('students');
  }

  function search(q) { setFilter('q', q); }

  return {
    render, openForm, save, remove, convertToStudent, confirmCreateLogin,
    search, onBirthChange, toggleResp, buscarCEP,
    setFilter, clearFilters, openDetail, setTemperatura, addObservacao, removeObservacao, exportWord
  };
})();
