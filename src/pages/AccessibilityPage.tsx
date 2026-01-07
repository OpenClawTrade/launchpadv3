import { MainLayout } from "@/components/layout";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function AccessibilityPage() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Accessibility</h1>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <section>
          <h2 className="text-2xl font-bold mb-4">Accessibility Statement</h2>
          <p className="text-muted-foreground mb-4">Last updated: January 2025</p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Our Commitment</h3>
          <p className="text-muted-foreground">
            TRENCHES is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Accessibility Features</h3>
          <p className="text-muted-foreground">
            We have implemented the following features to make our platform more accessible:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Keyboard navigation support throughout the application</li>
            <li>Screen reader compatibility with semantic HTML</li>
            <li>High contrast mode and dark theme support</li>
            <li>Clear and consistent navigation structure</li>
            <li>Alt text for images and media content</li>
            <li>Resizable text without loss of functionality</li>
            <li>Focus indicators for interactive elements</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Standards</h3>
          <p className="text-muted-foreground">
            We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA. These guidelines explain how to make web content more accessible for people with disabilities.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Known Limitations</h3>
          <p className="text-muted-foreground">
            While we strive to ensure accessibility, there may be some limitations. We are actively working to improve these areas:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Some third-party content may not be fully accessible</li>
            <li>Older content may not meet current accessibility standards</li>
            <li>Some complex interactive features may have limited accessibility</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Feedback</h3>
          <p className="text-muted-foreground">
            We welcome your feedback on the accessibility of TRENCHES. If you encounter any accessibility barriers or have suggestions for improvement, please contact us through the Help & Support section.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
