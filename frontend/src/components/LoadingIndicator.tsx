// components/LoadingIndicator.tsx
import React from 'react';

interface LoadingIndicatorProps {
    message: string;
    Icon?: React.FC;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message, Icon }) => (
    <div className="flex items-center space-x-3">
        <div className="relative">
            {Icon ? (
                <div className="text-blue-500 animate-spin">
                    <Icon />
                </div>
            ) : (
                <>
                    <div className="w-8 h-8 border-3 border-blue-200 rounded-full"></div>
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </>
            )}
        </div>
        <span className="text-gray-600 text-sm animate-pulse">{message}</span>
    </div>
);

export default LoadingIndicator;