import axios from 'axios';
import { getClerkToken } from './clerkToken';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
    const token = await getClerkToken();

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
        const isAuthPage =
            window.location.pathname === '/login' ||
            window.location.pathname === '/register';

        // Only redirect on 401 for truly protected (non-optional) routes.
        // Game routes (/game/*) use optionalProtect — they return 401 only
        // for the /auth/* endpoints. Avoid redirect loops when Clerk is active.
        const isGameRoute = requestUrl.includes('/game/');
        const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

        if (
            err.response?.status === 401 &&
            !isAuthRequest &&
            !isAuthPage &&
            !isGameRoute &&
            !clerkEnabled
        ) {
            window.location.href = '/login';
        }

        return Promise.reject(err);
    }
);

export default api;
