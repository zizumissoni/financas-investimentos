import { useYear } from '@/contexts/YearContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCurrentYear } from '@/lib/utils'

export function TopBar() {
  const { year, setYear } = useYear()
  const currentYear = getCurrentYear()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-4 shrink-0">
      {/* Year selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setYear(year - 1)}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700 w-12 text-center">{year}</span>
        <button
          onClick={() => setYear(year + 1)}
          disabled={year >= currentYear + 2}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </header>
  )
}
