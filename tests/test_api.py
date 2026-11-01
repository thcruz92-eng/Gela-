import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from gelae import api  # noqa: E402
from gelae.banco import Banco, hoje  # noqa: E402
from gelae.servidor import criar_servidor  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.mkdtemp()
        self.db = Banco(os.path.join(self.pasta, "t.db"))
        self.skol = api.salvar_produto(self.db, d={
            "nome": "Skol Lata 350ml", "categoria": "Cervejas", "preco": 500, "custo": 300,
            "unidades_caixa": 12, "preco_caixa": 5000, "estoque_inicial": 48, "codigo_barras": "789"})
        self.agua = api.salvar_produto(self.db, d={"nome": "Água Mineral", "preco": 300, "custo": 100,
                                                   "estoque_inicial": 10})

    def tearDown(self):
        self.db.fechar()


class TestProdutos(Base):
    def test_busca_sem_acento(self):
        nomes = [p["nome"] for p in api.listar_produtos(self.db, q={"busca": "agua"})]
        self.assertEqual(nomes, ["Água Mineral"])

    def test_codigo_de_barras_duplicado(self):
        with self.assertRaises(api.Erro):
            api.salvar_produto(self.db, d={"nome": "Outra", "preco": 1, "codigo_barras": "789"})

    def test_entrada_recalcula_custo_medio_com_frete(self):
        # 48 un a R$3,00 + 24 un a R$3,60 + frete R$ 7,20 (todo nesta linha) = 3,90 por un.
        api.entrada_estoque(self.db, d={"fornecedor": "Ambev", "frete": 720,
                                        "itens": [{"produto_id": self.skol["id"], "quantidade": 24,
                                                   "custo_unit": 360}]})
        p = api.obter_produto(self.db, self.skol["id"])
        self.assertEqual(p["estoque"], 72)
        self.assertEqual(p["custo"], 330)  # (48*300 + 24*390) / 72

    def test_contagem_e_perda(self):
        api.ajuste_estoque(self.db, d={"produto_id": self.agua["id"], "tipo": "contagem", "quantidade": 8})
        api.ajuste_estoque(self.db, d={"produto_id": self.agua["id"], "tipo": "perda", "quantidade": 1,
                                       "motivo": "quebrou"})
        self.assertEqual(api.obter_produto(self.db, self.agua["id"])["estoque"], 7)


class TestComanda(Base):
    def test_fluxo_completo_de_comanda(self):
        api.abrir_caixa(self.db, d={"valor_abertura": 5000})
        v = api.criar_venda(self.db, d={"tipo": "comanda", "nome": "Mesa 3"})
        with self.assertRaises(api.Erro):
            api.criar_venda(self.db, d={"tipo": "comanda", "nome": "mesa 3"})
        # Pessoa vai pedindo ao longo da noite.
        api.adicionar_item(self.db, v["id"], d={"produto_id": self.skol["id"], "quantidade": 2})
        api.adicionar_item(self.db, v["id"], d={"produto_id": self.agua["id"]})
        v = api.adicionar_item(self.db, v["id"], d={"produto_id": self.skol["id"], "quantidade": 1})
        self.assertEqual(len(v["itens"]), 2)  # mesma linha somou
        self.assertEqual(v["total"], 1800)
        self.assertEqual(api.obter_produto(self.db, self.skol["id"])["estoque"], 45)
        # Um amigo vai embora e paga a parte dele no Pix.
        v = api.pagar(self.db, v["id"], d={"forma": "pix", "valor": 800})
        self.assertEqual(v["status"], "aberta")
        self.assertEqual(v["restante"], 1000)
        # Ainda pede mais uma.
        v = api.adicionar_item(self.db, v["id"], d={"produto_id": self.skol["id"]})
        # Desconto não pode deixar o total abaixo do que já foi pago (23,00 - 16,00 < 8,00).
        with self.assertRaises(api.Erro):
            api.atualizar_venda(self.db, v["id"], d={"desconto": 1600})
        # Fecha no dinheiro com troco.
        v = api.pagar(self.db, v["id"], d={"forma": "dinheiro", "valor": 1500, "troco": 500})
        self.assertEqual(v["status"], "fechada")
        cx = api.obter_caixa(self.db)["caixa"]
        self.assertEqual(cx["esperado_dinheiro"], 6500)
        self.assertEqual(cx["formas"]["pix"]["valor"], 800)

    def test_venda_de_caixa_fechada_baixa_unidades(self):
        api.abrir_caixa(self.db, d={})
        v = api.criar_venda(self.db, d={"tipo": "balcao"})
        v = api.adicionar_item(self.db, v["id"], d={"produto_id": self.skol["id"], "embalagem": "cx"})
        self.assertEqual(v["total"], 5000)
        self.assertEqual(v["itens"][0]["custo_total"], 3600)
        self.assertEqual(api.obter_produto(self.db, self.skol["id"])["estoque"], 36)

    def test_remover_item_e_cancelar_devolvem_estoque(self):
        api.abrir_caixa(self.db, d={})
        v = api.criar_venda(self.db, d={"nome": "João"})
        v = api.adicionar_item(self.db, v["id"], d={"produto_id": self.agua["id"], "quantidade": 3})
        v = api.alterar_item(self.db, v["id"], v["itens"][0]["id"], d={"quantidade": 1})
        self.assertEqual(api.obter_produto(self.db, self.agua["id"])["estoque"], 9)
        v = api.pagar(self.db, v["id"], d={"forma": "debito", "valor": 300})
        self.assertEqual(v["status"], "fechada")
        api.cancelar_venda(self.db, v["id"], d={"motivo": "lançada errada"})
        self.assertEqual(api.obter_produto(self.db, self.agua["id"])["estoque"], 10)
        self.assertEqual(api.obter_caixa(self.db)["caixa"]["total_recebido"], 0)

    def test_receber_sem_caixa_aberto(self):
        v = api.criar_venda(self.db, d={"nome": "X"})
        api.adicionar_item(self.db, v["id"], d={"produto_id": self.agua["id"]})
        with self.assertRaises(api.Erro) as e:
            api.pagar(self.db, v["id"], d={"forma": "pix", "valor": 300})
        self.assertEqual(e.exception.status, 409)

    def test_fiado_exige_nome(self):
        api.abrir_caixa(self.db, d={})
        v = api.criar_venda(self.db, d={"nome": "Y"})
        api.adicionar_item(self.db, v["id"], d={"produto_id": self.agua["id"]})
        with self.assertRaises(api.Erro):
            api.pagar(self.db, v["id"], d={"forma": "fiado", "valor": 300})


