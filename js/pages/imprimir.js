// Tela: impressão da proposta comercial (modelo A4)

// Linhas do carimbo com os dados da empresa selecionada na cotação
function linhasCarimbo(E) {
  return [
    E.inscricao_estadual ? `INSC. EST. ${E.inscricao_estadual}` : '',
    E.razao_social,
    [E.endereco, E.numero].filter(Boolean).join(', '),
    [E.bairro, E.cep ? `CEP: ${E.cep}` : ''].filter(Boolean).join(' - '),
    [E.cidade, E.estado].filter(Boolean).join(' - '),
  ].filter(Boolean);
}

function htmlProposta(c, E, vendedor) {
  const minimo = APP_CONFIG.LINHAS_IMPRESSAO || 0;

  const linhas = c.itens.map(it => `
    <tr class="item">
      <td class="cinza centro">${esc(it.codigo)}</td>
      <td class="desc">${esc(it.descricao)}</td>
      <td class="centro">${esc(it.unidade)}</td>
      <td class="centro">${fmtQtd(it.quantidade)}</td>
      <td class="centro forte">${fmtBRL(it.preco_unit)}</td>
      <td class="centro">${fmtBRL(it.total)}</td>
    </tr>`);
  for (let i = c.itens.length; i < minimo; i++) {
    linhas.push('<tr class="item"><td class="cinza"></td><td></td><td></td><td></td><td></td><td></td></tr>');
  }

  const total = (rotulo, valor) =>
    `<tr class="tot"><td colspan="4" class="direita forte">${rotulo}</td><td colspan="2" class="centro forte">${fmtBRL(valor)}</td></tr>`;

  return `
    <div class="cabecalho">
      <div class="empresa">
        <div class="razao">${esc(E.razao_social)}</div>
        <div class="cnpj">CNPJ: ${esc(E.cnpj)}${E.inscricao_estadual ? ` - IE.: ${esc(E.inscricao_estadual)}` : ''}</div>
        <div class="titulo">PROPOSTA COMERCIAL <span class="numero">Nº ${c.id}</span></div>
      </div>
      <div class="logo">
        ${E.logo ? `<img src="${esc(E.logo)}" alt="${esc(E.nome)}">` : `<div class="logo-texto">${esc(E.nome)}</div>`}
        ${E.telefone ? `<div class="fone">${esc(fmtTelefone(E.telefone))}</div>` : ''}
      </div>
    </div>

    <table class="t-cliente">
      <tr>
        <td class="rotulo forte">Cliente:</td>
        <td class="cinza forte grande">${esc(c.cliente)}</td>
        <td class="centro forte grande data">${fmtData(c.data)}</td>
      </tr>
    </table>

    <table class="t-itens">
      <colgroup>
        <col style="width: 12.5%"><col><col style="width: 5.5%"><col style="width: 7.5%"><col style="width: 11.5%"><col style="width: 13%">
      </colgroup>
      <thead>
        <tr><th colspan="6" class="cinza">ITENS</th></tr>
        <tr><th>ITEM</th><th>DESCRIÇÃO</th><th>UND.</th><th>QUANT.</th><th>PREÇO UNIT</th><th>PREÇO TOTAL</th></tr>
      </thead>
      <tbody>
        ${linhas.join('')}
        <tr class="tot"><td colspan="4"></td><td colspan="2" class="centro forte">${fmtBRL(c.subtotal)}</td></tr>
        ${total('Descontos:', c.descontos)}
        ${total('Acrescimos:', c.acrescimos)}
        ${total('Frete:', c.frete)}
        ${total('Valor Total:', c.total)}
      </tbody>
    </table>

    <table class="t-obs">
      <tr>
        <td class="rotulo forte">Observações:</td>
        <td class="cinza obs">${esc(c.observacoes).replace(/\n/g, '<br>')}</td>
      </tr>
    </table>

    <table class="t-rodape">
      <colgroup><col style="width: 12.5%"><col style="width: 44%"><col style="width: 12%"><col></colgroup>
      <tr>
        <td>Vendedor(a)</td>
        <td class="cinza forte">${esc(c.vendedor)}</td>
        <td class="centro">WhatsApp</td>
        <td class="centro forte">${esc(fmtTelefone(c.whatsapp))}</td>
      </tr>
      <tr>
        <td>E-mail</td>
        <td class="cinza">${esc(c.email)}</td>
        <td colspan="2" rowspan="4" class="cel-carimbo">
          <div class="carimbo">
            <div class="carimbo-cnpj">${esc(E.cnpj)}</div>
            ${linhasCarimbo(E).map(l => `<div>${esc(l)}</div>`).join('')}
          </div>
        </td>
      </tr>
      <tr><td>Validade</td><td class="cinza vermelho">${esc(c.validade)}</td></tr>
      <tr><td>Entrega</td><td class="cinza vermelho">${esc(c.entrega)}</td></tr>
      <tr><td>Pagamento</td><td class="cinza vermelho">${esc(c.pagamento)}</td></tr>
    </table>

    ${vendedor?.assinatura ? `
    <div class="assinatura">
      <img src="${vendedor.assinatura}" alt="Assinatura">
      <div class="linha-assinatura">${esc(c.vendedor || vendedor.nome)}</div>
      <div class="cargo">Vendedor(a) - ${esc(E.nome)}</div>
    </div>` : ''}
  `;
}

