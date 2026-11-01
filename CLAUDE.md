# Gelaê - sistema da distribuidora

Sistema de gestão da distribuidora de bebidas **Gelaê** (depósito na Cidade Alta). Substitui o Zesto, que só fazia
venda fechada e não mostrava lucro. Dono do projeto: Thiago (amigo do dono da distribuidora). Fala-se português.

## O que resolve
- **Comanda aberta**: abre por mesa ou nome, vai lançando itens, recebe em partes (conta dividida), fecha quando quita.
- **Lucro de verdade**: custo médio de cada produto, taxa da maquininha, despesas avulsas, custos fixos do mês
  (proporcionais aos dias), perdas de estoque.
- Venda por unidade ou **caixa fechada** (fardo), estoque, caixa (abertura, sangria, reforço, fechamento), cupom na
  impressora térmica, cópia de segurança.

## Como é feito
- **Python só com a biblioteca padrão** (nada de pip na execução) + **SQLite** + tela em **HTML/CSS/JS puro** (sem build).
- `main.py` sobe um servidor local em `127.0.0.1:8765` e abre a tela numa janela do Edge (`--app`, `--kiosk-printing`
  para imprimir direto na impressora padrão). Funciona sem internet.
- Dados em `%LOCALAPPDATA%\Gelae\gelae.db`; cópias automáticas a cada 12 h em `%LOCALAPPDATA%\Gelae\copias`.
- Instalador: o GitHub Actions (`.github/workflows/instalador.yml`) roda os testes, empacota com PyInstaller e monta
  `Instalar-Gelae-<versão>.exe` com Inno Setup (`build/gelae.iss`). Instala sem senha de administrador. Esse .exe vai
  no pen drive para o computador do depósito.

| Arquivo | Papel |
|---|---|
| `gelae/banco.py` | conexão, esquema e migrações (`MIGRACOES`), cópia de segurança |
| `gelae/api.py` | todas as regras (produtos, estoque, vendas/comandas, caixa, despesas, lucro) |
| `gelae/servidor.py` | rotas HTTP (`ROTAS`) e arquivos da tela |
| `gelae/impressao.py` | cupons em HTML para 58/80 mm |
| `web/app.js` | toda a tela (uma função por tela em `TELAS`) |
| `tests/test_api.py` | testes; rodar `python -m unittest discover -s tests` |

## Regras que não se quebram
- **Dinheiro sempre em centavos (inteiro)**, no banco, na API e no JS. Converter só na exibição (`brl`) e na digitação (`lerReais`).
- **Banco já em uso não se recria**: mudança de tabela é um item novo no fim de `MIGRACOES` (`ALTER TABLE ...`).
  Nunca editar uma migração que já saiu numa versão.
- Toda mudança de estoque passa por `_mover()` (atualiza o saldo e grava o movimento).
- Escrita no banco dentro de `with db.transacao():`.
- A API recusa POST/PUT/DELETE sem o cabeçalho `X-Gelae: 1` e qualquer Host que não seja 127.0.0.1/localhost.
- Mensagens para o usuário em português simples (quem usa é o balconista, não um técnico).
- Rodar os testes antes de cada commit; testar a tela rodando `python main.py --porta 8799 --dados <pasta-temporária>`.

## Como testar sem mexer em dados reais
```
python main.py --porta 8799 --sem-janela --dados C:\temp\gelae-teste
```
Abrir http://127.0.0.1:8799/ no navegador.

## Publicar uma versão nova
1. Subir `VERSAO` em `gelae/__init__.py`.
2. Commit, `git tag v0.2.0`, `git push --tags`.
3. O instalador aparece em Releases do GitHub. Instalar por cima no computador do depósito: os dados ficam.

## Próximas fases (combinadas em 01/11/2026)
Referência funcional: o "Manual do Gelaê" (app anterior, cujo código se perdeu) - https://claude.ai/artifact/JBoFkSb4vFGtbTmAhTvfjQ
- Login de dono e funcionário (funcionário não vê custo/lucro, não cancela venda, desconto máximo).
- Preço calculado: custo + custos fixos % + variáveis % + taxa embutida + margem (varejo/atacado), promoções, regra de horário.
- Vasilhame (cascos com cliente) e entregas por bairro com taxa.
- Fiado: contas a receber e baixa quando o cliente paga.
- Acesso pela rede Wi-Fi (garçom no celular lançando na comanda), com senha.
- Integrações: WhatsApp, iFood (API oficial, exige homologação), Zé Delivery (a confirmar).
## Integrações: o que se sabe (pesquisa de 01/11/2026)
- **iFood**: API oficial e gratuita (developer.ifood.com.br). Exige conta de desenvolvedor com CNPJ (CPF não serve).
  Uma página antiga do portal também cita CNAE de tecnologia (a confirmar). O e-mail tem de ser diferente do usado no
  Portal do Parceiro. O portal dá uma loja de teste. O app precisa passar na homologação: receber, aceitar ou recusar
  e acompanhar o status dos pedidos. Depois disso, o Dono da loja autoriza o app no Portal do Parceiro. Para um
  programa instalado no computador da loja, o modelo é o "aplicativo distribuído": autorização por código e consulta
  periódica de novos pedidos (polling), sem webhook. Ver se a loja está cadastrada como Restaurante ou como Mercado,
  porque o fluxo muda.
- **Zé Delivery**: não tem API pública. Só integra por fornecedores de PDV com contrato (Linx, webPosto, PDV Manager),
  que usam o Merchant ID tirado do portal do Zé. Para o Gelaê, o caminho é o dono pedir acesso de integração ao
  consultor do Zé (a confirmar). Até lá, os pedidos do Zé continuam no app do Zé.

## Computador do depósito (fotos de 01/11/2026)
Dell com Windows 10 Home 22H2 (build 19045), **64 bits**, Intel i5-3330, **4 GB de RAM**, HD mecânico de 500 GB.
Máquina modesta: manter o sistema leve (nada de Electron, nada de pacote pesado), empacotar em pasta (PyInstaller
`--onedir`, abre mais rápido que `--onefile` em HD). Chrome e Edge instalados.

## Impressora do depósito
**Bematech MP-4200 TH** (térmica, papel 80 mm, área útil 72 mm, guilhotina), foto de 01/11/2026. Hoje a impressão é
um HTML de 72 mm enviado pelo driver do Windows (`--kiosk-printing` manda direto para a impressora padrão).
A confirmar no computador dele: driver instalado, papel em modo bobina e corte no fim do documento. Se sobrar papel em
branco ou o corte falhar, a saída é imprimir direto em RAW pelo spooler (`ctypes` + `winspool.drv`, sem pip). Antes,
confirmar se a impressora está no modo ESC/POS ou ESC/Bema, porque o comando de corte muda: ESC/POS usa `GS V`,
ESC/Bema usa `ESC w` (corte total) e `ESC m` (corte parcial).
