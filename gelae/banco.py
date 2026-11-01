"""Banco de dados local (SQLite) do sistema Gelaê.

Dinheiro sempre em centavos (inteiro). Quantidade em REAL (permite kg de gelo, por exemplo).
Datas em texto 'AAAA-MM-DD HH:MM:SS', hora local.
"""
import contextlib
import datetime
import os
import shutil
import sqlite3
import threading
import unicodedata


def agora():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def hoje():
    return datetime.date.today().isoformat()


def normalizar(txt):
    """Minúsculas e sem acento, para busca ('Água' acha 'agua')."""
    txt = unicodedata.normalize("NFD", str(txt or ""))
    return "".join(c for c in txt if unicodedata.category(c) != "Mn").lower()


def pasta_dados():
    base = os.environ.get("GELAE_DADOS") or os.path.join(
        os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "Gelae")
    os.makedirs(base, exist_ok=True)
    return base


CONFIG_PADRAO = {
    "nome_loja": "Gelaê - Cidade Alta",
    "endereco": "",
    "telefone": "",
    "documento": "",
    "mensagem_cupom": "Obrigado pela preferência! Se beber, não dirija.",
    "largura_cupom": "80",
    "imprimir_ao_fechar": "0",
    # Taxa da maquininha por forma de pagamento, em % (texto com ponto decimal).
    "taxa_dinheiro": "0",
    "taxa_pix": "0",
    "taxa_debito": "1.5",
    "taxa_credito": "3.5",
    "taxa_fiado": "0",
}

