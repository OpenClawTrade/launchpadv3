import { MainLayout } from "@/components/layout";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Terms of Service</h1>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <section>
          <h2 className="text-2xl font-bold mb-4">Terms of Service</h2>
          <p className="text-muted-foreground mb-4">Last updated: January 2025</p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">1. Acceptance of Terms</h3>
          <p className="text-muted-foreground">
            By accessing or using TRENCHES, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">2. Use License</h3>
          <p className="text-muted-foreground">
            Permission is granted to temporarily use TRENCHES for personal, non-commercial purposes. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Modify or copy the materials</li>
            <li>Use the materials for any commercial purpose</li>
            <li>Attempt to decompile or reverse engineer any software</li>
            <li>Remove any copyright or other proprietary notations</li>
            <li>Transfer the materials to another person</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">3. User Content</h3>
          <p className="text-muted-foreground">
            You retain ownership of any content you post on TRENCHES. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and distribute your content in connection with the service.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">4. Prohibited Activities</h3>
          <p className="text-muted-foreground">
            You agree not to engage in any of the following prohibited activities:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Posting harmful, threatening, or illegal content</li>
            <li>Impersonating others or providing false information</li>
            <li>Spamming or sending unsolicited messages</li>
            <li>Attempting to bypass security measures</li>
            <li>Harassing or bullying other users</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">5. Disclaimer</h3>
          <p className="text-muted-foreground">
            The materials on TRENCHES are provided on an 'as is' basis. TRENCHES makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">6. Contact</h3>
          <p className="text-muted-foreground">
            If you have any questions about these Terms of Service, please contact us through the Help & Support section.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
