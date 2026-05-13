/* ===== UTILS ===== */
const Utils = {

  /* ── Formatadores ── */
  currency(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); },
  formatDate(s) { if (!s) return '—'; const d = new Date(s); return isNaN(d)?'—':d.toLocaleDateString('pt-BR'); },
  formatDateTime(s) { if (!s) return '—'; const d = new Date(s); return isNaN(d)?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}); },
  formatPhone(p) {
    if (!p) return '—';
    const n = p.replace(/\D/g,'');
    if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return p;
  },
  formatCPF(c) { if (!c) return '—'; const n=c.replace(/\D/g,''); return n.length===11?`${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`:c; },
  initials(name) { return (name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(); },

  /* ── Datas ── */
  calcAge(birth) {
    if (!birth) return 0;
    const b = new Date(birth), t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth()===b.getMonth() && t.getDate()<b.getDate())) a--;
    return a;
  },
  isMinor(birth) { return this.calcAge(birth) < 18; },

  /* ── CEP ── */
  async fetchCEP(cep) {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) throw new Error('CEP não encontrado');
    return d;
  },

  maskCEP(input) {
    let v = input.value.replace(/\D/g,'').slice(0,8);
    if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
    input.value = v;
  },

  /* ── Similaridade (para evitar curso duplicado) ── */
  normalize(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim(); },
  isSimilar(a, b) {
    const na = this.normalize(a), nb = this.normalize(b);
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    // distância simples de Levenshtein para strings curtas
    if (Math.abs(na.length - nb.length) > 4) return false;
    let m = 0;
    const short = na.length < nb.length ? na : nb;
    const long  = na.length < nb.length ? nb : na;
    for (let i = 0; i < short.length; i++) if (long.includes(short[i])) m++;
    return m / long.length > 0.85;
  },

  /* ── Toast ── */
  showToast(msg, type = 'info', ms = 3500) {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'fadeOut .3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, ms);
  },

  /* ── Modal ── */
  showModal(html) {
    document.getElementById('modalBox').innerHTML = html;
    const o = document.getElementById('modalOverlay');
    o.classList.remove('hidden');
    o.classList.add('flex');
  },
  closeModal() {
    const o = document.getElementById('modalOverlay');
    o.classList.add('hidden');
    o.classList.remove('flex');
    document.getElementById('modalBox').innerHTML = '';
  },

  /* ── Confirm ── */
  _confirmCb: null,
  confirm(msg) {
    return new Promise(resolve => {
      this._confirmCb = resolve;
      document.getElementById('confirmMsg').textContent = msg;
      const o = document.getElementById('confirmOverlay');
      o.classList.remove('hidden');
      o.classList.add('flex');
    });
  },
  confirmResolve(val) {
    document.getElementById('confirmOverlay').classList.add('hidden');
    document.getElementById('confirmOverlay').classList.remove('flex');
    if (this._confirmCb) { this._confirmCb(val); this._confirmCb = null; }
  },

  /* ── Helpers de formulário ── */
  formData(formEl) {
    const fd = new FormData(formEl);
    const obj = {};
    fd.forEach((v, k) => { obj[k] = v; });
    return obj;
  },

  /* ── Badge por status ── */
  statusBadge(status) {
    const map = {
      ativo:    ['badge-green',  'Ativo'],
      inativo:  ['badge-gray',   'Inativo'],
      bloqueado:['badge-red',    'Bloqueado'],
      formado:  ['badge-blue',   'Formado'],
      spc:      ['badge-red',    'SPC'],
      visita:   ['badge-yellow', 'Visita'],
      pago:     ['badge-green',  'Pago'],
      pendente: ['badge-yellow', 'Pendente'],
      atrasado: ['badge-red',    'Atrasado'],
    };
    const [cls, label] = map[status?.toLowerCase()] || ['badge-gray', status || '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  /* ── Dias da semana ── */
  diasLabel(dias) {
    const m = {seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb',dom:'Dom'};
    return (dias||[]).map(d=>m[d]||d).join(', ');
  },

  /* ── Empty state ── */
  emptyState(msg) {
    return `<div class="text-center py-16 text-gray-500">
      <div class="text-4xl mb-3 opacity-40">📭</div>
      <p class="text-sm">${msg}</p>
    </div>`;
  },

  /* ── Parser monetário BR (aceita vírgula e ponto como decimal) ── */
  parseBRL(v) {
    const s = String(v || '').trim();
    if (!s) return 0;
    // "1.234,56" → remove pontos de milhar, troca vírgula por ponto
    if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(s) || 0;
  },

  /* ── Loader ── */
  loader() {
    return `<div class="flex justify-center py-16"><div class="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>`;
  }
};
