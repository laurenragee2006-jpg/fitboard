import { removeBackground } from 'https://esm.sh/@imgly/background-removal@1.4.5';

// ── State ──────────────────────────────────────────────────────────────────
let state = { silhouette: null, clothes: [], outfits: [] };

function loadState() {
  try {
    const saved = localStorage.getItem('fitboard_v1');
    if (saved) state = JSON.parse(saved);
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem('fitboard_v1', JSON.stringify(state));
  } catch(e) {
    alert('Storage full — try removing some clothes or outfits.');
  }
}

function setStatus(text) {
  const el = document.getElementById('statusText');
  if (el) el.textContent = text;
}

// ── Image compression ──────────────────────────────────────────────────────
function compressImage(blob, maxDim = 700) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const cvs = document.createElement('canvas');
      cvs.width = Math.round(img.width * ratio);
      cvs.height = Math.round(img.height * ratio);
      cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height);
      URL.revokeObjectURL(url);
      resolve(cvs.toDataURL('image/webp', 0.82));
    };
    img.src = url;
  });
}

function fileToCompressedBase64(file, maxDim = 900) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const cvs = document.createElement('canvas');
      cvs.width = Math.round(img.width * ratio);
      cvs.height = Math.round(img.height * ratio);
      cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height);
      URL.revokeObjectURL(url);
      resolve(cvs.toDataURL('image/webp', 0.85));
    };
    img.src = url;
  });
}

// ── Canvas (Fabric.js) ─────────────────────────────────────────────────────
let canvas = null;
let silhouetteObj = null;

function initCanvas() {
  const wrap = document.querySelector('.canvas-wrap');
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;

  canvas = new fabric.Canvas('fitCanvas', {
    width: Math.max(w - 8, 200),
    height: Math.max(h - 8, 300),
    backgroundColor: '#ffffff',
  });

  if (state.silhouette) loadSilhouette(state.silhouette);
}

function loadSilhouette(src) {
  if (!canvas) return;
  fabric.Image.fromURL(src, (img) => {
    const scale = Math.min(
      (canvas.width * 0.85) / img.width,
      (canvas.height * 0.85) / img.height
    );
    img.set({
      scaleX: scale, scaleY: scale,
      left: canvas.width / 2, top: canvas.height / 2,
      originX: 'center', originY: 'center',
      selectable: false, evented: false,
      opacity: 0.55,
    });
    if (silhouetteObj) canvas.remove(silhouetteObj);
    silhouetteObj = img;
    canvas.add(img);
    canvas.sendToBack(img);
    canvas.renderAll();
  });
}

function addClothesToCanvas(item) {
  fabric.Image.fromURL(item.imageData, (img) => {
    const maxSize = Math.min(canvas.width, canvas.height) * 0.42;
    const scale = Math.min(maxSize / img.width, maxSize / img.height);
    img.set({
      scaleX: scale, scaleY: scale,
      left: canvas.width / 2, top: canvas.height / 2,
      originX: 'center', originY: 'center',
    });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
    document.getElementById('canvasHint').classList.add('hidden');
    setStatus(`Added: ${item.label}`);
  });
}

// ── View switching ─────────────────────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');

  if (name === 'builder') {
    if (!canvas) initCanvas();
    else if (state.silhouette && !silhouetteObj) loadSilhouette(state.silhouette);
    renderWardrobeStrip();
    setStatus('Builder — drag clothes onto the canvas');
  }
  if (name === 'wardrobe') { renderWardrobe(); setStatus(`Wardrobe — ${state.clothes.length} items`); }
  if (name === 'outfits') { renderOutfits(); setStatus(`Outfits — ${state.outfits.length} saved`); }
}

// ── Wardrobe view ──────────────────────────────────────────────────────────
function renderWardrobe() {
  const grid = document.getElementById('clothesGrid');
  const empty = document.getElementById('wardrobeEmpty');
  const banner = document.getElementById('silhouetteBanner');

  banner.style.display = state.silhouette ? 'none' : 'flex';
  document.getElementById('silhouetteSet').style.display = state.silhouette ? 'flex' : 'none';
  grid.innerHTML = '';

  if (state.clothes.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.clothes.forEach(item => {
    const card = document.createElement('div');
    card.className = 'clothes-card';
    card.innerHTML = `
      <img src="${item.imageData}" alt="${item.label}" loading="lazy">
      <div class="card-label">${item.label}</div>
      <button class="card-delete" data-id="${item.id}" title="Remove">✕</button>
    `;
    card.querySelector('.card-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      state.clothes = state.clothes.filter(c => c.id !== item.id);
      saveState();
      renderWardrobe();
      setStatus(`Removed: ${item.label}`);
    });
    grid.appendChild(card);
  });
}

