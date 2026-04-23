import { useEffect, useState } from 'react';
import { Loader2, Check, ExternalLink, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isLaunching: boolean;
  tokenAddress: string | null;
  launchTxHash: string | null;
  isLive: boolean;
  errorMessage: string | null;
  name?: string;
  ticker?: string;
  /** Called when user dismisses the overlay (only allowed once finished). */
  onClose?: () => void;
}

/**
 * Full-screen launch status overlay — PopShiba brand style.
 * Pure mono terminal look: bg #0d0d0f, primary #80ff00 (lime), IBM Plex Mono.
 * Uses inline styles so the look is identical whether rendered inside the
 * Popshiba landing iframe (which has its own CSS) or the React app.
 */
export function EthLaunchOverlay({
  isLaunching,
  tokenAddress,
  launchTxHash,
  isLive,
  errorMessage,
  name,
  ticker,
  onClose,
}: Props) {
  const [stage, setStage] = useState<'preparing' | 'signing' | 'mining' | 'live' | 'failed'>('preparing');

  useEffect(() => {
    if (errorMessage) setStage('failed');
    else if (isLive) setStage('live');
    else if (launchTxHash) setStage('mining');
    else if (isLaunching) setStage((s) => (s === 'preparing' || s === 'signing' ? s : 'preparing'));
  }, [isLaunching, launchTxHash, isLive, errorMessage]);

  useEffect(() => {
    if (!isLaunching || stage !== 'preparing') return;
    const t = setTimeout(() => setStage((s) => (s === 'preparing' ? 'signing' : s)), 1800);
    return () => clearTimeout(t);
  }, [isLaunching, stage]);

  const visible = isLaunching || isLive || !!errorMessage;
  if (!visible) return null;

  const headline =
    stage === 'failed' ? 'Launch failed' :
    stage === 'live'   ? '>> Your coin is live' :
    stage === 'mining' ? 'Your coin is launching…' :
    stage === 'signing'? 'Approve in your wallet' :
                         'Preparing your launch';

  const subline =
    stage === 'failed' ? errorMessage :
    stage === 'live'   ? 'Pool seeded · LP burned · Tradeable now' :
    stage === 'mining' ? 'Cloning the token, creating the Uniswap pool, seeding LP. Confirms in 15–45s.' :
    stage === 'signing'? "MetaMask / Rabby should be open. If you don't see it, click your wallet icon in the browser toolbar." :
                         'Fetching launcher parameters and simulating the transaction.';

  const finished = stage === 'live' || stage === 'failed';
  // PopShiba brand palette (matches landing page / top nav)
  const PRIMARY = '#f5a524';   // pop-orange
  const INK = '#0d0d0f';       // pop-ink
  const CREAM = '#f5e6c8';     // pop-cream
  const DANGER = '#e23a3a';
  const FONT = '"Archivo Black", "Inter", system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  const copyAddress = () => {
    if (!tokenAddress) return;
    navigator.clipboard.writeText(tokenAddress);
    toast.success('Contract address copied');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        fontFamily: FONT,
      }}
      role="dialog"
      aria-live="polite"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: BG,
          border: `1px solid ${PRIMARY}`,
          boxShadow: `0 0 0 1px ${PRIMARY}22, 0 30px 80px -20px ${PRIMARY}33`,
          padding: 28,
          color: '#e6e6e6',
          fontFamily: FONT,
          fontSize: 12,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${PRIMARY}33`,
            paddingBottom: 10,
            marginBottom: 18,
            color: PRIMARY,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <span>popshiba.exe</span>
          <span style={{ opacity: 0.6 }}>{stage === 'failed' ? 'aborted' : finished ? 'ok' : 'running…'}</span>
        </div>

        {/* Status icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          {stage === 'failed' ? (
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '1px solid #ff5c5c', background: 'rgba(255,92,92,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <AlertCircle style={{ width: 28, height: 28, color: '#ff5c5c' }} />
            </div>
          ) : stage === 'live' ? (
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: `1px solid ${PRIMARY}`, background: `${PRIMARY}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 24px ${PRIMARY}55`,
              }}
            >
              <Check style={{ width: 28, height: 28, color: PRIMARY }} />
            </div>
          ) : (
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: `1px solid ${PRIMARY}`, background: `${PRIMARY}1a`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 24px ${PRIMARY}33`,
              }}
            >
              <Loader2 style={{ width: 28, height: 28, color: PRIMARY }} className="animate-spin" />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 20,
                fontWeight: 700,
                color: PRIMARY,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              {headline}
            </h2>
            {(name || ticker) && stage !== 'failed' && (
              <div style={{ fontSize: 11, color: '#9a9a9a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {name}{ticker ? ` · $${ticker}` : ''}
              </div>
            )}
            <p style={{ fontSize: 12, color: '#bdbdbd', lineHeight: 1.6, marginTop: 6, marginBottom: 0 }}>
              {subline}
            </p>
          </div>
        </div>

        {/* Stepper */}
        {stage !== 'failed' && (
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'signing',   label: '> wallet approval' },
              { id: 'mining',    label: '> confirming on ethereum' },
              { id: 'live',      label: '> token live · ca revealed' },
            ].map((step) => {
              const order = ['preparing', 'signing', 'mining', 'live'];
              const stepIdx = order.indexOf(step.id);
              const curIdx = order.indexOf(stage);
              const done = curIdx > stepIdx;
              const active = curIdx === stepIdx;
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                  <div
                    style={{
                      width: 18, height: 18, flexShrink: 0,
                      border: `1px solid ${done || active ? PRIMARY : '#333'}`,
                      background: done ? `${PRIMARY}33` : active ? `${PRIMARY}1a` : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: done || active ? PRIMARY : '#666',
                    }}
                  >
                    {done ? (
                      <Check style={{ width: 11, height: 11 }} />
                    ) : active ? (
                      <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
                    ) : (
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                    )}
                  </div>
                  <span style={{ color: done || active ? '#e6e6e6' : '#7a7a7a', textTransform: 'lowercase', letterSpacing: '0.04em' }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Etherscan link as soon as we have a tx hash */}
        {launchTxHash && stage !== 'live' && (
          <a
            href={`https://etherscan.io/tx/${launchTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center', marginTop: 18,
              fontSize: 11, color: PRIMARY, textDecoration: 'none',
              borderTop: `1px dashed ${PRIMARY}44`, paddingTop: 12,
            }}
          >
            view tx on etherscan ↗
          </a>
        )}

        {/* CA reveal */}
        {tokenAddress && stage === 'live' && (
          <div
            style={{
              marginTop: 20, padding: 14,
              border: `1px solid ${PRIMARY}`, background: `${PRIMARY}10`,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: PRIMARY, marginBottom: 8 }}>
              contract address
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ flex: 1, fontSize: 12, color: '#e6e6e6', wordBreak: 'break-all', fontFamily: FONT }}>
                {tokenAddress}
              </code>
              <button
                onClick={copyAddress}
                style={{
                  width: 32, height: 32, flexShrink: 0,
                  background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: PRIMARY,
                }}
                title="Copy"
              >
                <Copy style={{ width: 13, height: 13 }} />
              </button>
              <a
                href={`https://etherscan.io/token/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  height: 32, padding: '0 10px', flexShrink: 0,
                  background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}66`,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, color: PRIMARY, textDecoration: 'none',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}
              >
                etherscan
                <ExternalLink style={{ width: 11, height: 11 }} />
              </a>
            </div>
          </div>
        )}

        {/* Footer / dismiss */}
        {finished && onClose && (
          <button
            onClick={onClose}
            style={{
              width: '100%', marginTop: 20, height: 44,
              background: PRIMARY, color: '#0d0d0f',
              border: 'none', cursor: 'pointer',
              fontFamily: FONT, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 13,
            }}
          >
            {stage === 'live' ? 'view my token' : 'close'}
          </button>
        )}
        {!finished && (
          <p style={{
            fontSize: 10, textAlign: 'center', marginTop: 18,
            color: '#666', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 0,
          }}>
            don't close this window
          </p>
        )}
      </div>
    </div>
  );
}
