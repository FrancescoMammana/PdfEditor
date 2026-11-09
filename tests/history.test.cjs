const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function createEditor() {
  const editor = vm.createContext({
    console,
    pdfjsLib: { GlobalWorkerOptions: {} },
    document: { readyState: 'loading', addEventListener() {} }
  });
  vm.runInContext(readFileSync(`${__dirname}/../app.js`, 'utf8'), editor);
  return editor;
}

test('text modifications without a Fabric transform do not throw', function () {
  const editor = createEditor();
  editor.handleObjectModified({ target: { type: 'textbox' } });
  assert.equal(vm.runInContext('undoStack.length', editor), 0);
});

test('text editing records both the previous and next text', function () {
  const editor = createEditor();
  editor.handleEditingEntered({ target: { type: 'textbox', text: 'Prima' } });
  editor.handleEditingExited({ target: { type: 'textbox', text: 'Dopo' } });
  assert.equal(vm.runInContext('undoStack[0].prev.text', editor), 'Prima');
  assert.equal(vm.runInContext('undoStack[0].next.text', editor), 'Dopo');
});

test('resetting history clears undo, redo and the pending text edit', function () {
  const editor = createEditor();
  vm.runInContext('undoStack = [{}]; redoStack = [{}]; undoTextState = {};', editor);
  editor.resetHistory();
  assert.equal(vm.runInContext('undoStack.length + redoStack.length', editor), 0);
  assert.equal(vm.runInContext('undoTextState', editor), null);
});
