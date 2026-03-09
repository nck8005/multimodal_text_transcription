# TranscriptLens Browser Extension

A Chrome/Edge extension that brings **voice → text**, **document → text**, and **image → text (OCR)** capabilities to any chat website (WhatsApp Web, Telegram Web, Slack, etc.) by connecting to your own local TranscriptLens backend.

---

## 🛠 Installation (Developer Mode — no store needed)

### Step 1 — Start your backend
```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 2 — Load the extension in Chrome / Edge

1. Open **Chrome** → go to `chrome://extensions`  
   (or **Edge** → `edge://extensions`)
2. Enable **Developer mode** (toggle top-right)
3. Click **"Load unpacked"**
4. Navigate to this project's `extension/` folder and click **Select Folder**
5. The **TranscriptLens 🎙** extension icon appears in your toolbar

---

## ⚙️ First-time Setup

1. Click the **TranscriptLens** icon in the toolbar
2. Fill in:
   - **Backend URL**: `http://localhost:8000` (or your server IP)
   - **Auth Token**: your JWT — get it by logging in at `http://localhost:5173`, opening DevTools → Network → any request → `Authorization: Bearer <token>`
   - **Room ID**: UUID of the chat room where files should be indexed (find it in the URL when opening a chat room)
3. Click **💾 Save**, then **🔌 Test** to confirm connectivity

---

## 🚀 Using the Extension

### On any chat website:
1. A **floating 🎙 button** appears at the bottom-right corner
2. Click it to open the **TranscriptLens panel**
3. **Upload any file** via the website's native file picker — the extension will automatically detect it and send it to your backend for transcription/OCR
4. Use the **search box** in the panel to search across all indexed voice, image, and document content

### What gets transcribed:
| File Type | Method | Searchable After |
|-----------|--------|-----------------|
| 🎤 Audio/Voice | Whisper (faster-whisper) | ~5–15 sec |
| 🖼 Image (JPG/PNG) | EasyOCR | ~3–8 sec |
| 📄 PDF / DOCX / PPTX | pypdf / python-docx | ~2–5 sec |

---

## 📁 Extension File Structure

```
extension/
├── manifest.json        ← MV3 manifest
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html       ← Settings UI
│   └── popup.js         ← Load/save settings + health check
├── content/
│   └── content.js       ← Injected on every page (FAB + file interception)
└── background/
    └── background.js    ← Service worker (API routing)
```

---

## 📦 Packaging for Distribution

To share the extension as a `.zip` (for manual install):

```powershell
cd d:\projects\6thsemproject-2
Compress-Archive -Path extension\* -DestinationPath TranscriptLens-extension.zip
```

Recipients can then:
1. Unzip it
2. Go to `chrome://extensions` → Developer mode → Load unpacked → select the unzipped folder

> **Note:** For Chrome Web Store publication, additional Google review is required.

---

## 🔐 Security Notes

- Your JWT token is stored in `chrome.storage.local` (not synced, local only)
- The extension never reads your chat messages — it only processes files *you* select
- All AI processing happens on your own backend (no third-party cloud APIs)