class TestLucro(Base):
    def test_relatorio(self):
        api.salvar_config(self.db, d={"taxa_credito": "3"})
        api.salvar_custo_fixo(self.db, d={"descricao": "Aluguel", "valor": 300000})
        api.abrir_caixa(self.db, d={})
        v = api.criar_venda(self.db, d={"tipo": "balcao"})
        api.adicionar_item(self.db, v["id"], d={"produto_id": self.skol["id"], "quantidade": 10})  # 50,00 / custo 30,00
        api.pagar(self.db, v["id"], d={"forma": "credito", "valor": 5000})  # taxa 1,50
        api.criar_despesa(self.db, d={"categoria": "Gelo", "valor": 1000})
        api.ajuste_estoque(self.db, d={"produto_id": self.agua["id"], "tipo": "perda", "quantidade": 2})  # 2,00
        r = api.relatorio(self.db, q={"de": hoje(), "ate": hoje()})
        self.assertEqual(r["receita"], 5000)
        self.assertEqual(r["cmv"], 3000)
        self.assertEqual(r["taxas"], 150)
        self.assertEqual(r["lucro_bruto"], 1850)
        self.assertEqual(r["perdas"], 200)
        self.assertEqual(r["despesas"], 1000)
        self.assertGreater(r["custos_fixos"], 9000)  # 3.000 / dias do mês
        self.assertEqual(r["lucro"], 1850 - 1000 - 200 - r["custos_fixos"])
        self.assertEqual(r["por_produto"][0]["lucro"], 2000)
        self.assertEqual(r["por_dia"][0]["lucro"], r["lucro"])


class TestHttp(Base):
    def setUp(self):
        super().setUp()
        self.srv = criar_servidor(self.db, 0)
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        super().tearDown()

    def chamar(self, metodo, caminho, corpo=None, cabecalho=True):
        dados = json.dumps(corpo).encode() if corpo is not None else None
        req = urllib.request.Request(self.url + caminho, data=dados, method=metodo)
        req.add_header("Content-Type", "application/json")
        if cabecalho:
            req.add_header("X-Gelae", "1")
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def test_pagina_api_e_cupom(self):
        status, corpo = self.chamar("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Gela", corpo)
        status, corpo = self.chamar("POST", "/api/vendas", {"nome": "Mesa 1"})
        self.assertEqual(status, 200)
        vid = json.loads(corpo)["id"]
        status, corpo = self.chamar("GET", f"/imprimir/venda/{vid}")
        self.assertIn("CONFERÊNCIA", corpo.decode())
        status, _ = self.chamar("GET", "/backup")
        self.assertEqual(status, 200)

    def test_bloqueia_sem_cabecalho_e_erro_legivel(self):
        status, _ = self.chamar("POST", "/api/vendas", {"nome": "Z"}, cabecalho=False)
        self.assertEqual(status, 403)
        status, corpo = self.chamar("POST", "/api/vendas", {"tipo": "comanda"})
        self.assertEqual(status, 400)
        self.assertIn("nome", json.loads(corpo)["erro"])

    def test_estatico_nao_sai_da_pasta(self):
        status, _ = self.chamar("GET", "/../gelae/banco.py")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
