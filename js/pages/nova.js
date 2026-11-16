// Tela: Nova cotação / edição de cotação

const MAX_RESULTADOS = 100;
const CAMPOS_PADRAO = []; // campos cujo último valor usado é lembrado (nenhum: sempre usa APP_CONFIG.PADROES_COTACAO)

const $busca = document.getElementById('busca');
const $resultados = document.getElementById('resultados');
const $contador = document.getElementById('contador');
const $itens = document.getElementById('itens');

let produtos = [];
let filtrados = [];
let focoIdx = 0;
let cot = novaCotacao();
let itens = [];
let sujo = false;
let empresas = [];
const $empresa = document.getElementById('empresa');
let listas = { entrega: [], pagamento: [] }; // prazos de entrega e condições de pagamento cadastrados

// Só deixa escolher o que está cadastrado. Valor antigo fora da lista continua visível, marcado.
function montarListasCondicoes() {
  Object.entries(listas).forEach(([campo, opcoes]) => {
    const sel = document.getElementById(campo);
    const atual = cot[campo];
    const nomes = opcoes.map(o => o.descricao);
    sel.innerHTML = '<option value="">Selecione...</option>' +
      nomes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') +
      (atual && !nomes.includes(atual) ? `<option value="${esc(atual)}">${esc(atual)} (fora da lista)</option>` : '');
  });
}

// ---------- Padrões (lembra os últimos valores usados neste computador) ----------
function lerPadroes() {
  let salvos = {};
  try { salvos = JSON.parse(localStorage.getItem('am_padroes')) || {}; } catch { /* ignora */ }
  const p = {};
  CAMPOS_PADRAO.forEach(k => { if (salvos[k] !== undefined) p[k] = salvos[k]; });
  return p;
}
function gravarPadroes() {
  const p = {};
  CAMPOS_PADRAO.forEach(k => { p[k] = cot[k]; });
  localStorage.setItem('am_padroes', JSON.stringify(p));
}
function novaCotacao() {
  return {
    id: null, cliente: '', tipo_cliente: '', data: hojeISO(), observacoes: '',
    descontos: 0, acrescimos: 0, frete: 0,
    ...APP_CONFIG.PADROES_COTACAO, ...lerPadroes(),
  };
}

// ---------- Empresa (define qual código de produto sai na cotação) ----------
function empresaAtual() {
  return empresas.find(e => e.id === Number(cot.empresa_id)) || null;
}

function campoCodigo() {
  return empresaAtual()?.campo_codigo || 'cod_alianca';
}

function codigoDoProduto(p) {
  return p[campoCodigo()] || '';
}

function montarEmpresas() {
  $empresa.innerHTML = '<option value="">Selecione a empresa...</option>' +
    empresas.map(e => `<option value="${e.id}">${esc(e.nome)} - ${esc(e.razao_social)} (${esc(e.cnpj)})</option>`).join('');
  $empresa.value = cot.empresa_id || '';
}

// Ao trocar de empresa, os códigos dos itens já adicionados são trocados também
function atualizarCodigosItens() {
  const semCodigo = [];
  itens.forEach(it => {
    const p = produtos.find(x => x.id === it.produto_id);
    if (!p) return;
    it.codigo = codigoDoProduto(p);
    if (!it.codigo) semCodigo.push(p.cod_alianca);
  });
  renderItens();
  if (semCodigo.length) {
    toast(`${semCodigo.length} item(ns) sem código de suporte cadastrado: ${semCodigo.slice(0, 5).join(', ')}${semCodigo.length > 5 ? '...' : ''}`, 'erro');
  }
}

$empresa.addEventListener('change', () => {
  cot.empresa_id = $empresa.value ? Number($empresa.value) : null;
  if (cot.empresa_id) localStorage.setItem('am_empresa', cot.empresa_id);
  sujo = true;
  atualizarCodigosItens();
  renderResultados();
  document.getElementById('cliente').focus();
});

