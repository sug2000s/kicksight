// types/index.ts
export interface Message {
    id: number;
    type: 'user' | 'bot' | 'bot-reasoning';
    content: string | AnalysisResponse;
    timestamp: string;
}

export interface Conversation {
    id: number;
    title: string;
    messages: Message[];
}

export interface VOCAnalysisResponse {
    analysis_type: string;
    period: string;
    total_voc_count: number;
    categories: {
        "주요 카테고리": string[];
        "분석 결과": Record<string, string>;
    };
    insights: string[];
    recommendation: string;
}

export interface VOCTableResponse {
    data_type: string;
    columns: string[];
    rows: Array<Array<string | number>>;
    total_count: number;
    period: string;
}

export interface PieChartResponse {
    chart_type: string;
    title: string;
    data: {
        labels: string[];
        values: number[];
        percentages: string[];
    };
    total_count: number;
    insights: string[];
}

export interface LineChartResponse {
    analysis_type: string;
    chart_type: string;
    period: string;
    categories: string[];
    time_series_data: Record<string, Array<{ hour: string; value: number }>>;
    peak_hours: Record<string, string>;
    insights: string[];
}

export interface ErrorResponse {
    message: string;
}

export type AnalysisResponse = VOCAnalysisResponse | VOCTableResponse | PieChartResponse | LineChartResponse | ErrorResponse;

export interface ReasoningStep {
    text: string;
    duration: number;
    icon: React.FC;
}

// types/index.ts에 추가
export interface AppConfig {
    apiUrl: string;
    debug: boolean;
    mode: 'development' | 'production';
}

export interface ChatState {
    conversations: Conversation[];
    activeConversationId: number;
    sessionId: string | null;
    isConnected: boolean;
}

// ── near your other type-guard imports or just above KickSightApp ──
export interface SupervisorAgentResponse {
    query_id?: string;
    query?: string;
    explanation?: string;
    sample_analysis?: string;
    csv_url?: string;
    chart_url?: string;
    visualization_analysis_result?: string;
}

