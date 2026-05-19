'use client'

type ConfirmSubmitButtonProps = {
  message: string
  className: string
  children: React.ReactNode
}

export function ConfirmSubmitButton({
  message,
  className,
  children,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}
