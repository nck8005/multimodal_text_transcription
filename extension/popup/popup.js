// popup/popup.js — TranscriptLens popup logic

const $ = (id) => document.getElementById(id);

// ── Load saved settings on open ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(
        { backendUrl: "http://localhost:8000", authToken: "", roomId: "" },
        ({ backendUrl, authToken, roomId }) => {
            $("backend-url").value = backendUrl;
            $("auth-token").value = authToken;
            $("room-id").value = roomId;
        }
    );

    $("open-app").addEventListener("click", (e) => {
        e.preventDefault();
        chrome.storage.local.get({ backendUrl: "http://localhost:8000" }, ({ backendUrl }) => {
            chrome.tabs.create({ url: `http://localhost:5173` });
        });
    });
});

// ── Save button ───────────────────────────────────────────────────────────────
$("btn-save").addEventListener("click", () => {
    const backendUrl = $("backend-url").value.trim().replace(/\/$/, "");
    const authToken = $("auth-token").value.trim();
    const roomId = $("room-id").value.trim();

    chrome.storage.local.set({ backendUrl, authToken, roomId }, () => {
        setStatus("saved", "✅ Settings saved!");
        setTimeout(() => setStatus("idle", "Tap 🔌 Test to verify connection"), 2000);
    });
});

// ── Test button ───────────────────────────────────────────────────────────────
$("btn-test").addEventListener("click", async () => {
    const backendUrl = $("backend-url").value.trim().replace(/\/$/, "");
    const authToken = $("auth-token").value.trim();

    setStatus("checking", "Testing connection…");

    try {
        const res = await fetch(`${backendUrl}/health`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (res.ok) {
            const data = await res.json();
            setStatus("ok", `✅ Connected — ${data.service || "API OK"}`);
        } else {
            setStatus("err", `❌ Server returned ${res.status}`);
        }
    } catch (err) {
        setStatus("err", `❌ Cannot reach server: ${err.message}`);
    }
});

// ── Status helpers ────────────────────────────────────────────────────────────
function setStatus(state, text) {
    const dot = $("status-dot");
    const label = $("status-text");
    dot.className = "status-dot";
    if (state === "ok") dot.classList.add("ok");
    if (state === "err") dot.classList.add("err");
    label.textContent = text;
}

// ── Search logic ──────────────────────────────────────────────────────────────
$("btn-search").addEventListener("click", () => performSearch());
$("search-query").addEventListener("keypress", (e) => {
    if (e.key === "Enter") performSearch();
});

async function performSearch() {
    const query = $("search-query").value.trim();
    if (!query) return;

    const resultsContainer = $("search-results");
    resultsContainer.innerHTML = '<div class="no-results">Searching...</div>';

    chrome.storage.local.get(
        ["backendUrl", "authToken"],
        async ({ backendUrl, authToken }) => {
            try {
                const url = `${backendUrl}/api/search?q=${encodeURIComponent(query)}`;
                const res = await fetch(url, {
                    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                });

                if (!res.ok) throw new Error(`Server error: ${res.status}`);

                const data = await res.json();
                renderResults(data.results);
            } catch (err) {
                resultsContainer.innerHTML = `<div class="no-results">❌ ${err.message}</div>`;
            }
        }
    );
}

function renderResults(results) {
    const container = $("search-results");
    if (!results || results.length === 0) {
        container.innerHTML = '<div class="no-results">No matches found.</div>';
        return;
    }

    container.innerHTML = "";
    results.forEach((res) => {
        const div = document.createElement("div");
        div.className = "result-card";
        
        const fileName = res.message.file_path 
            ? res.message.file_path.split(/[\\/]/).pop() 
            : (res.message.content || "Result");

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <span class="title" style="color: #c084fc; font-weight: 700;" title="Click to Locate">${fileName}</span>
                <span style="font-size: 14px; opacity: 0.7;">📂</span>
            </div>
            <div class="snippet">${res.snippet}</div>
            <div class="meta">
                <span>${res.match_type} • ${Math.round(res.score * 100)}%</span>
                <span>${new Date(res.message.created_at).toLocaleDateString()}</span>
            </div>
        `;

        div.addEventListener("click", () => {
            if (res.message.file_path) {
                locateLocalFile(res.message);
            }
        });

        container.appendChild(div);
    });
}

async function openLocalFile(message) {
    chrome.storage.local.get(["backendUrl", "authToken"], async ({ backendUrl, authToken }) => {
        try {
            const res = await fetch(`${backendUrl}/api/open-local`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify(message),
            });
            if (res.ok) {
                showToast("🎵 Opening file...");
            } else {
                const errData = await res.json();
                console.error("Failed to open file:", errData.detail);
                showToast("❌ Failed to open file");
            }
        } catch (err) {
            console.error("Error opening file:", err);
            showToast("❌ Backend unreachable");
        }
    });
}

async function locateLocalFile(message) {
    chrome.storage.local.get(["backendUrl", "authToken"], async ({ backendUrl, authToken }) => {
        try {
            const res = await fetch(`${backendUrl}/api/locate-local`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify(message),
            });
            if (res.ok) {
                showToast("📂 Locating file...");
            } else {
                showToast("❌ Failed to locate");
            }
        } catch (err) {
            showToast("❌ Backend unreachable");
        }
    });
}

function showToast(text) {
    const container = $("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    container.innerHTML = "";
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}
