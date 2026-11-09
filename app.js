// PDF.js setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// Global state
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let fabricCanvas = null;
let currentTool = 'select';
let pdfBytes = null;
let pageAnnotations = {}; // Store annotations per page
let annotationScales = {};
let pageOverlays = {};
let renderedScale = 1.5;
let zoomPercent = 100;
let zoomRendering = false;
let originalFilename = ''; // Nome del file PDF originale caricato


// DOM elements - declared but not initialized yet
let uploadArea, pdfFileInput, toolbar, canvasContainer, pdfCanvas, fabricCanvasEl;
let pagination, pageInfo, prevPageBtn, nextPageBtn;
let textProperties, deleteSection, imageFileInput;
let selectTool, textTool, imageTool, exportBtn, deleteBtn;
let fontFamily, fontSize, fontColor, boldBtn, italicBtn, underlineBtn;
let uploadBtnMain, pdfFileInputMain, uploadBtn;
let copyBtn, cutBtn, pasteBtn;
let clipboard = null; // Oggetto in clipboard per copia/incolla
let clipboardScale = 1.5;
let undoStack = [];
let redoStack = [];
let undoTextState = null;

// Signature tool elements
let signatureTool, signatureFileInput, signaturePanel;
let closeSignaturePanel, signatureList, addSignatureBtn;
let signatureDrawing = null;
let signatureStroke = null;
let signatureHasInk = false;

// Export dialog elements
let exportDialog, exportFilename, cancelExport, confirmExport;

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function setupHistoryButtons() {
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  updateHistoryControls();
}

function updateHistoryControls() {
  const undoButton = document.getElementById?.('undoBtn');
  const redoButton = document.getElementById?.('redoBtn');
  if (!undoButton || !redoButton) return;
  const editing = fabricCanvas?.getActiveObject()?.isEditing;
  undoButton.disabled = undoStack.length === 0 && !editing;
  redoButton.disabled = redoStack.length === 0 || editing === true;
}

function finishTextEditing() {
  const object = fabricCanvas?.getActiveObject();
  if (object?.isEditing) object.exitEditing();
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  undoTextState = null;
  updateHistoryControls();
}

function pushAction(action) {
  undoStack.push(action);
  redoStack = [];
  if (undoStack.length > 5) {
    undoStack.shift();
  }
  updateHistoryControls();
}

function undo() {
  finishTextEditing();
  if (undoStack.length === 0) return;
  const action = undoStack.pop();
  redoStack.push(action);
  if (action.type === 'add') {
    fabricCanvas.remove(action.object);
  } else if (action.type === 'delete') {
    fabricCanvas.add(action.object);
  } else if (action.type === 'modify') {
    action.object.set(action.prev);
    action.object.setCoords();
  }
  fabricCanvas.discardActiveObject();
  fabricCanvas.renderAll();
  handleSelectionCleared();
  updateHistoryControls();
  showToast('Azione annullata', 'info');
}

function redo() {
  finishTextEditing();
  if (redoStack.length === 0) return;
  const action = redoStack.pop();
  undoStack.push(action);
  if (action.type === 'add') {
    fabricCanvas.add(action.object);
  } else if (action.type === 'delete') {
    fabricCanvas.remove(action.object);
  } else if (action.type === 'modify') {
    action.object.set(action.next);
    action.object.setCoords();
  }
  fabricCanvas.discardActiveObject();
  fabricCanvas.renderAll();
  handleSelectionCleared();
  updateHistoryControls();
  showToast('Azione ripristinata', 'info');
}

