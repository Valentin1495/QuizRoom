import { useCallback, useState } from 'react';

export const useRefresh = (delay = 1000) => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Convex는 자동으로 실시간 업데이트되므로 단순히 상태만 리셋
    setTimeout(() => {
      setRefreshing(false);
    }, delay);
  }, [delay]);

  return { refreshing, onRefresh };
};
