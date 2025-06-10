"""채팅 관련 API 엔드포인트"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json
import asyncio
from datetime import datetime, timedelta

from app.models.schemas import ChatRequest, ChatResponse
from app.services.bedrock_client import BedrockClient
from app.services.response_formatter import ResponseFormatter
from app.utils.session_manager import session_manager

router = APIRouter(prefix="/chat", tags=["chat"])

# 서비스 인스턴스
bedrock_client = BedrockClient()
response_formatter = ResponseFormatter()


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """기본 채팅 엔드포인트"""
    try:
        # 세션 관리
        session_id = session_manager.get_or_create_session(request.session_id)
        session_manager.add_message(session_id, "user", request.message)

        # 에이전트 선택 및 호출
        if request.mode == "QuickSight Mocking Agent":
            response = await _handle_quicksight_agent(request, session_id)
        elif request.mode == "Supervisor Agent":
            response = await _handle_supervisor_agent(request, session_id)
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 모드입니다.")

        # 응답 저장
        session_manager.add_message(session_id, "assistant", response.response)

        return response

    except Exception as e:
        return ChatResponse(
            response={"message": f"서버 오류: {str(e)}"},
            session_id=session_id,
            response_type="error",
            timestamp=datetime.now().isoformat()
        )


async def _handle_quicksight_agent(request: ChatRequest, session_id: str) -> ChatResponse:
    """QuickSight Agent 처리"""
    # 에이전트 설정 처리
    agent_id = None
    agent_alias_id = None

    if request.agent_config:
        config_agent_id = request.agent_config.get("agent_id")
        config_alias_id = request.agent_config.get("agent_alias_id")

        if config_agent_id and config_agent_id != "optional-override":
            agent_id = config_agent_id
        if config_alias_id and config_alias_id != "optional-override":
            agent_alias_id = config_alias_id

    # 에이전트 호출
    agent_response = bedrock_client.quicksight_agent_invoke(
        prompt_text=request.message,
        user_id=session_id,
        agent_id=agent_id,
        agent_alias_id=agent_alias_id
    )

    return _process_agent_response(agent_response, request.message, session_id, "quicksight")


async def _handle_supervisor_agent(request: ChatRequest, session_id: str) -> ChatResponse:
    """Supervisor Agent 처리"""
    agent_response = bedrock_client.supervisor_agent_invoke(
        prompt_text=request.message,
        user_id=session_id
    )

    return _process_agent_response(agent_response, request.message, session_id, "supervisor")


def _process_agent_response(
        agent_response: dict,
        message: str,
        session_id: str,
        agent_type: str
) -> ChatResponse:
    """에이전트 응답 처리"""
    if not agent_response["success"]:
        return ChatResponse(
            response={"message": f"에이전트 오류: {agent_response['error']}"},
            session_id=session_id,
            response_type="error",
            timestamp=datetime.now().isoformat()
        )

    if agent_response["response_type"] == "json":
        # JSON 응답 포맷팅
        if agent_type == "quicksight":
            formatted = response_formatter.format_quicksight_response(
                agent_response["data"], message
            )
        else:
            formatted = response_formatter.format_supervisor_response(
                agent_response["data"], message
            )

        return ChatResponse(
            response=formatted["data"],
            session_id=session_id,
            response_type=formatted["type"],
            timestamp=datetime.now().isoformat()
        )
    else:
        # 텍스트 응답
        return ChatResponse(
            response=agent_response["data"],
            session_id=session_id,
            response_type="text",
            timestamp=datetime.now().isoformat()
        )


@router.post("/stream/trace")
async def chat_stream_with_trace(request: ChatRequest):
    """Supervisor Agent Trace 스트리밍"""

    async def trace_event_generator() -> AsyncGenerator:
        try:
            session_id = session_manager.get_or_create_session(request.session_id)

            # 시작 메시지
            yield f"data: {json.dumps({
                'type': 'stream_start',
                'message': 'Supervisor Agent 분석을 시작합니다...',
                'timestamp': datetime.now().isoformat()
            }, ensure_ascii=False)}\n\n"

            # Trace 스트리밍
            async for trace_event in bedrock_client.supervisor_agent_invoke_with_trace(
                    prompt_text=request.message,
                    user_id=session_id
            ):
                # 이벤트 타입별 처리
                formatted_event = _format_trace_event(trace_event)
                if formatted_event:
                    yield f"data: {json.dumps(formatted_event, ensure_ascii=False)}\n\n"

                await asyncio.sleep(0)

        except Exception as e:
            yield f"data: {json.dumps({
                'type': 'error',
                'error': str(e),
                'message': '스트리밍 중 오류가 발생했습니다.'
            }, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        trace_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )


def _format_trace_event(trace_event: dict) -> dict:
    """Trace 이벤트 포맷팅"""
    event_type = trace_event.get("type")

    if event_type == "agent_invocation":
        agent_name = trace_event.get("agent", "Unknown Agent")
        display_name = _get_agent_display_name(agent_name)

        return {
            'type': 'agent_start',
            'agent': agent_name,
            'display_name': display_name,
            'message': f'{agent_name} 호출 중...',
            'timestamp': trace_event['timestamp']
        }

    elif event_type == "reasoning":
        return {
            'type': 'reasoning',
            'content': trace_event['rationale'],
            'timestamp': trace_event['timestamp']
        }

    elif event_type == "agent_response":
        return _format_agent_observation(trace_event)

    elif event_type == "final_response":
        return _format_final_response(trace_event)

    elif event_type == "error":
        return {
            'type': 'error',
            'error': trace_event['error'],
            'timestamp': trace_event['timestamp']
        }

    return None


def _get_agent_display_name(agent_name: str) -> str:
    """에이전트 표시 이름 매핑"""
    name_lower = agent_name.lower()

    if "refinement" in name_lower:
        return "Query Refinement Agent"
    elif "db" in name_lower or "database" in name_lower:
        return "Database Agent"
    elif "quicksight" in name_lower or "visualization" in name_lower:
        return "QuickSight Agent"

    return agent_name


def _format_agent_observation(trace_event: dict) -> dict:
    """에이전트 관찰 결과 포맷팅"""
    observation = trace_event.get("observation", {})

    # Knowledge Base 조회 결과
    if "knowledgeBaseLookupOutput" in observation:
        references = observation["knowledgeBaseLookupOutput"].get("retrievedReferences", [])
        return {
            'type': 'knowledge_base',
            'references_count': len(references),
            'message': f'Knowledge Base에서 {len(references)}개의 참조를 찾았습니다.',
            'timestamp': trace_event['timestamp']
        }

    # Action Group 실행 결과
    elif "actionGroupInvocationOutput" in observation:
        action_output = observation["actionGroupInvocationOutput"]
        action_name = action_output.get('actionGroupName', '')

        return {
            'type': 'action_complete',
            'action': action_name,
            'message': f'{action_name} 작업 완료',
            'timestamp': trace_event['timestamp'],
            'result_preview': action_output.get('text', '')[:200] + '...' if action_output.get('text') else ''
        }

    return None


import json

def _format_final_response(trace_event: dict) -> dict:
    """최종 응답 포맷팅"""
    parsed_result = trace_event.get('parsed', {})

    if parsed_result.get('success') and parsed_result.get('response_type') == 'json':
        formatted_response = response_formatter.format_supervisor_response(
            parsed_result.get('data', {}),
            ""  # TODO: 원본 메시지 전달 필요
        )

        return {
            'type': 'final_response',
            'result': formatted_response,
            'timestamp': trace_event['timestamp'],
            'success': True
        }
    else:
        # 기본 값: parsed_result의 data 또는 content 사용
        raw_data = parsed_result.get('data', trace_event.get('content', ''))
        parsed_data = raw_data

        # 만약 raw_data가 string인데 JSON 구조일 경우 parsing 시도
        if isinstance(raw_data, str):
            try:
                parsed_data = json.loads(raw_data)
            except json.JSONDecodeError:
                # fallback: string 그대로 유지
                pass

        return {
            'type': 'final_response',
            'result': {
                'type': 'text',
                'data': parsed_data
            },
            'timestamp': trace_event['timestamp'],
            'success': True
        }


@router.post("/stream/mockingtrace")
async def chat_stream_mockingtrace(request: ChatRequest):
    """모킹 트레이스 스트리밍 (테스트용)"""

    async def mock_event_generator():
        session_id = session_manager.get_or_create_session(request.session_id)

        # 미리 정의된 이벤트 시퀀스
        mock_events = _get_mock_trace_events()

        for idx, event in enumerate(mock_events):
            event["timestamp"] = (datetime.now() + timedelta(seconds=idx * 0.5)).isoformat()

            if event["type"] == "stream_start" and request.message:
                event["message"] = f"{event['message']} (사용자 요청: {request.message})"

            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.3)

    return StreamingResponse(
        mock_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )


def _get_mock_trace_events():
    """모킹 트레이스 이벤트 목록"""
    return [
        {
            "type": "stream_start",
            "message": "Supervisor Agent 분석을 시작합니다...",
        },
        {
            "type": "reasoning",
            "content": "To address this request, I'll need to...",
        },
        {
            "type": "agent_start",
            "agent": "Query Refinement Agent",
            "display_name": "Query Refinement Agent",
            "message": "Query Refinement Agent 호출 중..."
        },
        # ... 더 많은 이벤트들
        {
            "type": "final_response",
            "result": {
                "type": "text",
                "data": {
                    "query_id": "VOC_2025_01_ANALYSIS",
                    "query": "SELECT COUNT(*), category_name...",
                    "explanation": "2025년 1월 VOC 데이터의 종합 분석 결과입니다.",
                    "sample_analysis": "총 3,245건의 VOC 접수...",
                    "csv_url": "https://example.com/voc-analysis/2025-01/data.csv",
                    "chart_url": "https://example.com/quicksight/2025-01",
                    "visualization_analysis_result": "모바일 앱을 통한 불만 접수가 가장 많았으며..."
                }
            },
            "success": True
        }
    ]