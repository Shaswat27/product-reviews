import * as React from "react"
import { type VariantProps, cva } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = React.Fragment

const ToastViewport = React.forwardRef<
  HTMLOListElement,
  React.HTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = "ToastViewport"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<"li">,
  React.ComponentPropsWithoutRef<"li"> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <li
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = "Toast"

const ToastAction = React.forwardRef<
  React.ElementRef<"button">,
  React.ComponentPropsWithoutRef<"button">
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"

const ToastClose = React.forwardRef<
  React.ElementRef<"button">,
  React.ComponentPropsWithoutRef<"button">
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </button>
))
ToastClose.displayName = "ToastClose"

const ToastTitle = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

// Inlined 'use-toast' hook logic
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const reducer = (
  state: ToasterToast[],
  action: { type: 'ADD_TOAST'; toast: ToasterToast } | { type: 'REMOVE_TOAST'; toastId: string }
): ToasterToast[] => {
  switch (action.type) {
    case 'ADD_TOAST':
      return [action.toast, ...state]
    case 'REMOVE_TOAST':
      return state.filter(t => t.id !== action.toastId)
    default:
      return state
  }
}

const listeners: Array<(toasts: ToasterToast[]) => void> = []
let memoryState: ToasterToast[] = []

function dispatch(action: { type: 'ADD_TOAST'; toast: ToasterToast } | { type: 'REMOVE_TOAST'; toastId: string }) {
  memoryState = reducer(memoryState, action)
  listeners.forEach(listener => {
    listener(memoryState)
  })
}

let count = 0
function genId() {
  count = (count + 1) % 1_000_000
  return count.toString()
}

type ToastOpts = Omit<ToasterToast, 'id'>

function toast(opts: ToastOpts) {
  const id = genId()
  const newToast = { ...opts, id }
  dispatch({ type: 'ADD_TOAST', toast: newToast })
  return {
    id: id,
    dismiss: () => dispatch({ type: 'REMOVE_TOAST', toastId: id }),
  }
}

function useToast() {
  const [state, setState] = React.useState<ToasterToast[]>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    toasts: state,
    toast,
  }
}

export {
  useToast,
  toast,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
export type {
  ToastProps,
  ToastActionElement,
}