// Initialize app after DOM loads
function initializeApp() {
  console.log('DOM loaded, initializing app...');
  
  // Get all DOM elements
  uploadArea = document.getElementById('uploadArea');
  pdfFileInput = document.getElementById('pdfFileInput');
  toolbar = document.getElementById('toolbar');
  canvasContainer = document.getElementById('canvasContainer');
  pdfCanvas = document.getElementById('pdfCanvas');
  fabricCanvasEl = document.getElementById('fabricCanvas');
  pagination = document.getElementById('pagination');
  pageInfo = document.getElementById('pageInfo');
  prevPageBtn = document.getElementById('prevPage');
  nextPageBtn = document.getElementById('nextPage');
  textProperties = document.getElementById('textProperties');
  deleteSection = document.getElementById('deleteSection');
  imageFileInput = document.getElementById('imageFileInput');
  selectTool = document.getElementById('selectTool');
  textTool = document.getElementById('textTool');
  imageTool = document.getElementById('imageTool');
  exportBtn = document.getElementById('exportBtn');
  deleteBtn = document.getElementById('deleteBtn');
  fontFamily = document.getElementById('fontFamily');
  fontSize = document.getElementById('fontSize');
  fontColor = document.getElementById('fontColor');
  boldBtn = document.getElementById('boldBtn');
  italicBtn = document.getElementById('italicBtn');
  underlineBtn = document.getElementById('underlineBtn');
  uploadBtnMain = document.getElementById('uploadBtnMain');
  pdfFileInputMain = document.getElementById('pdfFileInputMain');
  uploadBtn = document.getElementById('uploadBtn');
  copyBtn = document.getElementById('copyBtn');
  cutBtn = document.getElementById('cutBtn');
  pasteBtn = document.getElementById('pasteBtn');
  
  // Signature tool elements
  signatureTool = document.getElementById('signatureTool');
  signatureFileInput = document.getElementById('signatureFileInput');
  signaturePanel = document.getElementById('signaturePanel');
  closeSignaturePanel = document.getElementById('closeSignaturePanel');
  signatureList = document.getElementById('signatureList');
  addSignatureBtn = document.getElementById('addSignatureBtn');
  
  // Export dialog elements
  exportDialog = document.getElementById('exportDialog');
  exportFilename = document.getElementById('exportFilename');
  cancelExport = document.getElementById('cancelExport');
  confirmExport = document.getElementById('confirmExport');
  
  // Verify critical elements exist
  if (!uploadBtnMain) {
    console.error('ERRORE: uploadBtnMain non trovato!');
    return;
  }
  if (!pdfFileInputMain) {
    console.error('ERRORE: pdfFileInputMain non trovato!');
    return;
  }
  if (!uploadArea) {
    console.error('ERRORE: uploadArea non trovato!');
    return;
  }
  
  console.log('Elementi DOM trovati:', {
    uploadBtnMain: !!uploadBtnMain,
    pdfFileInputMain: !!pdfFileInputMain,
    uploadArea: !!uploadArea,
    uploadBtn: !!uploadBtn,
    pdfFileInput: !!pdfFileInput
  });
  
  // Setup all event listeners
  setupUploadListeners();
  setupToolListeners();
  setupHistoryButtons();
  setupQuickStamps();
  setupToolbarSpacing();
  setupTextListeners();
  setupPaginationListeners();
  setupZoomListeners();
  setupSignatureListeners();
  setupSignatureDrawing();
  setupExportDialogListeners();
  
  // Disabilita inizialmente i pulsanti copia/taglia/incolla
  if (copyBtn) copyBtn.disabled = true;
  if (cutBtn) cutBtn.disabled = true;
  
  // Setup mobile-specific text editing handlers
  // setupMobileTextEditing();
  
  console.log('App initialized successfully!');
}

// Setup upload listeners
function setupUploadListeners() {
  console.log('Setting up upload listeners...');
  
  // Main upload button
  uploadBtnMain.addEventListener('click', (e) => {
    console.log('Main upload button clicked');
    e.preventDefault();
    e.stopPropagation();
    pdfFileInputMain.click();
  });
  
  // Main file input
  pdfFileInputMain.addEventListener('change', (e) => {
    console.log('Main file input changed');
    handlePDFUpload(e);
  });
  
  // Toolbar upload button (after PDF loads)
  if (uploadBtn && pdfFileInput) {
    uploadBtn.addEventListener('click', (e) => {
      console.log('Toolbar upload button clicked');
      e.preventDefault();
      e.stopPropagation();
      pdfFileInput.click();
    });
    
    pdfFileInput.addEventListener('change', (e) => {
      console.log('Toolbar file input changed');
      handlePDFUpload(e);
    });
  }
  
  // Drag and drop on upload area
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('drag-over');
  });
  
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('drag-over');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    console.log('File dropped on upload area');
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      console.log('Dropped file:', file.name, file.type);
      if (file.type === 'application/pdf') {
        handlePDFUploadFromFile(file);
      } else {
        showToast('Trascina un file PDF valido', 'error');
      }
    }
  });
  
  // Prevent default drag-drop on document
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
  });
  
  console.log('Upload listeners configured');
}

// Setup tool listeners
function setupToolListeners() {
  selectTool.addEventListener('click', () => {
    currentTool = 'select';
    updateToolButtons();
    if (fabricCanvas) {
      fabricCanvas.selection = true;
      fabricCanvas.defaultCursor = 'default';
    }
  });
  
  textTool.addEventListener('click', () => {
    currentTool = 'text';
    updateToolButtons();
    if (fabricCanvas) {
      fabricCanvas.selection = false;
      fabricCanvas.defaultCursor = 'crosshair';
    }
  });
  
  imageTool.addEventListener('click', () => {
    imageFileInput.click();
  });
  
  imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      fabric.Image.fromURL(event.target.result, (img) => {
        img.scale(0.5);
        img.set({
          left: 100,
          top: 100
        });
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
  });
  
  deleteBtn.addEventListener('click', deleteSelectedObject);

  // Event listeners per Copia, Taglia e Incolla
  copyBtn.addEventListener('click', copySelectedObject);
  cutBtn.addEventListener('click', cutSelectedObject);
  pasteBtn.addEventListener('click', pasteObject);

  // Scorciatoie da tastiera
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  exportBtn.addEventListener('click', () => {
    showExportDialog();
  });
}

// Show export dialog with default filename
function showExportDialog() {
  if (!pdfDoc) {
    showToast('Nessun PDF caricato', 'error');
    return;
  }

  // Calculate default filename based on original
  let defaultName = 'documento_modificato';
  if (originalFilename) {
    const nameWithoutExt = originalFilename.replace(/\.pdf$/i, '');
    defaultName = `${nameWithoutExt}_modificato`;
  }
  
  console.log('Opening export dialog. originalFilename:', originalFilename, 'defaultName:', defaultName);

  // Force set the value
  exportFilename.value = '';
  exportFilename.value = defaultName;
  
  // Show dialog
  exportDialog.style.display = 'flex';
  
  // Focus and select after a small delay to ensure DOM update
  setTimeout(() => {
    exportFilename.focus();
    exportFilename.select();
  }, 10);
}

