// ============================================================
// CONFIGURAÇÃO DO SISTEMA
// ------------------------------------------------------------
// As chaves do Supabase vêm de js/env.js, que é GERADO a partir de:
//   - arquivo .env (no seu computador): rode  node scripts/gerar-config.js
//   - variáveis de ambiente do Netlify (no deploy, automático)
// Sem as chaves, o sistema roda em MODO DEMONSTRAÇÃO (dados só neste navegador).
// ============================================================
const ENV = window.ENV || {};

window.APP_CONFIG = {
  SUPABASE_URL: ENV.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY || '',

  // Dados da empresa (cabeçalho e carimbo da impressão) ficam na tabela "empresas" do banco.

  // Valores que vêm preenchidos em toda cotação nova.
  // Vendedor, e-mail e WhatsApp vêm do perfil de quem está logado.
  PADROES_COTACAO: {
    validade: '7 dias',
    entrega: '30 Dias',     // precisa existir em Cadastros > Prazos de entrega
    pagamento: 'A VISTA',   // precisa existir em Cadastros > Condições de pagamento
  },

  // Cliente PF (Pessoa Física): preço do item = preço de tabela x este valor. PJ usa o preço de tabela.
  MULTIPLICADOR_PF: 1.3,

  // Quantidade mínima de linhas na tabela impressa (completa com linhas vazias).
  // 0 = só as linhas dos itens da cotação.
  LINHAS_IMPRESSAO: 0,
};
