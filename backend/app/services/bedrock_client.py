"""AWS Bedrock 클라이언트"""
import boto3
import json
import re
import asyncio
from typing import Dict, Any, Optional, AsyncGenerator
from datetime import datetime
import botocore.config
from app.config import get_settings


class BedrockClient:
    """Bedrock 에이전트와 통신하는 클라이언트"""

    def __init__(self):
        self.settings = get_settings()
        self._init_clients()

    def _init_clients(self):
        """AWS 클라이언트 초기화"""
        config = botocore.config.Config(
            read_timeout=self.settings.read_timeout,
            connect_timeout=self.settings.connect_timeout,
            region_name=self.settings.aws_region
        )

        # 기본 Bedrock 클라이언트
        self.bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=self.settings.aws_region,
            config=config,
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key
        )

        # Agent Runtime 클라이언트
        self.bedrock_agent_runtime = boto3.client(
            service_name='bedrock-agent-runtime',
            region_name=self.settings.aws_region,
            config=config,
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key
        )

    def invoke_agent(
            self,
            agent_id: str,
            alias_id: str,
            prompt_text: str,
            user_id: str = "default-user",
            enable_trace: bool = False
    ) -> Dict[str, Any]:
        """범용 에이전트 호출 메서드"""
        try:
            print(f"🔍 Agent 호출 중...")
            print(f"   Agent ID: {agent_id}")
            print(f"   Alias ID: {alias_id}")
            print(f"   Query: {prompt_text}")

            response = self.bedrock_agent_runtime.invoke_agent(
                agentId=agent_id,
                agentAliasId=alias_id,
                sessionId=user_id,
                inputText=prompt_text,
                enableTrace=enable_trace
            )

            full_response = self._collect_stream_response(response)
            return self._parse_agent_response(full_response)

        except Exception as e:
            print(f"❌ Agent error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None,
                "raw_text": ""
            }

    def supervisor_agent_invoke(
            self,
            prompt_text: str,
            user_id: Optional[str] = None,
            agent_id: Optional[str] = None,
            agent_alias_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Supervisor Agent 호출"""
        # 에이전트 ID 우선순위: 파라미터 > 환경변수/설정
        final_agent_id = agent_id or self.settings.supervisor_agent_id
        final_alias_id = agent_alias_id or self.settings.supervisor_agent_alias_id

        if not final_agent_id or not final_alias_id:
            return {
                "success": False,
                "error": "Supervisor Agent ID 또는 Alias ID가 설정되지 않았습니다.",
                "data": None,
                "raw_text": ""
            }

        return self.invoke_agent(
            agent_id=final_agent_id,
            alias_id=final_alias_id,
            prompt_text=prompt_text,
            user_id=user_id or "default-user"
        )

    def quicksight_agent_invoke(
            self,
            prompt_text: str,
            user_id: Optional[str] = None,
            agent_id: Optional[str] = None,
            agent_alias_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """QuickSight Agent 호출"""
        # 설정 우선순위: 파라미터 > 환경변수 > 설정 파일
        agent_id = agent_id or self.settings.quicksight_agent_id
        alias_id = agent_alias_id or self.settings.quicksight_agent_alias_id

        if not agent_id or not alias_id:
            agent_id, alias_id = self._load_quicksight_config()

        if not agent_id or not alias_id:
            return {
                "success": False,
                "error": "QuickSight Agent ID 또는 Alias ID가 설정되지 않았습니다.",
                "data": None,
                "raw_text": ""
            }

        return self.invoke_agent(
            agent_id=agent_id,
            alias_id=alias_id,
            prompt_text=prompt_text,
            user_id=user_id or "default-user"
        )

    async def invoke_agent_with_trace(
            self,
            agent_id: str,
            alias_id: str,
            prompt_text: str,
            user_id: str = "default-user"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Trace 정보와 함께 에이전트 호출 (스트리밍)"""
        try:
            print(f"🔍 Agent Trace 호출 중...")
            print(f"   Agent ID: {agent_id}")
            print(f"   Alias ID: {alias_id}")
            print(f"   Query: {prompt_text}")

            response = self.bedrock_agent_runtime.invoke_agent(
                agentId=agent_id,
                agentAliasId=alias_id,
                sessionId=user_id,
                inputText=prompt_text,
                enableTrace=True
            )

            full_response = ""
            completion_stream = response.get("completion", None)

            if completion_stream:
                async for event in self._process_stream_async(completion_stream):
                    trace_event = self._process_trace_event(event)
                    if trace_event:
                        yield trace_event

                    # 응답 청크 수집
                    if "chunk" in event and "bytes" in event["chunk"]:
                        chunk_text = event["chunk"]["bytes"].decode()
                        full_response += chunk_text

            # 최종 응답 파싱
            # 디버깅: 전체 full_response 내용을 콘솔에 출력
            print(f"🔍 [DEBUG] full_response data: {full_response!r}")
            parsed_response = self._parse_agent_response(full_response)
            # 디버깅: 최종응답의 data 필드를 콘솔에 출력
            print(f"🔍 [DEBUG] final_response data: {parsed_response.get('data')!r}")
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

    async def supervisor_agent_invoke_with_trace(
            self,
            prompt_text: str,
            user_id: Optional[str] = None,
            agent_id: Optional[str] = None,
            agent_alias_id: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Supervisor Agent Trace 호출"""
        # 에이전트 ID 우선순위: 파라미터 > 환경변수/설정
        final_agent_id = agent_id or self.settings.supervisor_agent_id
        final_alias_id = agent_alias_id or self.settings.supervisor_agent_alias_id

        if not final_agent_id or not final_alias_id:
            yield {
                "type": "error",
                "timestamp": datetime.now().isoformat(),
                "error": "Supervisor Agent ID 또는 Alias ID가 설정되지 않았습니다."
            }
            return

        async for event in self.invoke_agent_with_trace(
                agent_id=final_agent_id,
                alias_id=final_alias_id,
                prompt_text=prompt_text,
                user_id=user_id or "default-user"
        ):
            yield event

    @staticmethod
    def _collect_stream_response(response: Dict[str, Any]) -> str:
        """스트리밍 응답 수집"""
        full_response = ""
        completion_stream = response.get("completion", None)

        if completion_stream:
            for event in completion_stream:
                chunk = event.get("chunk", {})
                if "bytes" in chunk:
                    full_response += chunk["bytes"].decode()

        return full_response

    @staticmethod
    async def _process_stream_async(stream):
        """동기 스트림을 비동기로 변환"""
        for event in stream:
            await asyncio.sleep(0)
            yield event

    def _process_trace_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Trace 이벤트 처리"""
        if "trace" not in event:
            return None

        trace_data = event["trace"]["trace"]

        # Orchestration Trace 처리
        if "orchestrationTrace" in trace_data:
            orch_trace = trace_data["orchestrationTrace"]

            # 에이전트 호출 추적
            if "invocationInput" in orch_trace:
                inv_input = orch_trace["invocationInput"]
                agent_name = ""

                if "actionGroupInvocationInput" in inv_input:
                    agent_name = inv_input["actionGroupInvocationInput"].get("actionGroupName", "")

                return {
                    "type": "agent_invocation",
                    "timestamp": datetime.now().isoformat(),
                    "agent": agent_name,
                    "input": inv_input
                }

            # 에이전트 응답 추적
            if "observation" in orch_trace:
                return {
                    "type": "agent_response",
                    "timestamp": datetime.now().isoformat(),
                    "observation": orch_trace["observation"]
                }

            # 추론 과정 추적
            if "rationale" in orch_trace:
                return {
                    "type": "reasoning",
                    "timestamp": datetime.now().isoformat(),
                    "rationale": orch_trace["rationale"]["text"]
                }

        return None

    @staticmethod
    def _parse_agent_response(full_response: str) -> Dict[str, Any]:
        """에이전트 응답 파싱 - 최대한 순정으로 원본 응답 반환"""

        # 빈 응답 처리
        if not full_response or not full_response.strip():
            return {
                "success": True,
                "response_type": "text",
                "data": full_response,
                "raw_text": full_response
            }

        # 원본 응답을 그대로 text로 반환
        return {
            "success": True,
            "response_type": "text",
            "data": full_response.strip(),
            "raw_text": full_response
        }

    @staticmethod
    def _load_quicksight_config():
        """QuickSight 설정 파일 로드"""
        try:
            with open('../quicksight_agent_config.json', 'r') as f:
                config = json.load(f)
                return config.get('agent_id'), config.get('agent_alias_id')
        except:
            return None, None