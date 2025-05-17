export function switchCategoryToLabel(category?: string | null) {
  switch (category) {
    case 'kpop-music':
      return 'K-pop & 음악';

    case 'world-knowledge':
      return '세계 상식';

    case 'trivia-tmi':
      return '잡학 & TMI';

    case 'memes-trends':
      return '인터넷 밈 & 트렌드';

    case 'sports':
      return '스포츠';

    case 'science-tech':
      return '과학 & 테크';

    case 'math-logic':
      return '수학 & 논리';

    case 'movies-drama':
      return '영화 & 드라마';

    default:
      break;
  }
}
