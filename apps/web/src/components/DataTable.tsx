import { ReactNode } from "react";

export interface Column<Row extends object> {
  key: keyof Row;
  label: string;
  render?: (row: Row) => ReactNode;
}

export function DataTable<Row extends object>({
  columns,
  rows,
  emptyLabel = "No records available",
  wide = true
}: {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  emptyLabel?: string;
  /** Force a horizontal-scroll floor for tables that need room for many columns.
   * Set false in a narrow layout context (e.g. a sidebar panel) so the table stays fluid instead.
   * On a phone every table becomes a list of cards (each cell carries its column's name in data-label), so none scrolls sideways. */
  wide?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="table-wrap">
      <table className={wide ? "table-wide" : undefined}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={String(column.key)} data-label={column.label}>
                  {column.render ? column.render(row) : String(row[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
