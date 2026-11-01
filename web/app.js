'use strict';
/* Gelaê - tela do sistema. JavaScript puro, sem dependências. */

// ------------------------------------------------------------------ utilidades
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = c => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const reaisTxt = c => ((c || 0) / 100).toFixed(2).replace('.', ',');
const qtdTxt = q => Number(q || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const pct = (a, b) => b ? (a / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '–';
const sinal = c => c < 0 ? 'negativo' : 'positivo';
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "1.234,56" / "12,5" / "12.50" / "12" -> centavos. Vazio = 0. Inválido = NaN. */
function lerReais(txt) {
  txt = String(txt ?? '').trim().replace(/[R$\s]/g, '');
  if (!txt) return 0;
  if (txt.includes(',')) txt = txt.replace(/\./g, '').replace(',', '.');
  const n = Number(txt);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
const lerQtd = txt => Number(String(txt ?? '').trim().replace(',', '.'));

function isoLocal(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
const hojeISO = () => isoLocal(new Date());
function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return isoLocal(d); }
function inicioMes(desloc = 0) { const d = new Date(); return isoLocal(new Date(d.getFullYear(), d.getMonth() + desloc, 1)); }
function fimMes(desloc = 0) { const d = new Date(); return isoLocal(new Date(d.getFullYear(), d.getMonth() + desloc + 1, 0)); }
const dataBR = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}${s.length > 10 ? ' ' + s.slice(11, 16) : ''}` : '';
const diaBR = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
const horaBR = s => s ? s.slice(11, 16) : '';
function tempoDesde(s) {
  const min = Math.max(0, Math.round((Date.now() - new Date(s.replace(' ', 'T')).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return `há ${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

const IC = {
  comandas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  vendas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3h8l-1 4v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7z"/><path d="M9 11h6"/></svg>',
  estoque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  caixa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v5M18 10v5"/></svg>',
  despesas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M17 7.5C17 5.6 14.8 5 12 5s-5 .9-5 3 2.2 2.6 5 3.2 5 1.3 5 3.3-2.2 3.5-5 3.5-5-.9-5-3"/></svg>',
  lucro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18"/><path d="M5 16l5-5 4 3 6-7"/><path d="M15 7h5v5"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>',
  carrinho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L22 8H6"/></svg>',
  impressora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/></svg>',
  lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
};

const MENU = [
  ['', 'Comandas', 'comandas'], ['vendas', 'Vendas', 'vendas'], ['produtos', 'Produtos', 'produtos'],
  ['estoque', 'Estoque', 'estoque'], ['caixa', 'Caixa', 'caixa'], ['despesas', 'Despesas', 'despesas'],
  ['lucro', 'Lucro', 'lucro'], ['ajustes', 'Ajustes', 'ajustes'],
];
const FORMAS = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado' };
let CATEGORIAS_DESPESA = [];
const estado = { caixa: null, config: {} };

// ------------------------------------------------------------------ servidor
async function api(metodo, url, corpo) {
  const op = { method: metodo, headers: { 'X-Gelae': '1' } };
  if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
  let r;
  try { r = await fetch(url, op); } catch (e) { throw new Error('Sem conexão com o sistema. Feche e abra o Gelaê de novo.'); }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(dados.erro || 'Não foi possível concluir.'); e.status = r.status; throw e; }
  return dados;
}
/** Chama a API e mostra o erro na tela. Devolve null se deu erro. */
async function tentar(metodo, url, corpo) {
  try { return await api(metodo, url, corpo); } catch (e) { aviso(e.message, 'erro'); return null; }
}

function aviso(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = 'aviso ' + tipo;
  el.textContent = msg;
  $('#avisos').append(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 6000 : 3000);
}

function imprimir(url) { $('#impressao').src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(); }

// ------------------------------------------------------------------ modal
let aoFecharModal = null;
function abrirModal(titulo, html, { largo = false, aoFechar = null } = {}) {
  $('#modalTitulo').textContent = titulo;
  $('#modalCorpo').innerHTML = html;
  $('.modal').classList.toggle('largo', largo);
  $('#modal').hidden = false;
  aoFecharModal = aoFechar;
  const foco = $('#modalCorpo [autofocus]') || $('#modalCorpo input, #modalCorpo select');
  if (foco) setTimeout(() => { foco.focus(); foco.select?.(); }, 30);
  return $('#modalCorpo');
}
function fecharModal() {
  if ($('#modal').hidden) return;
  $('#modal').hidden = true;
  $('#modalCorpo').innerHTML = '';
  const f = aoFecharModal; aoFecharModal = null;
  if (f) f();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-fechar]') || e.target.id === 'modal') fecharModal();
});
/** Pergunta simples com botões. Devolve true/false. */
function confirmar(titulo, texto, rotuloSim = 'Sim', perigo = false) {
  return new Promise(ok => {
    let resp = false;
    const c = abrirModal(titulo, `<p>${texto}</p><div class="modal-acoes"><button class="btn" data-fechar>Voltar</button>
      <button class="btn ${perigo ? 'perigo' : 'primario'}" id="cfSim">${esc(rotuloSim)}</button></div>`, { aoFechar: () => ok(resp) });
    $('#cfSim', c).onclick = () => { resp = true; fecharModal(); };
    $('#cfSim', c).focus();
  });
}
/** Formulário de um campo. Devolve o texto ou null. */
function perguntar(titulo, rotulo, valor = '', { tipo = 'text', dica = '' } = {}) {
  return new Promise(ok => {
    let resp = null;
    const c = abrirModal(titulo, `<form id="pgForm"><label>${esc(rotulo)}<input id="pgValor" type="${tipo}" value="${esc(valor)}" autofocus
      ${tipo === 'text' ? '' : 'inputmode="decimal"'}></label>${dica ? `<p class="dica">${dica}</p>` : ''}
      <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">OK</button></div></form>`,
      { aoFechar: () => ok(resp) });
    $('#pgForm', c).onsubmit = e => { e.preventDefault(); resp = $('#pgValor', c).value; fecharModal(); };
  });
}

// ------------------------------------------------------------------ navegação
const TELAS = {};
async function navegar() {
  const [rota = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const tela = TELAS[rota] || TELAS[''];
  const ativa = rota === 'venda' ? '' : (TELAS[rota] ? rota : '');
  $$('#nav a').forEach(a => a.classList.toggle('ativo', a.dataset.rota === ativa));
  fecharModal();
  const el = $('#conteudo');
  el.innerHTML = '';
  await tela(el, arg);
  atualizarStatusCaixa();
}

async function atualizarStatusCaixa() {
  const r = await api('GET', '/api/caixa').catch(() => null);
  if (!r) return;
  estado.caixa = r.caixa;
  const el = $('#caixaStatus');
  el.className = 'caixa-status' + (r.caixa ? ' aberto' : '');
  el.innerHTML = r.caixa
    ? `<b>Caixa aberto</b>desde ${dataBR(r.caixa.aberto_em)}<br>${brl(r.caixa.total_recebido)} recebido`
    : '<b>Caixa fechado</b>Abra para receber pagamentos';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return fecharModal();
  if (!$('#modal').hidden) return;
  if (e.key === 'F2') { e.preventDefault(); novaComanda(); }
  if (e.key === 'F3') { e.preventDefault(); vendaBalcao(); }
  if (e.key === 'F4' && vendaAtual && location.hash.startsWith('#/venda/')) { e.preventDefault(); receber(); }
});

// ================================================================== COMANDAS
TELAS[''] = async el => {
  const [vendas, painel] = await Promise.all([tentar('GET', '/api/vendas?status=aberta'), tentar('GET', '/api/painel')]);
  if (!vendas || !painel) return;
  el.innerHTML = `
    <div class="topo"><div><h1>Comandas abertas</h1><small>Hoje: ${painel.vendas_hoje} vendas · ${brl(painel.vendido_hoje)}</small></div>
      <div class="acoes"><button class="btn" id="btBalcao">${IC.carrinho} Venda no balcão <small>F3</small></button>
      <button class="btn primario" id="btNova">${IC.mais} Nova comanda <small>F2</small></button></div></div>
    ${painel.abaixo_minimo.length ? `<div class="alerta-caixa"><b>${painel.abaixo_minimo.length} produto(s) no estoque mínimo:</b>
      ${painel.abaixo_minimo.slice(0, 6).map(p => `${esc(p.nome)} (${qtdTxt(p.estoque)})`).join(', ')}${painel.abaixo_minimo.length > 6 ? '…' : ''}
      <a href="#/estoque">ver estoque</a></div>` : ''}
    ${vendas.length ? `<div class="grade-comandas">${vendas.map(v => `
      <a class="cartao-comanda ${v.tipo}" href="#/venda/${v.id}">
        <div class="cc-nome">${esc(v.nome)}</div>
        <div class="cc-tipo">${v.tipo === 'balcao' ? 'Balcão' : 'Comanda'} · aberta ${tempoDesde(v.aberta_em)}</div>
        <div class="cc-total">${brl(v.total)}</div>
        <div class="cc-itens">${qtdTxt(v.qtd_itens)} ${v.qtd_itens == 1 ? 'item' : 'itens'}${v.pago ? ' · pago ' + brl(v.pago) : ''}</div>
      </a>`).join('')}</div>`
    : `<div class="vazio">Nenhuma comanda aberta.<br><br><b>Nova comanda</b>: para quem senta e vai pedindo ao longo do tempo.<br>
       <b>Venda no balcão</b>: para quem compra e leva na hora.</div>`}`;
  $('#btNova').onclick = novaComanda;
  $('#btBalcao').onclick = vendaBalcao;
};

