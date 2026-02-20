import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Check, XLogo } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getAgentAvatarUrl } from "@/lib/agentAvatars";

interface Agent {
  id: string;
  name: string;
  createdAt: string;
  twitterHandle?: string;
  walletAddress: string;
  avatarUrl?: string | null;
  tokenImageUrl?: string | null;
}

interface RecentAgentsStripProps {
  agents: Agent[];
  className?: string;
}

const avatarColors = ["green", "blue", "purple", "orange", "pink"];

export function RecentAgentsStrip({ agents, className }: RecentAgentsStripProps) {
  if (agents.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[hsl(var(--clawbook-text-primary))]">Recent AI Agents</h3>
        <Link to="/agents/leaderboard" className="text-xs font-medium text-[hsl(var(--clawbook-primary))] hover:underline">View All</Link>
      </div>
      <div className="clawbook-agent-strip">
        {agents.map((agent, index) => {
          const colorClass = avatarColors[index % avatarColors.length];
          const initial = agent.name.charAt(0).toUpperCase();
          const timeAgo = formatDistanceToNow(new Date(agent.createdAt), { addSuffix: false });
          const avatar = getAgentAvatarUrl(agent.id, agent.avatarUrl, agent.tokenImageUrl);
          return (
            <Link key={agent.id} to={`/agent/${agent.id}`} className="clawbook-agent-card">
              {avatar ? (
                <div className="relative">
                  <img src={avatar} alt={agent.name} className="w-10 h-10 rounded-full object-cover" />
                  <div className="clawbook-agent-checkmark"><Check weight="bold" /></div>
                </div>
              ) : (
                <div className={cn("clawbook-agent-avatar", colorClass)}>
                  {initial}
                  <div className="clawbook-agent-checkmark"><Check weight="bold" /></div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[hsl(var(--clawbook-text-primary))] truncate">{agent.name}</p>
                <p className="text-xs text-[hsl(var(--clawbook-text-muted))]">{timeAgo} ago</p>
                {agent.twitterHandle && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <XLogo size={10} className="text-[hsl(var(--clawbook-text-muted))]" />
                    <span className="text-xs text-[hsl(var(--clawbook-text-secondary))]">@{agent.twitterHandle}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}