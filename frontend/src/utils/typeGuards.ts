// utils/typeGuards.ts
import {
    AnalysisResponse,
    SupervisorAgentResponse,
    QuickSightIFrameResponse,
    ErrorResponse
} from '../types';

// Supervisor Agent 응답인지 확인
export function isSupervisorAgentResponse(response: AnalysisResponse): response is SupervisorAgentResponse {
    return (
        response !== null &&
        typeof response === 'object' &&
        !('type' in response) && // QuickSightIFrameResponse가 아님
        !('message' in response && Object.keys(response).length === 1) && // 단순 에러가 아님
        (
            'query_id' in response ||
            'query' in response ||
            'chart_url' in response ||
            'explanation' in response ||
            'visualization_analysis_result' in response
        )
    );
}

// QuickSight iframe 응답인지 확인
export function isQuickSightIFrameResponse(response: AnalysisResponse): response is QuickSightIFrameResponse {
    return (
        response !== null &&
        typeof response === 'object' &&
        'type' in response &&
        response.type === 'quicksight_iframe' &&
        'url' in response
    );
}

// 에러 응답인지 확인
export function isError(response: AnalysisResponse): response is ErrorResponse {
    return (
        response !== null &&
        typeof response === 'object' &&
        'message' in response &&
        Object.keys(response).length === 1
    );
}

// 스트리밍 이벤트 타입 확인
export function isValidStreamEventType(type: string): boolean {
    const validTypes = [
        'stream_start',
        'reasoning',
        'agent_start',
        'knowledge_base',
        'query_execution',
        'visualization_created',
        'error',
        'final_response'
    ];
    return validTypes.includes(type);
}