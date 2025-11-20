export default function Skeleton({ className = "", variant = "default" }) {
  const variants = {
    default: "h-4 bg-slate-200 rounded animate-pulse",
    title: "h-8 bg-slate-200 rounded animate-pulse",
    text: "h-3 bg-slate-200 rounded animate-pulse",
    button: "h-10 bg-slate-200 rounded-lg animate-pulse",
    card: "h-32 bg-slate-200 rounded-xl animate-pulse",
    avatar: "h-12 w-12 bg-slate-200 rounded-full animate-pulse",
    input: "h-10 bg-slate-200 rounded-lg animate-pulse",
  };

  return <div className={`${variants[variant]} ${className}`}></div>;
}

export function TableSkeleton({ rows = 5, columns = 6 }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-6 py-4">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="button" className="w-10 h-10" />
          <div className="space-y-2">
            <Skeleton variant="title" className="w-48" />
            <Skeleton variant="text" className="w-64" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="button" className="w-32" />
          <Skeleton variant="button" className="w-32" />
        </div>
      </div>

      {/* Filters Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton variant="input" />
          <Skeleton variant="input" />
          <Skeleton variant="input" />
          <Skeleton variant="input" />
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl px-6 py-4 space-y-2">
            <Skeleton variant="text" className="w-24" />
            <Skeleton variant="title" className="w-32" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <TableSkeleton />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton variant="button" className="w-10 h-10" />
        <div className="space-y-2">
          <Skeleton variant="title" className="w-48" />
          <Skeleton variant="text" className="w-64" />
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="space-y-6">
          <Skeleton variant="title" className="w-40 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton variant="text" className="w-24" />
                <Skeleton variant="input" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton variant="text" className="w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Skeleton variant="button" className="w-24" />
        <Skeleton variant="button" className="w-32" />
      </div>
    </div>
  );
}
