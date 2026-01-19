import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowsClockwise, CheckCircle, ShieldCheck } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface MathCaptchaProps {
  onVerified: (verified: boolean) => void;
  className?: string;
}

function generateChallenge() {
  const operations = ['+', '-', '×'] as const;
  const op = operations[Math.floor(Math.random() * operations.length)];
  
  let a: number, b: number, answer: number;
  
  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * a);
      answer = a - b;
      break;
    case '×':
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      answer = a * b;
      break;
  }
  
  return { question: `${a} ${op} ${b}`, answer };
}

export function MathCaptcha({ onVerified, className }: MathCaptchaProps) {
  const [challenge, setChallenge] = useState(generateChallenge);
  const [userAnswer, setUserAnswer] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const refreshChallenge = useCallback(() => {
    setChallenge(generateChallenge());
    setUserAnswer('');
    setError(false);
  }, []);

  // Reset verification if challenge changes externally
  useEffect(() => {
    if (verified) {
      onVerified(true);
    }
  }, [verified, onVerified]);

  const handleVerify = () => {
    const parsed = parseInt(userAnswer.trim(), 10);
    if (parsed === challenge.answer) {
      setVerified(true);
      setError(false);
      onVerified(true);
    } else {
      setError(true);
      setAttempts(prev => prev + 1);
      // Generate new challenge after 3 failed attempts
      if (attempts >= 2) {
        refreshChallenge();
        setAttempts(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerify();
    }
  };

  if (verified) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30",
        className
      )}>
        <CheckCircle weight="fill" className="w-5 h-5 text-green-500" />
        <span className="text-sm text-green-400">Verified - You're human!</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-4 rounded-lg bg-card/50 border border-border space-y-3",
      className
    )}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck weight="bold" className="w-4 h-4 text-primary" />
        <span>Quick verification</span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-bold text-foreground bg-muted px-3 py-1.5 rounded">
              {challenge.question} = ?
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={refreshChallenge}
              title="New challenge"
            >
              <ArrowsClockwise className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={userAnswer}
            onChange={(e) => {
              setUserAnswer(e.target.value);
              setError(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="?"
            className={cn(
              "w-20 text-center font-mono",
              error && "border-red-500 focus-visible:ring-red-500"
            )}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleVerify}
            disabled={!userAnswer.trim()}
          >
            Verify
          </Button>
        </div>
      </div>
      
      {error && (
        <p className="text-xs text-red-400">
          Incorrect answer. {attempts >= 2 ? 'Try this new challenge.' : 'Try again.'}
        </p>
      )}
    </div>
  );
}
