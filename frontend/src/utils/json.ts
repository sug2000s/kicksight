// utils/json.ts -------------------------------------------------
import JSON5 from 'json5';
import { jsonrepair } from 'jsonrepair';   // npm i json5 jsonrepair

/** 문자열·객체 구분 없이 안전하게 JSON 오브젝트를 반환 */
export function parseJsonContent<T = unknown>(raw: T | string): T | string {
    if (typeof raw !== 'string') return raw;

    const str = raw.trim();
    if (!/^[{\[]/.test(str)) return raw;   // JSON 형태 아님

    // 1) 표준 JSON
    try { return JSON.parse(str) as T; } catch (e1) { /* noop */ }

    // 2) JSON5 (trailing comma, 주석 등 허용)
    try { return JSON5.parse(str) as T; } catch (e2) { /* noop */ }

    // 3) jsonrepair: 줄바꿈/따옴표 등 흔한 오류 자동 수정
    try {
        const repaired = jsonrepair(str);
        return JSON.parse(repaired) as T;
    } catch (e3) {
        console.error('[parseJsonContent] 모든 파서 실패', { e3, str });
        return raw;                          // 포기하고 문자열 유지
    }
}