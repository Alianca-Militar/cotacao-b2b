// Tela: cadastro e manutenção de valores de produtos

const MAX_LINHAS = 300;
const CAMPOS = ['cod_alianca', 'cod_suporte', 'descricao', 'und_medida', 'valor', 'grupo',
  'tipo_corporacao', 'corporacao', 'link_imagem', 'status'];
// Nomes alternativos aceitos no cabeçalho do CSV
const APELIDOS = {
  codigo: 'cod_alianca', cod: 'cod_alianca', codigo_alianca: 'cod_alianca',
  codigo_suporte: 'cod_suporte', unidade: 'und_medida', und: 'und_medida',
  preco: 'valor', tipo: 'tipo_corporacao', imagem: 'link_imagem', ativo: 'status',
};

const $lista = document.getElementById('lista');
const $busca = document.getElementById('busca');
const filtros = {
  grupo: document.getElementById('filtro-grupo'),
  tipo_corporacao: document.getElementById('filtro-tipo'),
  corporacao: document.getElementById('filtro-corporacao'),
  status: document.getElementById('filtro-status'),
};
// Campo do produto -> tabela de cadastro (cod + descricao)
const RELACOES = { grupo: 'grupos', tipo_corporacao: 'tipos_corporacao', corporacao: 'corporacoes' };
const API_AUX = { grupos: DB.grupos, tipos_corporacao: DB.tiposCorporacao, corporacoes: DB.corporacoes };

let produtos = [];
let filtrados = [];
let editando = null;
let aux = { grupos: [], tipos_corporacao: [], corporacoes: [] };

// Descrição de um código de grupo/tipo/corporação
function descricaoDe(campo, cod) {
  if (!cod) return '';
  return aux[RELACOES[campo]].find(r => r.cod === cod)?.descricao || cod;
}

// ---------- Listas de opções (filtros, selects do cadastro e sugestões) ----------
function montarOpcoes() {
  Object.entries(RELACOES).forEach(([chave, tabela]) => {
    const opcoes = aux[tabela].map(r => `<option value="${esc(r.cod)}">${esc(r.descricao)} (${esc(r.cod)})</option>`).join('');
    const sel = filtros[chave];
    const atual = sel.value;
    sel.innerHTML = sel.options[0].outerHTML + opcoes;
    sel.value = aux[tabela].some(r => r.cod === atual) ? atual : '';
    campo(chave).innerHTML = '<option value="">(nenhum)</option>' + opcoes;
  });
  const unidades = [...new Set(['UND', ...produtos.map(p => p.und_medida).filter(Boolean)])].sort();
  document.getElementById('dl-und').innerHTML = unidades.map(v => `<option value="${esc(v)}">`).join('');
}

// ---------- Lista ----------
function filtrar() {
  const termo = $busca.value.trim();
  filtrados = produtos.filter(p =>
    Object.entries(filtros).every(([campo, sel]) => !sel.value ||
      (campo === 'status' && sel.value === 'sem_preco' ? semValor(p.valor) : p[campo] === sel.value)) &&
    (!termo || combina(`${p.cod_alianca} ${p.cod_suporte || ''} ${p.descricao} ${p.corporacao || ''}`, termo)));
  render();
}

function thumb(p) {
  return p.link_imagem
    ? `<a href="${esc(p.link_imagem)}" target="_blank" rel="noopener"><img class="thumb" src="${esc(p.link_imagem)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'thumb thumb-vazia',textContent:'!'}))"></a>`
    : '<span class="thumb thumb-vazia"></span>';
}

function render() {
  const n = filtrados.length;
  document.getElementById('contador').textContent = n > MAX_LINHAS
    ? `${n} produtos (mostrando ${MAX_LINHAS}, refine a busca)`
    : `${n} produto${n === 1 ? '' : 's'}`;

  if (!n) {
    $lista.innerHTML = `<tr><td colspan="10" class="vazio">${produtos.length ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado. Clique em "+ Novo produto" ou "Importar CSV".'}</td></tr>`;
    return;
  }
  $lista.innerHTML = filtrados.slice(0, MAX_LINHAS).map(p => `
    <tr>
      <td class="cel-foto">${thumb(p)}</td>
      <td class="codigo" data-label="Cód. Aliança">${esc(p.cod_alianca)}</td>
      <td data-label="Cód. Suporte">${esc(p.cod_suporte)}</td>
      <td class="cel-destaque" data-label="Descrição">${esc(p.descricao)}</td>
      <td data-label="Grupo">${esc(descricaoDe('grupo', p.grupo))}</td>
      <td data-label="Corporação">${esc(p.corporacao)}${p.tipo_corporacao ? `<div class="sub-celula">${esc(descricaoDe('tipo_corporacao', p.tipo_corporacao))}</div>` : ''}</td>
      <td class="centro" data-label="Und.">${esc(p.und_medida)}</td>
      <td class="num" data-label="Valor (R$)"><input class="valor-inline" data-id="${p.id}" value="${fmtValor(p.valor)}" placeholder="sem preço" inputmode="decimal" style="width: 100px; text-align: right"></td>
      <td class="centro" data-label="Status"><span class="tag ${p.status === 'inativo' ? 'tag-off' : 'tag-ok'}">${p.status === 'inativo' ? 'Inativo' : 'Ativo'}</span></td>
      <td class="num cel-acoes">
        <div class="acoes" style="justify-content: flex-end; flex-wrap: nowrap">
          <button class="btn btn-sm" data-editar="${p.id}">Editar</button>
          <button class="btn btn-sm btn-perigo" data-excluir="${p.id}">Excluir</button>
        </div>
      </td>
    </tr>`).join('');
}

