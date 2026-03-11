import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContextValue';

async function loadApi() {
    const module = await import('../api');
    return module.default;
}

function getStoredSession() {
    const token = localStorage.getItem('token');
    const cachedUser = localStorage.getItem('user');

    if (!token) {
        return null;
    }

    let parsedUser = {};
    if (cachedUser) {
        try {
            parsedUser = JSON.parse(cachedUser);
        } catch {
            parsedUser = {};
        }
    }

    return { token, ...parsedUser };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(getStoredSession);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && user && !user.createdAt) {
            loadApi()
                .then((API) => API.get('/auth/me'))
                .then((res) => {
                    const fresh = { token, ...res.data };
                    setUser(fresh);
                    localStorage.setItem('user', JSON.stringify(res.data));
                })
                .catch(() => {
                });
        }
    }, [user]);

    const login = useCallback(async (email, password) => {
        const API = await loadApi();
        const res = await API.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user || {}));
        const sessionUser = { token: res.data.token, ...(res.data.user || {}) };
        setUser(sessionUser);
        return sessionUser;
    }, []);

    const signup = useCallback(async (data) => {
        const API = await loadApi();
        const res = await API.post('/auth/signup', data);
        return res.data;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    }, []);

    const value = useMemo(() => ({
        user,
        setUser,
        login,
        signup,
        logout,
    }), [login, logout, signup, user]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
