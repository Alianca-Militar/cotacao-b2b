// Camada de dados: Supabase quando configurado, senão localStorage (modo demonstração)

const DB = (() => {
  const cfg = window.APP_CONFIG;
  const demo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
  const sb = demo ? null : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const CAMPOS_COTACAO = ['empresa_id', 'cliente', 'tipo_cliente', 'data', 'vendedor', 'email', 'whatsapp', 'validade', 'entrega',
    'pagamento', 'observacoes', 'subtotal', 'descontos', 'acrescimos', 'frete', 'total'];
  const CAMPOS_ITEM = ['produto_id', 'codigo', 'descricao', 'unidade', 'quantidade', 'preco_unit', 'total'];

  function pick(obj, campos) {
    const o = {};
    campos.forEach(c => { if (obj[c] !== undefined) o[c] = obj[c]; });
    return o;
  }

  function check({ data, error }) {
    if (error) {
      if (error.code === 'PGRST205') {
        const tabela = (error.message.match(/'public\.(\w+)'/) || [])[1] || '';
        throw new Error(`A tabela "${tabela}" não existe no banco. Rode o script SQL correspondente na pasta sql/ (ex: empresas_perfis.sql).`);
      }
      if (error.code === '23505') throw new Error('Já existe um registro com este código.');
      if (error.code === '23503') {
        throw new Error(/update or delete/i.test(error.message)
          ? 'Não é possível excluir: existem produtos usando este cadastro.'
          : 'Grupo, tipo de corporação ou corporação informado não está cadastrado.');
      }
      throw new Error(error.message);
    }
    return data;
  }

  // Supabase devolve no máximo 1000 linhas por consulta: busca em páginas
  async function buscarTudo(montarQuery) {
    const todos = [];
    for (let de = 0; ; de += 1000) {
      const pagina = check(await montarQuery().range(de, de + 999));
      todos.push(...pagina);
      if (pagina.length < 1000) break;
    }
    return todos;
  }

  // ---------- localStorage (modo demonstração) ----------
  const ls = {
    get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    nextId(k) { const n = ls.get(k, 0) + 1; ls.set(k, n); return n; },
  };

  const PROD_KEY = 'am_produtos_v3';
  if (demo && !localStorage.getItem(PROD_KEY)) {
    const agora = new Date().toISOString();
    ls.set('am_grupos', [{ cod: 'EMB', descricao: 'EMBLEMAS' }, { cod: 'CRA', descricao: 'CRACHÁS' }]);
    ls.set('am_tipos_corporacao', [{ cod: 'PM', descricao: 'POLÍCIA MILITAR' }]);
    ls.set('am_corporacoes', [{ cod: 'PMBA', descricao: 'POLÍCIA MILITAR DA BAHIA' }]);
    ls.set(PROD_KEY, [
      { id: 1, cod_alianca: 'PAL1564', cod_suporte: '', descricao: 'EMBLEMA PARA BOINA PMBA', und_medida: 'UND', valor: 70,
        grupo: 'EMB', tipo_corporacao: 'PM', corporacao: 'PMBA', link_imagem: '', status: 'ativo', created_at: agora, updated_at: agora },
      { id: 2, cod_alianca: 'PAL1599', cod_suporte: '', descricao: 'CRACHA QUEPE CB/SD MASCULINO PMBA', und_medida: 'UND', valor: 82,
        grupo: 'CRA', tipo_corporacao: 'PM', corporacao: 'PMBA', link_imagem: '', status: 'ativo', created_at: agora, updated_at: agora },
    ]);
    ls.set('am_seq_produtos', 2);
  }

  // Empresas e perfil de exemplo do modo demonstração
  if (demo && !localStorage.getItem('am_empresas')) {
    ls.set('am_empresas', [
      { id: 1, nome: 'ALIANÇA', razao_social: 'ALIANCA MILITAR INDUSTRIA E COMERCIO LTDA', cnpj: '15.136.883/0001-39',
        inscricao_estadual: '001.923.949-0019', endereco: 'AVENIDA PRESIDENTE JUSCELINO KUBITSCHECK', numero: '5685',
        bairro: 'NOVA ERA', cep: '36.090-000', cidade: 'JUIZ DE FORA', estado: 'MG', telefone: '(32) 3235-2226',
        logo: 'assets/logos/logo-alianca.png', campo_codigo: 'cod_alianca' },
      { id: 2, nome: 'SUPORTE', razao_social: 'SUPORTE INDUSTRIA E COMERCIO DE ARTIGOS MILITARES LTDA', cnpj: '15.136.916/0001-40',
        inscricao_estadual: '001.923.953-0037', endereco: 'AVENIDA PRESIDENTE JUSCELINO KUBITSCHECK', numero: '6911',
        bairro: 'BENFICA', cep: '36.092-030', cidade: 'JUIZ DE FORA', estado: 'MG', telefone: null,
        logo: null, campo_codigo: 'cod_suporte' },
    ]);
  }

  // ---------- Tabelas auxiliares (cod + descricao) ----------
  // nome da tabela -> campo de produtos que aponta para ela
  const AUXILIARES = { grupos: 'grupo', tipos_corporacao: 'tipo_corporacao', corporacoes: 'corporacao' };

  // comOrdem: tabelas com campo "ordem" (a lista aparece nessa sequência, não em ordem alfabética)
  // extras: campos numéricos adicionais da tabela (ex: percentuais da condição de pagamento)
  function auxiliar(tabela, { comOrdem = false, extras = [] } = {}) {
    const chave = `am_${tabela}`;
    const campoProduto = AUXILIARES[tabela]; // undefined = não é usada em produtos
    const ordenar = (a, b) => comOrdem
      ? (a.ordem ?? 9999) - (b.ordem ?? 9999) || a.descricao.localeCompare(b.descricao)
      : a.descricao.localeCompare(b.descricao);
    return {
      comOrdem,
      extras,
      async listar() {
        if (demo) return ls.get(chave, []).sort(ordenar);
        const lista = await buscarTudo(() => sb.from(tabela).select('*').order('descricao'));
        return lista.sort(ordenar);
      },

      // codOriginal: informado ao editar (permite trocar o código; os produtos acompanham)
      async salvar(reg, codOriginal) {
        const row = { cod: String(reg.cod).trim().toUpperCase(), descricao: String(reg.descricao).trim() };
        if (comOrdem) row.ordem = reg.ordem === '' || reg.ordem == null ? null : Number(reg.ordem);
        extras.forEach(c => { row[c] = round2(parseNum(reg[c])); });
        if (!row.cod || !row.descricao) throw new Error('Informe código e descrição.');
        if (demo) {
          const lista = ls.get(chave, []);
          if (lista.some(x => x.cod === row.cod && x.cod !== codOriginal)) throw new Error('Já existe um registro com este código.');
          if (codOriginal) {
            Object.assign(lista.find(x => x.cod === codOriginal), row);
            if (campoProduto && codOriginal !== row.cod) {
              const prods = ls.get(PROD_KEY, []);
              prods.forEach(p => { if (p[campoProduto] === codOriginal) p[campoProduto] = row.cod; });
              ls.set(PROD_KEY, prods);
            }
          } else {
            lista.push(row);
          }
          ls.set(chave, lista);
          return row;
        }
        if (codOriginal) return check(await sb.from(tabela).update(row).eq('cod', codOriginal).select().single());
        return check(await sb.from(tabela).insert(row).select().single());
      },

      async salvarVarios(rows) {
        if (!rows.length) return;
        if (demo) {
          const lista = ls.get(chave, []);
          rows.forEach(r => { if (!lista.some(x => x.cod === r.cod)) lista.push(r); });
          return ls.set(chave, lista);
        }
        check(await sb.from(tabela).upsert(rows, { onConflict: 'cod', ignoreDuplicates: true }));
      },

      async excluir(cod) {
        if (demo) {
          if (campoProduto && ls.get(PROD_KEY, []).some(p => p[campoProduto] === cod)) {
            throw new Error('Não é possível excluir: existem produtos usando este cadastro.');
          }
          return ls.set(chave, ls.get(chave, []).filter(x => x.cod !== cod));
        }
        check(await sb.from(tabela).delete().eq('cod', cod));
      },
    };
  }

  const grupos = auxiliar('grupos');
  const tiposCorporacao = auxiliar('tipos_corporacao');
  const corporacoes = auxiliar('corporacoes');
  const condicoesPagamento = auxiliar('condicoes_pagamento', { comOrdem: true, extras: ['desconto_pct', 'acrescimo_pct'] });
  const prazosEntrega = auxiliar('prazos_entrega', { comOrdem: true });

  if (demo && !localStorage.getItem('am_condicoes_pagamento')) {
    ls.set('am_condicoes_pagamento', [['A VISTA', 5, 0], ['50% ANTECIPADO + 50% NO ENVIO', 0, 0], ['30 DIAS', 0, 0],
      ['CARTÃO 1X', 0, 2.5], ['CARTÃO 2X', 0, 3.75], ['CARTÃO 3X', 0, 5]]
      .map(([d, desc, acr], i) => ({ cod: `P${i + 1}`, descricao: d, ordem: i + 1, desconto_pct: desc, acrescimo_pct: acr })));
    ls.set('am_prazos_entrega', ['10 Dias', '15 Dias', '30 Dias', '60 Dias']
      .map((d, i) => ({ cod: `E${i + 1}`, descricao: d, ordem: i + 1 })));
  }

  // Carrega as 3 tabelas de uma vez: { grupos: [...], tipos_corporacao: [...], corporacoes: [...] }
  async function carregarAuxiliares() {
    const [g, t, c] = await Promise.all([grupos.listar(), tiposCorporacao.listar(), corporacoes.listar()]);
    return { grupos: g, tipos_corporacao: t, corporacoes: c };
  }

  // ---------- Autenticação ----------
  const auth = {
    async usuario() {
      if (demo) return { id: 'demo', email: 'demonstracao@local' };
      const { data } = await sb.auth.getSession();
      return data.session?.user || null;
    },
    async entrar(email, senha) {
      check(await sb.auth.signInWithPassword({ email, password: senha }));
    },
    async sair() {
      if (!demo) await sb.auth.signOut();
    },
  };

  // ---------- Empresas (Aliança / Suporte) ----------
  const empresas = {
    async listar() {
      if (demo) return ls.get('am_empresas', []);
      return check(await sb.from('empresas').select('*').order('id'));
    },
  };

  // ---------- Perfil do vendedor (nome, telefone, assinatura) ----------
  const perfis = {
    // Perfil de quem está logado (null se ainda não preencheu)
    async meu() {
      const u = await auth.usuario();
      if (!u) return null;
      return this.obter(u.id);
    },

    async obter(id) {
      if (!id) return null;
      if (demo) return ls.get('am_perfis', {})[id] || null;
      return check(await sb.from('perfis').select('*').eq('id', id).maybeSingle());
    },

    async salvar(dados) {
      const u = await auth.usuario();
      const row = {
        id: u.id,
        nome: String(dados.nome || '').trim(),
        telefone: String(dados.telefone || '').trim() || null,
        assinatura: dados.assinatura || null,
      };
      if (!row.nome) throw new Error('Informe seu nome.');
      if (demo) {
        const todos = ls.get('am_perfis', {});
        todos[u.id] = row;
        ls.set('am_perfis', todos);
        return row;
      }
      return check(await sb.from('perfis').upsert(row).select().single());
    },
  };

  // ---------- Produtos ----------
  // Padroniza os campos antes de gravar (created_at/updated_at são preenchidos pelo banco)
  function linhaProduto(p) {
    const t = v => String(v ?? '').trim();
    return {
      cod_alianca: t(p.cod_alianca).toUpperCase(),
      cod_suporte: t(p.cod_suporte) || null,
      descricao: t(p.descricao),
      und_medida: (t(p.und_medida) || 'UND').toUpperCase(),
      valor: semValor(p.valor) ? null : round2(p.valor),
      grupo: t(p.grupo).toUpperCase() || null,
      tipo_corporacao: t(p.tipo_corporacao).toUpperCase() || null,
      corporacao: t(p.corporacao).toUpperCase() || null,
      link_imagem: t(p.link_imagem) || null,
      status: p.status === 'inativo' ? 'inativo' : 'ativo',
    };
  }

  // No modo demonstração, imita a chave estrangeira do banco
  function validarChavesDemo(row) {
    Object.entries(AUXILIARES).forEach(([tabela, campo]) => {
      if (row[campo] && !ls.get(`am_${tabela}`, []).some(x => x.cod === row[campo])) {
        throw new Error('Grupo, tipo de corporação ou corporação informado não está cadastrado.');
      }
    });
  }

  const produtos = {
    async listar() {
      if (demo) return ls.get(PROD_KEY, []).sort((a, b) => a.cod_alianca.localeCompare(b.cod_alianca));
      return buscarTudo(() => sb.from('produtos').select('*').order('cod_alianca'));
    },

    async salvar(p) {
      const row = linhaProduto(p);
      if (demo) {
        validarChavesDemo(row);
        const lista = ls.get(PROD_KEY, []);
        if (lista.some(x => x.cod_alianca === row.cod_alianca && x.id !== p.id)) throw new Error('Já existe um produto com este código.');
        const agora = new Date().toISOString();
        let salvo;
        if (p.id) {
          const i = lista.findIndex(x => x.id === p.id);
          salvo = lista[i] = { ...lista[i], ...row, updated_at: agora };
        } else {
          salvo = { id: ls.nextId('am_seq_produtos'), ...row, created_at: agora, updated_at: agora };
          lista.push(salvo);
        }
        ls.set(PROD_KEY, lista);
        return salvo;
      }
      if (p.id) return check(await sb.from('produtos').update(row).eq('id', p.id).select().single());
      return check(await sb.from('produtos').insert(row).select().single());
    },

    async excluir(id) {
      if (demo) return ls.set(PROD_KEY, ls.get(PROD_KEY, []).filter(x => x.id !== id));
      check(await sb.from('produtos').delete().eq('id', id));
    },

    // Insere ou atualiza vários produtos pelo cod_alianca (importação CSV / reajuste)
    async salvarVarios(linhas) {
      const rows = linhas.map(linhaProduto);
      if (demo) {
        rows.forEach(validarChavesDemo);
        const lista = ls.get(PROD_KEY, []);
        const agora = new Date().toISOString();
        rows.forEach(r => {
          const atual = lista.find(x => x.cod_alianca === r.cod_alianca);
          if (atual) Object.assign(atual, r, { updated_at: agora });
          else lista.push({ id: ls.nextId('am_seq_produtos'), ...r, created_at: agora, updated_at: agora });
        });
        return ls.set(PROD_KEY, lista);
      }
      for (let i = 0; i < rows.length; i += 500) {
        check(await sb.from('produtos').upsert(rows.slice(i, i + 500), { onConflict: 'cod_alianca' }));
      }
    },
  };

  // ---------- Cotações ----------
  const cotacoes = {
    async listar() {
      if (demo) return ls.get('am_cotacoes', []).map(({ itens, ...c }) => c).sort((a, b) => b.id - a.id);
      return buscarTudo(() => sb.from('cotacoes').select('*').order('id', { ascending: false }));
    },

    async obter(id) {
      id = Number(id);
      if (demo) {
        const c = ls.get('am_cotacoes', []).find(x => x.id === id);
        if (!c) throw new Error('Cotação não encontrada.');
        return c;
      }
      const c = check(await sb.from('cotacoes').select('*, cotacao_itens(*)').eq('id', id).single());
      c.itens = (c.cotacao_itens || []).sort((a, b) => a.ordem - b.ordem);
      delete c.cotacao_itens;
      return c;
    },

    // Salva cabeçalho + itens. Retorna o id (número) da cotação.
    async salvar(cot, itens) {
      const row = pick(cot, CAMPOS_COTACAO);
      const linhas = itens.map((it, i) => ({ ...pick(it, CAMPOS_ITEM), ordem: i + 1 }));

      if (demo) {
        const lista = ls.get('am_cotacoes', []);
        let id = cot.id;
        if (id) {
          const i = lista.findIndex(x => x.id === id);
          lista[i] = { ...lista[i], ...row, itens: linhas };
        } else {
          id = ls.nextId('am_seq_cotacoes');
          lista.push({ id, created_by: 'demo', created_at: new Date().toISOString(), ...row, itens: linhas });
        }
        ls.set('am_cotacoes', lista);
        return id;
      }

      let id = cot.id;
      if (id) check(await sb.from('cotacoes').update(row).eq('id', id));
      else id = check(await sb.from('cotacoes').insert(row).select('id').single()).id;

      check(await sb.from('cotacao_itens').delete().eq('cotacao_id', id));
      if (linhas.length) {
        check(await sb.from('cotacao_itens').insert(linhas.map(l => ({ ...l, cotacao_id: id }))));
      }
      return id;
    },

    async excluir(id) {
      if (demo) return ls.set('am_cotacoes', ls.get('am_cotacoes', []).filter(x => x.id !== id));
      check(await sb.from('cotacoes').delete().eq('id', id));
    },
  };

  return {
    demo, auth, empresas, perfis, produtos, cotacoes,
    grupos, tiposCorporacao, corporacoes, condicoesPagamento, prazosEntrega, carregarAuxiliares,
  };
})();
