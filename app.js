/*
  Polaroid Maker
  Modelo baseado no polaroids.docx enviado pelo usuário.
  Página A4: 210 x 297 mm.
  Molduras: aproximadamente 53 x 86 mm.
  Área de foto: aproximadamente 45.7 x 61 mm.
*/

const { jsPDF } = window.jspdf || {};

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const SLOT_W_MM = 52.99;
const SLOT_H_MM = 85.99;
const PHOTO_W_MM = 45.74;
const PHOTO_H_MM = 61.00;

// Medidas obtidas do Word/PDF renderizado. Pequenas diferenças de décimos de mm são normais
// por causa do motor de renderização do Word/LibreOffice.
const SLOTS = [
  { x: 11.78, y: 8.59 },   { x: 70.26, y: 8.47 },   { x: 131.14, y: 8.89 },
  { x: 11.78, y: 100.67 }, { x: 70.26, y: 100.55 }, { x: 131.14, y: 100.96 },
  { x: 11.78, y: 202.62 }, { x: 70.26, y: 202.49 }, { x: 131.14, y: 202.91 }
];

// Área interna da foto em relação à moldura.
const PHOTO_INSET_X = 10.25 / 2.83464567;
const PHOTO_INSET_Y = 15.95 / 2.83464567;

const state = {
  photos: [],
  selectedId: null,
  page: 0
};

const $ = id => document.getElementById(id);
const fileInput = $('fileInput');
const photoList = $('photoList');
const emptyState = $('emptyState');
const paper = $('paper');
const dropZone = $('dropZone');
const zoomRange = $('zoomRange');
const zoomValue = $('zoomValue');
const editorImage = $('editorImage');
const editorPreview = $('editorPreview');
const editorEmpty = $('editorEmpty');
const editor = $('editor');

function uid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random(); }

function addFiles(files) {
  const valid = [...files].filter(f => f.type.startsWith('image/'));
  valid.forEach(file => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.photos.push({
        id: uid(), file, url, img,
        name: file.name,
        zoom: 100,
        offsetX: 0,
        offsetY: 0
      });
      if (state.selectedId === null) state.selectedId = state.photos[state.photos.length - 1].id;
      ensurePage();
      render();
    };
    img.src = url;
  });
}

function removePhoto(id) {
  const index = state.photos.findIndex(p => p.id === id);
  if (index < 0) return;
  URL.revokeObjectURL(state.photos[index].url);
  state.photos.splice(index, 1);
  if (state.selectedId === id) state.selectedId = state.photos[Math.max(0, index - 1)]?.id ?? null;
  ensurePage();
  render();
}

function clearAll() {
  state.photos.forEach(p => URL.revokeObjectURL(p.url));
  state.photos = [];
  state.selectedId = null;
  state.page = 0;
  render();
}

function pageCount() { return Math.max(1, Math.ceil(state.photos.length / 9)); }
function ensurePage() { state.page = Math.min(state.page, pageCount() - 1); }
function photosForPage() { return state.photos.slice(state.page * 9, state.page * 9 + 9); }
function getSelected() { return state.photos.find(p => p.id === state.selectedId) || null; }

function render() {
  ensurePage();
  renderPhotoList();
  renderPaper();
  renderEditor();
  $('pageLabel').textContent = `Página ${state.page + 1} de ${pageCount()}`;
  $('prevPage').disabled = state.page === 0;
  $('nextPage').disabled = state.page >= pageCount() - 1;
  $('photoCount').textContent = `${state.photos.length} ${state.photos.length === 1 ? 'foto' : 'fotos'}`;
  emptyState.style.display = state.photos.length ? 'none' : 'flex';
}

function renderPhotoList() {
  photoList.innerHTML = '';
  state.photos.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = `photo-item ${p.id === state.selectedId ? 'active' : ''}`;
    el.innerHTML = `
      <img class="photo-thumb" src="${p.url}" alt="">
      <div class="photo-info">
        <div class="photo-name">${escapeHtml(p.name)}</div>
        <div class="photo-position">Foto ${i + 1} · página ${Math.floor(i / 9) + 1}</div>
      </div>
      <button class="photo-remove" title="Remover">×</button>
    `;
    el.addEventListener('click', () => selectPhoto(p.id));
    el.querySelector('.photo-remove').addEventListener('click', e => { e.stopPropagation(); removePhoto(p.id); });
    photoList.appendChild(el);
  });
}

