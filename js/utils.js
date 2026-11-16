// Funções utilitárias compartilhadas por todas as telas

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtBRL(v) { return BRL.format(Number(v) || 0); }
function fmtNum(v) { return NUM2.format(Number(v) || 0); }
function fmtQtd(v) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(v) || 0); }

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 70,00", números...
function parseNum(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Valor opcional: campo vazio = null (produto sem preço)
function parseValor(s) {
  return String(s ?? '').trim() === '' ? null : round2(parseNum(s));
}
function semValor(v) { return v === null || v === undefined || v === ''; }
function fmtValor(v) { return semValor(v) ? '' : fmtNum(v); }

// (32) 98830-4595 / (32) 3235-2226 ; se não reconhecer, devolve como veio
function fmtTelefone(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return String(v ?? '').trim();
}

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

// Remove acentos e deixa minúsculo, para pesquisa
function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function qs(name) { return new URLSearchParams(location.search).get(name); }

function toast(msg, tipo = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('saindo'), 3200);
  setTimeout(() => el.remove(), 3600);
}

// Pesquisa: todos os termos digitados precisam aparecer (em qualquer ordem)
function combina(texto, busca) {
  const t = norm(texto);
  return norm(busca).split(/\s+/).filter(Boolean).every(p => t.includes(p));
}
