// Мʼяка поява вмісту під час переходу між сторінками (DESIGN.md, розділ 7 «Рух»): лише прозорість, 150 мс, без зсуву.
// template, а не layout: Next.js монтує його заново на кожну навігацію. Обгортка тримає flex-колонку body.
export default function Template({ children }: LayoutProps<"/">) {
  return <div className="flex flex-1 flex-col animate-in fade-in-0 duration-150">{children}</div>;
}