async function vendaBalcao() {
  const v = await tentar('POST', '/api/vendas', { tipo: 'balcao' });
  if (v) location.hash = '#/venda/' + v.id;
}

function novaComanda() {
  const c = abrirModal('Nova comanda', `<form id="ncForm">
    <label>Mesa ou nome do cliente<input id="ncNome" autofocus placeholder="Ex.: Mesa 4, João, Turma do futebol"></label>
    <div class="chips">${Array.from({ length: 10 }, (_, i) => `<button type="button" class="chip" data-mesa="Mesa ${i + 1}">Mesa ${i + 1}</button>`).join('')}</div>
    <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Abrir comanda</button></div></form>`);
  const criar = async nome => {
    const v = await tentar('POST', '/api/vendas', { tipo: 'comanda', nome });
    if (v) { fecharModal(); location.hash = '#/venda/' + v.id; }
  };
  $$('[data-mesa]', c).forEach(b => b.onclick = () => criar(b.dataset.mesa));
  $('#ncForm', c).onsubmit = e => { e.preventDefault(); criar($('#ncNome', c).value); };
}

// ================================================================== TELA DE VENDA
let vendaAtual = null;
let produtosVenda = [];

TELAS.venda = async (el, id) => {
  const [v, prods] = await Promise.all([tentar('GET', '/api/vendas/' + id), tentar('GET', '/api/produtos?ordem=vendidos')]);
  if (!v || !prods) return;
  produtosVenda = prods;
  el.innerHTML = `<div class="venda">
    <section>
      <div class="busca-grande"><input id="busca" autocomplete="off" placeholder="Buscar produto ou passar o código de barras (ex.: 3*skol)"></div>
      <div id="resultados" class="grade-produtos"></div>
    </section>
    <section class="venda-conta" id="conta"></section></div>`;
  renderConta(v);
  renderResultados('');
  const b = $('#busca');
  if (v.status === 'aberta') b.focus(); else b.disabled = true;
  b.oninput = () => renderResultados(b.value);
  b.onkeydown = async e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const { q, termo } = lerBusca(b.value);
    if (!termo) return;
    const lista = filtrarProdutos(termo);
    if (!lista.length) return aviso('Produto não encontrado.', 'erro');
    await adicionarItem(lista[0].id, q, 'un');
    b.value = '';
    renderResultados('');
  };
};

function lerBusca(txt) {
  const m = String(txt).trim().match(/^(\d+(?:[.,]\d+)?)\s*[*x]\s*(.*)$/i);
  return m ? { q: lerQtd(m[1]) || 1, termo: m[2].trim() } : { q: 1, termo: String(txt).trim() };
}
function filtrarProdutos(termo) {
  const exato = produtosVenda.filter(p => p.codigo_barras && p.codigo_barras === termo);
  if (exato.length) return exato;
  const palavras = norm(termo).split(/\s+/).filter(Boolean);
  return produtosVenda.filter(p => palavras.every(w => norm(p.nome).includes(w)));
}

function renderResultados(txt) {
  const { termo } = lerBusca(txt);
  const lista = termo ? filtrarProdutos(termo) : produtosVenda;
  const aberta = vendaAtual?.status === 'aberta';
  $('#resultados').innerHTML = lista.length ? lista.slice(0, 60).map((p, i) => `
    <div class="produto ${termo && i === 0 ? 'primeiro' : ''}" data-id="${p.id}" role="button" tabindex="0" title="${termo && i === 0 ? 'Enter adiciona este' : ''}">
      <span class="p-nome">${esc(p.nome)}</span>
      ${p.controla_estoque ? `<span class="p-est ${p.estoque <= p.estoque_minimo ? 'baixo' : ''}">Estoque: ${qtdTxt(p.estoque)}</span>` : ''}
      <span class="p-preco">${brl(p.preco)}</span>
      ${p.unidades_caixa > 1 ? `<button class="p-cx" data-cx="${p.id}" title="Caixa com ${p.unidades_caixa}: ${brl(p.preco_caixa || p.preco * p.unidades_caixa)}">cx ${p.unidades_caixa}</button>` : ''}
    </div>`).join('')
    : `<div class="vazio pequeno">Nenhum produto ${termo ? 'com esse nome' : 'cadastrado'}. <a href="#/produtos">Cadastrar produtos</a></div>`;
  if (!aberta) return;
  $$('#resultados .produto').forEach(card => {
    const ir = e => {
      const cx = e.target.closest('[data-cx]');
      adicionarItem(Number(card.dataset.id), lerBusca($('#busca').value).q, cx ? 'cx' : 'un').then(() => {
        if ($('#busca').value) { $('#busca').value = ''; renderResultados(''); }
        $('#busca').focus();
      });
    };
    card.onclick = ir;
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(e); } };
  });
}

async function adicionarItem(produtoId, quantidade, embalagem) {
  const v = await tentar('POST', `/api/vendas/${vendaAtual.id}/itens`, { produto_id: produtoId, quantidade, embalagem });
  if (!v) return;
  const p = produtosVenda.find(x => x.id === produtoId);
  if (p) p.estoque -= quantidade * (embalagem === 'cx' ? p.unidades_caixa : 1);
  renderConta(v, produtoId);
}

function renderConta(v, destacar) {
  vendaAtual = v;
  const aberta = v.status === 'aberta';
  const quitada = aberta && v.itens.length && v.restante <= 0;
  $('#conta').innerHTML = `
    <div class="conta-topo">
      <div><div class="rotulo">${v.tipo === 'balcao' ? 'Venda no balcão' : 'Comanda'} · nº ${v.id}</div>
        <h2 class="conta-nome">${esc(v.nome)}</h2><div class="sub">Aberta ${dataBR(v.aberta_em)}</div></div>
      ${aberta ? `<button class="btn leve" id="btRenomear" title="Renomear">${IC.lapis}</button>` : `<span class="selo ${v.status}">${v.status}</span>`}
    </div>
    <div class="itens">${v.itens.length ? v.itens.map(i => `
      <div class="item ${i.produto_id === destacar ? 'novo' : ''}" data-id="${i.id}">
        <div class="item-desc">${esc(i.descricao)}<small>${brl(i.preco_unit)} cada</small></div>
        ${aberta ? `<div class="qtd"><button data-acao="menos" aria-label="Menos um">−</button><span data-acao="qtd" title="Digitar quantidade">${qtdTxt(i.quantidade)}</span><button data-acao="mais" aria-label="Mais um">+</button></div>`
                 : `<div class="qtd"><span>${qtdTxt(i.quantidade)}×</span></div>`}
        <div class="item-total">${brl(i.total)}</div>
        ${aberta ? '<button class="remover" data-acao="remover" title="Tirar da comanda">×</button>' : '<span></span>'}
      </div>`).join('') : '<div class="vazio pequeno">Nenhum item ainda.<br>Toque num produto para lançar.</div>'}</div>
    <div class="totais">
      <div><span>Subtotal</span><span>${brl(v.subtotal)}</span></div>
      ${v.desconto ? `<div><span>Desconto</span><span>− ${brl(v.desconto)}</span></div>` : ''}
      ${v.acrescimo ? `<div><span>Acréscimo</span><span>+ ${brl(v.acrescimo)}</span></div>` : ''}
      <div class="total"><span>Total</span><span>${brl(v.total)}</span></div>
      ${v.pagamentos.map(p => `<div class="pag ${p.estornado ? 'estornado' : ''}"><span>${FORMAS[p.forma]}${p.cliente ? ' · ' + esc(p.cliente) : ''} <small>${horaBR(p.data)}</small></span>
        <span>${brl(p.valor)}${aberta && !p.estornado ? ` <button class="link" data-pag="${p.id}">desfazer</button>` : ''}</span></div>`).join('')}
      ${v.troco ? `<div class="pag"><span>Troco</span><span>${brl(v.troco)}</span></div>` : ''}
      ${aberta && v.pago ? `<div class="restante"><span>Falta pagar</span><span>${brl(v.restante)}</span></div>` : ''}
    </div>
    <div class="conta-acoes">${aberta ? `
      ${quitada ? '<button class="btn primario grande" id="btFechar">Fechar venda</button>'
                : `<button class="btn primario grande" id="btReceber" ${v.itens.length ? '' : 'disabled'}>Receber ${brl(v.restante)} <small>F4</small></button>`}
      <div class="linha-botoes">
        <button class="btn" id="btImprimir">${IC.impressora} Conta</button>
        <button class="btn" id="btAjuste">Desconto</button>
        <button class="btn perigo-leve" id="btCancelar">Cancelar</button>
      </div>
      <a class="btn" href="#/">← Voltar às comandas</a>`
    : `<div class="linha-botoes"><button class="btn" id="btImprimir">${IC.impressora} Imprimir cupom</button><a class="btn" href="#/">Voltar</a></div>`}
    </div>`;

  const conta = $('#conta');
  $('#btImprimir', conta).onclick = () => imprimir('/imprimir/venda/' + v.id);
  if (!aberta) return;
  $('#btRenomear', conta).onclick = async () => {
    const nome = await perguntar('Renomear', 'Mesa ou nome do cliente', v.nome);
    if (nome === null) return;
    const r = await tentar('PUT', '/api/vendas/' + v.id, { nome });
    if (r) renderConta(r);
  };
  $('#btReceber', conta) && ($('#btReceber', conta).onclick = receber);
  $('#btFechar', conta) && ($('#btFechar', conta).onclick = async () => {
    const r = await tentar('POST', `/api/vendas/${v.id}/fechar`);
    if (r) concluida(r);
  });
  $('#btAjuste', conta).onclick = ajustarTotal;
  $('#btCancelar', conta).onclick = async () => {
    const motivo = await perguntar('Cancelar ' + (v.tipo === 'balcao' ? 'venda' : 'comanda'), 'Motivo (opcional)', '',
      { dica: 'Os itens voltam para o estoque e os pagamentos lançados são desfeitos.' });
    if (motivo === null) return;
    if (await tentar('POST', `/api/vendas/${v.id}/cancelar`, { motivo })) { aviso('Cancelada.'); location.hash = '#/'; }
  };
  $$('[data-pag]', conta).forEach(b => b.onclick = async () => {
    const r = await tentar('DELETE', `/api/vendas/${v.id}/pagamentos/${b.dataset.pag}`);
    if (r) { renderConta(r); atualizarStatusCaixa(); }
  });
  $$('.item', conta).forEach(linha => {
    const item = v.itens.find(i => i.id === Number(linha.dataset.id));
    linha.onclick = async e => {
      const acao = e.target.closest('[data-acao]')?.dataset.acao;
      if (!acao) return;
      let nova = item.quantidade;
      if (acao === 'mais') nova += 1;
      if (acao === 'menos') nova -= 1;
      if (acao === 'remover') nova = 0;
      if (acao === 'qtd') {
        const t = await perguntar(item.descricao, 'Quantidade', qtdTxt(item.quantidade), { tipo: 'text' });
        if (t === null) return;
        nova = lerQtd(t);
        if (!(nova >= 0)) return aviso('Quantidade inválida.', 'erro');
      }
      if (nova <= 0 && !(await confirmar('Tirar item', `Tirar <b>${esc(item.descricao)}</b> da comanda? Volta para o estoque.`, 'Tirar'))) return;
      const r = nova <= 0 ? await tentar('DELETE', `/api/vendas/${v.id}/itens/${item.id}`)
                          : await tentar('PUT', `/api/vendas/${v.id}/itens/${item.id}`, { quantidade: nova });
      if (r) {
        const p = produtosVenda.find(x => x.id === item.produto_id);
        if (p) p.estoque -= (nova - item.quantidade) * item.fator;
        renderConta(r);
        renderResultados($('#busca').value);
      }
    };
  });
}

