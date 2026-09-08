type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-normal text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="flex w-fit items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
        <span className="size-2 rounded-full bg-[#10B981]" />
        <span className="text-sm font-semibold text-emerald-700">Activo / En guardia</span>
      </div>
    </div>
  );
}
