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
let originalPdfBytes = null;

// DOM elements - declared but not initialized yet
let uploadArea, pdfFileInput, toolbar, canvasContainer, pdfCanvas, fabricCanvasEl;
let pagination, pageInfo, prevPageBtn, nextPageBtn;
let textProperties, deleteSection, imageFileInput;
let selectTool, textTool, imageTool, exportBtn, deleteBtn;
let fontFamily, fontSize, fontColor, boldBtn, italicBtn, underlineBtn;
let uploadBtnMain, pdfFileInputMain, uploadBtn;

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
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
  setupTextListeners();
  setupPaginationListeners();
  
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
  
  deleteBtn.addEventListener('click', () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      fabricCanvas.remove(activeObject);
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
    }
  });
  
  exportBtn.addEventListener('click', async function() {
    console.log('Export button clicked');
    await exportPDF();
  });
}

// Setup text property listeners
function setupTextListeners() {
  fontFamily.addEventListener('change', () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set('fontFamily', fontFamily.value);
      fabricCanvas.renderAll();
    }
  });
  
  fontSize.addEventListener('input', () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set('fontSize', parseInt(fontSize.value));
      fabricCanvas.renderAll();
    }
  });
  
  fontColor.addEventListener('input', () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set('fill', fontColor.value);
      fabricCanvas.renderAll();
    }
  });
  
  boldBtn.addEventListener('click', () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      const isBold = activeObject.fontWeight === 'bold';
      activeObject.set('fontWeight', isBold ? 'normal' : 'bold');
      boldBtn.classList.toggle('active');
      fabricCanvas.renderAll();
    }
  });
  
  italicBtn.addEventListener('click', () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      const isItalic = activeObject.fontStyle === 'italic';
      activeObject.set('fontStyle', isItalic ? 'normal' : 'italic');
      italicBtn.classList.toggle('active');
      fabricCanvas.renderAll();
    }
  });
  
  underlineBtn.addEventListener('click', () => {
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
      currentPage--;
      renderPage(currentPage);
      updatePagination();
    }
  });
  
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      savePageAnnotations();
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
  
  console.log('Loading dropped file:', file.name, file.type);
  await loadPDFFile(file);
}

// Load and render PDF from file
async function loadPDFFile(file) {
  try {
    console.log('Loading PDF:', file.name);
    showToast('Caricamento PDF in corso...', 'info');
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('ArrayBuffer length:', arrayBuffer.byteLength);
    
    // Convert to Uint8Array e SALVA in pdfBytes e originalPdfBytes
    pdfBytes = new Uint8Array(arrayBuffer);
    originalPdfBytes = new Uint8Array(pdfBytes); // Riferimento allo stesso array
    console.log('pdfBytes length:', pdfBytes.length);
    console.log('pdfBytes first 10 bytes:', Array.from(pdfBytes.slice(0, 10)));
    
    // Verifica header
    const header = String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3]);
    console.log('PDF header:', header);
    
    if (header !== '%PDF') {
      throw new Error('File non è un PDF valido (header: ' + header + ')');
    }
    
    // Load with PDF.js
    console.log('Loading with PDF.js...');
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    currentPage = 1;
    
    console.log('PDF loaded successfully:', totalPages, 'pages');
    
    // Initialize page annotations storage
    pageAnnotations = {};
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
    showToast('PDF caricato con successo!', 'success');
  } catch (error) {
    console.error('Error loading PDF:', error);
    showToast('Errore nel caricamento del PDF: ' + error.message, 'error');
    // Reset
    pdfBytes = null;
    originalPdfBytes = null;
    pdfDoc = null;
  }
}

// Render PDF page
async function renderPage(pageNum) {
  // Responsività: determina larghezza massima canvas-container
  let containerMaxWidth = 900;
  if (window.innerWidth < 480) containerMaxWidth = window.innerWidth * 0.98;
  else if (window.innerWidth < 768) containerMaxWidth = window.innerWidth * 0.95;
  else if (window.innerWidth < 1024) containerMaxWidth = window.innerWidth * 0.9;
  else containerMaxWidth = 900;

  try {
    const page = await pdfDoc.getPage(pageNum);
    const unscaledV = page.getViewport({ scale: 1 });
    const aspect = unscaledV.width / unscaledV.height;
    let scale = 1.5;
    let width = unscaledV.width * scale;
    let height = unscaledV.height * scale;
    
    if (width > containerMaxWidth) {
      scale = containerMaxWidth / unscaledV.width;
      width = containerMaxWidth;
      height = width / aspect;
    }
    
    const viewport = page.getViewport({ scale });
    
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfCanvas.style.width = width + 'px';
    pdfCanvas.style.height = height + 'px';
    
    fabricCanvasEl.width = viewport.width;
    fabricCanvasEl.height = viewport.height;
    fabricCanvasEl.style.width = width + 'px';
    fabricCanvasEl.style.height = height + 'px';

    const wrapper = document.querySelector('.canvas-wrapper');
    wrapper.style.aspectRatio = (viewport.width / viewport.height).toFixed(6);
    wrapper.style.width = width + 'px';
    wrapper.style.height = height + 'px';

    const ctx = pdfCanvas.getContext('2d');
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    if (!fabricCanvas) {
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
    } else {
      fabricCanvas.setWidth(viewport.width);
      fabricCanvas.setHeight(viewport.height);
      fabricCanvas.calcOffset();
    }
    
    loadPageAnnotations(pageNum);
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
      return {
        type: 'image',
        src: obj.toDataURL(),
        left: obj.left,
        top: obj.top,
        width: obj.width,
        height: obj.height,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle
      };
    }
    return null;
  }).filter(Boolean);
  
  pageAnnotations[currentPage] = annotations;
}

