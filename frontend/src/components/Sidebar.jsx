import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Settings, LogOut, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

function Avatar({ name, size = 44, url }) {
    if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-strong)' }} />;
    const initials = (name || '?').slice(0, 1).toUpperCase();
    return (
        <div className="avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.36 }}>
            {initials}
        </div>
    );
}

function RoomItem({ room, active, onClick, onDelete }) {
    const [hovered, setHovered] = useState(false);
    const lastMsg = room.last_message;
    let preview = '';
    if (lastMsg) {
        if (lastMsg.message_type === 'voice') {
            preview = lastMsg.transcription ? `🎙 ${lastMsg.transcription}` : '🎙 Voice message';
        } else {
            preview = lastMsg.content || '';
        }
    }
    const time = lastMsg ? format(new Date(lastMsg.created_at), 'HH:mm') : '';

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm(`Delete conversation with "${room.name}"? This cannot be undone.`)) {
            onDelete(room);
        }
    };

    return (
        <div
            className={`room-item ${active ? 'active' : ''}`}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ position: 'relative' }}
        >
            <div className="avatar">
                <Avatar name={room.name} size={44} />
            </div>
            <div className="room-info">
                <div className="room-name">{room.name || 'Unnamed Room'}</div>
                {preview && (
                    <div className="room-last-msg">
                        {preview.length > 42 ? preview.slice(0, 42) + '…' : preview}
                    </div>
                )}
            </div>
            <div className="room-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {time && <span className="room-time">{time}</span>}
                {hovered && (
                    <button
                        className="room-delete-btn"
                        onClick={handleDelete}
                        title="Delete conversation"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function Sidebar({ rooms, activeRoomId, onSelectRoom, onNewChat, onSearch, searchQuery, searchResults, onSelectSearchResult, onClearSearch, loading, onRoomDeleted }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const showSearch = searchQuery.trim().length > 0;

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            logout();
            navigate('/login');
        }
    };

    const handleDeleteRoom = async (room) => {
        try {
            await api.delete(`/api/rooms/${room.id}`);
            onRoomDeleted(room.id);
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to delete conversation');
        }
    };

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header">
                <div className="sidebar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <div className="sidebar-logo-icon">
                        <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                    </div>
                </div>
                <div className="sidebar-actions">
                    <button className="btn-icon" onClick={onNewChat} title="New chat">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                    <button className="btn-icon" onClick={() => navigate('/settings')} title="Settings">
                        <Settings size={20} />
                    </button>
                    <button className="btn-icon text-error-dim" onClick={handleLogout} title="Logout">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div className="search-bar">
                <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    className="input"
                    placeholder="Search messages & voice..."
                    value={searchQuery}
                    onChange={e => onSearch(e.target.value)}
                    id="global-search-input"
                />
                {searchQuery && (
                    <button className="search-clear" onClick={onClearSearch}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                )}
            </div>

            {showSearch ? (
                /* ── Search Results ── */
                <div className="search-results">
                    {searchResults.length === 0 ? (
                        <div className="empty-state">
                            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                            <p>No messages found for<br /><strong>"{searchQuery}"</strong></p>
                        </div>
                    ) : (
                        <>
                            <div className="search-results-header">
                                <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                            </div>
                            {searchResults.map((result) => {
                                const msg = result.message;
                                const sender = msg.sender?.username || 'Unknown';
                                const badge = result.match_type === 'transcription' ? 'voice'
                                    : result.match_type === 'semantic' ? 'semantic'
                                        : result.match_type === 'document' ? 'document'
                                            : 'text';
                                const badgeLabel = result.match_type === 'transcription' ? '🎙 Voice'
                                    : result.match_type === 'semantic' ? '✨ Semantic'
                                        : result.match_type === 'document' ? '📄 Doc'
                                            : '💬 Text';
                                return (
                                    <div key={msg.id} className="search-result-item" onClick={() => onSelectSearchResult(result)}>
                                        <div className="search-result-header">
                                            <span className="search-result-sender">{sender}</span>
                                            <span className={`search-result-badge ${badge}`}>{badgeLabel}</span>
                                            <span className="search-result-time">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                        </div>
                                        <div className="search-result-snippet"
                                            dangerouslySetInnerHTML={{ __html: result.snippet.replace(new RegExp(`(${searchQuery})`, 'gi'), '<mark>$1</mark>') }}
                                        />
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            ) : (
                /* ── Room List ── */
                <div className="room-list">
                    {loading ? (
                        <div className="empty-state"><div className="spinner" /><p>Loading chats...</p></div>
                    ) : rooms.length === 0 ? (
                        <div className="empty-state">
                            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                            <p>No chats yet.<br />Click + to start a conversation.</p>
                        </div>
                    ) : (
                        rooms.map(room => (
                            <RoomItem
                                key={room.id}
                                room={room}
                                active={room.id === activeRoomId}
                                onClick={() => onSelectRoom(room)}
                                onDelete={handleDeleteRoom}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
