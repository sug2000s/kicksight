"""세션 관리 유틸리티"""
from typing import Dict, Any, Optional
from datetime import datetime
import uuid


class SessionManager:
    """세션 관리 클래스"""

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def get_or_create_session(self, session_id: Optional[str] = None) -> str:
        """세션 가져오기 또는 생성"""
        if not session_id:
            session_id = str(uuid.uuid4())

        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "messages": [],
                "created_at": datetime.now().isoformat()
            }

        return session_id

    def add_message(self, session_id: str, role: str, content: Any):
        """세션에 메시지 추가"""
        if session_id in self.sessions:
            self.sessions[session_id]["messages"].append({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat()
            })

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션 정보 가져오기"""
        return self.sessions.get(session_id)

    def clear_session(self, session_id: str) -> bool:
        """세션 삭제"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

    def list_sessions(self) -> Dict[str, Dict[str, Any]]:
        """모든 세션 목록"""
        return self.sessions


# 싱글톤 인스턴스
session_manager = SessionManager()