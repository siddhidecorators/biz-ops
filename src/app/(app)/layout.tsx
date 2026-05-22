import { BottomNav } from './_components/bottom-nav';
import { ToastFromQuery } from './_components/toast-from-query';

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
      <ToastFromQuery />
    </>
  );
}
