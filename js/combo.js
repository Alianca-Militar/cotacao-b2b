// Transforma um <select> em uma caixa com pesquisa (digita e filtra as opções).
// O <select> original continua existindo (escondido): o valor e o evento "change" funcionam igual,
// e se as opções dele forem trocadas pelo código, a caixa se atualiza sozinha.

function comboBusca(sel, { placeholder = 'Digite para pesquisar...' } = {}) {
  sel.classList.add('combo-nativo');

  const box = document.createElement('div');
  box.className = 'combo';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `${sel.id}-busca`;
  input.className = 'combo-input';
  input.autocomplete = 'off';
  input.placeholder = placeholder;
  const seta = document.createElement('span');
  seta.className = 'combo-seta';
  seta.textContent = '▾';
  const lista = document.createElement('div');
  lista.className = 'combo-lista';
  lista.hidden = true;
  box.append(input, seta, lista);
  sel.after(box);

  // O rótulo passa a apontar para a caixa de pesquisa
  const rotulo = document.querySelector(`label[for="${sel.id}"]`);
  if (rotulo) rotulo.htmlFor = input.id;

  let opcoes = [];
  let visiveis = [];
  let foco = -1;
  let filtrando = false; // true depois que a pessoa digita algo

  function lerOpcoes() {
    opcoes = [...sel.options].map(o => ({
      valor: o.value,
      texto: o.textContent,
      desativada: o.disabled,
      grupo: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '',
    }));
  }

  function textoSelecionado() {
    const o = sel.selectedOptions[0];
    return o && o.value ? o.textContent : '';
  }

  function render() {
    const termo = filtrando ? input.value.trim() : '';
    visiveis = opcoes.filter(o => !termo || (o.valor && combina(`${o.texto} ${o.valor}`, termo)));
    if (!visiveis.length) {
      lista.innerHTML = '<div class="combo-vazio">Nada encontrado</div>';
      return;
    }
    let grupoAtual = '';
    lista.innerHTML = visiveis.map((o, i) => {
      let html = '';
      if (o.grupo !== grupoAtual) {
        grupoAtual = o.grupo;
        if (o.grupo) html += `<div class="combo-grupo">${esc(o.grupo)}</div>`;
      }
      const classes = ['combo-opcao', o.desativada ? 'desativada' : '', i === foco ? 'foco' : '',
        o.valor === sel.value ? 'atual' : ''].join(' ');
      return html + `<div class="${classes}" data-i="${i}">${esc(o.texto)}</div>`;
    }).join('');
    lista.querySelector('.foco')?.scrollIntoView({ block: 'nearest' });
  }

  function abrir() {
    lerOpcoes();
    filtrando = false;
    foco = -1;
    render();
    lista.hidden = false;
    box.classList.add('aberto');
  }

  function fechar() {
    lista.hidden = true;
    box.classList.remove('aberto');
    filtrando = false;
    input.value = textoSelecionado();
  }

  function escolher(o) {
    if (!o || o.desativada) return;
    sel.value = o.valor;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    fechar();
  }

  function moverFoco(passo) {
    if (!visiveis.length) return;
    let i = foco;
    for (let n = 0; n < visiveis.length; n++) {
      i = (i + passo + visiveis.length) % visiveis.length;
      if (!visiveis[i].desativada) break;
    }
    foco = i;
    render();
  }

  // Receber o foco (ex: ao abrir a janela) não abre a lista: só clique, digitação ou seta para baixo
  input.addEventListener('focus', () => input.select());
  input.addEventListener('click', () => { if (lista.hidden) abrir(); });
  input.addEventListener('input', () => {
    filtrando = true;
    if (lista.hidden) { lista.hidden = false; box.classList.add('aberto'); }
    foco = -1;
    render();
    moverFoco(1); // já deixa a primeira opção válida marcada para o Enter
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (lista.hidden) abrir(); moverFoco(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moverFoco(-1); }
    else if (e.key === 'Enter') {
      if (!lista.hidden && visiveis[foco]) { e.preventDefault(); escolher(visiveis[foco]); }
    } else if (e.key === 'Escape') {
      if (!lista.hidden) { e.preventDefault(); e.stopPropagation(); fechar(); }
    } else if (e.key === 'Tab') {
      fechar();
    }
  });
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) fechar(); }, 120));

  // mousedown (e não click) para escolher antes de o campo perder o foco
  lista.addEventListener('mousedown', e => {
    e.preventDefault();
    const el = e.target.closest('.combo-opcao');
    if (el) escolher(visiveis[Number(el.dataset.i)]);
  });
  seta.addEventListener('mousedown', e => {
    e.preventDefault();
    if (lista.hidden) input.focus(); else fechar();
  });

  // Opções trocadas pelo código (ex: filtros em cascata): atualiza a caixa
  new MutationObserver(() => {
    lerOpcoes();
    if (!lista.hidden) render();
    else input.value = textoSelecionado();
  }).observe(sel, { childList: true, subtree: true });

  // Valor trocado pelo código (ex: "Limpar filtros")
  sel.addEventListener('change', () => { if (lista.hidden) input.value = textoSelecionado(); });

  lerOpcoes();
  input.value = textoSelecionado();

  return {
    atualizar() { lerOpcoes(); input.value = textoSelecionado(); },
  };
}
