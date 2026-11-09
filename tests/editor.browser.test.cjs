const assert = require('node:assert/strict');
const { test, before, after, beforeEach, afterEach } = require('node:test');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
let browser, server, page, baseURL;

async function serveApplication(request, response) {
  let file = new URL(request.url, 'http://localhost').pathname;
  if (file === '/') file = '/index.html';
  if (!['/index.html', '/app.js', '/style.css'].includes(file)) {
    response.writeHead(404).end();
    return;
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  response.setHeader('Content-Type', types[path.extname(file)]);
  response.end(await readFile(path.join(__dirname, '..', file)));
}

before(async function () {
  server = createServer(serveApplication);
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
});

after(async function () {
  if (browser) await browser.close();
  if (server) await new Promise(function (resolve) { server.close(resolve); });
});

beforeEach(async function () {
  page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  if (process.env.PDFEDITOR_TEST_LIBS) {
    await page.route('https://cdn.jsdelivr.net/**', async function (route) {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      await route.fulfill({ path: path.join(process.env.PDFEDITOR_TEST_LIBS, name),
        contentType: 'text/javascript' });
    });
  }
  await page.goto(baseURL);
  await page.evaluate(async function () {
    const doc = await PDFLib.PDFDocument.create();
    doc.addPage([600, 800]);
    doc.addPage([600, 800]);
    await loadPDFFile(new File([await doc.save()], 'test.pdf', { type: 'application/pdf' }));
  });
});

afterEach(async function () { if (page) await page.close(); });

async function addText() {
  await page.evaluate(function () {
    const text = new fabric.Textbox('Testo', { left: 60, top: 90, fontSize: 24, width: 120 });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    pushAction({ type: 'add', object: text });
  });
}

async function getGeometry() {
  return await page.evaluate(function () {
    const object = fabricCanvas.getObjects()[0];
    const wrapper = document.querySelector('.canvas-wrapper').getBoundingClientRect();
    const upper = fabricCanvas.upperCanvasEl.getBoundingClientRect();
    return { left: object.left / renderedScale, top: object.top / renderedScale,
      width: object.width * object.scaleX / renderedScale,
      height: object.height * object.scaleY / renderedScale,
      wrapperWidth: wrapper.width, upperWidth: upper.width };
  });
}

function assertAnnotationGeometry(before, after) {
  for (const key of ['left', 'top', 'width', 'height']) {
    assert.ok(Math.abs(before[key] - after[key]) < 0.01, `${key} changed after zoom`);
  }
  assert.ok(Math.abs(after.wrapperWidth - after.upperWidth) < 1);
}

test('PDF rendering disables eval', async function () {
  assert.equal(await page.evaluate(function () { return pdfDoc._transport._params.isEvalSupported; }), false);
});

test('uppercase copy/paste and cut both support undo and redo', async function () {
  await addText();
  await page.keyboard.press('Control+Shift+C');
  await page.keyboard.press('Control+Shift+V');
  await page.waitForFunction(function () { return fabricCanvas.getObjects().length === 2; });
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(function () { return fabricCanvas.getObjects().length; }), 1);
  await page.keyboard.press('Control+y');
  assert.equal(await page.evaluate(function () { return fabricCanvas.getObjects().length; }), 2);
  await page.evaluate(function () { fabricCanvas.setActiveObject(fabricCanvas.getObjects()[1]); });
  await page.keyboard.press('Control+x');
  assert.equal(await page.evaluate(function () { return fabricCanvas.getObjects().length; }), 1);
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(function () { return fabricCanvas.getObjects().length; }), 2);
});

