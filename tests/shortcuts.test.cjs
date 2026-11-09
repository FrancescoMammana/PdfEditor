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
