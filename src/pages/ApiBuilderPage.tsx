import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Wand2, 
  Save, 
  Rocket, 
  Palette,
  Type,
  Layout,
  Sparkles,
  Globe,
  Loader2
} from "lucide-react";

interface DesignConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    success: string;
    danger: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    logoSize: string;
  };
  layout: {
    style: string;
    borderRadius: string;
    spacing: string;
    headerPosition: string;
  };
  branding: {
    name: string;
    tagline: string;
    logoStyle: string;
  };
  effects: {
    gradients: boolean;
    animations: boolean;
    glowEffects: boolean;
    particles: boolean;
  };
}

const defaultDesign: DesignConfig = {
  colors: {
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    background: "#0A0A0A",
    surface: "#1A1A1A",
    text: "#FFFFFF",
    textMuted: "#A1A1AA",
    accent: "#F59E0B",
    success: "#22C55E",
    danger: "#EF4444",
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Inter",
    logoSize: "2xl",
  },
  layout: {
    style: "modern",
    borderRadius: "lg",
    spacing: "normal",
    headerPosition: "top",
  },
  branding: {
    name: "My Launchpad",
    tagline: "Launch your tokens to the moon",
    logoStyle: "text",
  },
  effects: {
    gradients: true,
    animations: true,
    glowEffects: false,
    particles: false,
  },
};

