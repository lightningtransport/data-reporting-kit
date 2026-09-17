import { DashboardChrome } from "@/components/dashboard-shell"

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardChrome>{children}</DashboardChrome>
}
