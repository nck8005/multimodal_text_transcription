import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Camera, User, Info, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Settings() {
    const { user, login } = useAuth();
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
            </main>
        </div>
    );
}