// ============================================================
// PDF + compartilhar (WhatsApp)
// ============================================================
let pdfPronto = null;     // { arquivo: File }

function nomeArquivo(c, empresa) {
  const cliente = String(c.cliente || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
  const [ano, mes, dia] = String(c.data || hojeISO()).slice(0, 10).split('-');
  return `Proposta_${cliente}_${dia}-${mes}-${ano}.pdf`;
}

function botaoWhats(texto, habilitado) {
  const bt = document.getElementById('bt-whatsapp');
  bt.querySelector('span').textContent = texto;
  bt.disabled = !habilitado;
}

function avisoWhats(html) {
  const el = document.getElementById('aviso-whats');
  el.innerHTML = html;
  el.hidden = !html;
}

// Gera o PDF a partir da folha da proposta (cópia sem o zoom da tela do celular)
async function gerarPdf(c, empresa) {
  const copia = document.getElementById('folha').cloneNode(true);
  copia.removeAttribute('id');
  copia.classList.add('pdf');
  const blob = await html2pdf().set({
    margin: 0,
    filename: nomeArquivo(c, empresa),
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.t-obs', '.t-rodape', '.assinatura'] },
  }).from(copia).outputPdf('blob');
  return new File([blob], nomeArquivo(c, empresa), { type: 'application/pdf' });
}

async function prepararCompartilhamento(c, empresa) {
  if (typeof html2pdf === 'undefined') {
    botaoWhats('WhatsApp indisponível', false);
    return;
  }
  try {
    botaoWhats('Preparando PDF...', false);
    const arquivo = await gerarPdf(c, empresa);
    pdfPronto = { arquivo };
    botaoWhats('Enviar pelo WhatsApp', true);
    if (qs('whatsapp')) {
      document.getElementById('bt-whatsapp').classList.add('pulsar');
      avisoWhats('PDF pronto! Toque em <strong>Enviar pelo WhatsApp</strong> e escolha a conversa.');
    }
  } catch (e) {
    console.error(e);
    botaoWhats('Erro ao gerar PDF', false);
  }
}

async function compartilhar() {
  if (!pdfPronto) return;
  const { arquivo } = pdfPronto;
  document.getElementById('bt-whatsapp').classList.remove('pulsar');

  // Celular: abre o compartilhar do sistema (escolhe WhatsApp e depois a conversa)
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: arquivo.name });
      avisoWhats('');
    } catch (e) {
      if (e.name !== 'AbortError') avisoWhats(`Não foi possível compartilhar: ${esc(e.message)}`);
    }
    return;
  }

  // Computador (sem compartilhar nativo): baixa o PDF e abre o WhatsApp Web com a mensagem
  const a = document.createElement('a');
  a.href = URL.createObjectURL(arquivo);
  a.download = arquivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  window.open('https://web.whatsapp.com/', '_blank', 'noopener');
  avisoWhats(`O PDF <strong>${esc(arquivo.name)}</strong> foi baixado. No WhatsApp Web, escolha a conversa e anexe o arquivo (clipe 📎).`);
}

document.getElementById('bt-whatsapp').addEventListener('click', compartilhar);

(async () => {
  const id = qs('id');
  const $folha = document.getElementById('folha');

  if (!await DB.auth.usuario()) {
    location.href = 'login.html';
    return;
  }
  if (!id) {
    $folha.innerHTML = '<p class="msg">Nenhuma cotação informada.</p>';
    return;
  }

  try {
    const c = await DB.cotacoes.obter(id);
    const [empresas, vendedor] = await Promise.all([
      DB.empresas.listar(),
      DB.perfis.obter(c.created_by).catch(() => null),
    ]);
    const empresa = empresas.find(e => e.id === Number(c.empresa_id)) || empresas[0];
    if (!empresa) throw new Error('Nenhuma empresa cadastrada (rode o sql/empresas_perfis.sql).');
    $folha.innerHTML = htmlProposta(c, empresa, vendedor);
    document.getElementById('bt-editar').href = `index.html?id=${c.id}`;
    // O título vira o nome do arquivo ao "Salvar como PDF"
    document.title = `Proposta ${c.id} - ${c.cliente}`;

    // Espera logo e assinatura carregarem (impressão e PDF)
    const imagens = [...$folha.querySelectorAll('img')].map(img => img.complete ? null
      : new Promise(ok => { img.onload = img.onerror = ok; }));
    await Promise.all(imagens);

    if (qs('auto')) {
      history.replaceState(null, '', `imprimir.html?id=${c.id}`);
      setTimeout(() => window.print(), 150);
    }
    prepararCompartilhamento(c, empresa);
  } catch (e) {
    $folha.innerHTML = `<p class="msg">Erro ao carregar a cotação: ${esc(e.message)}</p>`;
  }
})();
