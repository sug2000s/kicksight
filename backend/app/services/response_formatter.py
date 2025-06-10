"""응답 포맷터 서비스"""
from typing import Dict, Any, List, Optional
from datetime import datetime


class ResponseFormatter:
    """에이전트 응답을 프론트엔드 형식으로 변환하는 포맷터"""

    def format_quicksight_response(self, data: Any, original_query: str) -> Dict[str, Any]:
        """QuickSight Agent 응답 포맷팅"""
        # 텍스트 응답인 경우
        if isinstance(data, str):
            return {
                "type": "text",
                "data": data
            }

        # JSON 응답인 경우
        if isinstance(data, dict):
            # 에러 응답
            if "error" in data:
                return {
                    "type": "error",
                    "data": {
                        "message": data.get("error", "알 수 없는 오류가 발생했습니다.")
                    }
                }

            # 차트 응답
            if "chart_type" in data:
                return self._format_chart_response(data)

            # 테이블 응답
            if "table_data" in data or "columns" in data:
                return self._format_table_response(data)

            # 분석 응답
            if any(key in data for key in ["query", "analysis", "result", "csv_url"]):
                return self._format_analysis_response(data)

            # QuickSight 대시보드 응답
            if "dashboard_url" in data or "quicksight_url" in data:
                return self._format_dashboard_response(data)

        # 기본 텍스트 응답
        return {
            "type": "text",
            "data": str(data)
        }

    def format_supervisor_response(self, data: Any, original_query: str) -> Dict[str, Any]:
        """Supervisor Agent 응답 포맷팅"""
        # QuickSight 포맷터와 유사하지만 Supervisor 특화 처리 추가
        if isinstance(data, str):
            return {
                "type": "text",
                "data": data
            }

        if isinstance(data, dict):
            # Supervisor Agent 특화 응답 처리
            if "agent_chain" in data:
                return self._format_agent_chain_response(data)

            # 통합 분석 결과
            if "integrated_analysis" in data:
                return self._format_integrated_analysis(data)

            # 기본적으로 QuickSight와 동일한 포맷 사용
            return self.format_quicksight_response(data, original_query)

        return {
            "type": "text",
            "data": str(data)
        }

    def _format_chart_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """차트 응답 포맷팅"""
        chart_type = data.get("chart_type", "line")

        # 차트 데이터 검증 및 변환
        chart_data = {
            "type": self._map_chart_type(chart_type),
            "data": {
                "title": data.get("title", "차트"),
                "chart_type": chart_type,
                "labels": data.get("labels", []),
                "datasets": self._format_datasets(data.get("datasets", [])),
                "options": self._get_chart_options(chart_type, data)
            }
        }

        # 추가 메타데이터
        if "description" in data:
            chart_data["data"]["description"] = data["description"]

        if "source" in data:
            chart_data["data"]["source"] = data["source"]

        return chart_data

    def _format_table_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """테이블 응답 포맷팅"""
        return {
            "type": "table",
            "data": {
                "title": data.get("title", "데이터 테이블"),
                "columns": self._format_table_columns(data.get("columns", [])),
                "rows": data.get("rows", data.get("table_data", [])),
                "summary": data.get("summary", ""),
                "total_count": data.get("total_count", len(data.get("rows", [])))
            }
        }

    def _format_analysis_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """분석 응답 포맷팅"""
        return {
            "type": "analysis",
            "data": {
                "query_id": data.get("query_id", ""),
                "query": data.get("query", ""),
                "explanation": data.get("explanation", data.get("analysis", "")),
                "result": data.get("result", data.get("sample_analysis", "")),
                "csv_url": data.get("csv_url", ""),
                "chart_url": data.get("chart_url", data.get("quicksight_url", "")),
                "visualization_analysis_result": data.get("visualization_analysis_result", ""),
                "recommendations": data.get("recommendations", []),
                "timestamp": data.get("timestamp", datetime.now().isoformat())
            }
        }

    def _format_dashboard_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """대시보드 응답 포맷팅"""
        return {
            "type": "dashboard",
            "data": {
                "dashboard_url": data.get("dashboard_url", data.get("quicksight_url", "")),
                "dashboard_id": data.get("dashboard_id", ""),
                "title": data.get("title", "QuickSight Dashboard"),
                "description": data.get("description", ""),
                "widgets": data.get("widgets", []),
                "filters": data.get("filters", []),
                "created_at": data.get("created_at", datetime.now().isoformat())
            }
        }

    def _format_agent_chain_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """에이전트 체인 응답 포맷팅"""
        return {
            "type": "agent_chain",
            "data": {
                "chain": data.get("agent_chain", []),
                "summary": data.get("summary", ""),
                "total_agents": len(data.get("agent_chain", [])),
                "execution_time": data.get("execution_time", ""),
                "final_result": data.get("final_result", {})
            }
        }

    def _format_integrated_analysis(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """통합 분석 응답 포맷팅"""
        return {
            "type": "integrated_analysis",
            "data": {
                "summary": data.get("integrated_analysis", {}).get("summary", ""),
                "key_findings": data.get("integrated_analysis", {}).get("key_findings", []),
                "data_sources": data.get("integrated_analysis", {}).get("sources", []),
                "visualizations": data.get("integrated_analysis", {}).get("visualizations", []),
                "recommendations": data.get("integrated_analysis", {}).get("recommendations", []),
                "confidence_score": data.get("integrated_analysis", {}).get("confidence", 0.0)
            }
        }

    def _map_chart_type(self, chart_type: str) -> str:
        """차트 타입 매핑"""
        chart_map = {
            "line": "line_chart",
            "bar": "bar_chart",
            "pie": "pie_chart",
            "doughnut": "doughnut_chart",
            "scatter": "scatter_chart",
            "area": "area_chart",
            "radar": "radar_chart"
        }
        return chart_map.get(chart_type.lower(), "line_chart")

    def _format_datasets(self, datasets: List[Any]) -> List[Dict[str, Any]]:
        """데이터셋 포맷팅"""
        formatted_datasets = []

        for idx, dataset in enumerate(datasets):
            if isinstance(dataset, dict):
                formatted_datasets.append(dataset)
            else:
                # 단순 데이터 배열인 경우
                formatted_datasets.append({
                    "label": f"Dataset {idx + 1}",
                    "data": dataset if isinstance(dataset, list) else [dataset],
                    "borderColor": self._get_color(idx),
                    "backgroundColor": self._get_color(idx, 0.2)
                })

        return formatted_datasets

    def _format_table_columns(self, columns: List[Any]) -> List[Dict[str, str]]:
        """테이블 컬럼 포맷팅"""
        formatted_columns = []

        for col in columns:
            if isinstance(col, dict):
                formatted_columns.append(col)
            else:
                # 단순 문자열인 경우
                formatted_columns.append({
                    "key": str(col).lower().replace(" ", "_"),
                    "label": str(col),
                    "sortable": True
                })

        return formatted_columns

    def _get_chart_options(self, chart_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """차트 옵션 생성"""
        base_options = {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "legend": {
                    "display": True,
                    "position": "top"
                },
                "tooltip": {
                    "enabled": True
                }
            }
        }

        # 차트 타입별 특화 옵션
        if chart_type in ["line", "bar", "area"]:
            base_options["scales"] = {
                "x": {
                    "display": True,
                    "title": {
                        "display": True,
                        "text": data.get("x_label", "")
                    }
                },
                "y": {
                    "display": True,
                    "title": {
                        "display": True,
                        "text": data.get("y_label", "")
                    }
                }
            }
        elif chart_type in ["pie", "doughnut"]:
            base_options["plugins"]["legend"]["position"] = "right"

        # 사용자 정의 옵션 병합
        if "options" in data:
            self._deep_merge(base_options, data["options"])

        return base_options

    def _get_color(self, index: int, alpha: float = 1.0) -> str:
        """인덱스 기반 색상 생성"""
        colors = [
            (54, 162, 235),  # Blue
            (255, 99, 132),  # Red
            (255, 206, 86),  # Yellow
            (75, 192, 192),  # Teal
            (153, 102, 255),  # Purple
            (255, 159, 64),  # Orange
            (199, 199, 199),  # Grey
            (83, 102, 255),  # Indigo
            (255, 99, 255),  # Pink
            (99, 255, 132),  # Green
        ]

        color = colors[index % len(colors)]

        if alpha < 1.0:
            return f"rgba({color[0]}, {color[1]}, {color[2]}, {alpha})"
        else:
            return f"rgb({color[0]}, {color[1]}, {color[2]})"

    def _deep_merge(self, base: dict, update: dict) -> dict:
        """딕셔너리 깊은 병합"""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value
        return base