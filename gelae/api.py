"""Regras do sistema. Cada função recebe o banco, os ids da rota e (q=consulta, d=corpo JSON)."""
import calendar
import datetime

from .banco import agora, hoje, normalizar

FORMAS = {"dinheiro": "Dinheiro", "pix": "Pix", "debito": "Débito", "credito": "Crédito", "fiado": "Fiado"}
TIPOS_VENDA = {"comanda", "balcao"}


class Erro(Exception):
    def __init__(self, msg, status=400):
        super().__init__(msg)
        self.msg = msg
        self.status = status


# ---------------------------------------------------------------- validação

def _centavos(v, campo, obrigatorio=True):
    if v in (None, ""):
        if obrigatorio:
            raise Erro(f"Informe {campo}.")
        return 0
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        raise Erro(f"{campo}: valor inválido.")
    if n < 0:
        raise Erro(f"{campo} não pode ser negativo.")
    return n


def _qtd(v, campo="quantidade", positivo=True):
    try:
        n = float(v)
    except (TypeError, ValueError):
        raise Erro(f"{campo}: valor inválido.")
    if positivo and n <= 0:
        raise Erro(f"{campo} precisa ser maior que zero.")
    if n < 0:
        raise Erro(f"{campo} não pode ser negativa.")
    return round(n, 3)


def _data(v, campo="data"):
    if not v:
        return hoje()
    try:
        return datetime.date.fromisoformat(str(v)[:10]).isoformat()
    except ValueError:
        raise Erro(f"{campo}: data inválida.")


def _texto(v):
    return (str(v).strip() if v is not None else "") or None


def _periodo(q):
    de = _data(q.get("de"), "início")
    ate = _data(q.get("ate"), "fim")
    if ate < de:
        raise Erro("O fim do período é antes do início.")
    return de, ate


# ---------------------------------------------------------------- config

def obter_config(db, q=None, d=None):
    return {r["chave"]: r["valor"] for r in db.todos("SELECT chave, valor FROM config")}


def salvar_config(db, q=None, d=None):
    with db.transacao():
        for chave, valor in (d or {}).items():
            if not db.um("SELECT 1 FROM config WHERE chave = ?", chave):
                continue  # só chaves conhecidas
            if chave.startswith("taxa_"):
                try:
                    valor = str(max(0.0, float(str(valor).replace(",", "."))))
                except ValueError:
                    raise Erro("Taxa inválida.")
            db.exec("UPDATE config SET valor = ? WHERE chave = ?", str(valor if valor is not None else ""), chave)
    return obter_config(db)


def _taxa(db, forma, valor):
    pct = float(db.valor("SELECT valor FROM config WHERE chave = ?", "taxa_" + forma) or 0)
    return int(round(valor * pct / 100))


# ---------------------------------------------------------------- categorias e produtos

def listar_categorias(db, q=None, d=None):
    return db.todos("SELECT * FROM categorias ORDER BY nome")


def _categoria_id(db, d):
    if d.get("categoria_id"):
        return int(d["categoria_id"])
    nome = _texto(d.get("categoria"))
    if not nome:
        return None
    existente = db.um("SELECT id FROM categorias WHERE nome = ?", nome)
    if existente:
        return existente["id"]
    return db.exec("INSERT INTO categorias (nome) VALUES (?)", nome).lastrowid


def listar_produtos(db, q=None, d=None):
    q = q or {}
    sql = """SELECT p.*, c.nome AS categoria,
                    COALESCE(s.vendidos, 0) AS vendidos_30d
             FROM produtos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             LEFT JOIN (SELECT i.produto_id, SUM(i.quantidade * i.fator) AS vendidos
                        FROM venda_itens i JOIN vendas v ON v.id = i.venda_id
                        WHERE v.status != 'cancelada' AND i.adicionado_em >= datetime('now', 'localtime', '-30 days')
                        GROUP BY i.produto_id) s ON s.produto_id = p.id
             WHERE 1 = 1"""
    args = []
    if not q.get("todos"):
        sql += " AND p.ativo = 1"
    if q.get("categoria_id"):
        sql += " AND p.categoria_id = ?"
        args.append(int(q["categoria_id"]))
    for palavra in normalizar(q.get("busca", "")).split():
        sql += " AND (norm(p.nome) LIKE ? OR p.codigo_barras = ?)"
        args += [f"%{palavra}%", palavra]
    if q.get("ordem") == "vendidos":
        sql += " ORDER BY vendidos_30d DESC, p.nome COLLATE NOCASE"
    else:
        sql += " ORDER BY p.nome COLLATE NOCASE"
    return db.todos(sql, *args)