test('pasted rotated images retain their source, dimensions and undo history', async function () {
  const result = await page.evaluate(async function () {
    const source = document.createElement('canvas');
    source.width = 80;
    source.height = 20;
    source.getContext('2d').fillRect(0, 0, 80, 20);
    const image = await new Promise(function (resolve) { fabric.Image.fromURL(source.toDataURL(), resolve); });
    image.set({ left: 40, top: 80, angle: 45, scaleX: 1.3, scaleY: 0.7 });
    fabricCanvas.add(image);
    fabricCanvas.setActiveObject(image);
    copySelectedObject();
    await pasteObject();
    const pasted = fabricCanvas.getActiveObject();
    const geometry = [pasted.width, pasted.height, pasted.scaleX, pasted.scaleY, pasted.angle];
    const sameSource = pasted.getSrc() === image.getSrc();
    undo();
    const remaining = fabricCanvas.getObjects().length;
    redo();
    return { geometry, sameSource, remaining, restored: fabricCanvas.getObjects().length };
  });
  assert.deepEqual(result, { geometry: [80, 20, 1.3, 0.7, 45], sameSource: true, remaining: 1, restored: 2 });
});

test('signature names are literal text and their delete button does not insert a signature', async function () {
  const result = await page.evaluate(async function () {
    const source = document.createElement('canvas');
    const name = 'firma<img src=x onerror=window.injected=true>.png';
    saveSignature(name, source.toDataURL());
    loadSignaturesList();
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
    const item = signatureList.firstElementChild;
    const result = { name: item.querySelector('span').textContent,
      images: item.querySelectorAll('img').length, executed: window.injected === true };
    item.querySelector('button').click();
    return { ...result, remaining: getSignatures().length, objects: fabricCanvas.getObjects().length };
  });
  assert.equal(result.name, 'firma<img src=x onerror=window.injected=true>.png');
  assert.deepEqual([result.images, result.executed, result.remaining, result.objects], [1, false, 0, 0]);
});

test('zoom buttons and Ctrl/Cmd shortcuts resize both layers and preserve annotations', async function () {
  await addText();
  const geometry = await getGeometry();
  await page.click('#zoomIn');
  await page.waitForFunction(function () { return !zoomRendering && zoomPercent === 125; });
  assertAnnotationGeometry(geometry, await getGeometry());
  assert.equal(await page.textContent('#zoomLevel'), '125%');
  await page.keyboard.press('Control+Shift+Equal');
  await page.waitForFunction(function () { return !zoomRendering && zoomPercent === 150; });
  await page.keyboard.press('Control+Minus');
  await page.waitForFunction(function () { return !zoomRendering && zoomPercent === 125; });
  await page.keyboard.press('Meta+Equal');
  await page.waitForFunction(function () { return !zoomRendering && zoomPercent === 150; });
  await page.click('#zoomOut');
  await page.waitForFunction(function () { return !zoomRendering && zoomPercent === 125; });
  assertAnnotationGeometry(geometry, await getGeometry());
  assert.ok(Math.abs((await getGeometry()).wrapperWidth / geometry.wrapperWidth - 1.25) < 0.01);
});

test('Ctrl+ zoom commits an edited textbox and preserves its text', async function () {
  await addText();
  await page.evaluate(function () {
    const text = fabricCanvas.getActiveObject();
    text.enterEditing();
    text.selectAll();
  });
  await page.keyboard.type('Testo aggiornato');
  await page.keyboard.press('Control+Equal');
  await page.waitForFunction(function () { return !zoomRendering && zoomPercent === 125; });
  assert.equal(await page.evaluate(function () { return fabricCanvas.getObjects()[0].text; }), 'Testo aggiornato');
});

test('zoom preserves undo/redo for pasted and deleted objects', async function () {
  await addText();
  const geometry = await getGeometry();
  await page.evaluate(async function () {
    copySelectedObject();
    await pasteObject();
    undo();
    await changeZoom(25);
    redo();
  });
  assert.equal(await page.evaluate(function () { return fabricCanvas.getObjects().length; }), 2);
  await page.evaluate(async function () {
    fabricCanvas.setActiveObject(fabricCanvas.getObjects()[1]);
    cutSelectedObject();
    await changeZoom(25);
    undo();
  });
  assert.equal(await page.evaluate(function () { return fabricCanvas.getObjects().length; }), 2);
  assertAnnotationGeometry(geometry, await getGeometry());
});