function ajustarTotal() {
  const v = vendaAtual;
  const c = abrirModal('Desconto e acréscimo', `<form id="ajForm">
    <label>Desconto (R$ ou %)<input id="ajDesc" inputmode="decimal" value="${v.desconto ? reaisTxt(v.desconto) : ''}" placeholder="Ex.: 5,00 ou 10%" autofocus></label>
    <label>Acréscimo / taxa (R$)<input id="ajAcr" inputmode="decimal" value="${v.acrescimo ? reaisTxt(v.acrescimo) : ''}" placeholder="Ex.: taxa de entrega"></label>
    <label>Ou: cobrar no total (vendi por)<input id="ajTotal" inputmode="decimal" placeholder="${reaisTxt(v.subtotal + v.acrescimo)}"></label>
    <p class="dica">Subtotal ${brl(v.subtotal)}. Ao preencher "vendi por", o sistema calcula o desconto.</p>
    <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Aplicar</button></div></form>`);
  $('#ajForm', c).onsubmit = async e => {
    e.preventDefault();
    const acrescimo = lerReais($('#ajAcr', c).value);
    let desconto;
    const tTotal = $('#ajTotal', c).value.trim();
    const tDesc = $('#ajDesc', c).value.trim();
    if (tTotal) desconto = v.subtotal + acrescimo - lerReais(tTotal);
    else if (tDesc.endsWith('%')) desconto = Math.round(v.subtotal * lerQtd(tDesc.slice(0, -1)) / 100);
    else desconto = lerReais(tDesc);
    if (!(desconto >= 0) || isNaN(acrescimo)) return aviso('Valor inválido. O total cobrado não pode ser maior que o subtotal; use acréscimo.', 'erro');
    const r = await tentar('PUT', '/api/vendas/' + v.id, { desconto, acrescimo });
    if (r) { fecharModal(); renderConta(r); }
  };
}

async function garantirCaixa() {
  if (estado.caixa) return true;
  return new Promise(ok => {
    let aberto = false;
    const c = abrirModal('Abrir o caixa', `<form id="acForm"><p>O caixa está fechado. Abra para começar a receber.</p>
      <label>Troco na gaveta (R$)<input id="acValor" inputmode="decimal" placeholder="0,00" autofocus></label>
      <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Abrir caixa</button></div></form>`,
      { aoFechar: () => ok(aberto) });
    $('#acForm', c).onsubmit = async e => {
      e.preventDefault();
      const valor = lerReais($('#acValor', c).value);
      if (isNaN(valor)) return aviso('Valor inválido.', 'erro');
      const r = await tentar('POST', '/api/caixa/abrir', { valor_abertura: valor });
      if (r) { estado.caixa = r.caixa; aberto = true; atualizarStatusCaixa(); fecharModal(); }
    };
  });
}

async function receber() {
  const v = vendaAtual;
  if (!v || v.status !== 'aberta' || !v.itens.length || v.restante <= 0) return;
  if (!(await garantirCaixa())) return;
  const c = abrirModal('Receber · ' + v.nome, `<form id="rcForm">
    <div class="receber-total">Falta pagar<b>${brl(v.restante)}</b></div>
    <div class="formas">${Object.entries(FORMAS).map(([k, n]) => `<button type="button" class="forma" data-forma="${k}">${n}</button>`).join('')}</div>
    <label>Valor nesta forma<input id="rcValor" inputmode="decimal" value="${reaisTxt(v.restante)}"></label>
    <div id="rcDinheiro" hidden><label>Cliente pagou com<input id="rcRecebido" inputmode="decimal" placeholder="Ex.: 50,00"></label>
      <div class="troco">Troco: <b id="rcTroco">${brl(0)}</b></div></div>
    <div id="rcFiado" hidden><label>Quem ficou devendo<input id="rcCliente" placeholder="Nome do cliente"></label></div>
    <p class="dica">Para dividir a conta, diminua o valor e receba uma parte de cada vez. A comanda fecha sozinha quando o total é pago.</p>
    <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario" id="rcOk" disabled>Confirmar</button></div></form>`);
  let forma = null;
  const calcTroco = () => {
    const valor = lerReais($('#rcValor', c).value), recebido = lerReais($('#rcRecebido', c).value);
    $('#rcTroco', c).textContent = brl(recebido > valor ? recebido - valor : 0);
  };
  const escolher = f => {
    forma = f;
    $$('.forma', c).forEach(b => b.classList.toggle('ativo', b.dataset.forma === f));
    $('#rcDinheiro', c).hidden = f !== 'dinheiro';
    $('#rcFiado', c).hidden = f !== 'fiado';
    $('#rcOk', c).disabled = false;
    (f === 'dinheiro' ? $('#rcRecebido', c) : f === 'fiado' ? $('#rcCliente', c) : $('#rcOk', c)).focus();
  };
  $$('.forma', c).forEach(b => b.onclick = () => escolher(b.dataset.forma));
  $('#rcValor', c).oninput = calcTroco;
  $('#rcRecebido', c).oninput = calcTroco;
  $$('.forma', c)[0].focus();
  $('#rcForm', c).onsubmit = async e => {
    e.preventDefault();
    if (!forma) return;
    const valor = lerReais($('#rcValor', c).value);
    if (!(valor > 0)) return aviso('Informe o valor.', 'erro');
    let troco = 0;
    if (forma === 'dinheiro' && $('#rcRecebido', c).value.trim()) {
      const recebido = lerReais($('#rcRecebido', c).value);
      if (!(recebido >= valor)) return aviso('O valor recebido é menor que o valor desta forma.', 'erro');
      troco = recebido - valor;
    }
    $('#rcOk', c).disabled = true;
    const r = await tentar('POST', `/api/vendas/${v.id}/pagamentos`, { forma, valor, troco, cliente: $('#rcCliente', c).value });
    if (!r) { $('#rcOk', c).disabled = false; if (!estado.caixa) atualizarStatusCaixa(); return; }
    fecharModal();
    atualizarStatusCaixa();
    if (r.status === 'fechada') concluida(r);
    else { renderConta(r); aviso('Recebido ' + brl(valor) + '. Falta ' + brl(r.restante) + '.'); }
  };
}

function concluida(v) {
  renderConta(v);
  if (estado.config.imprimir_ao_fechar === '1') imprimir('/imprimir/venda/' + v.id);
  const c = abrirModal('Venda concluída', `<div class="concluida">
    <div>Total ${brl(v.total)}</div>
    ${v.troco ? `<div>Troco</div><div class="grande-num">${brl(v.troco)}</div>` : '<div class="grande-num">Pago ✓</div>'}
    </div><div class="modal-acoes"><button class="btn" id="cnImp">${IC.impressora} Imprimir cupom</button>
    <button class="btn" id="cnBalcao">Nova venda no balcão</button><button class="btn primario" id="cnOk" autofocus>Voltar às comandas</button></div>`,
    { aoFechar: () => { if (location.hash.startsWith('#/venda/' + v.id)) location.hash = '#/'; } });
  $('#cnImp', c).onclick = () => imprimir('/imprimir/venda/' + v.id);
  $('#cnOk', c).onclick = () => fecharModal();
  $('#cnBalcao', c).onclick = async () => { aoFecharModal = null; fecharModal(); vendaBalcao(); };
}

