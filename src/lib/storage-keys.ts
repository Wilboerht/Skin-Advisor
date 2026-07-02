/**
 * 应用 localStorage / sessionStorage key 集中管理
 * 避免 magic string 散落各处导致维护困难和清理遗漏
 */

export const STORAGE_KEYS = {
    // 结果流程
    ADVISOR_RESULT: 'advisor_result',
    ADVISOR_ANSWERS: 'advisor_answers',
    ADVISOR_FACE_IMAGES: 'advisor_face_images',
    ADVISOR_NICKNAME: 'advisor_nickname',
    ADVISOR_GENDER: 'advisor_gender',
    ADVISOR_STEP: 'advisor_step',
    ADVISOR_GENDER_MISMATCH_ACK: 'advisor_gender_mismatch_ack',

    // 免费重试
    ADVISOR_FREE_RETRY: 'advisor_free_retry',
    ADVISOR_FREE_RETRY_SESSION_ID: 'advisor_free_retry_session_id',

    // 分析中会话（防止刷新页面重复生成 sessionId 导致重复扣费）
    ADVISOR_ANALYZING_SESSION_ID: 'advisor_analyzing_session_id',
    ADVISOR_ANALYZING_STARTED_AT: 'advisor_analyzing_started_at',

    // 全局分析锁（防止组件 unmount/remount 或 StrictMode 双 mount 导致重复分析）
    ADVISOR_ANALYSIS_LOCK: 'advisor_analysis_lock',

    // 地理位置
    USER_REGION: 'userRegion',

    // 会话认领标记（按 sessionId 存储）
    claimedSession: (sessionId: string) => `claimed_${sessionId}`,
} as const;
