// background/background.js — MV3 Service Worker
// Handles storage operations and message routing between popup and content scripts.

// ── Settings helpers ──────────────────────────────────────────────────────────

async function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            { backendUrl: "http://localhost:8000", authToken: "", roomId: "" },
            resolve
        );
    });
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_SETTINGS") {
        getSettings().then(sendResponse);
        return true; // keep channel open for async response
    }

    if (msg.type === "TRANSCRIBE_FILE") {
        // Content script sends a file blob URL + metadata; we call the backend
        handleTranscribeFile(msg.payload).then(sendResponse).catch((err) => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }

    if (msg.type === "SEARCH") {
        handleSearch(msg.query).then(sendResponse).catch((err) => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }
});

// ── API helpers ───────────────────────────────────────────────────────────────

async function handleTranscribeFile({ dataUrl, filename, mimeType, roomId: overrideRoom }) {
    const { backendUrl, authToken, roomId: storedRoom } = await getSettings();

    const room = overrideRoom || storedRoom;
    if (!room || !authToken || !backendUrl) {
        return { ok: false, error: "TranscriptLens: please configure backend URL, token and room ID in the extension popup." };
    }

    // Convert dataURL → Blob → File
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename || "upload", { type: mimeType });

    // Determine backend endpoint and message_type param
    let endpoint, params;
    const lower = (filename || "").toLowerCase();

    if (mimeType && mimeType.startsWith("audio/")) {
        endpoint = `/api/rooms/${room}/voice`;
        params = "";
    } else if (mimeType && mimeType.startsWith("image/")) {
        endpoint = `/api/rooms/${room}/attachment`;
        params = "?message_type=image";
    } else {
        endpoint = `/api/rooms/${room}/attachment`;
        params = "?message_type=document";
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${backendUrl}${endpoint}${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
    });

    if (!response.ok) {
        const text = await response.text();
        return { ok: false, error: `Backend error ${response.status}: ${text}` };
    }

    const json = await response.json();
    return { ok: true, message: json };
}

async function handleSearch(query) {
    const { backendUrl, authToken } = await getSettings();
    if (!authToken || !backendUrl) {
        return { ok: false, error: "Not configured" };
    }

    const url = `${backendUrl}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok) return { ok: false, error: `Search failed: ${response.status}` };
    const json = await response.json();
    return { ok: true, data: json };
}