# Cada item é uma versão do banco. Nunca alterar um item já publicado: acrescentar outro no fim.
MIGRACOES = [
    """
    CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT);

    CREATE TABLE categorias (
        id INTEGER PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE produtos (
        id INTEGER PRIMARY KEY,
        nome TEXT NOT NULL,
        categoria_id INTEGER REFERENCES categorias(id),
        codigo_barras TEXT,
        unidade TEXT NOT NULL DEFAULT 'un',
        preco INTEGER NOT NULL DEFAULT 0,
        unidades_caixa INTEGER NOT NULL DEFAULT 1,
        preco_caixa INTEGER NOT NULL DEFAULT 0,
        custo INTEGER NOT NULL DEFAULT 0,
        estoque REAL NOT NULL DEFAULT 0,
        estoque_minimo REAL NOT NULL DEFAULT 0,
        controla_estoque INTEGER NOT NULL DEFAULT 1,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL
    );
    CREATE INDEX ix_produtos_codigo ON produtos(codigo_barras);

    CREATE TABLE compras (
        id INTEGER PRIMARY KEY,
        data TEXT NOT NULL,
        fornecedor TEXT,
        observacao TEXT,
        total INTEGER NOT NULL DEFAULT 0,
        criado_em TEXT NOT NULL
    );

    CREATE TABLE compra_itens (
        id INTEGER PRIMARY KEY,
        compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
        produto_id INTEGER NOT NULL REFERENCES produtos(id),
        quantidade REAL NOT NULL,
        custo_unit INTEGER NOT NULL
    );

    -- Todo movimento de estoque: inicial, entrada, venda, estorno, ajuste, perda.
    CREATE TABLE movimentos (
        id INTEGER PRIMARY KEY,
        produto_id INTEGER NOT NULL REFERENCES produtos(id),
        data TEXT NOT NULL,
        tipo TEXT NOT NULL,
        quantidade REAL NOT NULL,
        custo_unit INTEGER NOT NULL DEFAULT 0,
        referencia TEXT,
        observacao TEXT
    );
    CREATE INDEX ix_movimentos_produto ON movimentos(produto_id, data);
    CREATE INDEX ix_movimentos_data ON movimentos(data);

    CREATE TABLE caixas (
        id INTEGER PRIMARY KEY,
        aberto_em TEXT NOT NULL,
        fechado_em TEXT,
        valor_abertura INTEGER NOT NULL DEFAULT 0,
        valor_contado INTEGER,
        observacao TEXT
    );

    CREATE TABLE caixa_movimentos (
        id INTEGER PRIMARY KEY,
        caixa_id INTEGER NOT NULL REFERENCES caixas(id),
        data TEXT NOT NULL,
        tipo TEXT NOT NULL,
        valor INTEGER NOT NULL,
        motivo TEXT
    );

    -- Venda de balcão e comanda são a mesma coisa: uma venda que fica aberta até ser paga.
    CREATE TABLE vendas (
        id INTEGER PRIMARY KEY,
        tipo TEXT NOT NULL DEFAULT 'comanda',
        nome TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'aberta',
        aberta_em TEXT NOT NULL,
        fechada_em TEXT,
        desconto INTEGER NOT NULL DEFAULT 0,
        acrescimo INTEGER NOT NULL DEFAULT 0,
        observacao TEXT,
        caixa_id INTEGER REFERENCES caixas(id)
    );
    CREATE INDEX ix_vendas_status ON vendas(status);
    CREATE INDEX ix_vendas_fechada ON vendas(fechada_em);

    -- embalagem 'un' ou 'cx'; fator = unidades que saem do estoque por embalagem vendida.
    -- preco_unit e custo_unit são por embalagem vendida.
    CREATE TABLE venda_itens (
        id INTEGER PRIMARY KEY,
        venda_id INTEGER NOT NULL REFERENCES vendas(id),
        produto_id INTEGER NOT NULL REFERENCES produtos(id),
        descricao TEXT NOT NULL,
        embalagem TEXT NOT NULL DEFAULT 'un',
        fator INTEGER NOT NULL DEFAULT 1,
        quantidade REAL NOT NULL,
        preco_unit INTEGER NOT NULL,
        custo_unit INTEGER NOT NULL,
        adicionado_em TEXT NOT NULL
    );
    CREATE INDEX ix_venda_itens_venda ON venda_itens(venda_id);

    CREATE TABLE pagamentos (
        id INTEGER PRIMARY KEY,
        venda_id INTEGER NOT NULL REFERENCES vendas(id),
        caixa_id INTEGER REFERENCES caixas(id),
        data TEXT NOT NULL,
        forma TEXT NOT NULL,
        valor INTEGER NOT NULL,
        troco INTEGER NOT NULL DEFAULT 0,
        taxa INTEGER NOT NULL DEFAULT 0,
        cliente TEXT,
        estornado INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX ix_pagamentos_venda ON pagamentos(venda_id);
    CREATE INDEX ix_pagamentos_caixa ON pagamentos(caixa_id);

    CREATE TABLE despesas (
        id INTEGER PRIMARY KEY,
        data TEXT NOT NULL,
        categoria TEXT NOT NULL,
        descricao TEXT,
        valor INTEGER NOT NULL,
        caixa_id INTEGER REFERENCES caixas(id),
        criado_em TEXT NOT NULL
    );
    CREATE INDEX ix_despesas_data ON despesas(data);

    -- Contas de todo mês (aluguel, luz, salários). Entram no lucro proporcionais aos dias do período.
    CREATE TABLE custos_fixos (
        id INTEGER PRIMARY KEY,
        descricao TEXT NOT NULL,
        valor INTEGER NOT NULL,
        ativo INTEGER NOT NULL DEFAULT 1
    );

    CREATE VIEW v_itens AS
        SELECT i.*,
               CAST(ROUND(i.quantidade * i.preco_unit) AS INTEGER) AS total,
               CAST(ROUND(i.quantidade * i.custo_unit) AS INTEGER) AS custo_total
        FROM venda_itens i;

    CREATE VIEW v_vendas AS
        SELECT x.*,
               x.subtotal - x.desconto + x.acrescimo AS total,
               x.subtotal - x.desconto + x.acrescimo - x.pago AS restante
        FROM (
            SELECT v.*,
                   COALESCE((SELECT SUM(total) FROM v_itens i WHERE i.venda_id = v.id), 0) AS subtotal,
                   COALESCE((SELECT SUM(custo_total) FROM v_itens i WHERE i.venda_id = v.id), 0) AS custo,
                   COALESCE((SELECT SUM(quantidade) FROM venda_itens i WHERE i.venda_id = v.id), 0) AS qtd_itens,
                   COALESCE((SELECT SUM(valor) FROM pagamentos p
                             WHERE p.venda_id = v.id AND p.estornado = 0), 0) AS pago
            FROM vendas v
        ) x;
    """,
]