// Setup export dialog listeners
function setupExportDialogListeners() {
  cancelExport.addEventListener('click', () => {
    exportDialog.style.display = 'none';
  });

  confirmExport.addEventListener('click', async () => {
    const filename = exportFilename.value.trim();
    if (!filename) {
      showToast('Inserisci un nome per il file', 'error');
      return;
    }

    let finalFilename = filename;
    if (!filename.toLowerCase().endsWith('.pdf')) {
      finalFilename = `${filename}.pdf`;
    }

    exportDialog.style.display = 'none';
    await exportPDF(finalFilename);
  });

  exportFilename.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      confirmExport.click();
    } else if (e.key === 'Escape') {
      cancelExport.click();
    }
  });
}

// Setup text property listeners
function setupTextListeners() {
  fontFamily.addEventListener('change', () => {
    if (fontFamily.disabled) return; // Blocca se disabilitato
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set('fontFamily', fontFamily.value);
      fabricCanvas.renderAll();
    }
  });

  fontSize.addEventListener('input', () => {
    if (fontSize.disabled) return; // Blocca se disabilitato
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set('fontSize', parseInt(fontSize.value));
      fabricCanvas.renderAll();
    }
  });

  fontColor.addEventListener('input', () => {
    if (fontColor.disabled) return; // Blocca se disabilitato
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set('fill', fontColor.value);
      fabricCanvas.renderAll();
    }
  });

  boldBtn.addEventListener('click', () => {
    if (boldBtn.disabled) return; // Blocca se disabilitato
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      const isBold = activeObject.fontWeight === 'bold';
      activeObject.set('fontWeight', isBold ? 'normal' : 'bold');
      boldBtn.classList.toggle('active');
      fabricCanvas.renderAll();
    }
  });

  italicBtn.addEventListener('click', () => {
    if (italicBtn.disabled) return; // Blocca se disabilitato
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      const isItalic = activeObject.fontStyle === 'italic';
      activeObject.set('fontStyle', isItalic ? 'normal' : 'italic');
      italicBtn.classList.toggle('active');
      fabricCanvas.renderAll();
    }
  });

  underlineBtn.addEventListener('click', () => {
    if (underlineBtn.disabled) return; // Blocca se disabilitato
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set('underline', !activeObject.underline);
      underlineBtn.classList.toggle('active');
      fabricCanvas.renderAll();
    }
  });
}

// Setup pagination listeners
function setupPaginationListeners() {
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      savePageAnnotations();
      resetHistory();
      currentPage--;
      renderPage(currentPage);
      updatePagination();
    }
  });
  
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      savePageAnnotations();
      resetHistory();
      currentPage++;
      renderPage(currentPage);
      updatePagination();
    }
  });
  
  // Responsive resize handler
  window.addEventListener('resize', () => {
    if (pdfDoc && canvasContainer.style.display !== 'none') {
      savePageAnnotations();
      renderPage(currentPage);
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Handle PDF upload from file input event
async function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    console.log('No file selected');
    return;
  }
  
  console.log('File selected:', file.name, file.type);
  
  if (file.type !== 'application/pdf') {
    showToast('Seleziona un file PDF valido', 'error');
    return;
  }
  
  await loadPDFFile(file);
}

// Handle PDF upload from dropped file
async function handlePDFUploadFromFile(file) {
  if (!file) {
    console.log('No file provided');
    return;
  }
  
  //console.log('Loading dropped file:', file.name, file.type);
  await loadPDFFile(file);
}

// Load and render PDF from file
async function loadPDFFile(file) {
  try {
    // Salva il nome del file originale
    originalFilename = file.name;
    
    showToast('Caricamento PDF in corso...', 'info');
    
    // Read file as ArrayBuffer using FileReader for better compatibility
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Errore nella lettura del file'));
      reader.readAsArrayBuffer(file);
    });
    //console.log('ArrayBuffer length:', arrayBuffer.byteLength);
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('File PDF vuoto o corrotto');
    }
    
    // Convert to Uint8Array e SALVA in pdfBytes
    pdfBytes = new Uint8Array(arrayBuffer);
    
    //console.log('pdfBytes length:', pdfBytes.length);
    //console.log('pdfBytes first 10 bytes:', Array.from(pdfBytes.slice(0, 10)));
    
    // Verifica header
    const header = String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3]);
    //console.log('PDF header:', header);
    
    if (header !== '%PDF') {
      throw new Error('File non è un PDF valido (header: ' + header + ')');
    }
    
    // Load with PDF.js
    //console.log('Loading with PDF.js...');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBytes), isEvalSupported: false
    });
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    currentPage = 1;
    zoomPercent = 100;
    
    //console.log('PDF loaded successfully:', totalPages, 'pages');
    
    // Initialize page annotations storage
    pageAnnotations = {};
    annotationScales = {};
    pageOverlays = {};
    for (let i = 1; i <= totalPages; i++) {
      pageAnnotations[i] = [];
    }

    // Show UI
    uploadArea.style.display = 'none';
    toolbar.style.display = 'flex';
    canvasContainer.style.display = 'flex';
    pagination.style.display = 'flex';
  
    // Render first page
    await renderPage(currentPage);
    updatePagination();
    handleSelectionCleared();
    showToast('PDF caricato con successo!', 'success');
  } catch (error) {
    console.error('Error loading PDF:', error);
    showToast('Errore nel caricamento del PDF: ' + error.message, 'error');
    // Reset
    pdfBytes = null;
    pdfDoc = null;
  }
}

