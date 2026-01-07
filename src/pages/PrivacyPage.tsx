import { MainLayout } from "@/components/layout";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Privacy Policy</h1>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <section>
          <h2 className="text-2xl font-bold mb-4">Privacy Policy</h2>
          <p className="text-muted-foreground mb-4">Last updated: January 2025</p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">1. Information We Collect</h3>
          <p className="text-muted-foreground">
            We collect information you provide directly to us, such as when you create an account, post content, or communicate with other users. This includes:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Account information (email, wallet address, username)</li>
            <li>Profile information (display name, bio, avatar)</li>
            <li>Content you create (posts, replies, messages)</li>
            <li>Usage data and interactions</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">2. How We Use Your Information</h3>
          <p className="text-muted-foreground">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Personalize your experience and content recommendations</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">3. Information Sharing</h3>
          <p className="text-muted-foreground">
            We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>With your consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and safety</li>
            <li>In connection with a business transfer</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">4. Data Security</h3>
          <p className="text-muted-foreground">
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">5. Your Rights</h3>
          <p className="text-muted-foreground">
            You have the right to access, update, or delete your personal information at any time through your account settings. You may also contact us to exercise these rights.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">6. Contact</h3>
          <p className="text-muted-foreground">
            If you have any questions about this Privacy Policy, please contact us through the Help & Support section.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
