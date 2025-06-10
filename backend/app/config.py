"""애플리케이션 설정"""
import os
from functools import lru_cache
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """환경 설정 클래스"""
    # AWS 설정
    aws_region: str = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
    aws_access_key_id: Optional[str] = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_access_key: Optional[str] = os.getenv('AWS_SECRET_ACCESS_KEY')

    # Bedrock Agent 설정
    supervisor_agent_id: str = os.getenv("BEDROCK_SUPERVISOR_AGENT_ID", "UXEVYB5QYQ")
    supervisor_agent_alias_id: str = os.getenv("BEDROCK_SUPERVISOR_AGENT_ALIAS_ID", "ETXIYBXOSO")
    quicksight_agent_id: Optional[str] = os.getenv("QUICKSIGHT_AGENT_ID")
    quicksight_agent_alias_id: Optional[str] = os.getenv("QUICKSIGHT_AGENT_ALIAS_ID")

    # API 설정
    api_title: str = "KickSight Backend API"
    api_version: str = "1.0.0"
    api_prefix: str = "/api"

    # CORS 설정
    allowed_origins: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174"
    ]

    # AWS 클라이언트 설정
    read_timeout: int = 120
    connect_timeout: int = 30


@lru_cache()
def get_settings():
    """설정 싱글톤 인스턴스 반환"""
    return Settings()