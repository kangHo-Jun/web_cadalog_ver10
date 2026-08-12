import axios from 'axios';
import { getTokens, refreshAccessToken } from './cafe24-auth';

const mallId = process.env.MALL_ID;
if (!mallId) {
    console.error('❌ MALL_ID is missing; Cafe24 API requests will fail');
}

const apiClient = axios.create({
    baseURL: `https://${mallId}.cafe24api.com/api/v2/admin`,
    headers: {
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2025-12-01',
    },
});

// Request Interceptor: Add access token to headers
apiClient.interceptors.request.use(async (config) => {
    const { access_token } = await getTokens();
    if (access_token) {
        config.headers.Authorization = `Bearer ${access_token}`;
    } else {
        console.warn('⚠️ Cafe24 access_token is empty; request may be unauthorized');
    }
    return config;
});

// Response Interceptor: Handle 401 and refresh token
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                console.log('🔄 401 detected, attempting token refresh...');
                const newAccessToken = await refreshAccessToken();
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                console.error('❌ Token refresh failed');
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
