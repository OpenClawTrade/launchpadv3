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
        background: 'rgba(13,13,15,0.78)',
        backdropFilter: 'blur(6px)',
        fontFamily: FONT,
      }}
      role="dialog"
      aria-live="polite"
      onClick={(e) => {
        if (finished && onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: PRIMARY,
          border: `3px solid ${INK}`,
          boxShadow: `8px 8px 0 ${INK}`,
          padding: 0,
          color: INK,
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
            background: INK,
            color: PRIMARY,
            padding: '10px 18px',
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <span>POPSHIBA · LAUNCH</span>
          {finished && onClose ? (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: PRIMARY,
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: 0,
                fontWeight: 700,
              }}
              aria-label="Close"
            >
              {stage === 'failed' ? 'close ✕' : 'ok ✕'}
            </button>
          ) : (
            <span style={{ opacity: 0.85 }}>running…</span>
          )}
        </div>

        <div style={{ padding: 28 }}>
          {/* Status icon */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
            {stage === 'failed' ? (
              <div
                style={{
                  width: 60, height: 60,
                  border: `3px solid ${INK}`, background: CREAM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `4px 4px 0 ${INK}`,
                }}
              >
                <AlertCircle style={{ width: 30, height: 30, color: DANGER }} />
              </div>
            ) : stage === 'live' ? (
              <div
                style={{
                  width: 60, height: 60,
                  border: `3px solid ${INK}`, background: CREAM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `4px 4px 0 ${INK}`,
                }}
              >
                <Check style={{ width: 30, height: 30, color: INK }} />
              </div>
            ) : (
              <div
                style={{
                  width: 60, height: 60,
                  border: `3px solid ${INK}`, background: CREAM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `4px 4px 0 ${INK}`,
                }}
              >
                <Loader2 style={{ width: 30, height: 30, color: INK }} className="animate-spin" />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              <h2
                style={{
                  fontFamily: FONT,
                  fontSize: 24,
                  fontWeight: 900,
                  color: INK,
                  letterSpacing: '-0.01em',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                {headline}
              </h2>
              {(name || ticker) && stage !== 'failed' && (
                <div style={{ fontFamily: MONO, fontSize: 11, color: INK, opacity: 0.75, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {name}{ticker ? ` · $${ticker}` : ''}
                </div>
              )}
              <p style={{ fontFamily: MONO, fontSize: 12, color: INK, opacity: 0.85, lineHeight: 1.55, marginTop: 8, marginBottom: 0 }}>
                {subline}
              </p>
            </div>
          </div>

          {/* Stepper */}
          {stage !== 'failed' && (
            <div style={{
              marginTop: 22,
              padding: 14,
              background: CREAM,
              border: `2px solid ${INK}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {[
                { id: 'signing',   label: '> wallet approval' },
                { id: 'mining',    label: '> confirming on ethereum' },
                { id: 'live',      label: '> token live · ca revealed' },
              ].map((step) => {
                const order = ['preparing', 'signing', 'mining', 'live'];
                const stepIdx = order.indexOf(step.id);
                const curIdx = order.indexOf(stage);
                const done = curIdx > stepIdx || (stage === 'live' && step.id === 'live');
                const active = curIdx === stepIdx && !done;
                return (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 12 }}>
                    <div
                      style={{
                        width: 18, height: 18, flexShrink: 0,
                        border: `2px solid ${INK}`,
                        background: done ? INK : active ? PRIMARY : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: done ? PRIMARY : INK,
                      }}
                    >
                      {done ? (
                        <Check style={{ width: 11, height: 11 }} />
                      ) : active ? (
                        <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
                      ) : null}
                    </div>
                    <span style={{ color: INK, opacity: done || active ? 1 : 0.5, textTransform: 'lowercase', letterSpacing: '0.04em' }}>
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
                display: 'block', textAlign: 'center', marginTop: 14,
                fontFamily: MONO, fontSize: 11, color: INK, textDecoration: 'underline',
                fontWeight: 700,
              }}
            >
              View tx on Etherscan ↗
            </a>
          )}

          {/* CA reveal */}
          {tokenAddress && stage === 'live' && (
            <div
              style={{
                marginTop: 18, padding: 14,
                border: `2px solid ${INK}`, background: CREAM,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK, marginBottom: 8, fontWeight: 700 }}>
                Contract Address
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: INK, wordBreak: 'break-all' }}>
                  {tokenAddress}
                </code>
                <button
                  onClick={copyAddress}
                  style={{
                    width: 34, height: 34, flexShrink: 0,
                    background: PRIMARY, border: `2px solid ${INK}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: INK,
                    boxShadow: `2px 2px 0 ${INK}`,
                  }}
                  title="Copy"
                >
                  <Copy style={{ width: 14, height: 14 }} />
                </button>
                <a
                  href={`https://etherscan.io/token/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    height: 34, padding: '0 10px', flexShrink: 0,
                    background: PRIMARY, border: `2px solid ${INK}`,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK, textDecoration: 'none',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    boxShadow: `2px 2px 0 ${INK}`,
                  }}
                >
                  Etherscan
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
                width: '100%', marginTop: 20, height: 48,
                background: INK, color: PRIMARY,
                border: `2px solid ${INK}`, cursor: 'pointer',
                fontFamily: FONT, fontWeight: 900,
                textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 14,
                boxShadow: `4px 4px 0 ${CREAM}`,
              }}
            >
              {stage === 'live' ? 'View my token' : 'Close'}
            </button>
          )}
          {!finished && (
            <p style={{
              fontFamily: MONO,
              fontSize: 10, textAlign: 'center', marginTop: 18,
              color: INK, opacity: 0.7, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 0,
            }}>
              Don't close this window
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
