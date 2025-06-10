
##main.py
"""
FastAPI 백엔드 서버 - AWS Bedrock 에이전트 연동
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import json
import uuid
import os
from dotenv import load_dotenv
from app.bedrock_client import BedrockClient
from app.response_formatter import ResponseFormatter
import asyncio
from datetime import datetime

import itertools
from datetime import datetime, timedelta
import json, asyncio, uuid
from fastapi.responses import StreamingResponse

load_dotenv()

app = FastAPI(
    title="KickSight Backend API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],  # React 개발 서버
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bedrock 클라이언트 초기화
bedrock_client = BedrockClient()
response_formatter = ResponseFormatter()

# 세션 저장소 (실제로는 Redis 등을 사용해야 함)
sessions = {}


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    mode: str = "QuickSight Mocking Agent"  # 또는 "Supervisor Agent"
    agent_config: Optional[Dict[str, str]] = None


class ChatResponse(BaseModel):
    response: Any  # 다양한 형식의 응답을 위해 Any 사용
    session_id: str
    response_type: str  # "text", "analysis", "table", "pie_chart", "line_chart", "error"
    timestamp: str


class SessionInfo(BaseModel):
    session_id: str
    messages: List[Dict[str, Any]]
    created_at: str


@app.on_event("startup")
async def startup_event():
    """애플리케이션 시작 시 환경 변수 확인"""
    print("🚀 Starting KickSight Backend API")
    print(f"📍 AWS Region: {os.getenv('AWS_DEFAULT_REGION', 'Not set')}")
    print(f"🤖 QuickSight Agent ID: {os.getenv('QUICKSIGHT_AGENT_ID', 'Not set')}")
    print(f"🤖 Supervisor Agent ID: {os.getenv('BEDROCK_SUPERVISOR_AGENT_ID', 'Not set')}")


@app.get("/api")
async def root():
    return {"message": "KickSight Backend API", "status": "running"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """채팅 엔드포인트 - 에이전트 호출 및 응답 포맷팅"""
    print(f"📨 Received request: message='{request.message}', mode='{request.mode}'")

    try:
        # 세션 ID 생성 또는 가져오기
        session_id = request.session_id or str(uuid.uuid4())

        # 세션 초기화
        if session_id not in sessions:
            sessions[session_id] = {
                "messages": [],
                "created_at": datetime.now().isoformat()
            }

        # 사용자 메시지 추가
        sessions[session_id]["messages"].append({
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now().isoformat()
        })

        # QuickSight Mocking Agent 호출
        if request.mode == "QuickSight Mocking Agent":
            # 에이전트 설정
            agent_id = None
            agent_alias_id = None

            if request.agent_config:
                # "optional-override" 같은 예시 값 필터링
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

            if agent_response["success"]:
                if agent_response["response_type"] == "json":
                    # JSON 응답을 프론트엔드 형식으로 변환
                    formatted_response = response_formatter.format_quicksight_response(
                        agent_response["data"],
                        request.message
                    )

                    # 응답 저장
                    sessions[session_id]["messages"].append({
                        "role": "assistant",
                        "content": formatted_response["data"],
                        "timestamp": datetime.now().isoformat()
                    })

                    return ChatResponse(
                        response=formatted_response["data"],
                        session_id=session_id,
                        response_type=formatted_response["type"],
                        timestamp=datetime.now().isoformat()
                    )
                else:
                    # 텍스트 응답
                    sessions[session_id]["messages"].append({
                        "role": "assistant",
                        "content": agent_response["data"],
                        "timestamp": datetime.now().isoformat()
                    })

                    return ChatResponse(
                        response=agent_response["data"],
                        session_id=session_id,
                        response_type="text",
                        timestamp=datetime.now().isoformat()
                    )
            else:
                # 에러 응답
                error_response = {
                    "message": f"에이전트 오류: {agent_response['error']}"
                }

                return ChatResponse(
                    response=error_response,
                    session_id=session_id,
                    response_type="error",
                    timestamp=datetime.now().isoformat()
                )

        # Supervisor Agent 호출
        elif request.mode == "Supervisor Agent":
            agent_response = bedrock_client.supervisor_agent_invoke(
                prompt_text=request.message,
                user_id=session_id
            )

            if agent_response["success"]:
                if agent_response["response_type"] == "json":
                    # Supervisor Agent의 JSON 응답 처리
                    formatted_response = response_formatter.format_supervisor_response(
                        agent_response["data"],
                        request.message
                    )

                    sessions[session_id]["messages"].append({
                        "role": "assistant",
                        "content": formatted_response["data"],
                        "timestamp": datetime.now().isoformat()
                    })

                    return ChatResponse(
                        response=formatted_response["data"],
                        session_id=session_id,
                        response_type=formatted_response["type"],
                        timestamp=datetime.now().isoformat()
                    )
                else:
                    # 텍스트 응답
                    sessions[session_id]["messages"].append({
                        "role": "assistant",
                        "content": agent_response["data"],
                        "timestamp": datetime.now().isoformat()
                    })

                    return ChatResponse(
                        response=agent_response["data"],
                        session_id=session_id,
                        response_type="text",
                        timestamp=datetime.now().isoformat()
                    )
            else:
                error_response = {
                    "message": f"에이전트 오류: {agent_response['error']}"
                }

                return ChatResponse(
                    response=error_response,
                    session_id=session_id,
                    response_type="error",
                    timestamp=datetime.now().isoformat()
                )

        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 모드입니다.")

    except Exception as e:
        error_response = {
            "message": f"서버 오류: {str(e)}"
        }

        return ChatResponse(
            response=error_response,
            session_id=session_id,
            response_type="error",
            timestamp=datetime.now().isoformat()
        )


@app.get("/api/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    """세션 정보 조회"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return SessionInfo(
        session_id=session_id,
        messages=sessions[session_id]["messages"],
        created_at=sessions[session_id]["created_at"]
    )