def obter_produto(db, pid, q=None, d=None):
    p = db.um("SELECT p.*, c.nome AS categoria FROM produtos p "
              "LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?", pid)
    if not p:
        raise Erro("Produto não encontrado.", 404)
    return p


def salvar_produto(db, pid=None, q=None, d=None):
    d = d or {}
    nome = _texto(d.get("nome"))
    if not nome:
        raise Erro("Informe o nome do produto.")
    codigo = _texto(d.get("codigo_barras"))
    unidades_caixa = int(_qtd(d.get("unidades_caixa") or 1, "unidades por caixa"))
    with db.transacao():
        if codigo:
            outro = db.um("SELECT id, nome FROM produtos WHERE codigo_barras = ? AND ativo = 1 AND id != ?",
                          codigo, pid or 0)
            if outro:
                raise Erro(f"O código de barras já está no produto “{outro['nome']}”.")
        campos = {
            "nome": nome,
            "categoria_id": _categoria_id(db, d),
            "codigo_barras": codigo,
            "unidade": _texto(d.get("unidade")) or "un",
            "preco": _centavos(d.get("preco"), "o preço de venda"),
            "unidades_caixa": unidades_caixa,
            "preco_caixa": _centavos(d.get("preco_caixa"), "o preço da caixa", obrigatorio=False)
                           if unidades_caixa > 1 else 0,
            "custo": _centavos(d.get("custo"), "o custo", obrigatorio=False),
            "estoque_minimo": _qtd(d.get("estoque_minimo") or 0, "estoque mínimo", positivo=False),
            "controla_estoque": 1 if d.get("controla_estoque", True) else 0,
            "ativo": 1 if d.get("ativo", True) else 0,
        }
        if pid:
            obter_produto(db, pid)
            db.exec(f"UPDATE produtos SET {', '.join(k + ' = ?' for k in campos)} WHERE id = ?",
                    *campos.values(), pid)
        else:
            campos["criado_em"] = agora()
            pid = db.exec(f"INSERT INTO produtos ({', '.join(campos)}) VALUES ({', '.join('?' * len(campos))})",
                          *campos.values()).lastrowid
            inicial = _qtd(d.get("estoque_inicial") or 0, "estoque inicial", positivo=False)
            if inicial:
                _mover(db, pid, inicial, "inicial", campos["custo"], "cadastro")
    return obter_produto(db, pid)


# ---------------------------------------------------------------- estoque

def _mover(db, produto_id, delta, tipo, custo_unit, referencia, observacao=None):
    p = db.um("SELECT controla_estoque FROM produtos WHERE id = ?", produto_id)
    if not p:
        raise Erro("Produto não encontrado.", 404)
    if p["controla_estoque"]:
        db.exec("UPDATE produtos SET estoque = ROUND(estoque + ?, 3) WHERE id = ?", delta, produto_id)
    db.exec("INSERT INTO movimentos (produto_id, data, tipo, quantidade, custo_unit, referencia, observacao) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)", produto_id, agora(), tipo, delta, custo_unit, referencia, observacao)


def entrada_estoque(db, q=None, d=None):
    """Compra: soma ao estoque e recalcula o custo médio de cada produto."""
    d = d or {}
    itens = d.get("itens") or []
    if not itens:
        raise Erro("Inclua pelo menos um produto na entrada.")
    frete = _centavos(d.get("frete"), "o frete", obrigatorio=False)
    linhas = []
    for it in itens:
        pid = int(it.get("produto_id") or 0)
        quantidade = _qtd(it.get("quantidade"))
        custo_unit = _centavos(it.get("custo_unit"), "o custo unitário")
        linhas.append([pid, quantidade, custo_unit])
    base = sum(q_ * c for _, q_, c in linhas)
    with db.transacao():
        cid = db.exec("INSERT INTO compras (data, fornecedor, observacao, total, criado_em) VALUES (?, ?, ?, 0, ?)",
                      _data(d.get("data")), _texto(d.get("fornecedor")), _texto(d.get("observacao")),
                      agora()).lastrowid
        total = 0
        for pid, quantidade, custo_unit in linhas:
            if frete and base:
                # Frete rateado pelo valor de cada linha.
                custo_unit += int(round(frete * (custo_unit * quantidade / base) / quantidade))
            p = obter_produto(db, pid)
            antes = max(p["estoque"], 0)
            novo_custo = custo_unit if antes <= 0 else int(round(
                (antes * p["custo"] + quantidade * custo_unit) / (antes + quantidade)))
            db.exec("UPDATE produtos SET custo = ? WHERE id = ?", novo_custo, pid)
            db.exec("INSERT INTO compra_itens (compra_id, produto_id, quantidade, custo_unit) VALUES (?, ?, ?, ?)",
                    cid, pid, quantidade, custo_unit)
            _mover(db, pid, quantidade, "entrada", custo_unit, f"compra:{cid}")
            total += int(round(quantidade * custo_unit))
        db.exec("UPDATE compras SET total = ? WHERE id = ?", total, cid)
    return {"id": cid, "total": total}


