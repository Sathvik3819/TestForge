import { createContext, useState, useEffect } from 'react';
import API from '../api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const cachedUser = localStorage.getItem('user');
        if (token) {
            let parsedUser = {};
            if (cachedUser) {
                try {
                    parsedUser = JSON.parse(cachedUser);
                } catch (err) {
                    parsedUser = {};
                }
            }
            setUser({ token, ...parsedUser });
        }
    }, []);

    const login = async (email, password) => {
        const res = await API.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user || {}));
        setUser({ token: res.data.token, ...(res.data.user || {}) });
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
        <AuthContext.Provider value={{ user, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