// ---------- Formulário ----------
function preencherForm() {
  document.querySelectorAll('[data-campo]').forEach(el => {
    const v = cot[el.dataset.campo];
    el.value = el.hasAttribute('data-dinheiro') ? fmtNum(v) : (v ?? '');
  });
  atualizarNumero();
}

document.querySelectorAll('[data-campo]').forEach(el => {
  const dinheiro = el.hasAttribute('data-dinheiro');
  el.addEventListener('input', () => {
    cot[el.dataset.campo] = dinheiro ? parseNum(el.value) : el.value;
    sujo = true;
    if (dinheiro) atualizarTotais();
  });
  if (dinheiro) {
    el.addEventListener('focus', () => el.select());
    el.addEventListener('blur', () => { el.value = fmtNum(parseNum(el.value)); });
  }
});

function atualizarNumero() {
  const $n = document.getElementById('numero');
  if (cot.id) {
    $n.textContent = `Cotação nº ${cot.id}`;
    $n.classList.remove('nova');
    document.getElementById('titulo').textContent = `Editando cotação nº ${cot.id}`;
    document.title = `Cotação ${cot.id} | Aliança Militar`;
  } else {
    $n.textContent = 'Cotação ainda não salva';
    $n.classList.add('nova');
  }
}

// ---------- Pesquisa de produtos ----------
const FILTROS = {
  grupo: { tabela: 'grupos', nome: 'Grupo' },
  tipo_corporacao: { tabela: 'tipos_corporacao', nome: 'Tipo' },
  corporacao: { tabela: 'corporacoes', nome: 'Corporação' },
};
const filtrosAtivos = { grupo: '', tipo_corporacao: '', corporacao: '' };
const $dlgFiltros = document.getElementById('dlg-filtros');
const $chips = document.getElementById('filtros-ativos');

let aux = { grupos: [], tipos_corporacao: [], corporacoes: [] };

function descricaoDe(tabela, cod) {
  return cod ? (aux[tabela].find(r => r.cod === cod)?.descricao || cod) : '';
}

function produtosAtivos() {
  return produtos.filter(p => p.status !== 'inativo');
}

function passaTermo(p, termo) {
  return !termo || combina(`${p.cod_alianca} ${p.cod_suporte || ''} ${p.descricao} ${p.corporacao || ''} ${descricaoDe('corporacoes', p.corporacao)}`, termo);
}

// "ignorar": filtro que não entra na conta (usado para montar as opções dele mesmo)
function passaFiltros(p, ignorar) {
  return Object.keys(FILTROS).every(c => c === ignorar || !filtrosAtivos[c] || p[c] === filtrosAtivos[c]);
}

function qtdFiltrosAtivos() {
  return Object.values(filtrosAtivos).filter(Boolean).length;
}

function pesquisar() {
  const termo = $busca.value.trim();
  filtrados = produtosAtivos().filter(p => passaFiltros(p) && passaTermo(p, termo));
  focoIdx = 0;
  renderResultados();
  renderFiltrosAtivos();
}

// ---------- Janela de filtros (em cascata) ----------
// Cada select mostra só as opções que ainda têm produtos com os OUTROS filtros escolhidos
function montarOpcoesFiltros() {
  const termo = $busca.value.trim();
  const base = produtosAtivos().filter(p => passaTermo(p, termo));

  Object.entries(FILTROS).forEach(([campo, { tabela }]) => {
    const sel = $dlgFiltros.querySelector(`[data-filtro="${campo}"]`);
    const contagem = {};
    base.filter(p => passaFiltros(p, campo)).forEach(p => {
      if (p[campo]) contagem[p[campo]] = (contagem[p[campo]] || 0) + 1;
    });
    const atual = filtrosAtivos[campo];
    const opcao = (r, desativada) =>
      `<option value="${esc(r.cod)}"${desativada ? ' disabled' : ''}>${esc(r.descricao)} (${contagem[r.cod] || 0})</option>`;
    // Com produtos: selecionáveis no topo. Sem produtos nos filtros atuais: aparecem em cinza no fim.
    const comProduto = aux[tabela].filter(r => contagem[r.cod] || r.cod === atual);
    const semProduto = aux[tabela].filter(r => !contagem[r.cod] && r.cod !== atual);
    sel.innerHTML = '<option value="">Todos</option>' +
      comProduto.map(r => opcao(r, false)).join('') +
      (semProduto.length
        ? `<optgroup label="Sem produtos${qtdFiltrosAtivos() || termo ? ' com os filtros atuais' : ' cadastrados'}">${semProduto.map(r => opcao(r, true)).join('')}</optgroup>`
        : '');
    sel.value = atual;
  });

  const n = base.filter(p => passaFiltros(p)).length;
  document.getElementById('resumo-filtro').innerHTML =
    `<strong>${n}</strong> produto${n === 1 ? '' : 's'} com ${qtdFiltrosAtivos() ? 'estes filtros' : 'nenhum filtro'}` +
    (termo ? ` na pesquisa "<em>${esc(termo)}</em>"` : '');
  document.getElementById('btn-aplicar-filtros').textContent = `Ver ${n} produto${n === 1 ? '' : 's'}`;
}