function setupZoomListeners() {
  document.getElementById('zoomIn').addEventListener('click', async function () {
    await changeZoom(25);
  });
  document.getElementById('zoomOut').addEventListener('click', async function () {
    await changeZoom(-25);
  });
}

function updateZoomControls() {
  document.getElementById('zoomLevel').textContent = `${zoomPercent}%`;
  document.getElementById('zoomIn').disabled = zoomRendering || zoomPercent >= 300;
  document.getElementById('zoomOut').disabled = zoomRendering || zoomPercent <= 25;
}

async function changeZoom(amount) {
  if (!pdfDoc || !fabricCanvas || zoomRendering) return;
  const nextZoom = Math.max(25, Math.min(300, zoomPercent + amount));
  if (nextZoom === zoomPercent) return;
  zoomRendering = true;
  updateZoomControls();
  try {
    savePageAnnotations();
    zoomPercent = nextZoom;
    await renderPage(currentPage, true);
  } finally {
    zoomRendering = false;
    updateZoomControls();
  }
}

function handleZoomShortcut(event) {
  if (!pdfDoc || !(event.ctrlKey || event.metaKey)) return false;
  if (!['+', '=', '-'].includes(event.key)) return false;
  event.preventDefault();
  let amount = 25;
  if (event.key === '-') amount = -25;
  changeZoom(amount);
  return true;
}

function getPageViewport(page) {
  let containerMaxWidth = 900;
  if (window.innerWidth < 480) containerMaxWidth = window.innerWidth * 0.98;
  else if (window.innerWidth < 768) containerMaxWidth = window.innerWidth * 0.95;
  else if (window.innerWidth < 1024) containerMaxWidth = window.innerWidth * 0.9;
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1.5, containerMaxWidth / viewport.width);
  return page.getViewport({ scale: scale * zoomPercent / 100 });
}

function resizePageCanvases(viewport) {
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  pdfCanvas.style.width = viewport.width + 'px';
  pdfCanvas.style.height = viewport.height + 'px';
  fabricCanvasEl.width = viewport.width;
  fabricCanvasEl.height = viewport.height;
  fabricCanvasEl.style.width = viewport.width + 'px';
  fabricCanvasEl.style.height = viewport.height + 'px';
  const wrapper = document.querySelector('.canvas-wrapper');
  wrapper.style.aspectRatio = (viewport.width / viewport.height).toFixed(6);
  wrapper.style.width = viewport.width + 'px';
  wrapper.style.height = viewport.height + 'px';
}

function initializeFabricCanvas(viewport) {
  if (fabricCanvas) {
    fabricCanvas.setWidth(viewport.width);
    fabricCanvas.setHeight(viewport.height);
    fabricCanvas.calcOffset();
    return;
  }
  fabricCanvas = new fabric.Canvas('fabricCanvas', {
    width: viewport.width,
    height: viewport.height,
    selection: true,
    preserveObjectStacking: true
  });
  fabricCanvas.on('selection:created', handleSelection);
  fabricCanvas.on('selection:updated', handleSelection);
  fabricCanvas.on('selection:cleared', handleSelectionCleared);
  fabricCanvas.on('mouse:down', handleCanvasClick);
  fabricCanvas.on('object:modified', handleObjectModified);
  fabricCanvas.on('text:editing:entered', handleEditingEntered);
  fabricCanvas.on('text:editing:exited', handleEditingExited);
}

function scaleHistoryGeometry(state, ratio) {
  for (const key of ['left', 'top', 'scaleX', 'scaleY']) {
    if (Number.isFinite(state[key])) state[key] *= ratio;
  }
}

function scalePageObjects(scale) {
  const ratio = scale / renderedScale;
  const objects = new Set(fabricCanvas.getObjects());
  for (const action of [...undoStack, ...redoStack]) {
    objects.add(action.object);
    if (action.type !== 'modify') continue;
    scaleHistoryGeometry(action.prev, ratio);
    scaleHistoryGeometry(action.next, ratio);
  }
  for (const object of objects) {
    object.set({
      left: object.left * ratio, top: object.top * ratio,
      scaleX: object.scaleX * ratio, scaleY: object.scaleY * ratio
    });
    object.setCoords();
  }
  renderedScale = scale;
  fabricCanvas.renderAll();
}

async function renderPage(pageNum, preserveObjects = false) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = getPageViewport(page);
    resizePageCanvases(viewport);
    await page.render({
      canvasContext: pdfCanvas.getContext('2d'), viewport: viewport
    }).promise;
    initializeFabricCanvas(viewport);
    if (preserveObjects) scalePageObjects(viewport.scale);
    else await loadPageAnnotations(pageNum, viewport.scale);
    updateZoomControls();
  } catch (error) {
    console.error('Errore rendering pagina:', error);
    showToast('Errore nel rendering della pagina', 'error');
  }
}

