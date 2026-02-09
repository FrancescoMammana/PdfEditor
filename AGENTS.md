# REGOLE ASSOLUTE (priorità massima)

1. **CODICE MINIMALE**: Ogni riga deve essere necessaria. Max 30 righe per funzione.
2. **NO FRAMEWORK**: Solo vanilla JS, niente React/Vue/jQuery/TypeScript
3. **NO BUILD TOOLS**: No webpack, babel, npm scripts
4. **FUNZIONI SEMPLICI**: Una funzione = una responsabilità, nomi descrittivi
5. **ASYNC/AWAIT**: Sempre, mai callback annidati
6. **RIUTILIZZO CODICE ESISTENTE**: L'implementazione deve sempre basarsi sull'aggiunta di meno codice possibile, riutilizzando funzioni e pattern già presenti. Evita ripetizioni e duplicazioni. Cerca soluzioni che estendano il codice esistente invece di riscriverlo.

## CONTENUTO PROGETTO

- **PdfEditor**: editor PDF vanilla JS single-file
- **File principali**: index.html, app.js, style.css (nella root)
- **Librerie usate**: PDF.js, pdf-lib, Fabric.js
- **Target**: programmatore C# che non conosce JS in dettaglio

## PATTERN OBBLIGATORI

### JavaScript

```javascript
// ❌ MAI:
const calc = (x, y) => x + y;
let x = condition ? a : b ? c : d;
fetch('/api').then(r => r.json()).then(d => process(d));

// ✅ SEMPRE:
function calculate(x, y) {
    return x + y;
}

async function loadData() {
    const result = await fetch('/api');
    return await result.json();
}
```

### HTML

```html
<!-- ❌ MAI: -->
<div>
    <div>
        <div>
            <button>Click</button>
        </div>
    </div>
</div>

<!-- ✅ SEMPRE: -->
<button id="saveBtn" class="btn-primary">Salva</button>
<div id="panel" style="display: none;">
    <h3>Titolo</h3>
    <div id="content"></div>
</div>
```

### CSS

```css
/* ❌ MAI: */
@keyframes slideIn { ... }
:root { --primary-color: #007bff; }

/* ✅ SEMPRE: */
.btn-primary {
    background: #007bff;
    color: white;
    padding: 8px 16px;
}
```

## STRUTTURA FUNZIONI

```javascript
// Modello standard per nuove funzionalità
function setupFeature() {
    const btn = document.getElementById('featureBtn');
    const input = document.getElementById('featureInput');
    
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', handleFeatureUpload);
}

async function handleFeatureUpload(event) {
    const file = event.target.files[0];
    if (!validateFeatureFile(file)) return;
    
    const data = await processFile(file);
    saveToStorage(data);
    refreshUI();
}

function validateFeatureFile(file) {
    if (!file) {
        showToast('Nessun file selezionato');
        return false;
    }
    
    if (file.size >5 * 1024 * 1024) {
        showToast('File troppo grande (max 5MB)');
        return false;
    }
    
    return true;
}
```

## ESEMPIO: RIUTILIZZO CODICE ESISTENTE

```javascript
// ❌ SBAGLIATO: duplica logica esistente
function handleSelectionChanged() {
    currentTool = 'select';
    selectTool.classList.add('active');
    textTool.classList.remove('active');
    imageTool.classList.remove('active');
    fabricCanvas.selection = true;
    fabricCanvas.defaultCursor = 'default';
}

// ✅ CORRETTO: riutilizza funzione esistente (2 righe)
fabricCanvas.on('editing:exited', () => {
    currentTool = 'select';
    updateToolButtons();
});
```

## GESTIONE STATO

```javascript
// Stato globale semplice
let appState = {
    pdfLoaded: false,
    currentPage: 1,
    signatures: []
};

// Funzioni di modifica esplicite
function addSignature(sig) {
    appState.signatures.push(sig);
    saveToStorage();
}
```

## NOTE PER PROGRAMMATORI C#

- JavaScript è **case-sensitive** (diverso da C#)
- `null` esiste ma anche `undefined` (usa `value == null` per entrambi)
- Non esiste `int`/`string` - dichiara con `const` o `let`
- Gli array sono dinamici (come `List<T>` in C#)
- `this` si comporta diversamente (usa funzioni tradizionali, non arrow, per eventi)
- Confronti: usa sempre `===` invece di `==`

## CHECKLIST VERIFICA (da completare)

Dopo ogni modifica, verifica:
- [ ] Funzione ha < 30 righe?
- [ ] Usato async/await invece di callback?
- [ ] Nessuna arrow function per logica complessa?
- [ ] Nomi variabili descrittivi (es. `saveButton` non `btn`)?
- [ ] Nessun framework aggiunto?
- [ ] Validazione con early return?
- [ ] Nessun commento superfluo?
- [ ] Riutilizzato codice esistente invece di duplicare?
- [ ] Aggiunto il minor numero di righe possibile?

## COMANDI

```bash
# Verifica
cat index.html | grep -E "(react|vue|angular|jquery)" && echo "❌ Framework trovato" || echo "✅ OK"

# Test manuale
# Apri index.html nel browser, verifica console senza errori
```