document.getElementById('btn-filtros').addEventListener('click', () => {
  montarOpcoesFiltros();
  $dlgFiltros.showModal();
});

// Campos de filtro com pesquisa (digita para achar a opção, sem rolar a lista)
$dlgFiltros.querySelectorAll('[data-filtro]').forEach(sel => comboBusca(sel, { placeholder: 'Todos (digite para pesquisar)' }));

$dlgFiltros.querySelectorAll('[data-filtro]').forEach(sel => sel.addEventListener('change', () => {
  filtrosAtivos[sel.dataset.filtro] = sel.value;
  montarOpcoesFiltros();
  pesquisar();
}));

document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
  Object.keys(filtrosAtivos).forEach(c => { filtrosAtivos[c] = ''; });
  montarOpcoesFiltros();
  pesquisar();
});

document.getElementById('form-filtros').addEventListener('submit', () => {
  // method="dialog" fecha a janela sozinho
  setTimeout(() => $busca.focus(), 0);
});

// ---------- Filtros ativos (etiquetas abaixo da pesquisa) ----------
function renderFiltrosAtivos() {
  const qtd = qtdFiltrosAtivos();
  const $badge = document.getElementById('badge-filtros');
  $badge.hidden = !qtd;
  $badge.textContent = qtd;
  document.getElementById('btn-filtros').classList.toggle('ativo', qtd > 0);

  $chips.hidden = !qtd;
  $chips.innerHTML = Object.entries(FILTROS).filter(([c]) => filtrosAtivos[c]).map(([c, { tabela, nome }]) => `
    <span class="chip"><small>${nome}:</small> ${esc(descricaoDe(tabela, filtrosAtivos[c]))}
      <button type="button" data-tirar-filtro="${c}" title="Remover filtro">&times;</button></span>`).join('') +
    (qtd > 1 ? '<button type="button" class="btn-link" data-tirar-filtro="*" style="font-size: 12.5px">Limpar todos</button>' : '');
}

$chips.addEventListener('click', e => {
  const b = e.target.closest('[data-tirar-filtro]');
  if (!b) return;
  const c = b.dataset.tirarFiltro;
  Object.keys(filtrosAtivos).forEach(k => { if (c === '*' || k === c) filtrosAtivos[k] = ''; });
  pesquisar();
  $busca.focus();
});

// ---------- Modo de visualização: lista ou grade (estilo loja) ----------
let modoVis = (() => { try { return localStorage.getItem('am_modo_vis') || 'lista'; } catch { return 'lista'; } })();

function aplicarModoVis() {
  document.querySelectorAll('.modo-vis button').forEach(b => b.classList.toggle('ativo', b.dataset.modo === modoVis));
  $resultados.classList.toggle('grade', modoVis === 'grade');
  document.getElementById('layout-cotacao').classList.toggle('modo-grade', modoVis === 'grade');
  renderResultados();
}