class Banco:
    def __init__(self, caminho):
        self.caminho = caminho
        self.trava = threading.RLock()
        self.con = sqlite3.connect(caminho, check_same_thread=False, isolation_level=None)
        self.con.row_factory = sqlite3.Row
        self.con.create_function("norm", 1, normalizar, deterministic=True)
        self.con.execute("PRAGMA foreign_keys = ON")
        self.con.execute("PRAGMA journal_mode = WAL")
        self._migrar()

    def _migrar(self):
        versao = self.con.execute("PRAGMA user_version").fetchone()[0]
        for i, sql in enumerate(MIGRACOES[versao:], start=versao + 1):
            with self.transacao():
                for comando in _comandos(sql):
                    self.con.execute(comando)
                self.con.execute(f"PRAGMA user_version = {i}")
        with self.transacao():
            for chave, valor in CONFIG_PADRAO.items():
                self.con.execute("INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)", (chave, valor))

    @contextlib.contextmanager
    def transacao(self):
        with self.trava:
            if self.con.in_transaction:
                yield self
                return
            self.con.execute("BEGIN IMMEDIATE")
            try:
                yield self
            except BaseException:
                self.con.execute("ROLLBACK")
                raise
            else:
                self.con.execute("COMMIT")

    def exec(self, sql, *args):
        with self.trava:
            return self.con.execute(sql, args)

    def um(self, sql, *args):
        with self.trava:
            linha = self.con.execute(sql, args).fetchone()
        return dict(linha) if linha else None

    def todos(self, sql, *args):
        with self.trava:
            return [dict(r) for r in self.con.execute(sql, args).fetchall()]

    def valor(self, sql, *args):
        with self.trava:
            linha = self.con.execute(sql, args).fetchone()
        return linha[0] if linha else None

    def copiar_para(self, destino):
        """Cópia consistente do banco (funciona com o programa aberto)."""
        with self.trava:
            alvo = sqlite3.connect(destino)
            try:
                self.con.backup(alvo)
            finally:
                alvo.close()

    def backup_automatico(self, pasta, intervalo_horas=12, manter=30):
        os.makedirs(pasta, exist_ok=True)
        copias = sorted(f for f in os.listdir(pasta) if f.startswith("gelae-") and f.endswith(".db"))
        if copias:
            ultima = os.path.getmtime(os.path.join(pasta, copias[-1]))
            if (datetime.datetime.now().timestamp() - ultima) < intervalo_horas * 3600:
                return None
        nome = os.path.join(pasta, "gelae-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + ".db")
        self.copiar_para(nome)
        for antiga in copias[: max(0, len(copias) + 1 - manter)]:
            with contextlib.suppress(OSError):
                os.remove(os.path.join(pasta, antiga))
        return nome

    def fechar(self):
        with self.trava:
            self.con.close()


def _comandos(script):
    """Divide um script SQL em comandos (o sqlite3.execute só roda um por vez)."""
    comandos, atual = [], ""
    for linha in script.splitlines(keepends=True):
        if linha.strip().startswith("--"):
            continue
        atual += linha
        if sqlite3.complete_statement(atual):
            if atual.strip():
                comandos.append(atual.strip())
            atual = ""
    if atual.strip():
        comandos.append(atual.strip())
    return comandos


def copiar_arquivo(origem, destino):
    shutil.copy2(origem, destino)
