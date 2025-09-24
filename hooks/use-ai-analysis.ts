import { api } from '@/convex/_generated/api';
import { logError } from '@/utils/log-error';
import { useAction, useMutation } from 'convex/react';
import { useCallback, useState } from 'react';

type AIInsights = {
  overallInsight: string;
  motivationalMessage: string;
  nextGoals: string[];
  cacheExpiry: number;
};

type UseAIAnalysisResult = {
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error?: string;
  analysis: {
    overallAnalysis: any[];
    aiInsights: AIInsights | null;
  };
  refresh: (force?: boolean) => Promise<void>;
};

export function useAIAnalysis(userId: string, baseAnalysis: any): UseAIAnalysisResult {
  const runAnalysis = useAction(api.gamification.analyzeWithGemini);
  const saveInsights = useMutation(api.gamification.updateAIInsightsCache);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(
    async (force = false) => {
      if (!baseAnalysis || loading) return;

      const { overallAnalysis, aiInsights } = baseAnalysis;
      const isCacheValid = aiInsights && aiInsights.cacheExpiry > Date.now();

      if (!force && isCacheValid) return;

      try {
        setLoading(true);
        const result = await runAnalysis({ analysisData: { overallAnalysis } });
        if (result) {
          await saveInsights({ userId, insights: result });
        }
      } catch (err) {
        logError('오류:', err);
        setError('AI 분석에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [baseAnalysis, runAnalysis, saveInsights, loading, userId],
  );

  return {
    loading,
    setLoading,
    error,
    analysis: {
      overallAnalysis: baseAnalysis?.overallAnalysis ?? [],
      aiInsights: baseAnalysis?.aiInsights ?? null,
    },
    refresh,
  };
}
