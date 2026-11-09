I test Node non richiedono dipendenze aggiuntive:

```sh
node --test tests/history.test.cjs tests/shortcuts.test.cjs
```

I test del browser richiedono Playwright disponibile per Node e Chromium in
`/usr/bin/chromium`. Non usano un server già avviato: ne creano uno locale
su una porta libera e lo chiudono al termine.

```sh
node --test tests/editor.browser.test.cjs
```

Per eseguirli senza dipendere dall'accesso del browser alla CDN, impostare
`PDFEDITOR_TEST_LIBS` alla directory contenente le copie delle versioni usate
da `index.html`: `pdf.min.js`, `pdf.worker.min.js`, `fabric.min.js` e
`pdf-lib.min.js`. In questo ambiente sono già disponibili:

```sh
PDFEDITOR_TEST_LIBS=/workspace/pdfeditor-review/browser-libs node --test tests/*.test.cjs
```
