import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface DifficultyStats {
  [difficulty: string]: {
    totalQuestions: number;
  };
}

interface Props {
  categoryLabel: string;
  difficultyStats: DifficultyStats;
}

const QuizSetRow = ({
  label,
  sets,
  required,
}: {
  label: string;
  sets: number;
  required: number;
}) => {
  const complete = sets >= required;
  return (
    <View style={styles.row}>
      <Ionicons
        name={complete ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={complete ? '#4caf50' : '#f44336'}
        style={styles.icon}
      />
      <Text
        style={[styles.difficultyLabel, complete ? styles.done : styles.todo]}
      >
        {label}: {sets}세트 / {required}세트
      </Text>
    </View>
  );
};

const CategoryProgressCard = ({ categoryLabel, difficultyStats }: Props) => {
  const requiredSets = 1;
  const easySets = Math.floor((difficultyStats.easy?.totalQuestions || 0) / 10);
  const mediumSets = Math.floor(
    (difficultyStats.medium?.totalQuestions || 0) / 10
  );
  const hardSets = Math.floor((difficultyStats.hard?.totalQuestions || 0) / 10);

  const allComplete = [easySets, mediumSets, hardSets].every(
    (s) => s >= requiredSets
  );
  const totalQuestions =
    (difficultyStats.easy?.totalQuestions || 0) +
    (difficultyStats.medium?.totalQuestions || 0) +
    (difficultyStats.hard?.totalQuestions || 0);

  const aiAnalysisReady = allComplete && totalQuestions >= 60;

  return (
    <View style={styles.card}>
      <Text style={styles.categoryTitle}>🎓 {categoryLabel}</Text>

      <QuizSetRow label='쉬움' sets={easySets} required={requiredSets} />
      <QuizSetRow label='보통' sets={mediumSets} required={requiredSets} />
      <QuizSetRow label='어려움' sets={hardSets} required={requiredSets} />

      <Text style={styles.summary}>
        {aiAnalysisReady
          ? '🌟 AI 분석 조건 달성!'
          : allComplete
            ? '✅ 기본 분석 조건 달성!'
            : '📘 기본 분석까지 각 난이도별 1세트씩 필요'}
      </Text>
    </View>
  );
};

export default CategoryProgressCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 14,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  icon: {
    marginRight: 8,
  },
  difficultyLabel: {
    fontSize: 14,
  },
  done: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  todo: {
    color: '#f44336',
  },
  summary: {
    marginTop: 10,
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
});
