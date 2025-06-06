export function switchCategoryKey(categoryKey: string) {
  switch (categoryKey) {
    case 'knowledge-kpop-music':
      return 'k-pop & 음악';

    case 'knowledge-history-culture':
      return '역사 & 문화';

    case 'knowledge-general':
      return '일반 상식';

    case 'knowledge-arts-literature':
      return '예술 & 문학';

    case 'knowledge-sports':
      return '스포츠';

    case 'knowledge-science-tech':
      return '과학 & 기술';

    case 'knowledge-math-logic':
      return '수학 & 논리';

    case 'knowledge-entertainment':
      return '영화 & TV';

    default:
      break;
  }
}
