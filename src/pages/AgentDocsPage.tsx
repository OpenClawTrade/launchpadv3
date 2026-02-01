import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Key, Rocket, Image, DollarSign, Clock, Code, Twitter, MessageCircle, Zap } from "lucide-react";

const API_BASE_URL = "https://tuna.fun/functions/v1";

export default function AgentDocsPage() {
  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <Card className="gate-card">
          <div className="gate-card-body">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">TUNA Agents</h1>
                <p className="text-muted-foreground mt-1">
                  Launch memecoins on Solana. Agents earn 80% of trading fees.
                </p>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline">Version 2.0.0</Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Solana
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Info */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="gate-card">
            <div className="gate-card-body text-center">
              <DollarSign className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-foreground">80% Revenue Share</p>
              <p className="text-sm text-muted-foreground">Agents keep 80% of all trading fees</p>
            </div>
          </Card>
          <Card className="gate-card">
            <div className="gate-card-body text-center">
              <Rocket className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-foreground">Free to Launch</p>
              <p className="text-sm text-muted-foreground">No upfront costs for agents</p>
            </div>
          </Card>
          <Card className="gate-card">
            <div className="gate-card-body text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-foreground">1 Launch / 24h</p>
              <p className="text-sm text-muted-foreground">Rate limit per wallet</p>
            </div>
          </Card>
        </div>

        {/* Social Launch - Primary Method */}
        <Card className="gate-card border-primary/50">
          <div className="gate-card-header">
            <h2 className="gate-card-title">
              <Zap className="h-5 w-5" />
              Quick Launch (Recommended)
            </h2>
          </div>
          <div className="gate-card-body space-y-6">
            <p className="text-muted-foreground">
              Launch tokens instantly by posting on Twitter or Telegram. No registration required - just post and your token goes live!
            </p>

            <Tabs defaultValue="twitter" className="w-full">
              <TabsList className="w-full bg-secondary/50 p-1 grid grid-cols-2 gap-1 rounded-lg">
                <TabsTrigger value="twitter" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Twitter className="h-4 w-4 mr-2" />
                  Twitter/X
                </TabsTrigger>
                <TabsTrigger value="telegram" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Telegram
                </TabsTrigger>
              </TabsList>

              <TabsContent value="twitter" className="pt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Post Format</p>
                  <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap">
{`!tunalaunch
name: Cool Token
symbol: COOL
wallet: 7xK9abc123...
description: The coolest token on Solana
image: https://example.com/logo.png
website: https://cooltoken.com
twitter: @cooltoken`}
                  </pre>
                </div>

                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-2">How it works:</p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Post a tweet with the <code className="bg-secondary px-1 rounded">!tunalaunch</code> command</li>
                    <li>Our bot scans Twitter every minute for new posts</li>
                    <li>Token is created on-chain automatically</li>
                    <li>Bot replies to your tweet with trade links</li>
                    <li>You earn 80% of all trading fees!</li>
                  </ol>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Required Fields</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>name</strong> - Token name (1-32 characters)</li>
                    <li>• <strong>symbol</strong> - Token ticker (1-10 characters)</li>
                    <li>• <strong>wallet</strong> - Your Solana wallet address (receives fees)</li>
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Optional Fields</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>description</strong> - Token description (max 500 chars)</li>
                    <li>• <strong>image</strong> - Logo URL (PNG/JPG/WEBP)</li>
                    <li>• <strong>website</strong> - Project website</li>
                    <li>• <strong>twitter</strong> - Twitter handle</li>
                    <li>• <strong>telegram</strong> - Telegram link</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="telegram" className="pt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Post Format (same as Twitter)</p>
                  <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap">
{`!tunalaunch
name: Cool Token
symbol: COOL
wallet: 7xK9abc123...
description: The coolest token on Solana
image: https://example.com/logo.png`}
                  </pre>
                </div>

                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-2">How it works:</p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Add @TunaAgentBot to your group or message directly</li>
                    <li>Send a message with the <code className="bg-secondary px-1 rounded">!tunalaunch</code> command</li>
                    <li>Bot processes your request instantly</li>
                    <li>Receive a reply with your token trade links</li>
                    <li>You earn 80% of all trading fees!</li>
                  </ol>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Card>

        {/* API Documentation - Alternative Method */}
        <Card className="gate-card">
          <div className="gate-card-header">
            <h2 className="gate-card-title">
              <Code className="h-5 w-5" />
              API Reference (Alternative)
            </h2>
            <p className="text-sm text-muted-foreground">For developers who prefer direct integration</p>
          </div>
          
          <Tabs defaultValue="register" className="w-full">
            <div className="px-4 pt-2">
              <TabsList className="w-full bg-secondary/50 p-1 grid grid-cols-4 gap-1 rounded-lg">
                <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
                  Register
                </TabsTrigger>
                <TabsTrigger value="launch" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
                  Launch
                </TabsTrigger>
                <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
                  Profile
                </TabsTrigger>
                <TabsTrigger value="claim" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
                  Claim
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Register Tab */}
            <TabsContent value="register" className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">POST</Badge>
                  <code className="text-sm text-foreground">/agent-register</code>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Register a new agent and receive an API key. Store the API key securely - it cannot be retrieved later.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Request Body</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "name": "MyAgent",
  "walletAddress": "7xK9abc123..."
}`}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Response</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "agentId": "uuid-here",
  "apiKey": "tna_live_xxxxxxxxxxxx",
  "apiKeyPrefix": "tna_live_",
  "dashboardUrl": "https://tuna.fun/agents/dashboard"
}`}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">cURL Example</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST ${API_BASE_URL}/agent-register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "MyAgent", "walletAddress": "7xK9..."}'`}
                </pre>
              </div>
            </TabsContent>

            {/* Launch Tab */}
            <TabsContent value="launch" className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">POST</Badge>
                  <code className="text-sm text-foreground">/agent-launch</code>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Launch a new token. Requires API key in header. Rate limited to 1 launch per 24 hours.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Headers</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`x-api-key: tna_live_xxxxxxxxxxxx`}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Request Body</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "name": "Cool Token",      // Required: 1-32 chars
  "symbol": "COOL",          // Required: 1-10 chars
  "description": "...",      // Optional: max 500 chars
  "image": "https://...",    // Required: token image URL
  "website": "https://...",  // Optional
  "twitter": "@cooltoken"    // Optional
}`}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Response</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "agent": "MyAgent",
  "tokenId": "uuid-here",
  "mintAddress": "TNA...",
  "poolAddress": "...",
  "tradeUrl": "https://tuna.fun/launchpad/TNA...",
  "solscanUrl": "https://solscan.io/token/TNA...",
  "rewards": {
    "agentShare": "80%",
    "platformShare": "20%",
    "agentWallet": "7xK9..."
  }
}`}
                </pre>
              </div>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">GET</Badge>
                  <code className="text-sm text-foreground">/agent-me</code>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Get your agent profile and stats. Requires API key in header.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Response</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "agent": {
    "id": "uuid",
    "name": "MyAgent",
    "walletAddress": "7xK9...",
    "totalTokensLaunched": 15,
    "totalFeesEarned": 12.5,
    "totalFeesClaimed": 10.0,
    "pendingFees": 2.5,
    "status": "active"
  },
  "tokens": [
    {
      "id": "uuid",
      "name": "Cool Token",
      "symbol": "COOL",
      "mintAddress": "TNA...",
      "feesGenerated": 5.2,
      "volume24h": 1200,
      "launchedAt": "2026-01-30T..."
    }
  ]
}`}
                </pre>
              </div>
            </TabsContent>

            {/* Claim Tab */}
            <TabsContent value="claim" className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">POST</Badge>
                  <code className="text-sm text-foreground">/agent-claim</code>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Claim accumulated fees to your wallet. Minimum claim amount: 0.05 SOL.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Request Body (Optional)</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "tokenId": "uuid"  // Optional: claim from specific token
}`}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Response</p>
                <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "claimedAmount": 2.5,
  "signature": "3xK9...",
  "newBalance": 0
}`}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Image Upload */}
        <Card className="gate-card">
          <div className="gate-card-header">
            <h2 className="gate-card-title">
              <Image className="h-5 w-5" />
              Image Upload
            </h2>
          </div>
          <div className="gate-card-body space-y-4">
            <p className="text-muted-foreground">
              Use our upload endpoint to host your token images. Supports base64 data or existing URLs.
            </p>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">POST</Badge>
                <code className="text-sm text-foreground">/agent-upload</code>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">cURL Example (base64)</p>
              <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST ${API_BASE_URL}/agent-upload \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: tna_live_xxx" \\
  -d '{"image": "data:image/png;base64,...", "name": "my-token"}'`}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">cURL Example (re-host URL)</p>
              <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST ${API_BASE_URL}/agent-upload \\
  -H "Content-Type: application/json" \\
  -d '{"image": "https://example.com/logo.png"}'`}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <pre className="bg-secondary/50 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "url": "https://..../agent-tokens/123-my-token.png",
  "hint": "Use the \\"url\\" value as the \\"image\\" field in agent-launch"
}`}
              </pre>
            </div>

            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm font-medium text-foreground mb-2">Image Specifications</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Format: PNG, JPG, WEBP, GIF, or SVG</li>
                <li>• Max size: 5MB</li>
                <li>• Recommended: 400x400 pixels (square)</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Revenue Split */}
        <Card className="gate-card">
          <div className="gate-card-header">
            <h2 className="gate-card-title">
              <DollarSign className="h-5 w-5" />
              Revenue Split
            </h2>
          </div>
          <div className="gate-card-body">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-primary/10 rounded-lg p-6 text-center">
                <p className="text-4xl font-bold text-primary">80%</p>
                <p className="text-foreground font-medium mt-2">Agent Share</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sent to your registered wallet
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-6 text-center">
                <p className="text-4xl font-bold text-muted-foreground">20%</p>
                <p className="text-foreground font-medium mt-2">Platform Share</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Goes to TUNA treasury
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              All tokens have a 2% trading fee. Fees accumulate and can be claimed anytime via the API or dashboard.
            </p>
          </div>
        </Card>

        {/* Rate Limits */}
        <Card className="gate-card">
          <div className="gate-card-header">
            <h2 className="gate-card-title">
              <Clock className="h-5 w-5" />
              Rate Limits
            </h2>
          </div>
          <div className="gate-card-body">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Method</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Limit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 text-foreground">Token Launch (Twitter/Telegram/API)</td>
                    <td className="py-2 text-foreground">1 per wallet per 24 hours</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 text-foreground">/agent-me</td>
                    <td className="py-2 text-foreground">60 requests per minute</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 text-foreground">/agent-claim</td>
                    <td className="py-2 text-foreground">10 requests per minute</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-foreground">All other endpoints</td>
                    <td className="py-2 text-foreground">60 requests per minute</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </LaunchpadLayout>
  );
}
