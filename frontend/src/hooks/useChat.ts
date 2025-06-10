// hooks/useChat.ts
import { useState, useCallback, useEffect } from 'react';
import { apiService, ChatRequest, StreamEvent } from '../services/api';
import type { Message, AnalysisResponse } from '../types';

interface UseChatOptions {
    sessionId?: string;
    mode?: string;
    onError?: (error: Error) => void;
}

export const useChat = (options: UseChatOptions = {}) => {
    const [sessionId, setSessionId] = useState<string | null>(options.sessionId || null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentReasoningStep, setCurrentReasoningStep] = useState('');
    const [currentStepIcon, setCurrentStepIcon] = useState<React.FC | null>(null);
    const [agentsConfig, setAgentsConfig] = useState<any>(null);

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

    const sendMessage = useCallback(async (message: string): Promise<{
        response: AnalysisResponse | string;
        responseType: string;
    }> => {
        if (isProcessing) return { response: '', responseType: 'text' };

        setIsProcessing(true);

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
                            session_id: sessionId || undefined
                        },
                        (event: StreamEvent) => {
                            console.log('Stream event:', event);

                            switch (event.type) {
                                case 'stream_start':
                                    setCurrentReasoningStep(event.message || '분석을 시작합니다...');
                                    break;

                                case 'reasoning':
                                    if (event.content) {
                                        setCurrentReasoningStep(event.content.split('\n')[0]);
                                    }
                                    break;

                                case 'agent_start':
                                    const agentName = event.display_name || event.agent || '에이전트';
                                    setCurrentReasoningStep(`${agentName} ${event.message || '호출 중...'}`);
                                    break;

                                case 'final_response':
                                    finalResponse = event.result;
                                    if (event.success) {
                                        // 최종 응답 처리
                                        const botMessage: Message = {
                                            id: Date.now() + 1,
                                            type: 'bot',
                                            content: event.result?.data || event.result,
                                            timestamp: event.timestamp
                                        };

                                        setMessages(prev =>
                                            prev.filter(msg => msg.type !== 'bot-reasoning').concat(botMessage)
                                        );

                                        resolve({
                                            response: event.result?.data || event.result,
                                            responseType: event.result?.type || 'text'
                                        });
                                    } else {
                                        reject(new Error('Analysis failed'));
                                    }
                                    break;
                            }
                        }
                    ).catch(error => {
                        console.error('Streaming error:', error);
                        reject(error);
                    }).finally(() => {
                        setIsProcessing(false);
                        setCurrentReasoningStep('');
                    });
                });

            } else {
                // QuickSight Mocking Agent 모드 - 기존 로직 사용
                const chatRequest: ChatRequest = {
                    message,
                    session_id: sessionId || undefined,
                    mode: options.mode || 'QuickSight Mocking Agent',
                    agent_config: agentsConfig?.quicksight_agent
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
            } catch (error) {
                console.error('Failed to clear session:', error);
            }
        }
    }, [sessionId]);

    const newSession = useCallback(() => {
        const newSessionId = `session_${Date.now()}`;
        setSessionId(newSessionId);
        setMessages([]);
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
        setMessages
    };
};