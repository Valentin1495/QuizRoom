interface MasteryLevelBadgeProps {
  score: number;
}

import { getSkillRank } from '@/utils/get-skill-rank';
import { Text, View } from 'react-native';

export const MasteryLevelBadge = ({ score }: MasteryLevelBadgeProps) => {
  const { rank, color } = getSkillRank(score);

  return (
    <View
      style={{
        backgroundColor: color,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
      }}
    >
      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
        {rank}
      </Text>
    </View>
  );
};
