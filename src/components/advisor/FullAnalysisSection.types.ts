import type { ComprehensiveResult } from "@/app/(advisor)/result/ResultClient";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

export interface FullAnalysisSectionProps {
  result: ComprehensiveResult;
  faceAnalysis: FaceAnalysisResult | null;
  userImage?: string;
  sideImages?: Record<string, string>;
  generatedAvatar?: string | null;
  userNickname?: string;
  isAvatarLoading?: boolean;
  avatarQueueStatus?: {
    position?: number;
    estimatedWaitTime?: number;
    message?: string;
  } | null;
}
