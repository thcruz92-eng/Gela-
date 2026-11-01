"""Cupons em HTML para impressora térmica (58 ou 80 mm). Não é documento fiscal."""
import html

from . import api


def _brl(c):
    return api._brl(c)


def _qtd(q):
    return f"{q:g}".replace(".", ",")


def _pagina(config, corpo, titulo):
    largura = "48mm" if config.get("largura_cupom") == "58" else "72mm"
    loja = html.escape(config.get("nome_loja") or "")
    linhas_loja = "".join(f"<div>{html.escape(config[k])}</div>" for k in ("endereco", "telefone", "documento")
                          if config.get(k))
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>{html.escape(titulo)}</title>
<style>
@page {{ size: {largura} auto; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ width: {largura}; margin: 0 auto; padding: 2mm 1mm 6mm; font: 12px/1.35 "Consolas", "Courier New", monospace; color: #000; }}
.c {{ text-align: center; }} .b {{ font-weight: 700; }} .g {{ font-size: 15px; }}
hr {{ border: 0; border-top: 1px dashed #000; margin: 4px 0; }}
.l {{ display: flex; justify-content: space-between; gap: 6px; }}
.l span:first-child {{ overflow-wrap: anywhere; }}
.item {{ margin: 2px 0; }}
</style></head><body onload="setTimeout(function(){{window.print()}},150)">
<div class="c b g">{loja}</div><div class="c">{linhas_loja}</div><hr>{corpo}</body></html>"""


def cupom_venda(db, vid):
    config = api.obter_config(db)
    v = api.obter_venda(db, vid)
    aberta = v["status"] == "aberta"
    titulo = "CONFERÊNCIA DE CONTA" if aberta else ("VENDA CANCELADA" if v["status"] == "cancelada"
                                                     else "CUPOM NÃO FISCAL")
    p = [f'<div class="c b">{titulo}</div>',
         f'<div class="l"><span>{"Comanda" if v["tipo"] == "comanda" else "Venda"}: {html.escape(v["nome"])}</span>'
         f'<span>Nº {v["id"]}</span></div>',
         f'<div>{_data(v["fechada_em"] or v["aberta_em"])}</div><hr>']
    for i in v["itens"]:
        p.append(f'<div class="item"><div>{html.escape(i["descricao"])}</div>'
                 f'<div class="l"><span>{_qtd(i["quantidade"])} x {_brl(i["preco_unit"])}</span>'
                 f'<span>{_brl(i["total"])}</span></div></div>')
    p.append("<hr>")
    p.append(f'<div class="l"><span>Subtotal</span><span>{_brl(v["subtotal"])}</span></div>')
    if v["desconto"]:
        p.append(f'<div class="l"><span>Desconto</span><span>-{_brl(v["desconto"])}</span></div>')
    if v["acrescimo"]:
        p.append(f'<div class="l"><span>Acréscimo</span><span>+{_brl(v["acrescimo"])}</span></div>')
    p.append(f'<div class="l b g"><span>TOTAL</span><span>{_brl(v["total"])}</span></div>')
    pagos = [x for x in v["pagamentos"] if not x["estornado"]]
    if pagos:
        p.append("<hr>")
        for x in pagos:
            nome = api.FORMAS.get(x["forma"], x["forma"])
            if x["cliente"]:
                nome += " - " + html.escape(x["cliente"])
            p.append(f'<div class="l"><span>{nome}</span><span>{_brl(x["valor"])}</span></div>')
        if v["troco"]:
            p.append(f'<div class="l"><span>Troco</span><span>{_brl(v["troco"])}</span></div>')
    if aberta and v["restante"] > 0 and v["pago"]:
        p.append(f'<div class="l b"><span>Falta pagar</span><span>{_brl(v["restante"])}</span></div>')
    if config.get("mensagem_cupom"):
        p.append(f'<hr><div class="c">{html.escape(config["mensagem_cupom"])}</div>')
    return _pagina(config, "".join(p), f"Venda {vid}")


def cupom_caixa(db, cid):
    config = api.obter_config(db)
    c = api.resumo_caixa(db, cid)
    p = ['<div class="c b">FECHAMENTO DE CAIXA</div>',
         f'<div>Aberto: {_data(c["aberto_em"])}</div>',
         f'<div>Fechado: {_data(c["fechado_em"]) if c["fechado_em"] else "em aberto"}</div><hr>',
         f'<div class="l"><span>Vendas</span><span>{c["vendas"]}</span></div>']
    for forma, nome in api.FORMAS.items():
        if c["formas"][forma]["valor"]:
            p.append(f'<div class="l"><span>{nome}</span><span>{_brl(c["formas"][forma]["valor"])}</span></div>')
    p.append(f'<div class="l b"><span>Total recebido</span><span>{_brl(c["total_recebido"])}</span></div><hr>')
    p.append('<div class="b">Dinheiro na gaveta</div>')
    for rotulo, valor, sinal in (("Troco inicial", c["valor_abertura"], ""),
                                 ("Recebido em dinheiro", c["formas"]["dinheiro"]["valor"], "+"),
                                 ("Reforços", c["reforcos"], "+"), ("Sangrias", c["sangrias"], "-"),
                                 ("Despesas pagas", c["despesas"], "-")):
        if valor or rotulo == "Troco inicial":
            p.append(f'<div class="l"><span>{rotulo}</span><span>{sinal}{_brl(valor)}</span></div>')
    p.append(f'<div class="l b"><span>Esperado</span><span>{_brl(c["esperado_dinheiro"])}</span></div>')
    if c["valor_contado"] is not None:
        p.append(f'<div class="l"><span>Contado</span><span>{_brl(c["valor_contado"])}</span></div>')
        dif = c["diferenca"]
        p.append(f'<div class="l b"><span>{"Sobra" if dif > 0 else "Falta" if dif < 0 else "Diferença"}</span>'
                 f'<span>{_brl(abs(dif))}</span></div>')
    if c["observacao"]:
        p.append(f'<hr><div>{html.escape(c["observacao"])}</div>')
    return _pagina(config, "".join(p), f"Caixa {cid}")


def _data(s):
    if not s:
        return ""
    return f"{s[8:10]}/{s[5:7]}/{s[0:4]} {s[11:16]}"
