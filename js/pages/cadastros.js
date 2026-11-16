// Tela: cadastros auxiliares (grupos, tipos de corporação, corporações)

const ABAS = {
  grupos: { nome: 'grupo', api: DB.grupos, campoProduto: 'grupo' },
  tipos_corporacao: { nome: 'tipo de corporação', api: DB.tiposCorporacao, campoProduto: 'tipo_corporacao' },
  corporacoes: { nome: 'corporação', api: DB.corporacoes, campoProduto: 'corporacao' },
  condicoes_pagamento: { nome: 'condição de pagamento', api: DB.condicoesPagamento },
  prazos_entrega: { nome: 'prazo de entrega', api: DB.prazosEntrega },
};

const $lista = document.getElementById('lista');
const $busca = document.getElementById('busca');
const $dlg = document.getElementById('dlg');
let aba = ABAS[location.hash.slice(1)] ? location.hash.slice(1) : 'grupos';
let dados = {};
let produtos = [];
let editando = null;

function usoPorCod(campo) {
  const uso = {};
  if (!campo) return uso;
  produtos.forEach(p => { if (p[campo]) uso[p[campo]] = (uso[p[campo]] || 0) + 1; });
  return uso;
}

function trocarAba(nova) {
  aba = nova;
  history.replaceState(null, '', `#${aba}`);
  document.querySelectorAll('.aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
  document.getElementById('btn-novo').textContent = `+ Novo(a) ${ABAS[aba].nome}`;
  // Colunas/campos que só fazem sentido em algumas abas
  const comOrdem = ABAS[aba].api.comOrdem;
  document.querySelectorAll('.col-ordem').forEach(el => { el.hidden = !comOrdem; });
  document.querySelectorAll('.col-produtos').forEach(el => { el.hidden = !ABAS[aba].campoProduto; });
  document.querySelector('.campo-ordem').hidden = !comOrdem;
  const comPct = ABAS[aba].api.extras?.includes('desconto_pct');
  document.querySelectorAll('.col-pct, .campo-pct').forEach(el => { el.hidden = !comPct; });
  $busca.value = '';
  render();
}

function render() {
  const termo = $busca.value.trim();
  const uso = usoPorCod(ABAS[aba].campoProduto);
  const lista = (dados[aba] || []).filter(r => !termo || combina(`${r.cod} ${r.descricao}`, termo));
  document.getElementById('contador').textContent = `${lista.length} registro${lista.length === 1 ? '' : 's'}`;

  if (!lista.length) {
    $lista.innerHTML = `<tr><td colspan="7" class="vazio">${dados[aba]?.length ? 'Nada encontrado.' : `Nenhum ${ABAS[aba].nome} cadastrado.`}</td></tr>`;
    return;
  }
  $lista.innerHTML = lista.map(r => `
    <tr>
      <td class="num" ${ABAS[aba].api.comOrdem ? '' : 'hidden'}>${r.ordem ?? ''}</td>
      <td class="codigo">${esc(r.cod)}</td>
      <td>${esc(r.descricao)}</td>
      ${['desconto_pct', 'acrescimo_pct'].map(c => `<td class="num" ${ABAS[aba].api.extras?.includes(c) ? '' : 'hidden'}>${Number(r[c]) ? fmtQtd(r[c]) + '%' : ''}</td>`).join('')}
      <td class="num" ${ABAS[aba].campoProduto ? '' : 'hidden'}>${uso[r.cod]
        ? `<a href="produtos.html?${ABAS[aba].campoProduto}=${encodeURIComponent(r.cod)}">${uso[r.cod]}</a>`
        : '<span class="sub-celula">0</span>'}</td>
      <td class="num">
        <div class="acoes" style="justify-content: flex-end">
          <button class="btn btn-sm" data-editar="${esc(r.cod)}">Editar</button>
          <button class="btn btn-sm btn-perigo" data-excluir="${esc(r.cod)}">Excluir</button>
        </div>
      </td>
    </tr>`).join('');
}

document.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => trocarAba(b.dataset.aba)));
$busca.addEventListener('input', debounce(render, 120));

