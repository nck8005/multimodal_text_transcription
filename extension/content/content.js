// content/content.js — TranscriptLens Content Script
// Injected on every page. Adds a floating panel and intercepts file inputs.

(function () {
    "use strict";

    // Run only once per page
    if (window.__transcriptLensInjected) return;
    window.__transcriptLensInjected = true;

    // ── Styles ──────────────────────────────────────────────────────────────────
    const style = document.createElement("style");
    style.textContent = `
    #tl-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      width: 52px; height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: #fff;
      font-size: 22px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(124,58,237,0.5);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
    }
    #tl-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(124,58,237,0.7);
    }

    #tl-panel {
      position: fixed;
      bottom: 86px;
      right: 24px;
      z-index: 2147483646;
      width: 340px;
      max-height: 480px;
      border-radius: 16px;
      background: linear-gradient(145deg, #0f0c29ee, #302b63ee);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      color: #e2e8f0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      display: none;
      flex-direction: column;
      animation: tl-slide-in 0.2s ease;
    }
    #tl-panel.open { display: flex; }

    @keyframes tl-slide-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    #tl-panel-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    #tl-panel-header h2 {
      font-size: 14px; font-weight: 700;
      background: linear-gradient(90deg, #a78bfa, #60a5fa);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      flex: 1;
    }
    #tl-close {
      background: none; border: none; color: #94a3b8;
      font-size: 18px; cursor: pointer; padding: 0 2px;
    }
    #tl-close:hover { color: #e2e8f0; }

    #tl-search-row {
      display: flex; gap: 8px; padding: 12px 16px;
    }
    #tl-search-input {
      flex: 1; padding: 8px 12px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.07);
      color: #e2e8f0; font-size: 13px; outline: none;
      transition: border-color 0.2s;
    }
    #tl-search-input:focus { border-color: #a78bfa; }
    #tl-search-input::placeholder { color: #475569; }

    #tl-search-btn {
      padding: 8px 14px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: #fff; font-size: 13px; cursor: pointer;
      transition: opacity 0.2s;
    }
    #tl-search-btn:hover { opacity: 0.85; }

    #tl-upload-status {
      padding: 0 16px 10px;
      font-size: 11px; color: #94a3b8;
    }

    #tl-results {
      flex: 1; overflow-y: auto; padding: 0 16px 14px;
    }
    #tl-results::-webkit-scrollbar { width: 4px; }
    #tl-results::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

    .tl-result-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 10px 12px; margin-bottom: 8px;
    }
    .tl-result-meta {
      display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
    }
    .tl-badge {
      font-size: 9px; padding: 1px 6px; border-radius: 6px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .tl-badge.voice   { background: rgba(52,211,153,0.18); color: #34d399; }
    .tl-badge.image   { background: rgba(251,191,36,0.18); color: #fbbf24; }
    .tl-badge.document{ background: rgba(96,165,250,0.18); color: #60a5fa; }
    .tl-badge.text    { background: rgba(167,139,250,0.18); color: #a78bfa; }
    .tl-badge.semantic{ background: rgba(167,139,250,0.12); color: #a78bfa; }
    .tl-sender { font-size: 11px; color: #64748b; }
    .tl-snippet { font-size: 12px; color: #cbd5e1; line-height: 1.5; }
    .tl-highlight { background: rgba(167,139,250,0.3); border-radius: 3px; padding: 0 1px; }

    .tl-no-results { text-align: center; color: #475569; font-size: 12px; padding: 24px 0; }
    .tl-loading { text-align: center; color: #7c3aed; font-size: 12px; padding: 16px 0; }
  `;
    document.head.appendChild(style);

    // ── FAB ─────────────────────────────────────────────────────────────────────
    const fab = document.createElement("button");
    fab.id = "tl-fab";
    fab.title = "TranscriptLens — Search & Transcribe";
    fab.textContent = "🎙";
    document.body.appendChild(fab);

    // ── Panel ───────────────────────────────────────────────────────────────────
    const panel = document.createElement("div");
    panel.id = "tl-panel";
    panel.innerHTML = `
    <div id="tl-panel-header">
      <span>🎙</span>
      <h2>TranscriptLens</h2>
      <button id="tl-close" title="Close">✕</button>
    </div>
    <div id="tl-search-row">
      <input id="tl-search-input" type="text" placeholder="Search transcribed messages…" />
      <button id="tl-search-btn">🔍</button>
    </div>
    <div id="tl-upload-status"></div>
    <div id="tl-results"></div>
  `;
    document.body.appendChild(panel);

    // ── Toggle panel ─────────────────────────────────────────────────────────────
    fab.addEventListener("click", () => panel.classList.toggle("open"));
    document.getElementById("tl-close").addEventListener("click", () => panel.classList.remove("open"));

    // ── Search ───────────────────────────────────────────────────────────────────
    const searchInput = document.getElementById("tl-search-input");
    const searchBtn = document.getElementById("tl-search-btn");
    const resultsDiv = document.getElementById("tl-results");

    function doSearch() {
        const q = searchInput.value.trim();
        if (!q) return;
        resultsDiv.innerHTML = `<p class="tl-loading">Searching…</p>`;

        chrome.runtime.sendMessage({ type: "SEARCH", query: q }, (resp) => {
            if (!resp || !resp.ok) {
                resultsDiv.innerHTML = `<p class="tl-no-results">${resp?.error || "Search failed"}</p>`;
                return;
            }
            const { results, total } = resp.data;
            if (!results || total === 0) {
                resultsDiv.innerHTML = `<p class="tl-no-results">No results found for "${escHtml(q)}"</p>`;
                return;
            }
            resultsDiv.innerHTML = results.map((r) => renderResult(r, q)).join("");
        });
    }

    searchBtn.addEventListener("click", doSearch);
    searchInput.addEventListener("keydown", (e) => e.key === "Enter" && doSearch());

    function renderResult(r, q) {
        const badgeClass = r.match_type || "text";
        const badgeLabel = { voice: "🎤 Voice", image: "🖼 Image", document: "📄 Doc", text: "✉ Text", transcription: "🎤 Voice", semantic: "🔮 Semantic" }[r.match_type] || r.match_type;
        const snippet = highlightQuery(escHtml(r.snippet || ""), escHtml(q));
        const sender = r.message?.sender?.username || "Unknown";
        return `
      <div class="tl-result-card">
        <div class="tl-result-meta">
          <span class="tl-badge ${badgeClass}">${badgeLabel}</span>
          <span class="tl-sender">${escHtml(sender)}</span>
        </div>
        <div class="tl-snippet">${snippet || "<em style='color:#475569'>— no snippet —</em>"}</div>
      </div>`;
    }

    function highlightQuery(html, q) {
        if (!q) return html;
        const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
        return html.replace(re, `<span class="tl-highlight">$1</span>`);
    }

    function escHtml(str) {
        if (!str) return "";
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // ── File interception ────────────────────────────────────────────────────────
    // Listen for any file input change on the host page and offer to transcribe
    const uploadStatus = document.getElementById("tl-upload-status");

    function handleFileInput(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const isTranscribable =
            file.type.startsWith("audio/") ||
            file.type.startsWith("image/") ||
            file.type === "application/pdf" ||
            file.name.endsWith(".docx") ||
            file.name.endsWith(".pptx") ||
            file.name.endsWith(".txt");

        if (!isTranscribable) return;

        // Open panel and show status
        panel.classList.add("open");
        uploadStatus.textContent = `⏳ Transcribing "${file.name}"…`;

        const reader = new FileReader();
        reader.onload = () => {
            chrome.runtime.sendMessage(
                {
                    type: "TRANSCRIBE_FILE",
                    payload: { dataUrl: reader.result, filename: file.name, mimeType: file.type },
                },
                (resp) => {
                    if (!resp) {
                        uploadStatus.textContent = "❌ Extension error — check background worker";
                        return;
                    }
                    if (!resp.ok) {
                        uploadStatus.textContent = `❌ ${resp.error}`;
                        return;
                    }
                    uploadStatus.textContent = `✅ "${file.name}" sent to backend — will be indexed shortly!`;
                    setTimeout(() => { uploadStatus.textContent = ""; }, 5000);
                }
            );
        };
        reader.readAsDataURL(file);
    }

    // Attach to existing and future file inputs via MutationObserver
    function attachToFileInputs(root) {
        root.querySelectorAll("input[type='file']").forEach((inp) => {
            if (!inp.__tlAttached) {
                inp.__tlAttached = true;
                inp.addEventListener("change", handleFileInput);
            }
        });
    }

    attachToFileInputs(document);

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.matches("input[type='file']")) {
                        if (!node.__tlAttached) {
                            node.__tlAttached = true;
                            node.addEventListener("change", handleFileInput);
                        }
                    }
                    attachToFileInputs(node);
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
