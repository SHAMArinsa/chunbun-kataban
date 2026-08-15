export default function Spinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
    </div>
  )
}
