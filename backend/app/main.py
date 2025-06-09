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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)