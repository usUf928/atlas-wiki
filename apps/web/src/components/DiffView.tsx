import type { DiffLineDTO } from '../lib/types';
import { cn } from '../lib/utils';

export function DiffView({ lines, compact = false }: { lines: DiffLineDTO[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto border border-line bg-sunken">
      <table className="w-full border-collapse font-mono text-[12px] leading-5">
        <tbody>
          {lines.map((line, index) => (
            <tr
              key={`${index}-${line.type}`}
              className={cn(
                line.type === 'add' && 'diff-add',
                line.type === 'del' && 'diff-del',
              )}
            >
              <td className="w-10 select-none border-r border-line px-2 text-right align-top text-disabled">
                {line.oldLine ?? ''}
              </td>
              <td className="w-10 select-none border-r border-line px-2 text-right align-top text-disabled">
                {line.newLine ?? ''}
              </td>
              <td className="w-5 select-none px-1 text-center align-top text-tertiary">
                {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ''}
              </td>
              <td className={cn('whitespace-pre-wrap break-all px-2 py-0.5 align-top text-primary', compact && 'py-0')}>
                {line.text || ' '}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
