import os

# (1) .env 우선 로드
from dotenv import load_dotenv
load_dotenv()

# (2) 필수 환경변수 export (그래도 대부분의 SDK는 profile 우선)
os.environ["AWS_PROFILE"] = "default"   # 또는 네가 쓰는 프로필명

from langchain_aws.agents import BedrockAgentsRunnable

# (3) BedrockAgentsRunnable 명시적 profile 기반 초기화
bedrock_agent = BedrockAgentsRunnable(
    agent_id=os.getenv("BEDROCK_SUPERVISOR_AGENT_ID"),  # Supervisor Agent ID
    agent_alias_id=os.getenv("BEDROCK_SUPERVISOR_AGENT_ALIAS_ID"),
    credentials_profile_name=os.getenv("AWS_PROFILE_NAME", "bedrock-chatbot"),   # 명시적으로 전달
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-west-2"),
    endpoint_url=None
)

# 4. Bedrock Agent에 메시지 인풋 (invoke는 input dict로 전달!)
response = bedrock_agent.invoke({
    "input": "최근 3개월 VOC 카테고리별 분포?"
})

print(response)