"""Servidor HTTP local: entrega a tela (pasta web/) e a API JSON em /api/."""
import json
import mimetypes
import os
import re
import sys
import tempfile
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from . import api, impressao
from .banco import agora

R = re.compile
ROTAS = [
    ("GET", R(r"/api/painel"), api.painel),
    ("GET", R(r"/api/config"), api.obter_config),
    ("PUT", R(r"/api/config"), api.salvar_config),

    ("GET", R(r"/api/categorias"), api.listar_categorias),
    ("GET", R(r"/api/produtos"), api.listar_produtos),
    ("POST", R(r"/api/produtos"), api.salvar_produto),
    ("GET", R(r"/api/produtos/(\d+)"), api.obter_produto),
    ("PUT", R(r"/api/produtos/(\d+)"), api.salvar_produto),

    ("POST", R(r"/api/estoque/entrada"), api.entrada_estoque),
    ("POST", R(r"/api/estoque/ajuste"), api.ajuste_estoque),
    ("GET", R(r"/api/estoque/movimentos"), api.listar_movimentos),
    ("GET", R(r"/api/compras"), api.listar_compras),

    ("GET", R(r"/api/vendas"), api.listar_vendas),
    ("POST", R(r"/api/vendas"), api.criar_venda),
    ("GET", R(r"/api/vendas/(\d+)"), api.obter_venda),
    ("PUT", R(r"/api/vendas/(\d+)"), api.atualizar_venda),
    ("POST", R(r"/api/vendas/(\d+)/itens"), api.adicionar_item),
    ("PUT", R(r"/api/vendas/(\d+)/itens/(\d+)"), api.alterar_item),
    ("DELETE", R(r"/api/vendas/(\d+)/itens/(\d+)"), api.remover_item),
    ("POST", R(r"/api/vendas/(\d+)/pagamentos"), api.pagar),
    ("DELETE", R(r"/api/vendas/(\d+)/pagamentos/(\d+)"), api.desfazer_pagamento),
    ("POST", R(r"/api/vendas/(\d+)/fechar"), api.fechar_venda),
    ("POST", R(r"/api/vendas/(\d+)/cancelar"), api.cancelar_venda),

    ("GET", R(r"/api/caixa"), api.obter_caixa),
    ("POST", R(r"/api/caixa/abrir"), api.abrir_caixa),
    ("POST", R(r"/api/caixa/movimento"), api.movimento_caixa),
    ("POST", R(r"/api/caixa/fechar"), api.fechar_caixa),
    ("GET", R(r"/api/caixas"), api.listar_caixas),
    ("GET", R(r"/api/caixas/(\d+)"), api.obter_resumo_caixa),

    ("GET", R(r"/api/despesas"), api.listar_despesas),
    ("POST", R(r"/api/despesas"), api.criar_despesa),
    ("DELETE", R(r"/api/despesas/(\d+)"), api.remover_despesa),
    ("GET", R(r"/api/custos-fixos"), api.listar_custos_fixos),
    ("POST", R(r"/api/custos-fixos"), api.salvar_custo_fixo),
    ("PUT", R(r"/api/custos-fixos/(\d+)"), api.salvar_custo_fixo),
    ("DELETE", R(r"/api/custos-fixos/(\d+)"), api.remover_custo_fixo),

    ("GET", R(r"/api/relatorio"), api.relatorio),
]


def pasta_web():
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "web")


class Tratador(BaseHTTPRequestHandler):
    server_version = "Gelae"
    protocol_version = "HTTP/1.1"

    def log_message(self, formato, *args):
        pass

    def do_GET(self):
        self._tratar("GET")

    def do_POST(self):
        self._tratar("POST")

    def do_PUT(self):
        self._tratar("PUT")

    def do_DELETE(self):
        self._tratar("DELETE")

    # ------------------------------------------------------------
    def _tratar(self, metodo):
        url = urlsplit(self.path)
        caminho = url.path
        if not self._host_valido():
            return self._enviar(403, b"Acesso negado", "text/plain; charset=utf-8")
        try:
            if caminho.startswith("/api/"):
                return self._api(metodo, caminho, {k: v[0] for k, v in parse_qs(url.query).items()})
            if metodo != "GET":
                return self._json({"erro": "Método não permitido"}, 405)
            m = re.fullmatch(r"/imprimir/(venda|caixa)/(\d+)", caminho)
            if m:
                gerar = impressao.cupom_venda if m.group(1) == "venda" else impressao.cupom_caixa
                return self._enviar(200, gerar(self.server.db, int(m.group(2))).encode("utf-8"),
                                    "text/html; charset=utf-8")
            if caminho == "/backup":
                return self._backup()
            return self._estatico(caminho)
        except api.Erro as e:
            return self._json({"erro": e.msg}, e.status)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            return self._json({"erro": f"Erro interno: {e}"}, 500)

    def _host_valido(self):
        # Só aceita o próprio computador (evita que um site aberto no navegador mexa nos dados).
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def _api(self, metodo, caminho, consulta):
        if metodo != "GET" and self.headers.get("X-Gelae") != "1":
            return self._json({"erro": "Requisição recusada"}, 403)
        corpo = {}
        if metodo in ("POST", "PUT"):
            tamanho = int(self.headers.get("Content-Length") or 0)
            if tamanho:
                try:
                    corpo = json.loads(self.rfile.read(tamanho).decode("utf-8"))
                except ValueError:
                    return self._json({"erro": "Dados inválidos"}, 400)
        if caminho == "/api/sair" and metodo == "POST":
            self._json({"ok": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return None
        for m, rx, funcao in ROTAS:
            if m != metodo:
                continue
            achou = rx.fullmatch(caminho)
            if achou:
                ids = [int(g) for g in achou.groups()]
                return self._json(funcao(self.server.db, *ids, q=consulta, d=corpo))
        return self._json({"erro": "Rota não encontrada"}, 404)

    def _estatico(self, caminho):
        raiz = os.path.realpath(pasta_web())
        nome = "index.html" if caminho in ("/", "") else caminho.lstrip("/")
        arquivo = os.path.realpath(os.path.join(raiz, nome))
        if not arquivo.startswith(raiz + os.sep) or not os.path.isfile(arquivo):
            return self._enviar(404, b"Nao encontrado", "text/plain; charset=utf-8")
        tipo = mimetypes.guess_type(arquivo)[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo in ("application/javascript", "application/json"):
            tipo += "; charset=utf-8"
        with open(arquivo, "rb") as f:
            return self._enviar(200, f.read(), tipo)

    def _backup(self):
        fd, temp = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            self.server.db.copiar_para(temp)
            with open(temp, "rb") as f:
                dados = f.read()
        finally:
            os.remove(temp)
        nome = "gelae-copia-" + agora().replace(":", "").replace(" ", "-") + ".db"
        return self._enviar(200, dados, "application/octet-stream",
                            {"Content-Disposition": f'attachment; filename="{nome}"'})

    def _json(self, dados, status=200):
        return self._enviar(status, json.dumps(dados, ensure_ascii=False).encode("utf-8"),
                            "application/json; charset=utf-8")

    def _enviar(self, status, corpo, tipo, extras=None):
        self.send_response(status)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extras or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(corpo)


def criar_servidor(db, porta, endereco="127.0.0.1"):
    srv = ThreadingHTTPServer((endereco, porta), Tratador)
    srv.daemon_threads = True
    srv.db = db
    return srv
