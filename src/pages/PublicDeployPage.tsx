import { EthContractsDeployPanel } from "@/components/admin/EthContractsDeployPanel";

export default function PublicDeployPage() {
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold uppercase tracking-wider">
            PopShiba · Mainnet Contract Deployer
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            ⚠️ TEMPORARY public route — remove after deployment is complete.
          </p>
        </div>
        <EthContractsDeployPanel />
      </div>
    </div>
  );
}
