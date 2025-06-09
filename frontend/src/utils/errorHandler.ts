// utils/errorHandler.ts
export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const handleApiError = (error: any): string => {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error.response) {
        return error.response.data?.message || '서버 오류가 발생했습니다.';
    }

    if (error.request) {
        return '서버에 연결할 수 없습니다.';
    }

    return '알 수 없는 오류가 발생했습니다.';
};