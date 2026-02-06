export default function DriverDashboardLoading() {
  return (
    <div className="animate-pulse p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
        </div>
        <div className="h-10 w-10 bg-gray-200 rounded-full" />
      </div>

      {/* Status card skeleton */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
          <div className="h-12 w-24 bg-gray-200 rounded-full" />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="h-6 w-12 bg-gray-200 rounded mx-auto mb-2" />
            <div className="h-3 w-16 bg-gray-200 rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Jobs list skeleton */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="h-5 w-28 bg-gray-200 rounded" />
        </div>
        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="h-5 w-24 bg-gray-200 rounded" />
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-200 rounded-full mr-2" />
                  <div className="h-4 w-40 bg-gray-200 rounded" />
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-200 rounded-full mr-2" />
                  <div className="h-4 w-36 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-6 w-16 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
