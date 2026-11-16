"""
Gera sql/produtos_iniciais.sql a partir da planilha de produtos copiada do Excel.

Uso:
    python scripts/gerar_sql_produtos.py referencias/outros/produtos.txt

O arquivo pode ser CSV do Excel (separado por ;) ou texto copiado do Excel (separado por TAB):
    COD_ALIANCA | COD_SUPORTE | Descrição | Unid | Valor | Grupo | Tipo Corporação | Corporação
Grupo e Tipo Corporação vêm pela DESCRIÇÃO e são convertidos para o código cadastrado.
"""
import csv
import io
import re
import sys
from pathlib import Path

# Mesmos códigos de sql/cadastros_iniciais.sql (descrição -> código)
GRUPOS = {
    'PA - BANDEIRA': 'BANDEIRA',
    'PA - BORDADO COMUM': 'BORDADO',
    'PA - BRASÃO': 'BRASAO',
    'PA - CRACHÁS': 'CRACHA',
    'PA - DIST GOLA': 'DIST_GOLA',
    'PA - DIST PUNHO': 'DIST_PUNHO',
    'PA - GALÃO DE PUNHO': 'GALAO_PUNHO',
    'PA - INS OM AGASALHO': 'INS_AGASALHO',
    'PA - INS OM PLATINA': 'INS_PLATINA',
    'PA - JUGULAR': 'JUGULAR',
    'PA - MP EMBALADA': 'MP_EMBALADA',
    'PA - PALAS': 'PALAS',
    'PA - PASSADEIRAS': 'PASSADEIRAS',
    'PA - QUEPES': 'QUEPES',
}
TIPOS = {
    'AERONALTICA BRASILEIRA': 'AER',
    'BOMBEIRO MILITAR': 'BM',
    'EXERCITO BRASILEIRO': 'EB',
    'GERAL': 'GERAL',
    'MARINHA DO BRASIL': 'MB',
    'POLICIA MILITAR': 'PM',
}
CORPORACOES = set("""
AMAN CBMAC CBMAL CBMAM CBMAP CBMBA CBMDF CBMES CBMGO CBMMA CBMMS CBMMT CBMPA CBMPB CBMPE CBMPR
CBMRJ CBMRO CBMRR CBMRS CBMSC CBMTO CMBMG EB FAB IME MB MERCANTE PMAC PMAL PMAM PMAP PMBA PMCE
PMDF PMES PMGO PMMA PMMG PMMS PMMT PMPA PMPB PMPE PMPR PMRJ PMRO PMRR PMRS PMSC PMSP PMTO TODAS
""".split())


def ler(caminho):
    dados = Path(caminho).read_bytes()
    for enc in ('utf-8-sig', 'cp1252'):
        try:
            return dados.decode(enc)
        except UnicodeDecodeError:
            pass
    raise SystemExit('Não consegui ler o arquivo (codificação desconhecida).')


def chave(texto):
    return re.sub(r'\s+', ' ', texto).strip().upper()


def valor(texto):
    t = texto.replace('R$', '').replace('\xa0', '').strip()
    if not t or t == '-':
        return None
    return float(t.replace('.', '').replace(',', '.'))


def sql_txt(v):
    return 'null' if v in (None, '') else "'" + v.replace("'", "''") + "'"


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    texto = ler(sys.argv[1])
    primeira = texto.splitlines()[0]
    sep = max(['\t', ';', ','], key=primeira.count)
    linhas = [l for l in csv.reader(io.StringIO(texto), delimiter=sep) if any(c.strip() for c in l)]

    produtos, erros, duplicados, sem_valor = {}, [], [], []
    for n, linha in enumerate(linhas, 1):
        col = [c.strip() for c in linha]
        if n == 1 and 'COD' in col[0].upper() and not col[0].upper().startswith('PAL'):
            continue  # cabeçalho
        col += [''] * (8 - len(col))
        cod, suporte, desc, und, val, grupo, tipo, corp = col[:8]
        cod = cod.upper()
        if not cod or not desc:
            erros.append(f'linha {n}: sem código ou descrição')
            continue

        g = GRUPOS.get(chave(grupo)) if grupo else None
        t = TIPOS.get(chave(tipo)) if tipo else None
        c = chave(corp) or None
        if grupo and not g:
            erros.append(f'linha {n} ({cod}): grupo não cadastrado "{grupo}"')
        if tipo and not t:
            erros.append(f'linha {n} ({cod}): tipo de corporação não cadastrado "{tipo}"')
        if c and c not in CORPORACOES:
            erros.append(f'linha {n} ({cod}): corporação não cadastrada "{corp}"')
        try:
            v = valor(val)
        except ValueError:
            erros.append(f'linha {n} ({cod}): valor inválido "{val}"')
            v = None
        if v is None:
            sem_valor.append(cod)
        if cod in produtos:
            duplicados.append(cod)

        produtos[cod] = dict(
            cod_alianca=cod,
            cod_suporte=chave(suporte) or None,
            descricao=re.sub(r'\s+', ' ', desc).strip(),
            und_medida=chave(und) or 'UND',
            valor=v,
            grupo=g, tipo_corporacao=t, corporacao=c,
        )

    if erros:
        print('ERROS (corrija antes de gerar):')
        print('\n'.join('  - ' + e for e in erros))
        raise SystemExit(1)

    lista = list(produtos.values())
    cols = 'cod_alianca, cod_suporte, descricao, und_medida, valor, grupo, tipo_corporacao, corporacao, link_imagem, status'
    partes = [
        '-- ============================================================',
        f'-- Carga inicial de produtos ({len(lista)} itens) - gerado por scripts/gerar_sql_produtos.py',
        '-- Rode DEPOIS de sql/cadastros_iniciais.sql',
        '-- Pode rodar de novo: produto com o mesmo cod_alianca é atualizado.',
        '-- ============================================================',
        '',
        '-- Permite produto sem preço (valor em branco)',
        'alter table public.produtos alter column valor drop not null;',
        'alter table public.produtos alter column valor drop default;',
        '',
    ]
    for i in range(0, len(lista), 500):
        bloco = lista[i:i + 500]
        partes.append(f'insert into public.produtos ({cols}) values')
        partes.append(',\n'.join(
            f"  ({sql_txt(p['cod_alianca'])}, {sql_txt(p['cod_suporte'])}, {sql_txt(p['descricao'])}, "
            f"{sql_txt(p['und_medida'])}, {'null' if p['valor'] is None else format(p['valor'], '.2f')}, {sql_txt(p['grupo'])}, "
            f"{sql_txt(p['tipo_corporacao'])}, {sql_txt(p['corporacao'])}, null, 'ativo')"
            for p in bloco))
        partes.append('on conflict (cod_alianca) do update set\n'
                      '  cod_suporte = excluded.cod_suporte, descricao = excluded.descricao,\n'
                      '  und_medida = excluded.und_medida, valor = excluded.valor, grupo = excluded.grupo,\n'
                      '  tipo_corporacao = excluded.tipo_corporacao, corporacao = excluded.corporacao;\n')
    partes.append('-- Conferência\nselect count(*) as total_produtos from public.produtos;\n')

    destino = Path(__file__).resolve().parent.parent / 'sql' / 'produtos_iniciais.sql'
    destino.write_text('\n'.join(partes), encoding='utf-8')

    print(f'OK: {len(lista)} produtos gravados em {destino}')
    print(f'Sem valor (ficam em branco): {len(sem_valor)}')
    if duplicados:
        print(f'Códigos repetidos na planilha (ficou a última linha): {", ".join(sorted(set(duplicados)))}')


if __name__ == '__main__':
    main()
