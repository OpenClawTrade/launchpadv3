import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Check, Code, Rocket, RefreshCw, Webhook, CreditCard, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BASE_URL = "https://ptwytypavumcrbofspno.supabase.co/functions/v1";

export default function ApiDocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [testApiKey, setTestApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, language = "bash", id }: { code: string; language?: string; id: string }) => (
    <div className="relative group">
      <pre className="bg-black/80 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );

  const testEndpoint = async () => {
    if (!testApiKey) {
      toast.error("Please enter your API key");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api-swap/pools`, {
        method: "GET",
        headers: {
          "x-api-key": testApiKey,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(JSON.stringify({ error: "Request failed" }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/api">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-bold">API Documentation</h1>
          </div>
          <Badge variant="secondary" className="font-mono">v1.0</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Introduction */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4">TUNA Launchpad API</h2>
          <p className="text-muted-foreground text-lg mb-6">
            Build your own token launchpad with our powerful API. Launch tokens, execute trades, 
            and earn 1.5% of all trading fees.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <Rocket className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Launch Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create new meme tokens with a single API call. Fully on-chain via Meteora.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <RefreshCw className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Trade Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get swap quotes and execute trades on any launchpad token.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CreditCard className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Earn Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Receive 1.5% of all trading fees from tokens launched via your API.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="getting-started" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="widgets">Widgets</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
            <TabsTrigger value="playground">Playground</TabsTrigger>
          </TabsList>

          {/* Getting Started */}
          <TabsContent value="getting-started" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Create an API Account</CardTitle>
                <CardDescription>Get your API key to start building</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Visit the <Link to="/api" className="text-primary hover:underline">API Dashboard</Link> and connect your wallet to create an account.</p>
                <p>Your API key will be displayed once. Store it securely - it cannot be recovered.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Authentication</CardTitle>
                <CardDescription>All API requests require authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Include your API key in the <code className="bg-muted px-2 py-1 rounded">x-api-key</code> header:</p>
                <CodeBlock 
                  id="auth-example"
                  code={`curl -X GET "${BASE_URL}/api-swap/pools" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Base URL</CardTitle>
                <CardDescription>All API endpoints use the same base URL</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock 
                  id="base-url"
                  code={BASE_URL}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fee Structure</CardTitle>
                <CardDescription>How you earn from the API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-primary">1.5%</p>
                    <p className="text-sm text-muted-foreground">Your share of trading fees</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-muted-foreground">0.5%</p>
                    <p className="text-sm text-muted-foreground">Platform fee</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total trading fee is 2%. You receive 75% of all fees from tokens launched via your API.
                  Fees can be claimed when balance exceeds 0.01 SOL.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Endpoints */}
          <TabsContent value="endpoints" className="space-y-6">
            {/* Launch Token */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">POST</Badge>
                  <code className="text-lg">/api-launch-token</code>
                </div>
                <CardDescription>Launch a new token</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <CodeBlock 
                    id="launch-request"
                    language="json"
                    code={`{
  "name": "MyToken",           // Required: Token name (max 32 chars)
  "ticker": "MTK",             // Required: Token ticker (max 10 chars)
  "description": "A fun coin", // Optional: Description
  "imageUrl": "https://...",   // Optional: Token image URL
  "websiteUrl": "https://...", // Optional: Website URL
  "twitterUrl": "https://...", // Optional: Twitter URL
  "tradingFeeBps": 200         // Optional: Trading fee 10-1000 (0.1%-10%)
}`}
                  />
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Response</h4>
                  <CodeBlock 
                    id="launch-response"
                    language="json"
                    code={`{
  "success": true,
  "tokenId": "uuid",
  "mintAddress": "base58...",
  "poolAddress": "base58...",
  "solscanUrl": "https://solscan.io/token/...",
  "tradeUrl": "https://axiom.trade/meme/..."
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Swap Quote */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">POST</Badge>
                  <code className="text-lg">/api-swap</code>
                </div>
                <CardDescription>Get swap quote for a trade</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <CodeBlock 
                    id="swap-request"
                    language="json"
                    code={`{
  "poolAddress": "base58...",
  "inputMint": "So11111111111111111111111111111111111111112", // SOL
  "outputMint": "base58...",  // Token mint
  "amount": "1000000000",     // Amount in lamports
  "slippageBps": 100          // Slippage tolerance (1%)
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* List Pools */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600">GET</Badge>
                  <code className="text-lg">/api-swap/pools</code>
                </div>
                <CardDescription>List all available trading pools</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Returns up to 100 active pools sorted by market cap.</p>
                <CodeBlock 
                  id="pools-response"
                  language="json"
                  code={`{
  "success": true,
  "count": 50,
  "pools": [
    {
      "mintAddress": "...",
      "poolAddress": "...",
      "name": "MyToken",
      "ticker": "MTK",
      "price": 0.00003,
      "marketCap": 30000,
      "volume24h": 5000
    }
  ]
}`}
                  />
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  <code className="text-lg">/api-webhooks</code>
                </div>
                <CardDescription>Manage webhook subscriptions for real-time events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Supported Events</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">token.created</Badge>
                    <Badge variant="outline">token.graduated</Badge>
                    <Badge variant="outline">trade.executed</Badge>
                    <Badge variant="outline">fees.accumulated</Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Create Webhook (POST)</h4>
                  <CodeBlock 
                    id="webhook-create"
                    language="json"
                    code={`{
  "url": "https://your-site.com/webhook",
  "events": ["token.created", "trade.executed"]
}`}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Widgets */}
          <TabsContent value="widgets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Embeddable Widgets</CardTitle>
                <CardDescription>Add token launching to your website with a single iframe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Token Launcher Widget</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    A complete token creation form that your users can use to launch tokens.
                  </p>
                  <CodeBlock 
                    id="widget-launcher"
                    code={`<iframe 
  src="https://launchpadv3.lovable.app/widget/launcher?apiKey=YOUR_API_KEY&theme=dark"
  width="100%" 
  height="600"
  frameborder="0"
  allow="clipboard-write"
></iframe>`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Trade Panel Widget</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Buy/sell interface for a specific token.
                  </p>
                  <CodeBlock 
                    id="widget-trade"
                    code={`<iframe 
  src="https://launchpadv3.lovable.app/widget/trade?mintAddress=TOKEN_MINT&apiKey=YOUR_API_KEY"
  width="400" 
  height="500"
  frameborder="0"
></iframe>`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Token List Widget</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Display tokens from your launchpad.
                  </p>
                  <CodeBlock 
                    id="widget-list"
                    code={`<iframe 
  src="https://launchpadv3.lovable.app/widget/token-list?apiKey=YOUR_API_KEY&limit=10"
  width="100%" 
  height="400"
  frameborder="0"
></iframe>`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Customization Options</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Parameter</th>
                          <th className="text-left py-2">Values</th>
                          <th className="text-left py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2"><code>theme</code></td>
                          <td className="py-2">dark, light</td>
                          <td className="py-2">Widget color scheme</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2"><code>accentColor</code></td>
                          <td className="py-2">%23HEXCODE</td>
                          <td className="py-2">Primary accent color (URL encoded)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2"><code>hideHeader</code></td>
                          <td className="py-2">true, false</td>
                          <td className="py-2">Hide the widget header</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>cURL</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock 
                  id="curl-example"
                  code={`# Launch a new token
curl -X POST "${BASE_URL}/api-launch-token" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "MyAwesomeToken",
    "ticker": "MAT",
    "description": "The next big thing!",
    "imageUrl": "https://example.com/logo.png"
  }'`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>JavaScript / Node.js</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock 
                  id="js-example"
                  language="javascript"
                  code={`const API_KEY = 'YOUR_API_KEY';
const BASE_URL = '${BASE_URL}';

// Launch a token
async function launchToken() {
  const response = await fetch(\`\${BASE_URL}/api-launch-token\`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'MyToken',
      ticker: 'MTK',
      description: 'A cool new token',
    }),
  });
  
  const data = await response.json();
  console.log('Token created:', data.mintAddress);
  return data;
}

// Get swap quote
async function getQuote(poolAddress, solAmount) {
  const response = await fetch(\`\${BASE_URL}/api-swap\`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      poolAddress,
      inputMint: 'So11111111111111111111111111111111111111112',
      amount: (solAmount * 1e9).toString(),
      slippageBps: 100,
    }),
  });
  
  return response.json();
}`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Python</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock 
                  id="python-example"
                  language="python"
                  code={`import requests

API_KEY = 'YOUR_API_KEY'
BASE_URL = '${BASE_URL}'

headers = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
}

# Launch a token
def launch_token(name, ticker, description=''):
    response = requests.post(
        f'{BASE_URL}/api-launch-token',
        headers=headers,
        json={
            'name': name,
            'ticker': ticker,
            'description': description
        }
    )
    return response.json()

# Get pools
def get_pools():
    response = requests.get(
        f'{BASE_URL}/api-swap/pools',
        headers=headers
    )
    return response.json()

# Example usage
result = launch_token('MyToken', 'MTK', 'A cool token')
print(f"Token created: {result['mintAddress']}")`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Playground */}
          <TabsContent value="playground" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  <CardTitle>API Playground</CardTitle>
                </div>
                <CardDescription>Test the API directly from your browser</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Your API Key</label>
                  <Input
                    type="password"
                    placeholder="Enter your API key"
                    value={testApiKey}
                    onChange={(e) => setTestApiKey(e.target.value)}
                  />
                </div>

                <Button onClick={testEndpoint} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Code className="h-4 w-4 mr-2" />
                      Test GET /api-swap/pools
                    </>
                  )}
                </Button>

                {testResult && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Response</label>
                    <pre className="bg-black/80 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-96 overflow-y-auto">
                      {testResult}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