function renderPaper() {
  paper.innerHTML = '';
  const pagePhotos = photosForPage();
  SLOTS.forEach((slot, slotIndex) => {
    const photo = pagePhotos[slotIndex];
    const card = document.createElement('div');
    card.className = `slot ${photo?.id === state.selectedId ? 'selected' : ''}`;
    card.style.left = `${slot.x / PAGE_W_MM * 100}%`;
    card.style.top = `${slot.y / PAGE_H_MM * 100}%`;
    card.style.width = `${SLOT_W_MM / PAGE_W_MM * 100}%`;
    card.style.height = `${SLOT_H_MM / PAGE_H_MM * 100}%`;

    if (photo) {
      const win = document.createElement('div');
      win.className = 'slot-image-window';
      win.style.left = `${PHOTO_INSET_X / SLOT_W_MM * 100}%`;
      win.style.top = `${PHOTO_INSET_Y / SLOT_H_MM * 100}%`;
      win.style.width = `${PHOTO_W_MM / SLOT_W_MM * 100}%`;
      win.style.height = `${PHOTO_H_MM / SLOT_H_MM * 100}%`;

      const img = document.createElement('img');
      img.className = 'slot-image';
      img.src = photo.url;
      img.alt = '';
      applyImageTransform(img, photo, win);
      win.appendChild(img);
      card.appendChild(win);
      card.addEventListener('pointerdown', e => startDrag(e, photo, win, img));
    } else {
      const empty = document.createElement('div');
      empty.className = 'slot-empty';
      empty.textContent = 'Espaço disponível';
      card.appendChild(empty);
    }

    card.addEventListener('click', () => photo && selectPhoto(photo.id));
    paper.appendChild(card);
  });
}

function coverScale(img, boxW, boxH) {
  return Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
}

function containScale(img, boxW, boxH) {
  return Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
}

function applyImageTransform(el, photo, box) {
  const boxW = box.clientWidth || 130;
  const boxH = box.clientHeight || 173;
  const base = coverScale(photo.img, boxW, boxH);
  const scale = base * (photo.zoom / 100);
  el.width = photo.img.naturalWidth * scale;
  el.height = photo.img.naturalHeight * scale;
  el.style.left = `${(boxW - el.width) / 2 + photo.offsetX}px`;
  el.style.top = `${(boxH - el.height) / 2 + photo.offsetY}px`;
}

function selectPhoto(id) {
  state.selectedId = id;
  const p = getSelected();
  if (p) state.page = Math.floor(state.photos.indexOf(p) / 9);
  render();
}

function renderEditor() {
  const p = getSelected();
  if (!p) {
    editorEmpty.classList.remove('hidden');
    editor.classList.add('hidden');
    $('selectedLabel').textContent = 'Selecione uma foto';
    return;
  }
  editorEmpty.classList.add('hidden');
  editor.classList.remove('hidden');
  $('selectedLabel').textContent = p.name;
  zoomRange.value = p.zoom;
  zoomValue.textContent = `${p.zoom}%`;
  editorImage.src = p.url;
  requestAnimationFrame(() => applyEditorTransform());
}

function applyEditorTransform() {
  const p = getSelected();
  if (!p || !editorImage.complete) return;
  const box = editorPreview.querySelector('.editor-image-wrap');
  if (!box) return;
  const boxW = box.clientWidth;
  const boxH = box.clientHeight;
  const base = coverScale(editorImage, boxW, boxH);
  const scale = base * (p.zoom / 100);
  editorImage.width = editorImage.naturalWidth * scale;
  editorImage.height = editorImage.naturalHeight * scale;
  editorImage.style.left = `${(boxW - editorImage.width) / 2 + p.offsetX * .95}px`;
  editorImage.style.top = `${(boxH - editorImage.height) / 2 + p.offsetY * .95}px`;
}

let drag = null;
function startDrag(e, photo, box, img) {
  e.preventDefault();
  state.selectedId = photo.id;
  const rect = box.getBoundingClientRect();
  drag = { photo, startX: e.clientX, startY: e.clientY, x: photo.offsetX, y: photo.offsetY, rect, img };
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag, { once: true });
}
function onDrag(e) {
  if (!drag) return;
  drag.photo.offsetX = drag.x + (e.clientX - drag.startX);
  drag.photo.offsetY = drag.y + (e.clientY - drag.startY);
  applyImageTransform(drag.img, drag.photo, drag.rect);
  applyEditorTransform();
}
function endDrag() {
  window.removeEventListener('pointermove', onDrag);
  drag = null;
  renderPhotoList();
}