// Save current page annotations
function saveCurrentPageAnnotations() {
  savePageAnnotations();
}

function savePageAnnotations() {
  if (!fabricCanvas) return;
  
  // Exit editing mode for any active text object
  const activeObject = fabricCanvas.getActiveObject();
  if (activeObject && activeObject.isEditing) {
    activeObject.exitEditing();
  }
  
  fabricCanvas.discardActiveObject();
  fabricCanvas.renderAll();
  
  const objects = fabricCanvas.getObjects();
  const annotations = objects.map(obj => {
    if (obj.type === 'textbox') {
      return {
        type: 'text',
        text: obj.text,
        left: obj.left,
        top: obj.top,
        fontFamily: obj.fontFamily,
        fontSize: obj.fontSize,
        fill: obj.fill,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        underline: obj.underline,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        width: obj.width
      };
    } else if (obj.type === 'image') {
      // Salva le dimensioni visualizzate (finali) invece di width/height + scale
      // Questo permette di ricalcolare correttamente lo scale quando si ricarica l'immagine
      return {
        type: 'image',
        src: obj.getSrc(),
        left: obj.left,
        top: obj.top,
        displayWidth: obj.width * obj.scaleX,
        displayHeight: obj.height * obj.scaleY,
        angle: obj.angle
      };
    }
    return null;
  }).filter(Boolean);
  
  pageAnnotations[currentPage] = annotations;
  annotationScales[currentPage] = renderedScale;
  pageOverlays[currentPage] = null;
  if (annotations.length > 0) {
    pageOverlays[currentPage] = fabricCanvas.toDataURL({ multiplier: 3 / renderedScale });
  }
}

// Load annotations for current page
async function loadPageAnnotations(pageNum, scale = renderedScale) {
  resetHistory();
  const ratio = scale / (annotationScales[pageNum] || scale);
  renderedScale = scale;
  fabricCanvas.clear();
  for (const annotation of pageAnnotations[pageNum] || []) {
    fabricCanvas.add(await createAnnotationObject(annotation, ratio));
  }
  fabricCanvas.renderAll();
}

async function createAnnotationObject(annotation, ratio) {
  const { type, text, ...options } = annotation;
  options.left *= ratio;
  options.top *= ratio;
  options.scaleX = (annotation.scaleX || 1) * ratio;
  options.scaleY = (annotation.scaleY || 1) * ratio;
  if (type === 'text') return new fabric.Textbox(text, options);
  const image = await new Promise(function (resolve, reject) {
    fabric.Image.fromURL(annotation.src, function (image, error) {
      if (error || !image) reject(new Error('Immagine non disponibile'));
      else resolve(image);
    });
  });
  if (annotation.displayWidth && annotation.displayHeight) {
    options.scaleX = annotation.displayWidth * ratio / image.width;
    options.scaleY = annotation.displayHeight * ratio / image.height;
  }
  image.set(options);
  return image;
}

function updateToolButtons() {
  // Resetta tutti i tool buttons (nessuna classe tool-btn, sono .btn ora)
  selectTool.classList.remove('active');
  textTool.classList.remove('active');
  imageTool.classList.remove('active');
  if (currentTool === 'select') selectTool.classList.add('active');
  if (currentTool === 'text') textTool.classList.add('active');
}

function setupToolbarSpacing() {
  const observer = new ResizeObserver(function () {
    canvasContainer.style.paddingTop = toolbar.offsetHeight + 24 + 'px';
  });
  observer.observe(toolbar);
}

function setupQuickStamps() {
  document.getElementById('quickStamp').addEventListener('change', function (event) {
    insertQuickStamp(event.target.value);
    event.target.value = '';
  });
}

function insertQuickStamp(type) {
  if (!fabricCanvas) return;
  const stamps = {
    date: new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }),
    check: '✓', cross: '✕'
  };
  if (typeof stamps[type] !== 'string') return;
  let size = 24, width = 40;
  if (type === 'date') { size = 16; width = 140; }
  addTextAnnotation(stamps[type], {
    left: 100 * renderedScale, top: 100 * renderedScale,
    fontSize: size * renderedScale, width: width * renderedScale
  });
  selectTool.click();
}

function addTextAnnotation(text, options) {
  finishTextEditing();
  const textbox = new fabric.Textbox(text, {
    fontFamily: 'Arial', fontSize: 16, fill: '#000000', width: 200,
    editable: true, ...options
  });
  fabricCanvas.add(textbox);
  pushAction({ type: 'add', object: textbox });
  fabricCanvas.setActiveObject(textbox);
  fabricCanvas.renderAll();
  return textbox;
}

function handleCanvasClick(event) {
  if (currentTool !== 'text' || event.target) return;
  const pointer = fabricCanvas.getPointer(event.e);
  const textbox = addTextAnnotation('Digita qui...', { left: pointer.x, top: pointer.y });
  textbox.enterEditing();
  textbox.selectAll();
  selectTool.click();
}

