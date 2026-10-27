export default function Logo({ light = false, compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-duoc-yellow font-black text-duoc-blue">IN</div>
      {!compact && (
        <div className="leading-tight">
          <p className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-duoc-blue'}`}>INSIDER</p>
          <p className={`text-[10px] font-medium uppercase tracking-[0.18em] ${light ? 'text-duoc-yellow' : 'text-slate-500'}`}>Duoc UC · Soluciones</p>
        </div>
      )}
    </div>
  )
}
