import React, { useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Card,
  Badge,
  Button,
} from '@/components/ui';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Inbox,
} from 'lucide-react';

export interface DataGridColumn<T> {
  key: string;
  header: React.ReactNode;
  align?: 'right' | 'center' | 'left';
  width?: string;
  className?: string;
  render: (row: T, index: number, globalIndex: number) => React.ReactNode;
}

export interface DataGridProps<T> {
  data: T[];
  columns: DataGridColumn<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  loading?: boolean;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  
  // Header / Stats Bar
  title?: React.ReactNode;
  badgeText?: React.ReactNode;
  headerRight?: React.ReactNode;
  headerSubtitle?: React.ReactNode;

  // Pagination Settings
  pagination?: boolean;
  currentPage?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  totalItemsCount?: number;

  className?: string;
}

export function DataGrid<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  loadingMessage = 'جاري تحميل البيانات...',
  emptyTitle = 'لا توجد بيانات معروضة',
  emptyDescription = 'لم يتم العثور على أي عناصر مطابقة للفلاتر الحالية.',
  emptyAction,
  title,
  badgeText,
  headerRight,
  headerSubtitle,
  pagination = true,
  currentPage = 1,
  pageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  onPageChange,
  onPageSizeChange,
  totalItemsCount,
  className = '',
}: DataGridProps<T>) {
  // If parent handles pagination (server-side), total is totalItemsCount; else client-side data.length
  const totalItems = totalItemsCount !== undefined ? totalItemsCount : data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // If client-side pagination (totalItemsCount is not provided), slice the data:
  const paginatedData = useMemo(() => {
    if (!pagination || totalItemsCount !== undefined) {
      return data;
    }
    const start = (safeCurrentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, pagination, totalItemsCount, safeCurrentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
  };

  const startRecord = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <Card className={`shadow-xs border border-border overflow-hidden ${className}`} dir="rtl">
      {/* 1. Header Bar if provided */}
      {(title || badgeText || headerRight || headerSubtitle) && (
        <div className="p-3.5 bg-muted/20 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-right">
          <div className="flex flex-wrap items-center gap-2">
            {title && <span className="text-xs font-bold text-foreground">{title}</span>}
            {badgeText && (
              <Badge variant="secondary" className="text-[11px] font-mono">
                {badgeText}
              </Badge>
            )}
            {headerSubtitle && (
              <span className="text-[11px] text-muted-foreground mr-2">
                {headerSubtitle}
              </span>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-2 shrink-0">{headerRight}</div>}
        </div>
      )}

      {/* 2. Table Area */}
      {loading ? (
        <div className="p-16 text-center text-xs text-muted-foreground font-semibold flex flex-col items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <span>{loadingMessage}</span>
        </div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground mx-auto flex items-center justify-center">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">{emptyTitle}</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{emptyDescription}</p>
          </div>
          {emptyAction && <div className="pt-2">{emptyAction}</div>}
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <Table className="w-full text-right">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                {columns.map((col) => {
                  const alignClass =
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'left'
                      ? 'text-left'
                      : 'text-right';
                  return (
                    <TableHead
                      key={col.key}
                      style={{ width: col.width }}
                      className={`text-xs font-bold text-foreground py-2.5 ${alignClass} ${col.className || ''}`}
                    >
                      {col.header}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, idx) => {
                const globalIndex = (safeCurrentPage - 1) * pageSize + idx + 1;
                const rowKey = keyExtractor(row, idx);
                return (
                  <TableRow
                    key={rowKey}
                    className="hover:bg-muted/10 border-b border-border/50 text-xs transition-colors"
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'left'
                          ? 'text-left'
                          : 'text-right';
                      return (
                        <TableCell
                          key={`${rowKey}-${col.key}`}
                          className={`py-2.5 ${alignClass} ${col.className || ''}`}
                        >
                          {col.render(row, idx, globalIndex)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 3. Footer Pagination Bar - Pure RTL Layout */}
      {pagination && !loading && data.length > 0 && (
        <div className="p-3 bg-muted/15 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none">
          {/* RTL Right side: Records range & Page size picker */}
          <div className="flex items-center gap-3 text-muted-foreground text-[11px] order-2 sm:order-1">
            <span>
              عرض <strong className="text-foreground font-mono">{startRecord}</strong> -{' '}
              <strong className="text-foreground font-mono">{endRecord}</strong> من إجمالي{' '}
              <strong className="text-foreground font-mono">{totalItems}</strong> سجل
            </span>

            <span className="text-border">|</span>

            <div className="flex items-center gap-1.5">
              <span>لكل صفحة:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-7 rounded-md border border-input bg-background text-foreground px-2 text-[11px] font-mono focus:border-primary outline-none"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* RTL Left side: Page navigation */}
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <span className="text-[11px] text-muted-foreground font-mono ml-2">
              صفحة <strong className="text-foreground font-bold">{safeCurrentPage}</strong> من{' '}
              <strong className="text-foreground font-bold">{totalPages}</strong>
            </span>

            {/* In RTL: First page & Previous page buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={safeCurrentPage <= 1}
              className="h-7 w-7 p-0 rounded-md"
              title="الصفحة الأولى"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage <= 1}
              className="h-7 w-7 p-0 rounded-md"
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1 mx-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 5) return true;
                  if (p === 1 || p === totalPages) return true;
                  return Math.abs(p - safeCurrentPage) <= 1;
                })
                .map((p, i, arr) => {
                  const prev = arr[i - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && (
                        <span className="px-1 text-muted-foreground font-mono text-[10px]">...</span>
                      )}
                      <Button
                        variant={p === safeCurrentPage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(p)}
                        className={`h-7 min-w-7 px-1.5 text-[11px] font-mono font-bold rounded-md ${
                          p === safeCurrentPage ? 'shadow-xs' : ''
                        }`}
                      >
                        {p}
                      </Button>
                    </React.Fragment>
                  );
                })}
            </div>

            {/* In RTL: Next page & Last page buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage >= totalPages}
              className="h-7 w-7 p-0 rounded-md"
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="h-7 w-7 p-0 rounded-md"
              title="الصفحة الأخيرة"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
