const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function createEditor() {
  const context = vm.createContext({
    console,
    pdfjsLib: { GlobalWorkerOptions: {} },
    document: { readyState: 'loading', addEventListener() {} }
  });
  vm.runInContext(readFileSync(`${__dirname}/../app.js`, 'utf8'), context);
  return context;
}

for (const modifier of ['ctrlKey', 'metaKey']) {
  for (const [key, action] of Object.entries({
    c: 'copySelectedObject', x: 'cutSelectedObject', v: 'pasteObject',
    z: 'undo', y: 'redo'
  })) {
    for (const letter of [key, key.toUpperCase()]) {
      test(`${modifier} + ${letter} invokes ${action}`, function () {
        const editor = createEditor();
        let calls = 0;
        let prevented = false;
        editor[action] = function () { calls++; };
        editor.handleKeyboardShortcuts({
          key: letter, [modifier]: true,
          preventDefault() { prevented = true; }
        });
        assert.equal(calls, 1);
        assert.equal(prevented, true);
      });
    }
  }
}

for (const target of [
  { closest() { return { tagName: 'INPUT' }; } },
  { closest() { return { tagName: 'TEXTAREA' }; } },
  { closest() { return { tagName: 'SELECT' }; } },
  { isContentEditable: true }
]) {
  for (const key of ['c', 'C', 'x', 'v', 'z', 'y', 'Backspace', 'Delete']) {
    test(`preserves native ${key} in an editable control`, function () {
      const editor = createEditor();
      const unexpected = function () { assert.fail('Editor shortcut intercepted input'); };
      for (const action of ['copySelectedObject', 'cutSelectedObject', 'pasteObject',
        'undo', 'redo', 'deleteSelectedObject']) editor[action] = unexpected;
      editor.handleKeyboardShortcuts({ key, ctrlKey: true, target, preventDefault: unexpected });
    });
  }
}

test('preserves native shortcuts while a Fabric textbox is being edited', function () {
  const editor = createEditor();
  vm.runInContext('fabricCanvas = { getActiveObject() { return { isEditing: true }; } };', editor);
  editor.handleKeyboardShortcuts({
    key: 'v', ctrlKey: true,
    preventDefault() { assert.fail('Native text paste was intercepted'); }
  });
});