// Handle object selection
function handleSelection(event) {
  const activeObject = fabricCanvas.getActiveObject();
  
  if (activeObject && activeObject.type === 'textbox') {
    // Abilita controlli testo
    textProperties.style.display = 'flex'; // Mantieni visibile
    deleteBtn.style.display = 'flex'; // Mantieni visibile
    
    // Leggi e imposta i valori correnti
    fontFamily.value = activeObject.fontFamily || 'Arial';
    fontSize.value = activeObject.fontSize || 16;
    fontColor.value = activeObject.fill || '#000000';
    
    // Aggiorna gli stili (bold, italic, underline)
    boldBtn.classList.toggle('active', activeObject.fontWeight === 'bold');
    italicBtn.classList.toggle('active', activeObject.fontStyle === 'italic');
    underlineBtn.classList.toggle('active', activeObject.underline);

    // Abilita input
    const inputs = textProperties.querySelectorAll('input, select, button');
    inputs.forEach(input => input.disabled = false);

    // Abilita pulsante elimina
    deleteBtn.disabled = false;
  } else if (activeObject && activeObject.type === 'image') {
    // Disabilita controlli testo
    const inputs = textProperties.querySelectorAll('input, select, button');
    inputs.forEach(input => input.disabled = true); // Assicurati che sia true
    
    // Abilita pulsante elimina
    deleteBtn.disabled = false;
  } else {
    // Niente selezionato: disabilita tutto
    const inputs = textProperties.querySelectorAll('input, select, button');
    inputs.forEach(input => input.disabled = true);
    
    //Disabilita pulsante elimina
    deleteBtn.disabled = true;
  }
  
  // Gestione pulsanti copia/taglia
  if (activeObject) {
    copyBtn.disabled = false;
    cutBtn.disabled = false;
  } else {
    copyBtn.disabled = true;
    cutBtn.disabled = true;
  }
}

function handleSelectionCleared() {
  // Mantieni elementi visibili ma disabilitati
  textProperties.style.display = 'flex';
  deleteBtn.style.display = 'flex';
  
  const inputs = textProperties.querySelectorAll('input, select, button');
  inputs.forEach(input => input.disabled = true);
  
  deleteBtn.disabled = true;
  
  // Disabilita pulsanti copia/taglia
  if (copyBtn) copyBtn.disabled = true;
  if (cutBtn) cutBtn.disabled = true;
}

function handleObjectModified(e) {
  const obj = e.target;
  const original = e.transform?.original;
  if (!original) return;
  pushAction({
    type: 'modify',
    object: obj,
    prev: { left: original.left, top: original.top, scaleX: original.scaleX, scaleY: original.scaleY, angle: original.angle },
    next: { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle }
  });
}

function handleEditingEntered(e) {
  const obj = e.target;
  if (obj.type !== 'textbox') return;
  undoTextState = {
    text: obj.text,
    fontFamily: obj.fontFamily,
    fontSize: obj.fontSize,
    fill: obj.fill,
    fontWeight: obj.fontWeight,
    fontStyle: obj.fontStyle,
    underline: obj.underline
  };
  updateHistoryControls();
}

function handleEditingExited(e) {
  if (!undoTextState) return;
  const obj = e.target;
  if (obj.type !== 'textbox') return;
  const next = {
    text: obj.text,
    fontFamily: obj.fontFamily,
    fontSize: obj.fontSize,
    fill: obj.fill,
    fontWeight: obj.fontWeight,
    fontStyle: obj.fontStyle,
    underline: obj.underline
  };
  if (JSON.stringify(undoTextState) !== JSON.stringify(next)) {
    pushAction({ type: 'modify', object: obj, prev: undoTextState, next: next });
  }
  undoTextState = null;
  updateHistoryControls();
}

// Cancella l'oggetto selezionato
function deleteSelectedObject() {
  if (!fabricCanvas) return;
  
  const activeObject = fabricCanvas.getActiveObject();
  if (activeObject) {
    pushAction({ type: 'delete', object: activeObject });
    fabricCanvas.remove(activeObject);
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    handleSelectionCleared();
    showToast('Oggetto eliminato', 'success');
  }
}

function updatePagination() {
  pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
}

async function exportPDF(filename) {
  try {
    if (!pdfDoc || !pdfBytes?.length) throw new Error('Ricarica un PDF valido.');
    showToast('Generazione PDF in corso...', 'info');
    saveCurrentPageAnnotations();
    const document = await PDFLib.PDFDocument.load(new Uint8Array(pdfBytes), {
      updateMetadata: false
    });
    for (let pageNum = 1; pageNum <= document.getPageCount(); pageNum++) {
      if (!pageOverlays[pageNum]) continue;
      await exportPageOverlay(document, pageNum);
    }
    downloadPDF(await document.save(), filename);
    showToast('PDF esportato con successo!', 'success');
  } catch (error) {
    console.error('Export PDF error:', error);
    showToast('Errore durante l\'esportazione: ' + error.message, 'error');
  }
}