// Load annotations for current page
function loadPageAnnotations(pageNum) {
  fabricCanvas.clear();
  
  const annotations = pageAnnotations[pageNum] || [];
  
  annotations.forEach(annotation => {
    if (annotation.type === 'text') {
      const textbox = new fabric.Textbox(annotation.text, {
        left: annotation.left,
        top: annotation.top,
        fontFamily: annotation.fontFamily,
        fontSize: annotation.fontSize,
        fill: annotation.fill,
        fontWeight: annotation.fontWeight,
        fontStyle: annotation.fontStyle,
        underline: annotation.underline,
        width: annotation.width,
        scaleX: annotation.scaleX || 1,
        scaleY: annotation.scaleY || 1,
        angle: annotation.angle || 0
      });
      fabricCanvas.add(textbox);
    } else if (annotation.type === 'image') {
      fabric.Image.fromURL(annotation.src, (img) => {
        img.set({
          left: annotation.left,
          top: annotation.top,
          scaleX: annotation.scaleX,
          scaleY: annotation.scaleY,
          angle: annotation.angle || 0
        });
        fabricCanvas.add(img);
      });
    }
  });
  fabricCanvas.renderAll();
}



function updateToolButtons() {
  // Resetta tutti i tool buttons (nessuna classe tool-btn, sono .btn ora)
  selectTool.classList.remove('active');
  textTool.classList.remove('active');
  imageTool.classList.remove('active');
  if (currentTool === 'select') selectTool.classList.add('active');
  if (currentTool === 'text') textTool.classList.add('active');
}

// Canvas click handler
function handleCanvasClick(event) {
  if (currentTool === 'text' && !event.target) {
    const pointer = fabricCanvas.getPointer(event.e);
    const textbox = new fabric.Textbox('Digita qui...', {
      left: pointer.x,
      top: pointer.y,
      fontFamily: 'Arial',
      fontSize: 16,
      fill: '#000000',
      width: 200,
      editable: true
    });
    fabricCanvas.add(textbox);
    fabricCanvas.setActiveObject(textbox);
    textbox.enterEditing();
    textbox.selectAll();
    
    // Switch back to select tool
    currentTool = 'select';
    updateToolButtons();
    fabricCanvas.selection = true;
    fabricCanvas.defaultCursor = 'default';
  }
}

// Handle object selection
function handleSelection(event) {
  const activeObject = fabricCanvas.getActiveObject();
  
  if (activeObject && activeObject.type === 'textbox') {
    textProperties.style.display = 'flex';
    deleteBtn.style.display = 'flex';
    
    // Update controls
    fontFamily.value = activeObject.fontFamily;
    fontSize.value = activeObject.fontSize;
    fontColor.value = activeObject.fill;
    
    boldBtn.classList.toggle('active', activeObject.fontWeight === 'bold');
    italicBtn.classList.toggle('active', activeObject.fontStyle === 'italic');
    underlineBtn.classList.toggle('active', activeObject.underline);
  } else if (activeObject && activeObject.type === 'image') {
    textProperties.style.display = 'none';
    deleteBtn.style.display = 'flex';
  } else {
    textProperties.style.display = 'none';
    deleteBtn.style.display = 'none';
  }
}

function handleSelectionCleared() {
  textProperties.style.display = 'none';
  deleteBtn.style.display = 'none';
}



function updatePagination() {
  pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
}