$busca.addEventListener('input', debounce(filtrar, 120));
Object.values(filtros).forEach(sel => sel.addEventListener('change', filtrar));

// ---------- Valor direto na tabela ----------
$lista.addEventListener('focusin', e => { if (e.target.matches('.valor-inline')) e.target.select(); });
$lista.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.valor-inline')) e.target.blur(); });
$lista.addEventListener('change', async e => {
  const el = e.target;
  if (!el.matches('.valor-inline')) return;
  const p = produtos.find(x => x.id === Number(el.dataset.id));
  const novo = parseValor(el.value);
  el.value = fmtValor(novo);
  if (novo === (semValor(p.valor) ? null : Number(p.valor))) return;
  try {
    Object.assign(p, await DB.produtos.salvar({ ...p, valor: novo }));
    toast(`${p.cod_alianca}: ${novo === null ? 'valor removido' : `valor alterado para ${fmtBRL(novo)}`}`);
  } catch (err) {
    el.value = fmtValor(p.valor);
    toast('Erro ao salvar valor: ' + err.message, 'erro');
  }
});

// ---------- Editar / excluir ----------
$lista.addEventListener('click', async e => {
  const ed = e.target.closest('[data-editar]');
  if (ed) return abrirProduto(produtos.find(x => x.id === Number(ed.dataset.editar)));

  const ex = e.target.closest('[data-excluir]');
  if (!ex) return;
  const p = produtos.find(x => x.id === Number(ex.dataset.excluir));
  if (!confirm(`Excluir o produto ${p.cod_alianca} - ${p.descricao}?\n\nDica: se ele pode voltar a ser vendido, prefira editar e mudar o status para inativo.`)) return;
  try {
    await DB.produtos.excluir(p.id);
    produtos = produtos.filter(x => x.id !== p.id);
    montarOpcoes();
    filtrar();
    toast(`Produto ${p.cod_alianca} excluído.`);
  } catch (err) {
    toast('Erro ao excluir: ' + err.message, 'erro');
  }
});

// ---------- Modal de cadastro ----------
const $dlgProduto = document.getElementById('dlg-produto');
const $preview = document.getElementById('p-preview');
function campo(nome) { return document.getElementById(`p-${nome}`); }

function atualizarPreview() {
  const url = campo('link_imagem').value.trim();
  $preview.hidden = !url;
  if (url) $preview.src = url;
}
campo('link_imagem').addEventListener('input', debounce(atualizarPreview, 300));
$preview.addEventListener('error', () => { $preview.hidden = true; });

function abrirProduto(p) {
  editando = p || null;
  document.getElementById('dlg-titulo').textContent = p ? `Editar produto ${p.cod_alianca}` : 'Novo produto';
  CAMPOS.forEach(c => { campo(c).value = p?.[c] ?? ''; });
  // Produto antigo com código que não existe mais no cadastro: mantém visível no select
  Object.keys(RELACOES).forEach(c => {
    if (p?.[c] && campo(c).value !== p[c]) {
      campo(c).insertAdjacentHTML('beforeend', `<option value="${esc(p[c])}">${esc(p[c])} (não cadastrado)</option>`);
      campo(c).value = p[c];
    }
  });
  campo('valor').value = p ? fmtValor(p.valor) : '';
  campo('und_medida').value = p?.und_medida || 'UND';
  campo('status').value = p?.status || 'ativo';
  document.getElementById('p-datas').textContent = p?.created_at
    ? `Cadastrado em ${new Date(p.created_at).toLocaleString('pt-BR')} · Última alteração em ${new Date(p.updated_at).toLocaleString('pt-BR')}`
    : '';
  atualizarPreview();
  $dlgProduto.showModal();
  campo(p ? 'descricao' : 'cod_alianca').focus();
}

document.getElementById('btn-novo').addEventListener('click', () => abrirProduto(null));