// ---------- Cadastro ----------
function abrir(reg) {
  editando = reg || null;
  const { nome, campoProduto } = ABAS[aba];
  document.getElementById('dlg-titulo').textContent = reg ? `Editar ${nome}` : `Novo ${nome}`;
  document.getElementById('f-cod').value = reg?.cod ?? '';
  document.getElementById('f-descricao').value = reg?.descricao ?? '';
  ['desconto_pct', 'acrescimo_pct'].forEach(c => {
    document.getElementById(`f-${c}`).value = Number(reg?.[c]) ? fmtQtd(reg[c]) : '';
  });
  document.getElementById('f-ordem').value = reg?.ordem ?? (reg ? '' : (dados[aba] || []).reduce((m, r) => Math.max(m, r.ordem || 0), 0) + 1);
  const qtd = reg ? (usoPorCod(campoProduto)[reg.cod] || 0) : 0;
  document.getElementById('dlg-aviso').textContent = qtd
    ? `Usado em ${qtd} produto(s). Se trocar o código, eles serão atualizados automaticamente.`
    : '';
  $dlg.showModal();
  document.getElementById(reg ? 'f-descricao' : 'f-cod').focus();
}

document.getElementById('btn-novo').addEventListener('click', () => abrir(null));
document.querySelector('[data-fechar]').addEventListener('click', () => $dlg.close());

document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const reg = {
    cod: document.getElementById('f-cod').value,
    descricao: document.getElementById('f-descricao').value,
    ordem: document.getElementById('f-ordem').value,
    desconto_pct: document.getElementById('f-desconto_pct').value,
    acrescimo_pct: document.getElementById('f-acrescimo_pct').value,
  };
  try {
    const codAntigo = editando?.cod;
    const salvo = await ABAS[aba].api.salvar(reg, codAntigo);
    if (editando) {
      Object.assign(editando, salvo);
      if (codAntigo !== salvo.cod) {
        const campo = ABAS[aba].campoProduto;
        produtos.forEach(p => { if (p[campo] === codAntigo) p[campo] = salvo.cod; });
      }
    } else {
      dados[aba].push(salvo);
    }
    dados[aba] = await ABAS[aba].api.listar();
    $dlg.close();
    render();
    toast(`${salvo.cod} salvo.`);
  } catch (err) {
    toast(err.message, 'erro');
  }
});

$lista.addEventListener('click', async e => {
  const ed = e.target.closest('[data-editar]');
  if (ed) return abrir(dados[aba].find(r => r.cod === ed.dataset.editar));

  const ex = e.target.closest('[data-excluir]');
  if (!ex) return;
  const cod = ex.dataset.excluir;
  const qtd = usoPorCod(ABAS[aba].campoProduto)[cod] || 0;
  if (qtd) return toast(`Não é possível excluir: ${qtd} produto(s) usam ${cod}.`, 'erro');
  if (!confirm(`Excluir ${ABAS[aba].nome} ${cod}?`)) return;
  try {
    await ABAS[aba].api.excluir(cod);
    dados[aba] = dados[aba].filter(r => r.cod !== cod);
    render();
    toast(`${cod} excluído.`);
  } catch (err) {
    toast(err.message, 'erro');
  }
});

// ---------- Inicialização ----------
(async () => {
  if (!await iniciarPagina('cadastros')) return;
  try {
    const [aux, prods, condicoes, prazos] = await Promise.all([
      DB.carregarAuxiliares(), DB.produtos.listar(), DB.condicoesPagamento.listar(), DB.prazosEntrega.listar(),
    ]);
    dados = { ...aux, condicoes_pagamento: condicoes, prazos_entrega: prazos };
    produtos = prods;
  } catch (e) {
    toast('Erro ao carregar: ' + e.message, 'erro');
  }
  trocarAba(aba);
})();
