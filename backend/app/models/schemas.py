"""Pydantic 모델 정의"""
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime

class ChatRequest(BaseModel):
    """채팅 요청 모델"""
    message: str
    session_id: Optional[str] = None
    mode: str = "QuickSight Mocking Agent"
    agent_config: Optional[Dict[str, str]] = None

class ChatResponse(BaseModel):
    """채팅 응답 모델"""
    response: Any
    session_id: str
    response_type: str  # "text", "analysis", "table", "pie_chart", "line_chart", "error"
    timestamp: str

class SessionInfo(BaseModel):
    """세션 정보 모델"""
    session_id: str
    messages: List[Dict[str, Any]]
    created_at: str

class Message(BaseModel):
    """메시지 모델"""
    role: str  # "user" or "assistant"
    content: Any
    timestamp: str

class AgentConfig(BaseModel):
    """에이전트 설정 모델"""
    agent_id: str
    agent_alias_id: str