document.getElementById('form-produto').addEventListener('submit', async e => {
  e.preventDefault();
  const dados = { id: editando?.id };
  CAMPOS.forEach(c => { dados[c] = campo(c).value; });
  dados.valor = parseValor(dados.valor);
  try {
    const salvo = await DB.produtos.salvar(dados);
    if (editando) Object.assign(editando, salvo);
    else produtos.push(salvo);
    produtos.sort((a, b) => a.cod_alianca.localeCompare(b.cod_alianca));
    $dlgProduto.close();
    montarOpcoes();
    filtrar();
    toast(`Produto ${salvo.cod_alianca} salvo.`);
  } catch (err) {
    toast(err.message, 'erro');
  }
});

document.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

// ---------- Reajuste em massa ----------
const $dlgReajuste = document.getElementById('dlg-reajuste');

document.getElementById('btn-reajuste').addEventListener('click', () => {
  if (!filtrados.length) return toast('Nenhum produto na lista para reajustar.', 'erro');
  document.getElementById('reajuste-info').innerHTML =
    `O reajuste será aplicado aos <strong>${filtrados.length} produto(s)</strong> que estão na lista agora ` +
    `(respeitando a pesquisa e os filtros de grupo, corporação e status). Filtre antes para reajustar só um grupo.`;
  document.getElementById('r-percentual').value = '';
  $dlgReajuste.showModal();
});

document.getElementById('form-reajuste').addEventListener('submit', async e => {
  e.preventDefault();
  const perc = parseNum(document.getElementById('r-percentual').value);
  if (!perc) return toast('Informe um percentual diferente de zero.', 'erro');
  if (!confirm(`Aplicar ${perc > 0 ? '+' : ''}${fmtQtd(perc)}% em ${filtrados.length} produto(s)?`)) return;
  const fator = 1 + perc / 100;
  // Produtos sem preço continuam sem preço
  const atualizados = filtrados.filter(p => !semValor(p.valor)).map(p => ({ ...p, valor: round2(Number(p.valor) * fator) }));
  try {
    await DB.produtos.salvarVarios(atualizados);
    produtos = await DB.produtos.listar();
    $dlgReajuste.close();
    filtrar();
    toast(`Reajuste de ${fmtQtd(perc)}% aplicado em ${atualizados.length} produto(s).`);
  } catch (err) {
    toast('Erro no reajuste: ' + err.message, 'erro');
  }
});

// ---------- Importar CSV ----------
const $dlgImportar = document.getElementById('dlg-importar');
let linhasImportar = [];

function lerCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const primeira = texto.split(/\r?\n/)[0];
  const sep = ['\t', ';', ','].sort((a, b) => primeira.split(b).length - primeira.split(a).length)[0];
  const linhas = [];
  let valor = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { valor += '"'; i++; }
      else if (c === '"') aspas = false;
      else valor += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(valor); valor = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(valor); linhas.push(linha); linha = []; valor = '';
    } else valor += c;
  }
  if (valor || linha.length) { linha.push(valor); linhas.push(linha); }
  return linhas.filter(l => l.some(v => v.trim()));
}

// Descobre qual coluna é qual pelo cabeçalho; sem cabeçalho, usa a ordem padrão
function mapearColunas(primeiraLinha) {
  const nomes = primeiraLinha.map(v => {
    const n = norm(v).trim().replace(/[\s.\-]+/g, '_');
    return CAMPOS.includes(n) ? n : APELIDOS[n];
  });
  if (nomes.includes('cod_alianca') && nomes.includes('descricao')) return { colunas: nomes, temCabecalho: true };
  return { colunas: CAMPOS, temCabecalho: false };
}

const NOMES_AUX = { grupos: 'grupo(s)', tipos_corporacao: 'tipo(s) de corporação', corporacoes: 'corporação(ões)' };
let auxNovos = {};

// Aceita o código ou a descrição do cadastro; se não existir, agenda a criação
function resolverCodigo(campoProd, valor) {
  if (!valor) return null;
  const tabela = RELACOES[campoProd];
  const cod = valor.toUpperCase();
  const achado = aux[tabela].find(r => r.cod === cod) || aux[tabela].find(r => norm(r.descricao) === norm(valor));
  if (achado) return achado.cod;
  if (!auxNovos[tabela].has(cod)) auxNovos[tabela].set(cod, { cod, descricao: valor });
  return cod;
}

function lerStatus(v) {
  return /^(i|n|f|0)/i.test(String(v || '').trim()) ? 'inativo' : 'ativo';
}

document.getElementById('btn-importar').addEventListener('click', () => {
  document.getElementById('form-importar').reset();
  document.getElementById('i-previa').textContent = '';
  document.getElementById('i-confirmar').disabled = true;
  linhasImportar = [];
  $dlgImportar.showModal();
});

