export default function DeliveriesLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-40 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-56 bg-gray-200 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-gray-200 rounded-lg" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg" />
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              {['Tracking', 'Status', 'Pickup', 'Delivery', 'Driver', 'Price', 'Actions'].map((h) => (
                <th key={h} className="px-6 py-3">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i}>
                <td className="px-6 py-4"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
                <td className="px-6 py-4"><div className="h-6 w-20 bg-gray-200 rounded-full" /></td>
                <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                <td className="px-6 py-4"><div className="h-8 w-8 bg-gray-200 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
