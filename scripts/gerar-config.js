// Gera js/env.js com as variáveis do Supabase.
// - No Netlify: lê as variáveis de ambiente do site (Site configuration > Environment variables)
// - No seu computador: lê o arquivo .env da raiz do projeto
// Uso: node scripts/gerar-config.js

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const VARIAVEIS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

// Lê o .env (se existir) sem sobrescrever o que já veio do ambiente
const arquivoEnv = path.join(raiz, '.env');
if (fs.existsSync(arquivoEnv)) {
  fs.readFileSync(arquivoEnv, 'utf8').split(/\r?\n/).forEach(linha => {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || linha.trim().startsWith('#')) return;
    const valor = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  });
}

const env = {};
VARIAVEIS.forEach(v => { env[v] = (process.env[v] || '').trim(); });

const faltando = VARIAVEIS.filter(v => !env[v]);
if (faltando.length) {
  const msg = `Variáveis não definidas: ${faltando.join(', ')}`;
  // No Netlify, falha o deploy para não publicar o site em modo demonstração por engano
  if (process.env.NETLIFY === 'true') {
    console.error(`ERRO: ${msg}. Cadastre em Site configuration > Environment variables.`);
    process.exit(1);
  }
  console.warn(`AVISO: ${msg}. O sistema vai rodar em modo demonstração.`);
}

const conteudo =
  '// Arquivo gerado automaticamente por scripts/gerar-config.js. Não edite.\n' +
  `window.ENV = ${JSON.stringify(env, null, 2)};\n`;

fs.writeFileSync(path.join(raiz, 'js', 'env.js'), conteudo);
console.log('js/env.js gerado.');
