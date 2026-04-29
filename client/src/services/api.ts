import axios from 'axios';

declare global {
    interface Window {
        Clerk?: {
            session?: {
                getToken: () => Promise<string | null>;
            };
        };
    }
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
    const token = await window.Clerk?.session?.getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        const requestUrl = err.config?.url || '';
        const isAuthRequest = requestUrl.includes('/auth/');
        const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';

        if (err.response?.status === 401 && !isAuthRequest && !isAuthPage) {
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;
