##class BedrockClient:
import boto3
import json  
import os  
from dotenv import load_dotenv  
import botocore.config  
from typing import Dict, Any  
  
# .env 한 번만 로드  
load_dotenv()  
  
class BedrockClient:  
    def __init__(self):  
        self.region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')  
        print(f"🔧 Initializing BedrockClient with region: {self.region}")  
        config = botocore.config.Config(  
            read_timeout=120,  
            connect_timeout=30,  
            region_name=self.region  
        )  
        self.bedrock_runtime = boto3.client(  
            service_name='bedrock-runtime',  
            region_name=self.region,  
            config=config,  
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),  
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')  
        )  
        self.bedrock_agent_runtime = boto3.client(  
            service_name='bedrock-agent-runtime',  
            region_name=self.region,  
            config=config,  
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),  
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')  
        )  
  
    def supervisor_agent_invoke(self, prompt_text: str, user_id: str = None) -> Dict[str, Any]:  
        """Supervisor Agent 호출 - JSON 응답 처리"""  
        agent_id = os.getenv("BEDROCK_SUPERVISOR_AGENT_ID", "UXEVYB5QYQ")  
        alias_id = os.getenv("BEDROCK_SUPERVISOR_AGENT_ALIAS_ID", "ETXIYBXOSO")  
        return self._invoke_agent(  
            prompt_text=prompt_text,  
            user_id=user_id,  
            agent_id=agent_id,  
            alias_id=alias_id,  
            label="Supervisor Agent"  
        )  
  
    def quicksight_agent_invoke(self, prompt_text: str, user_id: str = None,  
                                agent_id: str = None, agent_alias_id: str = None) -> Dict[str, Any]:  
        """QuickSight Mocking Agent 호출 - JSON 응답 처리"""  
        agent_id, agent_alias_id = self._get_quicksight_agent_ids(agent_id, agent_alias_id)  
        if not agent_id or not agent_alias_id:  
            return {  
                "success": False,  
                "error": "QuickSight Agent ID 또는 Alias ID가 설정되지 않았습니다.",  
                "data": None,  
                "raw_text": ""  
            }  
        return self._invoke_agent(  
            prompt_text=prompt_text,  
            user_id=user_id,  
            agent_id=agent_id,  
            alias_id=agent_alias_id,  
            label="QuickSight Agent"  
        )  
  
    def _invoke_agent(self, prompt_text, user_id, agent_id, alias_id, label="Agent") -> Dict[str, Any]:  
        user_id = user_id or "default-user"  
        try:  
            print(f"🔍 {label} 호출 중...")  
            print(f"   Region: {self.region}")  
            print(f"   Agent ID: {agent_id}")  
            print(f"   Alias ID: {alias_id}")  
            print(f"   Query: {prompt_text}")  
            response = self.bedrock_agent_runtime.invoke_agent(  
                agentId=agent_id,  
                agentAliasId=alias_id,  
                sessionId=user_id,  
                inputText=prompt_text  
            )  
            full_response = self._collect_stream_response(response)  
            print(f"📄 Raw response: {full_response[:200]}...")  
            return self._parse_agent_response(full_response)  
        except Exception as e:  
            print(f"❌ Error in {label}: {str(e)}")  
            return {  
                "success": False,  
                "error": str(e),  
                "data": None,  
                "raw_text": ""  
            }  
  
    @staticmethod  
    def _collect_stream_response(response: Dict[str, Any]) -> str:  
        """스트리밍 응답을 완전히 수집"""  
        full_response = ""  
        completion_stream = response.get("completion", None)  
        if completion_stream is not None:  
            for event in completion_stream:  
                chunk = event.get("chunk", {})  
                if "bytes" in chunk:  
                    full_response += chunk["bytes"].decode()  
        return full_response  
  
    @staticmethod  
    def _get_quicksight_agent_ids(agent_id, alias_id):  
        """agent_id, alias_id 우선순위: 파라미터 > 환경변수 > config 파일"""  
        env_agent_id = os.getenv("QUICKSIGHT_AGENT_ID")  
        env_alias_id = os.getenv("QUICKSIGHT_AGENT_ALIAS_ID")  
        agent_id = agent_id or env_agent_id  
        alias_id = alias_id or env_alias_id  
        if not agent_id or not alias_id:  
            try:  
                with open('../quicksight_agent_config.json', 'r') as f:
                    config = json.load(f)  
                    agent_id = agent_id or config.get('agent_id')  
                    alias_id = alias_id or config.get('agent_alias_id')  
            except Exception:  
                pass  
        return agent_id, alias_id  
  
    @staticmethod  
    def _parse_agent_response(full_response: str) -> Dict[str, Any]:  
        """에이전트 응답 파싱"""  
        try:  
            if full_response.strip():  
                json_text = full_response.strip()  
                if '```json' in json_text:  
                    json_start = json_text.find('```json') + 7  
                    json_end = json_text.find('```', json_start)  
                    if json_end > json_start:  
                        json_text = json_text[json_start:json_end].strip()  
                if (json_text.startswith('{') and json_text.endswith('}')) or \
                   (json_text.startswith('[') and json_text.endswith(']')):  
                    parsed_response = json.loads(json_text)  
                    return {  
                        "success": True,  
                        "response_type": "json",  
                        "data": parsed_response,  
                        "raw_text": full_response  
                    }  
                else:  
                    import re  
                    json_pattern = r'\{(.|\n)*?\}'  
                    json_matches = re.findall(json_pattern, full_response)  
                    if json_matches:  
                        for match in sorted(json_matches, key=len, reverse=True):  
                            try:  
                                parsed_response = json.loads('{' + match + '}')  
                                return {  
                                    "success": True,  
                                    "response_type": "json",  
                                    "data": parsed_response,  
                                    "raw_text": full_response  
                                }  
                            except Exception:  
                                continue  
                    # JSON 파싱 실패시 텍스트로 반환  
                    return {  
                        "success": True,  
                        "response_type": "text",  
                        "data": full_response,  
                        "raw_text": full_response  
                    }  
            else:  
                return {  
                    "success": False,  
                    "error": "Empty response from agent",  
                    "data": None,  
                    "raw_text": ""  
                }  
        except json.JSONDecodeError as e:  
            print(f"⚠️ JSON parsing failed: {str(e)}")  
            return {  
                "success": True,  
                "response_type": "text",  
                "data": full_response,  
                "raw_text": full_response,  
                "parse_error": str(e)  
            }  