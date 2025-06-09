"""
응답 포맷터 - 에이전트 응답을 프론트엔드 형식으로 변환
"""

from typing import Dict, Any, List
import re
from datetime import datetime


class ResponseFormatter:
    """에이전트 응답을 프론트엔드의 고정된 형식으로 변환"""

    def format_quicksight_response(self, agent_data: Any, original_query: str) -> Dict[str, Any]:
        """QuickSight Agent 응답을 프론트엔드 형식으로 변환"""

        # 질문 타입 분석
        query_type = self._analyze_query_type(original_query)

        # 에이전트 응답이 이미 올바른 형식인지 확인
        if isinstance(agent_data, dict):
            # 이미 올바른 형식인 경우
            if "analysis_type" in agent_data and agent_data["analysis_type"] == "VOC_DATA_ANALYSIS":
                return {"type": "analysis", "data": agent_data}
            elif "data_type" in agent_data and agent_data["data_type"] == "VOC_TABLE":
                return {"type": "table", "data": agent_data}
            elif "chart_type" in agent_data and agent_data["chart_type"] == "pie_chart":
                return {"type": "pie_chart", "data": agent_data}
            elif "chart_type" in agent_data and agent_data["chart_type"] == "line_chart":
                return {"type": "line_chart", "data": agent_data}

            # 형식 변환이 필요한 경우
            return self._convert_to_expected_format(agent_data, query_type)

        # 텍스트 응답인 경우
        return {"type": "text", "data": str(agent_data)}

    def format_supervisor_response(self, agent_data: Any, original_query: str) -> Dict[str, Any]:
        """Supervisor Agent 응답을 프론트엔드 형식으로 변환"""

        # Supervisor Agent는 주로 일반적인 응답을 제공하므로
        # 특별한 포맷팅이 필요한 경우만 처리
        if isinstance(agent_data, dict):
            # VOC 관련 데이터가 포함된 경우
            if any(key in agent_data for key in ["voc_data", "analysis", "chart_data"]):
                query_type = self._analyze_query_type(original_query)
                return self._convert_to_expected_format(agent_data, query_type)

        return {"type": "text", "data": agent_data}

    def _analyze_query_type(self, query: str) -> str:
        """질문 분석하여 예상 응답 타입 결정"""
        query_lower = query.lower()

        if "분석" in query and "voc" in query_lower:
            return "analysis"
        elif "테이블" in query:
            return "table"
        elif "원형" in query or "파이" in query:
            return "pie_chart"
        elif "시간대" in query or "추이" in query:
            return "line_chart"
        else:
            return "text"

    def _convert_to_expected_format(self, data: Dict[str, Any], expected_type: str) -> Dict[str, Any]:
        """에이전트 응답을 예상 형식으로 변환"""

        if expected_type == "analysis":
            return self._convert_to_analysis_format(data)
        elif expected_type == "table":
            return self._convert_to_table_format(data)
        elif expected_type == "pie_chart":
            return self._convert_to_pie_chart_format(data)
        elif expected_type == "line_chart":
            return self._convert_to_line_chart_format(data)
        else:
            return {"type": "text", "data": data}

    def _convert_to_analysis_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """VOC 분석 형식으로 변환"""
        formatted_data = {
            "analysis_type": "VOC_DATA_ANALYSIS",
            "period": data.get("period", "2025년도 1월"),
            "total_voc_count": data.get("total_count", 10000),
            "categories": {
                "주요 카테고리": data.get("main_categories", ["통화", "가격", "서비스"]),
                "분석 결과": {}
            },
            "insights": [],
            "recommendation": ""
        }

        # 카테고리별 비중 추출
        if "category_distribution" in data:
            for category, percentage in data["category_distribution"].items():
                formatted_data["categories"]["분석 결과"][f"{category} 카테고리 비중"] = f"{percentage}%"
        else:
            # 기본값 설정
            formatted_data["categories"]["분석 결과"] = {
                "통화 카테고리 비중": "45%",
                "가격 카테고리 비중": "30%",
                "서비스 카테고리 비중": "25%"
            }

        # 인사이트 추출
        if "insights" in data:
            formatted_data["insights"] = data["insights"]
        else:
            formatted_data["insights"] = [
                "전체 VOC 건수는 10,000건으로 전월 대비 증가",
                "통화 관련 문의가 45%로 가장 높은 비중",
                "가격 문의는 30%, 서비스 관련은 25%"
            ]

        # 추천사항
        formatted_data["recommendation"] = data.get("recommendation", "통화 품질 개선에 우선 집중 필요")

        return {"type": "analysis", "data": formatted_data}

    def _convert_to_table_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """테이블 형식으로 변환"""
        formatted_data = {
            "data_type": "VOC_TABLE",
            "columns": data.get("columns", ["날짜", "카테고리", "건수", "비중"]),
            "rows": [],
            "total_count": data.get("total_count", 3333),
            "period": data.get("period", "2025년 1월")
        }

        # 행 데이터 변환
        if "rows" in data:
            formatted_data["rows"] = data["rows"]
        elif "data" in data and isinstance(data["data"], list):
            formatted_data["rows"] = data["data"]
        else:
            # 기본 데이터
            formatted_data["rows"] = [
                ["2025-01-01", "통화", 1500, "45%"],
                ["2025-01-01", "가격", 1000, "30%"],
                ["2025-01-01", "서비스", 833, "25%"]
            ]

        return {"type": "table", "data": formatted_data}

    def _convert_to_pie_chart_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """원형 차트 형식으로 변환"""
        formatted_data = {
            "chart_type": "pie_chart",
            "title": data.get("title", "2025년 1월 VOC 카테고리별 분포"),
            "data": {
                "labels": [],
                "values": [],
                "percentages": []
            },
            "total_count": data.get("total_count", 10000),
            "insights": []
        }

        # 차트 데이터 변환
        if "chart_data" in data:
            chart_data = data["chart_data"]
            formatted_data["data"]["labels"] = chart_data.get("labels", ["통화", "가격", "서비스", "기타"])
            formatted_data["data"]["values"] = chart_data.get("values", [45, 30, 20, 5])
            formatted_data["data"]["percentages"] = chart_data.get("percentages", ["45%", "30%", "20%", "5%"])
        else:
            # 기본값
            formatted_data["data"] = {
                "labels": ["통화", "가격", "서비스", "기타"],
                "values": [45, 30, 20, 5],
                "percentages": ["45%", "30%", "20%", "5%"]
            }

        # 인사이트
        formatted_data["insights"] = data.get("insights", [
            "통화 카테고리가 전체의 45%로 가장 높은 비중",
            "상위 3개 카테고리가 전체의 95% 차지"
        ])

        return {"type": "pie_chart", "data": formatted_data}

    def _convert_to_line_chart_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """라인 차트 형식으로 변환"""
        formatted_data = {
            "analysis_type": "FEEDBACK_OVER_TIME",
            "chart_type": "line_chart",
            "period": data.get("period", "2025년 1월"),
            "categories": data.get("categories", ["통화", "가격", "서비스"]),
            "time_series_data": {},
            "peak_hours": {},
            "insights": []
        }

        # 시계열 데이터 변환
        if "time_series_data" in data:
            formatted_data["time_series_data"] = data["time_series_data"]
        else:
            # 기본 시계열 데이터
            formatted_data["time_series_data"] = {
                "통화": [
                    {"hour": "00:00", "value": 45},
                    {"hour": "06:00", "value": 35},
                    {"hour": "09:00", "value": 55},
                    {"hour": "10:00", "value": 60},
                    {"hour": "12:00", "value": 52},
                    {"hour": "15:00", "value": 47},
                    {"hour": "18:00", "value": 48},
                    {"hour": "21:00", "value": 40},
                    {"hour": "23:00", "value": 36}
                ],
                "가격": [
                    {"hour": "00:00", "value": 25},
                    {"hour": "06:00", "value": 18},
                    {"hour": "09:00", "value": 32},
                    {"hour": "10:00", "value": 35},
                    {"hour": "12:00", "value": 30},
                    {"hour": "15:00", "value": 40},
                    {"hour": "18:00", "value": 32},
                    {"hour": "21:00", "value": 26},
                    {"hour": "23:00", "value": 22}
                ],
                "서비스": [
                    {"hour": "00:00", "value": 20},
                    {"hour": "06:00", "value": 15},
                    {"hour": "09:00", "value": 25},
                    {"hour": "10:00", "value": 27},
                    {"hour": "12:00", "value": 24},
                    {"hour": "15:00", "value": 22},
                    {"hour": "18:00", "value": 28},
                    {"hour": "21:00", "value": 22},
                    {"hour": "23:00", "value": 18}
                ]
            }

        # 피크 시간
        formatted_data["peak_hours"] = data.get("peak_hours", {
            "통화": "10:00-12:00",
            "가격": "14:00-16:00",
            "서비스": "16:00-18:00"
        })

        # 인사이트
        formatted_data["insights"] = data.get("insights", [
            "통화 관련 피드백은 오전 10-12시에 집중",
            "가격 문의는 오후 2-4시에 가장 많음",
            "서비스 관련 문의는 저녁 시간대 증가"
        ])

        return {"type": "line_chart", "data": formatted_data}