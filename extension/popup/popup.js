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
