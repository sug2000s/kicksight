// components/LoadingIndicator.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface LoadingIndicatorProps {
    message?: string;
    Icon?: React.FC;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message = '처리 중...' }) => {
    // 여러 줄의 메시지를 파싱
    const steps = message.split('\n').filter(step => step.trim());
    const currentStep = steps[steps.length - 1] || '처리 중...';
    const previousSteps = steps.slice(0, -1);

    return (
        <div className="space-y-3">
            {/* 이전 단계들 표시 (흐릿하게) */}
            {previousSteps.length > 0 && (
                <div className="space-y-1 opacity-60">
                    {previousSteps.map((step, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-center">
                            <span className="mr-2">✓</span>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 현재 진행 중인 단계 */}
            <div className="flex items-center space-x-3">
                <div className="relative">
                    <motion.div
                        className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                        className="absolute inset-0 w-8 h-8 border-3 border-blue-300 border-t-transparent rounded-full"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        style={{ opacity: 0.3 }}
                    />
                </div>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-gray-700 font-medium"
                >
                    {currentStep}
                </motion.p>
            </div>

            {/* 진행 상태 인디케이터 */}
            <div className="flex space-x-1 mt-2">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="w-2 h-2 bg-blue-500 rounded-full"
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.2,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default LoadingIndicator;