import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral' | 'blue'
  className?: string
  valueClassName?: string
}

export function KPICard({ title, value, subtitle, icon, trend, className, valueClassName }: KPICardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
        {icon && (
          <div className={cn(
            'text-gray-400',
            trend === 'up'   && 'text-green-500',
            trend === 'down' && 'text-red-500',
            trend === 'blue' && 'text-blue-500',
          )}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className={cn(
          'text-2xl font-bold text-gray-900 leading-none',
          trend === 'up'   && 'text-green-600',
          trend === 'down' && 'text-red-600',
          trend === 'blue' && 'text-blue-600',
          valueClassName
        )}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
