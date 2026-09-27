import React from 'react';
import Button from './Button';

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  page?: number;
  total?: number;
  limit?: number;
  onPageChange?: (newPage: number) => void;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyState,
  page,
  total,
  limit,
  onPageChange,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left pb-4 text-gray-400 font-medium ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="animate-pulse">
                {columns.map((col) => (
                  <td key={col.key} className="py-4">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400 font-semibold">
              {columns.map((col) => (
                <th key={col.key} className={`pb-3.5 pr-4 ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-normal">
            {data.map((item, idx) => (
              <tr
                key={keyExtractor(item, idx)}
                className="hover:bg-white/[0.03] transition-colors group"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`py-4 pr-4 ${col.className ?? ''}`}>
                    {col.render
                      ? col.render(item, idx)
                      : (item as any)[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && total !== undefined && limit && total > limit && onPageChange && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 text-xs text-gray-400">
          <p>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} items
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              ← Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page * limit >= total}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
