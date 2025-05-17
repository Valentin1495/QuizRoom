import { Colors } from '@/constants/Colors';
import { KnowledgeCategory, useQuizSetup } from '@/context/quiz-setup-context';
import { Doc } from '@/convex/_generated/dataModel';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import {
  ColorValue,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Icons from 'react-native-feather';
import { CheckCircle } from 'react-native-feather';
import Animated, {
  AnimatedStyle,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

export default function KnowledgeCategorySelector({
  knowledgeCategoryOptions,
}: {
  knowledgeCategoryOptions: Doc<'categories'>[];
}) {
  const { setup, setSetup } = useQuizSetup();
  const { category } = setup;
  const router = useRouter();
  const { quizType } = useLocalSearchParams();

  const handleSelect = (category: KnowledgeCategory) => {
    setSetup((prev) => ({
      ...prev,
      category,
    }));
  };

  // Create animation values for each category
  const scaleValues = useRef(
    knowledgeCategoryOptions.reduce(
      (acc, category) => {
        acc[category.value as KnowledgeCategory] = useSharedValue(1);
        return acc;
      },
      {} as Record<KnowledgeCategory, SharedValue<number>>
    )
  ).current;

  // Create animated styles for each category
  const animatedStyles = useRef(
    knowledgeCategoryOptions.reduce(
      (acc, category) => {
        acc[category.value as KnowledgeCategory] = useAnimatedStyle(() => ({
          transform: [
            { scale: scaleValues[category.value as KnowledgeCategory].value },
          ],
        }));
        return acc;
      },
      {} as Record<KnowledgeCategory, AnimatedStyle<any>>
    )
  ).current;

  const handlePressIn = (category: KnowledgeCategory) => {
    scaleValues[category].value = withSpring(0.95);
  };

  const handlePressOut = (category: KnowledgeCategory) => {
    scaleValues[category].value = withSpring(1);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {knowledgeCategoryOptions?.map((c) => {
            const IconComponent = Icons[c.icon as keyof typeof Icons];

            return (
              <Animated.View
                key={c.value}
                style={[
                  styles.categoryCard,
                  animatedStyles[c.value as KnowledgeCategory],
                  category === c.value && styles.selectedCard,
                ]}
              >
                <TouchableOpacity
                  style={styles.touchable}
                  onPress={() => handleSelect(c.value as KnowledgeCategory)}
                  onPressIn={() => handlePressIn(c.value as KnowledgeCategory)}
                  onPressOut={() =>
                    handlePressOut(c.value as KnowledgeCategory)
                  }
                  activeOpacity={0.8}
                >
                  {category === c.value && (
                    <View style={styles.checkIcon}>
                      <CheckCircle
                        width={16}
                        height={16}
                        color={Colors.light.tint}
                      />
                    </View>
                  )}
                  <LinearGradient
                    colors={
                      c.colors as [ColorValue, ColorValue, ...ColorValue[]]
                    }
                    style={styles.iconBackground}
                  >
                    <IconComponent width={20} height={20} color='white' />
                  </LinearGradient>
                  <Text style={styles.categoryLabel}>{c.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.nextButton, { opacity: category === null ? 0.5 : 1 }]}
        activeOpacity={0.8}
        disabled={category === null}
        onPress={() => router.push(`/quiz/${quizType}/question-format`)}
      >
        <LinearGradient
          colors={['#ec4899', '#a855f7', '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nextButtonGradient}
        >
          <Text style={styles.nextButtonText}>다음</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: '100%',
  },
  scrollView: {
    width: '100%',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  categoryCard: {
    width: isTablet ? '48%' : '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    backgroundColor: 'white',
    marginBottom: 16,
  },
  selectedCard: {
    borderColor: Colors.light.tint,
    backgroundColor: 'rgba(224, 231, 255, 0.5)',
  },
  touchable: {
    width: '100%',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  nextButton: {
    marginTop: 24,
    alignSelf: 'center',
  },
  nextButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  nextButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
});
