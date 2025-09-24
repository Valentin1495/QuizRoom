import { Colors } from '@/constants/Colors';
import { Activity, AlertTriangle, Coffee } from 'react-native-feather';

export const getDifficultyIcon = (difficulty: 'easy' | 'medium' | 'hard') => {
  switch (difficulty) {
    case 'easy':
      return <Coffee width={12} height={12} color={Colors.light.secondary} />;
    case 'medium':
      return <Activity width={12} height={12} color={Colors.light.secondary} />;
    case 'hard':
      return <AlertTriangle width={12} height={12} color={Colors.light.secondary} />;
  }
};
