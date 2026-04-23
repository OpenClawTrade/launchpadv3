import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http, decodeEventLog, parseEther, type Address, type Hash } from "viem";
import { mainnet } from "viem/chains";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import {
  UNICURVE_FACTORY,
  UNICURVE_FACTORY_ABI,
  UNICURVE_EVENT_BUS,
  generateSalt,
  GRADUATION_THRESHOLD,
  LAUNCH_FEE_WEI,
} from "@/lib/ethereum/unicurveFactory";
import { Loader2, Upload, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function BondingCreatePage() {
  const navigate = useNavigate();
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [initialBuy, setInitialBuy] = useState("0");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const creatorAddress = (user?.wallet?.address as Address | undefined) ||
    (wallets.find((w) => w.walletClientType === "privy")?.address as Address | undefined);

  function pickImage(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null;
    const fd = new FormData();
    fd.append("file", imageFile);
    const { data, error } = await supabase.functions.invoke("bonding-upload-image", { body: fd });
    if (error) throw new Error(error.message);
    return (data as { url: string }).url;
  }

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!authenticated) { login(); return; }
    if (!name.trim() || !symbol.trim()) { toast.error("Name and symbol are required"); return; }
    if (!creatorAddress) { toast.error("No wallet connected"); return; }

    setSubmitting(true);
    try {
      // 1. Upload image
      let imageUrl: string | null = null;
      if (imageFile) {
        setStep("Uploading image…");
        imageUrl = await uploadImage();
      }

      // 2. Build metadata JSON inline (we store it in DB; the on-chain URI mirrors it)
      const metadata = {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim().slice(0, 500),
        image: imageUrl || "",
        twitter: twitter.trim(),
        telegram: telegram.trim(),
        website: website.trim(),
        launchpad: "popshiba-bonding",
      };
      const metadataURI = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;

      // 3. Get a wallet client via Privy's injected provider
      setStep("Preparing transaction…");
      const wallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];
      if (!wallet) throw new Error("No wallet available");
      await wallet.switchChain(mainnet.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({ chain: mainnet, transport: custom(provider) }) as any;
      const publicClient = createPublicClient({ chain: mainnet, transport: http() }) as any;

      const salt = generateSalt();
      const initialBuyWei = initialBuy && Number(initialBuy) > 0 ? parseEther(initialBuy) : 0n;
      // Factory requires a 0.01 ETH launch fee. Total tx value = launch fee + initial buy.
      const totalValue = LAUNCH_FEE_WEI + initialBuyWei;

      // 4. Send launch tx — real signature: createToken(name,symbol,uri,initialBuyEth,salt)
      setStep("Confirm in wallet…");
      const hash: Hash = await walletClient.writeContract({
        account: creatorAddress,
        chain: mainnet,
        address: UNICURVE_FACTORY,
        abi: UNICURVE_FACTORY_ABI,
        functionName: "createToken",
        args: [metadata.name, metadata.symbol, metadataURI, initialBuyWei, salt],
        value: totalValue,
      });

      // 5. Wait & decode
      setStep("Waiting for confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");

      let tokenAddr: Address | null = null;
      let curveAddr: Address | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== UNICURVE_FACTORY.toLowerCase()) continue;
        const anyLog = log as unknown as { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] };
        try {
          const decoded = decodeEventLog({
            abi: UNICURVE_FACTORY_ABI,
            data: anyLog.data,
            topics: anyLog.topics,
          }) as { eventName: string; args: Record<string, unknown> };
          if (decoded.eventName === "TokenCreated") {
            const args = decoded.args as unknown as { token: Address; curve: Address };
            tokenAddr = args.token;
            curveAddr = args.curve;
            break;
          }
        } catch { /* not our event */ }
      }
      if (!tokenAddr || !curveAddr) throw new Error("TokenCreated event not found");

      // 6. Persist to Lovable Cloud
      setStep("Saving…");
      await supabase.from("bonding_tokens").insert({
        token_address: tokenAddr.toLowerCase(),
        curve_address: curveAddr.toLowerCase(),
        creator_address: creatorAddress.toLowerCase(),
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description || null,
        image_url: imageUrl,
        twitter_url: metadata.twitter || null,
        telegram_url: metadata.telegram || null,
        website_url: metadata.website || null,
        salt,
        tx_hash: hash,
        block_number: Number(receipt.blockNumber),
        initial_buy_eth: Number(initialBuy) || 0,
      });

      toast.success("Token launched!");
      navigate(`/bonding/token/${tokenAddr}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Launch failed";
      toast.error(msg);
      console.error("Launch error:", err);
    } finally {
      setSubmitting(false);
      setStep("");
    }
  }

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8">
        <Link to="/bonding" className="inline-flex items-center gap-1.5 text-[12px] font-pop-mono text-pop-ink/70 hover:text-pop-ink mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK TO BONDING
        </Link>

        <div className="border-2 border-pop-ink bg-white shadow-[5px_5px_0_hsl(var(--pop-ink))] p-6 sm:p-8">
          <h1 className="font-pop-display text-[28px] tracking-[-0.02em] text-pop-ink mb-1">Launch a Bonding Token</h1>
          <p className="text-[13px] text-pop-ink/70 mb-6">
            Deploys via the Unicurve factory on Ethereum mainnet. 1B supply, 1.06 ETH virtual reserves,
            graduates to Uniswap V4 at {(Number(GRADUATION_THRESHOLD) / 1e18).toFixed(0)} ETH.
          </p>

          <form onSubmit={handleLaunch} className="space-y-5">
            {/* Image */}
            <div>
              <label className="block text-[11px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink mb-2">Image</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full aspect-square max-w-[200px] border-2 border-dashed border-pop-ink/40 bg-pop-cream/50 flex flex-col items-center justify-center gap-2 hover:bg-pop-cream transition-colors overflow-hidden"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-pop-ink/40" />
                    <span className="text-[11px] font-pop-mono text-pop-ink/60">CLICK TO UPLOAD</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name *" value={name} onChange={setName} placeholder="My Token" maxLength={50} />
              <Field label="Symbol *" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} placeholder="TKN" maxLength={10} />
            </div>

            <div>
              <label className="block text-[11px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="What's your token about?"
                className="w-full px-3 py-2 border-2 border-pop-ink bg-pop-cream/50 text-[14px] focus:outline-none focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Twitter" value={twitter} onChange={setTwitter} placeholder="https://x.com/…" />
              <Field label="Telegram" value={telegram} onChange={setTelegram} placeholder="https://t.me/…" />
              <Field label="Website" value={website} onChange={setWebsite} placeholder="https://…" />
            </div>

            <div>
              <label className="block text-[11px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink mb-1.5">
                Initial Dev Buy (ETH) <span className="text-pop-ink/50 normal-case">— optional</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={initialBuy}
                onChange={(e) => setInitialBuy(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border-2 border-pop-ink bg-pop-cream/50 text-[14px] focus:outline-none focus:bg-white"
              />
              <p className="text-[11px] text-pop-ink/60 mt-1">
                Buys tokens for yourself in the same tx (anti-snipe).
              </p>
            </div>

            <div className="border-t-2 border-pop-ink/10 pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 font-bold text-[14px] px-4 py-3 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[4px_4px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {step || "Launching…"}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" strokeWidth={3} />
                    {authenticated ? "Launch Token" : "Connect & Launch"}
                  </>
                )}
              </button>
              <p className="text-[11px] text-pop-ink/60 text-center mt-3 font-pop-mono">
                ETH MAINNET · Gas paid by you · 1% trading fee on the curve
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 border-2 border-pop-ink bg-pop-cream/50 text-[14px] focus:outline-none focus:bg-white"
      />
    </div>
  );
}