// ================================================================== VENDAS (histórico)
const filtroVendas = { de: hojeISO(), ate: hojeISO() };
TELAS.vendas = async el => {
  el.innerHTML = `<div class="topo"><h1>Vendas</h1></div>
    <div class="filtros"><label>De<input type="date" id="fvDe" value="${filtroVendas.de}"></label>
    <label>Até<input type="date" id="fvAte" value="${filtroVendas.ate}"></label>
    <button class="btn" id="fvHoje">Hoje</button><button class="btn" id="fvOntem">Ontem</button></div><div id="fvLista"></div>`;
  const carregar = async () => {
    filtroVendas.de = $('#fvDe').value; filtroVendas.ate = $('#fvAte').value;
    const vendas = await tentar('GET', `/api/vendas?status=encerradas&de=${filtroVendas.de}&ate=${filtroVendas.ate}`);
    if (!vendas) return;
    const fechadas = vendas.filter(v => v.status === 'fechada');
    $('#fvLista').innerHTML = vendas.length ? `<div class="cartao tabela-rolagem"><table>
      <thead><tr><th>Quando</th><th>Nº</th><th>Comanda / cliente</th><th>Pagamento</th><th class="num">Total</th><th>Situação</th></tr></thead>
      <tbody>${vendas.map(v => `<tr class="clicavel" data-id="${v.id}"><td>${dataBR(v.fechada_em || v.aberta_em)}</td><td>${v.id}</td>
        <td>${esc(v.nome)}</td><td>${(v.formas || '').split(',').filter(Boolean).map(f => FORMAS[f]).join(', ')}</td>
        <td class="num">${brl(v.total)}</td><td><span class="selo ${v.status}">${v.status}</span></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">${fechadas.length} vendas fechadas</td><td class="num">${brl(fechadas.reduce((s, v) => s + v.total, 0))}</td><td></td></tr></tfoot>
      </table></div>` : '<div class="vazio">Nenhuma venda no período.</div>';
    $$('#fvLista tr[data-id]').forEach(tr => tr.onclick = () => detalheVenda(Number(tr.dataset.id), carregar));
  };
  $('#fvDe').onchange = carregar; $('#fvAte').onchange = carregar;
  $('#fvHoje').onclick = () => { $('#fvDe').value = $('#fvAte').value = hojeISO(); carregar(); };
  $('#fvOntem').onclick = () => { $('#fvDe').value = $('#fvAte').value = diasAtras(1); carregar(); };
  carregar();
};

async function detalheVenda(id, depois) {
  const v = await tentar('GET', '/api/vendas/' + id);
  if (!v) return;
  const lucro = v.total - v.custo - v.pagamentos.filter(p => !p.estornado).reduce((s, p) => s + p.taxa, 0);
  const c = abrirModal(`Venda nº ${v.id} · ${v.nome}`, `
    <p><span class="selo ${v.status}">${v.status}</span> Aberta ${dataBR(v.aberta_em)}${v.fechada_em ? ' · encerrada ' + dataBR(v.fechada_em) : ''}</p>
    <div class="tabela-rolagem"><table><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Preço</th><th class="num">Total</th><th class="num">Custo</th></tr></thead>
    <tbody>${v.itens.map(i => `<tr><td>${esc(i.descricao)}</td><td class="num">${qtdTxt(i.quantidade)}</td><td class="num">${brl(i.preco_unit)}</td>
      <td class="num">${brl(i.total)}</td><td class="num">${brl(i.custo_total)}</td></tr>`).join('')}</tbody></table></div>
    <div class="totais" style="padding:10px 0">
      ${v.desconto ? `<div><span>Desconto</span><span>− ${brl(v.desconto)}</span></div>` : ''}
      ${v.acrescimo ? `<div><span>Acréscimo</span><span>+ ${brl(v.acrescimo)}</span></div>` : ''}
      <div class="total"><span>Total</span><span>${brl(v.total)}</span></div>
      ${v.pagamentos.map(p => `<div class="pag ${p.estornado ? 'estornado' : ''}"><span>${FORMAS[p.forma]}${p.cliente ? ' · ' + esc(p.cliente) : ''}</span><span>${brl(p.valor)}${p.taxa ? ` <small>(taxa ${brl(p.taxa)})</small>` : ''}</span></div>`).join('')}
      ${v.status === 'fechada' ? `<div><span>Lucro da venda (sem custos fixos)</span><b class="${sinal(lucro)}">${brl(lucro)}</b></div>` : ''}
    </div>${v.observacao ? `<p class="dica">${esc(v.observacao)}</p>` : ''}
    <div class="modal-acoes">${v.status === 'fechada' ? '<button class="btn perigo-leve" id="dvCancelar">Cancelar venda</button>' : ''}
      <button class="btn" id="dvImp">${IC.impressora} Reimprimir</button><button class="btn primario" data-fechar>OK</button></div>`, { largo: true });
  $('#dvImp', c).onclick = () => imprimir('/imprimir/venda/' + v.id);
  if ($('#dvCancelar', c)) $('#dvCancelar', c).onclick = async () => {
    const motivo = await perguntar('Cancelar venda nº ' + v.id, 'Motivo', '', { dica: 'Os itens voltam para o estoque e os pagamentos saem do caixa.' });
    if (motivo === null) return;
    if (await tentar('POST', `/api/vendas/${v.id}/cancelar`, { motivo })) { aviso('Venda cancelada.'); depois && depois(); atualizarStatusCaixa(); }
  };
}

// ================================================================== PRODUTOS
TELAS.produtos = async el => {
  el.innerHTML = `<div class="topo"><h1>Produtos</h1><div class="acoes"><button class="btn primario" id="npBt">${IC.mais} Novo produto</button></div></div>
    <div class="filtros"><label style="flex:1;min-width:200px">Buscar<input id="bpBusca" placeholder="Nome ou código de barras"></label>
    <label class="check"><input type="checkbox" id="bpTodos">Mostrar fora de linha</label></div><div id="bpLista"></div>`;
  let produtos = [];
  const desenhar = () => {
    const termo = norm($('#bpBusca').value);
    const lista = produtos.filter(p => !termo || norm(p.nome).includes(termo) || p.codigo_barras === $('#bpBusca').value.trim());
    $('#bpLista').innerHTML = lista.length ? `<div class="cartao tabela-rolagem"><table>
      <thead><tr><th>Produto</th><th>Categoria</th><th class="num">Custo</th><th class="num">Preço</th><th class="num">Margem</th><th class="num">Caixa</th><th class="num">Estoque</th></tr></thead>
      <tbody>${lista.map(p => `<tr class="clicavel" data-id="${p.id}">
        <td><b>${esc(p.nome)}</b>${p.ativo ? '' : ' <span class="selo">fora de linha</span>'}${p.codigo_barras ? `<br><small>${esc(p.codigo_barras)}</small>` : ''}</td>
        <td>${esc(p.categoria || '')}</td><td class="num">${brl(p.custo)}</td><td class="num">${brl(p.preco)}</td>
        <td class="num ${p.preco > p.custo ? '' : 'negativo'}">${pct(p.preco - p.custo, p.preco)}</td>
        <td class="num">${p.unidades_caixa > 1 ? `${p.unidades_caixa} un · ${brl(p.preco_caixa || p.preco * p.unidades_caixa)}` : '–'}</td>
        <td class="num ${p.controla_estoque && p.estoque <= p.estoque_minimo ? 'negativo' : ''}">${p.controla_estoque ? qtdTxt(p.estoque) : '–'}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vazio">Nenhum produto. Use <b>Novo produto</b> para começar.</div>';
    $$('#bpLista tr[data-id]').forEach(tr => tr.onclick = () => formProduto(produtos.find(p => p.id === Number(tr.dataset.id)), carregar));
  };
  const carregar = async () => {
    const r = await tentar('GET', '/api/produtos' + ($('#bpTodos').checked ? '?todos=1' : ''));
    if (r) { produtos = r; desenhar(); }
  };
  $('#bpBusca').oninput = desenhar;
  $('#bpTodos').onchange = carregar;
  $('#npBt').onclick = () => formProduto(null, carregar);
  await carregar();
  $('#bpBusca').focus();
};

async function formProduto(p, depois) {
  const cats = await tentar('GET', '/api/categorias') || [];
  const novo = !p;
  p = p || { nome: '', preco: 0, custo: 0, unidades_caixa: 1, preco_caixa: 0, estoque_minimo: 0, controla_estoque: 1, ativo: 1, unidade: 'un' };
  const c = abrirModal(novo ? 'Novo produto' : 'Editar produto', `<form id="fpForm">
    <label>Nome<input id="fpNome" value="${esc(p.nome)}" autofocus required placeholder="Ex.: Heineken Long Neck 330ml"></label>
    <div class="grade-campos">
      <label>Categoria<input id="fpCat" list="fpCats" value="${esc(p.categoria || '')}" placeholder="Ex.: Cervejas">
        <datalist id="fpCats">${cats.map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist></label>
      <label>Código de barras<input id="fpCod" value="${esc(p.codigo_barras || '')}" placeholder="Passe o leitor aqui"></label>
    </div>
    <div class="grade-campos">
      <label>Custo da unidade (R$)<input id="fpCusto" inputmode="decimal" value="${reaisTxt(p.custo)}"></label>
      <label>Preço de venda da unidade (R$)<input id="fpPreco" inputmode="decimal" value="${reaisTxt(p.preco)}"></label>
    </div>
    <p class="dica" id="fpMargem"></p>
    <div class="grade-campos">
      <label>Unidades na caixa / fardo<input id="fpCx" inputmode="numeric" value="${p.unidades_caixa}"></label>
      <label>Preço da caixa fechada (R$)<input id="fpPrecoCx" inputmode="decimal" value="${p.preco_caixa ? reaisTxt(p.preco_caixa) : ''}" placeholder="vazio = unidade × qtd"></label>
    </div>
    <div class="grade-campos">
      ${novo ? '<label>Estoque atual (unidades)<input id="fpEst" inputmode="decimal" value="0"></label>' : ''}
      <label>Avisar quando o estoque chegar a<input id="fpMin" inputmode="decimal" value="${qtdTxt(p.estoque_minimo)}"></label>
    </div>
    <label class="check"><input type="checkbox" id="fpControla" ${p.controla_estoque ? 'checked' : ''}>Controlar estoque deste produto</label>
    ${novo ? '' : `<label class="check"><input type="checkbox" id="fpAtivo" ${p.ativo ? 'checked' : ''}>Produto à venda (desmarque para tirar de linha)</label>`}
    <p class="dica">O custo é atualizado sozinho a cada entrada de mercadoria (custo médio).</p>
    <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Salvar</button></div></form>`, { largo: true });
  const margem = () => {
    const custo = lerReais($('#fpCusto', c).value), preco = lerReais($('#fpPreco', c).value);
    $('#fpMargem', c).innerHTML = preco > 0 ? `Lucro por unidade: <b class="${sinal(preco - custo)}">${brl(preco - custo)}</b> · margem ${pct(preco - custo, preco)}` : '';
  };
  $('#fpCusto', c).oninput = margem; $('#fpPreco', c).oninput = margem; margem();
  $('#fpForm', c).onsubmit = async e => {
    e.preventDefault();
    const dados = {
      nome: $('#fpNome', c).value, categoria: $('#fpCat', c).value, codigo_barras: $('#fpCod', c).value,
      custo: lerReais($('#fpCusto', c).value), preco: lerReais($('#fpPreco', c).value),
      unidades_caixa: Math.max(1, parseInt($('#fpCx', c).value) || 1), preco_caixa: lerReais($('#fpPrecoCx', c).value),
      estoque_minimo: lerQtd($('#fpMin', c).value) || 0, controla_estoque: $('#fpControla', c).checked,
      ativo: novo ? true : $('#fpAtivo', c).checked, unidade: p.unidade,
    };
    if (novo) dados.estoque_inicial = lerQtd($('#fpEst', c).value) || 0;
    if ([dados.custo, dados.preco, dados.preco_caixa].some(isNaN)) return aviso('Confira os valores em reais.', 'erro');
    const r = novo ? await tentar('POST', '/api/produtos', dados) : await tentar('PUT', '/api/produtos/' + p.id, dados);
    if (r) { fecharModal(); aviso('Produto salvo.'); depois && depois(); }
  };
}

// ================================================================== ESTOQUE
let abaEstoque = 'entrada';
TELAS.estoque = async el => {
  const [produtos, painel] = await Promise.all([tentar('GET', '/api/produtos'), tentar('GET', '/api/painel')]);
  if (!produtos || !painel) return;
  el.innerHTML = `<div class="topo"><h1>Estoque</h1></div>
    ${painel.abaixo_minimo.length ? `<div class="alerta-caixa"><b>No estoque mínimo:</b> ${painel.abaixo_minimo.map(p => `${esc(p.nome)} (${qtdTxt(p.estoque)})`).join(', ')}</div>` : ''}
    <div class="abas">${[['entrada', 'Entrada de mercadoria'], ['ajuste', 'Contagem e perdas'], ['posicao', 'Posição do estoque'], ['movimentos', 'Movimentos']]
      .map(([k, n]) => `<button data-aba="${k}" class="${abaEstoque === k ? 'ativo' : ''}">${n}</button>`).join('')}</div><div id="abaCorpo"></div>`;
  $$('.abas button').forEach(b => b.onclick = () => { abaEstoque = b.dataset.aba; TELAS.estoque(el); });
  const corpo = $('#abaCorpo');
  if (abaEstoque === 'entrada') abaEntrada(corpo, produtos);
  if (abaEstoque === 'ajuste') abaAjuste(corpo, produtos);
  if (abaEstoque === 'posicao') abaPosicao(corpo, produtos);
  if (abaEstoque === 'movimentos') abaMovimentos(corpo);
};

/** Campo de busca de produto com lista. aoEscolher(produto). */
function seletorProduto(container, produtos, aoEscolher, valorInicial = '') {
  container.classList.add('seletor');
  container.innerHTML = `<input placeholder="Digite o nome ou passe o código" value="${esc(valorInicial)}" autocomplete="off"><div class="seletor-lista" hidden></div>`;
  const input = $('input', container), lista = $('.seletor-lista', container);
  let achados = [], idx = 0;
  const mostrar = () => {
    const t = input.value.trim();
    achados = !t ? [] : produtos.filter(p => p.codigo_barras === t).concat(
      produtos.filter(p => norm(t).split(/\s+/).every(w => norm(p.nome).includes(w)))).filter((p, i, a) => a.indexOf(p) === i).slice(0, 12);
    idx = 0;
    lista.hidden = !achados.length;
    lista.innerHTML = achados.map((p, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'ativo' : ''}"><span>${esc(p.nome)}</span><small>${brl(p.custo)} · est. ${qtdTxt(p.estoque)}</small></button>`).join('');
    $$('button', lista).forEach(b => b.onmousedown = e => { e.preventDefault(); escolher(achados[Number(b.dataset.i)]); });
  };
  const escolher = p => { input.value = p.nome; lista.hidden = true; aoEscolher(p); };
  input.oninput = mostrar;
  input.onblur = () => setTimeout(() => lista.hidden = true, 150);
  input.onkeydown = e => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + achados.length) % achados.length;
      $$('button', lista).forEach((b, i) => b.classList.toggle('ativo', i === idx));
    }
    if (e.key === 'Enter') { e.preventDefault(); if (achados[idx]) escolher(achados[idx]); }
  };
  return input;
}