@app.delete("/api/session/{session_id}")
async def clear_session(session_id: str):
    """세션 초기화"""
    if session_id in sessions:
        del sessions[session_id]

    return {"message": "세션이 초기화되었습니다.", "session_id": session_id}


@app.get("/api/agents/config")
async def get_agents_config():
    """에이전트 설정 정보 조회"""
    try:
        # 설정 파일에서 읽기
        with open('../quicksight_agent_config.json', 'r') as f:
            quicksight_config = json.load(f)
    except:
        quicksight_config = {
            "agent_id": os.getenv('QUICKSIGHT_AGENT_ID', ''),
            "agent_alias_id": os.getenv('QUICKSIGHT_AGENT_ALIAS_ID', '')
        }

    supervisor_config = {
        "agent_id": os.getenv("BEDROCK_SUPERVISOR_AGENT_ID", "UXEVYB5QYQ"),
        "agent_alias_id": os.getenv("BEDROCK_SUPERVISOR_AGENT_ALIAS_ID", "ETXIYBXOSO")
    }

    return {
        "quicksight_agent": quicksight_config,
        "supervisor_agent": supervisor_config
    }


import boto3
import json
import asyncio
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
import os
from dotenv import load_dotenv
import re

load_dotenv()


class BedrockClientWithTrace:
    """Trace 정보를 포함한 스트리밍을 지원하는 Bedrock 클라이언트"""

    def __init__(self):
        self.region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
        self.bedrock_agent_runtime = boto3.client(
            service_name='bedrock-agent-runtime',
            region_name=self.region
        )

    async def supervisor_agent_invoke_with_trace(
            self,
            prompt_text: str,
            user_id: str = None,
            trace_callback=None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Supervisor Agent 호출 with Trace 스트리밍"""

        agent_id = os.getenv("BEDROCK_SUPERVISOR_AGENT_ID", "UXEVYB5QYQ")
        alias_id = os.getenv("BEDROCK_SUPERVISOR_AGENT_ALIAS_ID", "ETXIYBXOSO")
        user_id = user_id or "default-user"

        try:
            # enableTrace=True로 설정하여 trace 정보 활성화
            response = self.bedrock_agent_runtime.invoke_agent(
                agentId=agent_id,
                agentAliasId=alias_id,
                sessionId=user_id,
                inputText=prompt_text,
                enableTrace=True  # Trace 활성화
            )

            full_response = ""
            completion_stream = response.get("completion", None)

            if completion_stream is not None:
                async for event in self._process_stream_async(completion_stream):
                    # Trace 이벤트 처리
                    if "trace" in event:
                        trace_data = event["trace"]["trace"]

                        # orchestrationTrace - 에이전트 체인 정보
                        if "orchestrationTrace" in trace_data:
                            orch_trace = trace_data["orchestrationTrace"]

                            # 어떤 에이전트를 호출하는지 추적
                            if "invocationInput" in orch_trace:
                                inv_input = orch_trace["invocationInput"]
                                agent_name = ""

                                # Action Group 이름 추출
                                if "actionGroupInvocationInput" in inv_input:
                                    agent_name = inv_input["actionGroupInvocationInput"].get("actionGroupName", "")

                                yield {
                                    "type": "agent_invocation",
                                    "timestamp": datetime.now().isoformat(),
                                    "agent": agent_name,
                                    "input": inv_input
                                }

                            # 에이전트 응답 추적
                            if "observation" in orch_trace:
                                yield {
                                    "type": "agent_response",
                                    "timestamp": datetime.now().isoformat(),
                                    "observation": orch_trace["observation"]
                                }

                            # 추론 과정 추적
                            if "rationale" in orch_trace:
                                yield {
                                    "type": "reasoning",
                                    "timestamp": datetime.now().isoformat(),
                                    "rationale": orch_trace["rationale"]["text"]
                                }

                    # 실제 응답 청크
                    if "chunk" in event:
                        chunk = event["chunk"]
                        if "bytes" in chunk:
                            chunk_text = chunk["bytes"].decode()
                            full_response += chunk_text

                            yield {
                                "type": "response_chunk",
                                "timestamp": datetime.now().isoformat(),
                                "content": chunk_text
                            }

            # 최종 응답 파싱
            parsed_response = self._parse_agent_response(full_response)

            # 최종 응답
            yield {
                "type": "final_response",
                "timestamp": datetime.now().isoformat(),
                "content": full_response,
                "parsed": parsed_response
            }

        except Exception as e:
            yield {
                "type": "error",
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }

    async def _process_stream_async(self, stream):
        """동기 스트림을 비동기로 변환"""
        loop = asyncio.get_event_loop()

        for event in stream:
            # 비동기 처리를 위해 이벤트 루프에 양보
            await asyncio.sleep(0)
            yield event

    @staticmethod
    def _parse_agent_response(full_response: str) -> Dict[str, Any]:
        """에이전트 응답 파싱 - BedrockClient의 파싱 로직 재사용"""
        try:
            if full_response.strip():
                json_text = full_response.strip()

                # JSON 코드 블록 추출
                if '```json' in json_text:
                    json_start = json_text.find('```json') + 7
                    json_end = json_text.find('```', json_start)
                    if json_end > json_start:
                        json_text = json_text[json_start:json_end].strip()

                # 직접 JSON 파싱 시도
                if (json_text.startswith('{') and json_text.endswith('}')) or \
                        (json_text.startswith('[') and json_text.endswith(']')):
                    parsed_response = json.loads(json_text)
                    return {
                        "success": True,
                        "response_type": "json",
                        "data": parsed_response,
                        "raw_text": full_response
                    }
                else:
                    # JSON 패턴 찾기
                    json_pattern = r'\{(.|\n)*?\}'
                    json_matches = re.findall(json_pattern, full_response)
                    if json_matches:
                        for match in sorted(json_matches, key=len, reverse=True):
                            try:
                                parsed_response = json.loads('{' + match + '}')
                                return {
                                    "success": True,
                                    "response_type": "json",
                                    "data": parsed_response,
                                    "raw_text": full_response
                                }
                            except Exception:
                                continue

                    # JSON 파싱 실패시 텍스트로 반환
                    return {
                        "success": True,
                        "response_type": "text",
                        "data": full_response,
                        "raw_text": full_response
                    }
            else:
                return {
                    "success": False,
                    "error": "Empty response from agent",
                    "data": None,
                    "raw_text": ""
                }
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parsing failed: {str(e)}")
            return {
                "success": True,
                "response_type": "text",
                "data": full_response,
                "raw_text": full_response,
                "parse_error": str(e)
            }


# FastAPI 엔드포인트 수정
@app.post("/api/chat/stream/trace")
async def chat_stream_with_trace(request: ChatRequest):
    """Supervisor Agent Trace를 포함한 스트리밍"""

    async def trace_event_generator() -> AsyncGenerator:
        try:
            session_id = request.session_id or str(uuid.uuid4())
            bedrock_trace_client = BedrockClientWithTrace()

            # 초기 메시지 - ensure_ascii=False로 한글 인코딩 해결
            yield f"data: {json.dumps({
                'type': 'stream_start',
                'message': 'Supervisor Agent 분석을 시작합니다...',
                'timestamp': datetime.now().isoformat()
            }, ensure_ascii=False)}\n\n"

            # Supervisor Agent 호출 with trace
            async for trace_event in bedrock_trace_client.supervisor_agent_invoke_with_trace(
                    prompt_text=request.message,
                    user_id=session_id
            ):
                # 이벤트 타입별 처리
                if trace_event["type"] == "agent_invocation":
                    # 에이전트 호출 시작
                    agent_name = trace_event.get("agent", "Unknown Agent")

                    # 에이전트 이름 매핑
                    display_name = agent_name
                    if "refinement" in agent_name.lower():
                        display_name = "Query Refinement Agent"
                    elif "db" in agent_name.lower() or "database" in agent_name.lower():
                        display_name = "Database Agent"
                    elif "quicksight" in agent_name.lower() or "visualization" in agent_name.lower():
                        display_name = "QuickSight Agent"

                    yield f"data: {json.dumps({
                        'type': 'agent_start',
                        'agent': agent_name,
                        'display_name': display_name,
                        'message': f'{display_name} 호출 중...',
                        'timestamp': trace_event['timestamp']
                    }, ensure_ascii=False)}\n\n"

                elif trace_event["type"] == "reasoning":
                    # 추론 과정
                    yield f"data: {json.dumps({
                        'type': 'reasoning',
                        'content': trace_event['rationale'],
                        'timestamp': trace_event['timestamp']
                    }, ensure_ascii=False)}\n\n"

                elif trace_event["type"] == "agent_response":
                    # 에이전트 응답
                    observation = trace_event.get("observation", {})

                    # Knowledge Base 조회 결과
                    if "knowledgeBaseLookupOutput" in observation:
                        references = observation["knowledgeBaseLookupOutput"].get("retrievedReferences", [])
                        yield f"data: {json.dumps({
                            'type': 'knowledge_base',
                            'references_count': len(references),
                            'message': f'Knowledge Base에서 {len(references)}개의 참조를 찾았습니다.',
                            'timestamp': trace_event['timestamp']
                        }, ensure_ascii=False)}\n\n"

                    # Action Group 실행 결과 (다른 에이전트 호출)
                    elif "actionGroupInvocationOutput" in observation:
                        action_output = observation["actionGroupInvocationOutput"]
                        action_name = action_output.get('actionGroupName', '')

                        yield f"data: {json.dumps({
                            'type': 'action_complete',
                            'action': action_name,
                            'message': f'{action_name} 작업 완료',
                            'timestamp': trace_event['timestamp'],
                            'result_preview': action_output.get('text', '')[:200] + '...' if action_output.get('text') else ''
                        }, ensure_ascii=False)}\n\n"

                elif trace_event["type"] == "response_chunk":
                    # 응답 청크는 주기적으로 전송 (옵션)
                    # 필요시 아래 주석 해제
                    # yield f"data: {json.dumps({
                    #     'type': 'progress',
                    #     'message': '응답 생성 중...',
                    #     'timestamp': trace_event['timestamp']
                    # }, ensure_ascii=False)}\n\n"
                    pass

                elif trace_event["type"] == "final_response":
                    # 최종 응답
                    parsed_result = trace_event.get('parsed', {})

                    # 응답 포맷팅
                    if parsed_result.get('success') and parsed_result.get('response_type') == 'json':
                        # Supervisor Agent의 JSON 응답 처리
                        formatted_response = response_formatter.format_supervisor_response(
                            parsed_result.get('data', {}),
                            request.message
                        )

                        yield f"data: {json.dumps({
                            'type': 'final_response',
                            'result': formatted_response,
                            'timestamp': trace_event['timestamp'],
                            'success': True
                        }, ensure_ascii=False)}\n\n"
                    else:
                        # 텍스트 응답
                        yield f"data: {json.dumps({
                            'type': 'final_response',
                            'result': {
                                'type': 'text',
                                'data': parsed_result.get('data', trace_event.get('content', ''))
                            },
                            'timestamp': trace_event['timestamp'],
                            'success': True
                        }, ensure_ascii=False)}\n\n"

                elif trace_event["type"] == "error":
                    # 에러
                    yield f"data: {json.dumps({
                        'type': 'error',
                        'error': trace_event['error'],
                        'timestamp': trace_event['timestamp']
                    }, ensure_ascii=False)}\n\n"

                # 버퍼 플러시를 위한 양보
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
            "Access-Control-Allow-Origin": "*"  # CORS 추가
        }
    )

# ---------- 2) 새 엔드포인트 ----------
@app.post("/api/chat/stream/mockingtrace")
async def chat_stream_mockingtrace(request: ChatRequest):
    """
    Bedrock 호출 없이 ‘가짜(trace mocking) 스트림’을 흘려보내는 엔드포인트.
    프론트엔드 스트리밍 처리 테스트용.
    """

    async def mock_event_generator():
        """SSE(Event-Stream) 형식으로 샘플 메시지를 순차 전송"""
        session_id = request.session_id or str(uuid.uuid4())
        t0 = datetime.now()

        # --- (1) 미리 정의한 샘플 이벤트 시퀀스 --------------------
        base_events = [
            {
                "type": "stream_start",
                "message": "Supervisor Agent 분석을 시작합니다...",
            },
            {
                "type": "reasoning",
                "content": (
                    "To address this request, I'll need to:\n"
                    "1. Refine the query for precise VOC data analysis\n"
                    "2. Get the database query results\n"
                    "3. Create a visualization dashboard\n"
                    "4. Prepare a comprehensive analysis response"
                ),
            },
            # 빈 display_name → 아래 매핑 로직으로 프론트에서 동일하게 보이게 할 수 있음
            { "type": "agent_start", "agent": "", "display_name": "", "message": " 호출 중..." },
            { "type": "agent_start", "agent": "", "display_name": "", "message": " 호출 중..." },
            { "type": "agent_start", "agent": "", "display_name": "", "message": " 호출 중..." },
            {
                "type": "knowledge_base",
                "references_count": 5,
                "message": "Knowledge Base에서 5개의 참조를 찾았습니다.",
            },
            {
                "type": "reasoning",
                "content": (
                    "이 요청을 처리하기 위해 2025년 1월 VOC 데이터에 대한 종합 분석을 수행해야 합니다. "
                    "이를 위해 여러 가지 분석을 포함하는 SQL 쿼리를 생성해야 합니다. "
                    "먼저 필요한 데이터를 추출하고 분석하기 위해 voc_data_analysis 함수를 사용하겠습니다.\n"
                    "</thinking>\n\n"
                    'voc_data_analysis: {"start_date": "2025-01-01", "end_date": "2025-01-31", '
                    '"analysis_type": "comprehensive"}\n\n<thinking>\n'
                    "voc_data_analysis 함수를 통해 2025년 1월의 VOC 데이터에 대한 종합 분석 결과를 얻었습니다. "
                    "이제 이 결과를 바탕으로 사용자의 요청에 맞게 정보를 정리하여 제공하겠습니다."
                ),
            },
            { "type": "agent_start", "agent": "", "display_name": "", "message": " 호출 중..." },
            {
                "type": "reasoning",
                "content": (
                    "To create a dashboard for the January 2025 VOC data analysis, "
                    "I'll need to generate a QuickSight dashboard configuration JSON that includes the requested visualizations..."
                ),
            },
            {
                "type": "final_response",
                "result": {
                    "type": "text",
                    "data": {
                        "query_id": "VOC_2025_01_ANALYSIS",
                        "query": (
                            "SELECT COUNT(*), category_name, channel, priority, status "
                            "FROM voc_reports WHERE year = 2025 AND month = 1 "
                            "GROUP BY category_name, channel, priority, status"
                        ),
                        "explanation": "2025년 1월 VOC 데이터의 종합 분석 결과입니다.",
                        "sample_analysis": "총 3,245건의 VOC 접수, 불만 유형 45%…",
                        "csv_url": "https://example.com/voc-analysis/2025-01/data.csv",
                        "chart_url": "https://example.com/quicksight/2025-01",
                        "visualization_analysis_result": (
                            "모바일 앱을 통한 불만 접수가 가장 많았으며, 주로 지연과 수하물 관련..."
                        ),
                    },
                },
                "success": True,
            },
        ]
        # ----------------------------------------------------------

        # --- (2) SSE 전송 루프 ------------------------------------
        for idx, evt in enumerate(base_events):
            # 각 이벤트마다 T+Δt 시간 스탬프 부여(예시: 0.5s 간격)
            evt["timestamp"] = (t0 + timedelta(seconds=idx * 0.5)).isoformat()

            # stream_start 에만 메시지 내용에 request.message 삽입(선택)
            if evt["type"] == "stream_start" and request.message:
                evt["message"] = f"{evt['message']}   (사용자 요청: {request.message})"

            yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

            # 느린 스트리밍 느낌을 주려면 약간의 지연
            await asyncio.sleep(0.3)
        # ----------------------------------------------------------

    # ---------- (3) StreamingResponse 반환 ----------
    return StreamingResponse(
        mock_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)