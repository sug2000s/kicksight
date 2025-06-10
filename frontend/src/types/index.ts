// types/index.ts
export interface Message {
    id: number;
    type: 'user' | 'bot' | 'bot-reasoning';
    content: string | SupervisorAgentResponse | ErrorResponse;
    timestamp: string;
}

export interface Conversation {
    id: number;
    title: string;
    messages: Message[];
}

// Supervisor Agent 응답 타입
export interface SupervisorAgentResponse {
    // DB Agent 관련 필드
    query_id?: string;
    query?: string;
    explanation?: string;
    sample_analysis?: string;
    csv_url?: string;

    // QuickSight Agent 관련 필드
    chart_url?: string;
    visualization_analysis_result?: string;
}

// QuickSight iframe 응답 타입
export interface QuickSightIFrameResponse {
    type: 'quicksight_iframe';
    url: string;
    title?: string;
}

// 에러 응답 타입
export interface ErrorResponse {
    message: string;
}

// 분석 응답 통합 타입
export type AnalysisResponse = SupervisorAgentResponse | QuickSightIFrameResponse | ErrorResponse;

// 스트리밍 이벤트 타입 (useChat에서 사용)
export interface StreamEvent {
    type: 'stream_start' | 'reasoning' | 'agent_start' | 'knowledge_base' |
        'query_execution' | 'visualization_created' | 'error' | 'final_response' | string;
    message?: string;
    content?: string;
    display_name?: string;
    agent?: string;
    references_count?: number;
    query_id?: string;
    chart_type?: string;
    result?: any;
    success?: boolean;
    timestamp?: string;
}

// 채팅 상태 관리 타입
export interface ChatState {
    conversations: Conversation[];
    activeConversationId: number;
    sessionId: string | null;
    isConnected: boolean;
}

// 앱 설정 타입
export interface AppConfig {
    apiUrl: string;
    debug: boolean;
    mode: 'development' | 'production';
}