function abaEntrada(corpo, produtos) {
  corpo.innerHTML = `<form class="cartao" id="enForm">
    <div class="grade-campos"><label>Fornecedor<input id="enForn" placeholder="Ex.: Ambev, Atacadão"></label>
    <label>Data da compra<input type="date" id="enData" value="${hojeISO()}"></label>
    <label>Nota / pedido<input id="enObs" placeholder="Nº da nota (opcional)"></label></div>
    <h3 style="margin-top:8px">Produtos</h3><div id="enLinhas"></div>
    <button type="button" class="btn" id="enMais">${IC.mais} Outro produto</button>
    <div class="grade-campos" style="margin-top:14px"><label>Frete e outros custos da compra (R$)<input id="enFrete" inputmode="decimal" placeholder="0,00"></label></div>
    <p class="dica">O frete é dividido entre os produtos e entra no custo. Quantidade em <b>unidades</b>; use "cx" para converter caixas.</p>
    <div class="topo" style="margin:8px 0 0"><b id="enTotal">Total: ${brl(0)}</b><button class="btn primario">Registrar entrada</button></div></form>`;
  const linhas = [];
  const total = () => {
    const t = linhas.reduce((s, l) => s + Math.round((l.qtd || 0) * (l.custo || 0)), 0) + (lerReais($('#enFrete').value) || 0);
    $('#enTotal').textContent = 'Total: ' + brl(t);
  };
  const novaLinha = () => {
    const l = { produto: null, qtd: 0, custo: 0 };
    linhas.push(l);
    const div = document.createElement('div');
    div.className = 'linha-entrada';
    div.innerHTML = `<label>Produto<div class="sel"></div></label>
      <label>Quantidade<input class="q" inputmode="decimal"></label>
      <label>Custo unitário<input class="cu" inputmode="decimal"></label>
      <label>Total da linha<input class="ct" inputmode="decimal"></label>
      <button type="button" class="btn leve" title="Tirar linha">×</button>`;
    $('#enLinhas').append(div);
    const q = $('.q', div), cu = $('.cu', div), ct = $('.ct', div);
    const inp = seletorProduto($('.sel', div), produtos, p => {
      l.produto = p;
      if (!cu.value) { cu.value = reaisTxt(p.custo); l.custo = p.custo; }
      const lbl = q.parentElement;
      lbl.firstChild.textContent = p.unidades_caixa > 1 ? `Qtd (cx=${p.unidades_caixa})` : 'Quantidade';
      q.focus();
    });
    q.oninput = () => {
      const t = q.value.trim().toLowerCase();
      const m = t.match(/^(\d+(?:[.,]\d+)?)\s*cx$/);
      l.qtd = m && l.produto ? lerQtd(m[1]) * l.produto.unidades_caixa : lerQtd(t);
      ct.value = l.qtd && l.custo ? reaisTxt(Math.round(l.qtd * l.custo)) : ct.value;
      total();
    };
    q.onblur = () => { if (l.qtd) q.value = qtdTxt(l.qtd); };
    cu.oninput = () => { l.custo = lerReais(cu.value); if (l.qtd) ct.value = reaisTxt(Math.round(l.qtd * l.custo)); total(); };
    ct.oninput = () => { if (l.qtd) { l.custo = Math.round(lerReais(ct.value) / l.qtd); cu.value = reaisTxt(l.custo); } total(); };
    $('button.leve', div).onclick = () => { linhas.splice(linhas.indexOf(l), 1); div.remove(); total(); };
    inp.focus();
  };
  $('#enMais').onclick = novaLinha;
  $('#enFrete').oninput = total;
  novaLinha();
  $('#enForm').onsubmit = async e => {
    e.preventDefault();
    const validas = linhas.filter(l => l.produto);
    if (!validas.length) return aviso('Escolha pelo menos um produto.', 'erro');
    if (validas.some(l => !(l.qtd > 0) || isNaN(l.custo))) return aviso('Confira quantidade e custo de cada produto.', 'erro');
    const r = await tentar('POST', '/api/estoque/entrada', {
      fornecedor: $('#enForn').value, data: $('#enData').value, observacao: $('#enObs').value, frete: lerReais($('#enFrete').value) || 0,
      itens: validas.map(l => ({ produto_id: l.produto.id, quantidade: l.qtd, custo_unit: l.custo })),
    });
    if (r) { aviso(`Entrada registrada: ${brl(r.total)}.`); TELAS.estoque($('#conteudo')); }
  };
}

