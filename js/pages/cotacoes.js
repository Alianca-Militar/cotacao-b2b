// Tela: lista de cotações geradas

const $lista = document.getElementById('lista');
const $busca = document.getElementById('busca');
let cotacoes = [];
let empresas = [];
const nomeEmpresa = id => empresas.find(e => e.id === Number(id))?.nome || '';

function render() {
  const termo = $busca.value.trim();
  const filtradas = cotacoes.filter(c => !termo || combina(`${c.id} ${c.cliente} ${c.vendedor} ${nomeEmpresa(c.empresa_id)}`, termo));

  document.getElementById('resumo').textContent =
    `${filtradas.length} cotação(ões) · total ${fmtBRL(filtradas.reduce((s, c) => s + Number(c.total || 0), 0))}`;

  if (!filtradas.length) {
    $lista.innerHTML = `<tr><td colspan="7" class="vazio">${cotacoes.length ? 'Nenhuma cotação encontrada.' : 'Nenhuma cotação gerada ainda.'}</td></tr>`;
    return;
  }

  $lista.innerHTML = filtradas.map(c => `
    <tr>
      <td class="codigo" data-label="Nº">${c.id}</td>
      <td data-label="Data">${fmtData(c.data)}</td>
      <td data-label="Empresa"><span class="empresa-sel">${esc(nomeEmpresa(c.empresa_id))}</span></td>
      <td data-label="Cliente" class="cel-destaque">${esc(c.cliente)}</td>
      <td data-label="Vendedor(a)">${esc(c.vendedor)}</td>
      <td class="num" data-label="Total"><strong>${fmtBRL(c.total)}</strong></td>
      <td class="num cel-acoes">
        <div class="acoes" style="justify-content: flex-end">
          <button class="btn btn-sm btn-dourado" data-itens="${c.id}" title="Ver itens para copiar e colar no SAP">Itens</button>
          <a class="btn btn-sm btn-primario" href="imprimir.html?id=${c.id}">Imprimir</a>
          <a class="btn btn-sm" href="index.html?id=${c.id}">Editar</a>
          <a class="btn btn-sm" href="index.html?duplicar=${c.id}">Duplicar</a>
          <button class="btn btn-sm btn-perigo" data-excluir="${c.id}">Excluir</button>
        </div>
      </td>
    </tr>`).join('');
}

$busca.addEventListener('input', debounce(render, 120));

$lista.addEventListener('click', async e => {
  const bi = e.target.closest('[data-itens]');
  if (bi) return abrirItens(Number(bi.dataset.itens));

  const btn = e.target.closest('[data-excluir]');
  if (!btn) return;
  const id = Number(btn.dataset.excluir);
  const c = cotacoes.find(x => x.id === id);
  if (!confirm(`Excluir a cotação nº ${id} (${c.cliente})? Essa ação não pode ser desfeita.`)) return;
  try {
    await DB.cotacoes.excluir(id);
    cotacoes = cotacoes.filter(x => x.id !== id);
    render();
    toast(`Cotação nº ${id} excluída.`);
  } catch (err) {
    toast('Erro ao excluir: ' + err.message, 'erro');
  }
});

// ============================================================
// Itens da cotação com seleção estilo Excel (para colar no SAP)
// ============================================================
const COLUNAS = [
  { nome: 'Código', valor: it => it.codigo || '' },
  { nome: 'Descrição', valor: it => it.descricao || '' },
  { nome: 'Und.', valor: it => it.unidade || '' },
  { nome: 'Quant.', valor: it => fmtQtd(it.quantidade), num: true },
  { nome: 'Preço unit.', valor: it => fmtNum(it.preco_unit), num: true },
  { nome: 'Total', valor: it => fmtNum(it.total), num: true },
];
const $dlgItens = document.getElementById('dlg-itens');
const $grade = document.getElementById('grade');
let itensAbertos = [];
let sel = null;          // { r0, c0, r1, c1 }: linhas/colunas da seleção
let arrastando = false;

async function abrirItens(id) {
  try {
    const c = await DB.cotacoes.obter(id);
    itensAbertos = c.itens || [];
    document.getElementById('itens-titulo').textContent =
      `Cotação nº ${c.id} · ${c.cliente} · ${itensAbertos.length} item(ns)`;
    sel = null;
    renderGrade();
    $dlgItens.showModal();
  } catch (err) {
    toast('Erro ao carregar itens: ' + err.message, 'erro');
  }
}

function renderGrade() {
  $grade.innerHTML = `
    <thead><tr>
      <th class="ln"></th>
      ${COLUNAS.map((col, c) => `
        <th class="${col.num ? 'num' : ''}" data-col="${c}" title="Clique para selecionar a coluna inteira">
          ${col.nome}<button type="button" class="copiar-col" data-copiar-col="${c}" title="Copiar coluna">⧉</button>
        </th>`).join('')}
    </tr></thead>
    <tbody>
      ${itensAbertos.map((it, r) => `
        <tr>
          <td class="ln">${r + 1}</td>
          ${COLUNAS.map((col, c) => `<td class="cel ${col.num ? 'num' : ''}" data-r="${r}" data-c="${c}">${esc(col.valor(it))}</td>`).join('')}
        </tr>`).join('')}
    </tbody>`;
  pintarSelecao();
}

