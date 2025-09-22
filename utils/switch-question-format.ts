export function switchQuestionFormat(format?: string | null): string {
  switch (format) {
    case 'multiple':
      return '객관식';
    case 'short':
      return '주관식';
    case 'true_false':
      return 'O/X';
    case 'filmography':
      return '필모그래피';
    default:
      return '';
  }
}
