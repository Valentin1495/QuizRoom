import { Activity, AlertTriangle, Coffee } from 'react-native-feather';

export const getDifficultyIcon = (difficulty: 'easy' | 'medium' | 'hard') => {
  switch (difficulty) {
    case 'easy':
      return <Coffee width={12} height={12} color='#fff' />;
    case 'medium':
      return <Activity width={12} height={12} color='#fff' />;
    case 'hard':
      return <AlertTriangle width={12} height={12} color='#fff' />;
  }
};