async function exportPageOverlay(document, pageNum) {
  const sourcePage = await pdfDoc.getPage(pageNum);
  const viewport = sourcePage.getViewport({ scale: 1 });
  const image = await document.embedPng(pageOverlays[pageNum]);
  const page = document.getPage(pageNum - 1);
  const origin = viewport.convertToPdfPoint(0, viewport.height);
  const right = viewport.convertToPdfPoint(viewport.width, viewport.height);
  const top = viewport.convertToPdfPoint(0, 0);
  page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.concatTransformationMatrix(
    (right[0] - origin[0]) / viewport.width,
    (right[1] - origin[1]) / viewport.width,
    (top[0] - origin[0]) / viewport.height,
    (top[1] - origin[1]) / viewport.height,
    origin[0], origin[1]
  ));
  page.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  page.pushOperators(PDFLib.popGraphicsState());
}

function downloadPDF(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(function () {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
}

// Gestione scorciatoie da tastiera (Ctrl+C, Ctrl+X, Ctrl+V, Delete)
function handleKeyboardShortcuts(e) {
  if (document.getElementById?.('signatureDrawDialog')?.open) return;
  if (handleZoomShortcut(e)) return;
  const target = e.target;
  if (target && (target.isContentEditable || target.closest?.('input, textarea, select'))) return;
  if (fabricCanvas && fabricCanvas.getActiveObject()?.isEditing) return;

  const actions = {
    c: copySelectedObject, x: cutSelectedObject, v: pasteObject,
    z: undo, y: redo
  };
  const action = actions[e.key.toLowerCase()];
  if ((e.ctrlKey || e.metaKey) && action) {
    e.preventDefault();
    action();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelectedObject();
  }
}

// Copia l'oggetto selezionato
function copySelectedObject() {
  if (!fabricCanvas) return;
  const object = fabricCanvas.getActiveObject();
  if (!object) {
    showToast('Seleziona un oggetto da copiare', 'info');
    return;
  }
  if (object.type === 'textbox') {
    clipboard = {
      type: 'text', text: object.text, left: object.left, top: object.top,
      fontFamily: object.fontFamily, fontSize: object.fontSize, fill: object.fill,
      fontWeight: object.fontWeight, fontStyle: object.fontStyle,
      underline: object.underline, width: object.width,
      scaleX: object.scaleX, scaleY: object.scaleY, angle: object.angle || 0
    };
  } else if (object.type === 'image') {
    clipboard = {
      type: 'image', src: object.getSrc(), left: object.left, top: object.top,
      displayWidth: object.width * object.scaleX,
      displayHeight: object.height * object.scaleY, angle: object.angle || 0
    };
  }
  if (object.type === 'textbox' || object.type === 'image') clipboardScale = renderedScale;
  showToast('Oggetto copiato!', 'success');
}

function cutSelectedObject() {
  if (!fabricCanvas) return;
  if (!fabricCanvas.getActiveObject()) {
    showToast('Seleziona un oggetto da tagliare', 'info');
    return;
  }
  copySelectedObject();
  deleteSelectedObject();
  showToast('Oggetto tagliato!', 'success');
}

async function pasteObject() {
  if (!fabricCanvas) return;
  if (!clipboard) {
    showToast('Nessun oggetto da incollare', 'info');
    return;
  }
  const source = clipboard;
  const ratio = renderedScale / clipboardScale;
  const annotation = {
    ...source, left: (source.left ?? 100) + 20 / ratio, top: (source.top ?? 100) + 20 / ratio
  };
  const object = await createAnnotationObject(annotation, ratio);
  fabricCanvas.add(object);
  pushAction({ type: 'add', object: object });
  fabricCanvas.setActiveObject(object);
  fabricCanvas.renderAll();
  source.left = annotation.left;
  source.top = annotation.top;
  showToast('Oggetto incollato!', 'success');
}
// Setup signature tool listeners
function setupSignatureListeners() {
  signatureTool.addEventListener('click', () => {
    signaturePanel.style.display = signaturePanel.style.display === 'none' ? 'block' : 'none';
    if (signaturePanel.style.display === 'block') {
      loadSignaturesList();
    }
  });

  closeSignaturePanel.addEventListener('click', () => {
    signaturePanel.style.display = 'none';
  });

  addSignatureBtn.addEventListener('click', () => {
    signatureFileInput.click();
  });

  signatureFileInput.addEventListener('change', handleSignatureUpload);
}

function setupSignatureDrawing() {
  signatureDrawing = document.getElementById('signatureDrawing');
  document.getElementById('drawSignatureBtn').addEventListener('click', function () {
    signaturePanel.style.display = 'none';
    clearSignatureDrawing();
    document.getElementById('signatureDrawDialog').showModal();
  });
  document.getElementById('clearSignatureDrawing').addEventListener('click', clearSignatureDrawing);
  document.getElementById('cancelSignatureDrawing').addEventListener('click', function () {
    document.getElementById('signatureDrawDialog').close();
  });
  document.getElementById('saveSignatureDrawing').addEventListener('click', saveDrawnSignature);
  signatureDrawing.addEventListener('pointerdown', startSignatureStroke);
  signatureDrawing.addEventListener('pointermove', continueSignatureStroke);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    signatureDrawing.addEventListener(event, function () { signatureStroke = null; });
  }
}

function clearSignatureDrawing() {
  signatureDrawing.getContext('2d').clearRect(0, 0, signatureDrawing.width, signatureDrawing.height);
  signatureStroke = null;
  signatureHasInk = false;
  document.getElementById('saveSignatureDrawing').disabled = true;
}

function getSignaturePoint(event) {
  const bounds = signatureDrawing.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * signatureDrawing.width / bounds.width,
    y: (event.clientY - bounds.top) * signatureDrawing.height / bounds.height,
    pointerId: event.pointerId
  };
}

