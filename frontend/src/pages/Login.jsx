import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data } = await api.post('/api/auth/login', form);
            login(data.user, data.access_token);
            navigate('/chat');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Check credentials.');
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
                <p className="auth-subtitle">Sign in to your account to continue</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email address</label>
                        <input
                            className="input"
                            type="email"
                            placeholder="alice@example.com"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            required
                        />
                    </div>
                    {error && <p className="form-error">{error}</p>}
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 8 }}
                        disabled={loading}
                    >
                        {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : 'Sign In'}
                    </button>
                </form>

                <p className="auth-footer">
                    Don't have an account? <Link to="/register">Create one</Link>
                </p>
            </div>
        </div>
    );
}