document.querySelectorAll('.modo-vis button').forEach(b => b.addEventListener('click', () => {
  modoVis = b.dataset.modo;
  try { localStorage.setItem('am_modo_vis', modoVis); } catch { /* ignora */ }
  aplicarModoVis();
  $busca.focus();
}));

// Separa o tamanho do fim da descrição: "QUEPE CINZA PMES MASCULINO Nº 56" -> nome + "Nº 56"
function separarTamanho(descricao) {
  const m = String(descricao).match(/\s*[-–]?\s*\bN\s*[º°o.]?\s*(\d{2,3})\s*$/i);
  if (!m) return { nome: descricao, tamanho: '' };
  return { nome: descricao.slice(0, m.index).trim(), tamanho: `Nº ${m[1]}` };
}

function qtdNaCotacao(p) {
  return itens.filter(it => it.produto_id === p.id).reduce((s, it) => s + Number(it.quantidade || 0), 0);
}

const ICONE_SEM_FOTO = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';

function htmlCodigo(p) {
  return codigoDoProduto(p) ? esc(codigoDoProduto(p)) : '<span class="sem-preco">sem cód. suporte</span>';
}

function htmlPreco(p) {
  return semValor(p.valor) ? '<span class="sem-preco">sem preço</span>' : fmtBRL(precoDoProduto(p));
}

