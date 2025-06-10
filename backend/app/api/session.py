"""세션 관련 API 엔드포인트"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import SessionInfo
from app.utils.session_manager import session_manager

router = APIRouter(prefix="/session", tags=["session"])


@router.get("/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    """세션 정보 조회"""
    session = session_manager.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return SessionInfo(
        session_id=session_id,
        messages=session["messages"],
        created_at=session["created_at"]
    )


@router.delete("/{session_id}")
async def clear_session(session_id: str):
    """세션 삭제"""
    success = session_manager.clear_session(session_id)

    if not success:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return {"message": "세션이 초기화되었습니다.", "session_id": session_id}


@router.get("")
async def list_sessions():
    """모든 세션 목록 조회"""
    sessions = session_manager.list_sessions()

    return {
        "total": len(sessions),
        "sessions": [
            {
                "session_id": sid,
                "created_at": info["created_at"],
                "message_count": len(info["messages"])
            }
            for sid, info in sessions.items()
        ]
    }