function renderWardrobeStrip() {
  const strip = document.getElementById('wardrobeStrip');
  const stripEmpty = document.getElementById('stripEmpty');
  strip.innerHTML = '';

  if (state.clothes.length === 0) {
    strip.appendChild(stripEmpty);
    return;
  }

  state.clothes.forEach(item => {
    const thumb = document.createElement('div');
    thumb.className = 'strip-thumb';
    thumb.title = item.label;
    thumb.innerHTML = `<img src="${item.imageData}" alt="${item.label}" loading="lazy">`;
    thumb.addEventListener('click', () => addClothesToCanvas(item));
    strip.appendChild(thumb);
  });
}

// ── Outfits view ───────────────────────────────────────────────────────────
function renderOutfits() {
  const grid = document.getElementById('outfitsGrid');
  const empty = document.getElementById('outfitsEmpty');

  grid.innerHTML = '';
  if (state.outfits.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.outfits.forEach(outfit => {
    const card = document.createElement('div');
    card.className = 'outfit-card';
    card.innerHTML = `
      <img src="${outfit.imageData}" alt="${outfit.name}" loading="lazy">
      <div class="outfit-footer">
        <span class="outfit-name">${outfit.name}</span>
        <button class="outfit-delete" data-id="${outfit.id}" title="Delete">✕</button>
      </div>
    `;
    card.querySelector('.outfit-delete').addEventListener('click', () => {
      state.outfits = state.outfits.filter(o => o.id !== outfit.id);
      saveState();
      renderOutfits();
    });
    grid.appendChild(card);
  });
}

// ── Modal system ───────────────────────────────────────────────────────────
function openModal(name) {
  document.getElementById('modalOverlay').classList.add('open');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById(`${name}Modal`).classList.add('active');
}

function closeModals() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ── Add clothes flow ───────────────────────────────────────────────────────
let pendingClothesData = null;

function resetAddClothesModal() {
  pendingClothesData = null;
  document.getElementById('clothesUploadArea').hidden = false;
  document.getElementById('clothesProcessing').hidden = true;
  document.getElementById('clothesPreview').hidden = true;
  document.getElementById('clothesModalFooter').hidden = true;
  document.getElementById('clothesFileInput').value = '';
  document.getElementById('clothesLabel').value = '';
  document.getElementById('clothesCategory').value = 'top';
}

async function processClothesImage(file) {
  document.getElementById('clothesUploadArea').hidden = true;
  document.getElementById('clothesProcessing').hidden = false;
  setStatus('Removing background...');

  try {
    const blob = await removeBackground(file);
    pendingClothesData = await compressImage(blob, 700);
    setStatus('Background removed! ✨');
  } catch(err) {
    console.warn('BG removal failed, using original:', err);
    pendingClothesData = await fileToCompressedBase64(file, 700);
    setStatus('Ready');
  }

  document.getElementById('clothesProcessing').hidden = true;
  document.getElementById('clothesPreview').hidden = false;
  document.getElementById('clothesModalFooter').hidden = false;
  document.getElementById('clothesPreviewImg').src = pendingClothesData;
}

function confirmAddClothes() {
  if (!pendingClothesData) return;
  const label = document.getElementById('clothesLabel').value.trim();
  const category = document.getElementById('clothesCategory').value;
  state.clothes.push({
    id: Date.now().toString(),
    label: label || category,
    category,
    imageData: pendingClothesData,
  });
  saveState();
  closeModals();
  resetAddClothesModal();
  renderWardrobe();
  setStatus(`Added to wardrobe: ${label || category}`);
}

// ── Silhouette flow ────────────────────────────────────────────────────────
let pendingSilhouetteData = null;

function resetSilhouetteModal() {
  pendingSilhouetteData = null;
  document.getElementById('silhouetteUploadArea').hidden = false;
  document.getElementById('silhouettePreview').hidden = true;
  document.getElementById('silhouetteModalFooter').hidden = true;
  document.getElementById('silhouetteFileInput').value = '';
}

async function processSilhouetteImage(file) {
  pendingSilhouetteData = await fileToCompressedBase64(file, 900);
  document.getElementById('silhouetteUploadArea').hidden = true;
  document.getElementById('silhouettePreview').hidden = false;
  document.getElementById('silhouetteModalFooter').hidden = false;
  document.getElementById('silhouettePreviewImg').src = pendingSilhouetteData;
}

function confirmSilhouette() {
  if (!pendingSilhouetteData) return;
  state.silhouette = pendingSilhouetteData;
  saveState();
  closeModals();
  resetSilhouetteModal();
  renderWardrobe();
  setStatus('Silhouette saved! 💕');
  if (canvas) { silhouetteObj = null; loadSilhouette(state.silhouette); }
}

// ── Save outfit flow ───────────────────────────────────────────────────────
function promptSaveOutfit() {
  document.getElementById('outfitName').value = '';
  openModal('saveOutfit');
  setTimeout(() => document.getElementById('outfitName').focus(), 50);
}

function confirmSaveOutfit() {
  const name = document.getElementById('outfitName').value.trim() || `Outfit ${state.outfits.length + 1}`;
  const imageData = canvas.toDataURL({ format: 'jpeg', quality: 0.88 });
  state.outfits.unshift({ id: Date.now().toString(), name, imageData, date: new Date().toLocaleDateString() });
  saveState();
  closeModals();
  setStatus(`Saved: ${name} 💾`);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderWardrobe();
  setStatus(`Ready — ${state.clothes.length} items in wardrobe`);

  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('addClothesBtn').addEventListener('click', () => { resetAddClothesModal(); openModal('addClothes'); });
  document.getElementById('setSilhouetteBtn').addEventListener('click', () => { resetSilhouetteModal(); openModal('silhouette'); });
  document.getElementById('changeSilhouetteBtn').addEventListener('click', () => { resetSilhouetteModal(); openModal('silhouette'); });

  document.getElementById('clothesUploadArea').addEventListener('click', () => document.getElementById('clothesFileInput').click());
  document.getElementById('clothesFileInput').addEventListener('change', e => { if (e.target.files[0]) processClothesImage(e.target.files[0]); });
  document.getElementById('confirmAddClothes').addEventListener('click', confirmAddClothes);

  document.getElementById('silhouetteUploadArea').addEventListener('click', () => document.getElementById('silhouetteFileInput').click());
  document.getElementById('silhouetteFileInput').addEventListener('change', e => { if (e.target.files[0]) processSilhouetteImage(e.target.files[0]); });
  document.getElementById('confirmSilhouette').addEventListener('click', confirmSilhouette);

  document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModals));
  document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModals(); });

  document.getElementById('saveOutfitBtn').addEventListener('click', promptSaveOutfit);
  document.getElementById('confirmSaveOutfit').addEventListener('click', confirmSaveOutfit);
  document.getElementById('newOutfitBtn').addEventListener('click', () => switchView('builder'));
  document.getElementById('outfitName').addEventListener('keydown', e => { if (e.key === 'Enter') confirmSaveOutfit(); });

  document.getElementById('deleteSelected').addEventListener('click', () => {
    const obj = canvas?.getActiveObject();
    if (obj && obj !== silhouetteObj) { canvas.remove(obj); canvas.renderAll(); setStatus('Item removed'); }
  });
  document.getElementById('bringForward').addEventListener('click', () => {
    const obj = canvas?.getActiveObject();
    if (obj) { canvas.bringForward(obj); canvas.renderAll(); }
  });
  document.getElementById('sendBack').addEventListener('click', () => {
    const obj = canvas?.getActiveObject();
    if (obj && obj !== silhouetteObj) { canvas.sendBackwards(obj); canvas.renderAll(); }
  });
  document.getElementById('flipH').addEventListener('click', () => {
    const obj = canvas?.getActiveObject();
    if (obj) { obj.set('flipX', !obj.flipX); canvas.renderAll(); }
  });
});
