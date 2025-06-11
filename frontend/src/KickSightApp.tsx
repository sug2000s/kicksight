import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'sql-formatter';

// Import types
import type {Message, Conversation, SupervisorAgentResponse, QuickSightIFrameResponse, AgentInfo} from './types';

// Import icons
import {
    MenuIcon, PlusIcon, SendIcon, HeartIcon,
    RobotIcon, CloseIcon
} from './components/icons/index';

// Import components
import Notification from './components/Notification';
import LoadingIndicator from './components/LoadingIndicator';

// Import utilities
import {
    isError,
    isSupervisorAgentResponse,
} from './utils/typeGuards';

// Import custom hook
import { useChat } from './hooks/useChat';

const KickSightApp: React.FC = () => {
    // 초기 세션 ID 생성
    const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 로컬 스토리지에서 대화 목록 로드
    const loadConversations = (): Conversation[] => {
        const saved = localStorage.getItem('kicksight_conversations');
        if (saved) {
            return JSON.parse(saved);
        }
        // 기본 대화 생성
        const initialConversation: Conversation = {
            id: 1,
            title: '새 대화',
            messages: [],
            sessionId: generateSessionId(),
            createdAt: new Date().toISOString()
        };
        return [initialConversation];
    };

    const [conversations, setConversations] = useState<Conversation[]>(loadConversations());
    const [activeConversation, setActiveConversation] = useState(conversations[0]?.id || 1);
    const [inputMessage, setInputMessage] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showVisualization, setShowVisualization] = useState(false);
    const [currentVisualization, setCurrentVisualization] = useState<QuickSightIFrameResponse | null>(null);
    const [likedMessages, setLikedMessages] = useState(new Set<number>());
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationDescription, setNotificationDescription] = useState('');
    const [iframeError, setIframeError] = useState(false);

    // 에이전트 관련 상태
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [isLoadingAgents, setIsLoadingAgents] = useState(true);

    // 현재 활성 대화의 세션 ID 가져오기
    const getCurrentSessionId = () => {
        const currentConvo = conversations.find(c => c.id === activeConversation);
        return currentConvo?.sessionId || null;
    };

    // useChat 훅 사용 - Supervisor Agent 전용
    const {
        messages,
        sessionId,
        isProcessing,
        currentReasoningStep,
        sendMessage,
        clearSession,
        newSession,
        setMessages,
        agentsConfig,
        setSessionId
    } = useChat({
        mode: 'Supervisor Agent',
        sessionId: getCurrentSessionId(),
        onError: (error: Error) => {
            console.error('Chat error:', error);
            setNotificationMessage('오류가 발생했습니다');
            setNotificationDescription('서버 연결을 확인해주세요.');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
        }
    });

    // 대화 목록을 로컬 스토리지에 저장
    useEffect(() => {
        localStorage.setItem('kicksight_conversations', JSON.stringify(conversations));
    }, [conversations]);

    // 대화가 변경될 때 세션 전환
    useEffect(() => {
        const currentConvo = conversations.find(c => c.id === activeConversation);
        if (currentConvo) {
            setSessionId(currentConvo.sessionId);
            setMessages(currentConvo.messages);
            console.log(`Switched to conversation ${activeConversation} with session ${currentConvo.sessionId}`);
        }
    }, [activeConversation]);

    // 에이전트 설정 로드 및 기본값 설정
    useEffect(() => {
        if (agentsConfig && agentsConfig.agents.length > 0) {
            if (!selectedAgent) {
                // 기본 선택값 설정 (첫 번째 에이전트의 첫 번째 얼라이어스)
                const firstAgent = agentsConfig.agents[0];
                if (firstAgent.aliases.length > 0) {
                    const defaultSelection = `${firstAgent.agent_id}-${firstAgent.aliases[0].alias_id}`;
                    setSelectedAgent(defaultSelection);
                }
            }
            setIsLoadingAgents(false);
        }
    }, [agentsConfig, selectedAgent]);

    // 백엔드 연결 상태 확인
    useEffect(() => {
        console.log('Current Session ID:', sessionId);
        console.log('Active Conversation:', activeConversation);
        console.log('API URL:', import.meta.env.VITE_API_URL || 'http://localhost:8000');
    }, [sessionId, activeConversation]);

    // 현재 대화 업데이트 (세션 ID 유지 및 제목 자동 업데이트)
    useEffect(() => {
        setConversations(prev => prev.map(conv => {
            if (conv.id === activeConversation) {
                // 첫 번째 사용자 메시지로 제목 업데이트
                let title = conv.title;
                const firstUserMessage = messages.find(m => m.type === 'user');
                if (firstUserMessage && conv.title.startsWith('새 대화')) {
                    const messageContent = firstUserMessage.content as string;
                    title = messageContent.length > 30
                        ? messageContent.substring(0, 30) + '...'
                        : messageContent;
                }

                return {
                    ...conv,
                    messages,
                    sessionId: sessionId || conv.sessionId,
                    title
                };
            }
            return conv;
        }));
    }, [messages, activeConversation]);

    const currentConvo = conversations.find(c => c.id === activeConversation);

    // 에이전트 선택 옵션 생성 함수
    const getAgentOptions = () => {
        const options: Array<{ value: string; label: string }> = [];

        if (agentsConfig) {
            agentsConfig.agents.forEach(agent => {
                agent.aliases.forEach(alias => {
                    options.push({
                        value: `${agent.agent_id}-${alias.alias_id}`,
                        label: `${agent.agent_name} - ${alias.alias_name}`
                    });
                });
            });
        }

        return options;
    };

    // 선택된 에이전트 정보 가져오기
    const getSelectedAgentInfo = () => {
        if (!selectedAgent || !agentsConfig) return null;

        const [agentId, aliasId] = selectedAgent.split('-');
        const agent = agentsConfig.agents.find(a => a.agent_id === agentId);
        const alias = agent?.aliases.find(a => a.alias_id === aliasId);

        return {
            agent_id: agentId,
            agent_alias_id: aliasId,
            agent_name: agent?.agent_name || '',
            alias_name: alias?.alias_name || ''
        };
    };

    const handleDeleteConversation = (convId: number) => {
        if (conversations.length <= 1) {
            setNotificationMessage('마지막 대화는 삭제할 수 없습니다');
            setNotificationDescription('새 대화를 만든 후 삭제해주세요.');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
            return;
        }

        const updatedConversations = conversations.filter(c => c.id !== convId);
        setConversations(updatedConversations);

        // 삭제한 대화가 현재 활성 대화인 경우
        if (activeConversation === convId) {
            const firstConv = updatedConversations[0];
            setActiveConversation(firstConv.id);
            setSessionId(firstConv.sessionId);
            setMessages(firstConv.messages);
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isProcessing) return;

        const agentInfo = getSelectedAgentInfo();
        if (!agentInfo) {
            setNotificationMessage('에이전트를 선택해주세요');
            setNotificationDescription('메시지를 보내기 전에 에이전트를 선택해야 합니다.');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
            return;
        }

        // 현재 세션 ID 확인
        if (!sessionId) {
            console.error('No session ID available');
            setNotificationMessage('세션 오류');
            setNotificationDescription('새 대화를 시작해주세요.');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
            return;
        }

        try {
            await sendMessage(inputMessage, {
                agent_id: agentInfo.agent_id,
                agent_alias_id: agentInfo.agent_alias_id
            });
            setInputMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    const handleNewConversation = async () => {
        // 새로운 세션 ID 생성
        const newSessionId = generateSessionId();

        // 새 대화 생성
        const newId = Math.max(...conversations.map(c => c.id), 0) + 1;
        const newConversation: Conversation = {
            id: newId,
            title: `새 대화 ${newId}`,
            messages: [],
            sessionId: newSessionId,
            createdAt: new Date().toISOString()
        };

        setConversations([...conversations, newConversation]);
        setActiveConversation(newId);
        setShowVisualization(false);
        setCurrentVisualization(null);

        // 새 세션으로 전환
        newSession();
        setSessionId(newSessionId);
        console.log(`Created new conversation ${newId} with session ${newSessionId}`);
    };

    const handleLike = (messageId: number) => {
        setLikedMessages(prev => new Set([...prev, messageId]));
        setNotificationMessage('감사합니다! 💙');
        setNotificationDescription('피드백이 성공적으로 저장되었습니다.');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
    };

    // URL 유효성 검증 함수
    const isValidUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            const currentUrl = new URL(window.location.href);
            if (urlObj.origin === currentUrl.origin && urlObj.pathname === currentUrl.pathname) {
                console.error('iframe URL is same as current app URL');
                return false;
            }
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const renderQuickSightVisualization = () => {
        if (!currentVisualization) return null;

        if (!isValidUrl(currentVisualization.url)) {
            return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-red-600">오류</h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-gray-600 mb-2">유효하지 않은 URL입니다.</p>
                            <p className="text-sm text-gray-500">QuickSight URL을 확인해주세요.</p>
                            <button
                                onClick={() => {
                                    setShowVisualization(false);
                                    setCurrentVisualization(null);
                                }}
                                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{currentVisualization.title || 'QuickSight Dashboard'}</h3>
                    <button
                        onClick={() => window.open(currentVisualization.url, '_blank')}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7l10 10M17 7v4M17 7h-4" />
                        </svg>
                        <span>새 창에서 열기</span>
                    </button>
                </div>
                <div className="flex-1 relative">
                    {iframeError ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded border border-gray-200">
                            <div className="text-center">
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <p className="text-gray-600 mb-2">대시보드를 로드할 수 없습니다</p>
                                <p className="text-sm text-gray-500 mb-4">보안 정책으로 인해 iframe에서 표시할 수 없습니다.</p>
                                <button
                                    onClick={() => window.open(currentVisualization.url, '_blank')}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                                >
                                    새 창에서 열기
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <iframe
                                src={currentVisualization.url}
                                className="w-full h-full rounded border border-gray-200"
                                title={currentVisualization.title || 'QuickSight Dashboard'}
                                onError={() => {
                                    console.error('iframe load error');
                                    setIframeError(true);
                                }}
                                onLoad={() => {
                                    console.log('iframe loaded successfully');
                                    setIframeError(false);
                                }}
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                            <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs text-gray-600 shadow-sm">
                                QuickSight 대시보드가 로드되었습니다
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderSupervisorResponse = (content: SupervisorAgentResponse) => {
        // 데이터 존재 여부 확인
        const hasDBResponse = !!(content.query_id || content.query || content.explanation || content.sample_analysis || content.csv_url);
        const hasQuickSightResponse = !!(content.chart_url || content.visualization_analysis_result);

        // 둘 다 없으면 기본 메시지
        if (!hasDBResponse && !hasQuickSightResponse) {
            return (
                <div className="text-gray-600">
                    <p>응답 데이터가 없습니다.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {/* DB Agent 응답 */}
                {hasDBResponse && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c0-2.21-1.79-4-4-4H4V7z" />
                                </svg>
                            </div>
                            <h4 className="font-semibold text-blue-800">DB 분석 결과</h4>
                        </div>

                        {content.query_id && (
                            <div className="mb-3">
                                <span className="text-sm font-medium text-blue-700">쿼리 ID:</span>
                                <span className="ml-2 text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded font-mono">
                                {content.query_id}
                            </span>
                            </div>
                        )}

                        {content.explanation && (
                            <div className="mb-3">
                                <p className="text-sm font-medium text-blue-700 mb-1">분석 설명:</p>
                                <p className="text-sm text-blue-800 bg-white border border-blue-200 rounded p-3 whitespace-pre-wrap">
                                    {content.explanation}
                                </p>
                            </div>
                        )}

                        {content.query && (
                            <div className="mb-3">
                                <p className="text-sm font-medium text-blue-700 mb-1">실행된 쿼리:</p>
                                <pre className="text-sm text-blue-800 bg-gray-800 text-green-400 border border-blue-200 rounded p-3 overflow-x-auto font-mono whitespace-pre-wrap">
{format(content.query)}
</pre>
                            </div>
                        )}

                        {content.sample_analysis && (
                            <div className="mb-3">
                                <p className="text-sm font-medium text-blue-700 mb-1">샘플 분석 결과:</p>
                                <p className="text-sm text-blue-800 bg-white border border-blue-200 rounded p-3 whitespace-pre-wrap">
                                    {content.sample_analysis}
                                </p>
                            </div>
                        )}

                        {content.csv_url && (
                            <div className="flex items-center justify-between bg-white border border-blue-200 rounded p-3">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="text-sm font-medium text-blue-700">CSV 데이터 다운로드</span>
                                </div>
                                <button
                                    onClick={() => window.open(content.csv_url, '_blank')}
                                    className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>다운로드</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* QuickSight Agent 응답 */}
                {hasQuickSightResponse && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-2">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h4 className="font-semibold text-green-800">QuickSight 시각화</h4>
                        </div>

                        {content.visualization_analysis_result && (
                            <div className="mb-3">
                                <p className="text-sm font-medium text-green-700 mb-1">시각화 분석 결과:</p>
                                <p className="text-sm text-green-800 bg-white border border-green-200 rounded p-3 whitespace-pre-wrap">
                                    {content.visualization_analysis_result}
                                </p>
                            </div>
                        )}

                        {content.chart_url && (
                            <div className="flex items-center justify-between bg-white border border-green-200 rounded p-3">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7l10 10M17 7v4M17 7h-4" />
                                    </svg>
                                    <span className="text-sm font-medium text-green-700">QuickSight 차트 보기</span>
                                </div>
                                <button
                                    onClick={() => {
                                        if (content.chart_url) {
                                            if (!isValidUrl(content.chart_url)) {
                                                setNotificationMessage('오류');
                                                setNotificationDescription('유효하지 않은 차트 URL입니다.');
                                                setShowNotification(true);
                                                setTimeout(() => setShowNotification(false), 3000);
                                                return;
                                            }

                                            const iframeResponse: QuickSightIFrameResponse = {
                                                type: 'quicksight_iframe',
                                                url: content.chart_url,
                                                title: 'QuickSight Dashboard'
                                            };
                                            setCurrentVisualization(iframeResponse);
                                            setShowVisualization(true);
                                            setIframeError(false);
                                        }
                                    }}
                                    className="flex items-center space-x-1 px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span>차트 열기</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderMessage = (message: Message) => {
        if (message.type === 'user') {
            return (
                <div className="flex justify-end mb-4">
                    <div className="max-w-2xl">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-gray-900">{message.content as string}</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (message.type === 'bot-reasoning') {
            return (
                <div className="flex justify-start mb-4">
                    <div className="max-w-2xl w-full">
                        <div className="flex items-start space-x-2">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                                <RobotIcon />
                            </div>
                            <div className="flex-1">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                                    <div className="mb-2 flex items-center">
                                        <h4 className="text-sm font-semibold text-blue-800">분석 진행 중...</h4>
                                        <motion.div
                                            className="ml-2 w-2 h-2 bg-blue-500 rounded-full"
                                            animate={{ opacity: [1, 0.3, 1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                        />
                                    </div>
                                    <LoadingIndicator
                                        message={message.content as string || currentReasoningStep}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex justify-start mb-4">
                <div className="max-w-2xl">
                    <div className="flex items-start space-x-2">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                            <RobotIcon />
                        </div>
                        <div className="flex-1">
                            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                {typeof message.content === 'object' ? (
                                    <div>
                                        {isSupervisorAgentResponse(message.content) && renderSupervisorResponse(message.content)}
                                        {isError(message.content) && (
                                            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-3">
                                                <p className="font-semibold">오류 발생:</p>
                                                <p>{message.content.message || JSON.stringify(message.content)}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-900">{message.content}</p>
                                )}

                                {/* 좋아요 버튼 */}
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => handleLike(message.id)}
                                        disabled={likedMessages.has(message.id)}
                                        className={`flex items-center space-x-1 px-3 py-1 rounded-md transition-colors ${
                                            likedMessages.has(message.id)
                                                ? 'text-red-500 bg-red-50 cursor-not-allowed'
                                                : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                                        }`}
                                    >
                                        <HeartIcon filled={likedMessages.has(message.id)} />
                                        <span className="text-sm">{likedMessages.has(message.id) ? '감사합니다!' : '좋아요'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            <Notification
                show={showNotification}
                message={notificationMessage}
                description={notificationDescription}
            />

            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <MenuIcon />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Kick-sight</h1>
                        <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-medium">
                            Supervisor Agent
                        </span>

                        {/* 에이전트 선택 드롭다운 */}
                        <div className="flex items-center space-x-2">
                            <label htmlFor="agent-select" className="text-sm text-gray-600">에이전트:</label>
                            <select
                                id="agent-select"
                                value={selectedAgent}
                                onChange={(e) => setSelectedAgent(e.target.value)}
                                disabled={isLoadingAgents}
                                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                {isLoadingAgents ? (
                                    <option value="">로딩 중...</option>
                                ) : (
                                    <>
                                        {getAgentOptions().length === 0 ? (
                                            <option value="">에이전트 없음</option>
                                        ) : (
                                            getAgentOptions().map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))
                                        )}
                                    </>
                                )}
                            </select>
                        </div>

                        {sessionId && (
                            <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    세션: {sessionId.slice(0, 8)}...
                                </span>
                                <span className="text-xs text-gray-500">
                                    대화 #{activeConversation}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleNewConversation}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                            <PlusIcon />
                            <span>새 대화</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className={`${sidebarCollapsed ? 'w-0' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden`}>
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-700">대화 이력</h2>
                            <button
                                onClick={() => {
                                    if (confirm('모든 대화를 삭제하시겠습니까?')) {
                                        localStorage.removeItem('kicksight_conversations');
                                        const newConv: Conversation = {
                                            id: 1,
                                            title: '새 대화',
                                            messages: [],
                                            sessionId: generateSessionId(),
                                            createdAt: new Date().toISOString()
                                        };
                                        setConversations([newConv]);
                                        setActiveConversation(1);
                                        setSessionId(newConv.sessionId);
                                        setMessages([]);
                                    }
                                }}
                                className="text-xs text-red-500 hover:text-red-700"
                            >
                                모두 삭제
                            </button>
                        </div>
                        <div className="space-y-2">
                            {conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    className={`group relative rounded-md transition-colors ${
                                        conv.id === activeConversation
                                            ? 'bg-blue-50 border border-blue-300'
                                            : 'hover:bg-gray-100'
                                    }`}
                                >
                                    <button
                                        onClick={() => {
                                            setActiveConversation(conv.id);
                                            setShowVisualization(false);
                                            setCurrentVisualization(null);
                                            // 대화 전환 시 해당 대화의 세션과 메시지 로드
                                            setSessionId(conv.sessionId);
                                            setMessages(conv.messages);
                                            console.log(`Switching to conversation ${conv.id} with session ${conv.sessionId}`);
                                        }}
                                        className="w-full text-left px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate font-medium">{conv.title}</span>
                                            <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">
                                                {conv.messages.filter(m => m.type === 'user').length}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            세션: {conv.sessionId.slice(0, 8)}...
                                        </div>
                                        {conv.createdAt && (
                                            <div className="text-xs text-gray-400">
                                                {new Date(conv.createdAt).toLocaleString('ko-KR', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        )}
                                    </button>
                                    {conversations.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteConversation(conv.id);
                                            }}
                                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded"
                                        >
                                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                            {conversations.length === 0 && (
                                <p className="text-gray-500 text-sm text-center py-4">
                                    대화가 없습니다. 새 대화를 시작하세요.
                                </p>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex overflow-hidden">
                    <div className={`flex-1 p-6 transition-all duration-300 ${showVisualization ? 'pr-3' : ''}`}>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
                            <div className="flex-1 overflow-y-auto p-6">
                                {currentConvo && currentConvo.messages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center max-w-md">
                                            <div className="mb-8">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <RobotIcon />
                                                </div>
                                                <p className="text-gray-500 mb-6">Supervisor Agent와 대화를 시작해보세요!</p>
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-blue-700">
                                                        DB Agent와 QuickSight Agent를 통합하여 분석을 수행합니다.
                                                    </p>
                                                </div>
                                                {selectedAgent && (
                                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                                                        <p className="text-sm text-green-700">
                                                            선택된 에이전트: <strong>{getSelectedAgentInfo()?.agent_name} - {getSelectedAgentInfo()?.alias_name}</strong>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-left bg-gray-50 rounded-lg p-4">
                                                <h3 className="font-semibold mb-2">예시 질문:</h3>
                                                <p className="text-sm mb-1">• 2024년 1월 VOC 데이터를 분석해줘</p>
                                                <p className="text-sm mb-1">• 고객 피드백 데이터를 조회해줘</p>
                                                <p className="text-sm mb-1">• 최근 한 달간 VOC 추이를 보여줘</p>
                                                <p className="text-sm">• 카테고리별 고객 피드백을 시각화해줘</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : currentConvo ? (
                                    currentConvo.messages.map(msg => (
                                        <div key={msg.id}>
                                            {renderMessage(msg)}
                                        </div>
                                    ))
                                ) : null}
                            </div>
                            <div className="border-t border-gray-200 p-4">
                                <div className="flex space-x-2">
                                    <textarea
                                        value={inputMessage}
                                        onChange={e => setInputMessage(e.target.value)}
                                        onKeyPress={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Supervisor Agent에게 메시지를 입력하세요..."
                                        className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={3}
                                        disabled={isProcessing || !selectedAgent}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!inputMessage.trim() || isProcessing || !selectedAgent}
                                        className={`px-4 py-2 rounded-md transition-colors flex items-center space-x-2 ${
                                            inputMessage.trim() && !isProcessing && selectedAgent
                                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <SendIcon />
                                        <span>전송</span>
                                    </button>
                                </div>
                                {!selectedAgent && (
                                    <p className="text-sm text-red-500 mt-2">메시지를 보내기 전에 에이전트를 선택해주세요.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* QuickSight Visualization Panel */}
                    <AnimatePresence>
                        {showVisualization && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 500, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                            >
                                <div className="h-full p-6 pl-3">
                                    <div className="h-full relative">
                                        <button
                                            onClick={() => {
                                                setShowVisualization(false);
                                                setIframeError(false);
                                            }}
                                            className="absolute top-2 right-2 z-10 p-1 hover:bg-gray-100 rounded-md transition-colors"
                                        >
                                            <CloseIcon />
                                        </button>
                                        {renderQuickSightVisualization()}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default KickSightApp;