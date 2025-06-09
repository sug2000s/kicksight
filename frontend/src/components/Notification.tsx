// components/Notification.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationProps {
    show: boolean;
    message: string;
    description: string;
}

const Notification: React.FC<NotificationProps> = ({ show, message, description }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0, y: -20, x: 20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: -20, x: 20 }}
                className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-gray-200 z-50"
            >
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <div className="text-green-500">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{message}</p>
                        <p className="mt-1 text-sm text-gray-500">{description}</p>
                    </div>
                </div>
            </motion.div>
        )}
    </AnimatePresence>
);

export default Notification;