type HighlightFn = (code: string, language: string) => Promise<string | null>;

let loader: Promise<HighlightFn> | null = null;

export async function highlightCode(code: string, language: string): Promise<string | null> {
  try {
    if (!loader) {
      loader = import('./highlightCore').then((module) => module.highlightWithHighlighter);
    }
    const highlight = await loader;
    return await highlight(code, language);
  } catch (error) {
    console.warn('[shiki] 高亮失败', error);
    return null;
  }
}
