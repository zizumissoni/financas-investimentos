import {
  ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose
} from '@/components/ui/toast'
import { useToastState } from '@/hooks/useToast'

export function Toaster() {
  const toasts = useToastState()
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant }) => (
        <Toast key={id} variant={variant as 'default' | 'destructive' | 'success' | undefined}>
          <div className="grid gap-1">
            <ToastTitle>{title}</ToastTitle>
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
