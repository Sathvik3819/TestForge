import { createContext, useState, useEffect } from 'react';
import API from '../api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const token = localStorage.getItem('token');
        const cachedUser = localStorage.getItem('user');
        if (token) {
            let parsedUser = {};
            if (cachedUser) {
                try {
                    parsedUser = JSON.parse(cachedUser);
                } catch (err) { }
            }
            return { token, ...parsedUser };
        }
        return null;
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        // if we don't have createdAt or other fresh info, fetch from server securely in the background
        if (token && user && !user.createdAt) {
            API.get('/auth/me')
                .then((res) => {
                    const fresh = { token, ...res.data };
                    setUser(fresh);
                    localStorage.setItem('user', JSON.stringify(res.data));
                })
                .catch(() => {
                    // ignore, maybe token expired or offline
                });
        }
    }, []);

    const login = async (email, password) => {
        const res = await API.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user || {}));
        const sessionUser = { token: res.data.token, ...(res.data.user || {}) };
        setUser(sessionUser);
        return sessionUser;
    };

    const signup = async (data) => {
        const res = await API.post('/auth/signup', data);
        return res.data;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