test('zoom rescales both states of an undoable object movement', async function () {
  await addText();
  await page.evaluate(async function () {
    const object = fabricCanvas.getObjects()[0];
    const original = { left: object.left, top: object.top, scaleX: object.scaleX,
      scaleY: object.scaleY, angle: object.angle };
    object.set({ left: 150, top: 240 });
    handleObjectModified({ target: object, transform: { original } });
    await changeZoom(100);
    undo();
  });
  let position = await getGeometry();
  assert.equal(position.left, 40);
  assert.equal(position.top, 60);
  await page.evaluate(function () { redo(); });
  position = await getGeometry();
  assert.equal(position.left, 100);
  assert.equal(position.top, 160);
});

test('copying before zoom preserves the pasted object size in PDF coordinates', async function () {
  await addText();
  const geometry = await getGeometry();
  const pasted = await page.evaluate(async function () {
    copySelectedObject();
    await changeZoom(100);
    await pasteObject();
    const object = fabricCanvas.getActiveObject();
    return { width: object.width * object.scaleX / renderedScale,
      height: object.height * object.scaleY / renderedScale };
  });
  assert.equal(pasted.width, geometry.width);
  assert.equal(pasted.height, geometry.height);
});

test('zoom limits disable buttons and enlarged pages remain accessible by scrolling', async function () {
  await addText();
  const geometry = await getGeometry();
  await page.evaluate(async function () { await changeZoom(1000); });
  assert.equal(await page.textContent('#zoomLevel'), '300%');
  assert.equal(await page.isDisabled('#zoomIn'), true);
  assertAnnotationGeometry(geometry, await getGeometry());
  const bounds = await page.evaluate(function () {
    const container = canvasContainer.getBoundingClientRect();
    const wrapper = document.querySelector('.canvas-wrapper').getBoundingClientRect();
    return { start: wrapper.left - container.left, overflow: canvasContainer.scrollWidth > canvasContainer.clientWidth };
  });
  assert.ok(bounds.start >= 0);
  assert.equal(bounds.overflow, true);
  await page.evaluate(async function () { await changeZoom(-1000); });
  assert.equal(await page.textContent('#zoomLevel'), '25%');
  assert.equal(await page.isDisabled('#zoomOut'), true);
  assertAnnotationGeometry(geometry, await getGeometry());
});

test('zoom survives page changes and mobile resizing without moving annotations', async function () {
  await addText();
  const geometry = await getGeometry();
  await page.evaluate(async function () { await changeZoom(25); });
  await page.click('#nextPage');
  await page.waitForFunction(function () { return currentPage === 2 && fabricCanvas.getObjects().length === 0; });
  assert.equal(await page.textContent('#zoomLevel'), '125%');
  await page.click('#prevPage');
  await page.waitForFunction(function () { return currentPage === 1 && fabricCanvas.getObjects().length === 1; });
  assertAnnotationGeometry(geometry, await getGeometry());
  await page.setViewportSize({ width: 390, height: 850 });
  await page.waitForFunction(function () { return fabricCanvas.width < 500; });
  assertAnnotationGeometry(geometry, await getGeometry());
});

async function exportInkBounds() {
  return await page.evaluate(async function () {
    let bytes;
    downloadPDF = function (data) { bytes = data; };
    await exportPDF('output.pdf');
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const output = await doc.getPage(1);
    const viewport = output.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    await output.render({ canvasContext: context, viewport: viewport }).promise;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 650) continue;
      const x = (index / 4) % canvas.width, y = Math.floor(index / 4 / canvas.width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return [minX, minY, maxX, maxY];
  });
}

test('exported annotations retain their PDF coordinates at different zoom levels', async function () {
  await addText();
  const initial = await exportInkBounds();
  assert.ok(initial.every(Number.isFinite));
  for (const amount of [100, -175]) {
    await page.evaluate(async function (amount) { await changeZoom(amount); }, amount);
    const actual = await exportInkBounds();
    for (let index = 0; index < initial.length; index++) {
      assert.ok(Math.abs(initial[index] - actual[index]) <= 2, `${initial} vs ${actual}`);
    }
  }
});
