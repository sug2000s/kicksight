"""FastAPI 애플리케이션 메인 모듈"""
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os

from app.config import get_settings
from app.api import chat, session

# 설정 로드
settings = get_settings()

# FastAPI 앱 생성
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    docs_url=f"{settings.api_prefix}/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    redoc_url=f"{settings.api_prefix}/redoc"
)

# CORS 미들웨어 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(session.router, prefix=settings.api_prefix)


@app.on_event("startup")
async def startup_event():
    """애플리케이션 시작 이벤트"""
    print(f"🚀 Starting {settings.api_title}")
    print(f"📍 AWS Region: {settings.aws_region}")
    print(f"🤖 Supervisor Agent ID: {settings.supervisor_agent_id}")
    print(f"🤖 QuickSight Agent ID: {settings.quicksight_agent_id or 'Not set'}")


@app.get(settings.api_prefix)
async def root():
    """API 루트 엔드포인트"""
    return {
        "message": settings.api_title,
        "version": settings.api_version,
        "status": "running"
    }


@app.get(f"{settings.api_prefix}/agents/config")
async def get_agents_config():
    """에이전트 설정 정보 조회 (agent_id별로 alias 목록을 id+name 형태로 반환)"""
    config_path = Path(__file__).parent.parent / 'quicksight_agent_config.json'

    try:
        raw_entries = json.loads(config_path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return {"agents": []}

    agents_map: dict[str, dict] = {}
    for entry in raw_entries:
        aid         = entry["agent_id"]
        name        = entry.get("agent_name", "")
        alias_id    = entry["agent_alias_id"]
        alias_name  = entry.get("agent_alias_name", "")

        # 최초 등장 시 기본 구조 생성
        if aid not in agents_map:
            agents_map[aid] = {
                "agent_id":   aid,
                "agent_name": name,
                "aliases":    []      # alias 객체들을 담을 리스트
            }

        # alias 객체 추가
        agents_map[aid]["aliases"].append({
            "alias_id":   alias_id,
            "alias_name": alias_name
        })

    return {"agents": list(agents_map.values())}

@app.get(f"{settings.api_prefix}/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {
        "status": "healthy",
        "region": settings.aws_region,
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )