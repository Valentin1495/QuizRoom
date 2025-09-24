import { api } from '@/convex/_generated/api';
import seeds from '@/seeds/ko_core.json';
import { useMutation } from 'convex/react';

export function useSeedUpload() {
  const insertBatch = useMutation(api.seeds.insertQuestionBankBatch);
  const upload = async () => {
    return await insertBatch({ items: seeds as any });
  };
  return { upload };
}
