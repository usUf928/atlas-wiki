import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from 'shiki/langs/bash.mjs';
import css from 'shiki/langs/css.mjs';
import html from 'shiki/langs/html.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import json from 'shiki/langs/json.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import python from 'shiki/langs/python.mjs';
import sql from 'shiki/langs/sql.mjs';
import tsx from 'shiki/langs/tsx.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import yaml from 'shiki/langs/yaml.mjs';
import { atlasTheme } from './shikiTheme';

const LANGS = [bash, css, html, javascript, json, markdown, python, sql, tsx, typescript, yaml];
const LANG_ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  js: 'javascript',
  ts: 'typescript',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
};

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [atlasTheme],
      langs: LANGS,
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

export async function highlightWithHighlighter(code: string, language: string): Promise<string | null> {
  const highlighter = await getHighlighter();
  const resolved = LANG_ALIASES[language] ?? language;
  const available = highlighter.getLoadedLanguages();
  if (!available.includes(resolved)) return null;
  return highlighter.codeToHtml(code, {
    lang: resolved,
    theme: 'atlas-dim',
    transformers: [
      {
        pre(node) {
          node.properties.style = 'background-color: transparent;';
          node.properties.tabindex = '0';
        },
      },
    ],
  });
}
