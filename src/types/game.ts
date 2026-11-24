export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraPreset = 'front' | 'angled' | 'wide';

export type PodKind = 'idle' | 'telegraph' | 'standard' | 'double' | 'sequence' | 'hazard';

export type PatternName =
  | 'SINGLE PULSE'
  | 'CROSS SWEEP'
  | 'DUAL SYNC'
  | 'DOUBLE TAP'
  | 'TRACE SEQUENCE'
  | 'HAZARD BLITZ'
  | 'HYPER MATRIX';

export type ReactionGrade = 'LIGHTNING' | 'SHARP' | 'GOOD' | 'MISS' | 'HAZARD' | 'WAVE CLEAR' | '';

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  wave: number;
  patternName: PatternName;
  combo: number;
  maxCombo: number;
  multiplier: number;
  lives: number;
  maxLives: number;
  avgReactionMs: number;
  lastReactionMs: number | null;
  accuracy: number;
  hits: number;
  totalAttempts: number;
  waveProgress: number; // 0 to 1
  speedFactor: number;
  reactionGrade: ReactionGrade;
  gradeTimestamp: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  wave: number;
  avgReactionMs: number;
  accuracy: number;
  maxCombo: number;
  dateIso: string;
}
