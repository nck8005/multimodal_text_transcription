import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
    });
    const [token, setToken] = useState(() => localStorage.getItem('token'));

    const login = useCallback((userData, accessToken) => {
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', accessToken);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
