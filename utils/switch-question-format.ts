export function switchQuestionFormat(format: 'multiple' | 'short') {
  return format === 'multiple' ? '객관식' : '주관식';
}
