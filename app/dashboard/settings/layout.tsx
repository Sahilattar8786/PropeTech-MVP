import { PageHeader } from "@/components/shared/page-header";
import { SettingsTabs } from "@/features/settings/settings-tabs";

export default function SettingsLayout({ children }: LayoutProps<"/dashboard/settings">) {
  return (
    <>
      <PageHeader title="Settings" description="Your broker profile, website and integrations." className="mb-4" />
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
