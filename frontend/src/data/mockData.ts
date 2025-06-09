// data/mockData.ts
import { AnalysisResponse, ReasoningStep } from '../types';
import { SearchIcon, DatabaseIcon, GearIcon, ChartLineIcon, CalculatorIcon, ChartIcon } from '../components/icons';

export const mockResponses: Record<string, AnalysisResponse> = {
    "2025년도 1월 VOC 데이터 분석 결과를 보여줘": {
        analysis_type: "VOC_DATA_ANALYSIS",
        period: "2025년도 1월",
        total_voc_count: 10000,
        categories: {
            "주요 카테고리": ["통화", "가격", "서비스"],
            "분석 결과": {
                "통화 카테고리 비중": "45%",
                "가격 카테고리 비중": "30%",
                "서비스 카테고리 비중": "25%"
            }
        },
        insights: [
            "전체 VOC 건수는 10,000건으로 전월 대비 증가",
            "통화 관련 문의가 45%로 가장 높은 비중",
            "가격 문의는 30%, 서비스 관련은 25%"
        ],
        recommendation: "통화 품질 개선에 우선 집중 필요"
    },
    "VOC 데이터를 테이블로 보여줘": {
        data_type: "VOC_TABLE",
        columns: ["날짜", "카테고리", "건수", "비중"],
        rows: [
            ["2025-01-01", "통화", 1500, "45%"],
            ["2025-01-01", "가격", 1000, "30%"],
            ["2025-01-01", "서비스", 833, "25%"]
        ],
        total_count: 3333,
        period: "2025년 1월"
    },
    "카테고리별 분포를 원형 차트로 보여줘": {
        chart_type: "pie_chart",
        title: "2025년 1월 VOC 카테고리별 분포",
        data: {
            labels: ["통화", "가격", "서비스", "기타"],
            values: [45, 30, 20, 5],
            percentages: ["45%", "30%", "20%", "5%"]
        },
        total_count: 10000,
        insights: [
            "통화 카테고리가 전체의 45%로 가장 높은 비중",
            "상위 3개 카테고리가 전체의 95% 차지"
        ]
    },
    "시간대별 피드백 추이를 보여줘": {
        analysis_type: "FEEDBACK_OVER_TIME",
        chart_type: "line_chart",
        period: "2025년 1월",
        categories: ["통화", "가격", "서비스"],
        time_series_data: {
            "통화": [
                {hour: "00:00", value: 45},
                {hour: "06:00", value: 35},
                {hour: "09:00", value: 55},
                {hour: "10:00", value: 60},
                {hour: "12:00", value: 52},
                {hour: "15:00", value: 47},
                {hour: "18:00", value: 48},
                {hour: "21:00", value: 40},
                {hour: "23:00", value: 36}
            ],
            "가격": [
                {hour: "00:00", value: 25},
                {hour: "06:00", value: 18},
                {hour: "09:00", value: 32},
                {hour: "10:00", value: 35},
                {hour: "12:00", value: 30},
                {hour: "15:00", value: 40},
                {hour: "18:00", value: 32},
                {hour: "21:00", value: 26},
                {hour: "23:00", value: 22}
            ],
            "서비스": [
                {hour: "00:00", value: 20},
                {hour: "06:00", value: 15},
                {hour: "09:00", value: 25},
                {hour: "10:00", value: 27},
                {hour: "12:00", value: 24},
                {hour: "15:00", value: 22},
                {hour: "18:00", value: 28},
                {hour: "21:00", value: 22},
                {hour: "23:00", value: 18}
            ]
        },
        peak_hours: {
            "통화": "10:00-12:00",
            "가격": "14:00-16:00",
            "서비스": "16:00-18:00"
        },
        insights: [
            "통화 관련 피드백은 오전 10-12시에 집중",
            "가격 문의는 오후 2-4시에 가장 많음",
            "서비스 관련 문의는 저녁 시간대 증가"
        ]
    }
};

export const reasoningSteps: Record<string, ReasoningStep[]> = {
    analysis: [
        { text: "질문을 분석하고 있습니다...", duration: 600, icon: SearchIcon },
        { text: "VOC 데이터베이스에 접속 중...", duration: 800, icon: DatabaseIcon },
        { text: "데이터를 수집하고 있습니다...", duration: 1000, icon: GearIcon },
        { text: "분석 결과를 생성하고 있습니다...", duration: 600, icon: ChartLineIcon }
    ],
    table: [
        { text: "테이블 구조를 준비하고 있습니다...", duration: 500, icon: GearIcon },
        { text: "데이터를 조회하고 있습니다...", duration: 800, icon: DatabaseIcon },
        { text: "테이블 형식으로 변환 중...", duration: 700, icon: CalculatorIcon }
    ],
    pieChart: [
        { text: "카테고리 데이터를 수집하고 있습니다...", duration: 600, icon: DatabaseIcon },
        { text: "비율을 계산하고 있습니다...", duration: 700, icon: CalculatorIcon },
        { text: "원형 차트를 생성하고 있습니다...", duration: 800, icon: ChartIcon }
    ],
    lineChart: [
        { text: "시계열 데이터를 불러오고 있습니다...", duration: 700, icon: DatabaseIcon },
        { text: "시간대별 추이를 분석 중...", duration: 900, icon: GearIcon },
        { text: "피크 시간을 계산하고 있습니다...", duration: 600, icon: CalculatorIcon },
        { text: "라인 차트를 그리고 있습니다...", duration: 700, icon: ChartLineIcon }
    ],
    default: [
        { text: "요청을 처리하고 있습니다...", duration: 1000, icon: GearIcon }
    ]
};

export const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];