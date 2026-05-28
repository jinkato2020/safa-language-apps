// 静的JSONからアプリ用データをロードして公開する。
import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import examplesJson from '../data/examples.json';
import wordCategoriesJson from '../data/wordCategories.json';
import wordsJson from '../data/words.json';
import grammarThemesJson from '../data/grammarThemes.json';
import grammarExamplesJson from '../data/grammarExamples.json';
import type { ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta } from './types';

export const THEMES: ThemeMeta[] = themesJson as ThemeMeta[];
export const LEVELS: LevelMeta[] = levelsJson as LevelMeta[];
export const EXAMPLES: Record<string, Example[]> = examplesJson as Record<string, Example[]>;
export const WORD_CATEGORIES: WordCategoryMeta[] = wordCategoriesJson as WordCategoryMeta[];
export const WORDS: Record<string, Word[]> = wordsJson as Record<string, Word[]>;
export const GRAMMAR_THEMES: GrammarThemeMeta[] = grammarThemesJson as GrammarThemeMeta[];
export const GRAMMAR_EXAMPLES: Record<string, Example[]> = grammarExamplesJson as Record<string, Example[]>;

export function getExamples(themeId: number, levelId: number): Example[] {
  return EXAMPLES[`${themeId}-${levelId}`] ?? [];
}

export function getWords(categoryId: number): Word[] {
  return WORDS[String(categoryId)] ?? [];
}

export function getGrammarExamples(themeId: number): Example[] {
  return GRAMMAR_EXAMPLES[String(themeId)] ?? [];
}