function htmlLista(p, i) {
  const qtd = qtdNaCotacao(p);
  const outroCodigo = campoCodigo() === 'cod_suporte'
    ? ` <span class="info">(${esc(p.cod_alianca)})</span>`
    : (p.cod_suporte ? ` <span class="info">(${esc(p.cod_suporte)})</span>` : '');
  return `
    <div class="resultado ${i === focoIdx ? 'foco' : ''}" data-i="${i}" title="Clique para adicionar">
      ${p.link_imagem ? `<img class="thumb" src="${esc(p.link_imagem)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="thumb thumb-vazia"></span>'}
      <span class="cod">${htmlCodigo(p)}${outroCodigo} · ${esc(p.und_medida)}${qtd ? ` <span class="na-cotacao">✓ ${fmtQtd(qtd)} na cotação</span>` : ''}</span>
      <span class="desc">${esc(p.descricao)}</span>
      <span class="info">${[descricaoDe('grupos', p.grupo), p.corporacao].filter(Boolean).map(esc).join(' · ')}</span>
      <span class="preco">${htmlPreco(p)}</span>
    </div>`;
}

function htmlCartao(p, i) {
  const { nome, tamanho } = separarTamanho(p.descricao);
  const qtd = qtdNaCotacao(p);
  const foto = p.link_imagem
    ? `<img src="${esc(p.link_imagem)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('foto-erro'); this.remove()">`
    : '';
  return `
    <div class="resultado cartao ${i === focoIdx ? 'foco' : ''} ${qtd ? 'adicionado' : ''}" data-i="${i}" title="${esc(p.descricao)}">
      <div class="cartao-foto ${foto ? '' : 'foto-erro'}">
        ${foto}
        <span class="cartao-sem-foto">${ICONE_SEM_FOTO}<small>${esc(p.corporacao || '')}</small></span>
        ${qtd ? `<span class="selo-cotacao">✓ ${fmtQtd(qtd)}</span>` : ''}
      </div>
      <div class="cartao-corpo">
        <div class="cartao-cod">${htmlCodigo(p)} <span>· ${esc(p.und_medida)}</span></div>
        <div class="cartao-nome">${esc(nome)}</div>
        <div class="cartao-rodape">
          ${tamanho ? `<span class="tamanho">${tamanho}</span>` : '<span></span>'}
          <span class="cartao-preco">${htmlPreco(p)}</span>
        </div>
      </div>
      <div class="cartao-add">+ Adicionar</div>
    </div>`;
}

function renderResultados() {
  const total = filtrados.length;
  const universo = produtosAtivos().length;
  const filtrando = qtdFiltrosAtivos() || $busca.value.trim();
  $contador.textContent = (filtrando
    ? `${total} de ${universo} produto${universo === 1 ? '' : 's'}`
    : `${total} produto${total === 1 ? '' : 's'}`) +
    (total > MAX_RESULTADOS ? ` (mostrando ${MAX_RESULTADOS}, refine a busca)` : '');

  if (!total) {
    $resultados.innerHTML = `<div class="vazio">Nenhum produto encontrado.${
      !produtos.length ? '<br>Cadastre produtos na aba <a href="produtos.html">Produtos</a>.'
        : qtdFiltrosAtivos() ? '<br>Tente remover algum filtro.' : ''}</div>`;
    return;
  }
  const montar = modoVis === 'grade' ? htmlCartao : htmlLista;
  const scroll = $resultados.scrollTop;
  $resultados.innerHTML = filtrados.slice(0, MAX_RESULTADOS).map(montar).join('');
  $resultados.scrollTop = scroll;
}

$busca.addEventListener('input', debounce(pesquisar, 120));
$busca.addEventListener('keydown', e => {
  const max = Math.min(filtrados.length, MAX_RESULTADOS) - 1;
  // Na grade, as setas andam uma linha inteira de cartões
  const passo = modoVis === 'grade'
    ? Math.max(1, getComputedStyle($resultados).gridTemplateColumns.split(' ').length) : 1;
  if (e.key === 'ArrowDown') { e.preventDefault(); focoIdx = Math.min(focoIdx + passo, max); renderResultados(); rolarFoco(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); focoIdx = Math.max(focoIdx - passo, 0); renderResultados(); rolarFoco(); }
  if (e.key === 'Enter' && filtrados[focoIdx]) { e.preventDefault(); adicionar(filtrados[focoIdx]); }
});
function rolarFoco() {
  $resultados.querySelector('.foco')?.scrollIntoView({ block: 'nearest' });
}

$resultados.addEventListener('click', e => {
  const el = e.target.closest('.resultado');
  if (el) adicionar(filtrados[Number(el.dataset.i)]);
});

// ---------- Itens ----------
function adicionar(p) {
  let idx = itens.findIndex(i => i.produto_id === p.id);
  if (idx >= 0) {
    itens[idx].quantidade = Number(itens[idx].quantidade) + 1;
  } else {
    itens.push({
      produto_id: p.id, codigo: codigoDoProduto(p), descricao: p.descricao,
      unidade: p.und_medida, quantidade: 1, preco_unit: precoDoProduto(p) ?? 0,
    });
    idx = itens.length - 1;
  }
  sujo = true;
  renderItens();
  if (!codigoDoProduto(p)) toast(`${p.cod_alianca} não tem código de suporte cadastrado.`, 'erro');
  if (semValor(p.valor) && itens[idx].preco_unit === 0) {
    toast(`${p.cod_alianca} está sem preço cadastrado: informe o valor na cotação.`, 'erro');
    const el = $itens.querySelector(`input[data-i="${idx}"][data-k="preco_unit"]`);
    if (el) { el.focus(); el.select(); return; }
  }
  if (ehCelular()) {
    toast(`${codigoDoProduto(p) || p.cod_alianca} adicionado · ${itens.length} item(ns) na cotação`);
    return;
  }
  focarQtd(idx);
}

function ehCelular() {
  return window.matchMedia('(max-width: 700px)').matches;
}

function focarQtd(i) {
  const el = $itens.querySelector(`input[data-i="${i}"][data-k="quantidade"]`);
  if (el) { el.focus(); el.select(); }
}

document.getElementById('btn-avulso').addEventListener('click', () => {
  itens.push({ produto_id: null, codigo: '', descricao: '', unidade: 'UND', quantidade: 1, preco_unit: 0 });
  sujo = true;
  renderItens();
  $itens.querySelector(`input[data-i="${itens.length - 1}"][data-k="codigo"]`)?.focus();
});

// ---------- Preço conforme o tipo do cliente ----------
function fatorPreco() {
  return cot.tipo_cliente === 'PF' ? (Number(APP_CONFIG.MULTIPLICADOR_PF) || 1) : 1;
}

// Preço unitário do produto para o cliente atual (null se o produto não tem preço)
function precoDoProduto(p) {
  return semValor(p.valor) ? null : round2(Number(p.valor) * fatorPreco());
}

// Ao trocar PJ/PF, recalcula o preço dos itens que vieram do cadastro de produtos
function recalcularPrecosItens() {
  let alterados = 0;
  itens.forEach(it => {
    const p = produtos.find(x => x.id === it.produto_id);
    const preco = p ? precoDoProduto(p) : null;
    if (preco !== null && preco !== it.preco_unit) { it.preco_unit = preco; alterados++; }
  });
  renderItens();
  renderResultados();
  if (alterados) {
    toast(cot.tipo_cliente === 'PF'
      ? `Preços de ${alterados} item(ns) ajustados para PF (tabela x ${fmtQtd(fatorPreco())}).`
      : `Preços de ${alterados} item(ns) voltaram para a tabela (PJ).`);
  }
}

document.getElementById('tipo_cliente').addEventListener('change', recalcularPrecosItens);

function renderItens() {
  if (!itens.length) {
    $itens.innerHTML = '<tr><td colspan="7" class="vazio">Nenhum item. Pesquise um produto e clique nele (ou tecle Enter) para adicionar.</td></tr>';
  } else {
    $itens.innerHTML = itens.map((it, i) => `
      <tr class="item-linha">
        <td class="it-cod" data-label="Código"><input class="cod" data-i="${i}" data-k="codigo" value="${esc(it.codigo)}"></td>
        <td class="it-desc" data-label="Descrição"><input data-i="${i}" data-k="descricao" value="${esc(it.descricao)}"></td>
        <td class="centro it-und" data-label="Und."><input class="und" data-i="${i}" data-k="unidade" value="${esc(it.unidade)}"></td>
        <td class="num it-qtd" data-label="Quant."><input class="qtd" data-i="${i}" data-k="quantidade" inputmode="decimal" value="${fmtQtd(it.quantidade)}"></td>
        <td class="num it-preco" data-label="Preço unit."><input class="preco" data-i="${i}" data-k="preco_unit" inputmode="decimal" value="${fmtNum(it.preco_unit)}"></td>
        <td class="num total-linha it-total" data-label="Total" id="tl-${i}">${fmtBRL(round2(it.quantidade * it.preco_unit))}</td>
        <td class="it-remover"><button class="remover" data-remover="${i}" title="Remover item">&times;</button></td>
      </tr>`).join('');
  }
  atualizarTotais();
  if (produtos.length) renderResultados(); // atualiza o selo "na cotação" na pesquisa
}

$itens.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.k) return;
  const it = itens[Number(el.dataset.i)];
  const k = el.dataset.k;
  it[k] = (k === 'quantidade' || k === 'preco_unit') ? parseNum(el.value) : el.value;
  document.getElementById(`tl-${el.dataset.i}`).textContent = fmtBRL(round2(it.quantidade * it.preco_unit));
  sujo = true;
  atualizarTotais();
});

$itens.addEventListener('focusin', e => {
  if (e.target.matches('.qtd, .preco')) e.target.select();
});

$itens.addEventListener('focusout', e => {
  const el = e.target;
  if (el.dataset.k === 'preco_unit') el.value = fmtNum(parseNum(el.value));
  if (el.dataset.k === 'quantidade') el.value = fmtQtd(parseNum(el.value));
});

// Tab na quantidade pula direto para a quantidade do próximo item (Shift+Tab volta).
// Enter na quantidade/preço volta para a pesquisa.
$itens.addEventListener('keydown', e => {
  if (e.key === 'Tab' && e.target.matches('.qtd')) {
    const qtds = [...$itens.querySelectorAll('input.qtd')];
    const destino = qtds[qtds.indexOf(e.target) + (e.shiftKey ? -1 : 1)];
    if (destino) {           // no último item, o Tab segue o caminho normal
      e.preventDefault();
      destino.focus();
      destino.select();
    }
    return;
  }
  if (e.key === 'Enter' && e.target.matches('input')) {
    e.preventDefault();
    $busca.focus();
    $busca.select();
  }
});

$itens.addEventListener('click', e => {
  const btn = e.target.closest('[data-remover]');
  if (!btn) return;
  itens.splice(Number(btn.dataset.remover), 1);
  sujo = true;
  renderItens();
});

// ---------- Totais ----------
function calcular() {
  const subtotal = round2(itens.reduce((s, it) => s + round2(Number(it.quantidade) * Number(it.preco_unit)), 0));
  const total = round2(subtotal - Number(cot.descontos || 0) + Number(cot.acrescimos || 0) + Number(cot.frete || 0));
  return { subtotal, total };
}

// ---------- Regras da condição de pagamento ----------
// Ex: A VISTA = 5% de desconto; CARTÃO 2X = 10% de acréscimo (percentuais vêm de Cadastros).
// Enquanto houver regra, o campo fica travado e é recalculado sozinho.
const automatico = { descontos: false, acrescimos: false };

function regraPagamento() {
  const c = listas.pagamento.find(o => o.descricao === cot.pagamento);
  return { descontos: Number(c?.desconto_pct) || 0, acrescimos: Number(c?.acrescimo_pct) || 0 };
}

function aplicarRegrasPagamento() {
  const regra = regraPagamento();
  const subtotal = round2(itens.reduce((s, it) => s + round2(Number(it.quantidade) * Number(it.preco_unit)), 0));
  [['descontos', 'Descontos', 'desconto'], ['acrescimos', 'Acréscimos', 'acréscimo']].forEach(([campo, rotulo, nome]) => {
    const pct = regra[campo];
    const $in = document.getElementById(campo);
    const $lbl = document.getElementById(`lbl-${campo}`);
    if (pct > 0) {
      cot[campo] = round2(subtotal * pct / 100);
      automatico[campo] = true;
      $in.readOnly = true;
      $in.classList.add('somente-leitura');
      $in.title = `${fmtQtd(pct)}% de ${nome} automático (${cot.pagamento})`;
      $lbl.textContent = `${rotulo} (${fmtQtd(pct)}%)`;
      if (document.activeElement !== $in) $in.value = fmtNum(cot[campo]);
    } else {
      if (automatico[campo]) {          // saiu de uma condição com regra: zera o valor automático
        cot[campo] = 0;
        $in.value = fmtNum(0);
        automatico[campo] = false;
      }
      $in.readOnly = false;
      $in.classList.remove('somente-leitura');
      $in.title = '';
      $lbl.textContent = rotulo;
    }
  });
}

document.getElementById('pagamento').addEventListener('change', () => atualizarTotais());

function atualizarTotais() {
  aplicarRegrasPagamento();
  const { subtotal, total } = calcular();
  document.getElementById('subtotal').textContent = fmtBRL(subtotal);
  document.getElementById('total').textContent = fmtBRL(total);
  document.getElementById('resumo-barra').textContent =
    `${itens.length} item${itens.length === 1 ? '' : 's'} · ${fmtBRL(total)}`;
}

// Celular: botão da barra inferior leva até a lista de itens
document.getElementById('btn-ver-itens').addEventListener('click', () => {
  document.getElementById('card-itens').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- Salvar ----------
async function salvar(imprimir) {
  if (!cot.empresa_id) {
    toast('Selecione a empresa.', 'erro');
    $empresa.focus();
    return;
  }
  if (!String(cot.cliente).trim()) {
    toast('Informe o nome do cliente.', 'erro');
    document.getElementById('cliente').focus();
    return;
  }
  if (!['PJ', 'PF'].includes(cot.tipo_cliente)) {
    toast('Selecione o tipo do cliente (PJ ou PF).', 'erro');
    document.getElementById('tipo_cliente').focus();
    return;
  }
  for (const [campo, nome] of [['entrega', 'o prazo de entrega'], ['pagamento', 'a condição de pagamento']]) {
    if (!listas[campo].some(o => o.descricao === cot[campo])) {
      toast(`Selecione ${nome} da lista.`, 'erro');
      document.getElementById(campo).focus();
      return;
    }
  }
  if (!itens.length) {
    toast('Adicione pelo menos um item.', 'erro');
    $busca.focus();
    return;
  }
  if (itens.some(it => !String(it.descricao).trim())) {
    toast('Existe item sem descrição.', 'erro');
    return;
  }

  const botoes = document.querySelectorAll('#btn-salvar, #btn-imprimir');
  botoes.forEach(b => { b.disabled = true; });
  try {
    const { subtotal, total } = calcular();
    const linhas = itens.map(it => ({
      ...it,
      quantidade: Number(it.quantidade),
      preco_unit: round2(it.preco_unit),
      total: round2(Number(it.quantidade) * Number(it.preco_unit)),
    }));
    cot.id = await DB.cotacoes.salvar({ ...cot, cliente: cot.cliente.trim(), subtotal, total }, linhas);
    sujo = false;
    gravarPadroes();
    history.replaceState(null, '', `index.html?id=${cot.id}`);
    atualizarNumero();
    if (imprimir) {
      location.href = `imprimir.html?id=${cot.id}&auto=1`;
    } else {
      toast(`Cotação nº ${cot.id} salva.`);
    }
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'erro');
  } finally {
    botoes.forEach(b => { b.disabled = false; });
  }
}

document.getElementById('btn-salvar').addEventListener('click', () => salvar(false));
document.getElementById('btn-imprimir').addEventListener('click', () => salvar(true));

document.getElementById('btn-limpar').addEventListener('click', () => {
  if (sujo && !confirm('Descartar as alterações não salvas?')) return;
  sujo = false;
  location.href = 'index.html';
});

window.addEventListener('beforeunload', e => {
  if (sujo) e.preventDefault();
});

// ---------- Inicialização ----------
(async () => {
  const sessao = await iniciarPagina('nova');
  if (!sessao) return;

  try {
    const idEditar = qs('id');
    const idDuplicar = qs('duplicar');
    if (idEditar || idDuplicar) {
      const c = await DB.cotacoes.obter(idEditar || idDuplicar);
      itens = c.itens.map(({ produto_id, codigo, descricao, unidade, quantidade, preco_unit }) =>
        ({ produto_id, codigo, descricao, unidade, quantidade: Number(quantidade), preco_unit: Number(preco_unit) }));
      delete c.itens;
      cot = { ...novaCotacao(), ...c };
      if (idDuplicar) {
        cot.id = null;
        cot.data = hojeISO();
        document.getElementById('titulo').textContent = `Nova cotação (cópia da nº ${idDuplicar})`;
        sujo = true;
      }
    }
  } catch (e) {
    toast(e.message, 'erro');
  }

  // Cotação nova (ou cópia): vendedor é quem está logado
  if (!cot.id) {
    cot.vendedor = sessao.perfil?.nome || '';
    cot.email = sessao.usuario.email || '';
    cot.whatsapp = fmtTelefone(sessao.perfil?.telefone);
  }

  try {
    let prazos, condicoes;
    [produtos, aux, empresas, prazos, condicoes] = await Promise.all([
      DB.produtos.listar(), DB.carregarAuxiliares(), DB.empresas.listar(),
      DB.prazosEntrega.listar(), DB.condicoesPagamento.listar(),
    ]);
    listas = { entrega: prazos, pagamento: condicoes };
  } catch (e) {
    toast('Erro ao carregar dados: ' + e.message, 'erro');
  }

  // Empresa: a da cotação; se nova, a última usada neste computador
  if (!cot.empresa_id) {
    const ultima = Number(localStorage.getItem('am_empresa'));
    if (empresas.some(e => e.id === ultima)) cot.empresa_id = ultima;
  }
  aplicarModoVis();
  montarEmpresas();
  montarListasCondicoes();
  preencherForm();
  renderItens();
  pesquisar();
  if (!cot.empresa_id) $empresa.focus();
})();
