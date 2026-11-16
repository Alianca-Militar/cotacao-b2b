// Testa a conexão com o Supabase usando o .env
// Uso: node scripts/testar-conexao.js

const fs = require('fs');
const path = require('path');

const env = {};
const arquivo = path.join(__dirname, '..', '.env');
if (fs.existsSync(arquivo)) {
  fs.readFileSync(arquivo, 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !l.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  });
}
const URL_SB = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/+$/, '');
const CHAVE = process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
const TABELAS = ['grupos', 'tipos_corporacao', 'corporacoes', 'produtos', 'cotacoes', 'cotacao_itens'];

const ok = m => console.log(`  ✔ ${m}`);
const erro = m => console.log(`  ✘ ${m}`);
const aviso = m => console.log(`  ! ${m}`);

(async () => {
  let falhas = 0;
  console.log('\n1. Configuração do .env');
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(URL_SB)) {
    erro(`SUPABASE_URL inválida: "${URL_SB}". Deve ser https://SEU_PROJETO.supabase.co`);
    process.exit(1);
  }
  ok(`URL: ${URL_SB}`);
  if (/^sb_secret_/.test(CHAVE) || /service_role/.test(Buffer.from(CHAVE.split('.')[1] || '', 'base64').toString())) {
    erro('Você colocou a chave SECRETA (service_role / sb_secret). Troque pela anon / publishable!');
    process.exit(1);
  }
  if (!CHAVE) { erro('SUPABASE_ANON_KEY vazia'); process.exit(1); }
  ok('Chave pública preenchida');

  const headers = { apikey: CHAVE };
  if (CHAVE.startsWith('eyJ')) headers.Authorization = `Bearer ${CHAVE}`;

  console.log('\n2. Conexão e chave');
  try {
    const r = await fetch(`${URL_SB}/auth/v1/settings`, { headers });
    if (r.status === 401 || r.status === 403) { erro('Chave recusada pelo Supabase (verifique se copiou inteira)'); process.exit(1); }
    if (!r.ok) { erro(`Resposta inesperada do Supabase: HTTP ${r.status}`); process.exit(1); }
    ok('Supabase respondeu e aceitou a chave');
    const cfg = await r.json();
    if (cfg.disable_signup) ok('Cadastro público desativado (só você cria usuários)');
    else aviso('Cadastro público ATIVADO: desative "Allow new users to sign up" em Authentication > Sign In / Providers');
  } catch (e) {
    erro(`Não foi possível acessar ${URL_SB}: ${e.message}`);
    process.exit(1);
  }

  console.log('\n3. Tabelas');
  for (const t of TABELAS) {
    const r = await fetch(`${URL_SB}/rest/v1/${t}?select=*&limit=1`, { headers });
    const corpo = await r.json().catch(() => ({}));
    if (r.ok) {
      if (Array.isArray(corpo) && corpo.length) {
        aviso(`${t}: existe, mas está visível SEM login (a segurança RLS não está ativa)`);
      } else {
        ok(`${t}: existe e está protegida (sem login não mostra nada)`);
      }
    } else if (r.status === 404 || ['PGRST205', '42P01'].includes(corpo.code)) {
      erro(`${t}: NÃO existe. Rode o sql/schema.sql no SQL Editor`);
      falhas++;
    } else {
      erro(`${t}: HTTP ${r.status} ${corpo.message || ''}`);
      falhas++;
    }
  }

  console.log(falhas
    ? `\nResultado: ${falhas} problema(s) encontrado(s).\n`
    : '\nResultado: tudo certo! Agora crie um usuário e entre no sistema.\n');
  process.exit(falhas ? 1 : 0);
})();
