import type { ThemeRegistration } from 'shiki';

export const atlasTheme: ThemeRegistration = {
  name: 'atlas-dim',
  type: 'dark',
  colors: {
    'editor.background': '#08090A',
    'editor.foreground': '#C4C8CE',
    'editorLineNumber.foreground': '#3E434A',
    'editorLineNumber.activeForeground': '#5A606A',
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#5A606A', fontStyle: 'italic' },
    },
    {
      scope: ['string', 'constant.other.symbol', 'punctuation.definition.string'],
      settings: { foreground: '#7E9A83' },
    },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'],
      settings: { foreground: '#8FA3B3' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: { foreground: '#A9B7C2' },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'support.constant'],
      settings: { foreground: '#8C7A4F' },
    },
    {
      scope: ['variable', 'variable.other', 'entity.name.type', 'support.type'],
      settings: { foreground: '#B4B9C0' },
    },
    {
      scope: ['entity.name.tag', 'meta.tag', 'punctuation.definition.tag'],
      settings: { foreground: '#8A9099' },
    },
    {
      scope: ['entity.other.attribute-name'],
      settings: { foreground: '#8C7A4F' },
    },
    {
      scope: ['punctuation', 'meta.brace'],
      settings: { foreground: '#6E747C' },
    },
    {
      scope: ['markup.heading', 'markup.bold'],
      settings: { foreground: '#C4C8CE', fontStyle: 'bold' },
    },
    {
      scope: ['markup.italic'],
      settings: { foreground: '#A9B7C2', fontStyle: 'italic' },
    },
    {
      scope: ['invalid', 'invalid.illegal'],
      settings: { foreground: '#8C5A5A' },
    },
  ],
};
