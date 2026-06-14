import { ModulePlaceholder } from "@/components/app/module-placeholder";

export default function SubscriptionPage() {
  return (
    <ModulePlaceholder
      eyebrow="Subscription"
      title="Plan dan entitlement organization"
      description="Halaman billing hanya terlihat untuk owner pada wave 1, sehingga shell permission-aware bisa langsung diuji dari sekarang."
      primaryCtaLabel="Kembali ke dashboard"
    />
  );
}
