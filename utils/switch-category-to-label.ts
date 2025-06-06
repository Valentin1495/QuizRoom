export function switchCategoryToLabel(category?: string | null) {
  switch (category) {
    case 'kpop-music':
      return 'K-pop & 음악';

    case 'history-culture':
      return '역사 & 문화';

    case 'general':
      return '일반 상식';

    case 'arts-literature':
      return '예술 & 문학';

    case 'sports':
      return '스포츠';

    case 'science-tech':
      return '과학 & 기술';

    case 'math-logic':
      return '수학 & 논리';

    case 'entertainment':
      return '영화 & TV';

    default:
      break;
  }
}
