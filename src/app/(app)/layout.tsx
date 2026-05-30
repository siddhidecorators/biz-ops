import { BottomNav } from './_components/bottom-nav';
import { ToastFromQuery } from './_components/toast-from-query';
import { NetworkStatusBadge } from './_components/network-status-badge';

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <BottomNav />
      <ToastFromQuery />
      <NetworkStatusBadge />
    </>
  );
}
