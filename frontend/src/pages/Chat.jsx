import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { Send, MessageSquare, X, Paperclip, Image, Film, FileText, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Sidebar from '../components/Sidebar';
import { VoiceMessage } from '../components/VoiceMessage';
import { VoiceRecorder } from '../components/VoiceRecorder';
import api from '../api';

// ─── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = 30 }) {
    return (
        <div className="avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.38 }}>
            {(name || '?').slice(0, 1).toUpperCase()}
        </div>
    );
}

// ─── NewChat Modal ──────────────────────────────────────────────────────────
function NewChatModal({ onClose, onCreated }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (query.length < 2) { setResults([]); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
                setResults(data);
            } catch { setResults([]); }
            setLoading(false);
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const startChat = async (user) => {
        try {
            const { data } = await api.post('/api/rooms', { member_ids: [user.id], is_group: false });
            onCreated(data);
            onClose();
        } catch { alert('Failed to create chat'); }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <span className="modal-title">New Conversation</span>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <input
                    className="input"
                    placeholder="Search by username..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                />
                <div className="user-search-results">
                    {loading && <div className="empty-state"><div className="spinner" /></div>}
                    {!loading && results.length === 0 && query.length >= 2 && (
                        <div className="empty-state" style={{ padding: 16 }}>No users found</div>
                    )}
                    {results.map(user => (
                        <div key={user.id} className="user-result-item" onClick={() => startChat(user)}>
                            <Avatar name={user.username} size={36} />
                            <div>
                                <div className="user-result-name">{user.username}</div>
                                <div className="user-result-email">{user.email}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Delete Context Menu ─────────────────────────────────────────────────────
function MessageContextMenu({ x, y, isSender, onDeleteForMe, onDeleteForEveryone, onClose }) {
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="msg-context-menu"
            style={{ top: y, left: x }}
        >
            <button className="msg-context-item" onClick={onDeleteForMe}>
                <Trash2 size={14} /> Delete for me
            </button>
            {isSender && (
                <button className="msg-context-item msg-context-danger" onClick={onDeleteForEveryone}>
                    <Trash2 size={14} /> Delete for everyone
                </button>
            )}
        </div>
    );
}

// ─── Messages List ───────────────────────────────────────────────────────────
function MessageList({ messages, currentUserId, activeRoomId, onDeleteMessage }) {
    const bottomRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, msg }

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, msg });
    };

    if (!messages.length) {
        return (
            <div className="messages-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div className="empty-state">
                    <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                    <p>No messages yet. Say hello! 👋</p>
                </div>
            </div>
        );
    }

    return (
        <div className="messages-container" onClick={() => setContextMenu(null)}>
            {contextMenu && (
                <MessageContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    isSender={contextMenu.msg.sender_id === currentUserId}
                    onDeleteForMe={() => { onDeleteMessage(contextMenu.msg, 'me'); setContextMenu(null); }}
                    onDeleteForEveryone={() => { onDeleteMessage(contextMenu.msg, 'everyone'); setContextMenu(null); }}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {messages.map(msg => {
                const isSent = msg.sender_id === currentUserId;
                const senderName = msg.sender?.username || 'Unknown';

                // Filter out messages deleted globally or for this user
                if (msg.is_deleted) {
                    return (
                        <div key={msg.id} className={`message-row ${isSent ? 'sent' : 'received'}`}>
                            {!isSent && <div className="message-avatar"><Avatar name={senderName} size={28} /></div>}
                            <div className="message-bubble message-deleted">
                                <em style={{ opacity: 0.5, fontSize: 13 }}>🚫 This message was deleted</em>
                                <div className="message-time">{format(new Date(msg.created_at), 'HH:mm')}</div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div
                        key={msg.id}
                        className={`message-row ${isSent ? 'sent' : 'received'}`}
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                    >
                        {!isSent && (
                            <div className="message-avatar">
                                <Avatar name={senderName} size={28} />
                            </div>
                        )}
                        <div className="message-bubble">
                            {!isSent && <div className="message-sender-name">{senderName}</div>}

                            {msg.message_type === 'voice' && (
                                <VoiceMessage message={msg} isSent={isSent} />
                            )}

                            {msg.message_type === 'image' && (
                                <div className="message-media">
                                    <img
                                        src={`${api.defaults.baseURL}${msg.file_url}`}
                                        alt="attachment"
                                        className="message-image"
                                        onClick={() => window.open(`${api.defaults.baseURL}${msg.file_url}`, '_blank')}
                                    />
                                </div>
                            )}

                            {msg.message_type === 'video' && (
                                <div className="message-media">
                                    <video
                                        src={`${api.defaults.baseURL}${msg.file_url}`}
                                        controls
                                        className="message-video"
                                    />
                                </div>
                            )}

                            {msg.message_type === 'document' && (
                                <a
                                    href={`${api.defaults.baseURL}${msg.file_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="message-doc"
                                >
                                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                                    <div className="doc-info">
                                        <div className="doc-name">{msg.content}</div>
                                        <div className="message-time" style={{ marginTop: 0 }}>Document</div>
                                    </div>
                                </a>
                            )}

                            {msg.message_type === 'text' && (
                                <div className="message-text">{msg.content}</div>
                            )}

                            <div className="message-time">{format(new Date(msg.created_at), 'HH:mm')}</div>
                        </div>
                    </div>
                );
            })}
            <div ref={bottomRef} />
        </div>
    );
}

// ─── Main Chat Page ──────────────────────────────────────────────────────────
export default function Chat() {
    const { user, token } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);
    const [roomsLoading, setRoomsLoading] = useState(true);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showAttachments, setShowAttachments] = useState(false);
    const searchTimer = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadType, setUploadType] = useState('image');

    // Load rooms
    useEffect(() => {
        api.get('/api/rooms').then(r => { setRooms(r.data); setRoomsLoading(false); }).catch(() => setRoomsLoading(false));
    }, []);

    // Load messages for active room
    useEffect(() => {
        if (!activeRoom) return;
        setMsgsLoading(true);
        api.get(`/api/rooms/${activeRoom.id}/messages?limit=100`)
            .then(r => { setMessages(r.data); setMsgsLoading(false); })
            .catch(() => setMsgsLoading(false));
    }, [activeRoom?.id]);

    // WebSocket handler
    const handleWsMessage = useCallback((data) => {
        if (data.type === 'transcription_update') {
            const updated = data.message;
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        } else if (data.type === 'message_deleted') {
            const { message_id } = data;
            setMessages(prev => prev.map(m =>
                m.id === message_id ? { ...m, is_deleted: true, content: null } : m
            ));
        } else if (data.id) {
            setMessages(prev => {
                if (prev.find(m => m.id === data.id)) return prev;
                return [...prev, data];
            });
            setRooms(prev => prev.map(r => r.id === data.room_id ? { ...r, last_message: data } : r));
        }
    }, []);

    useWebSocket(activeRoom?.id, token, handleWsMessage);

    // Search with debounce
    useEffect(() => {
        clearTimeout(searchTimer.current);
        if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
        searchTimer.current = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q: searchQuery });
                if (activeRoom) params.set('room_id', activeRoom.id);
                const { data } = await api.get(`/api/search?${params}`);
                setSearchResults(data.results);
            } catch { setSearchResults([]); }
        }, 300);
        return () => clearTimeout(searchTimer.current);
    }, [searchQuery, activeRoom?.id]);

    const handleSendText = async (e) => {
        e?.preventDefault();
        if (!text.trim() || !activeRoom) return;
        const content = text.trim();
        setText('');
        try {
            await api.post(`/api/rooms/${activeRoom.id}/messages`, { content });
        } catch { alert('Failed to send message'); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }
    };

    const handleVoiceSend = async (blob) => {
        if (!activeRoom) return;
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        try {
            await api.post(`/api/rooms/${activeRoom.id}/voice`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        } catch { alert('Failed to send voice message'); }
    };

    const handleAttachmentClick = (type) => {
        setUploadType(type);
        setShowAttachments(false);
        fileInputRef.current.click();
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeRoom) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            await api.post(`/api/rooms/${activeRoom.id}/attachment?message_type=${uploadType}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        } catch { alert('Failed to upload file'); }
        e.target.value = '';
    };

    const handleSelectRoom = (room) => {
        setActiveRoom(room);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleSearchResult = (result) => {
        const msg = result.message;
        const room = rooms.find(r => r.id === msg.room_id);
        if (room) {
            setActiveRoom(room);
            setSearchQuery('');
            setSearchResults([]);
        }
    };

    const handleNewChat = (room) => {
        const exists = rooms.find(r => r.id === room.id);
        if (!exists) setRooms(prev => [room, ...prev]);
        setActiveRoom(room);
    };

    const handleRoomDeleted = (roomId) => {
        setRooms(prev => prev.filter(r => r.id !== roomId));
        if (activeRoom?.id === roomId) setActiveRoom(null);
    };

    const handleDeleteMessage = async (msg, scope) => {
        try {
            await api.delete(`/api/rooms/${activeRoom.id}/messages/${msg.id}?scope=${scope}`);
            if (scope === 'me') {
                // Instantly hide it locally for the current user
                setMessages(prev => prev.filter(m => m.id !== msg.id));
            }
            // For 'everyone', the WebSocket broadcast will update all clients
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to delete message');
        }
    };

    // Filter messages: hide those deleted for the current user
    const visibleMessages = messages.filter(msg => {
        if (!msg.deleted_for) return true;
        return !msg.deleted_for.split(',').includes(user?.id);
    });

    return (
        <div className="chat-layout">
            {showNewChat && (
                <NewChatModal
                    onClose={() => setShowNewChat(false)}
                    onCreated={handleNewChat}
                />
            )}

            {/* ── Sidebar ── */}
            <Sidebar
                rooms={rooms}
                activeRoomId={activeRoom?.id}
                onSelectRoom={handleSelectRoom}
                onNewChat={() => setShowNewChat(true)}
                onSearch={setSearchQuery}
                searchQuery={searchQuery}
                searchResults={searchResults}
                onSelectSearchResult={handleSearchResult}
                onClearSearch={() => { setSearchQuery(''); setSearchResults([]); }}
                loading={roomsLoading}
                onRoomDeleted={handleRoomDeleted}
            />

            {/* ── Chat Area ── */}
            <div className="chat-area">
                {!activeRoom ? (
                    <div className="chat-welcome">
                        <div className="chat-welcome-icon">
                            <MessageSquare size={36} />
                        </div>
                        <h2>Welcome, {user?.username}!</h2>
                        <p>Select a conversation or start a new one.</p>
                        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowNewChat(true)}>
                            Start a Conversation
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="chat-header">
                            <Avatar name={activeRoom.name} size={38} />
                            <div className="chat-header-info">
                                <div className="chat-header-name">{activeRoom.name}</div>
                                <div className="chat-header-status">
                                    <span style={{ color: activeRoom.is_online ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {activeRoom.is_online ? '● Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        {msgsLoading ? (
                            <div className="loading-screen"><div className="spinner" /></div>
                        ) : (
                            <MessageList
                                messages={visibleMessages}
                                currentUserId={user?.id}
                                activeRoomId={activeRoom?.id}
                                onDeleteMessage={handleDeleteMessage}
                            />
                        )}

                        {/* Input */}
                        <div className="message-input-area">
                            <div className="attachment-wrap" style={{ position: 'relative' }}>
                                <button
                                    className="btn-icon"
                                    onClick={() => setShowAttachments(!showAttachments)}
                                    title="Attachments"
                                >
                                    <Paperclip size={20} />
                                </button>

                                {showAttachments && (
                                    <div className="attachment-menu animate-in-fade">
                                        <div className="attachment-item" onClick={() => handleAttachmentClick('image')}>
                                            <Image size={18} /> <span>Photos</span>
                                        </div>
                                        <div className="attachment-item" onClick={() => handleAttachmentClick('video')}>
                                            <Film size={18} /> <span>Videos</span>
                                        </div>
                                        <div className="attachment-item" onClick={() => handleAttachmentClick('document')}>
                                            <FileText size={18} /> <span>Documents</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />

                            <div className="message-input-wrap">
                                <textarea
                                    ref={textareaRef}
                                    className="message-input"
                                    placeholder="Type a message..."
                                    rows={1}
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>
                            <VoiceRecorder onSend={handleVoiceSend} disabled={!activeRoom} />
                            <button
                                className="send-btn"
                                onClick={handleSendText}
                                disabled={!text.trim()}
                                title="Send message"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