def ajuste_estoque(db, q=None, d=None):
    """tipo 'contagem': informa quanto há na prateleira. tipo 'perda': quebra, vencido, consumo próprio."""
    d = d or {}
    p = obter_produto(db, int(d.get("produto_id") or 0))
    tipo = d.get("tipo")
    with db.transacao():
        if tipo == "contagem":
            contado = _qtd(d.get("quantidade"), positivo=False)
            delta = round(contado - p["estoque"], 3)
            if delta:
                _mover(db, p["id"], delta, "ajuste", p["custo"], "contagem", _texto(d.get("motivo")))
        elif tipo == "perda":
            perdido = _qtd(d.get("quantidade"))
            _mover(db, p["id"], -perdido, "perda", p["custo"], "baixa", _texto(d.get("motivo")))
        else:
            raise Erro("Tipo de ajuste inválido.")
    return obter_produto(db, p["id"])


def listar_movimentos(db, q=None, d=None):
    q = q or {}
    sql = ("SELECT m.*, p.nome AS produto FROM movimentos m JOIN produtos p ON p.id = m.produto_id WHERE 1 = 1")
    args = []
    if q.get("produto_id"):
        sql += " AND m.produto_id = ?"
        args.append(int(q["produto_id"]))
    if q.get("tipo"):
        sql += " AND m.tipo = ?"
        args.append(q["tipo"])
    sql += " ORDER BY m.id DESC LIMIT ?"
    args.append(min(int(q.get("limite") or 200), 2000))
    return db.todos(sql, *args)


def listar_compras(db, q=None, d=None):
    compras = db.todos("SELECT * FROM compras ORDER BY data DESC, id DESC LIMIT 100")
    for c in compras:
        c["itens"] = db.todos("SELECT ci.*, p.nome AS produto FROM compra_itens ci "
                              "JOIN produtos p ON p.id = ci.produto_id WHERE ci.compra_id = ?", c["id"])
    return compras


# ---------------------------------------------------------------- vendas e comandas

def _venda(db, vid):
    v = db.um("SELECT * FROM v_vendas WHERE id = ?", vid)
    if not v:
        raise Erro("Venda não encontrada.", 404)
    return v


def _aberta(db, vid):
    v = _venda(db, vid)
    if v["status"] != "aberta":
        raise Erro("Esta venda já foi encerrada.")
    return v


def obter_venda(db, vid, q=None, d=None):
    v = _venda(db, vid)
    v["itens"] = db.todos("SELECT * FROM v_itens WHERE venda_id = ? ORDER BY id", vid)
    v["pagamentos"] = db.todos("SELECT * FROM pagamentos WHERE venda_id = ? ORDER BY id", vid)
    v["troco"] = sum(p["troco"] for p in v["pagamentos"] if not p["estornado"])
    return v


def listar_vendas(db, q=None, d=None):
    q = q or {}
    status = q.get("status", "aberta")
    if status == "aberta":
        return db.todos("SELECT * FROM v_vendas WHERE status = 'aberta' ORDER BY aberta_em")
    de, ate = _periodo(q)
    vendas = db.todos(
        "SELECT v.*, (SELECT GROUP_CONCAT(DISTINCT forma) FROM pagamentos p "
        "             WHERE p.venda_id = v.id AND p.estornado = 0) AS formas "
        "FROM v_vendas v WHERE status IN ('fechada', 'cancelada') "
        "AND date(COALESCE(fechada_em, aberta_em)) BETWEEN ? AND ? ORDER BY COALESCE(fechada_em, aberta_em) DESC",
        de, ate)
    return vendas


def criar_venda(db, q=None, d=None):
    d = d or {}
    tipo = d.get("tipo") or "comanda"
    if tipo not in TIPOS_VENDA:
        raise Erro("Tipo de venda inválido.")
    nome = _texto(d.get("nome")) or ("Balcão" if tipo == "balcao" else None)
    if not nome:
        raise Erro("Dê um nome para a comanda (mesa ou cliente).")
    with db.transacao():
        if tipo == "comanda" and db.um("SELECT 1 FROM vendas WHERE status = 'aberta' AND tipo = 'comanda' "
                                       "AND nome = ? COLLATE NOCASE", nome):
            raise Erro(f"Já existe uma comanda aberta com o nome “{nome}”.")
        vid = db.exec("INSERT INTO vendas (tipo, nome, aberta_em) VALUES (?, ?, ?)", tipo, nome, agora()).lastrowid
    return obter_venda(db, vid)


