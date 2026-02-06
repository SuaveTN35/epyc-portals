export default function ClientDashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
              <div className="ml-4">
                <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                <div className="h-6 w-16 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* List skeleton */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <div className="h-6 w-40 bg-gray-200 rounded" />
        </div>
        <div className="divide-y">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center px-6 py-4">
              <div className="w-5 h-5 bg-gray-200 rounded-full" />
              <div className="ml-4 flex-1">
                <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-48 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-24 bg-gray-200 rounded" />
              </div>
              <div className="text-right">
                <div className="h-4 w-16 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-12 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
