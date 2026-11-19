import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Code,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Save,
  Table,
  Upload,
} from 'lucide-react';
import { uploadImage } from '../lib/api';
import { Markdown } from './Markdown';
import { Spinner } from './ui';

type Mode = 'split' | 'edit' | 'preview';

export function MarkdownEditor({
  value,
  onChange,
  onSave,
  saving,
  disabled,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  saving: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>('split');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
      }
      if (event.key === 'Tab' && document.activeElement === textareaRef.current) {
        event.preventDefault();
        insert('  ');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const replaceSelection = (before: string, after = '', placeholder = '文本') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insert = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const next = `${value.slice(0, start)}${snippet}${value.slice(textarea.selectionEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const prefixLine = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
    const next = `${value.slice(0, start)}${prefix}${value.slice(start)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.selectionStart + prefix.length, textarea.selectionStart + prefix.length);
    });
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadImage(file);
      insert(`\n![${file.name.replace(/\.[^.]+$/, '')}](${result.url})\n`);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const tools = [
    { label: '粗体', icon: Bold, action: () => replaceSelection('**', '**', '粗体') },
    { label: '斜体', icon: Italic, action: () => replaceSelection('*', '*', '斜体') },
    { label: '标题', icon: Heading2, action: () => prefixLine('## ') },
    { label: '链接', icon: LinkIcon, action: () => replaceSelection('[', '](https://)', '链接文字') },
    { label: '行内代码', icon: Code, action: () => replaceSelection('`', '`', 'code') },
    { label: '引用', icon: Quote, action: () => prefixLine('> ') },
    { label: '无序列表', icon: List, action: () => prefixLine('- ') },
    { label: '有序列表', icon: ListOrdered, action: () => prefixLine('1. ') },
    {
      label: '表格',
      icon: Table,
      action: () =>
        insert('\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n'),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-t border border-line bg-raised px-2 py-1.5">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            className="btn-ghost btn h-7 w-7 p-0"
            title={tool.label}
            aria-label={tool.label}
            onClick={tool.action}
            disabled={disabled}
          >
            <tool.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        <button
          type="button"
          className="btn-ghost btn h-7 w-7 p-0"
          title="上传图片"
          aria-label="上传图片"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? <Spinner className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => void onPickFile(event.target.files?.[0])}
        />
        <div className="ml-auto flex items-center gap-1">
          {(['split', 'edit', 'preview'] as Mode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`btn h-7 px-2 text-[12px] ${mode === item ? 'btn-primary' : 'btn-ghost'}`}
            >
              {item === 'split' ? '分栏' : item === 'edit' ? '编辑' : '预览'}
            </button>
          ))}
          <button type="button" className="btn btn-primary ml-1 h-7" onClick={onSave} disabled={saving || disabled}>
            <Save className="h-3.5 w-3.5" aria-hidden />
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      <div className={`grid gap-0 overflow-hidden rounded-b border border-t-0 border-line ${mode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {mode !== 'preview' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            spellCheck={false}
            placeholder="在此撰写 Markdown。支持 [[条目名]] 内链、GFM 表格与代码块。"
            className="min-h-[62vh] w-full resize-y border-0 bg-sunken p-4 font-mono text-[13px] leading-[1.7] text-primary outline-none"
          />
        ) : null}
        {mode !== 'edit' ? (
          <div className={`min-h-[62vh] overflow-y-auto bg-base p-4 ${mode === 'split' ? 'hidden lg:block' : ''}`}>
            {value.trim() ? (
              <Markdown content={value} />
            ) : (
              <p className="text-sm text-tertiary">预览区域。左侧输入的 Markdown 会实时渲染在这里。</p>
            )}
          </div>
        ) : null}
      </div>

      {mode === 'split' ? (
        <p className="text-[12px] text-tertiary lg:hidden">窄屏下预览默认隐藏，可切换到「预览」查看。</p>
      ) : null}
      {uploadError ? <p className="text-[12px] text-danger">{uploadError}</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      <p className="text-[12px] text-tertiary">
        Tab 缩进 · Ctrl/Cmd + S 保存 · 本地草稿自动保存在此浏览器 · 支持上传 PNG / JPEG / WebP / GIF（≤ 2MB）
      </p>
    </div>
  );
}
