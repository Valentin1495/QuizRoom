import { Colors } from '@/constants/Colors';
import { useQuizSetup } from '@/context/quiz-setup-context';
import { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

type Props = {
  id: Id<'categories'>;
  en: string;
  kr: string;
  icon: any;
};

export default function Category({ id, kr, icon }: Props) {
  const { setSetup } = useQuizSetup();
  const router = useRouter();

  const handlePress = () => {
    setSetup((prev) => ({ ...prev, categoryId: id }));
    router.push('/(quiz)/type');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.categoryContainer}
      onPress={handlePress}
    >
      <Ionicons name={icon} size={30} color={Colors.light.primary} />
      <Text style={styles.category}>{kr}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  categoryContainer: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F2F0F8',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  category: {
    fontWeight: '600',
    fontSize: 16,
    color: Colors.light.primary,
  },
});
