interface Props { size?: "sm"|"md"|"lg"; text?: string }
export function LoadingSpinner({ size="md", text }: Props) {
  const sz = { sm:"w-4 h-4 border-2", md:"w-8 h-8 border-3", lg:"w-12 h-12 border-4" }[size]
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className={`${sz} border-blue-600 border-t-transparent rounded-full animate-spin`} />
      {text && <p className="text-sm text-slate-500">{text}</p>}
    </div>
  )
}
