# 🎬 Collage Creator
**TaskToolsHub · MIT License · Open Source**

> Crea collage video da foto e clip direttamente dal browser.
> Rendering on-demand via FFmpeg su backend Render.
> Storage e database su Firebase. Zero costi fissi.

---

## 📐 Architettura

```
[Browser React] ──→ [Firebase Hosting]   (frontend)
      │
      ├──→ [Firebase Firestore]           (progetti, metadati)
      ├──→ [Firebase Storage]             (media, audio, render)
      │         └── auto-delete renders dopo 7 giorni
      │
      └──→ [Render.com Backend]           (FFmpeg, sleep mode)
                └── si sveglia on-demand al tasto GENERA
```

---

## 🚀 Installazione locale

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

---

## ⚙️ Configurazione

### 1. Firebase — nuovo progetto separato
Crea un progetto Firebase dedicato (non usare Booking Pro o LivingPantry).

Abilita:
- **Authentication** → Google + Anonimo
- **Firestore Database** → modalità produzione
- **Storage** → modalità produzione
- **Hosting** → per il frontend

Copia le credenziali in `frontend/src/utils/firebase.js`.

### 2. Firebase Storage — regola lifecycle (auto-delete 7 giorni)
```bash
# Applica via Google Cloud Console → Storage → Lifecycle
# Oppure via gsutil:
gsutil lifecycle set firebase-rules/storage-lifecycle.json gs://YOUR-BUCKET
```

### 3. Firestore — regole sicurezza
Incolla il contenuto di `firebase-rules/firestore.rules`
nella Console Firebase → Firestore → Regole.

### 4. Backend su Render
1. Crea un nuovo **Web Service** su render.com
2. Collega il repo GitHub (cartella `backend/`)
3. Build command: `apt-get update && apt-get install -y ffmpeg && pip install -r requirements.txt`
4. Start command: `gunicorn app:app --timeout 300 --workers 1`
5. Aggiungi variabili d'ambiente:
   - `FIREBASE_SERVICE_ACCOUNT` → JSON del service account (da Firebase → Impostazioni → Account di servizio)
   - `FIREBASE_STORAGE_BUCKET` → es: `collage-creator-xxxxx.appspot.com`
6. Piano: **Free** (sleep mode, si sveglia on-demand ✓)
7. Regione: **Frankfurt** (coerente con Booking Pro)

### 5. Aggiorna URL backend nel frontend
In `frontend/src/utils/firebase.js`:
```js
export const RENDER_API_URL = "https://TUO-SERVIZIO.onrender.com";
```

### 6. Deploy frontend su Firebase Hosting
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

---

## 🎨 Template disponibili

| Template | Tipo media | Descrizione |
|----------|-----------|-------------|
| Sequenza | foto + video | Clip in sequenza con dissolvenza |
| Slideshow Ken Burns | solo foto | Zoom lento + audio |
| Griglia 2×2 | foto + video | 4 clip simultanee |
| Split Verticale | foto + video | 2 clip affiancate L/R |
| Split Orizzontale | foto + video | 2 clip sopra/sotto |

---

## 📋 Comandi dashboard

| Comando | Funzione |
|---------|----------|
| ⊕ AGGIUNGI | Crea nuovo progetto, upload media |
| ✎ MODIFICA | Riordina media, cambia nome/template |
| ◫ MODELLI | Seleziona template FFmpeg |
| ♪ AUDIO | Aggiungi traccia audio al progetto |
| ▤ I TUOI VIDEO | Libreria progetti con preview |
| ▶ GENERA | Avvia rendering on-demand su Render |

---

## 🗑️ Pulizia automatica storage

I file renderizzati vengono eliminati automaticamente dopo **7 giorni**
tramite regola lifecycle Firebase Storage (cartella `renders/`).

I media sorgente (foto, video, audio) rimangono finché l'utente
non elimina il progetto manualmente.

---

## 🌐 Open Source

MIT License — fork, modifica, distribuisci liberamente.
Contributi benvenuti via Pull Request su `github.com/TaskToolsHub`.

Costruito da **Davide Carrieri** · dicembre 2025 → oggi
*"L'AI non mi ha sostituito. Mi ha elevato."*