function startSignatureStroke(event) {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  signatureDrawing.setPointerCapture(event.pointerId);
  signatureStroke = getSignaturePoint(event);
  const context = signatureDrawing.getContext('2d');
  context.beginPath();
  context.fillStyle = '#000000';
  context.arc(signatureStroke.x, signatureStroke.y, 1.5, 0, Math.PI * 2);
  context.fill();
  signatureHasInk = true;
  document.getElementById('saveSignatureDrawing').disabled = false;
}

function continueSignatureStroke(event) {
  if (!signatureStroke || signatureStroke.pointerId !== event.pointerId) return;
  event.preventDefault();
  const point = getSignaturePoint(event);
  const context = signatureDrawing.getContext('2d');
  context.beginPath();
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.strokeStyle = '#000000';
  context.moveTo(signatureStroke.x, signatureStroke.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  signatureStroke = point;
}

function saveDrawnSignature() {
  if (!signatureHasInk) return;
  try {
    saveSignature('Firma disegnata', signatureDrawing.toDataURL('image/png'));
    loadSignaturesList();
    document.getElementById('signatureDrawDialog').close();
    signaturePanel.style.display = 'block';
    showToast('Firma salvata!', 'success');
  } catch (error) {
    showToast('Impossibile salvare la firma: ' + error.message, 'error');
  }
}

async function handleSignatureUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('File troppo grande (max 5MB)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    saveSignature(file.name, e.target.result);
    loadSignaturesList();
    showToast('Firma salvata!', 'success');
  };
  reader.readAsDataURL(file);
}

function saveSignature(name, data) {
  const signatures = getSignatures();
  const signature = {
    id: Date.now().toString(),
    name: name,
    data: data,
    size: data.length,
    createdAt: new Date().toISOString()
  };
  signatures.push(signature);
  localStorage.setItem('pdf_signatures', JSON.stringify(signatures));
}

function getSignatures() {
  const stored = localStorage.getItem('pdf_signatures');
  return stored ? JSON.parse(stored) : [];
}

function loadSignaturesList() {
  const signatures = getSignatures();
  signatureList.innerHTML = '';
  if (signatures.length === 0) {
    signatureList.textContent = 'Nessuna firma salvata';
    return;
  }
  for (const signature of signatures) {
    signatureList.appendChild(createSignatureItem(signature));
  }
}

function createSignatureItem(signature) {
  const item = document.createElement('div');
  item.className = 'signature-item';
  const image = document.createElement('img');
  image.src = signature.data;
  image.alt = signature.name;
  const name = document.createElement('span');
  name.textContent = signature.name;
  const button = document.createElement('button');
  button.className = 'delete-sig';
  button.dataset.id = signature.id;
  button.textContent = '🗑️';
  item.append(image, name, button);
  item.addEventListener('click', function () {
    insertSignatureOnCanvas(signature.data);
    signaturePanel.style.display = 'none';
  });
  button.addEventListener('click', function (event) {
    event.stopPropagation();
    deleteSignature(signature.id);
    loadSignaturesList();
  });
  return item;
}

function insertSignatureOnCanvas(dataUrl) {
  fabric.Image.fromURL(dataUrl, (img) => {
    img.scale(0.3);
    img.set({
      left: 100,
      top: 100
    });
    fabricCanvas.add(img);
    pushAction({ type: 'add', object: img });
    fabricCanvas.setActiveObject(img);
    fabricCanvas.renderAll();
  });
}

function deleteSignature(id) {
  let signatures = getSignatures();
  signatures = signatures.filter(sig => sig.id !== id);
  localStorage.setItem('pdf_signatures', JSON.stringify(signatures));
  showToast('Firma eliminata', 'success');
}

// Fixed PDF export with proper buffer copy

// ============================================
// DARK MODE TOGGLE FUNCTIONALITY
// ============================================

function setupDarkModeToggle() {
  const darkToggleFloating = document.getElementById('darkModeToggle');
  
  // Load saved preference or use system preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-color-scheme', 'dark');
    updateDarkModeIcons(true);
  } else {
    document.documentElement.setAttribute('data-color-scheme', 'light');
    updateDarkModeIcons(false);
  }
  
  // Add event listener to floating toggle button
  if (darkToggleFloating) {
    darkToggleFloating.addEventListener('click', toggleDarkMode);
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-color-scheme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-color-scheme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateDarkModeIcons(!isDark);
}

function updateDarkModeIcons(isDark) {
  const sunIcons = document.querySelectorAll('.icon-sun');
  const moonIcons = document.querySelectorAll('.icon-moon');
  
  sunIcons.forEach(icon => {
    icon.style.display = isDark ? 'none' : 'block';
  });
  
  moonIcons.forEach(icon => {
    icon.style.display = isDark ? 'block' : 'none';
  });
}

// Initialize dark mode on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupDarkModeToggle);
} else {
  setupDarkModeToggle();
}
