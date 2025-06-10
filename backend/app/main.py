"""FastAPI 애플리케이션 메인 모듈"""
from datetime import datetime

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
    """에이전트 설정 정보 조회"""
    # QuickSight 설정 파일 읽기
    quicksight_config = {
        "agent_id": settings.quicksight_agent_id or '',
        "agent_alias_id": settings.quicksight_agent_alias_id or ''
    }

    try:
        with open('../quicksight_agent_config.json', 'r') as f:
            file_config = json.load(f)
            quicksight_config.update(file_config)
    except:
        pass

    return {
        "quicksight_agent": quicksight_config,
        "supervisor_agent": {
            "agent_id": settings.supervisor_agent_id,
            "agent_alias_id": settings.supervisor_agent_alias_id
        }
    }


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