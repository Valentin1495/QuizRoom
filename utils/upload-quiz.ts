const quizzes = [
  {
    answer: '트리플 크라운 (투수)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '사이클링 히트',
      '퍼펙트 게임',
      '노히트 노런',
      '트리플 크라운 (투수)',
    ],
    question:
      '메이저리그 야구에서 투수가 다승, 탈삼진, 평균자책점 세 부문에서 모두 1위를 차지하는 것을 일컫는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '펜트하우스 (Penthouse)',
    category: 'sports',
    difficulty: 'hard',
    options: ['에이펙스', '그립', '팔로 스루', '펜트하우스 (Penthouse)'],
    question:
      '골프에서 클럽 페이스의 스코어 라인 중 가장 윗부분을 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '아르헨티나',
    category: 'sports',
    difficulty: 'hard',
    options: ['브라질', '독일', '이탈리아', '아르헨티나'],
    question:
      "디에고 마라도나가 '신의 손' 논란을 일으킨 1986년 멕시코 월드컵에서 우승한 국가는 어디인가요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '존 맥켄로',
    category: 'sports',
    difficulty: 'hard',
    options: ['비외른 보리', '지미 코너스', '앤드리 애거시', '존 맥켄로'],
    question:
      "'You cannot be serious!'라는 발언으로 유명한 테니스계의 악동이자 왼손잡이 선수로 알려진 인물은 누구인가요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '클래식 (Classic)',
    category: 'sports',
    difficulty: 'hard',
    options: ['자전거', '평지 경기', '타임 트라이얼', '클래식 (Classic)'],
    question:
      '사이클 도로 경기에서 하루 동안 장거리를 달리는 단일 경주를 의미하는 용어는 무엇인가요? (예: 파리-루베)',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '포인트가드 (Point Guard)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '슈팅가드',
      '스몰 포워드',
      '파워 포워드',
      '포인트가드 (Point Guard)',
    ],
    question:
      '농구에서 주로 공격을 지휘하고 볼 운반 및 패스를 담당하는 포지션은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '1900년 파리 올림픽',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '1896년 아테네 올림픽',
      '1900년 파리 올림픽',
      '1904년 세인트루이스 올림픽',
      '1908년 런던 올림픽',
    ],
    question: '여성 선수가 처음으로 올림픽에 참가한 대회는 언제인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '조지 포먼',
    category: 'sports',
    difficulty: 'hard',
    options: ['조 프레이저', '켄 노턴', '래리 홈즈', '조지 포먼'],
    question:
      "1974년 '정글의 럼블(Rumble in the Jungle)' 경기에서 무하마드 알리에게 패배한 전설적인 헤비급 복서의 이름은 무엇인가요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '트리플 악셀',
    category: 'sports',
    difficulty: 'hard',
    options: ['더블 악셀', '쿼드러플 토루프', '트리플 플립', '트리플 악셀'],
    question:
      '피겨스케이팅에서 앞을 보고 점프하여 공중에서 세 바퀴 반을 도는 점프 기술은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '투구폼',
    category: 'sports',
    difficulty: 'hard',
    options: ['타격폼', '수비폼', '러닝폼', '투구폼'],
    question:
      '야구에서 투수가 공을 던지기 위해 취하는 자세와 동작을 통틀어 이르는 말은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '스켈레톤',
    category: 'sports',
    difficulty: 'hard',
    options: ['봅슬레이', '루지', '스켈레톤', '아이스하키'],
    question:
      '1928년 생모리츠 동계 올림픽에서 처음 정식 종목으로 채택되었던 썰매 종목으로, 머리부터 진행하는 것은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '커브볼',
    category: 'sports',
    difficulty: 'hard',
    options: ['직구', '슬라이더', '체인지업', '커브볼'],
    question:
      '야구에서 투수가 던진 공이 포물선을 그리며 떨어지는 변화구는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '오프사이드 (Offside)',
    category: 'sports',
    difficulty: 'hard',
    options: ['핸드볼', '파울', '태클', '오프사이드 (Offside)'],
    question:
      '축구에서 공격 선수가 상대 진영에서 상대방의 두 번째 최후방 수비수보다 더 앞서서 공을 받는 반칙은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '백스윙 (Backswing)',
    category: 'sports',
    difficulty: 'hard',
    options: ['다운스윙', '폴로 스루', '임팩트', '백스윙 (Backswing)'],
    question:
      '골프에서 클럽을 들어 올리는 동작으로, 스윙의 시작 단계에 해당하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '트리플 더블 (Triple-Double)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '더블 더블',
      '쿼드러플 더블',
      '파이브 바이 파이브',
      '트리플 더블 (Triple-Double)',
    ],
    question:
      '농구에서 한 선수가 득점, 리바운드, 어시스트, 스틸, 블록 중 세 가지 부문에서 두 자릿수 기록을 달성하는 것을 무엇이라고 하나요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '피치앤드퍼트 (Pitch and Putt)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '스크램블',
      '매치 플레이',
      '포볼',
      '피치앤드퍼트 (Pitch and Putt)',
    ],
    question:
      '골프의 한 형태로, 주로 9홀이나 18홀로 구성되며 짧은 거리에서 피칭과 퍼팅 기술을 연습하는 코스는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '코너 플래그 (Corner Flag)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '골 포스트',
      '크로스바',
      '센터 서클',
      '코너 플래그 (Corner Flag)',
    ],
    question:
      '축구 경기장에서 코너킥을 차는 위치를 표시하는 깃발은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '러닝백 (Running Back)',
    category: 'sports',
    difficulty: 'hard',
    options: ['쿼터백', '와이드 리시버', '라인배커', '러닝백 (Running Back)'],
    question:
      '미식축구에서 주로 공을 들고 달리며 공격하는 포지션은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '보디 빌딩',
    category: 'sports',
    difficulty: 'hard',
    options: ['역도', '파워리프팅', '크로스핏', '보디 빌딩'],
    question:
      "근육의 크기, 균형, 선명도를 기준으로 평가하는 스포츠로, '미스터 올림피아' 대회가 유명한 것은 무엇인가요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '파이브 세트 (Five-set)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '세트 매치',
      '타이브레이크',
      '어드밴티지',
      '파이브 세트 (Five-set)',
    ],
    question:
      '테니스 그랜드 슬램 남자 단식 경기에서 최종 승리하기 위해 필요한 세트 수는 몇 세트인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '아이싱 (Icing)',
    category: 'sports',
    difficulty: 'hard',
    options: ['오프사이드', '핸드볼', '크로스 체크', '아이싱 (Icing)'],
    question:
      '아이스하키에서 선수가 자기 진영에서 퍽을 쳐서 상대편 골라인을 넘어뜨리는 반칙은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '해트트릭 (Hat-trick)',
    category: 'sports',
    difficulty: 'hard',
    options: ['더블골', '쿼드러플 골', '펜타골', '해트트릭 (Hat-trick)'],
    question:
      '축구에서 한 선수가 한 경기에서 세 골을 기록하는 것을 일컫는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '오버핸드 서브 (Overhand Serve)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '언더핸드 서브',
      '점프 서브',
      '플로터 서브',
      '오버핸드 서브 (Overhand Serve)',
    ],
    question:
      '배구에서 공을 머리 위로 던져 올린 후 한 손으로 때려 넣는 가장 일반적인 서브 방식은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '사브르 (Sabre)',
    category: 'sports',
    difficulty: 'hard',
    options: ['플뢰레', '에페', '포일', '사브르 (Sabre)'],
    question:
      '펜싱에서 찌르기뿐만 아니라 베기도 가능한 종목으로, 머리부터 허리까지의 상체 부위가 유효면인 것은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '브릿지 (Bridge)',
    category: 'sports',
    difficulty: 'hard',
    options: ['매스', '큐볼', '레일', '브릿지 (Bridge)'],
    question:
      '당구에서 큐를 안정적으로 지지하기 위해 손으로 만드는 형태를 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '크로스컨트리 스키 (Cross-country Skiing)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '알파인 스키',
      '스키 점프',
      '노르딕 복합',
      '크로스컨트리 스키 (Cross-country Skiing)',
    ],
    question:
      '스키를 신고 평지나 완만한 언덕을 이동하는 장거리 종목으로, 올림픽에서 가장 오래된 스키 종목은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '파워 플레이 (Power Play)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '페널티 킬',
      '숏핸디드',
      '페이스오프',
      '파워 플레이 (Power Play)',
    ],
    question:
      '아이스하키에서 상대방 선수 한 명이 페널티를 받아 퇴장하여 우리 팀이 수적 우위를 점하는 상황은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '쿼터백 (Quarterback)',
    category: 'sports',
    difficulty: 'hard',
    options: ['러닝백', '와이드 리시버', '타이트 엔드', '쿼터백 (Quarterback)'],
    question:
      '미식축구에서 공격의 지휘자이자 거의 모든 플레이를 시작하는 포지션은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '프리 스로우 (Free Throw)',
    category: 'sports',
    difficulty: 'hard',
    options: ['점프 슛', '레이업 슛', '덩크 슛', '프리 스로우 (Free Throw)'],
    question:
      '농구에서 상대방의 파울로 인해 주어지는 자유투 기회로, 득점 시 1점을 얻는 것은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '버피 테스트 (Burpee Test)',
    category: 'sports',
    difficulty: 'hard',
    options: ['플랭크', '스쿼트', '런지', '버피 테스트 (Burpee Test)'],
    question:
      '전신 운동 능력 향상에 효과적인 운동으로, 푸쉬업, 스쿼트 점프 등을 결합한 고강도 운동은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '마라톤',
    category: 'sports',
    difficulty: 'hard',
    options: ['울트라마라톤', '하프 마라톤', '10K 레이스', '마라톤'],
    question:
      'BC 490년 그리스와 페르시아의 전쟁에서 마라톤 평원의 승전보를 알리기 위해 병사가 달린 거리에서 유래한 육상 종목은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '푸시 오프 (Push-off)',
    category: 'sports',
    difficulty: 'hard',
    options: ['킥턴', '글라이드', '스트로크', '푸시 오프 (Push-off)'],
    question:
      '수영 경기에서 출발 시나 턴 후에 벽을 밀고 나가는 동작을 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '피벗 (Pivot)',
    category: 'sports',
    difficulty: 'hard',
    options: ['드리블', '패스', '슛', '피벗 (Pivot)'],
    question:
      '농구에서 공을 잡은 선수가 한 발을 축으로 하여 다른 발을 움직이는 기술은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '보디 체크 (Body Check)',
    category: 'sports',
    difficulty: 'hard',
    options: ['스틱 체크', '슬래싱', '트리핑', '보디 체크 (Body Check)'],
    question:
      '아이스하키에서 어깨나 엉덩이를 이용하여 상대방을 밀쳐내는 합법적인 수비 기술은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '세리머니 (Ceremony)',
    category: 'sports',
    difficulty: 'hard',
    options: ['웜업', '쿨다운', '팀워크', '세리머니 (Ceremony)'],
    question:
      '스포츠 경기에서 승리 후 선수들이 기쁨을 표현하거나 관중에게 감사하는 행동을 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '풀업 (Pull-up)',
    category: 'sports',
    difficulty: 'hard',
    options: ['푸쉬업', '딥스', '벤치프레스', '풀업 (Pull-up)'],
    question: '철봉에 매달려 턱걸이를 하는 상체 근력 운동은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '스크럼 (Scrum)',
    category: 'sports',
    difficulty: 'hard',
    options: ['라인아웃', '탭태클', '킥오프', '스크럼 (Scrum)'],
    question:
      '럭비에서 경기가 중단된 후 공을 재개하는 방법 중 하나로, 양 팀 선수들이 서로 밀면서 공을 얻으려는 대형은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '백스핀 (Backspin)',
    category: 'sports',
    difficulty: 'hard',
    options: ['톱스핀', '사이드스핀', '언더스핀', '백스핀 (Backspin)'],
    question:
      '테니스나 탁구에서 공이 뒤로 회전하도록 치는 기술로, 공이 착지 후 역회전하며 낮게 튀는 특징이 있는 것은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '슬라이더 (Slider)',
    category: 'sports',
    difficulty: 'hard',
    options: ['커브볼', '체인지업', '스플리터', '슬라이더 (Slider)'],
    question:
      '야구에서 투수가 던진 공이 옆으로 휘어져 들어가는 변화구는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '레그 트랩 (Leg Trap)',
    category: 'sports',
    difficulty: 'hard',
    options: ['암바', '초크', '헤드락', '레그 트랩 (Leg Trap)'],
    question:
      '레슬링에서 상대방의 다리를 자신의 다리로 묶어 움직임을 제한하는 기술은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '에이스 (Ace)',
    category: 'sports',
    difficulty: 'hard',
    options: ['폴트', '렛', '더블 폴트', '에이스 (Ace)'],
    question:
      '테니스 경기에서 서브한 공이 상대방 라켓에 닿지 않고 바로 득점으로 이어지는 것을 무엇이라고 하나요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '투수 분업 (Pitching Specialization)',
    category: 'sports',
    difficulty: 'hard',
    options: [
      '선발 로테이션',
      '불펜 투수',
      '롱 릴리프',
      '투수 분업 (Pitching Specialization)',
    ],
    question:
      '현대 야구에서 선발 투수, 중간 계투, 마무리 투수 등으로 역할을 나누어 운영하는 시스템을 총칭하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '골든 골 (Golden Goal)',
    category: 'sports',
    difficulty: 'hard',
    options: ['실버 골', '연장전', '승부차기', '골든 골 (Golden Goal)'],
    question:
      '과거 축구 연장전 방식 중 하나로, 연장전에서 먼저 득점한 팀이 즉시 승리하는 규칙을 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '하프 타임 (Half-time)',
    category: 'sports',
    difficulty: 'hard',
    options: ['쿼터 타임', '타임아웃', '정규 시간', '하프 타임 (Half-time)'],
    question:
      '축구나 농구 등 경기 중간에 주어지는 휴식 시간을 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '러프 (Rough)',
    category: 'sports',
    difficulty: 'hard',
    options: ['페어웨이', '그린', '벙커', '러프 (Rough)'],
    question:
      '골프 코스에서 페어웨이 주변의 깎지 않은 긴 풀 지역을 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '스플릿 (Split)',
    category: 'sports',
    difficulty: 'hard',
    options: ['스트라이크', '스페어', '오픈 프레임', '스플릿 (Split)'],
    question:
      '볼링에서 첫 투구 후 남은 핀들이 서로 떨어져 있어 동시에 쓰러뜨리기 어려운 배열을 의미하는 용어는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '도루 (Stolen Base)',
    category: 'sports',
    difficulty: 'hard',
    options: ['견제', '태그 아웃', '병살', '도루 (Stolen Base)'],
    question:
      '야구에서 주자가 다음 루로 무사히 이동하는 플레이로, 투수의 투구 도중 베이스를 훔치는 것은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '블록 (Block)',
    category: 'sports',
    difficulty: 'hard',
    options: ['스파이크', '서브', '리시브', '블록 (Block)'],
    question:
      '배구에서 상대방의 스파이크 공격을 네트 앞에서 손으로 막아내는 수비 기술은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '서핑 (Surfing)',
    category: 'sports',
    difficulty: 'hard',
    options: ['웨이크보드', '카이트보드', '윈드서핑', '서핑 (Surfing)'],
    question:
      '파도를 타고 보드 위에서 균형을 잡으며 미끄러져 내려오는 해양 스포츠는 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '체조 마루 (Floor Exercise)',
    category: 'sports',
    difficulty: 'hard',
    options: ['평행봉', '철봉', '안마', '체조 마루 (Floor Exercise)'],
    question:
      '기계 체조 종목 중 유일하게 음악에 맞춰 연기를 펼치는 종목은 무엇인가요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
];

console.log(quizzes.length);

export const uploadQuizBatch = async (insertQuizBatch: any) => {
  try {
    const result = await insertQuizBatch({ quizzes });
    console.log(`✅ Successfully uploaded ${result.count} quizzes in batch`);
    return result;
  } catch (error) {
    console.error('❌ Batch upload failed:', error);
    throw error;
  }
};