function abaAjuste(corpo, produtos) {
  corpo.innerHTML = `<form class="cartao" id="ajeForm" style="max-width:560px">
    <label>Produto<div id="ajeSel"></div></label><p class="dica" id="ajeInfo"></p>
    <div class="chips" style="margin-bottom:12px"><button type="button" class="chip ativo" data-t="contagem">Contei a prateleira</button>
      <button type="button" class="chip" data-t="perda">Quebra, vencido ou consumo</button></div>
    <label id="ajeRot">Quantidade contada (unidades)<input id="ajeQtd" inputmode="decimal"></label>
    <label>Motivo / observação<input id="ajeMotivo"></label>
    <button class="btn primario">Registrar</button></form>`;
  let produto = null, tipo = 'contagem';
  seletorProduto($('#ajeSel'), produtos, p => { produto = p; $('#ajeInfo').textContent = `No sistema: ${qtdTxt(p.estoque)} unidades · custo ${brl(p.custo)}`; $('#ajeQtd').focus(); });
  $$('[data-t]').forEach(b => b.onclick = () => {
    tipo = b.dataset.t;
    $$('[data-t]').forEach(x => x.classList.toggle('ativo', x === b));
    $('#ajeRot').firstChild.textContent = tipo === 'contagem' ? 'Quantidade contada (unidades)' : 'Quantidade perdida (unidades)';
  });
  $('#ajeForm').onsubmit = async e => {
    e.preventDefault();
    if (!produto) return aviso('Escolha o produto.', 'erro');
    const r = await tentar('POST', '/api/estoque/ajuste', { produto_id: produto.id, tipo, quantidade: lerQtd($('#ajeQtd').value), motivo: $('#ajeMotivo').value });
    if (r) { aviso(`${r.nome}: estoque agora ${qtdTxt(r.estoque)}.`); TELAS.estoque($('#conteudo')); }
  };
}

