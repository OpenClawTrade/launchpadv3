import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface CountdownTimer {
  id: string;
  target_time: string;
  title: string;
  is_active: boolean;
}

function useCountdown(targetTime: Date | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!targetTime) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = targetTime.getTime();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return { timeLeft, isExpired };
}

export default function TradePage() {
  const [timer, setTimer] = useState<CountdownTimer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTimer() {
      const { data, error } = await supabase
        .from("countdown_timers")
        .select("*")
        .eq("id", "trade_launch")
        .maybeSingle();

      if (error) {
        console.error("Error fetching countdown:", error);
      }

      if (data) {
        setTimer(data as CountdownTimer);
      }
      setIsLoading(false);
    }

    fetchTimer();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("countdown-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "countdown_timers",
          filter: "id=eq.trade_launch",
        },
        (payload) => {
          if (payload.new) {
            setTimer(payload.new as CountdownTimer);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const targetTime = timer?.target_time ? new Date(timer.target_time) : null;
  const { timeLeft, isExpired } = useCountdown(targetTime);

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-card border border-border rounded-xl w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shadow-lg">
        <span className="text-3xl sm:text-4xl font-bold text-primary">
          {value.toString().padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs sm:text-sm text-muted-foreground mt-2 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gate-header">
        <div className="gate-header-inner">
          <Link to="/" className="gate-logo" aria-label="Claw Mode">
            <img
              src="/claw-logo.png"
              alt="Claw Mode"
              className="h-8 w-8 rounded-lg object-cover"
              loading="eager"
            />
            <span className="text-lg font-bold">Claw Mode</span>
          </Link>

          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
        <Card className="gate-card max-w-2xl w-full p-8 sm:p-12 text-center">
          {isLoading ? (
            <div className="animate-pulse space-y-6">
              <div className="h-10 bg-muted rounded w-3/4 mx-auto" />
              <div className="flex justify-center gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-20 h-20 bg-muted rounded-xl" />
                ))}
              </div>
            </div>
          ) : isExpired ? (
            <div className="space-y-6">
              <Rocket className="h-16 w-16 text-primary mx-auto animate-bounce" />
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                Trading is Live!
              </h1>
              <p className="text-muted-foreground text-lg">
                Start trading now on Claw Mode
              </p>
              <Link to="/">
                <Button size="lg" className="mt-4">
                  Start Trading
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-2">
                <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  {timer?.title || "Trading goes Live"}
                </h1>
                <p className="text-muted-foreground text-lg">
                  Get ready for the launch
                </p>
              </div>

              {/* Countdown Timer */}
              <div className="flex justify-center gap-3 sm:gap-6">
                <TimeBlock value={timeLeft.days} label="Days" />
                <TimeBlock value={timeLeft.hours} label="Hours" />
                <TimeBlock value={timeLeft.minutes} label="Minutes" />
                <TimeBlock value={timeLeft.seconds} label="Seconds" />
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Stay tuned! Trading will be available soon.
                </p>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
