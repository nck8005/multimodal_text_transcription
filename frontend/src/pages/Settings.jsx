import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExtension } from '../context/ExtensionContext';
import { ArrowLeft, Camera, User, Info, Save, Puzzle, Check, Trash2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Settings() {
    const { user, login } = useAuth();
    const { hasExtension, installExtension, uninstallExtension } = useExtension();
    const navigate = useNavigate();
    const [username, setUsername] = useState(user?.username || '');
    const [about, setAbout] = useState(user?.about || 'Hey there! I am using VoiceChat.');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const { data } = await api.patch('/api/users/profile', {
                username,
                about,
                avatar_url: avatarUrl
            });
            login(data, localStorage.getItem('token'));
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to update profile' });
        }
        setLoading(false);
    };

    return (
        <div className="settings-container">
            <header className="settings-header">
                <button className="btn-icon" onClick={() => navigate('/')}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Settings</h1>
            </header>

            <main className="settings-main">
                <section className="profile-section">
                    <div className="avatar-edit">
                        <img
                            src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                            alt="Avatar"
                            className="settings-avatar"
                        />
                        <div className="avatar-badge">
                            <Camera size={16} />
                        </div>
                    </div>
                </section>

                <form className="settings-form" onSubmit={handleSave}>
                    <div className="form-group">
                        <label><User size={16} /> Username</label>
                        <input
                            className="input"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Your name"
                            required
                        />
                        <p className="form-tip">This is not your username or pin. This name will be visible to your VoiceChat contacts.</p>
                    </div>

                    <div className="form-group">
                        <label><Info size={16} /> About</label>
                        <textarea
                            className="input"
                            value={about}
                            onChange={e => setAbout(e.target.value)}
                            placeholder="About status"
                            rows={2}
                        />
                    </div>

                    <div className="form-group">
                        <label><Camera size={16} /> Avatar URL</label>
                        <input
                            className="input"
                            value={avatarUrl}
                            onChange={e => setAvatarUrl(e.target.value)}
                            placeholder="https://example.com/image.png"
                        />
                    </div>

                    {message.text && (
                        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                            {message.text}
                        </div>
                    )}

                    <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                        {loading ? <div className="spinner-small" /> : <><Save size={18} /> Save Profile</>}
                    </button>
                </form>

                <div className="divider" style={{ margin: '32px 0 24px', opacity: 0.5 }}></div>

                <section className="marketplace-section" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <Puzzle size={20} color="var(--primary)" />
                        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Extension Marketplace</h2>
                    </div>

                    <div className="search-bar" style={{ marginBottom: '24px' }}>
                        <input
                            type="text"
                            placeholder="Search extensions in Marketplace..."
                            className="input w-full"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                        />
                    </div>

                    <div className="extensions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* TranscriptLens Extension Card */}
                        <div className="extension-card" style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'center'
                        }}>
                            <div className="ext-icon" style={{
                                width: '64px', height: '64px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '28px', flexShrink: 0
                            }}>🎙</div>

                            <div className="ext-info" style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>TranscriptLens</h3>
                                    {hasExtension('transcript-lens') && (
                                        <span className="badge" style={{ fontSize: '10px', background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '2px 6px', borderRadius: '4px' }}>
                                            Installed
                                        </span>
                                    )}
                                </div>
                                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    AI-powered multimodal transcription for VoiceChat. Extracts text from voice messages, images (OCR), and documents automatically.
                                </p>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    v1.0.0 • AI • Accessibility
                                </div>
                            </div>

                            <div className="ext-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {hasExtension('transcript-lens') ? (
                                    <button
                                        className="btn"
                                        style={{
                                            background: '#334155', color: '#e2e8f0',
                                            padding: '6px 16px', fontSize: '13px',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                        onClick={() => uninstallExtension('transcript-lens')}
                                    >
                                        <Trash2 size={14} /> Uninstall
                                    </button>
                                ) : (
                                    <button
                                        className="btn"
                                        style={{
                                            background: 'var(--primary)', color: 'white',
                                            padding: '6px 20px', fontSize: '13px',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                        onClick={() => installExtension('transcript-lens')}
                                    >
                                        <Download size={14} /> Install
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Dummy Extension for marketplace feel */}
                        <div className="extension-card" style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'center',
                            opacity: 0.6
                        }}>
                            <div className="ext-icon" style={{
                                width: '64px', height: '64px',
                                borderRadius: '12px',
                                background: '#334155',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '28px', flexShrink: 0
                            }}>🌙</div>
                            <div className="ext-info" style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600' }}>Dark Mode Pro</h3>
                                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Advanced OLED and pitch black themes.</p>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>v2.4.1 • Theme</div>
                            </div>
                            <div className="ext-actions">
                                <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 20px', fontSize: '13px' }} disabled>Coming soon</button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