def atualizar_venda(db, vid, q=None, d=None):
    d = d or {}
    with db.transacao():
        v = _aberta(db, vid)
        nome = _texto(d.get("nome")) if "nome" in d else v["nome"]
        if not nome:
            raise Erro("O nome não pode ficar vazio.")
        desconto = _centavos(d["desconto"], "o desconto", False) if "desconto" in d else v["desconto"]
        acrescimo = _centavos(d["acrescimo"], "o acréscimo", False) if "acrescimo" in d else v["acrescimo"]
        if v["subtotal"] - desconto + acrescimo < v["pago"]:
            raise Erro("Com esse desconto o total fica menor do que já foi pago. Desfaça um pagamento antes.")
        if desconto > v["subtotal"] + acrescimo:
            raise Erro("O desconto é maior que o total.")
        db.exec("UPDATE vendas SET nome = ?, desconto = ?, acrescimo = ?, observacao = ? WHERE id = ?",
                nome, desconto, acrescimo, _texto(d.get("observacao", v["observacao"])), vid)
    return obter_venda(db, vid)


def adicionar_item(db, vid, q=None, d=None):
    d = d or {}
    quantidade = _qtd(d.get("quantidade") or 1)
    embalagem = d.get("embalagem") or "un"
    with db.transacao():
        _aberta(db, vid)
        p = obter_produto(db, int(d.get("produto_id") or 0))
        if not p["ativo"]:
            raise Erro("Este produto está fora de linha.")
        if embalagem == "cx":
            if p["unidades_caixa"] <= 1:
                raise Erro("Este produto não é vendido em caixa.")
            fator = p["unidades_caixa"]
            preco = p["preco_caixa"] or p["preco"] * fator
            descricao = f"{p['nome']} (cx {fator})"
        else:
            embalagem, fator, preco, descricao = "un", 1, p["preco"], p["nome"]
        custo = p["custo"] * fator
        igual = db.um("SELECT id, quantidade FROM venda_itens WHERE venda_id = ? AND produto_id = ? "
                      "AND embalagem = ? AND preco_unit = ?", vid, p["id"], embalagem, preco)
        if igual:
            db.exec("UPDATE venda_itens SET quantidade = ROUND(quantidade + ?, 3) WHERE id = ?",
                    quantidade, igual["id"])
        else:
            db.exec("INSERT INTO venda_itens (venda_id, produto_id, descricao, embalagem, fator, quantidade, "
                    "preco_unit, custo_unit, adicionado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    vid, p["id"], descricao, embalagem, fator, quantidade, preco, custo, agora())
        _mover(db, p["id"], -quantidade * fator, "venda", p["custo"], f"venda:{vid}")
    return obter_venda(db, vid)


def alterar_item(db, vid, iid, q=None, d=None):
    d = d or {}
    nova = _qtd(d.get("quantidade"), positivo=False)
    if nova == 0:
        return remover_item(db, vid, iid)
    with db.transacao():
        v = _aberta(db, vid)
        item = db.um("SELECT * FROM venda_itens WHERE id = ? AND venda_id = ?", iid, vid)
        if not item:
            raise Erro("Item não encontrado.", 404)
        delta = round(nova - item["quantidade"], 3)
        novo_total = v["total"] + int(round(delta * item["preco_unit"]))
        if novo_total < v["pago"]:
            raise Erro("O total ficaria menor do que já foi pago. Desfaça um pagamento antes.")
        db.exec("UPDATE venda_itens SET quantidade = ? WHERE id = ?", nova, iid)
        p_custo = item["custo_unit"] // max(item["fator"], 1)
        _mover(db, item["produto_id"], -delta * item["fator"], "venda" if delta > 0 else "estorno",
               p_custo, f"venda:{vid}")
    return obter_venda(db, vid)


def remover_item(db, vid, iid, q=None, d=None):
    with db.transacao():
        v = _aberta(db, vid)
        item = db.um("SELECT * FROM v_itens WHERE id = ? AND venda_id = ?", iid, vid)
        if not item:
            raise Erro("Item não encontrado.", 404)
        if v["total"] - item["total"] < v["pago"]:
            raise Erro("O total ficaria menor do que já foi pago. Desfaça um pagamento antes.")
        db.exec("DELETE FROM venda_itens WHERE id = ?", iid)
        _mover(db, item["produto_id"], item["quantidade"] * item["fator"], "estorno",
               item["custo_unit"] // max(item["fator"], 1), f"venda:{vid}")
    return obter_venda(db, vid)


def pagar(db, vid, q=None, d=None):
    """Recebe parte ou todo o valor. Vários pagamentos = conta dividida. Fecha sozinha quando quita."""
    d = d or {}
    forma = d.get("forma")
    if forma not in FORMAS:
        raise Erro("Escolha a forma de pagamento.")
    valor = _centavos(d.get("valor"), "o valor")
    if valor == 0:
        raise Erro("O valor precisa ser maior que zero.")
    troco = _centavos(d.get("troco"), "o troco", obrigatorio=False) if forma == "dinheiro" else 0
    cliente = _texto(d.get("cliente"))
    if forma == "fiado" and not cliente:
        raise Erro("No fiado, informe quem ficou devendo.")
    with db.transacao():
        v = _aberta(db, vid)
        if not db.valor("SELECT COUNT(*) FROM venda_itens WHERE venda_id = ?", vid):
            raise Erro("A comanda está vazia.")
        if valor > v["restante"]:
            raise Erro("O valor é maior do que falta pagar. Em dinheiro, informe o valor recebido para calcular o troco.")
        caixa = caixa_aberto(db)
        if not caixa:
            raise Erro("Abra o caixa antes de receber.", 409)
        db.exec("INSERT INTO pagamentos (venda_id, caixa_id, data, forma, valor, troco, taxa, cliente) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                vid, caixa["id"], agora(), forma, valor, troco, _taxa(db, forma, valor), cliente)
        if valor == v["restante"]:
            _fechar(db, vid, caixa["id"])
    return obter_venda(db, vid)


def desfazer_pagamento(db, vid, pgid, q=None, d=None):
    with db.transacao():
        _aberta(db, vid)
        if not db.exec("DELETE FROM pagamentos WHERE id = ? AND venda_id = ?", pgid, vid).rowcount:
            raise Erro("Pagamento não encontrado.", 404)
    return obter_venda(db, vid)


def _fechar(db, vid, caixa_id):
    db.exec("UPDATE vendas SET status = 'fechada', fechada_em = ?, caixa_id = ? WHERE id = ?",
            agora(), caixa_id, vid)


def fechar_venda(db, vid, q=None, d=None):
    """Fecha uma venda já quitada (ou de total zero, como cortesia)."""
    with db.transacao():
        v = _aberta(db, vid)
        if not db.valor("SELECT COUNT(*) FROM venda_itens WHERE venda_id = ?", vid):
            raise Erro("A comanda está vazia. Para descartar, use Cancelar.")
        if v["restante"] > 0:
            raise Erro("Ainda falta receber " + _brl(v["restante"]) + ".")
        caixa = caixa_aberto(db)
        if not caixa:
            raise Erro("Abra o caixa antes de fechar a venda.", 409)
        _fechar(db, vid, caixa["id"])
    return obter_venda(db, vid)


def cancelar_venda(db, vid, q=None, d=None):
    d = d or {}
    with db.transacao():
        v = _venda(db, vid)
        if v["status"] == "cancelada":
            raise Erro("Esta venda já está cancelada.")
        for item in db.todos("SELECT * FROM venda_itens WHERE venda_id = ?", vid):
            _mover(db, item["produto_id"], item["quantidade"] * item["fator"], "estorno",
                   item["custo_unit"] // max(item["fator"], 1), f"venda:{vid}", "venda cancelada")
        db.exec("UPDATE pagamentos SET estornado = 1 WHERE venda_id = ?", vid)
        motivo = _texto(d.get("motivo"))
        obs = " | ".join(x for x in [v["observacao"], "Cancelada: " + motivo if motivo else "Cancelada"] if x)
        db.exec("UPDATE vendas SET status = 'cancelada', fechada_em = COALESCE(fechada_em, ?), observacao = ? "
                "WHERE id = ?", agora(), obs, vid)
    return obter_venda(db, vid)


# ---------------------------------------------------------------- caixa

def caixa_aberto(db):
    return db.um("SELECT * FROM caixas WHERE fechado_em IS NULL ORDER BY id DESC LIMIT 1")


def resumo_caixa(db, cid):
    c = db.um("SELECT * FROM caixas WHERE id = ?", cid)
    if not c:
        raise Erro("Caixa não encontrado.", 404)
    formas = {f: {"valor": 0, "troco": 0, "quantidade": 0} for f in FORMAS}
    for r in db.todos("SELECT forma, SUM(valor) AS valor, SUM(troco) AS troco, COUNT(*) AS quantidade "
                      "FROM pagamentos WHERE caixa_id = ? AND estornado = 0 GROUP BY forma", cid):
        formas[r["forma"]] = {"valor": r["valor"], "troco": r["troco"], "quantidade": r["quantidade"]}
    mov = {r["tipo"]: r["valor"] for r in db.todos(
        "SELECT tipo, SUM(valor) AS valor FROM caixa_movimentos WHERE caixa_id = ? GROUP BY tipo", cid)}
    despesas = db.valor("SELECT COALESCE(SUM(valor), 0) FROM despesas WHERE caixa_id = ?", cid)
    esperado = (c["valor_abertura"] + formas["dinheiro"]["valor"] + mov.get("reforco", 0)
                - mov.get("sangria", 0) - despesas)
    c.update({
        "formas": formas,
        "reforcos": mov.get("reforco", 0),
        "sangrias": mov.get("sangria", 0),
        "despesas": despesas,
        "esperado_dinheiro": esperado,
        "total_recebido": sum(f["valor"] for f in formas.values()),
        "vendas": db.valor("SELECT COUNT(*) FROM vendas WHERE caixa_id = ? AND status = 'fechada'", cid),
        "diferenca": None if c["valor_contado"] is None else c["valor_contado"] - esperado,
        "movimentos": db.todos("SELECT * FROM caixa_movimentos WHERE caixa_id = ? ORDER BY id", cid),
    })
    return c


def obter_caixa(db, q=None, d=None):
    c = caixa_aberto(db)
    return {"caixa": resumo_caixa(db, c["id"]) if c else None,
            "comandas_abertas": db.valor("SELECT COUNT(*) FROM vendas WHERE status = 'aberta'")}


def abrir_caixa(db, q=None, d=None):
    d = d or {}
    with db.transacao():
        if caixa_aberto(db):
            raise Erro("Já existe um caixa aberto.")
        db.exec("INSERT INTO caixas (aberto_em, valor_abertura) VALUES (?, ?)",
                agora(), _centavos(d.get("valor_abertura"), "o troco inicial", obrigatorio=False))
    return obter_caixa(db)


def movimento_caixa(db, q=None, d=None):
    d = d or {}
    tipo = d.get("tipo")
    if tipo not in ("sangria", "reforco"):
        raise Erro("Tipo inválido.")
    valor = _centavos(d.get("valor"), "o valor")
    if not valor:
        raise Erro("O valor precisa ser maior que zero.")
    with db.transacao():
        c = caixa_aberto(db)
        if not c:
            raise Erro("Não há caixa aberto.", 409)
        db.exec("INSERT INTO caixa_movimentos (caixa_id, data, tipo, valor, motivo) VALUES (?, ?, ?, ?, ?)",
                c["id"], agora(), tipo, valor, _texto(d.get("motivo")))
    return obter_caixa(db)


def fechar_caixa(db, q=None, d=None):
    d = d or {}
    contado = _centavos(d.get("valor_contado"), "o dinheiro contado na gaveta")
    with db.transacao():
        c = caixa_aberto(db)
        if not c:
            raise Erro("Não há caixa aberto.", 409)
        db.exec("UPDATE caixas SET fechado_em = ?, valor_contado = ?, observacao = ? WHERE id = ?",
                agora(), contado, _texto(d.get("observacao")), c["id"])
    return resumo_caixa(db, c["id"])


def listar_caixas(db, q=None, d=None):
    return [resumo_caixa(db, r["id"]) for r in db.todos("SELECT id FROM caixas ORDER BY id DESC LIMIT 60")]


def obter_resumo_caixa(db, cid, q=None, d=None):
    return resumo_caixa(db, cid)


# ---------------------------------------------------------------- despesas e custos fixos

CATEGORIAS_DESPESA = ["Aluguel", "Energia", "Água", "Internet e telefone", "Funcionários", "Pró-labore",
                      "Gelo", "Frete", "Embalagens", "Manutenção", "Impostos", "Contador", "Outros"]


def listar_despesas(db, q=None, d=None):
    de, ate = _periodo(q or {})
    return db.todos("SELECT * FROM despesas WHERE data BETWEEN ? AND ? ORDER BY data DESC, id DESC", de, ate)


def criar_despesa(db, q=None, d=None):
    d = d or {}
    categoria = _texto(d.get("categoria"))
    if not categoria:
        raise Erro("Escolha a categoria da despesa.")
    valor = _centavos(d.get("valor"), "o valor")
    if not valor:
        raise Erro("O valor precisa ser maior que zero.")
    with db.transacao():
        caixa_id = None
        if d.get("saiu_do_caixa"):
            c = caixa_aberto(db)
            if not c:
                raise Erro("Não há caixa aberto para tirar o dinheiro.", 409)
            caixa_id = c["id"]
        did = db.exec("INSERT INTO despesas (data, categoria, descricao, valor, caixa_id, criado_em) "
                      "VALUES (?, ?, ?, ?, ?, ?)", _data(d.get("data")), categoria,
                      _texto(d.get("descricao")), valor, caixa_id, agora()).lastrowid
    return db.um("SELECT * FROM despesas WHERE id = ?", did)


def remover_despesa(db, did, q=None, d=None):
    with db.transacao():
        desp = db.um("SELECT * FROM despesas WHERE id = ?", did)
        if not desp:
            raise Erro("Despesa não encontrada.", 404)
        if desp["caixa_id"] and db.valor("SELECT fechado_em FROM caixas WHERE id = ?", desp["caixa_id"]):
            raise Erro("Esta despesa saiu de um caixa já fechado e não pode ser apagada.")
        db.exec("DELETE FROM despesas WHERE id = ?", did)
    return {"ok": True}


def listar_custos_fixos(db, q=None, d=None):
    return db.todos("SELECT * FROM custos_fixos WHERE ativo = 1 ORDER BY descricao")


def salvar_custo_fixo(db, cfid=None, q=None, d=None):
    d = d or {}
    descricao = _texto(d.get("descricao"))
    if not descricao:
        raise Erro("Informe a descrição do custo fixo.")
    valor = _centavos(d.get("valor"), "o valor mensal")
    with db.transacao():
        if cfid:
            db.exec("UPDATE custos_fixos SET descricao = ?, valor = ? WHERE id = ?", descricao, valor, cfid)
        else:
            cfid = db.exec("INSERT INTO custos_fixos (descricao, valor) VALUES (?, ?)", descricao, valor).lastrowid
    return db.um("SELECT * FROM custos_fixos WHERE id = ?", cfid)


def remover_custo_fixo(db, cfid, q=None, d=None):
    db.exec("UPDATE custos_fixos SET ativo = 0 WHERE id = ?", cfid)
    return {"ok": True}


# ---------------------------------------------------------------- lucro

def relatorio(db, q=None, d=None):
    de, ate = _periodo(q or {})
    filtro = "status = 'fechada' AND date(fechada_em) BETWEEN ? AND ?"
    vendas = db.um(f"SELECT COUNT(*) AS quantidade, COALESCE(SUM(subtotal), 0) AS bruto, "
                   f"COALESCE(SUM(desconto), 0) AS descontos, COALESCE(SUM(acrescimo), 0) AS acrescimos, "
                   f"COALESCE(SUM(total), 0) AS receita, COALESCE(SUM(custo), 0) AS cmv "
                   f"FROM v_vendas WHERE {filtro}", de, ate)
    taxas = db.valor(f"SELECT COALESCE(SUM(p.taxa), 0) FROM pagamentos p JOIN vendas v ON v.id = p.venda_id "
                     f"WHERE p.estornado = 0 AND v.{filtro.replace('fechada_em', 'v.fechada_em')}", de, ate)
    despesas = db.valor("SELECT COALESCE(SUM(valor), 0) FROM despesas WHERE data BETWEEN ? AND ?", de, ate)
    perdas = db.valor("SELECT COALESCE(SUM(-quantidade * custo_unit), 0) FROM movimentos "
                      "WHERE tipo IN ('perda', 'ajuste') AND date(data) BETWEEN ? AND ?", de, ate)
    perdas = int(round(perdas))
    fixos_mes = db.valor("SELECT COALESCE(SUM(valor), 0) FROM custos_fixos WHERE ativo = 1")

    dias = {}
    d0, d1 = datetime.date.fromisoformat(de), datetime.date.fromisoformat(ate)
    dia = d0
    while dia <= d1:
        fixo_dia = fixos_mes / calendar.monthrange(dia.year, dia.month)[1]
        dias[dia.isoformat()] = {"data": dia.isoformat(), "vendas": 0, "receita": 0, "cmv": 0, "taxas": 0,
                                 "despesas": 0, "perdas": 0, "fixos": fixo_dia}
        dia += datetime.timedelta(days=1)
    for r in db.todos(f"SELECT date(fechada_em) AS dia, COUNT(*) AS n, SUM(total) AS receita, SUM(custo) AS cmv "
                      f"FROM v_vendas WHERE {filtro} GROUP BY dia", de, ate):
        dias[r["dia"]].update(vendas=r["n"], receita=r["receita"], cmv=r["cmv"])
    for r in db.todos("SELECT date(v.fechada_em) AS dia, SUM(p.taxa) AS taxas FROM pagamentos p "
                      "JOIN vendas v ON v.id = p.venda_id WHERE p.estornado = 0 AND v.status = 'fechada' "
                      "AND date(v.fechada_em) BETWEEN ? AND ? GROUP BY dia", de, ate):
        dias[r["dia"]]["taxas"] = r["taxas"]
    for r in db.todos("SELECT data AS dia, SUM(valor) AS v FROM despesas WHERE data BETWEEN ? AND ? GROUP BY data",
                      de, ate):
        dias[r["dia"]]["despesas"] = r["v"]
    for r in db.todos("SELECT date(data) AS dia, SUM(-quantidade * custo_unit) AS v FROM movimentos "
                      "WHERE tipo IN ('perda', 'ajuste') AND date(data) BETWEEN ? AND ? GROUP BY dia", de, ate):
        dias[r["dia"]]["perdas"] = int(round(r["v"]))
    fixos = 0
    for x in dias.values():
        x["fixos"] = int(round(x["fixos"]))
        fixos += x["fixos"]
        x["lucro"] = x["receita"] - x["cmv"] - x["taxas"] - x["despesas"] - x["perdas"] - x["fixos"]

    produtos = db.todos(
        f"SELECT i.produto_id, p.nome, SUM(i.quantidade * i.fator) AS unidades, SUM(i.total) AS receita, "
        f"SUM(i.custo_total) AS custo, SUM(i.total) - SUM(i.custo_total) AS lucro "
        f"FROM v_itens i JOIN vendas v ON v.id = i.venda_id JOIN produtos p ON p.id = i.produto_id "
        f"WHERE v.{filtro.replace('fechada_em', 'v.fechada_em')} GROUP BY i.produto_id ORDER BY lucro DESC",
        de, ate)
    formas = db.todos(
        f"SELECT p.forma, COUNT(*) AS quantidade, SUM(p.valor) AS valor, SUM(p.taxa) AS taxa "
        f"FROM pagamentos p JOIN vendas v ON v.id = p.venda_id "
        f"WHERE p.estornado = 0 AND v.{filtro.replace('fechada_em', 'v.fechada_em')} GROUP BY p.forma "
        f"ORDER BY valor DESC", de, ate)
    categorias = db.todos("SELECT categoria, SUM(valor) AS valor FROM despesas WHERE data BETWEEN ? AND ? "
                          "GROUP BY categoria ORDER BY valor DESC", de, ate)
    fiado = db.todos(f"SELECT p.cliente, SUM(p.valor) AS valor, MAX(p.data) AS ultima FROM pagamentos p "
                     f"JOIN vendas v ON v.id = p.venda_id WHERE p.forma = 'fiado' AND p.estornado = 0 "
                     f"AND v.{filtro.replace('fechada_em', 'v.fechada_em')} GROUP BY p.cliente "
                     f"ORDER BY valor DESC", de, ate)

    lucro_bruto = vendas["receita"] - vendas["cmv"] - taxas
    lucro = lucro_bruto - despesas - fixos - perdas
    return {
        "de": de, "ate": ate,
        "vendas": vendas["quantidade"],
        "bruto": vendas["bruto"], "descontos": vendas["descontos"], "acrescimos": vendas["acrescimos"],
        "receita": vendas["receita"], "cmv": vendas["cmv"], "taxas": taxas,
        "lucro_bruto": lucro_bruto,
        "despesas": despesas, "custos_fixos": fixos, "custos_fixos_mes": fixos_mes, "perdas": perdas,
        "lucro": lucro,
        "ticket_medio": vendas["receita"] // vendas["quantidade"] if vendas["quantidade"] else 0,
        "por_dia": list(dias.values()),
        "por_produto": produtos,
        "por_forma": formas,
        "despesas_por_categoria": categorias,
        "fiado": fiado,
    }


def painel(db, q=None, d=None):
    """Números da tela inicial."""
    hj = hoje()
    vendido = db.um("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total FROM v_vendas "
                    "WHERE status = 'fechada' AND date(fechada_em) = ?", hj)
    abaixo = db.todos("SELECT id, nome, estoque, estoque_minimo FROM produtos WHERE ativo = 1 AND controla_estoque = 1 "
                      "AND estoque <= estoque_minimo ORDER BY estoque - estoque_minimo, nome LIMIT 50")
    return {"hoje": hj, "vendas_hoje": vendido["n"], "vendido_hoje": vendido["total"], "abaixo_minimo": abaixo,
            "categorias_despesa": CATEGORIAS_DESPESA, "formas": FORMAS}


def _brl(c):
    s = f"{c / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return "R$ " + s