zoomRange.addEventListener('input', () => {
  const p = getSelected(); if (!p) return;
  p.zoom = Number(zoomRange.value);
  zoomValue.textContent = `${p.zoom}%`;
  renderPaper();
  applyEditorTransform();
});

$('resetBtn').addEventListener('click', () => {
  const p = getSelected(); if (!p) return;
  p.zoom = 100; p.offsetX = 0; p.offsetY = 0;
  render();
});
$('removeSelectedBtn').addEventListener('click', () => { const p = getSelected(); if (p) removePhoto(p.id); });
$('prevPage').addEventListener('click', () => { state.page--; ensurePage(); render(); });
$('nextPage').addEventListener('click', () => { state.page++; ensurePage(); render(); });

fileInput.addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
$('addMoreBtn').addEventListener('click', () => fileInput.click());
$('clearBtn').addEventListener('click', clearAll);
$('pdfBtn').addEventListener('click', () => exportPDF());
$('jpgBtn').addEventListener('click', () => exportImages('jpg'));
$('pngBtn').addEventListener('click', () => exportImages('png'));

['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, e => { e.preventDefault(); dropZone.style.background = '#e3e3df'; }));
['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, e => { e.preventDefault(); dropZone.style.background = ''; }));
dropZone.addEventListener('drop', e => addFiles(e.dataTransfer.files));

function renderPageToCanvas(pageIndex, scale = 3) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W_MM / 25.4 * 300);
  canvas.height = Math.round(PAGE_H_MM / 25.4 * 300);
  const ctx = canvas.getContext('2d');
  const pxPerMm = canvas.width / PAGE_W_MM;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = Math.max(1, Math.round(pxPerMm * 0.25));

  const pagePhotos = state.photos.slice(pageIndex * 9, pageIndex * 9 + 9);
  SLOTS.forEach((slot, i) => {
    const x = slot.x * pxPerMm, y = slot.y * pxPerMm;
    const w = SLOT_W_MM * pxPerMm, h = SLOT_H_MM * pxPerMm;
    ctx.strokeRect(x, y, w, h);
    const photo = pagePhotos[i];
    if (!photo) return;
    const ix = PHOTO_INSET_X * pxPerMm;
    const iy = PHOTO_INSET_Y * pxPerMm;
    const pw = PHOTO_W_MM * pxPerMm;
    const ph = PHOTO_H_MM * pxPerMm;
    ctx.save();
    ctx.beginPath(); ctx.rect(x + ix, y + iy, pw, ph); ctx.clip();
    const base = Math.max(pw / photo.img.naturalWidth, ph / photo.img.naturalHeight);
    const sc = base * photo.zoom / 100;
    const iw = photo.img.naturalWidth * sc, ih = photo.img.naturalHeight * sc;
    const dx = x + ix + (pw - iw) / 2 + photo.offsetX * pxPerMm;
    const dy = y + iy + (ph - ih) / 2 + photo.offsetY * pxPerMm;
    ctx.drawImage(photo.img, dx, dy, iw, ih);
    ctx.restore();
    ctx.strokeRect(x + ix, y + iy, pw, ph);
  });
  return canvas;
}

async function exportPDF() {
  if (!state.photos.length) return setStatus('Adicione pelo menos uma foto.');
  setStatus('Gerando PDF…');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (let p = 0; p < pageCount(); p++) {
    if (p > 0) doc.addPage('a4', 'portrait');
    const canvas = renderPageToCanvas(p);
    const data = canvas.toDataURL('image/jpeg', 0.94);
    doc.addImage(data, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }
  doc.save('polaroids-prontas-para-imprimir.pdf');
  setStatus('PDF criado. Na impressão, use 100% / tamanho real.');
}

async function exportImages(type) {
  if (!state.photos.length) return setStatus('Adicione pelo menos uma foto.');
  setStatus(`Gerando ${type.toUpperCase()}…`);
  for (let p = 0; p < pageCount(); p++) {
    const canvas = renderPageToCanvas(p);
    const mime = type === 'png' ? 'image/png' : 'image/jpeg';
    const quality = type === 'jpg' ? 0.95 : undefined;
    await downloadCanvas(canvas, mime, quality, `polaroids-pagina-${p + 1}.${type}`);
  }
  setStatus(`${type.toUpperCase()} criado${pageCount() > 1 ? 's' : ''}.`);
}

function downloadCanvas(canvas, mime, quality, filename) {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 150);
    }, mime, quality);
  });
}

function setStatus(text) { $('status').textContent = text; }
function escapeHtml(text) { return text.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

window.addEventListener('resize', () => { if (getSelected()) applyEditorTransform(); });

render();