function normalizada() {
  if (!sel) return null;
  return {
    r0: Math.min(sel.r0, sel.r1), r1: Math.max(sel.r0, sel.r1),
    c0: Math.min(sel.c0, sel.c1), c1: Math.max(sel.c0, sel.c1),
  };
}

function pintarSelecao() {
  const s = normalizada();
  $grade.querySelectorAll('.cel').forEach(td => {
    const r = +td.dataset.r, c = +td.dataset.c;
    td.classList.toggle('sel', !!s && r >= s.r0 && r <= s.r1 && c >= s.c0 && c <= s.c1);
  });
  document.getElementById('sel-info').textContent = s
    ? `${s.r1 - s.r0 + 1} linha(s) × ${s.c1 - s.c0 + 1} coluna(s) selecionada(s). Ctrl+C para copiar.`
    : '';
  document.getElementById('btn-copiar-sel').disabled = !s;
}

// Mesmo formato do Excel: colunas separadas por TAB, linhas por quebra de linha
function textoDe(r0, r1, c0, c1) {
  const linhas = [];
  for (let r = r0; r <= r1; r++) {
    const valores = [];
    for (let c = c0; c <= c1; c++) {
      valores.push(String(COLUNAS[c].valor(itensAbertos[r])).replace(/[\t\r\n]+/g, ' '));
    }
    linhas.push(valores.join('\t'));
  }
  return linhas.join('\r\n');
}

async function copiarTexto(texto, descricao) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // Alternativa para navegadores sem acesso direto à área de transferência
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    $dlgItens.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(`${descricao} copiado. Agora é só colar no SAP (Ctrl+V).`);
}

function copiarSelecao() {
  const s = normalizada();
  if (!s || !itensAbertos.length) return;
  copiarTexto(textoDe(s.r0, s.r1, s.c0, s.c1), `${(s.r1 - s.r0 + 1) * (s.c1 - s.c0 + 1)} valor(es)`);
}

// Clique e arraste para selecionar (Shift+clique estende a seleção)
$grade.addEventListener('mousedown', e => {
  const td = e.target.closest('.cel');
  if (!td) return;
  e.preventDefault();
  const r = +td.dataset.r, c = +td.dataset.c;
  if (e.shiftKey && sel) { sel.r1 = r; sel.c1 = c; } else { sel = { r0: r, c0: c, r1: r, c1: c }; }
  arrastando = true;
  pintarSelecao();
});
$grade.addEventListener('mouseover', e => {
  if (!arrastando) return;
  const td = e.target.closest('.cel');
  if (!td) return;
  sel.r1 = +td.dataset.r;
  sel.c1 = +td.dataset.c;
  pintarSelecao();
});
document.addEventListener('mouseup', () => { arrastando = false; });

// Cabeçalho: clique seleciona a coluna inteira; botão ⧉ copia direto
$grade.addEventListener('click', e => {
  if (!itensAbertos.length) return;
  const ultima = itensAbertos.length - 1;
  const bc = e.target.closest('[data-copiar-col]');
  if (bc) {
    const c = +bc.dataset.copiarCol;
    sel = { r0: 0, r1: ultima, c0: c, c1: c };
    pintarSelecao();
    copiarTexto(textoDe(0, ultima, c, c), `Coluna ${COLUNAS[c].nome} (${itensAbertos.length} valores)`);
    return;
  }
  const th = e.target.closest('th[data-col]');
  if (!th) return;
  const c = +th.dataset.col;
  if (e.shiftKey && sel) sel = { r0: 0, r1: ultima, c0: sel.c0, c1: c };
  else sel = { r0: 0, r1: ultima, c0: c, c1: c };
  pintarSelecao();
});

// Atalhos com a janela aberta: Ctrl+C copia, Ctrl+A seleciona tudo
$dlgItens.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const tecla = e.key.toLowerCase();
  if (tecla === 'c' && sel) {
    e.preventDefault();
    copiarSelecao();
  }
  if (tecla === 'a' && itensAbertos.length) {
    e.preventDefault();
    sel = { r0: 0, r1: itensAbertos.length - 1, c0: 0, c1: COLUNAS.length - 1 };
    pintarSelecao();
  }
});

document.getElementById('btn-copiar-sel').addEventListener('click', copiarSelecao);
document.getElementById('btn-copiar-tudo').addEventListener('click', () => {
  if (!itensAbertos.length) return;
  const cabecalho = COLUNAS.map(c => c.nome).join('\t');
  copiarTexto(`${cabecalho}\r\n${textoDe(0, itensAbertos.length - 1, 0, COLUNAS.length - 1)}`, 'Tabela inteira');
});
document.getElementById('itens-fechar').addEventListener('click', () => $dlgItens.close());

(async () => {
  if (!await iniciarPagina('cotacoes')) return;
  try {
    [cotacoes, empresas] = await Promise.all([DB.cotacoes.listar(), DB.empresas.listar()]);
  } catch (e) {
    toast('Erro ao carregar cotações: ' + e.message, 'erro');
  }
  render();
})();
