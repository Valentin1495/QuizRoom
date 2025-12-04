-- QuizRoom Seed Data
-- Initial categories based on constants/categories.ts

INSERT INTO categories (slug, title, emoji, description, sample_tags, neighbors, is_active) VALUES
('tech_it', '테크/IT', '💻', '최신 기술, IT 트렌드, 디지털 문화', 
  ARRAY['AI', '스마트폰', '앱', '게임', '소프트웨어'], 
  '[{"slug": "sports_games", "weight": 0.3}, {"slug": "news_issues", "weight": 0.2}]'::jsonb, 
  true),
('variety_reality', '예능/리얼리티', '🎭', '인기 예능, 리얼리티 쇼, 웹예능',
  ARRAY['런닝맨', '나혼산', '유퀴즈', '놀면뭐하니', '유재석'],
  '[{"slug": "drama_movie", "weight": 0.4}, {"slug": "kpop_music", "weight": 0.3}]'::jsonb,
  true),
('drama_movie', '드라마/영화', '🎬', '국내외 드라마, 영화, OTT 콘텐츠',
  ARRAY['넷플릭스', '디즈니+', '한국영화', '할리우드', '웹드라마'],
  '[{"slug": "variety_reality", "weight": 0.4}, {"slug": "kpop_music", "weight": 0.2}]'::jsonb,
  true),
('sports_games', '스포츠/e스포츠', '⚽', '축구, 야구, e스포츠, 올림픽',
  ARRAY['손흥민', 'MLB', 'KBO', 'LoL', '월드컵'],
  '[{"slug": "tech_it", "weight": 0.3}, {"slug": "news_issues", "weight": 0.2}]'::jsonb,
  true),
('kpop_music', 'K-POP/음악', '🎵', '아이돌, 음악 차트, 콘서트, 음원',
  ARRAY['BTS', '블랙핑크', '아이브', '뉴진스', '멜론차트'],
  '[{"slug": "variety_reality", "weight": 0.3}, {"slug": "drama_movie", "weight": 0.2}]'::jsonb,
  true),
('fashion_life', '패션/라이프', '👗', '뷰티, 패션 트렌드, 라이프스타일',
  ARRAY['뷰티', '명품', '인테리어', '여행', '맛집'],
  '[{"slug": "news_issues", "weight": 0.2}, {"slug": "variety_reality", "weight": 0.2}]'::jsonb,
  true),
('news_issues', '시사/이슈', '📰', '뉴스, 사회 이슈, 경제, 정치',
  ARRAY['경제', '부동산', '취업', '정치', '국제'],
  '[{"slug": "tech_it", "weight": 0.2}, {"slug": "sports_games", "weight": 0.2}]'::jsonb,
  true),
('general_knowledge', '상식/교양', '📚', '일반 상식, 역사, 과학, 문화',
  ARRAY['역사', '과학', '지리', '문학', '예술'],
  '[{"slug": "news_issues", "weight": 0.3}, {"slug": "tech_it", "weight": 0.2}]'::jsonb,
  true);

-- Sample Live Match Deck
INSERT INTO live_match_decks (slug, title, emoji, description, source_categories, is_active) VALUES
('mixed_popular', '인기 종합', '🔥', '가장 인기 있는 퀴즈 모음', 
  ARRAY['kpop_music', 'variety_reality', 'drama_movie'], true),
('kpop_special', 'K-POP 스페셜', '🎤', 'K-POP 팬을 위한 퀴즈',
  ARRAY['kpop_music'], true),
('entertainment', '연예/방송', '📺', '예능과 드라마 퀴즈',
  ARRAY['variety_reality', 'drama_movie'], true);
