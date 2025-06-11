// hooks/useChat.ts
import { useState, useCallback, useEffect } from 'react';
import { apiService, ChatRequest, StreamEvent } from '../services/api';
import type { Message, AnalysisResponse, AgentsConfigResponse } from '../types';

import {
    isSupervisorAgentResponse,
} from '../utils/typeGuards';

import { parseJsonContent } from '../utils/json';   // 새 유틸 추가
interface UseChatOptions {
    sessionId?: string;
    mode?: string;
    onError?: (error: Error) => void;
}

// 에이전트 아이콘 매핑
const agentIcons: Record<string, string> = {
    'Refinement Agent': '🔍',
    'DB Agent': '💾',
    'QuickSight Agent': '📊',
    'get_query_action_group': '🔎',
    'Knowledge Base': '📚',
    'default': '🤖'
};

export const useChat = (options: UseChatOptions = {}) => {
    const [sessionId, setSessionId] = useState<string | null>(options.sessionId || null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentReasoningStep, setCurrentReasoningStep] = useState('');
    const [currentStepIcon, setCurrentStepIcon] = useState<React.FC | null>(null);
    const [agentsConfig, setAgentsConfig] = useState<AgentsConfigResponse | null>(null);
    const [streamingSteps, setStreamingSteps] = useState<string[]>([]);

    // 에이전트 설정 로드
    useEffect(() => {
        apiService.getAgentsConfig()
            .then(config => setAgentsConfig(config))
            .catch(error => console.error('Failed to load agents config:', error));
    }, []);

    // 세션 ID를 로컬 스토리지에서 관리
    useEffect(() => {
        if (!sessionId) {
            const storedSessionId = localStorage.getItem('kicksight_session_id');
            if (storedSessionId) {
                setSessionId(storedSessionId);
                // 기존 세션 메시지 로드
                loadSession(storedSessionId);
            }
        } else {
            localStorage.setItem('kicksight_session_id', sessionId);
        }
    }, [sessionId]);

    const loadSession = async (sessionId: string) => {
        try {
            const sessionInfo = await apiService.getSession(sessionId);
            // 세션 메시지를 Message 형식으로 변환
            const loadedMessages: Message[] = sessionInfo.messages.map((msg, index) => ({
                id: Date.now() + index,
                type: msg.role === 'user' ? 'user' : 'bot',
                content: msg.content,
                timestamp: msg.timestamp
            }));
            setMessages(loadedMessages);
        } catch (error) {
            console.error('Failed to load session:', error);
        }
    };

    // 추론 메시지 업데이트 헬퍼 함수
    const updateReasoningMessage = (newStep: string) => {
        setMessages(prev => {
            const reasoningMsgIndex = prev.findIndex(msg => msg.type === 'bot-reasoning');
            if (reasoningMsgIndex === -1) return prev;

            const updatedMessages = [...prev];
            const existingContent = updatedMessages[reasoningMsgIndex].content as string;

            // 기존 단계들을 배열로 파싱
            const steps = existingContent ? existingContent.split('\n').filter(s => s.trim()) : [];

            // 새 단계 추가
            steps.push(newStep);

            // 최근 5개 단계만 유지
            const recentSteps = steps.slice(-5);

            updatedMessages[reasoningMsgIndex] = {
                ...updatedMessages[reasoningMsgIndex],
                content: recentSteps.join('\n')
            };

            return updatedMessages;
        });
    };

    const sendMessage = useCallback(async (
        message: string,
        agentConfig?: { agent_id: string; agent_alias_id: string }
    ): Promise<{
        response: AnalysisResponse | string;
        responseType: string;
    }> => {
        if (isProcessing) return { response: '', responseType: 'text' };

        setIsProcessing(true);
        setStreamingSteps([]);

        try {
            // 사용자 메시지 추가
            const userMessage: Message = {
                id: Date.now(),
                type: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, userMessage]);

            // Supervisor Agent 모드인 경우 스트리밍 사용
            if (options.mode === 'Supervisor Agent') {
                // 추론 단계 메시지 추가
                const reasoningMessage: Message = {
                    id: Date.now() + 0.5,
                    type: 'bot-reasoning',
                    content: '',
                    timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, reasoningMessage]);

                return new Promise((resolve, reject) => {
                    let finalResponse: any = null;

                    apiService.sendMessageStreamTrace(
                        {
                            message,
                            mode: options.mode,
                            session_id: sessionId || undefined,
                            agent_config: agentConfig
                        },
                        (event: StreamEvent) => {
                            console.log('Stream event:', event);

                            switch (event.type) {
                                case 'stream_start':
                                    const startMessage = event.message || '분석을 시작합니다...';
                                    setCurrentReasoningStep(startMessage);
                                    updateReasoningMessage(`🚀 ${startMessage}`);
                                    break;

                                case 'reasoning':
                                    if (event.content) {
                                        const reasoningText = event.content.split('\n')[0];
                                        setCurrentReasoningStep(reasoningText);
                                        updateReasoningMessage(`💭 ${reasoningText}`);
                                    }
                                    break;

                                case 'agent_start':
                                    // display_name이나 agent 중 유효한 값 사용
                                    const agentName = event.display_name || event.agent || '에이전트';
                                    const agentMessage = event.message || '호출 중...';
                                    const icon = agentIcons[agentName] || agentIcons.default;

                                    const fullMessage = `${icon} ${agentName} ${agentMessage}`;
                                    setCurrentReasoningStep(fullMessage);
                                    updateReasoningMessage(fullMessage);
                                    break;

                                case 'knowledge_base':
                                    const kbMessage = event.message || `Knowledge Base에서 ${event.references_count || 0}개의 참조를 찾았습니다.`;
                                    const kbIcon = agentIcons['Knowledge Base'];
                                    setCurrentReasoningStep(`${kbIcon} ${kbMessage}`);
                                    updateReasoningMessage(`${kbIcon} ${kbMessage}`);
                                    break;

                                case 'query_execution':
                                    if (event.query_id) {
                                        const queryMessage = `🔄 쿼리 실행 중... (ID: ${event.query_id})`;
                                        setCurrentReasoningStep(queryMessage);
                                        updateReasoningMessage(queryMessage);
                                    }
                                    break;

                                case 'visualization_created':
                                    if (event.chart_type) {
                                        const vizMessage = `📈 ${event.chart_type} 시각화 생성 중...`;
                                        setCurrentReasoningStep(vizMessage);
                                        updateReasoningMessage(vizMessage);
                                    }
                                    break;

                                case 'error':
                                    const errorMessage = `❌ 오류: ${event.message || '알 수 없는 오류'}`;
                                    setCurrentReasoningStep(errorMessage);
                                    updateReasoningMessage(errorMessage);
                                    break;

                                case 'final_response':
                                    finalResponse = event.result;
                                    if (event.success) {
                                        // 최종 응답 처리
                                        let displayContent = parseJsonContent(event.result?.data ?? event.result);

                                        const botMessage: Message = {
                                            id: Date.now() + 1,
                                            type: 'bot',
                                            content: displayContent,
                                            timestamp: event.timestamp || new Date().toISOString()
                                        };

                                        // 추론 메시지를 제거하고 최종 응답으로 교체
                                        setMessages(prev =>
                                            prev.filter(msg => msg.type !== 'bot-reasoning').concat(botMessage)
                                        );

                                        resolve({
                                            response: displayContent,
                                            responseType: event.result?.type || 'text'
                                        });
                                    } else {
                                        reject(new Error('Analysis failed'));
                                    }
                                    break;

                                default:
                                    // 처리되지 않은 이벤트 타입도 표시
                                    console.log(`Unhandled event type: ${event.type}`, event);
                                    if (event.type && event.message) {
                                        updateReasoningMessage(`ℹ️ ${event.type}: ${event.message}`);
                                    }
                                    break;
                            }
                        }
                    ).catch(error => {
                        console.error('Streaming error:', error);
                        updateReasoningMessage(`❌ 스트리밍 오류: ${error.message}`);
                        reject(error);
                    }).finally(() => {
                        setIsProcessing(false);
                        setCurrentReasoningStep('');
                        setStreamingSteps([]);
                    });
                });

            } else {
                // QuickSight Mocking Agent 모드 - 기존 로직 사용
                const chatRequest: ChatRequest = {
                    message,
                    session_id: sessionId || undefined,
                    mode: options.mode || 'QuickSight Mocking Agent',
                    agent_config: agentConfig
                };

                const response = await apiService.sendMessage(chatRequest);

                // 세션 ID 업데이트
                if (!sessionId && response.session_id) {
                    setSessionId(response.session_id);
                }

                // 봇 메시지 추가
                const botMessage: Message = {
                    id: Date.now() + 1,
                    type: 'bot',
                    content: response.response,
                    timestamp: response.timestamp
                };

                setMessages(prev => [...prev, botMessage]);

                return {
                    response: response.response,
                    responseType: response.response_type
                };
            }

        } catch (error) {
            console.error('Error sending message:', error);

            // 에러 메시지 추가
            const errorMessage: Message = {
                id: Date.now() + 1,
                type: 'bot',
                content: {
                    message: '죄송합니다. 서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                },
                timestamp: new Date().toISOString()
            };

            setMessages(prev =>
                prev.filter(msg => msg.type !== 'bot-reasoning').concat(errorMessage)
            );

            if (options.onError) {
                options.onError(error as Error);
            }

            return {
                response: errorMessage.content,
                responseType: 'error'
            };

        } finally {
            if (options.mode !== 'Supervisor Agent') {
                setIsProcessing(false);
                setCurrentReasoningStep('');
                setCurrentStepIcon(null);
            }
        }
    }, [sessionId, isProcessing, options, agentsConfig]);

    const clearSession = useCallback(async () => {
        if (sessionId) {
            try {
                await apiService.clearSession(sessionId);
                localStorage.removeItem('kicksight_session_id');
                setSessionId(null);
                setMessages([]);
                setStreamingSteps([]);
            } catch (error) {
                console.error('Failed to clear session:', error);
            }
        }
    }, [sessionId]);

    const newSession = useCallback(() => {
        const newSessionId = `session_${Date.now()}`;
        setSessionId(newSessionId);
        setMessages([]);
        setStreamingSteps([]);
    }, []);

    return {
        messages,
        sessionId,
        isProcessing,
        currentReasoningStep,
        currentStepIcon,
        sendMessage,
        clearSession,
        newSession,
        setMessages,
        streamingSteps,
        agentsConfig
    };
};