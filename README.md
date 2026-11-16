# Propostas Comerciais · Aliança Militar

Sistema web simples (HTML + CSS + JavaScript puro) para montar e imprimir cotações.
Hospedagem no **Netlify**, banco de dados no **Supabase**.

## Telas

| Arquivo | Tela |
|---|---|
| `index.html` | Nova cotação: pesquisa de produtos + montagem da proposta |
| `cotacoes.html` | Cotações geradas: imprimir, editar, duplicar, excluir |
| `produtos.html` | Produtos: cadastro, preço direto na tabela, reajuste em %, importar/exportar CSV |
| `cadastros.html` | Grupos, tipos de corporação e corporações (código + descrição) |
| `imprimir.html` | Proposta no modelo A4 para imprimir ou salvar em PDF |
| `login.html` | Login (só com o Supabase configurado) |

## Testar sem banco (modo demonstração)

Com `js/config.js` sem as chaves do Supabase, o sistema funciona salvando tudo **só no navegador**.
Abra a pasta com um servidor local, por exemplo a extensão *Live Server* do VS Code, ou:

```
python -m http.server 8000
```

e acesse http://localhost:8000

## Ligar o Supabase

1. Crie um projeto em https://supabase.com
2. **SQL Editor > New query**: cole o conteúdo de `sql/schema.sql` e clique em **Run**
3. **Authentication > Users > Add user**: crie o usuário de cada vendedor (e-mail + senha, marque *Auto Confirm User*)
4. Em **Authentication > Sign In / Providers**, desative "Allow new users to sign up"
5. Pegue a *Project URL* e a chave *anon public* em **Project Settings > API**

### No seu computador
Preencha o arquivo `.env` (modelo em `.env.example`) e rode:

```
node scripts/gerar-config.js
```

Isso gera `js/env.js`. Rode de novo sempre que mudar o `.env`.

### No Netlify
1. Suba o projeto para o GitHub (o `.env` e o `js/env.js` ficam de fora pelo `.gitignore`)
2. No Netlify: **Add new site > Import an existing project** e escolha o repositório
3. Em **Site configuration > Environment variables**, crie `SUPABASE_URL` e `SUPABASE_ANON_KEY`
4. Faça o deploy. O `netlify.toml` já roda o `node scripts/gerar-config.js` sozinho

> Não use o "arrastar pasta" (Netlify Drop): ele não lê variáveis de ambiente.
> A chave `anon` é pública por natureza (o navegador precisa dela); quem protege os dados é o login + RLS.

## Importar produtos de uma planilha

Na primeira linha da planilha coloque o nome das colunas (em qualquer ordem):

`cod_alianca | cod_suporte | descricao | und_medida | valor | grupo | tipo_corporacao | corporacao | link_imagem | status`

Só `cod_alianca` e `descricao` são obrigatórias. Salve como **CSV (separado por ponto e vírgula)** e use
**Produtos > Importar CSV**. Códigos já cadastrados são atualizados (colunas ausentes no arquivo mantêm o valor atual);
os novos são incluídos. `status` aceita `ativo` / `inativo`.