async function exportPDF() {
  try {
    console.log('Starting PDF export...');
    
    // VERIFICA CHE pdfBytes ESISTA E SIA VALIDO
    if (!pdfBytes) {
      throw new Error('Nessun PDF caricato');
    }
    
    if (!(pdfBytes instanceof Uint8Array)) {
      console.warn('pdfBytes non è Uint8Array, conversione...');
      pdfBytes = new Uint8Array(pdfBytes);
    }
    
    if (pdfBytes.length < 5) {
      throw new Error('PDF troppo piccolo per essere valido');
    }
    
    // Verifica header
    const header = String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3]);
    console.log('PDF header check:', header);
    
    if (header !== '%PDF') {
      throw new Error('File PDF non valido (header: ' + header + ')');
    }
    
    console.log('pdfBytes valid, length:', pdfBytes.length);
    showToast('Generazione PDF in corso...', 'info');
    
    // Save current page annotations BEFORE export
    saveCurrentPageAnnotations();
    
    // Load original PDF with pdf-lib
    console.log('Loading PDF with pdf-lib...');
    const pdfLibDoc = await PDFLib.PDFDocument.load(originalPdfBytes, { 
      ignoreEncryption: true,
      updateMetadata: false 
    });
    
    console.log('PDF loaded in pdf-lib, pages:', pdfLibDoc.getPageCount());
    
    const scale = 1.5;
    const pageCount = pdfLibDoc.getPageCount();
    
    // Process each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = pdfLibDoc.getPage(pageNum - 1);
      const { width, height } = page.getSize();
      const annotations = pageAnnotations[pageNum] || [];
      
      console.log(`Processing page ${pageNum}, annotations:`, annotations.length);
      
      if (annotations.length === 0) continue;
      
      for (const annotation of annotations) {
        try {
          if (annotation.type === 'text' && annotation.text) {
            // Text annotation
            console.log('Adding text:', annotation.text.substring(0, 20));
            
            const pdfX = annotation.left / scale;
            const pdfY = height - (annotation.top / scale) - (annotation.fontSize / scale);
            
            let font;
            const fontName = annotation.fontFamily || 'Helvetica';
            
            try {
              if (fontName.toLowerCase().includes('courier')) {
                font = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Courier);
              } else if (fontName.toLowerCase().includes('times')) {
                font = await pdfLibDoc.embedFont(PDFLib.StandardFonts.TimesRoman);
              } else if (fontName.toLowerCase().includes('verdana')) {
                font = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Helvetica);
              } else {
                font = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Helvetica);
              }
            } catch (fontError) {
              console.warn('Font error, using Helvetica:', fontError);
              font = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            }
            
            const color = hexToRgb(annotation.fill || '#000000');
            const fontSize = (annotation.fontSize || 16) / scale;
            
            page.drawText(annotation.text, {
              x: pdfX,
              y: pdfY,
              size: fontSize,
              font: font,
              color: PDFLib.rgb(color.r / 255, color.g / 255, color.b / 255)
            });
            
          } else if (annotation.type === 'image' && annotation.src) {
            // Image annotation
            console.log('Adding image');
            
            try {
              // Extract base64 from data URL
              let base64Data;
              if (annotation.src.includes(',')) {
                base64Data = annotation.src.split(',')[1];
              } else {
                base64Data = annotation.src;
              }
              
              // Convert base64 to bytes
              const binaryString = atob(base64Data);
              const imageBytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                imageBytes[i] = binaryString.charCodeAt(i);
              }
              
              // Determine image type
              const isPNG = annotation.src.includes('image/png') || 
                           binaryString.charCodeAt(0) === 137; // PNG magic number
              
              let image;
              try {
                if (isPNG) {
                  image = await pdfLibDoc.embedPng(imageBytes);
                } else {
                  image = await pdfLibDoc.embedJpg(imageBytes);
                }
              } catch (embedError) {
                console.warn('Trying JPG format:', embedError);
                image = await pdfLibDoc.embedJpg(imageBytes);
              }
              
              const imgWidth = (annotation.width * annotation.scaleX) / scale;
              const imgHeight = (annotation.height * annotation.scaleY) / scale;
              const pdfX = annotation.left / scale;
              const pdfY = height - (annotation.top / scale) - imgHeight;
              
              page.drawImage(image, {
                x: pdfX,
                y: pdfY,
                width: imgWidth,
                height: imgHeight
              });
            } catch (imageError) {
              console.error('Error adding image:', imageError);
              // Continue without this image
            }
          }
        } catch (annotationError) {
          console.error('Error processing annotation:', annotationError);
          // Continue with next annotation
        }
      }
    }
    
    // Save and download
    console.log('Saving modified PDF...');
    const pdfBytesModified = await pdfLibDoc.save();
    
    // Create blob and download
    const blob = new Blob([pdfBytesModified], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'documento_modificato.pdf';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('PDF exported successfully!');
    showToast('PDF esportato con successo!', 'success');
    
  } catch (error) {
    console.error('Export PDF error:', error);
    showToast('Errore durante l\'esportazione: ' + error.message, 'error');
  }
}

// Utility function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}