function abaPosicao(corpo, produtos) {
  const ctrl = produtos.filter(p => p.controla_estoque);
  const valor = ctrl.reduce((s, p) => s + Math.max(p.estoque, 0) * p.custo, 0);
  const venda = ctrl.reduce((s, p) => s + Math.max(p.estoque, 0) * p.preco, 0);
  corpo.innerHTML = `<div class="numeros"><div class="numero"><span>Valor do estoque (custo)</span><b>${brl(valor)}</b></div>
    <div class="numero"><span>Valor de venda</span><b>${brl(venda)}</b></div><div class="numero"><span>Produtos</span><b>${ctrl.length}</b></div></div>
    <div class="cartao tabela-rolagem"><table><thead><tr><th>Produto</th><th class="num">Estoque</th><th class="num">Caixas</th><th class="num">Mínimo</th><th class="num">Custo</th><th class="num">Valor</th></tr></thead>
    <tbody>${ctrl.map(p => `<tr><td>${esc(p.nome)}</td><td class="num ${p.estoque <= p.estoque_minimo ? 'negativo' : ''}">${qtdTxt(p.estoque)}</td>
      <td class="num">${p.unidades_caixa > 1 ? qtdTxt(Math.floor(p.estoque / p.unidades_caixa)) + ' cx + ' + qtdTxt(p.estoque % p.unidades_caixa) : '–'}</td>
      <td class="num">${qtdTxt(p.estoque_minimo)}</td><td class="num">${brl(p.custo)}</td><td class="num">${brl(Math.max(p.estoque, 0) * p.custo)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function abaMovimentos(corpo) {
  const movs = await tentar('GET', '/api/estoque/movimentos?limite=300');
  if (!movs) return;
  const nomes = { inicial: 'Estoque inicial', entrada: 'Entrada', venda: 'Venda', estorno: 'Devolvido', ajuste: 'Contagem', perda: 'Perda' };
  corpo.innerHTML = movs.length ? `<div class="cartao tabela-rolagem"><table><thead><tr><th>Quando</th><th>Produto</th><th>Tipo</th><th class="num">Qtd</th><th class="num">Custo un.</th><th>Obs.</th></tr></thead>
    <tbody>${movs.map(m => `<tr><td>${dataBR(m.data)}</td><td>${esc(m.produto)}</td><td>${nomes[m.tipo] || m.tipo}</td>
      <td class="num ${m.quantidade < 0 ? 'negativo' : 'positivo'}">${m.quantidade > 0 ? '+' : ''}${qtdTxt(m.quantidade)}</td><td class="num">${brl(m.custo_unit)}</td>
      <td>${esc(m.observacao || m.referencia || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vazio">Nenhum movimento ainda.</div>';
}

// ================================================================== CAIXA
TELAS.caixa = async el => {
  const [r, hist] = await Promise.all([tentar('GET', '/api/caixa'), tentar('GET', '/api/caixas')]);
  if (!r || !hist) return;
  estado.caixa = r.caixa;
  const c = r.caixa;
  const historico = hist.filter(h => h.fechado_em);
  el.innerHTML = `<div class="topo"><h1>Caixa</h1>${c ? `<div class="acoes">
      <button class="btn" id="cxSangria">Sangria (retirada)</button><button class="btn" id="cxReforco">Reforço (troco)</button>
      <button class="btn escuro" id="cxFechar">Fechar caixa</button></div>` : ''}</div>
    ${c ? `<p>Aberto em ${dataBR(c.aberto_em)} · ${c.vendas} vendas fechadas${r.comandas_abertas ? ` · <b>${r.comandas_abertas} comanda(s) ainda aberta(s)</b>` : ''}</p>
      <div class="numeros">
        <div class="numero destaque"><span>Dinheiro esperado na gaveta</span><b>${brl(c.esperado_dinheiro)}</b>
          <small>troco ${brl(c.valor_abertura)} + dinheiro ${brl(c.formas.dinheiro.valor)}${c.reforcos ? ' + reforços ' + brl(c.reforcos) : ''}${c.sangrias ? ' − sangrias ' + brl(c.sangrias) : ''}${c.despesas ? ' − despesas ' + brl(c.despesas) : ''}</small></div>
        ${Object.entries(FORMAS).map(([k, n]) => `<div class="numero"><span>${n}</span><b>${brl(c.formas[k].valor)}</b><small>${c.formas[k].quantidade} pagamento(s)</small></div>`).join('')}
        <div class="numero"><span>Total recebido</span><b>${brl(c.total_recebido)}</b></div>
      </div>
      ${c.movimentos.length ? `<div class="cartao"><h3>Sangrias e reforços</h3><table><tbody>${c.movimentos.map(m => `<tr><td>${dataBR(m.data)}</td><td>${m.tipo === 'sangria' ? 'Sangria' : 'Reforço'}</td><td>${esc(m.motivo || '')}</td><td class="num">${brl(m.valor)}</td></tr>`).join('')}</tbody></table></div>` : ''}`
    : `<form class="cartao" id="cxAbrir" style="max-width:420px"><p>O caixa está fechado.</p>
      <label>Troco na gaveta (R$)<input id="cxValor" inputmode="decimal" placeholder="0,00" autofocus></label>
      <button class="btn primario">Abrir caixa</button></form>`}
    <div class="cartao" style="margin-top:16px"><h3>Caixas anteriores</h3>${historico.length ? `<div class="tabela-rolagem"><table>
      <thead><tr><th>Aberto</th><th>Fechado</th><th class="num">Recebido</th><th class="num">Esperado</th><th class="num">Contado</th><th class="num">Diferença</th><th></th></tr></thead>
      <tbody>${historico.map(h => `<tr><td>${dataBR(h.aberto_em)}</td><td>${dataBR(h.fechado_em)}</td><td class="num">${brl(h.total_recebido)}</td>
        <td class="num">${brl(h.esperado_dinheiro)}</td><td class="num">${brl(h.valor_contado)}</td>
        <td class="num ${h.diferenca < 0 ? 'negativo' : h.diferenca > 0 ? 'positivo' : ''}">${brl(h.diferenca)}</td>
        <td><button class="link" data-imp="${h.id}">imprimir</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="dica">Nenhum caixa fechado ainda.</p>'}</div>`;
  $$('[data-imp]').forEach(b => b.onclick = () => imprimir('/imprimir/caixa/' + b.dataset.imp));
  if (!c) {
    $('#cxAbrir').onsubmit = async e => {
      e.preventDefault();
      const valor = lerReais($('#cxValor').value);
      if (isNaN(valor)) return aviso('Valor inválido.', 'erro');
      if (await tentar('POST', '/api/caixa/abrir', { valor_abertura: valor })) { aviso('Caixa aberto.'); TELAS.caixa(el); atualizarStatusCaixa(); }
    };
    return;
  }
  const movimento = tipo => {
    const m = abrirModal(tipo === 'sangria' ? 'Sangria (retirada de dinheiro)' : 'Reforço (dinheiro colocado)', `<form id="mvForm">
      <label>Valor (R$)<input id="mvValor" inputmode="decimal" autofocus></label><label>Motivo<input id="mvMotivo" placeholder="${tipo === 'sangria' ? 'Ex.: depósito no banco' : 'Ex.: troco extra'}"></label>
      <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Registrar</button></div></form>`);
    $('#mvForm', m).onsubmit = async e => {
      e.preventDefault();
      if (await tentar('POST', '/api/caixa/movimento', { tipo, valor: lerReais($('#mvValor', m).value), motivo: $('#mvMotivo', m).value })) {
        fecharModal(); TELAS.caixa(el); atualizarStatusCaixa();
      }
    };
  };
  $('#cxSangria').onclick = () => movimento('sangria');
  $('#cxReforco').onclick = () => movimento('reforco');
  $('#cxFechar').onclick = () => {
    const m = abrirModal('Fechar caixa', `<form id="fcForm">
      ${r.comandas_abertas ? `<div class="alerta-caixa">${r.comandas_abertas} comanda(s) continuam abertas. Elas podem ser recebidas no próximo caixa.</div>` : ''}
      <p>Esperado na gaveta: <b>${brl(c.esperado_dinheiro)}</b></p>
      <label>Dinheiro contado na gaveta (R$)<input id="fcValor" inputmode="decimal" autofocus></label><p id="fcDif" class="dica"></p>
      <label>Observação<input id="fcObs"></label>
      <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn escuro">Fechar caixa</button></div></form>`);
    $('#fcValor', m).oninput = () => {
      const d = lerReais($('#fcValor', m).value) - c.esperado_dinheiro;
      $('#fcDif', m).innerHTML = isNaN(d) ? '' : d === 0 ? 'Bateu certinho.' : `<b class="${sinal(d)}">${d > 0 ? 'Sobra' : 'Falta'} de ${brl(Math.abs(d))}</b>`;
    };
    $('#fcForm', m).onsubmit = async e => {
      e.preventDefault();
      const contado = lerReais($('#fcValor', m).value);
      if (!$('#fcValor', m).value.trim() || isNaN(contado)) return aviso('Informe o dinheiro contado.', 'erro');
      const f = await tentar('POST', '/api/caixa/fechar', { valor_contado: contado, observacao: $('#fcObs', m).value });
      if (f) { fecharModal(); imprimir('/imprimir/caixa/' + f.id); aviso('Caixa fechado.'); TELAS.caixa(el); atualizarStatusCaixa(); }
    };
  };
};

// ================================================================== DESPESAS
const filtroDespesas = { de: inicioMes(), ate: fimMes() };
TELAS.despesas = async el => {
  el.innerHTML = `<div class="topo"><h1>Despesas e custos</h1><div class="acoes"><button class="btn primario" id="ndBt">${IC.mais} Despesa</button></div></div>
    <div class="cartao" id="cfBox"></div>
    <div class="cartao"><h3>Despesas avulsas</h3>
    <div class="filtros"><label>De<input type="date" id="fdDe" value="${filtroDespesas.de}"></label><label>Até<input type="date" id="fdAte" value="${filtroDespesas.ate}"></label></div>
    <div id="fdLista"></div></div>`;
  const carregarFixos = async () => {
    const fixos = await tentar('GET', '/api/custos-fixos');
    if (!fixos) return;
    const total = fixos.reduce((s, f) => s + f.valor, 0);
    $('#cfBox').innerHTML = `<div class="topo" style="margin-bottom:8px"><h3 style="margin:0">Custos fixos do mês</h3><button class="btn" id="cfNovo">${IC.mais} Custo fixo</button></div>
      <p class="dica">Contas de todo mês (aluguel, luz, salários, contador, seu pró-labore). Não precisa lançar de novo: entram no lucro proporcionais aos dias do período.</p>
      ${fixos.length ? `<table><tbody>${fixos.map(f => `<tr class="clicavel" data-id="${f.id}"><td>${esc(f.descricao)}</td><td class="num">${brl(f.valor)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total por mês</td><td class="num">${brl(total)}</td></tr></tfoot></table>` : ''}`;
    $('#cfNovo').onclick = () => formFixo(null);
    $$('#cfBox tr[data-id]').forEach(tr => tr.onclick = () => formFixo(fixos.find(f => f.id === Number(tr.dataset.id))));
  };
  const formFixo = f => {
    const m = abrirModal(f ? 'Custo fixo' : 'Novo custo fixo', `<form id="cfForm"><label>Descrição<input id="cfDesc" value="${esc(f?.descricao || '')}" autofocus placeholder="Ex.: Aluguel"></label>
      <label>Valor por mês (R$)<input id="cfValor" inputmode="decimal" value="${f ? reaisTxt(f.valor) : ''}"></label>
      <div class="modal-acoes">${f ? '<button type="button" class="btn perigo-leve" id="cfDel">Excluir</button>' : ''}<button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Salvar</button></div></form>`);
    $('#cfForm', m).onsubmit = async e => {
      e.preventDefault();
      const dados = { descricao: $('#cfDesc', m).value, valor: lerReais($('#cfValor', m).value) };
      if (await tentar(f ? 'PUT' : 'POST', '/api/custos-fixos' + (f ? '/' + f.id : ''), dados)) { fecharModal(); carregarFixos(); }
    };
    if (f) $('#cfDel', m).onclick = async () => { if (await tentar('DELETE', '/api/custos-fixos/' + f.id)) { fecharModal(); carregarFixos(); } };
  };
  const carregar = async () => {
    filtroDespesas.de = $('#fdDe').value; filtroDespesas.ate = $('#fdAte').value;
    const lista = await tentar('GET', `/api/despesas?de=${filtroDespesas.de}&ate=${filtroDespesas.ate}`);
    if (!lista) return;
    $('#fdLista').innerHTML = lista.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="num">Valor</th><th></th></tr></thead>
      <tbody>${lista.map(d => `<tr><td>${dataBR(d.data)}</td><td>${esc(d.categoria)}</td><td>${esc(d.descricao || '')}${d.caixa_id ? ' <span class="selo">saiu do caixa</span>' : ''}</td>
        <td class="num">${brl(d.valor)}</td><td><button class="link" data-del="${d.id}">apagar</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${brl(lista.reduce((s, d) => s + d.valor, 0))}</td><td></td></tr></tfoot></table></div>`
      : '<p class="dica">Nenhuma despesa avulsa no período.</p>';
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!(await confirmar('Apagar despesa', 'Apagar esta despesa?', 'Apagar', true))) return;
      if (await tentar('DELETE', '/api/despesas/' + b.dataset.del)) carregar();
    });
  };
  $('#fdDe').onchange = carregar; $('#fdAte').onchange = carregar;
  $('#ndBt').onclick = () => {
    const m = abrirModal('Nova despesa', `<form id="ndForm">
      <div class="grade-campos"><label>Data<input type="date" id="ndData" value="${hojeISO()}"></label>
      <label>Categoria<select id="ndCat">${CATEGORIAS_DESPESA.map(x => `<option>${x}</option>`).join('')}</select></label></div>
      <label>Descrição<input id="ndDesc" placeholder="Ex.: 10 sacos de gelo"></label>
      <label>Valor (R$)<input id="ndValor" inputmode="decimal" autofocus></label>
      <label class="check"><input type="checkbox" id="ndCaixa" ${estado.caixa ? '' : 'disabled'}>Paguei com dinheiro da gaveta do caixa</label>
      <div class="modal-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Salvar</button></div></form>`);
    $('#ndForm', m).onsubmit = async e => {
      e.preventDefault();
      const r = await tentar('POST', '/api/despesas', { data: $('#ndData', m).value, categoria: $('#ndCat', m).value,
        descricao: $('#ndDesc', m).value, valor: lerReais($('#ndValor', m).value), saiu_do_caixa: $('#ndCaixa', m).checked });
      if (r) { fecharModal(); aviso('Despesa lançada.'); carregar(); atualizarStatusCaixa(); }
    };
  };
  carregarFixos();
  carregar();
};

// ================================================================== LUCRO
const filtroLucro = { de: inicioMes(), ate: hojeISO(), rotulo: 'mes' };
TELAS.lucro = async el => {
  const periodos = [['hoje', 'Hoje', hojeISO(), hojeISO()], ['7d', '7 dias', diasAtras(6), hojeISO()],
    ['mes', 'Este mês', inicioMes(), hojeISO()], ['passado', 'Mês passado', inicioMes(-1), fimMes(-1)]];
  el.innerHTML = `<div class="topo"><h1>Lucro</h1></div>
    <div class="filtros"><div class="chips">${periodos.map(([k, n]) => `<button class="chip ${filtroLucro.rotulo === k ? 'ativo' : ''}" data-p="${k}">${n}</button>`).join('')}</div>
    <label>De<input type="date" id="flDe" value="${filtroLucro.de}"></label><label>Até<input type="date" id="flAte" value="${filtroLucro.ate}"></label></div><div id="flCorpo"></div>`;
  $$('[data-p]').forEach(b => b.onclick = () => {
    const p = periodos.find(x => x[0] === b.dataset.p);
    Object.assign(filtroLucro, { rotulo: p[0], de: p[2], ate: p[3] });
    TELAS.lucro(el);
  });
  const mudar = () => { Object.assign(filtroLucro, { rotulo: '', de: $('#flDe').value, ate: $('#flAte').value }); TELAS.lucro(el); };
  $('#flDe').onchange = mudar; $('#flAte').onchange = mudar;
  const r = await tentar('GET', `/api/relatorio?de=${filtroLucro.de}&ate=${filtroLucro.ate}`);
  if (!r) return;
  const linha = (rot, v, cls = '', menos = true) => `<tr class="${cls}"><td>${rot}</td><td class="num">${menos && v ? '− ' : ''}${brl(v)}</td></tr>`;
  $('#flCorpo').innerHTML = `
    <div class="numeros">
      <div class="numero"><span>Vendido</span><b>${brl(r.receita)}</b><small>${r.vendas} vendas · ticket médio ${brl(r.ticket_medio)}</small></div>
      <div class="numero"><span>Lucro bruto</span><b class="${sinal(r.lucro_bruto)}">${brl(r.lucro_bruto)}</b><small>margem ${pct(r.lucro_bruto, r.receita)}</small></div>
      <div class="numero"><span>Despesas e custos fixos</span><b>${brl(r.despesas + r.custos_fixos + r.perdas)}</b></div>
      <div class="numero destaque"><span>Lucro líquido</span><b class="${sinal(r.lucro)}">${brl(r.lucro)}</b><small>${pct(r.lucro, r.receita)} do vendido</small></div>
    </div>
    <div class="cartao"><h3>Resultado do período</h3><table><tbody>
      ${linha('Vendido (já com descontos)', r.receita, '', false)}
      ${linha('Custo das mercadorias vendidas', r.cmv)}
      ${linha('Taxas das maquininhas', r.taxas)}
      <tr><td><b>Lucro bruto</b></td><td class="num"><b class="${sinal(r.lucro_bruto)}">${brl(r.lucro_bruto)}</b></td></tr>
      ${linha('Despesas avulsas', r.despesas)}
      ${linha(`Custos fixos (${brl(r.custos_fixos_mes)}/mês, proporcional ao período)`, r.custos_fixos)}
      ${linha('Perdas e acertos de estoque (a custo)', r.perdas)}
      <tr><td><b>Lucro líquido</b></td><td class="num"><b class="${sinal(r.lucro)}">${brl(r.lucro)}</b></td></tr>
      ${r.descontos ? `<tr><td colspan="2"><small>Descontos dados no período: ${brl(r.descontos)}</small></td></tr>` : ''}
    </tbody></table>
    ${r.custos_fixos_mes ? '' : '<p class="dica">Nenhum custo fixo cadastrado. Lance aluguel, luz e salários em <a href="#/despesas">Despesas</a> para o lucro líquido sair certo.</p>'}</div>
    <div class="cartao"><h3>Por dia</h3><div class="tabela-rolagem"><table><thead><tr><th>Dia</th><th class="num">Vendas</th><th class="num">Vendido</th><th class="num">Custo merc.</th><th class="num">Taxas</th><th class="num">Despesas + fixos</th><th class="num">Lucro</th></tr></thead>
      <tbody>${r.por_dia.slice().reverse().map(d => `<tr><td>${diaBR(d.data)}</td><td class="num">${d.vendas}</td><td class="num">${brl(d.receita)}</td><td class="num">${brl(d.cmv)}</td>
        <td class="num">${brl(d.taxas)}</td><td class="num">${brl(d.despesas + d.fixos + d.perdas)}</td><td class="num ${sinal(d.lucro)}">${brl(d.lucro)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="cartao"><div class="topo" style="margin-bottom:8px"><h3 style="margin:0">Por produto</h3><button class="btn" id="flCsv">Baixar planilha (CSV)</button></div>
      ${r.por_produto.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Produto</th><th class="num">Unidades</th><th class="num">Vendido</th><th class="num">Custo</th><th class="num">Lucro</th><th class="num">Margem</th></tr></thead>
      <tbody>${r.por_produto.map(p => `<tr><td>${esc(p.nome)}</td><td class="num">${qtdTxt(p.unidades)}</td><td class="num">${brl(p.receita)}</td><td class="num">${brl(p.custo)}</td>
        <td class="num ${sinal(p.lucro)}">${brl(p.lucro)}</td><td class="num">${pct(p.lucro, p.receita)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="dica">Sem vendas no período.</p>'}</div>
    <div class="cartao"><h3>Por forma de pagamento</h3>${r.por_forma.length ? `<table><tbody>${r.por_forma.map(f => `<tr><td>${FORMAS[f.forma]}</td><td class="num">${f.quantidade}×</td><td class="num">${brl(f.valor)}</td><td class="num"><small>taxa ${brl(f.taxa)}</small></td></tr>`).join('')}</tbody></table>` : '<p class="dica">Sem pagamentos.</p>'}</div>
    ${r.fiado.length ? `<div class="cartao"><h3>Fiado no período</h3><table><tbody>${r.fiado.map(f => `<tr><td>${esc(f.cliente)}</td><td>${dataBR(f.ultima)}</td><td class="num">${brl(f.valor)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${r.despesas_por_categoria.length ? `<div class="cartao"><h3>Despesas por categoria</h3><table><tbody>${r.despesas_por_categoria.map(d => `<tr><td>${esc(d.categoria)}</td><td class="num">${brl(d.valor)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  $('#flCsv').onclick = () => baixarCsv(`lucro-por-produto-${r.de}-a-${r.ate}.csv`,
    [['Produto', 'Unidades', 'Vendido', 'Custo', 'Lucro'], ...r.por_produto.map(p => [p.nome, qtdTxt(p.unidades), reaisTxt(p.receita), reaisTxt(p.custo), reaisTxt(p.lucro)])]);
};

function baixarCsv(nome, linhas) {
  const txt = '﻿' + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ================================================================== AJUSTES
TELAS.ajustes = async el => {
  const cfg = await tentar('GET', '/api/config');
  if (!cfg) return;
  estado.config = cfg;
  const taxa = k => String(cfg['taxa_' + k] || '0').replace('.', ',');
  el.innerHTML = `<div class="topo"><h1>Ajustes</h1></div>
    <form class="cartao" id="cfgForm" style="max-width:720px">
      <h3>Loja (sai no cupom)</h3>
      <label>Nome<input id="cNome" value="${esc(cfg.nome_loja)}"></label>
      <div class="grade-campos"><label>Endereço<input id="cEnd" value="${esc(cfg.endereco)}"></label><label>Telefone / WhatsApp<input id="cTel" value="${esc(cfg.telefone)}"></label></div>
      <label>CNPJ (opcional)<input id="cDoc" value="${esc(cfg.documento)}"></label>
      <label>Mensagem no fim do cupom<input id="cMsg" value="${esc(cfg.mensagem_cupom)}"></label>
      <h3 style="margin-top:12px">Impressora</h3>
      <div class="grade-campos"><label>Largura do papel<select id="cLarg"><option value="80" ${cfg.largura_cupom === '80' ? 'selected' : ''}>80 mm</option><option value="58" ${cfg.largura_cupom === '58' ? 'selected' : ''}>58 mm</option></select></label></div>
      <label class="check"><input type="checkbox" id="cAuto" ${cfg.imprimir_ao_fechar === '1' ? 'checked' : ''}>Imprimir o cupom sozinho ao fechar cada venda</label>
      <p class="dica">A impressão vai para a <b>impressora padrão do Windows</b>. Deixe a impressora térmica como padrão.</p>
      <h3 style="margin-top:12px">Taxas da maquininha (%)</h3>
      <div class="grade-campos">${['pix', 'debito', 'credito'].map(k => `<label>${FORMAS[k]}<input id="cT_${k}" inputmode="decimal" value="${taxa(k)}"></label>`).join('')}</div>
      <p class="dica">Entram no cálculo do lucro. Confira no extrato da sua maquininha.</p>
      <button class="btn primario">Salvar ajustes</button>
    </form>
    <div class="cartao" style="max-width:720px"><h3>Cópia de segurança</h3>
      <p>O sistema guarda uma cópia sozinho a cada 12 horas no próprio computador. Uma vez por semana, baixe uma cópia e guarde fora do computador (pen drive ou nuvem).</p>
      <a class="btn" href="/backup" download>Baixar cópia dos dados</a></div>
    <div class="cartao" style="max-width:720px"><h3>Sistema</h3><p class="dica">Atalhos: F2 nova comanda · F3 venda no balcão · F4 receber · Esc fecha janelas.</p>
      <button class="btn perigo-leve" id="cSair">Desligar o sistema</button></div>`;
  $('#cfgForm').onsubmit = async e => {
    e.preventDefault();
    const r = await tentar('PUT', '/api/config', {
      nome_loja: $('#cNome').value, endereco: $('#cEnd').value, telefone: $('#cTel').value, documento: $('#cDoc').value,
      mensagem_cupom: $('#cMsg').value, largura_cupom: $('#cLarg').value, imprimir_ao_fechar: $('#cAuto').checked ? '1' : '0',
      taxa_pix: $('#cT_pix').value, taxa_debito: $('#cT_debito').value, taxa_credito: $('#cT_credito').value,
    });
    if (r) { estado.config = r; aviso('Ajustes salvos.'); }
  };
  $('#cSair').onclick = async () => {
    if (!(await confirmar('Desligar', 'Desligar o sistema? Para abrir de novo, use o ícone do Gelaê na área de trabalho.', 'Desligar', true))) return;
    await api('POST', '/api/sair').catch(() => null);
    document.body.innerHTML = '<div class="vazio" style="margin:40px">Sistema desligado. Pode fechar esta janela.</div>';
  };
};

// ------------------------------------------------------------------ início
(async function iniciar() {
  $('#nav').innerHTML = MENU.map(([rota, nome, ic]) => `<a href="#/${rota}" data-rota="${rota}">${IC[ic]}<span>${nome}</span></a>`).join('');
  const [cfg, painel] = await Promise.all([api('GET', '/api/config').catch(() => ({})), api('GET', '/api/painel').catch(() => null)]);
  estado.config = cfg;
  if (painel) CATEGORIAS_DESPESA = painel.categorias_despesa;
  window.addEventListener('hashchange', navegar);
  navegar();
})();
