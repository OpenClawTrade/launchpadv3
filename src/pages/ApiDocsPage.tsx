import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Check, Code, Rocket, RefreshCw, Webhook, CreditCard, Terminal, Zap, Shield, Globe, FileCode, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const BASE_URL = "https://api.clawmode.lovable.app";
const APP_URL = "https://clawmode.lovable.app";

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
      <pre className="bg-black/90 text-primary p-4 rounded-lg overflow-x-auto text-sm font-mono border border-primary/20">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary hover:bg-primary/10"
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
    <div className="min-h-screen bg-background gate-theme">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/api">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-bold text-foreground">API Documentation</h1>
          </div>
          <Badge className="font-mono bg-primary/10 text-primary border-primary/20">v1.0</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* AI Implementation Notice */}
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-primary">AI-Ready Documentation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This documentation is designed for AI assistants to implement a complete token launchpad in a single prompt.
              Simply tell your AI: <code className="bg-black/50 px-2 py-1 rounded text-primary">"Create a launchpad using the TUNA API documentation"</code>
            </p>
          </CardContent>
        </Card>

        {/* Quick Start Summary for AI */}
        <Card className="mb-8 border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Complete API Specification
            </CardTitle>
            <CardDescription>Everything needed to build a token launchpad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <p className="text-2xl font-bold text-primary">REST API</p>
                <p className="text-sm text-muted-foreground">JSON over HTTPS</p>
              </div>
              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <p className="text-2xl font-bold text-primary">1% Revenue</p>
                <p className="text-sm text-muted-foreground">Your share of fees</p>
              </div>
              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <p className="text-2xl font-bold text-primary">Meteora DBC</p>
                <p className="text-sm text-muted-foreground">On-chain pools</p>
              </div>
              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <p className="text-2xl font-bold text-primary">Widgets</p>
                <p className="text-sm text-muted-foreground">Embed via iframe</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="complete-spec" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-card/50 border border-border/50">
            <TabsTrigger value="complete-spec" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Full Spec</TabsTrigger>
            <TabsTrigger value="getting-started" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Setup</TabsTrigger>
            <TabsTrigger value="endpoints" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Endpoints</TabsTrigger>
            <TabsTrigger value="widgets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Widgets</TabsTrigger>
            <TabsTrigger value="examples" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Examples</TabsTrigger>
            <TabsTrigger value="playground" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Test</TabsTrigger>
          </TabsList>

          {/* Complete Specification for AI */}
          <TabsContent value="complete-spec" className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
              <CardTitle>Claw Mode Launchpad API - Complete Specification</CardTitle>
              <CardDescription>All information needed to implement a fully functional token launchpad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CodeBlock 
                  id="full-spec"
                  language="json"
                  code={`// ============================================================
// TUNA LAUNCHPAD API - COMPLETE SPECIFICATION v1.0
// ============================================================
// Use this specification to build a custom token launchpad
// that integrates with the TUNA ecosystem on Solana.
// ============================================================

{
  "platform": {
    "name": "TUNA Launchpad",
    "blockchain": "Solana",
    "poolProtocol": "Meteora Dynamic Bonding Curve (DBC)",
    "website": "${APP_URL}",
    "apiVersion": "1.0"
  },
  
  "authentication": {
    "method": "API Key",
    "header": "x-api-key",
    "obtainKey": "Visit ${APP_URL}/api and connect wallet to create account",
    "keyFormat": "ak_[64 hex characters]",
    "security": "Keys are hashed with SHA-256, never stored in plain text"
  },
  
  "baseUrl": "${BASE_URL}",
  
  "feeStructure": {
    "totalTradingFee": "2% (200 bps)",
    "apiUserShare": "1% (100 bps) - YOUR REVENUE",
    "platformShare": "1% (100 bps)",
    "claimThreshold": "0.01 SOL minimum",
    "claimMethod": "Visit ${APP_URL}/api dashboard",
    "customFees": {
      "range": "0.1% to 10% (10-1000 bps)",
      "default": "2% (200 bps)"
    }
  },
  
  "endpoints": {
    "launchToken": {
      "method": "POST",
      "url": "${BASE_URL}/api-launch-token",
      "description": "Create and deploy a new token with Meteora DBC pool",
      "headers": {
        "Content-Type": "application/json",
        "x-api-key": "YOUR_API_KEY"
      },
      "requestBody": {
        "name": { "type": "string", "required": true, "maxLength": 32, "description": "Token name" },
        "ticker": { "type": "string", "required": true, "maxLength": 10, "pattern": "^[A-Z0-9]+$", "description": "Token symbol" },
        "description": { "type": "string", "required": false, "maxLength": 500, "description": "Token description" },
        "imageUrl": { "type": "string", "required": false, "format": "url", "description": "Token image URL (recommended: 400x400px)" },
        "websiteUrl": { "type": "string", "required": false, "format": "url", "description": "Project website" },
        "twitterUrl": { "type": "string", "required": false, "format": "url", "description": "Twitter/X profile" },
        "telegramUrl": { "type": "string", "required": false, "format": "url", "description": "Telegram group" },
        "discordUrl": { "type": "string", "required": false, "format": "url", "description": "Discord server" },
        "tradingFeeBps": { "type": "integer", "required": false, "min": 10, "max": 1000, "default": 200, "description": "Trading fee in basis points" }
      },
      "response": {
        "success": { "type": "boolean" },
        "tokenId": { "type": "uuid", "description": "Internal database ID" },
        "mintAddress": { "type": "string", "description": "Solana token mint address" },
        "poolAddress": { "type": "string", "description": "Meteora DBC pool address" },
        "solscanUrl": { "type": "string", "description": "Link to Solscan explorer" },
        "tradeUrl": { "type": "string", "description": "Link to Axiom trading page" },
        "launchpadUrl": { "type": "string", "description": "Link to TUNA trading page" },
        "feeInfo": { "type": "object", "description": "Fee distribution details" }
      },
      "errors": {
        "401": "Invalid or missing API key",
        "400": "Validation error (check name, ticker format)",
        "500": "Server error or blockchain failure"
      }
    },
    
    "getSwapQuote": {
      "method": "POST",
      "url": "${BASE_URL}/api-swap",
      "description": "Get quote for buying or selling tokens",
      "headers": {
        "Content-Type": "application/json",
        "x-api-key": "YOUR_API_KEY"
      },
      "requestBody": {
        "poolAddress": { "type": "string", "required": true, "description": "Meteora pool address" },
        "inputMint": { "type": "string", "required": true, "description": "Input token mint (use So11111111111111111111111111111111111111112 for SOL)" },
        "outputMint": { "type": "string", "required": true, "description": "Output token mint" },
        "amount": { "type": "string", "required": true, "description": "Amount in smallest units (lamports for SOL)" },
        "slippageBps": { "type": "integer", "required": false, "default": 100, "description": "Slippage tolerance in basis points" }
      },
      "response": {
        "success": { "type": "boolean" },
        "inputMint": { "type": "string" },
        "outputMint": { "type": "string" },
        "inputAmount": { "type": "string" },
        "outputAmount": { "type": "string" },
        "minOutputAmount": { "type": "string", "description": "Minimum output with slippage" },
        "priceImpact": { "type": "string", "description": "Price impact percentage" },
        "fee": { "type": "object", "description": "Fee breakdown" },
        "poolInfo": { "type": "object", "description": "Current pool state" }
      }
    },
    
    "listPools": {
      "method": "GET",
      "url": "${BASE_URL}/api-swap/pools",
      "description": "List all active trading pools",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      },
      "response": {
        "success": { "type": "boolean" },
        "count": { "type": "integer" },
        "pools": { 
          "type": "array",
          "items": {
            "mintAddress": "string",
            "poolAddress": "string",
            "name": "string",
            "ticker": "string",
            "price": "number (in SOL)",
            "marketCap": "number (in SOL)",
            "volume24h": "number (in SOL)",
            "status": "string (bonding|graduated)"
          }
        }
      }
    },
    
    "getPool": {
      "method": "GET",
      "url": "${BASE_URL}/api-swap/pool?address={poolAddress}",
      "description": "Get detailed info for a specific pool",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      },
      "response": {
        "success": { "type": "boolean" },
        "pool": {
          "mintAddress": "string",
          "poolAddress": "string",
          "name": "string",
          "ticker": "string",
          "description": "string",
          "imageUrl": "string",
          "price": "number",
          "marketCap": "number",
          "volume24h": "number",
          "virtualSolReserves": "number",
          "virtualTokenReserves": "number",
          "totalSupply": "number (1 billion default)",
          "bondingProgress": "number (0-100%)",
          "graduationThreshold": "number (85 SOL default)",
          "status": "string",
          "createdAt": "string (ISO 8601)",
          "websiteUrl": "string",
          "twitterUrl": "string"
        }
      }
    },

    "webhooks": {
      "method": "POST/GET/DELETE",
      "url": "${BASE_URL}/api-webhooks",
      "description": "Manage webhook subscriptions for real-time events",
      "supportedEvents": [
        "token.created - When a new token is launched",
        "token.graduated - When token reaches 85 SOL and graduates",
        "trade.executed - When a buy/sell occurs",
        "fees.accumulated - When your fee balance increases"
      ],
      "createWebhook": {
        "method": "POST",
        "body": {
          "url": "https://your-server.com/webhook",
          "events": ["token.created", "trade.executed"]
        }
      },
      "webhookPayload": {
        "event": "string",
        "timestamp": "string (ISO 8601)",
        "data": "object (event-specific)"
      }
    }
  },
  
  "widgets": {
    "description": "Embeddable iframes for quick integration",
    "launcher": {
      "url": "${APP_URL}/widget/launcher",
      "params": {
        "apiKey": "YOUR_API_KEY (required)",
        "theme": "dark|light (default: dark)",
        "accentColor": "%23HEX (URL encoded)",
        "hideHeader": "true|false"
      },
      "dimensions": { "width": "100%", "height": "600px" },
      "features": "Complete token creation form with image upload"
    },
    "trade": {
      "url": "${APP_URL}/widget/trade",
      "params": {
        "mintAddress": "TOKEN_MINT (required)",
        "apiKey": "YOUR_API_KEY (required)",
        "theme": "dark|light"
      },
      "dimensions": { "width": "400px", "height": "500px" },
      "features": "Buy/sell interface with price chart"
    },
    "tokenList": {
      "url": "${APP_URL}/widget/token-list",
      "params": {
        "apiKey": "YOUR_API_KEY (required)",
        "limit": "10-50 (default: 10)",
        "theme": "dark|light"
      },
      "dimensions": { "width": "100%", "height": "400px" },
      "features": "Scrollable list of tokens with prices"
    }
  },
  
  "solanaIntegration": {
    "network": "mainnet-beta",
    "rpcEndpoint": "Use Helius or other reliable RPC provider",
    "solMint": "So11111111111111111111111111111111111111112",
    "meteoraProgram": "Use @meteora-ag/dynamic-bonding-curve-sdk",
    "tokenStandard": "SPL Token with Metaplex metadata"
  },
  
  "bondingCurve": {
    "type": "Constant Product (x * y = k)",
    "virtualSolReserves": "30 SOL initial",
    "virtualTokenReserves": "1 billion tokens",
    "realTokensForSale": "800 million tokens",
    "lpTokens": "200 million tokens (locked for migration)",
    "graduationThreshold": "85 SOL real reserves",
    "graduationDestination": "Raydium/Meteora CPAMM",
    "priceFormula": "price = virtualSolReserves / virtualTokenReserves"
  },
  
  "rateLimits": {
    "requestsPerMinute": 60,
    "tokensPerHour": 10,
    "burstLimit": 10
  },
  
  "implementationNotes": [
    "All amounts use smallest units (lamports = SOL * 1e9)",
    "Token tickers are automatically uppercased",
    "Images should be hosted on reliable CDN (IPFS, Cloudinary, etc.)",
    "Fees are collected on-chain and claimable via dashboard",
    "Tokens are immediately tradeable after launch",
    "Pool addresses are needed for trading operations"
  ]
}`}
                />
              </CardContent>
            </Card>

            {/* Implementation Templates */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Ready-to-Use Implementation Templates</CardTitle>
                <CardDescription>Copy these templates for quick integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    TypeScript/JavaScript SDK Class
                  </h4>
                  <CodeBlock 
                    id="ts-sdk"
                    language="typescript"
                    code={`// TUNA Launchpad API Client
// Copy this class to integrate with your application

class TunaLaunchpadAPI {
  private apiKey: string;
  private baseUrl = "${BASE_URL}";
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "API request failed");
    }
    
    return response.json();
  }
  
  // Launch a new token
  async launchToken(params: {
    name: string;
    ticker: string;
    description?: string;
    imageUrl?: string;
    websiteUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
    discordUrl?: string;
    tradingFeeBps?: number;
  }) {
    return this.request("/api-launch-token", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }
  
  // Get swap quote
  async getQuote(params: {
    poolAddress: string;
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
  }) {
    return this.request("/api-swap", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }
  
  // List all pools
  async listPools() {
    return this.request("/api-swap/pools", { method: "GET" });
  }
  
  // Get pool details
  async getPool(poolAddress: string) {
    return this.request(\`/api-swap/pool?address=\${poolAddress}\`, { method: "GET" });
  }
  
  // Create webhook
  async createWebhook(url: string, events: string[]) {
    return this.request("/api-webhooks", {
      method: "POST",
      body: JSON.stringify({ url, events }),
    });
  }
}

// Usage Example:
const tuna = new TunaLaunchpadAPI("your_api_key_here");

// Launch a token
const result = await tuna.launchToken({
  name: "My Awesome Token",
  ticker: "MAT",
  description: "The best meme token on Solana",
  imageUrl: "https://example.com/token-logo.png",
  websiteUrl: "https://mytoken.com",
  twitterUrl: "https://twitter.com/mytoken",
});

console.log("Token launched!", result.mintAddress);
console.log("Trade at:", result.tradeUrl);`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    React Component Example
                  </h4>
                  <CodeBlock 
                    id="react-example"
                    language="tsx"
                    code={`// React Token Launcher Component
import { useState } from "react";

const API_KEY = "your_api_key_here";
const API_URL = "${BASE_URL}";

export function TokenLauncher() {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const launchToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(\`\${API_URL}/api-launch-token\`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ name, ticker: ticker.toUpperCase() }),
      });
      
      const data = await response.json();
      if (data.success) {
        setResult(data);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert("Failed to launch token");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="success-panel">
        <h2>🚀 Token Launched!</h2>
        <p>Name: {name} (\${ticker})</p>
        <p>Mint: {result.mintAddress}</p>
        <a href={result.tradeUrl} target="_blank">Trade Now →</a>
        <a href={result.solscanUrl} target="_blank">View on Solscan →</a>
      </div>
    );
  }

  return (
    <form onSubmit={launchToken}>
      <input
        type="text"
        placeholder="Token Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={32}
      />
      <input
        type="text"
        placeholder="TICKER"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        required
        maxLength={10}
        pattern="[A-Z0-9]+"
      />
      <button type="submit" disabled={loading}>
        {loading ? "Launching..." : "Launch Token"}
      </button>
    </form>
  );
}`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    Python SDK
                  </h4>
                  <CodeBlock 
                    id="python-sdk"
                    language="python"
                    code={`# TUNA Launchpad Python SDK
import requests
from typing import Optional, Dict, Any

class TunaLaunchpad:
    BASE_URL = "${BASE_URL}"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key
        }
    
    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[Any, Any]:
        url = f"{self.BASE_URL}{endpoint}"
        response = requests.request(method, url, json=data, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def launch_token(
        self,
        name: str,
        ticker: str,
        description: Optional[str] = None,
        image_url: Optional[str] = None,
        website_url: Optional[str] = None,
        twitter_url: Optional[str] = None,
        trading_fee_bps: int = 200
    ) -> Dict[Any, Any]:
        """Launch a new token on the TUNA launchpad."""
        return self._request("POST", "/api-launch-token", {
            "name": name[:32],
            "ticker": ticker.upper()[:10],
            "description": description,
            "imageUrl": image_url,
            "websiteUrl": website_url,
            "twitterUrl": twitter_url,
            "tradingFeeBps": trading_fee_bps
        })
    
    def get_quote(
        self,
        pool_address: str,
        input_mint: str,
        output_mint: str,
        amount: str,
        slippage_bps: int = 100
    ) -> Dict[Any, Any]:
        """Get a swap quote for trading."""
        return self._request("POST", "/api-swap", {
            "poolAddress": pool_address,
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": amount,
            "slippageBps": slippage_bps
        })
    
    def list_pools(self) -> Dict[Any, Any]:
        """List all available trading pools."""
        return self._request("GET", "/api-swap/pools")
    
    def get_pool(self, pool_address: str) -> Dict[Any, Any]:
        """Get details for a specific pool."""
        return self._request("GET", f"/api-swap/pool?address={pool_address}")

# Usage
tuna = TunaLaunchpad("your_api_key_here")

# Launch token
result = tuna.launch_token(
    name="Python Token",
    ticker="PYTH",
    description="Launched from Python!",
    image_url="https://example.com/logo.png"
)
print(f"Token launched: {result['mintAddress']}")
print(f"Trade at: {result['tradeUrl']}")`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    cURL Commands
                  </h4>
                  <CodeBlock 
                    id="curl-commands"
                    code={`# Launch a new token
curl -X POST "${BASE_URL}/api-launch-token" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "name": "My Token",
    "ticker": "MTK",
    "description": "A great meme token",
    "imageUrl": "https://example.com/logo.png"
  }'

# List all pools
curl -X GET "${BASE_URL}/api-swap/pools" \\
  -H "x-api-key: YOUR_API_KEY"

# Get swap quote (buy 1 SOL worth of tokens)
curl -X POST "${BASE_URL}/api-swap" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "poolAddress": "POOL_ADDRESS_HERE",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "TOKEN_MINT_HERE",
    "amount": "1000000000",
    "slippageBps": 100
  }'

# Get pool info
curl -X GET "${BASE_URL}/api-swap/pool?address=POOL_ADDRESS" \\
  -H "x-api-key: YOUR_API_KEY"`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Code className="h-4 w-4 text-primary" />
                    HTML Widget Embed
                  </h4>
                  <CodeBlock 
                    id="html-embed"
                    language="html"
                    code={`<!-- Full Launchpad Page -->
<!DOCTYPE html>
<html>
<head>
  <title>My Token Launchpad</title>
  <style>
    body { margin: 0; background: #0a0a0a; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #00D26A; text-align: center; }
    .widgets { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    iframe { border: none; border-radius: 12px; }
    @media (max-width: 768px) {
      .widgets { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 My Custom Launchpad</h1>
    
    <div class="widgets">
      <!-- Token Launcher -->
      <iframe 
        src="${APP_URL}/widget/launcher?apiKey=YOUR_API_KEY&theme=dark"
        width="100%" 
        height="600"
        allow="clipboard-write"
      ></iframe>
      
      <!-- Token List -->
      <iframe 
        src="${APP_URL}/widget/token-list?apiKey=YOUR_API_KEY&limit=20&theme=dark"
        width="100%" 
        height="600"
      ></iframe>
    </div>
  </div>
</body>
</html>`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Error Handling */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Error Codes & Handling</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-2 text-muted-foreground">Code</th>
                        <th className="text-left py-3 px-2 text-muted-foreground">Meaning</th>
                        <th className="text-left py-3 px-2 text-muted-foreground">Solution</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/30">
                        <td className="py-3 px-2"><Badge variant="destructive">400</Badge></td>
                        <td className="py-3 px-2">Validation Error</td>
                        <td className="py-3 px-2 text-muted-foreground">Check request body format (name, ticker requirements)</td>
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="py-3 px-2"><Badge variant="destructive">401</Badge></td>
                        <td className="py-3 px-2">Unauthorized</td>
                        <td className="py-3 px-2 text-muted-foreground">Verify x-api-key header is present and valid</td>
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="py-3 px-2"><Badge variant="destructive">404</Badge></td>
                        <td className="py-3 px-2">Not Found</td>
                        <td className="py-3 px-2 text-muted-foreground">Pool or token doesn't exist</td>
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="py-3 px-2"><Badge variant="destructive">429</Badge></td>
                        <td className="py-3 px-2">Rate Limited</td>
                        <td className="py-3 px-2 text-muted-foreground">Wait before retrying, implement exponential backoff</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-2"><Badge variant="destructive">500</Badge></td>
                        <td className="py-3 px-2">Server Error</td>
                        <td className="py-3 px-2 text-muted-foreground">Retry with backoff, check Solana network status</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Getting Started */}
          <TabsContent value="getting-started" className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>1. Create an API Account</CardTitle>
                <CardDescription>Get your API key to start building</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">Visit the <Link to="/api" className="text-primary hover:underline">API Dashboard</Link> and connect your Solana wallet to create an account.</p>
                <p className="text-muted-foreground">Your API key will be displayed once. Store it securely - it cannot be recovered.</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>2. Authentication</CardTitle>
                <CardDescription>All API requests require authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">Include your API key in the <code className="bg-black/50 px-2 py-1 rounded text-primary">x-api-key</code> header:</p>
                <CodeBlock 
                  id="auth-example"
                  code={`curl -X GET "${BASE_URL}/api-swap/pools" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                />
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
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

            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Fee Structure</CardTitle>
                <CardDescription>How you earn from the API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                    <p className="text-2xl font-bold text-primary">1%</p>
                    <p className="text-sm text-muted-foreground">Your share of trading fees</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
                    <p className="text-2xl font-bold text-muted-foreground">1%</p>
                    <p className="text-sm text-muted-foreground">Platform fee</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total trading fee is 2%. You receive 50% (1%) of all fees from tokens launched via your API.
                  Fees can be claimed when balance exceeds 0.01 SOL.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Endpoints */}
          <TabsContent value="endpoints" className="space-y-6">
            {/* Launch Token */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">POST</Badge>
                  <code className="text-lg text-foreground">/api-launch-token</code>
                </div>
                <CardDescription>Launch a new token with automatic pool creation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Request Body</h4>
                  <CodeBlock 
                    id="launch-request"
                    language="json"
                    code={`{
  "name": "MyToken",           // Required: Token name (max 32 chars)
  "ticker": "MTK",             // Required: Token ticker (max 10 chars, alphanumeric)
  "description": "A fun coin", // Optional: Description (max 500 chars)
  "imageUrl": "https://...",   // Optional: Token image URL (recommended 400x400px)
  "websiteUrl": "https://...", // Optional: Website URL
  "twitterUrl": "https://...", // Optional: Twitter/X URL
  "telegramUrl": "https://...",// Optional: Telegram URL
  "discordUrl": "https://...", // Optional: Discord URL
  "tradingFeeBps": 200         // Optional: Trading fee 10-1000 bps (0.1%-10%, default 2%)
}`}
                  />
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Response</h4>
                  <CodeBlock 
                    id="launch-response"
                    language="json"
                  code={`{
  "success": true,
  "tokenId": "uuid",
  "mintAddress": "base58...",
  "poolAddress": "base58...",
  "solscanUrl": "https://solscan.io/token/...",
  "tradeUrl": "https://axiom.trade/meme/...",
  "launchpadUrl": "https://tuna.fun/fun/...",
  "feeInfo": {
    "tradingFeeBps": 200,
    "apiUserShare": "50%",
    "platformShare": "50%",
    "claimThreshold": "0.01 SOL"
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Swap Quote */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">POST</Badge>
                  <code className="text-lg text-foreground">/api-swap</code>
                </div>
                <CardDescription>Get swap quote for a trade</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Request Body</h4>
                  <CodeBlock 
                    id="swap-request"
                    language="json"
                    code={`{
  "poolAddress": "base58...",                              // Meteora pool address
  "inputMint": "So11111111111111111111111111111111111111112", // SOL for buy
  "outputMint": "base58...",                               // Token mint
  "amount": "1000000000",                                  // Amount in lamports (1 SOL)
  "slippageBps": 100                                       // Slippage tolerance 1%
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* List Pools */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600">GET</Badge>
                  <code className="text-lg text-foreground">/api-swap/pools</code>
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

            {/* Get Pool */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600">GET</Badge>
                  <code className="text-lg text-foreground">/api-swap/pool?address=&#123;poolAddress&#125;</code>
                </div>
                <CardDescription>Get detailed info for a specific pool</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock 
                  id="pool-response"
                  language="json"
                  code={`{
  "success": true,
  "pool": {
    "mintAddress": "...",
    "poolAddress": "...",
    "name": "MyToken",
    "ticker": "MTK",
    "description": "...",
    "imageUrl": "...",
    "price": 0.00003,
    "marketCap": 30000,
    "volume24h": 5000,
    "virtualSolReserves": 30,
    "virtualTokenReserves": 1000000000,
    "bondingProgress": 35.5,
    "graduationThreshold": 85,
    "status": "bonding",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}`}
                />
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  <code className="text-lg text-foreground">/api-webhooks</code>
                </div>
                <CardDescription>Manage webhook subscriptions for real-time events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Supported Events</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/30 text-primary">token.created</Badge>
                    <Badge variant="outline" className="border-primary/30 text-primary">token.graduated</Badge>
                    <Badge variant="outline" className="border-primary/30 text-primary">trade.executed</Badge>
                    <Badge variant="outline" className="border-primary/30 text-primary">fees.accumulated</Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Create Webhook (POST)</h4>
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
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Embeddable Widgets</CardTitle>
                <CardDescription>Add token launching to your website with a single iframe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Token Launcher Widget</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    A complete token creation form that your users can use to launch tokens.
                  </p>
                  <CodeBlock 
                    id="widget-launcher"
                    code={`<iframe 
  src="${APP_URL}/widget/launcher?apiKey=YOUR_API_KEY&theme=dark"
  width="100%" 
  height="600"
  frameborder="0"
  allow="clipboard-write"
></iframe>`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Trade Panel Widget</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Buy/sell interface for a specific token.
                  </p>
                  <CodeBlock 
                    id="widget-trade"
                    code={`<iframe 
  src="${APP_URL}/widget/trade?mintAddress=TOKEN_MINT&apiKey=YOUR_API_KEY"
  width="400" 
  height="500"
  frameborder="0"
></iframe>`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Token List Widget</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Display tokens from your launchpad.
                  </p>
                  <CodeBlock 
                    id="widget-list"
                    code={`<iframe 
  src="${APP_URL}/widget/token-list?apiKey=YOUR_API_KEY&limit=10"
  width="100%" 
  height="400"
  frameborder="0"
></iframe>`}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Customization Options</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 text-muted-foreground">Parameter</th>
                          <th className="text-left py-2 text-muted-foreground">Values</th>
                          <th className="text-left py-2 text-muted-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/30">
                          <td className="py-2"><code className="text-primary">theme</code></td>
                          <td className="py-2">dark, light</td>
                          <td className="py-2 text-muted-foreground">Widget color scheme</td>
                        </tr>
                        <tr className="border-b border-border/30">
                          <td className="py-2"><code className="text-primary">accentColor</code></td>
                          <td className="py-2">%23HEXCODE</td>
                          <td className="py-2 text-muted-foreground">Primary accent color (URL encoded)</td>
                        </tr>
                        <tr className="border-b border-border/30">
                          <td className="py-2"><code className="text-primary">hideHeader</code></td>
                          <td className="py-2">true, false</td>
                          <td className="py-2 text-muted-foreground">Hide the widget header</td>
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
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Complete Launchpad Implementation</CardTitle>
                <CardDescription>Full Next.js/React example with all features</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock 
                  id="nextjs-full"
                  language="typescript"
                  code={`// pages/index.tsx - Complete Launchpad Page
import { useState, useEffect } from 'react';

const API_KEY = "YOUR_API_KEY_HERE";
const API_URL = "${BASE_URL}";

interface Token {
  mintAddress: string;
  poolAddress: string;
  name: string;
  ticker: string;
  price: number;
  marketCap: number;
}

export default function Launchpad() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
  });
  const [launching, setLaunching] = useState(false);

  // Fetch tokens on mount
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchTokens = async () => {
    try {
      const res = await fetch(\`\${API_URL}/api-swap/pools\`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      if (data.success) setTokens(data.pools);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    }
  };

  const launchToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaunching(true);
    
    try {
      const res = await fetch(\`\${API_URL}/api-launch-token\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          description: formData.description,
          imageUrl: formData.imageUrl,
        }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        alert(\`Token launched! Trade at: \${result.tradeUrl}\`);
        setFormData({ name: '', ticker: '', description: '', imageUrl: '' });
        fetchTokens(); // Refresh list
      } else {
        alert(\`Error: \${result.error}\`);
      }
    } catch (error) {
      alert('Failed to launch token');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-8">🐟 My Launchpad</h1>
      
      {/* Launch Form */}
      <div className="max-w-md mx-auto bg-gray-900 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-bold mb-4">Launch New Token</h2>
        <form onSubmit={launchToken} className="space-y-4">
          <input
            type="text"
            placeholder="Token Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full p-3 bg-black rounded border border-gray-700"
            required
          />
          <input
            type="text"
            placeholder="TICKER"
            value={formData.ticker}
            onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})}
            className="w-full p-3 bg-black rounded border border-gray-700"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full p-3 bg-black rounded border border-gray-700"
          />
          <input
            type="url"
            placeholder="Image URL"
            value={formData.imageUrl}
            onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
            className="w-full p-3 bg-black rounded border border-gray-700"
          />
          <button
            type="submit"
            disabled={launching}
            className="w-full p-3 bg-green-500 hover:bg-green-600 rounded font-bold disabled:opacity-50"
          >
            {launching ? 'Launching...' : '🚀 Launch Token'}
          </button>
        </form>
      </div>
      
      {/* Token List */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4">Live Tokens</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map((tkn) => (
            <div key={tkn.mintAddress} className="bg-gray-900 p-4 rounded-xl">
              <div className="font-bold">{tkn.name} (\\\${tkn.ticker})</div>
              <div className="text-gray-400">\\\${tkn.ticker}</div>
              <div className="text-green-400 mt-2">
                {tkn.price.toFixed(9)} SOL
              </div>
              <div className="text-sm text-gray-500">
                MC: {tkn.marketCap.toFixed(2)} SOL
              </div>
              <a
                href={\`https://axiom.trade/meme/\${tkn.poolAddress}\`}
                target="_blank"
                className="block mt-3 text-center bg-green-500/20 text-green-400 py-2 rounded hover:bg-green-500/30"
              >
                Trade →
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Playground */}
          <TabsContent value="playground" className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  API Playground
                </CardTitle>
                <CardDescription>Test API endpoints directly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Enter your API key"
                    value={testApiKey}
                    onChange={(e) => setTestApiKey(e.target.value)}
                    className="font-mono bg-background border-border/50"
                    type="password"
                  />
                  <Button 
                    onClick={testEndpoint} 
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isLoading ? "Testing..." : "Test GET /pools"}
                  </Button>
                </div>
                
                {testResult && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 text-foreground">Response:</h4>
                    <pre className="bg-black/90 text-primary p-4 rounded-lg overflow-x-auto text-sm max-h-96 border border-primary/20">
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
