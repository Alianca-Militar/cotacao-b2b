// Tela: perfil do vendedor (nome, telefone, assinatura)

const $canvas = document.getElementById('assinatura');
const ctx = $canvas.getContext('2d', { willReadFrequently: true });
let temAssinatura = false;

// ---------- Área de assinatura ----------
function ajustarCanvas() {
  const r = window.devicePixelRatio || 1;
  const largura = $canvas.clientWidth;
  const altura = $canvas.clientHeight;
  const copia = temAssinatura ? $canvas.toDataURL() : null;
  $canvas.width = largura * r;
  $canvas.height = altura * r;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#13204a';
  if (copia) desenharImagem(copia);
}

function marcar(tem) {
  temAssinatura = tem;
  document.getElementById('assinatura-dica').hidden = tem;
}

function limpar() {
  ctx.clearRect(0, 0, $canvas.width, $canvas.height);
  marcar(false);
}

// Desenha uma imagem centralizada, mantendo a proporção
function desenharImagem(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = $canvas.clientWidth, h = $canvas.clientHeight;
      const escala = Math.min((w - 20) / img.width, (h - 20) / img.height, 1);
      const dw = img.width * escala, dh = img.height * escala;
      ctx.clearRect(0, 0, $canvas.width, $canvas.height);
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      marcar(true);
      resolve();
    };
    img.onerror = () => { toast('Não foi possível abrir a imagem.', 'erro'); resolve(); };
    img.src = src;
  });
}

let desenhando = false;
function ponto(e) {
  const r = $canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
$canvas.addEventListener('pointerdown', e => {
  desenhando = true;
  $canvas.setPointerCapture(e.pointerId);
  const [x, y] = ponto(e);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 0.1, y + 0.1);
  ctx.stroke();
  marcar(true);
});
$canvas.addEventListener('pointermove', e => {
  if (!desenhando) return;
  const [x, y] = ponto(e);
  ctx.lineTo(x, y);
  ctx.stroke();
});
['pointerup', 'pointercancel'].forEach(ev => $canvas.addEventListener(ev, () => { desenhando = false; }));

document.getElementById('btn-limpar').addEventListener('click', limpar);

document.getElementById('arquivo').addEventListener('change', e => {
  const arq = e.target.files[0];
  if (!arq) return;
  const leitor = new FileReader();
  leitor.onload = () => desenharImagem(leitor.result);
  leitor.readAsDataURL(arq);
  e.target.value = '';
});

// Recorta o espaço vazio em volta e transforma fundo branco em transparente
function exportarAssinatura() {
  if (!temAssinatura) return null;
  const { width: w, height: h } = $canvas;
  const dados = ctx.getImageData(0, 0, w, h);
  const px = dados.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) px[i + 3] = 0; // branco -> transparente
      if (px[i + 3] > 20) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const m = 6;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);

  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(dados, 0, 0);

  // Limita a 500px de largura para não pesar no banco
  const escala = Math.min(1, 500 / (x1 - x0 + 1));
  const final = document.createElement('canvas');
  final.width = Math.round((x1 - x0 + 1) * escala);
  final.height = Math.round((y1 - y0 + 1) * escala);
  final.getContext('2d').drawImage(tmp, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, final.width, final.height);
  return final.toDataURL('image/png');
}

// ---------- Salvar ----------
document.getElementById('form-perfil').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar');
  btn.disabled = true;
  try {
    await DB.perfis.salvar({
      nome: document.getElementById('nome').value,
      telefone: fmtTelefone(document.getElementById('telefone').value),
      assinatura: exportarAssinatura(),
    });
    if (qs('primeiro')) {
      location.href = 'index.html';
      return;
    }
    toast('Perfil salvo.');
    iniciarPagina('perfil'); // atualiza o nome no topo
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'erro');
  } finally {
    btn.disabled = false;
  }
});

// ---------- Inicialização ----------
(async () => {
  const sessao = await iniciarPagina('perfil');
  if (!sessao) return;
  const { usuario, perfil } = sessao;

  document.getElementById('aviso-primeiro').hidden = !qs('primeiro');
  document.getElementById('email').value = usuario.email || '';
  document.getElementById('nome').value = perfil?.nome || '';
  document.getElementById('telefone').value = fmtTelefone(perfil?.telefone);
  document.getElementById('telefone').addEventListener('blur', e => { e.target.value = fmtTelefone(e.target.value); });

  ajustarCanvas();
  window.addEventListener('resize', debounce(ajustarCanvas, 150));
  if (perfil?.assinatura) await desenharImagem(perfil.assinatura);
  document.getElementById('nome').focus();
})();
