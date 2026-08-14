---
name: tanstack-table
description: Enterprise TanStack Table v8/v9 headless data table with sorting, filtering, pagination, column pinning, selection, and virtualization. Use when building data tables, grids, or data-intensive UI components.
metadata:
  stack: tanstack-table-8
  scope: data
---

# TanStack Table Enterprise

## Overview

TanStack Table is a headless UI library for building powerful tables and data grids. It provides sorting, filtering, pagination, column pinning, selection, and virtualization.

**When to Use:**
- Building data tables with complex features
- Needing sortable, filterable, paginated tables
- Implementing data grids
- Virtualizing large datasets
- Custom table UI requirements

**When NOT to Use:**
- Simple static tables
- Projects using a complete UI framework with built-in tables
- Non-React projects (use @tanstack/table-core)

## Architecture Patterns

### Project Structure
```
components/
├── tables/
│   ├── data-table.tsx
│   ├── data-table-column-header.tsx
│   ├── data-table-pagination.tsx
│   ├── data-table-toolbar.tsx
│   ├── data-table-faceted-filter.tsx
│   └── index.ts
├── ui/
│   └── table.tsx
└── lib/
    └── utils.ts
```

## Complete Configuration

### Basic Table (v9)

```typescript
import { useTable, tableFeatures, type ColumnDef } from '@tanstack/react-table';

type User = { id: string; name: string; email: string; role: string };

const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
];

function UserTable({ data }: { data: User[] }) {
  const features = tableFeatures({});
  const table = useTable({ features, columns, data });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id}>
                {h.isPlaceholder ? null : (
                  <FlexRender
                    component={h.column.columnDef.header}
                    context={h.getContext()}
                  />
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => (
              <td key={cell.id}>
                <FlexRender
                  component={cell.column.columnDef.cell}
                  context={cell.getContext()}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Advanced Table with Features

```typescript
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type PaginationState,
} from '@tanstack/react-table';

const columnHelper = createColumnHelper<User>();

const columns = [
  columnHelper.accessor('name', {
    header: 'Name',
    cell: (info) => info.getValue(),
    enableSorting: true,
    enableHiding: true,
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    cell: (info) => info.getValue(),
    enableSorting: true,
    enableHiding: true,
  }),
  columnHelper.accessor('role', {
    header: 'Role',
    cell: (info) => info.getValue(),
    enableSorting: true,
    enableHiding: true,
    filterFn: 'equals',
  }),
];

function UserTable({ data }: { data: User[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
  });

  return (
    <div>
      {/* Global Filter */}
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Search..."
      />

      {/* Column Visibility */}
      <div>
        {table.getAllLeafColumns().map((column) => (
          <label key={column.id}>
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={(e) => column.toggleVisibility(e.target.checked)}
            />
            {column.id}
          </label>
        ))}
      </div>

      {/* Table */}
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  style={{ cursor: 'pointer' }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>

      {/* Row Selection */}
      <div>
        {Object.keys(rowSelection).length} of {table.getRowModel().rows.length} selected
      </div>
    </div>
  );
}
```

### Column Definition Patterns

```typescript
// Text column
columnHelper.accessor('name', {
  header: 'Name',
  cell: (info) => info.getValue(),
  enableSorting: true,
  enableHiding: true,
  sortDescFirst: false,
});

// Number column
columnHelper.accessor('amount', {
  header: 'Amount',
  cell: (info) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(info.getValue()),
  enableSorting: true,
  sortingFn: 'basic',
});

// Date column
columnHelper.accessor('createdAt', {
  header: 'Created At',
  cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  enableSorting: true,
  sortingFn: 'datetime',
});

// Boolean column
columnHelper.accessor('isActive', {
  header: 'Active',
  cell: (info) => info.getValue() ? 'Yes' : 'No',
  filterFn: 'equals',
});

// Custom column with actions
columnHelper.display({
  id: 'actions',
  header: 'Actions',
  cell: (info) => (
    <div>
      <button onClick={() => handleEdit(info.row.original)}>Edit</button>
      <button onClick={() => handleDelete(info.row.original)}>Delete</button>
    </div>
  ),
  enableSorting: false,
  enableHiding: false,
});
```

### Virtualization

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTable({ data }: { data: User[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {data[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Security Hardening

### Safe Data Display
```typescript
// Sanitize user input
const sanitize = (value: string) => {
  return value.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
};

// Use in column definition
columnHelper.accessor('name', {
  cell: (info) => sanitize(info.getValue()),
});
```

## Performance Optimization

### Memoization
```typescript
import { useMemo } from 'react';

function UserTable({ data }: { data: User[] }) {
  const columns = useMemo(() => [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('email', { header: 'Email' }),
  ], []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <table>...</table>;
}
```

### Virtualization for Large Datasets
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function LargeDataTable({ data }: { data: User[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div key={virtualRow.id} style={{ height: '50px' }}>
            {data[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Integration Patterns

### package.json Dependencies
```json
{
  "dependencies": {
    "@tanstack/react-table": "^9.0.0",
    "@tanstack/react-virtual": "^3.0.0"
  }
}
```

### CI/CD Pipeline
```yaml
# .github/workflows/build.yml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: npm run typecheck
    - run: npm run build
```

## Anti-Patterns

### ❌ DON'T
- Skip virtualization for large datasets
- Use inline styles: Use Tailwind classes
- Ignore accessibility: Add ARIA attributes
- Skip memoization: Memoize columns and data
- Use deprecated v8 APIs: Use v9 for new projects

### ✅ DO
- Use v9 with `useTable` and `tableFeatures` for new projects
- Use `columnHelper.accessor` for type-safe columns
- Use `FlexRender` for headers and cells
- Use virtualization for large datasets
- Test with screen readers
- Monitor performance with React DevTools

## Troubleshooting

### Common Issues

**Type Errors**
```typescript
// Use columnHelper for type safety
const columnHelper = createColumnHelper<User>();

// Or use generic types
const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
];
```

**Performance Issues**
```typescript
// Memoize columns
const columns = useMemo(() => [...], []);

// Use virtualization
const virtualizer = useVirtualizer({
  count: data.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});
```

**Sorting Not Working**
```typescript
// Ensure getSortedRowModel is included
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

## Observability

### Table Metrics
- Render time
- Row count
- Filter operations
- Sort operations

## Production Checklist

- [ ] Columns defined with type safety
- [ ] Sorting configured
- [ ] Filtering configured
- [ ] Pagination configured
- [ ] Virtualization for large datasets
- [ ] Accessibility tested
- [ ] Performance optimized
- [ ] Documentation updated

## CI/CD Integration

### GitHub Actions
```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: npm run typecheck
    - run: npm run build
    - run: npm test
```

## Team Conventions

- **Column Definitions**: Use `columnHelper.accessor` for type safety
- **Virtualization**: Use for datasets > 100 rows
- **Sorting**: Enable by default for all columns
- **Filtering**: Use global filter for simple searches
- **Pagination**: Default 10 rows per page
- **Documentation**: Keep table docs updated
