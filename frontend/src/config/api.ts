// config/api.ts
export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_URL || '',  // ← 이 부분!
    ENDPOINTS: {
        CHAT: '/api/chat',
        CHAT_STREAM: '/api/chat/stream',
        CHAT_STREAM_TRACE: '/api/chat/stream/trace',
        SESSION: '/api/session',
        AGENTS_CONFIG: '/api/agents/config'
    }
} as const;

export const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
} as const;