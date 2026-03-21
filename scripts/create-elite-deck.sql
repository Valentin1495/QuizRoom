INSERT INTO decks (slug, title, description, tags, status)
VALUES (
  'deck_skill_assessment_elite_v1',
  '스킬 평가 상위 판별전',
  '스킬 평가 상위권 진입자 전용 추가 판별 문제 세트',
  ARRAY['mode:elite_round', 'mode:skill_assessment', 'assessment:elite'],
  'published'
)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  updated_at = NOW();
