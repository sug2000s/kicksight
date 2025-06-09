// services/api.ts
import { API_CONFIG, DEFAULT_HEADERS } from '../config/api';
import type { AnalysisResponse } from '../types';

export interface ChatRequest {
    message: string;
    session_id?: string;
    mode?: string;
    agent_config?: {
        agent_id?: string;
        agent_alias_id?: string;
    };
}

export interface ChatResponse {
    response: AnalysisResponse | string;
    session_id: string;
    response_type: 'text' | 'analysis' | 'table' | 'pie_chart' | 'line_chart' | 'error';
    timestamp: string;
}

export interface SessionInfo {
    session_id: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: any;
        timestamp: string;
    }>;
    created_at: string;
}

export interface AgentsConfig {
    quicksight_agent: {
        agent_id: string;
        agent_alias_id: string;
    };
    supervisor_agent: {
        agent_id: string;
        agent_alias_id: string;
    };
}

class ApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
    }

    async sendMessage(request: ChatRequest): Promise<ChatResponse> {
        try {
            const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.CHAT}`, {
                method: 'POST',
                headers: DEFAULT_HEADERS,
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async getSession(sessionId: string): Promise<SessionInfo> {
        try {
            const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.SESSION}/${sessionId}`, {
                method: 'GET',
                headers: DEFAULT_HEADERS,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching session:', error);
            throw error;
        }
    }

    async clearSession(sessionId: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.SESSION}/${sessionId}`, {
                method: 'DELETE',
                headers: DEFAULT_HEADERS,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error clearing session:', error);
            throw error;
        }
    }

    async getAgentsConfig(): Promise<AgentsConfig> {
        try {
            const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AGENTS_CONFIG}`, {
                method: 'GET',
                headers: DEFAULT_HEADERS,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching agents config:', error);
            throw error;
        }
    }

    // 스트리밍 지원을 위한 메서드 (추후 구현)
    async sendMessageStream(request: ChatRequest, onChunk: (chunk: string) => void): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.CHAT_STREAM}`, {
                method: 'POST',
                headers: DEFAULT_HEADERS,
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                onChunk(chunk);
            }
        } catch (error) {
            console.error('Error in streaming:', error);
            throw error;
        }
    }
}

export const apiService = new ApiService();