document.getElementById('i-arquivo').addEventListener('change', async e => {
  const arq = e.target.files[0];
  if (!arq) return;
  let texto = await arq.text();
  // Excel no Windows costuma salvar CSV em ANSI (Windows-1252)
  if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(await arq.arrayBuffer());

  const linhas = lerCSV(texto);
  if (!linhas.length) return;
  const { colunas, temCabecalho } = mapearColunas(linhas[0]);
  if (temCabecalho) linhas.shift();

  const porCodigo = new Map(produtos.map(p => [p.cod_alianca, p]));
  let invalidas = 0, novos = 0;
  linhasImportar = [];
  auxNovos = { grupos: new Map(), tipos_corporacao: new Map(), corporacoes: new Map() };
  linhas.forEach(l => {
    const lido = {};
    colunas.forEach((c, i) => { if (c && l[i] !== undefined) lido[c] = l[i].trim(); });
    if (!lido.cod_alianca || !lido.descricao) { invalidas++; return; }
    if ('valor' in lido) lido.valor = parseValor(lido.valor);
    if ('status' in lido) lido.status = lerStatus(lido.status);
    Object.keys(RELACOES).forEach(c => { if (c in lido) lido[c] = resolverCodigo(c, lido[c]); });

    // Colunas que não vieram no arquivo mantêm o que já está cadastrado
    const existente = porCodigo.get(lido.cod_alianca.toUpperCase());
    if (!existente) novos++;
    linhasImportar.push({ ...(existente || {}), ...lido });
  });

  const ex = linhasImportar[0];
  document.getElementById('i-previa').innerHTML =
    `Colunas reconhecidas: <code>${colunas.filter(Boolean).join(', ')}</code>${temCabecalho ? '' : ' (sem cabeçalho, usei a ordem padrão)'}<br>` +
    `<strong>${linhasImportar.length}</strong> produto(s) lidos: <strong>${novos}</strong> novo(s) e ` +
    `<strong>${linhasImportar.length - novos}</strong> a atualizar.` +
    (invalidas ? `<br>${invalidas} linha(s) ignorada(s) por falta de cod_alianca ou descrição.` : '') +
    Object.entries(auxNovos).filter(([, m]) => m.size).map(([tabela, m]) =>
      `<br>Serão criados ${m.size} ${NOMES_AUX[tabela]}: <code>${[...m.keys()].slice(0, 8).map(esc).join(', ')}${m.size > 8 ? '...' : ''}</code>`).join('') +
    (ex ? `<br>Exemplo: ${esc(ex.cod_alianca)} · ${esc(ex.descricao)} · ${semValor(ex.valor) ? 'sem preço' : fmtBRL(ex.valor)}` : '');
  document.getElementById('i-confirmar').disabled = !linhasImportar.length;
});

document.getElementById('form-importar').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('i-confirmar');
  btn.disabled = true;
  try {
    // Primeiro cria os grupos/tipos/corporações novos, depois os produtos (por causa da chave)
    for (const [tabela, m] of Object.entries(auxNovos)) {
      await API_AUX[tabela].salvarVarios([...m.values()]);
    }
    await DB.produtos.salvarVarios(linhasImportar);
    [produtos, aux] = await Promise.all([DB.produtos.listar(), DB.carregarAuxiliares()]);
    $dlgImportar.close();
    montarOpcoes();
    filtrar();
    toast(`${linhasImportar.length} produto(s) importado(s).`);
  } catch (err) {
    toast('Erro na importação: ' + err.message, 'erro');
    btn.disabled = false;
  }
});

// ---------- Exportar CSV ----------
document.getElementById('btn-exportar').addEventListener('click', () => {
  const linhas = [CAMPOS.concat(['created_at', 'updated_at'])].concat(produtos.map(p => [
    ...CAMPOS.map(c => (c === 'valor' ? fmtValor(p.valor) : p[c] ?? '')),
    p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '',
    p.updated_at ? new Date(p.updated_at).toLocaleString('pt-BR') : '',
  ]));
  const csv = '﻿' + linhas.map(l => l.map(v => /[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `produtos-alianca-${hojeISO()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Inicialização ----------
(async () => {
  if (!await iniciarPagina('produtos')) return;
  try {
    [produtos, aux] = await Promise.all([DB.produtos.listar(), DB.carregarAuxiliares()]);
  } catch (e) {
    toast('Erro ao carregar produtos: ' + e.message, 'erro');
  }
  montarOpcoes();
  // Vindo da tela de Cadastros: produtos.html?corporacao=PMBA
  Object.keys(RELACOES).forEach(c => {
    if (qs(c)) { filtros[c].value = qs(c); filtros.status.value = ''; }
  });
  filtrar();
})();
