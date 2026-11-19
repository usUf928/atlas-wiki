import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { slugify } from '@atlas/shared';
import { api, ApiClientError } from '../../lib/api';
import type { CategoryDTO } from '../../lib/types';
import { InlineError, LoadingBlock, Modal } from '../../components/ui';

interface CategoriesResponse {
  categories: CategoryDTO[];
}

interface FlatCategory {
  id: string;
  name: string;
  depth: number;
}

function flatten(nodes: CategoryDTO[], depth = 0): FlatCategory[] {
  const out: FlatCategory[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, depth });
    out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

function findNode(nodes: CategoryDTO[], id: string): CategoryDTO | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

interface FormState {
  id?: string;
  name: string;
  slug: string;
  parentId: string;
  sortOrder: number;
}

const EMPTY: FormState = { name: '', slug: '', parentId: '', sortOrder: 0 };

export function CategoriesTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoriesResponse>('/categories'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
    void queryClient.invalidateQueries({ queryKey: ['pages'] });
  };

  const saveMutation = useMutation({
    mutationFn: (state: FormState) => {
      const body = {
        name: state.name,
        slug: state.slug || slugify(state.name),
        parentId: state.parentId || null,
        sortOrder: Number(state.sortOrder) || 0,
      };
      return state.id
        ? api(`/categories/${state.id}`, { method: 'PUT', body })
        : api('/categories', { method: 'POST', body });
    },
    onSuccess: () => {
      setForm(null);
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : '保存分类失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteTarget(null);
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : '删除分类失败'),
  });

  if (query.isLoading) return <LoadingBlock label="正在读取分类树…" />;

  const categories = query.data?.categories ?? [];
  const flat = flatten(categories);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
        <div>
          <h2 className="font-serif text-lg font-semibold text-primary">分类管理</h2>
          <p className="text-[12px] text-tertiary">删除分类时，其下条目会变为未分类，子分类会上移到被删分类的父级。</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setForm({ ...EMPTY });
            setError(null);
          }}
        >
          <FolderPlus className="h-4 w-4" aria-hidden />
          新建分类
        </button>
      </div>

      <InlineError message={error} />

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead className="bg-raised text-[12px] text-tertiary">
            <tr>
              <th className="px-3 py-2 text-left font-medium">名称</th>
              <th className="px-3 py-2 text-left font-medium">标识</th>
              <th className="px-3 py-2 text-left font-medium">条目数</th>
              <th className="px-3 py-2 text-left font-medium">排序</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {flat.map((row) => {
              const node = findNode(categories, row.id);
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <span style={{ paddingLeft: `${row.depth * 16}px` }} className="text-primary">
                      {row.depth > 0 ? <span className="mr-1 text-tertiary">└</span> : null}
                      {row.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] text-secondary">{node?.slug}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-secondary">{node?.pageCount ?? 0}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-tertiary">{node?.sortOrder ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="btn h-7 px-2"
                        onClick={() => {
                          setForm({
                            id: row.id,
                            name: row.name,
                            slug: node?.slug ?? '',
                            parentId: node?.parentId ?? '',
                            sortOrder: node?.sortOrder ?? 0,
                          });
                          setError(null);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger h-7 px-2"
                        onClick={() => setDeleteTarget(node ?? null)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {flat.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-tertiary">
                  还没有分类。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? '编辑分类' : '新建分类'}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setForm(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!form) return;
                if (!form.name.trim()) {
                  setError('请填写分类名');
                  return;
                }
                saveMutation.mutate(form);
              }}
            >
              保存
            </button>
          </>
        }
      >
        {form ? (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">名称</span>
              <input
                className="field"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={40}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">标识（slug，留空自动生成）</span>
              <input
                className="field font-mono"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="infra"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">上级分类</span>
              <select
                className="field"
                value={form.parentId}
                onChange={(event) => setForm({ ...form, parentId: event.target.value })}
              >
                <option value="">无（顶级分类）</option>
                {flat
                  .filter((item) => item.id !== form.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {'　'.repeat(item.depth)}
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">排序值（越小越靠前）</span>
              <input
                type="number"
                className="field w-32"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </label>
            <InlineError message={error} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="删除分类"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              确认删除
            </button>
          </>
        }
      >
        <p className="text-sm text-secondary">
          确认删除「{deleteTarget?.name}」？该分类下的条目会变为未分类，子分类会上移。
        </p>
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      </Modal>
    </div>
  );
}
