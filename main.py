"""Abre o sistema Gelaê: sobe o servidor local e mostra a janela.

Uso:  python main.py [--porta 8765] [--dados PASTA] [--sem-janela]
"""
import argparse
import os
import subprocess
import sys
import threading
import urllib.request
import webbrowser

from gelae import VERSAO
from gelae.banco import Banco, pasta_dados
from gelae.servidor import criar_servidor


def ja_rodando(url):
    try:
        with urllib.request.urlopen(url + "api/painel", timeout=1.5) as r:
            return r.status == 200
    except OSError:
        return False


def achar_edge():
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"),
                 os.environ.get("LOCALAPPDATA")):
        if base:
            caminho = os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe")
            if os.path.isfile(caminho):
                return caminho
    return None


def abrir_janela(url, dados):
    """Janela própria do Edge (sem barra de endereço) e impressão direta na impressora padrão."""
    edge = achar_edge()
    if edge:
        subprocess.Popen([edge, f"--app={url}", "--kiosk-printing", "--no-first-run",
                          "--disable-features=Translate", f"--user-data-dir={os.path.join(dados, 'janela')}"])
    else:
        webbrowser.open(url)


def mensagem(texto):
    print(texto, file=sys.stderr)
    if os.name == "nt":
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, texto, "Gelaê", 0x30)


def main():
    ap = argparse.ArgumentParser(description=f"Gelaê {VERSAO}")
    ap.add_argument("--porta", type=int, default=8765)
    ap.add_argument("--dados", help="pasta do banco de dados (padrão: %%LOCALAPPDATA%%\\Gelae)")
    ap.add_argument("--sem-janela", action="store_true", help="só o servidor, sem abrir a janela")
    args = ap.parse_args()

    if args.dados:
        os.environ["GELAE_DADOS"] = args.dados
    dados = pasta_dados()
    url = f"http://127.0.0.1:{args.porta}/"

    if ja_rodando(url):
        if not args.sem_janela:
            abrir_janela(url, dados)
        return

    if getattr(sys, "frozen", False):
        # Programa instalado não tem console: erros vão para um arquivo.
        log = open(os.path.join(dados, "gelae.log"), "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = log

    db = Banco(os.path.join(dados, "gelae.db"))
    try:
        db.backup_automatico(os.path.join(dados, "copias"))
    except OSError as e:
        print("Aviso: cópia automática falhou:", e, file=sys.stderr)

    try:
        srv = criar_servidor(db, args.porta)
    except OSError:
        mensagem(f"A porta {args.porta} do computador está ocupada por outro programa.\n"
                 "Reinicie o computador e abra o Gelaê de novo.")
        return
    print(f"Gelaê {VERSAO} rodando em {url}  (dados em {dados})")
    if not args.sem_janela:
        threading.Timer(0.5, abrir_janela, [url, dados]).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
        db.fechar()


if __name__ == "__main__":
    main()
