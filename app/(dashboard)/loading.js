export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-8 w-1/3 bg-gray-200 rounded-lg"></div>
        <div className="h-8 w-24 bg-gray-200 rounded-lg"></div>
      </div>
      
      {/* Content Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[1,2,3,4].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl border border-gray-200"></div>
         ))}
      </div>
      
      <div className="h-96 bg-gray-100 rounded-2xl border border-gray-200"></div>
    </div>
  );
}