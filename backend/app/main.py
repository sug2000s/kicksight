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


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """스트리밍 채팅 엔드포인트 (추가 구현 필요)"""
    # TODO: 스트리밍 응답 구현
    pass


import boto3
import json
import asyncio
from typing import Dict, Any, AsyncGenerator
from datetime import datetime
import os
from dotenv import load_dotenv

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
                                yield {
                                    "type": "agent_invocation",
                                    "timestamp": datetime.now().isoformat(),
                                    "agent": orch_trace.get("modelInvocationInput", {}).get("actionGroup", ""),
                                    "input": orch_trace["invocationInput"].get("actionGroupInvocationInput", {})
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

            # 최종 응답
            yield {
                "type": "final_response",
                "timestamp": datetime.now().isoformat(),
                "content": full_response,
                "parsed": self._parse_agent_response(full_response)
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
        """기존 파싱 로직 재사용"""
        # 기존 _parse_agent_response 로직과 동일
        pass


# FastAPI 엔드포인트 수정
@app.post("/api/chat/stream/trace")
async def chat_stream_with_trace(request: ChatRequest):
    """Supervisor Agent Trace를 포함한 스트리밍"""

    async def trace_event_generator() -> AsyncGenerator:
        try:
            session_id = request.session_id or str(uuid.uuid4())
            bedrock_trace_client = BedrockClientWithTrace()

            # 초기 메시지
            yield f"data: {json.dumps({
                'type': 'stream_start',
                'message': 'Supervisor Agent 분석을 시작합니다...',
                'timestamp': datetime.now().isoformat()
            })}\n\n"

            # Supervisor Agent 호출 with trace
            async for trace_event in bedrock_trace_client.supervisor_agent_invoke_with_trace(
                    prompt_text=request.message,
                    user_id=session_id
            ):
                # 이벤트 타입별 처리
                if trace_event["type"] == "agent_invocation":
                    # 에이전트 호출 시작
                    agent_name = trace_event.get("agent", "Unknown Agent")
                    yield f"data: {json.dumps({
                        'type': 'agent_start',
                        'agent': agent_name,
                        'message': f'{agent_name} 호출 중...',
                        'timestamp': trace_event['timestamp']
                    })}\n\n"

                elif trace_event["type"] == "reasoning":
                    # 추론 과정
                    yield f"data: {json.dumps({
                        'type': 'reasoning',
                        'content': trace_event['rationale'],
                        'timestamp': trace_event['timestamp']
                    })}\n\n"

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
                        })}\n\n"

                    # Action Group 실행 결과 (다른 에이전트 호출)
                    elif "actionGroupInvocationOutput" in observation:
                        action_output = observation["actionGroupInvocationOutput"]
                        yield f"data: {json.dumps({
                            'type': 'action_complete',
                            'action': action_output.get('actionGroupName', ''),
                            'message': '에이전트 작업 완료',
                            'timestamp': trace_event['timestamp']
                        })}\n\n"

                elif trace_event["type"] == "response_chunk":
                    # 응답 청크는 누적하되 주기적으로만 전송
                    pass  # 또는 필요시 활성화

                elif trace_event["type"] == "final_response":
                    # 최종 응답
                    yield f"data: {json.dumps({
                        'type': 'final_response',
                        'result': trace_event['parsed'],
                        'timestamp': trace_event['timestamp']
                    })}\n\n"

                elif trace_event["type"] == "error":
                    # 에러
                    yield f"data: {json.dumps({
                        'type': 'error',
                        'error': trace_event['error'],
                        'timestamp': trace_event['timestamp']
                    })}\n\n"

                # 버퍼 플러시를 위한 양보
                await asyncio.sleep(0)

        except Exception as e:
            yield f"data: {json.dumps({
                'type': 'error',
                'error': str(e),
                'message': '스트리밍 중 오류가 발생했습니다.'
            })}\n\n"

    return StreamingResponse(
        trace_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# Trace 이벤트 파서
class TraceEventParser:
    """Bedrock Agent Trace 이벤트를 파싱하고 의미있는 정보로 변환"""

    @staticmethod
    def parse_orchestration_trace(trace_data: Dict[str, Any]) -> Dict[str, Any]:
        """오케스트레이션 trace 파싱"""
        result = {
            "type": "orchestration",
            "timestamp": datetime.now().isoformat()
        }

        # 모델 호출 정보
        if "modelInvocationInput" in trace_data:
            model_input = trace_data["modelInvocationInput"]
            result["model"] = model_input.get("inferenceConfiguration", {}).get("modelId", "")
            result["prompt"] = model_input.get("text", "")

        # Action Group 호출 정보
        if "invocationInput" in trace_data:
            inv_input = trace_data["invocationInput"]
            if "actionGroupInvocationInput" in inv_input:
                ag_input = inv_input["actionGroupInvocationInput"]
                result["action_group"] = ag_input.get("actionGroupName", "")
                result["function"] = ag_input.get("function", "")
                result["parameters"] = ag_input.get("parameters", [])

        # 관찰 결과
        if "observation" in trace_data:
            observation = trace_data["observation"]

            # Knowledge Base 결과
            if "knowledgeBaseLookupOutput" in observation:
                kb_output = observation["knowledgeBaseLookupOutput"]
                result["knowledge_base_hits"] = len(kb_output.get("retrievedReferences", []))

            # Action Group 결과
            if "actionGroupInvocationOutput" in observation:
                ag_output = observation["actionGroupInvocationOutput"]
                result["action_result"] = ag_output.get("text", "")

        # 추론 과정
        if "rationale" in trace_data:
            result["reasoning"] = trace_data["rationale"]["text"]

        return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)