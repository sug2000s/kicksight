// utils/typeGuards.ts
import {
    AnalysisResponse,
    VOCAnalysisResponse,
    VOCTableResponse,
    PieChartResponse,
    LineChartResponse,
    ErrorResponse,
    SupervisorAgentResponse
} from '../types';

export function isVOCAnalysis(response: AnalysisResponse): response is VOCAnalysisResponse {
    return 'analysis_type' in response && response.analysis_type === 'VOC_DATA_ANALYSIS';
}

export function isVOCTable(response: AnalysisResponse): response is VOCTableResponse {
    return 'data_type' in response && response.data_type === 'VOC_TABLE';
}

export function isPieChart(response: AnalysisResponse): response is PieChartResponse {
    return 'chart_type' in response && response.chart_type === 'pie_chart';
}

export function isLineChart(response: AnalysisResponse): response is LineChartResponse {
    return 'chart_type' in response && response.chart_type === 'line_chart';
}

export function isError(response: AnalysisResponse): response is ErrorResponse {
    return 'message' in response && !('analysis_type' in response) && !('data_type' in response) && !('chart_type' in response);
}

export function isSupervisorAgentResponse(response: AnalysisResponse): response is SupervisorAgentResponse {
    return (
        response !== null &&
        typeof response === 'object' &&
        (
            ('query_id' in response && 'query' in response) ||
            'chart_url' in response
        )
    );
}