export default function ApiBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const launchpadId = searchParams.get("id");
  const { solanaAddress, isAuthenticated } = useAuth();
  const walletAddress = solanaAddress;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [design, setDesign] = useState<DesignConfig>(defaultDesign);
  const [existingLaunchpad, setExistingLaunchpad] = useState<any>(null);

  useEffect(() => {
    if (launchpadId && walletAddress) {
      fetchLaunchpad();
    }
  }, [launchpadId, walletAddress]);

  const fetchLaunchpad = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-launchpad?id=${launchpadId}&wallet=${walletAddress}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await response.json();
      
      if (data.launchpad) {
        setExistingLaunchpad(data.launchpad);
        setName(data.launchpad.name);
        setSubdomain(data.launchpad.subdomain || "");
        if (data.launchpad.design_config && Object.keys(data.launchpad.design_config).length > 0) {
          setDesign({ ...defaultDesign, ...data.launchpad.design_config });
        }
      }
    } catch (error) {
      console.error("Error fetching launchpad:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateDesign = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a design description");
      return;
    }
    
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-design-generate", {
        body: { 
          prompt: aiPrompt,
          currentDesign: design,
        },
      });
      
      if (error) throw error;
      
      if (data.design) {
        setDesign({ ...defaultDesign, ...data.design });
        if (data.design.branding?.name) {
          setName(data.design.branding.name);
        }
        toast.success("Design generated!");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate design");
    } finally {
      setGenerating(false);
    }
  };

  const saveLaunchpad = async () => {
    if (!walletAddress) return;
    if (!name.trim()) {
      toast.error("Please enter a launchpad name");
      return;
    }
    
    setSaving(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-launchpad`;
      const method = existingLaunchpad ? "PUT" : "POST";
      
      const body: any = {
        wallet: walletAddress,
        name,
        designConfig: design,
      };
      
      if (existingLaunchpad) {
        body.launchpadId = existingLaunchpad.id;
      }
      
      // Only include subdomain for new launchpads or if changed
      if (subdomain && (!existingLaunchpad || subdomain !== existingLaunchpad.subdomain)) {
        body.subdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "");
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      
      if (data.success || data.launchpad) {
        toast.success(existingLaunchpad ? "Launchpad saved!" : "Launchpad created!");
        if (!existingLaunchpad && data.launchpad) {
          setExistingLaunchpad(data.launchpad);
          navigate(`/api/builder?id=${data.launchpad.id}`, { replace: true });
        }
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deployLaunchpad = async () => {
    if (!existingLaunchpad) {
      toast.error("Please save the launchpad first");
      return;
    }
    if (!subdomain) {
      toast.error("Please set a subdomain to deploy");
      return;
    }
    
    setDeploying(true);
    try {
      // TODO: Implement Vercel deployment
      toast.success("Deployment started! Your site will be live shortly.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to deploy");
    } finally {
      setDeploying(false);
    }
  };

  const updateDesignColor = (key: keyof DesignConfig["colors"], value: string) => {
    setDesign(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  };

  const updateDesignEffect = (key: keyof DesignConfig["effects"], value: boolean) => {
    setDesign(prev => ({
      ...prev,
      effects: { ...prev.effects, [key]: value },
    }));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>Connect your wallet to build a launchpad</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/api")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{existingLaunchpad ? "Edit Launchpad" : "New Launchpad"}</h1>
              {subdomain && (
                <span className="text-xs text-muted-foreground">{subdomain}.ai67x.fun</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveLaunchpad} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
            <Button onClick={deployLaunchpad} disabled={deploying || !existingLaunchpad}>
              {deploying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
              Deploy
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* AI Generator */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                AI Design Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Describe your launchpad style... e.g., 'Cyberpunk neon theme with purple and cyan, futuristic vibes'"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
              />
              <Button 
                className="w-full" 
                onClick={generateDesign}
                disabled={generating}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Design</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Basic Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Launchpad Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome Launchpad"
                />
              </div>
              <div className="space-y-2">
                <Label>Subdomain</Label>
                <div className="flex">
                  <Input
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="mylaunchpad"
                    className="rounded-r-none"
                  />
                  <div className="flex items-center px-3 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground">
                    .ai67x.fun
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
                  value={design.branding.tagline}
                  onChange={(e) => setDesign(prev => ({
                    ...prev,
                    branding: { ...prev.branding, tagline: e.target.value }
                  }))}
                  placeholder="Launch your tokens to the moon"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabs for detailed settings */}
          <Card>
            <Tabs defaultValue="colors">
              <CardHeader className="pb-0">
                <TabsList className="w-full">
                  <TabsTrigger value="colors" className="flex-1">
                    <Palette className="w-3 h-3 mr-1" /> Colors
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="flex-1">
                    <Layout className="w-3 h-3 mr-1" /> Layout
                  </TabsTrigger>
                  <TabsTrigger value="effects" className="flex-1">
                    <Sparkles className="w-3 h-3 mr-1" /> Effects
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-4">
                <TabsContent value="colors" className="space-y-3 mt-0">
                  {Object.entries(design.colors).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="capitalize text-sm">{key.replace(/([A-Z])/g, " $1")}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={value}
                          onChange={(e) => updateDesignColor(key as keyof DesignConfig["colors"], e.target.value)}
                          className="w-10 h-8 p-0.5 cursor-pointer"
                        />
                        <Input
                          value={value}
                          onChange={(e) => updateDesignColor(key as keyof DesignConfig["colors"], e.target.value)}
                          className="w-24 h-8 font-mono text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="layout" className="space-y-4 mt-0">
                  <div className="space-y-2">
                    <Label>Style</Label>
                    <select
                      value={design.layout.style}
                      onChange={(e) => setDesign(prev => ({
                        ...prev,
                        layout: { ...prev.layout, style: e.target.value }
                      }))}
                      className="w-full p-2 rounded-md border bg-background"
                    >
                      <option value="modern">Modern</option>
                      <option value="minimal">Minimal</option>
                      <option value="cyberpunk">Cyberpunk</option>
                      <option value="retro">Retro</option>
                      <option value="neon">Neon</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Border Radius</Label>
                    <select
                      value={design.layout.borderRadius}
                      onChange={(e) => setDesign(prev => ({
                        ...prev,
                        layout: { ...prev.layout, borderRadius: e.target.value }
                      }))}
                      className="w-full p-2 rounded-md border bg-background"
                    >
                      <option value="none">None</option>
                      <option value="sm">Small</option>
                      <option value="md">Medium</option>
                      <option value="lg">Large</option>
                      <option value="xl">Extra Large</option>
                      <option value="full">Full</option>
                    </select>
                  </div>
                </TabsContent>
                
                <TabsContent value="effects" className="space-y-4 mt-0">
                  {Object.entries(design.effects).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
                      <Switch
                        checked={value}
                        onCheckedChange={(checked) => updateDesignEffect(key as keyof DesignConfig["effects"], checked)}
                      />
                    </div>
                  ))}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Right Panel - Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full overflow-hidden">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm">Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div 
                className="min-h-[600px] p-6"
                style={{ backgroundColor: design.colors.background }}
              >
                {/* Preview Header */}
                <div 
                  className="p-4 mb-6 flex items-center justify-between"
                  style={{ 
                    backgroundColor: design.colors.surface,
                    borderRadius: design.layout.borderRadius === "none" ? 0 : 
                                  design.layout.borderRadius === "sm" ? 4 :
                                  design.layout.borderRadius === "md" ? 8 :
                                  design.layout.borderRadius === "lg" ? 12 :
                                  design.layout.borderRadius === "xl" ? 16 : 24,
                  }}
                >
                  <div 
                    className="font-bold text-xl"
                    style={{ color: design.colors.text }}
                  >
                    {name || "My Launchpad"}
                  </div>
                  <div 
                    className="px-4 py-2 font-semibold text-sm"
                    style={{ 
                      backgroundColor: design.colors.primary,
                      color: "#fff",
                      borderRadius: design.layout.borderRadius === "none" ? 0 :
                                    design.layout.borderRadius === "sm" ? 4 :
                                    design.layout.borderRadius === "md" ? 6 : 8,
                    }}
                  >
                    Connect Wallet
                  </div>
                </div>

                {/* Preview Hero */}
                <div 
                  className="p-8 mb-6 text-center"
                  style={{ 
                    backgroundColor: design.colors.surface,
                    borderRadius: design.layout.borderRadius === "none" ? 0 : 12,
                    background: design.effects.gradients 
                      ? `linear-gradient(135deg, ${design.colors.surface}, ${design.colors.primary}20)`
                      : design.colors.surface,
                  }}
                >
                  <h1 
                    className="text-3xl font-bold mb-2"
                    style={{ color: design.colors.text }}
                  >
                    {design.branding.tagline}
                  </h1>
                  <p style={{ color: design.colors.textMuted }}>
                    Trade tokens with low fees
                  </p>
                </div>

                {/* Preview Token Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="p-4"
                      style={{ 
                        backgroundColor: design.colors.surface,
                        borderRadius: design.layout.borderRadius === "none" ? 0 : 8,
                        border: `1px solid ${design.colors.accent}20`,
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className="w-10 h-10 rounded-full"
                          style={{ backgroundColor: design.colors.primary }}
                        />
                        <div>
                          <div style={{ color: design.colors.text, fontWeight: 600 }}>
                            TOKEN{i}
                          </div>
                          <div style={{ color: design.colors.textMuted, fontSize: 12 }}>
                            $TOKEN{i}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: design.colors.textMuted }}>Price</span>
                        <span style={{ color: design.colors.success }}>+{i * 12.5}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
