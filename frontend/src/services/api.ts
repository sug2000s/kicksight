// services/api.ts
import { API_CONFIG, DEFAULT_HEADERS } from '../config/api';
import type { AnalysisResponse, AgentsConfigResponse } from '../types';

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

export interface StreamEvent {
    type: 'stream_start' | 'reasoning' | 'agent_start' | 'knowledge_base' |
        'query_execution' | 'visualization_created' | 'error' | 'final_response' | string;
    message?: string;
    content?: string;
    agent?: string;
    display_name?: string;
    references_count?: number;
    query_id?: string;
    chart_type?: string;
    result?: any;
    timestamp: string;
    success?: boolean;
}

// 추가로 필요할 수 있는 특정 이벤트 타입들
export interface AgentStartEvent extends StreamEvent {
    type: 'agent_start';
    agent: string;
    display_name: string;
    message: string;
}

export interface KnowledgeBaseEvent extends StreamEvent {
    type: 'knowledge_base';
    references_count: number;
    message: string;
}

export interface QueryExecutionEvent extends StreamEvent {
    type: 'query_execution';
    query_id: string;
    message?: string;
}

export interface VisualizationCreatedEvent extends StreamEvent {
    type: 'visualization_created';
    chart_type: string;
    message?: string;
}

export interface FinalResponseEvent extends StreamEvent {
    type: 'final_response';
    result: {
        type: string;
        data: any;
    };
    success: boolean;
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

    async getAgentsConfig(): Promise<AgentsConfigResponse> {
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

    // Supervisor Agent를 위한 스트리밍 메서드
    async sendMessageStreamTrace(
        request: {
            message: string;
            mode: string;
            session_id?: string;
            agent_config?: {
                agent_id: string;
                agent_alias_id: string;
            };
        },
        onEvent: (event: StreamEvent) => void
    ): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.CHAT_STREAM_TRACE}`, {
                method: 'POST',
                headers: {
                    ...DEFAULT_HEADERS,
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE messages
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            onEvent(data);
                        } catch (error) {
                            console.error('Error parsing SSE data:', error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in streaming:', error);
            throw error;
        }
    }

    // 기존 스트리밍 메서드 (QuickSight Agent용)
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