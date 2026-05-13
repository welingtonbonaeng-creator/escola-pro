/* ===================================================
   DB — Camada de dados dual: localStorage | Supabase
   Quando STORAGE_MODE === 'supabase' (config.js),
   todas as operações vão para o banco online.
   =================================================== */

/* Cliente Supabase (inicializado quando modo = supabase) */
let _sb = null;
(function initSupabase() {
  try {
    if (typeof STORAGE_MODE !== 'undefined' && STORAGE_MODE === 'supabase') {
      _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('[EscolaPro] Modo Supabase ativo ✅');
    } else {
      console.log('[EscolaPro] Modo localStorage ativo 💾');
    }
  } catch(e) { console.warn('[EscolaPro] Supabase não disponível, usando localStorage', e); }
})();

/* Mapa de nomes de coleção → tabela Supabase */
const _TABLE = { employees:'employees', courses:'courses', grades:'grades', visits:'visits', students:'students', financial:'financial', attendance:'attendance', audit:'audit', system_settings:'system_settings', student_auth:'student_auth', chat_messages:'chat_messages', schedule:'schedule', goals:'goals' };

const DB = {
  prefix: 'ep_',

  /* ── localStorage ops ── */
  get(col) {
    try { return JSON.parse(localStorage.getItem(this.prefix + col) || '[]'); }
    catch { return []; }
  },

  set(col, data) {
    localStorage.setItem(this.prefix + col, JSON.stringify(data));
    return data;
  },

  save(col, record) {
    const all = this.get(col);
    if (!record.id) record.id = this._id();
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    const i = all.findIndex(r => r.id === record.id);
    if (i >= 0) all[i] = record; else all.push(record);
    this.set(col, all);
    /* Espelha no Supabase em background (sem bloquear a UI) */
    if (_sb) this._syncRecord(col, record);
    return record;
  },

  remove(col, id) {
    this.set(col, this.get(col).filter(r => r.id !== id));
    if (_sb) _sb.from(_TABLE[col]||col).delete().eq('id', id).then(() => {});
  },

  findById(col, id) {
    return this.get(col).find(r => r.id === id) || null;
  },

  findBy(col, key, val) {
    return this.get(col).filter(r => r[key] === val);
  },

  /* ── Supabase: sync record ── */
  async _syncRecord(col, record) {
    try {
      const tbl = _TABLE[col] || col;
      await _sb.from(tbl).upsert(this._toSnake(record));
    } catch(e) { console.warn('[DB] sync error', e); }
  },

  /* ── Supabase: carrega todos os dados na inicialização ── */
  async loadFromSupabase() {
    if (!_sb) return;
    const tables = Object.keys(_TABLE);
    for (const col of tables) {
      try {
        const { data, error } = await _sb.from(_TABLE[col]).select('*').order('created_at');
        if (!error && data) {
          const supabaseRecords = data.map(r => this._toCamel(r));
          /* Merge: mantém registros locais que ainda não chegaram ao Supabase
             (evita apagar dados criados localmente se o sync falhou) */
          const localRecords  = this.get(col);
          const supabaseIds   = new Set(supabaseRecords.map(r => r.id));
          const somenteLocais = localRecords.filter(r => r.id && !supabaseIds.has(r.id));
          const merged = [...supabaseRecords, ...somenteLocais];
          localStorage.setItem(this.prefix + col, JSON.stringify(merged));
          /* Tenta sincronizar os registros locais que não estavam no Supabase */
          if (somenteLocais.length > 0) {
            somenteLocais.forEach(r => this._syncRecord(col, r));
          }
        }
      } catch(e) { console.warn('[DB] load error', col, e); }
    }
    console.log('[EscolaPro] Dados sincronizados do Supabase ✅');
  },

  /* ── Supabase: exportar localStorage → Supabase (primeira vez) ── */
  async exportToSupabase() {
    if (!_sb) { alert('Configure o SUPABASE_KEY no arquivo js/config.js'); return; }
    const tables = Object.keys(_TABLE);
    let count = 0;
    for (const col of tables) {
      const records = this.get(col);
      if (!records.length) continue;
      const { error } = await _sb.from(_TABLE[col]).upsert(records.map(r => this._toSnake(r)));
      if (!error) count += records.length;
    }
    alert(`✅ ${count} registros exportados para o Supabase!`);
  },

  /* camelCase → snake_case para Supabase */
  _toSnake(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = k.replace(/([A-Z])/g, '_$1').toLowerCase();
      out[key] = v;
    }
    return out;
  },

  /* snake_case → camelCase para o App */
  _toCamel(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[key] = v;
    }
    return out;
  },

  _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  /* ── Seed inicial ── */
  seed() {
    /* Reseta seed se faltar coleções novas */
    if (localStorage.getItem('ep_seeded') && !localStorage.getItem('ep_student_auth')) {
      localStorage.removeItem('ep_seeded');
    }
    if (localStorage.getItem('ep_seeded') && !localStorage.getItem('ep_schedule')) {
      localStorage.removeItem('ep_seeded');
    }
    if (localStorage.getItem('ep_seeded')) return;

    /* FUNCIONÁRIOS */
    const emp1 = { id:'emp_gerente', nome:'Diretor Geral', cargo:'Gerente / Administrador', username:'gerente', password:btoa('escola@2024'), email:'gerente@escola.com', telefone:'(21) 99100-0001', documento:'123.456.789-00', endereco:'Rua das Flores, 100', bairro:'Centro', cidade:'Rio de Janeiro', estado:'RJ', ativo:true, isAdmin:true, recebe_chat:true, createdAt:'2024-01-10T08:00:00.000Z', updatedAt:'2024-01-10T08:00:00.000Z',
      permissoes:{ dashboard:{ver:true}, visitas:{ver:true,criar:true,editar:true,excluir:true}, cursos:{ver:true,criar:true,editar:true,excluir:true}, alunos:{ver:true,criar:true,editar:true,excluir:true}, funcionarios:{ver:true,criar:true,editar:true,excluir:true}, frequencia:{ver:true,criar:true,editar:true,excluir:true}, financeiro:{ver:true,criar:true,editar:true,excluir:true} }
    };
    const emp2 = { id:'emp_ana', nome:'Ana Santos', cargo:'Consultora de Matrículas', username:'ana.santos', password:btoa('func@2024'), email:'ana@escola.com', telefone:'(21) 99200-0002', documento:'987.654.321-00', endereco:'Av. Brasil, 500', bairro:'Tijuca', cidade:'Rio de Janeiro', estado:'RJ', ativo:true, isAdmin:false, recebe_chat:true, createdAt:'2024-02-01T08:00:00.000Z', updatedAt:'2024-02-01T08:00:00.000Z',
      permissoes:{ dashboard:{ver:true}, visitas:{ver:true,criar:true,editar:true,excluir:false}, cursos:{ver:true,criar:false,editar:false,excluir:false}, alunos:{ver:true,criar:true,editar:true,excluir:false}, funcionarios:{ver:false,criar:false,editar:false,excluir:false}, frequencia:{ver:true,criar:true,editar:true,excluir:false}, financeiro:{ver:true,criar:false,editar:false,excluir:false} }
    };
    this.set('employees', [emp1, emp2]);

    /* CURSOS */
    const cursos = [
      { id:'cur_info_bas', nome:'Informática Básica', valor:450, descricao:'Introdução ao computador, Windows, digitação, navegação na internet e e-mail. Ideal para iniciantes.', ativo:true, createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
      { id:'cur_info_adv', nome:'Informática Avançada', valor:650, descricao:'Manutenção de hardware, redes, Linux, segurança da informação. Para quem já tem base.', ativo:true, createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
      { id:'cur_office', nome:'Office Completo', valor:380, descricao:'Word, Excel, PowerPoint e Outlook do básico ao avançado. Certificado Microsoft.', ativo:true, createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
      { id:'cur_design', nome:'Design Gráfico', valor:780, descricao:'Photoshop, Illustrator e CorelDraw. Criação de logotipos, banners, flyers e mídias sociais.', ativo:true, createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
      { id:'cur_web', nome:'Programação Web', valor:950, descricao:'HTML, CSS, JavaScript e React. Crie sites e aplicações do zero até o deploy.', ativo:true, createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
    ];
    this.set('courses', cursos);

    /* TURMAS */
    const turmas = [
      { id:'turma_manha', cursoId:null, nome:'Turma Manhã', diasSemana:['seg','ter','qua','qui','sex'], horarioInicio:'08:00', horarioFim:'09:30', vagasMaximas:12, computadores:12, tipo:'fixo', createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
      { id:'turma_tarde', cursoId:null, nome:'Turma Tarde', diasSemana:['seg','ter','qua','qui','sex'], horarioInicio:'13:00', horarioFim:'14:30', vagasMaximas:10, computadores:10, tipo:'fixo', createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
      { id:'turma_noite', cursoId:null, nome:'Turma Noite', diasSemana:['seg','ter','qua','qui','sex'], horarioInicio:'18:00', horarioFim:'19:30', vagasMaximas:15, computadores:15, tipo:'fixo', createdAt:'2024-01-15T09:00:00.000Z', updatedAt:'2024-01-15T09:00:00.000Z' },
    ];
    this.set('grades', turmas);

    /* VISITAS */
    const visitas = [
      { id:'vis_marcos', nome:'Marcos Vieira', dataNascimento:'1998-07-14', sexo:'M', tipoDoc:'RG', documento:'20.456.789-1', cep:'20040-020', endereco:'Rua da Assembleia', numero:'10', bairro:'Centro', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 99300-1001', email:'marcos.vieira@email.com', responsavel:null, status:'visita', interesse:'Informática Básica', criadoPor:'emp_ana', createdAt:'2026-05-01T10:00:00.000Z', updatedAt:'2026-05-01T10:00:00.000Z' },
      { id:'vis_juliana', nome:'Juliana Santos', dataNascimento:'2001-03-22', sexo:'F', tipoDoc:'CPF', documento:'111.222.333-44', cep:'20271-000', endereco:'Av. Maracanã', numero:'987', bairro:'Maracanã', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 99400-2002', email:'juliana.santos@email.com', responsavel:null, status:'visita', interesse:'Design Gráfico', criadoPor:'emp_ana', createdAt:'2026-05-05T14:00:00.000Z', updatedAt:'2026-05-05T14:00:00.000Z' },
      { id:'vis_gabriel', nome:'Gabriel Rodrigues', dataNascimento:'2010-11-08', sexo:'M', tipoDoc:'CPF', documento:'000.111.222-33', cep:'21310-250', endereco:'Rua Lópes Trovão', numero:'45', bairro:'Irajá', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 98500-3003', email:'', responsavel:{ nome:'Renata Rodrigues', documento:'444.555.666-77', telefone:'(21) 99500-3003', email:'renata@email.com', endereco:'Rua Lópes Trovão, 45, Irajá, RJ' }, status:'visita', interesse:'Informática Básica', criadoPor:'emp_gerente', createdAt:'2026-05-08T09:00:00.000Z', updatedAt:'2026-05-08T09:00:00.000Z' },
    ];
    this.set('visits', visitas);

    /* ALUNOS */
    const hoje = new Date();
    const meses = (n) => { const d = new Date(hoje); d.setMonth(d.getMonth() - n); return d.toISOString(); };
    const dias = (n) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return d.toISOString(); };

    const alunos = [
      /* 1 — Ativo, pagando em dia */
      { id:'alu_joao', visitaId:null, nome:'João Carlos Silva', dataNascimento:'1995-04-20', sexo:'M', tipoDoc:'CPF', documento:'222.333.444-55', cep:'21530-000', endereco:'Rua Turiaçu', numero:'200', bairro:'Madureira', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 98601-1111', email:'joao.silva@email.com', responsavel:null, status:'ativo', criadoPor:'emp_ana',
        matriculas:[{ id:'mat_j1', cursoId:'cur_info_bas', turmaId:'turma_manha', dataInicio:meses(2), dataFim:null, funcionarioId:'emp_ana', formasPagamento:[{tipo:'pix',valor:450}], desconto:0, totalParcelas:3, valorParcela:150, valorTotal:450, createdAt:meses(2) }],
        createdAt:meses(2), updatedAt:dias(1)
      },
      /* 2 — Bloqueada, inadimplente 3 meses */
      { id:'alu_maria', visitaId:null, nome:'Maria Eduarda Oliveira', dataNascimento:'1990-08-15', sexo:'F', tipoDoc:'CPF', documento:'333.444.555-66', cep:'21710-000', endereco:'Av. Brás de Pina', numero:'500', bairro:'Brás de Pina', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 97700-2222', email:'maria.eduarda@email.com', responsavel:null, status:'bloqueado', criadoPor:'emp_ana',
        matriculas:[{ id:'mat_m1', cursoId:'cur_office', turmaId:'turma_tarde', dataInicio:meses(5), dataFim:null, funcionarioId:'emp_ana', formasPagamento:[{tipo:'boleto',valor:380}], desconto:0, totalParcelas:4, valorParcela:95, valorTotal:380, createdAt:meses(5) }],
        inadimplenciaSituacao:'frequenta_nao_paga', createdAt:meses(5), updatedAt:dias(2)
      },
      /* 3 — Formado */
      { id:'alu_carlos', visitaId:null, nome:'Carlos Roberto Pereira', dataNascimento:'1988-12-03', sexo:'M', tipoDoc:'RG', documento:'12.345.678-9', cep:'22070-010', endereco:'Av. Atlântica', numero:'1702', bairro:'Copacabana', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 96800-3333', email:'carlos.pereira@email.com', responsavel:null, status:'formado', criadoPor:'emp_gerente',
        matriculas:[{ id:'mat_c1', cursoId:'cur_info_adv', turmaId:'turma_noite', dataInicio:meses(8), dataFim:meses(1), funcionarioId:'emp_gerente', formasPagamento:[{tipo:'cartao_credito',valor:650}], desconto:50, totalParcelas:5, valorParcela:120, valorTotal:600, createdAt:meses(8) }],
        createdAt:meses(8), updatedAt:meses(1)
      },
      /* 4 — Menor de idade, com responsável, ativa */
      { id:'alu_fernanda', visitaId:null, nome:'Fernanda Lima Santos', dataNascimento:'2009-06-17', sexo:'F', tipoDoc:'CPF', documento:'555.666.777-88', cep:'23015-150', endereco:'Rua da Taquara', numero:'75', bairro:'Taquara', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 95900-4444', email:'', responsavel:{ nome:'Sônia Lima', documento:'666.777.888-99', telefone:'(21) 99900-4444', email:'sonia.lima@email.com', endereco:'Rua da Taquara, 75, Taquara, RJ' }, status:'ativo', criadoPor:'emp_ana',
        matriculas:[{ id:'mat_f1', cursoId:'cur_design', turmaId:'turma_tarde', dataInicio:meses(1), dataFim:null, funcionarioId:'emp_ana', formasPagamento:[{tipo:'pix',valor:400},{tipo:'cartao_debito',valor:380}], desconto:0, totalParcelas:6, valorParcela:130, valorTotal:780, createdAt:meses(1) }],
        createdAt:meses(1), updatedAt:dias(3)
      },
      /* 5 — Frequenta e não paga */
      { id:'alu_roberto', visitaId:null, nome:'Roberto Alves Nascimento', dataNascimento:'1985-02-28', sexo:'M', tipoDoc:'RG', documento:'98.765.432-1', cep:'20735-270', endereco:'Rua São Francisco Xavier', numero:'120', bairro:'São Francisco Xavier', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 99700-5555', email:'roberto.alves@email.com', responsavel:null, status:'bloqueado', criadoPor:'emp_ana',
        matriculas:[{ id:'mat_r1', cursoId:'cur_web', turmaId:'turma_noite', dataInicio:meses(3), dataFim:null, funcionarioId:'emp_ana', formasPagamento:[{tipo:'boleto',valor:950}], desconto:0, totalParcelas:6, valorParcela:158.33, valorTotal:950, createdAt:meses(3) }],
        inadimplenciaSituacao:'frequenta_nao_paga', createdAt:meses(3), updatedAt:dias(5)
      },
      /* 6 — Nunca frequentou */
      { id:'alu_lucia', visitaId:null, nome:'Lúcia Mendes Costa', dataNascimento:'1992-09-10', sexo:'F', tipoDoc:'CPF', documento:'777.888.999-00', cep:'21040-360', endereco:'Rua Arquias Cordeiro', numero:'320', bairro:'Méier', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 98800-6666', email:'lucia.mendes@email.com', responsavel:null, status:'inativo', criadoPor:'emp_gerente',
        matriculas:[{ id:'mat_l1', cursoId:'cur_info_bas', turmaId:'turma_manha', dataInicio:meses(4), dataFim:null, funcionarioId:'emp_gerente', formasPagamento:[{tipo:'pix',valor:450}], desconto:0, totalParcelas:3, valorParcela:150, valorTotal:450, createdAt:meses(4) }],
        inadimplenciaSituacao:'nunca_frequentou', createdAt:meses(4), updatedAt:dias(30)
      },
      /* 7 — Em reposição */
      { id:'alu_pedro', visitaId:null, nome:'Pedro Oliveira Santana', dataNascimento:'1999-11-25', sexo:'M', tipoDoc:'CPF', documento:'888.999.000-11', cep:'20040-900', endereco:'Av. Rio Branco', numero:'156', bairro:'Centro', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 99300-7777', email:'pedro.oliveira@email.com', responsavel:null, status:'ativo', criadoPor:'emp_ana',
        matriculas:[{ id:'mat_p1', cursoId:'cur_office', turmaId:'turma_manha', dataInicio:meses(3), dataFim:null, funcionarioId:'emp_ana', formasPagamento:[{tipo:'cartao_credito',valor:380}], desconto:20, totalParcelas:4, valorParcela:90, valorTotal:360, createdAt:meses(3) }],
        createdAt:meses(3), updatedAt:dias(7)
      },
      /* 8 — SPC */
      { id:'alu_ana', visitaId:null, nome:'Ana Paula Costa Ferreira', dataNascimento:'1987-05-30', sexo:'F', tipoDoc:'CPF', documento:'999.000.111-22', cep:'21221-450', endereco:'Rua Dias da Cruz', numero:'61', bairro:'Méier', cidade:'Rio de Janeiro', estado:'RJ', telefone:'(21) 97400-8888', email:'anapaula.costa@email.com', responsavel:null, status:'bloqueado', criadoPor:'emp_gerente',
        matriculas:[{ id:'mat_a1', cursoId:'cur_info_adv', turmaId:'turma_tarde', dataInicio:meses(7), dataFim:null, funcionarioId:'emp_gerente', formasPagamento:[{tipo:'boleto',valor:650}], desconto:0, totalParcelas:5, valorParcela:130, valorTotal:650, createdAt:meses(7) }],
        inadimplenciaSituacao:'spc', statusFinanceiro:'SPC', createdAt:meses(7), updatedAt:dias(60)
      },
    ];
    this.set('students', alunos);

    /* PARCELAS FINANCEIRAS */
    const parcelas = [];
    const addParcelas = (alunoId, matId, total, valor, dataInicio, pagas) => {
      const start = new Date(dataInicio);
      for (let i = 0; i < total; i++) {
        const venc = new Date(start); venc.setMonth(venc.getMonth() + i);
        const pago = i < pagas;
        const atrasado = !pago && venc < hoje;
        parcelas.push({
          id: `parc_${alunoId}_${i}`, alunoId, matriculaId: matId,
          numero: i + 1, total, valor: parseFloat(valor.toFixed(2)),
          vencimento: venc.toISOString().slice(0,10),
          dataPagamento: pago ? new Date(venc.getTime() + 86400000*2).toISOString().slice(0,10) : null,
          status: pago ? 'pago' : (atrasado ? 'atrasado' : 'pendente'),
          formaPagamento: pago ? 'pix' : null,
          juros: atrasado ? parseFloat((valor * 0.02 * Math.ceil((hoje - venc) / 86400000 / 30)).toFixed(2)) : 0,
          createdAt: dataInicio, updatedAt: new Date().toISOString()
        });
      }
    };

    const m = (n) => { const d = new Date(hoje); d.setMonth(d.getMonth() - n); return d.toISOString(); };
    addParcelas('alu_joao',    'mat_j1', 3,   150,    m(2),  2);
    addParcelas('alu_maria',   'mat_m1', 4,   95,     m(5),  1);
    addParcelas('alu_carlos',  'mat_c1', 5,   120,    m(8),  5);
    addParcelas('alu_fernanda','mat_f1', 6,   130,    m(1),  1);
    addParcelas('alu_roberto', 'mat_r1', 6,   158.33, m(3),  0);
    addParcelas('alu_lucia',   'mat_l1', 3,   150,    m(4),  1);
    addParcelas('alu_pedro',   'mat_p1', 4,   90,     m(3),  2);
    addParcelas('alu_ana',     'mat_a1', 5,   130,    m(7),  1);
    this.set('financial', parcelas);

    /* FREQUÊNCIA */
    const freq = [];
    const addFreq = (alunoId, dataIni, presencas, faltas) => {
      const d = new Date(dataIni);
      let p = presencas, f = faltas;
      while ((p + f) > 0) {
        if (d.getDay() !== 0 && d.getDay() !== 6) {
          freq.push({ id:`freq_${alunoId}_${freq.length}`, alunoId, data: d.toISOString().slice(0,10), presente: p > 0, tipo: p > 0 ? 'normal' : 'falta', obs:'', createdAt: new Date().toISOString() });
          if (p > 0) p--; else f--;
        }
        d.setDate(d.getDate() + 1);
      }
    };
    addFreq('alu_joao',    m(2), 28, 4);
    addFreq('alu_maria',   m(5), 35, 18);
    addFreq('alu_carlos',  m(8), 85, 5);
    addFreq('alu_fernanda',m(1), 12, 1);
    addFreq('alu_roberto', m(3), 40, 12);
    addFreq('alu_lucia',   m(4),  2, 25);
    addFreq('alu_pedro',   m(3), 30, 14);
    addFreq('alu_ana',     m(7), 10, 60);
    this.set('attendance', freq);

    /* LOGINS DE ALUNOS */
    this.set('student_auth', [
      { id:'sa_joao',  alunoId:'alu_joao',  username:'joao.carlos',   password:btoa('aluno123'), createdAt:'2024-01-10T08:00:00.000Z' },
      { id:'sa_pedro', alunoId:'alu_pedro', username:'pedro.oliveira', password:btoa('aluno456'), createdAt:'2024-01-10T08:00:00.000Z' },
      { id:'sa_fernanda', alunoId:'alu_fernanda', username:'fernanda.lima', password:btoa('aluno789'), createdAt:'2024-01-10T08:00:00.000Z' },
    ]);

    /* MENSAGENS DE CHAT */
    this.set('chat_messages', []);

    /* GRADE DE HORÁRIO — exemplos iniciais */
    const scheduleExamples = [
      { id:'sch1', dia:'seg', horario:'08:00-09:30', maquina:'COMPUTADOR 01', alunoId:'alu_joao',     visitaId:null, nomeAluno:'João Carlos Silva',       tipo:'aluno'  },
      { id:'sch2', dia:'seg', horario:'08:00-09:30', maquina:'COMPUTADOR 02', alunoId:'alu_fernanda', visitaId:null, nomeAluno:'Fernanda Lima Santos',     tipo:'aluno'  },
      { id:'sch3', dia:'seg', horario:'09:30-11:00', maquina:'COMPUTADOR 01', alunoId:'alu_pedro',    visitaId:null, nomeAluno:'Pedro Oliveira Santana',   tipo:'aluno'  },
      { id:'sch4', dia:'seg', horario:'13:00-14:30', maquina:'COMPUTADOR 03', alunoId:'alu_maria',    visitaId:null, nomeAluno:'Maria Eduarda Oliveira',   tipo:'aluno'  },
      { id:'sch5', dia:'ter', horario:'08:00-09:30', maquina:'COMPUTADOR 01', alunoId:'alu_joao',     visitaId:null, nomeAluno:'João Carlos Silva',       tipo:'aluno'  },
      { id:'sch6', dia:'ter', horario:'08:00-09:30', maquina:'COMPUTADOR 02', alunoId:'alu_fernanda', visitaId:null, nomeAluno:'Fernanda Lima Santos',     tipo:'aluno'  },
      { id:'sch7', dia:'ter', horario:'11:00-12:30', maquina:'COMPUTADOR 05', alunoId:null, visitaId:'vis_marcos',  nomeAluno:'Marcos Vieira',            tipo:'visita' },
      { id:'sch8', dia:'qua', horario:'09:30-11:00', maquina:'COMPUTADOR 02', alunoId:'alu_pedro',    visitaId:null, nomeAluno:'Pedro Oliveira Santana',   tipo:'aluno'  },
      { id:'sch9', dia:'qui', horario:'14:30-16:00', maquina:'COMPUTADOR 04', alunoId:'alu_roberto',  visitaId:null, nomeAluno:'Roberto Alves Nascimento', tipo:'aluno'  },
    ];
    scheduleExamples.forEach(s => { s.createdAt = new Date().toISOString(); s.updatedAt = new Date().toISOString(); });
    this.set('schedule', scheduleExamples);

    /* AUDITORIA */
    this.set('audit', [
      { id:'aud1', funcionarioId:'emp_gerente', funcionarioNome:'Diretor Geral', modulo:'alunos', acao:'criar', registroId:'alu_carlos', descricao:'Aluno Carlos Roberto Pereira cadastrado', createdAt:m(8) },
      { id:'aud2', funcionarioId:'emp_ana',     funcionarioNome:'Ana Santos',    modulo:'visitas', acao:'criar', registroId:'vis_marcos', descricao:'Visita Marcos Vieira cadastrada', createdAt:new Date(hoje.getTime()-9*86400000).toISOString() },
      { id:'aud3', funcionarioId:'emp_ana',     funcionarioNome:'Ana Santos',    modulo:'alunos', acao:'criar', registroId:'alu_joao',   descricao:'Aluno João Carlos Silva matriculado', createdAt:m(2) },
      { id:'aud4', funcionarioId:'emp_gerente', funcionarioNome:'Diretor Geral', modulo:'financeiro', acao:'bloquear', registroId:'alu_maria', descricao:'Aluna Maria Eduarda bloqueada por inadimplência', createdAt:new Date(hoje.getTime()-15*86400000).toISOString() },
    ]);

    localStorage.setItem('ep_seeded', '1');
  }
};

DB.seed();
