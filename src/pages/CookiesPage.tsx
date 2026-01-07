import { MainLayout } from "@/components/layout";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CookiesPage() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Cookie Policy</h1>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <section>
          <h2 className="text-2xl font-bold mb-4">Cookie Policy</h2>
          <p className="text-muted-foreground mb-4">Last updated: January 2025</p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">1. What Are Cookies</h3>
          <p className="text-muted-foreground">
            Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">2. How We Use Cookies</h3>
          <p className="text-muted-foreground">
            TRENCHES uses cookies for the following purposes:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li><strong>Essential cookies:</strong> Required for the website to function properly</li>
            <li><strong>Authentication cookies:</strong> To keep you signed in</li>
            <li><strong>Preference cookies:</strong> To remember your settings and preferences</li>
            <li><strong>Analytics cookies:</strong> To understand how you use our service</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">3. Types of Cookies We Use</h3>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border">
              <h4 className="font-medium">Session Cookies</h4>
              <p className="text-sm text-muted-foreground">Temporary cookies that are deleted when you close your browser.</p>
            </div>
            <div className="p-4 rounded-lg border border-border">
              <h4 className="font-medium">Persistent Cookies</h4>
              <p className="text-sm text-muted-foreground">Cookies that remain on your device for a set period or until you delete them.</p>
            </div>
            <div className="p-4 rounded-lg border border-border">
              <h4 className="font-medium">Local Storage</h4>
              <p className="text-sm text-muted-foreground">Used to store authentication tokens and user preferences.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">4. Managing Cookies</h3>
          <p className="text-muted-foreground">
            You can control and manage cookies through your browser settings. Please note that removing or blocking cookies may impact your user experience and some features may not function properly.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">5. Contact</h3>
          <p className="text-muted-foreground">
            If you have any questions about our use of cookies, please contact us through the Help & Support section.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
