import React, { useState, useEffect } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// Import types
import type {Message, Conversation, AnalysisResponse, SupervisorAgentResponse} from './types';

// Import icons
import {
    MenuIcon, PlusIcon, SettingsIcon, SendIcon, HeartIcon,
    RobotIcon, CloseIcon, UserIcon, ChartIcon
} from './components/icons';

// Import components
import Notification from './components/Notification';
import LoadingIndicator from './components/LoadingIndicator';

// Import utilities
import {
    isVOCAnalysis,
    isVOCTable,
    isPieChart,
    isLineChart,
    isError,
    isSupervisorAgentResponse
} from './utils/typeGuards';
import { COLORS } from './data/mockData';

// Import custom hook
import { useChat } from './hooks/useChat';

const KickSightApp: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([
        { id: 1, title: '새 대화', messages: [] }
    ]);
    const [activeConversation, setActiveConversation] = useState(1);
    const [inputMessage, setInputMessage] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showVisualization, setShowVisualization] = useState(false);
    const [currentVisualization, setCurrentVisualization] = useState<AnalysisResponse | null>(null);
    const [likedMessages, setLikedMessages] = useState(new Set<number>());
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationDescription, setNotificationDescription] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedMode, setSelectedMode] = useState('QuickSight Mocking Agent');


    // useChat 훅 사용
    const {
        messages,
        sessionId,
        isProcessing,
        currentReasoningStep,
        currentStepIcon,
        sendMessage,
        clearSession,
        newSession,
        setMessages
    } = useChat({
        mode: selectedMode,
        onError: (error: Error) => {
            console.error('Chat error:', error);
            setNotificationMessage('오류가 발생했습니다');
            setNotificationDescription('서버 연결을 확인해주세요.');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
        }
    });

    // 백엔드 연결 상태 확인을 위한 로그
    useEffect(() => {
        console.log('Current mode:', selectedMode);
        console.log('Session ID:', sessionId);
        console.log('API URL:', import.meta.env.VITE_API_URL || 'http://localhost:8000');
    }, [selectedMode, sessionId]);



    // 현재 대화 업데이트
    useEffect(() => {
        setConversations(prev => prev.map(conv =>
            conv.id === activeConversation
                ? { ...conv, messages }
                : conv
        ));
    }, [messages, activeConversation]);

    const currentConvo = conversations.find(c => c.id === activeConversation);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isProcessing) return;

        try {
            console.log('Sending message:', inputMessage);
            const { response, responseType } = await sendMessage(inputMessage);
            console.log('Response received:', { response, responseType });

            // 시각화가 필요한 응답인 경우
            if (response && typeof response === 'object' &&
                (responseType === 'pie_chart' || responseType === 'line_chart' || responseType === 'table' || responseType === 'VOC_TABLE')) {
                setTimeout(() => {
                    setCurrentVisualization(response as AnalysisResponse);
                    setShowVisualization(true);
                }, 300);
            }

            setInputMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
            setNotificationMessage('메시지 전송 실패');
            setNotificationDescription(`오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 5000);
        }
    };

    const handleNewConversation = async () => {
        // 현재 세션 종료
        await clearSession();

        // 새 대화 생성
        const newId = Math.max(...conversations.map(c => c.id)) + 1;
        setConversations([...conversations, { id: newId, title: `새 대화 ${newId}`, messages: [] }]);
        setActiveConversation(newId);
        setShowVisualization(false);
        setCurrentVisualization(null);

        // 새 세션 시작
        newSession();
    };

    const handleLike = (messageId: number) => {
        setLikedMessages(prev => new Set([...prev, messageId]));
        setNotificationMessage('감사합니다! 💙');
        setNotificationDescription('피드백이 성공적으로 저장되었습니다.');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
    };

    const handleModeChange = (mode: string) => {
        setSelectedMode(mode);
        setDropdownOpen(false);
    };

    const renderVisualization = () => {
        if (!currentVisualization) return null;

        if (isVOCTable(currentVisualization)) {
            return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
                    <h3 className="text-lg font-semibold mb-4">VOC 데이터 테이블 - {currentVisualization.period}</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                {currentVisualization.columns?.map((col, idx) => (
                                    <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {currentVisualization.rows?.map((row, idx) => (
                                <tr key={idx}>
                                    {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm text-gray-500">총 건수: {currentVisualization.total_count}건</p>
                    </div>
                </div>
            );
        }

        if (isPieChart(currentVisualization)) {
            const pieData = currentVisualization.data?.labels.map((label, idx) => ({
                name: label,
                value: currentVisualization.data!.values[idx],
                percentage: currentVisualization.data!.percentages[idx]
            })) || [];

            return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
                    <h3 className="text-lg font-semibold mb-4">{currentVisualization.title}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(_entry) => `${_entry.name}: ${_entry.percentage}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-1">
                        {currentVisualization.insights?.map((insight, idx) => (
                            <p key={idx} className="text-sm text-gray-600">• {insight}</p>
                        ))}
                    </div>
                </div>
            );
        }

        if (isLineChart(currentVisualization)) {
            const chartData: Array<{ hour: string; [key: string]: string | number }> = [];
            const firstCategory = Object.keys(currentVisualization.time_series_data || {})[0];
            if (firstCategory && currentVisualization.time_series_data) {
                currentVisualization.time_series_data[firstCategory].forEach((item: any, idx: number) => {
                    const dataPoint: { hour: string; [key: string]: string | number } = { hour: item.hour };
                    Object.keys(currentVisualization.time_series_data).forEach(category => {
                        dataPoint[category] = currentVisualization.time_series_data[category][idx].value;
                    });
                    chartData.push(dataPoint);
                });
            }

            return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
                    <h3 className="text-lg font-semibold mb-4">시간대별 피드백 추이 - {currentVisualization.period}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            {currentVisualization.categories?.map((category: string, idx: number) => (
                                <Line
                                    key={category}
                                    type="monotone"
                                    dataKey={category}
                                    stroke={COLORS[idx % COLORS.length]}
                                    strokeWidth={2}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-6">
                        <h4 className="font-semibold mb-2">Peak Hours</h4>
                        {currentVisualization.peak_hours && Object.entries(currentVisualization.peak_hours).map(([category, time]) => (
                            <div key={category} className="flex items-center mb-1">
                                <span
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: COLORS[currentVisualization.categories?.indexOf(category) % COLORS.length] }}
                                />
                                <span className="text-sm">{category}: {time}</span>
                            </div>
                        ))}
                        <div className="mt-4 space-y-1">
                            {currentVisualization.insights?.map((insight, idx) => (
                                <p key={idx} className="text-sm text-gray-600">• {insight}</p>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    // 메인 컴포넌트에서 renderMessage 함수 내부에 추가할 렌더링 로직
    const renderSupervisorResponse = (content: SupervisorAgentResponse) => {
        const hasDBResponse = content.query_id || content.query;
        const hasQuickSightResponse = content.chart_url;

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
                                <p className="text-sm text-blue-800 bg-white border border-blue-200 rounded p-3">
                                    {content.explanation}
                                </p>
                            </div>
                        )}

                        {content.query && (
                            <div className="mb-3">
                                <p className="text-sm font-medium text-blue-700 mb-1">실행된 쿼리:</p>
                                <pre className="text-sm text-blue-800 bg-gray-800 text-green-400 border border-blue-200 rounded p-3 overflow-x-auto font-mono whitespace-pre-wrap">
{content.query}
                            </pre>
                            </div>
                        )}

                        {content.sample_analysis && (
                            <div className="mb-3">
                                <p className="text-sm font-medium text-blue-700 mb-1">샘플 분석 결과:</p>
                                <p className="text-sm text-blue-800 bg-white border border-blue-200 rounded p-3">
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
                                <p className="text-sm text-green-800 bg-white border border-green-200 rounded p-3">
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
                                            alert(content.chart_url);
                                        } else {
                                            console.error("Chart URL is undefined for SupervisorAgentResponse.");
                                            setNotificationMessage('오류');
                                            setNotificationDescription('차트 URL이 제공되지 않았습니다.');
                                            setShowNotification(true);
                                            setTimeout(() => setShowNotification(false), 3000);
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

// KickSightApp.tsx의 renderMessage 함수 내 bot-reasoning 부분만 발췌
// 이 부분을 기존 코드의 해당 부분과 교체하세요

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
                                        Icon={currentStepIcon || undefined}
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
                                        {isVOCAnalysis(message.content) && (
                                            <>
                                                <h4 className="font-semibold mb-2">{message.content.analysis_type.replace(/_/g, ' ')}</h4>
                                                <p className="text-sm mb-2">기간: {message.content.period}</p>
                                                <p className="text-sm mb-2">전체 VOC 건수: {message.content.total_voc_count?.toLocaleString()}건</p>
                                                <div className="mb-3">
                                                    <p className="font-medium">주요 카테고리: <span className="font-normal">{message.content.categories['주요 카테고리']?.join(', ')}</span></p>
                                                    <div className="mt-2 space-y-1">
                                                        {message.content.categories['분석 결과'] && Object.entries(message.content.categories['분석 결과']).map(([key, value]) => (
                                                            <p key={key} className="text-sm">• {key}: {value}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="mb-3">
                                                    <p className="font-medium mb-1">인사이트:</p>
                                                    <div className="space-y-1">
                                                        {message.content.insights?.map((insight: string, idx: number) => (
                                                            <p key={idx} className="text-sm">• {insight}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="mt-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                                                    <p className="text-sm"><span className="font-medium">추천사항:</span> {message.content.recommendation}</p>
                                                </div>
                                            </>
                                        )}
                                        {isLineChart(message.content) && (
                                            <>
                                                <p className="text-sm mb-2">기간: {message.content.period}</p>
                                                <p className="font-medium">카테고리: <span className="font-normal">{message.content.categories?.join(', ')}</span></p>
                                                <div className="mb-3">
                                                    <p className="font-medium mb-1">인사이트:</p>
                                                    <div className="space-y-1">
                                                        {message.content.insights?.map((insight: string, idx: number) => (
                                                            <p key={idx} className="text-sm">• {insight}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {isPieChart(message.content) && (
                                            <>
                                                <h4 className="font-semibold mb-2">{message.content.title}</h4>
                                                <p className="text-sm mb-2">전체 건수: {message.content.total_count?.toLocaleString()}건</p>
                                                <div className="mb-3">
                                                    <p className="font-medium mb-1">인사이트:</p>
                                                    <div className="space-y-1">
                                                        {message.content.insights?.map((insight: string, idx: number) => (
                                                            <p key={idx} className="text-sm">• {insight}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {(isPieChart(message.content) || isLineChart(message.content) || isVOCTable(message.content)) && (
                                            <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                                                 onClick={() => {
                                                     setCurrentVisualization(message.content as AnalysisResponse);
                                                     setShowVisualization(true);
                                                 }}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                        </svg>
                                                        <span className="text-sm font-medium text-blue-700">
                                            {isVOCTable(message.content) ? '테이블 데이터 보기' :
                                                isPieChart(message.content) ? '원형 차트 보기' :
                                                    '라인 차트 보기'}
                                        </span>
                                                    </div>
                                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        )}
                                        {isError(message.content) && (
                                            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-3 mt-2">
                                                <p className="font-semibold">오류 발생:</p>
                                                <p>{message.content.message || JSON.stringify(message.content)}</p>
                                            </div>
                                        )}
                                        {isSupervisorAgentResponse(message.content) && renderSupervisorResponse(message.content)}
                                    </div>
                                ) : (
                                    <p>{message.content}</p>
                                )}
                                <div className="mt-3 flex justify-end space-x-2">
                                    {(typeof message.content === 'object' && (isPieChart(message.content) || isLineChart(message.content) || isVOCTable(message.content))) && (
                                        <button
                                            onClick={() => {
                                                setCurrentVisualization(message.content as AnalysisResponse);
                                                setShowVisualization(true);
                                            }}
                                            className="flex items-center space-x-1 px-3 py-1 rounded-md transition-colors text-blue-500 hover:bg-blue-50"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <span className="text-sm">차트 보기</span>
                                        </button>
                                    )}
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
                        {sessionId && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                세션: {sessionId.slice(0, 8)}...
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <select
                            value={selectedMode}
                            onChange={(e) => handleModeChange(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="QuickSight Mocking Agent">QuickSight Mocking Agent</option>
                            <option value="Supervisor Agent">Supervisor Agent</option>
                        </select>
                        <button
                            onClick={handleNewConversation}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                            <PlusIcon />
                            <span>새 대화</span>
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <SettingsIcon />
                            </button>
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                    <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2">
                                        <UserIcon />
                                        <span>프로필</span>
                                    </button>
                                    <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2">
                                        <SettingsIcon />
                                        <span>설정</span>
                                    </button>
                                    <button
                                        onClick={clearSession}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2 text-red-600"
                                    >
                                        <CloseIcon />
                                        <span>세션 초기화</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className={`${sidebarCollapsed ? 'w-0' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden`}>
                    <div className="p-4">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">대화 이력</h2>
                        <div className="space-y-2">
                            {conversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => {
                                        setActiveConversation(conv.id);
                                        setShowVisualization(false);
                                        setCurrentVisualization(null);
                                        // 해당 대화의 메시지로 업데이트
                                        setMessages(conv.messages);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between ${
                                        conv.id === activeConversation
                                            ? 'bg-blue-50 text-blue-700 border border-blue-300'
                                            : 'hover:bg-gray-100'
                                    }`}
                                >
                                    <span className="truncate">{conv.title}</span>
                                    <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">
                                        {conv.messages.filter(m => m.type === 'user').length}
                                    </span>
                                </button>
                            ))}
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
                                                <p className="text-gray-500 mb-6">대화를 시작해보세요! 아래 예시 질문을 참고하세요.</p>
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-blue-700">
                                                        현재 모드: <span className="font-semibold">{selectedMode}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-left bg-gray-50 rounded-lg p-4">
                                                <h3 className="font-semibold mb-2">예시 질문:</h3>
                                                <p className="text-sm mb-1">1. 2025년도 1월 VOC 데이터 분석 결과를 보여줘</p>
                                                <p className="text-sm mb-1">2. VOC 데이터를 테이블로 보여줘</p>
                                                <p className="text-sm mb-1">3. 카테고리별 분포를 원형 차트로 보여줘</p>
                                                <p className="text-sm">4. 시간대별 피드백 추이를 보여줘</p>
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
                                        placeholder="메시지를 입력하세요..."
                                        className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={3}
                                        disabled={isProcessing}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!inputMessage.trim() || isProcessing}
                                        className={`px-4 py-2 rounded-md transition-colors flex items-center space-x-2 ${
                                            inputMessage.trim() && !isProcessing
                                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <SendIcon />
                                        <span>전송</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visualization Panel */}
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
                                            onClick={() => setShowVisualization(false)}
                                            className="absolute top-2 right-2 z-10 p-1 hover:bg-gray-100 rounded-md transition-colors"
                                        >
                                            <CloseIcon />
                                        </button>
                                        {renderVisualization()}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

export default KickSightApp;