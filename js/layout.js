// Cabeçalho/menu comum e proteção das páginas por login

async function iniciarPagina(ativa) {
  const usuario = await DB.auth.usuario();
  if (!usuario) {
    location.href = 'login.html';
    return null;
  }

  // Sem nome no perfil: manda completar antes de usar o sistema
  let perfil = null;
  try { perfil = await DB.perfis.obter(usuario.id); } catch (e) { console.error(e); }
  if (!perfil?.nome && ativa !== 'perfil') {
    location.href = 'perfil.html?primeiro=1';
    return null;
  }

  const links = [
    ['index.html', 'nova', 'Nova cotação'],
    ['cotacoes.html', 'cotacoes', 'Cotações'],
    ['produtos.html', 'produtos', 'Produtos'],
    ['cadastros.html', 'cadastros', 'Cadastros'],
  ];
  const icones = {
    nova: '<path d="M12 5v14M5 12h14"/>',
    cotacoes: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    produtos: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    cadastros: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  };
  const icone = id => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icones[id]}</svg>`;
  const curtos = { nova: 'Nova', cotacoes: 'Cotações', produtos: 'Produtos', cadastros: 'Cadastros', perfil: 'Perfil' };

  const header = document.getElementById('app-header');
  header.innerHTML = `
    <div class="topo">
      <a href="index.html" class="marca">
        <img src="assets/logos/logo-alianca-branca.png" alt="Aliança Militar">
        <span>Propostas<br><small>Comerciais</small></span>
      </a>
      <nav>
        ${links.map(([href, id, nome]) => `<a href="${href}" class="${id === ativa ? 'ativo' : ''}">${nome}</a>`).join('')}
      </nav>
      <div class="usuario">
        <a href="perfil.html" class="link-perfil ${ativa === 'perfil' ? 'ativo' : ''}" title="Meu perfil">${esc(perfil?.nome || usuario.email)}</a>
        ${DB.demo ? '' : '<button class="btn-link" id="btn-sair">Sair</button>'}
      </div>
    </div>
    <nav class="nav-mobile" aria-label="Menu">
      ${[...links, ['perfil.html', 'perfil']].map(([href, id]) =>
        `<a href="${href}" class="${id === ativa ? 'ativo' : ''}">${icone(id)}<span>${curtos[id]}</span></a>`).join('')}
    </nav>
    ${DB.demo ? '<div class="aviso-demo">Modo demonstração: os dados ficam salvos só neste navegador. Configure o Supabase em <code>js/config.js</code>.</div>' : ''}
  `;

  document.body.classList.add('com-nav-mobile');

  document.getElementById('btn-sair')?.addEventListener('click', async () => {
    await DB.auth.sair();
    location.href = 'login.html';
  });

  return { usuario, perfil };
}
