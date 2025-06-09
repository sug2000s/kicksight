export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_URL || '',  // ← 이 부분!
    ENDPOINTS: {
        CHAT: '/api/chat',
        SESSION: '/api/session',
        AGENTS_CONFIG: '/api/agents/config',
        CHAT_STREAM: '/api/chat/stream'
    }
};

export const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
};