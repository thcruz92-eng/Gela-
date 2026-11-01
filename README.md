# Gelaê

Sistema de gestão da distribuidora Gelaê - Cidade Alta: comandas abertas, balcão, estoque, caixa, despesas e lucro.
Roda no computador do depósito, sem internet.

## Instalar no computador do depósito
1. Em **Actions** (ou **Releases**) deste repositório, baixe `Instalar-Gelae-<versão>.exe`.
2. Copie para o pen drive, leve ao computador e dê dois cliques. Não precisa de senha de administrador.
3. Abra pelo ícone **Gelaê** na área de trabalho.
4. Deixe a impressora térmica como **impressora padrão** do Windows.

Atualizar = instalar a versão nova por cima. Os dados ficam em `%LOCALAPPDATA%\Gelae` e não são apagados.

## Primeiros passos
1. **Produtos**: cadastre cada produto com custo, preço e, se vende fardo, quantas unidades vêm na caixa.
2. **Despesas**: lance os custos fixos do mês (aluguel, luz, salários).
3. **Ajustes**: nome da loja para o cupom e as taxas da maquininha.
4. **Caixa**: abra o caixa com o troco da gaveta.
5. **Comandas**: `F2` abre comanda, `F3` venda no balcão, `F4` recebe.

## Desenvolver
Python 3.10+ sem dependências.
```
python main.py                    # abre o sistema
python -m unittest discover -s tests
```
Detalhes da arquitetura e regras em [CLAUDE.md](CLAUDE.md).
