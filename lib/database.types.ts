/**
 * Supabase Database Types
 * Auto-generated types based on the PostgreSQL schema
 * Run `supabase gen types typescript` to regenerate
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          identity_id: string
          provider: string
          handle: string
          avatar_url: string | null
          interests: string[]
          streak: number
          last_streak_date: string | null
          xp: number
          total_correct: number
          total_played: number
          cosmetics: string[]
          skill: SkillState
          session_pref: SessionPref | null
          created_at: string
        }
        Insert: {
          id?: string
          identity_id: string
          provider: string
          handle: string
          avatar_url?: string | null
          interests?: string[]
          streak?: number
          last_streak_date?: string | null
          xp?: number
          total_correct?: number
          total_played?: number
          cosmetics?: string[]
          skill?: SkillState
          session_pref?: SessionPref | null
          created_at?: string
        }
        Update: {
          id?: string
          identity_id?: string
          provider?: string
          handle?: string
          avatar_url?: string | null
          interests?: string[]
          streak?: number
          last_streak_date?: string | null
          xp?: number
          total_correct?: number
          total_played?: number
          cosmetics?: string[]
          skill?: SkillState
          session_pref?: SessionPref | null
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          slug: string
          title: string
          emoji: string
          description: string
          sample_tags: string[] | null
          neighbors: CategoryNeighbor[] | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          emoji: string
          description: string
          sample_tags?: string[] | null
          neighbors?: CategoryNeighbor[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          emoji?: string
          description?: string
          sample_tags?: string[] | null
          neighbors?: CategoryNeighbor[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      decks: {
        Row: {
          id: string
          slug: string
          title: string
          description: string
          tags: string[]
          author_id: string | null
          visibility: DeckVisibility
          language: string
          plays: number
          likes: number
          status: DeckStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description: string
          tags?: string[]
          author_id?: string | null
          visibility?: DeckVisibility
          language?: string
          plays?: number
          likes?: number
          status?: DeckStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string
          tags?: string[]
          author_id?: string | null
          visibility?: DeckVisibility
          language?: string
          plays?: number
          likes?: number
          status?: DeckStatus
          created_at?: string
          updated_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          deck_id: string | null
          category: string
          type: QuestionType
          prompt: string
          prompt_hash: string
          media_url: string | null
          media_meta: MediaMeta | null
          tags: string[] | null
          choices: QuestionChoice[]
          answer_index: number
          explanation: string | null
          difficulty: number
          quality_score: number
          elo: number
          choice_shuffle_seed: number | null
          created_at: string
        }
        Insert: {
          id?: string
          deck_id?: string | null
          category: string
          type?: QuestionType
          prompt: string
          prompt_hash: string
          media_url?: string | null
          media_meta?: MediaMeta | null
          tags?: string[] | null
          choices: QuestionChoice[]
          answer_index: number
          explanation?: string | null
          difficulty?: number
          quality_score?: number
          elo?: number
          choice_shuffle_seed?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          deck_id?: string | null
          category?: string
          type?: QuestionType
          prompt?: string
          prompt_hash?: string
          media_url?: string | null
          media_meta?: MediaMeta | null
          tags?: string[] | null
          choices?: QuestionChoice[]
          answer_index?: number
          explanation?: string | null
          difficulty?: number
          quality_score?: number
          elo?: number
          choice_shuffle_seed?: number | null
          created_at?: string
        }
      }
      live_match_decks: {
        Row: {
          id: string
          slug: string
          title: string
          emoji: string
          description: string
          source_categories: string[]
          question_ids: string[]
          total_questions: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          emoji: string
          description: string
          source_categories?: string[]
          question_ids?: string[]
          total_questions?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          emoji?: string
          description?: string
          source_categories?: string[]
          question_ids?: string[]
          total_questions?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      live_match_rooms: {
        Row: {
          id: string
          code: string
          host_id: string | null
          host_identity: string
          status: LiveMatchStatus
          deck_id: string | null
          rules: LiveMatchRules
          current_round: number
          total_rounds: number
          server_now: number | null
          phase_ends_at: number | null
          expires_at: number | null
          version: number
          pending_action: PendingAction | null
          pause_state: PauseState | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          host_id?: string | null
          host_identity: string
          status?: LiveMatchStatus
          deck_id?: string | null
          rules?: LiveMatchRules
          current_round?: number
          total_rounds: number
          server_now?: number | null
          phase_ends_at?: number | null
          expires_at?: number | null
          version?: number
          pending_action?: PendingAction | null
          pause_state?: PauseState | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          host_id?: string | null
          host_identity?: string
          status?: LiveMatchStatus
          deck_id?: string | null
          rules?: LiveMatchRules
          current_round?: number
          total_rounds?: number
          server_now?: number | null
          phase_ends_at?: number | null
          expires_at?: number | null
          version?: number
          pending_action?: PendingAction | null
          pause_state?: PauseState | null
          created_at?: string
        }
      }
      live_match_participants: {
        Row: {
          id: string
          room_id: string | null
          user_id: string | null
          identity_id: string
          is_guest: boolean
          guest_avatar_id: number | null
          nickname: string
          is_host: boolean
          is_ready: boolean
          joined_at: string
          last_seen_at: string
          total_score: number
          avg_response_ms: number
          answers: number
          current_streak: number
          max_streak: number
          removed_at: string | null
          disconnected_at: string | null
        }
        Insert: {
          id?: string
          room_id?: string | null
          user_id?: string | null
          identity_id: string
          is_guest?: boolean
          guest_avatar_id?: number | null
          nickname: string
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string
          last_seen_at?: string
          total_score?: number
          avg_response_ms?: number
          answers?: number
          current_streak?: number
          max_streak?: number
          removed_at?: string | null
          disconnected_at?: string | null
        }
        Update: {
          id?: string
          room_id?: string | null
          user_id?: string | null
          identity_id?: string
          is_guest?: boolean
          guest_avatar_id?: number | null
          nickname?: string
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string
          last_seen_at?: string
          total_score?: number
          avg_response_ms?: number
          answers?: number
          current_streak?: number
          max_streak?: number
          removed_at?: string | null
          disconnected_at?: string | null
        }
      }
      live_match_rounds: {
        Row: {
          id: string
          room_id: string | null
          index: number
          question_id: string | null
          started_at: number
          closed_at: number | null
          reveal_at: number | null
        }
        Insert: {
          id?: string
          room_id?: string | null
          index: number
          question_id?: string | null
          started_at?: number
          closed_at?: number | null
          reveal_at?: number | null
        }
        Update: {
          id?: string
          room_id?: string | null
          index?: number
          question_id?: string | null
          started_at?: number
          closed_at?: number | null
          reveal_at?: number | null
        }
      }
      live_match_answers: {
        Row: {
          id: string
          room_id: string | null
          round_index: number
          participant_id: string | null
          choice_index: number
          received_at: number
          is_correct: boolean
          score_delta: number
        }
        Insert: {
          id?: string
          room_id?: string | null
          round_index: number
          participant_id?: string | null
          choice_index: number
          received_at: number
          is_correct: boolean
          score_delta?: number
        }
        Update: {
          id?: string
          room_id?: string | null
          round_index?: number
          participant_id?: string | null
          choice_index?: number
          received_at?: number
          is_correct?: boolean
          score_delta?: number
        }
      }
      live_match_logs: {
        Row: {
          id: string
          room_id: string | null
          type: string
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id?: string | null
          type: string
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string | null
          type?: string
          payload?: Json | null
          created_at?: string
        }
      }
      live_match_reactions: {
        Row: {
          id: string
          room_id: string | null
          participant_id: string | null
          round_index: number
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id?: string | null
          participant_id?: string | null
          round_index: number
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string | null
          participant_id?: string | null
          round_index?: number
          emoji?: string
          created_at?: string
        }
      }
      answers: {
        Row: {
          id: string
          user_id: string | null
          question_id: string | null
          category: string
          tags: string[] | null
          choice_id: string
          answer_token: string
          is_correct: boolean
          time_ms: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          question_id?: string | null
          category: string
          tags?: string[] | null
          choice_id: string
          answer_token: string
          is_correct: boolean
          time_ms: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          question_id?: string | null
          category?: string
          tags?: string[] | null
          choice_id?: string
          answer_token?: string
          is_correct?: boolean
          time_ms?: number
          created_at?: string
        }
      }
      quiz_history: {
        Row: {
          id: string
          user_id: string | null
          mode: QuizHistoryMode
          session_id: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          mode: QuizHistoryMode
          session_id: string
          payload: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          mode?: QuizHistoryMode
          session_id?: string
          payload?: Json
          created_at?: string
        }
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string | null
          question_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          question_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          question_id?: string | null
          created_at?: string
        }
      }
      user_skill: {
        Row: {
          id: string
          user_id: string | null
          key: string
          elo: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          key: string
          elo?: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          key?: string
          elo?: number
          updated_at?: string
        }
      }
      daily_quizzes: {
        Row: {
          id: string
          available_date: string
          category: DailyCategory
          questions: DailyQuestion[]
          share_template: ShareTemplate
          created_at: string
        }
        Insert: {
          id?: string
          available_date: string
          category: DailyCategory
          questions: DailyQuestion[]
          share_template: ShareTemplate
          created_at?: string
        }
        Update: {
          id?: string
          available_date?: string
          category?: DailyCategory
          questions?: DailyQuestion[]
          share_template?: ShareTemplate
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          deck_id: string | null
          question_id: string | null
          reporter_id: string | null
          reason: string
          note: string | null
          resolved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          deck_id?: string | null
          question_id?: string | null
          reporter_id?: string | null
          reason: string
          note?: string | null
          resolved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          deck_id?: string | null
          question_id?: string | null
          reporter_id?: string | null
          reason?: string
          note?: string | null
          resolved?: boolean
          created_at?: string
        }
      }
      guest_reports: {
        Row: {
          id: string
          deck_slug: string
          category: string
          prompt: string
          reason: string
          note: string | null
          choice_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          deck_slug: string
          category: string
          prompt: string
          reason: string
          note?: string | null
          choice_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          deck_slug?: string
          category?: string
          prompt?: string
          reason?: string
          note?: string | null
          choice_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      guest_swipe_answers: {
        Row: {
          id: string
          session_key: string
          question_id: string
          deck_slug: string
          category: string
          prompt: string
          choice_id: string
          is_correct: boolean
          time_ms: number | null
          tags: string[] | null
          difficulty: number | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_key: string
          question_id: string
          deck_slug: string
          category: string
          prompt: string
          choice_id: string
          is_correct: boolean
          time_ms?: number | null
          tags?: string[] | null
          difficulty?: number | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_key?: string
          question_id?: string
          deck_slug?: string
          category?: string
          prompt?: string
          choice_id?: string
          is_correct?: boolean
          time_ms?: number | null
          tags?: string[] | null
          difficulty?: number | null
          metadata?: Json | null
          created_at?: string
        }
      }
      tag_index: {
        Row: {
          id: string
          tag: string
          question_id: string | null
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          tag: string
          question_id?: string | null
          category: string
          created_at?: string
        }
        Update: {
          id?: string
          tag?: string
          question_id?: string | null
          category?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_room_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      cleanup_expired_live_rooms: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      deck_visibility: DeckVisibility
      deck_status: DeckStatus
      question_type: QuestionType
      match_mode: MatchMode
      live_match_status: LiveMatchStatus
      daily_category: DailyCategory
      quiz_history_mode: QuizHistoryMode
    }
  }
}

// Custom types
export type DeckVisibility = 'public' | 'unlisted' | 'private'
export type DeckStatus = 'draft' | 'published' | 'blocked'
export type QuestionType = 'mcq' | 'image' | 'audio' | 'boolean'
export type MatchMode = 'daily' | 'swipe' | 'live_match'
export type LiveMatchStatus =
  | 'lobby'
  | 'countdown'
  | 'question'
  | 'grace'
  | 'reveal'
  | 'leaderboard'
  | 'results'
  | 'paused'
export type DailyCategory =
  | 'tech_it'
  | 'variety_reality'
  | 'drama_movie'
  | 'sports_games'
  | 'kpop_music'
  | 'fashion_life'
  | 'news_issues'
export type QuizHistoryMode = 'daily' | 'swipe' | 'live_match'

// JSON types
export interface SkillState {
  global: number
  tags: { tag: string; rating: number }[]
}

export interface SessionPref {
  swipe?: {
    lastCursor?: number
    excludeIds?: string[]
    updatedAt?: number
    recentQuestionIds?: string[]
    lastResetAt?: number
    category?: string
  }
}

export interface CategoryNeighbor {
  slug: string
  weight: number
}

export interface QuestionChoice {
  id: string
  text: string
}

export interface MediaMeta {
  aspect?: string
  width?: number
  height?: number
}

export interface LiveMatchRules {
  rounds: number
  readSeconds: number
  answerSeconds: number
  graceSeconds: number
  revealSeconds: number
  leaderboardSeconds: number
}

export interface PendingAction {
  type: 'start' | 'rematch' | 'toLobby'
  executeAt: number
  delayMs: number
  createdAt: number
  initiatedBy?: string
  initiatedIdentity?: string
  label: string
}

export interface PauseState {
  previousStatus: LiveMatchStatus
  remainingMs?: number
  pausedAt: number
}

export interface DailyQuestion {
  id: string
  prompt: string
  correctAnswer: boolean
  explanation: string
  difficulty: number
}

export interface ShareTemplate {
  headline: string
  cta: string
  emoji: string
}

// Table row types for convenience
export type User = Database['public']['Tables']['users']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Deck = Database['public']['Tables']['decks']['Row']
export type Question = Database['public']['Tables']['questions']['Row']
export type LiveMatchDeck = Database['public']['Tables']['live_match_decks']['Row']
export type LiveMatchRoom = Database['public']['Tables']['live_match_rooms']['Row']
export type LiveMatchParticipant = Database['public']['Tables']['live_match_participants']['Row']
export type LiveMatchRound = Database['public']['Tables']['live_match_rounds']['Row']
export type LiveMatchAnswer = Database['public']['Tables']['live_match_answers']['Row']
export type LiveMatchLog = Database['public']['Tables']['live_match_logs']['Row']
export type LiveMatchReaction = Database['public']['Tables']['live_match_reactions']['Row']
export type Answer = Database['public']['Tables']['answers']['Row']
export type QuizHistory = Database['public']['Tables']['quiz_history']['Row']
export type Bookmark = Database['public']['Tables']['bookmarks']['Row']
export type UserSkill = Database['public']['Tables']['user_skill']['Row']
export type DailyQuiz = Database['public']['Tables']['daily_quizzes']['Row']
export type Report = Database['public']['Tables']['reports']['Row']
export type GuestReport = Database['public']['Tables']['guest_reports']['Row']
export type GuestSwipeAnswer = Database['public']['Tables']['guest_swipe_answers']['Row']
export type TagIndex = Database['public']['Tables']['tag_index']['Row']
