import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Register() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data } = await api.post('/api/auth/register', form);
            login(data.user, data.access_token);
            navigate('/chat');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card glass">
                <div className="auth-logo">
                    <div className="auth-logo-icon">
                        <MessageSquare size={22} color="white" />
                    </div>
                    <h1>VoiceChat</h1>
                </div>
                <p className="auth-subtitle">Create your account — it's free</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="alice"
                            value={form.username}
                            onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                            required
                            minLength={3}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email address</label>
                        <input
                            className="input"
                            type="email"
                            placeholder="alice@example.com"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="At least 6 characters"
                            value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            required
                            minLength={6}
                        />
                    </div>
                    {error && <p className="form-error">{error}</p>}
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 8 }}
                        disabled={loading}
                    >
                        {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</> : 'Create Account'}
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
