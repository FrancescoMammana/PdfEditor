# Issue: Restyling Grafico PDF Editor

## Obiettivo
Aggiornare l'interfaccia grafica del PDF Editor per abbinarla al design moderno mostrato nelle immagini `pagina1.png` e `pagina2.png`, mantenendo tutte le funzionalità esistenti.

## Modifiche Richieste - PAGINA 1 (Upload)

### Header Navigation
- **Stato Attuale**: Nessuna navigation bar
- **Design Desiderato**: 
  - Navigation bar sticky con blur effect (glass-nav)
  - Logo "PDFFlow" con icona PDF
  - Links: Features, Security, FAQ
  - Pulsanti: Accedi, Inizia Ora
  - Toggle dark/light mode integrato

### Upload Area Principale  
- **Stato Attuale**: Semplice area con bordo tratteggiato
- **Design Desiderato**:
  - Design più moderno con gradiente border effect
  - Icona cloud upload animata
  - Title più grande: "Modifica i tuoi PDF in modo Professionale"
  - Subtitle descrittivo più dettagliato
  - Pulsante più grande con icona e shadow effects
  - Badges di sicurezza: SSL SECURE, GDPR COMPLIANT, CLOUD SYNC, AUTO SAVE

### Footer
- **Stato Attuale**: Nessun footer
- **Design Desiderato**: Footer con copyright e links legali

## Modifiche Richieste - PAGINA 2 (Workspace)

### Toolbar Superiore
- **Stato Attuale**: Toolbar in stile tradizionale con separatori
- **Design Desiderato**:
  - Floating toolbar con glassmorphism (glass effect)
  - Posizionamento fixed al top con centering
  - Layout raggruppato:
    - Sezione sinistra: Apri file, Selezione
    - Sezione centrale: Tools (Testo, Immagine, Firma) con prop text styling integrate
    - Sezione destra: Salva, Esporta PDF

### Layout Principale
- **Stato Attuale**: Layout verticale standard
- **Design Desiderato**:
  - Layout a 3 colonne: Main canvas + Sidebar destra
  - Main area: sfondo grigio chiaro, canvas con shadow profondo
  - Sidebar: miniature pagine + pulsante "Aggiungi pagina"

### Zoom Controls
- **Stato Attuale**: Pagination in basso separata
- **Design Desiderato**:
  - Controlli in floating bar in basso
  - Navigazione pagine + zoom integrati
  - Design rounded con glassmorphism

### Dark Mode Toggle
- **Stato Attuale**: Nessun toggle
- **Design Desiderato**: Floating button in basso a destra

## Specifiche Tecniche

### Colori e Temi
- **Primary**: #2563eb (blue) invece del teal attuale
- **Background**: Sfumature e blur effects
- **Glassmorphism**: backdrop-filter: blur() per toolbar e controlli
- **Shadows**: Più profondi e sfumati

### Icone
- **Attuale**: Emoji e SVG inline
- **Desiderato**: Google Material Icons (material-symbols-outlined)

### Tipografia
- **Attuale**: FKGroteskNeue + system fonts
- **Desiderato**: Inter font family (Google Fonts)

### Animazioni
- Hover effects con transform
- Smooth transitions
- Icon animations (pulse per upload)

### Layout Patterns
- Floating elements invece di layout a blocchi
- Rounded corners più consistenti
- Better spacing e visual hierarchy

## VINCOLO CRITICO
**SOLO MODIFICHE GRAFICHE** - Non modificare:
- Logica JavaScript esistente
- Funzionalità dei tools
- Gestione PDF
- Event handlers
- Struttura dati globale

## File da Modificare
1. `index.html` - Aggiornare struttura HTML
2. `style.css` - Nuovo sistema grafico completo
3. Aggiungere riferimenti a Google Fonts e Material Icons

## Compatibilità
- Mantenere responsive design
- Supportare dark mode (manuale + automatica)
- Test su browser moderni
- Performance ottimizzata

## Note Implementazione
- Usare CSS variables per tema
- Implementare glassmorphism con fallback per browser legacy
- Mantenere accessibilità (focus states, ARIA labels)
- Progress enhancement: design moderno ma funzionale anche senza JS
