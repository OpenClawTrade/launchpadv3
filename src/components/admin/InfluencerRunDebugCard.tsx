import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ManualRunDebugState =
  | {
      kind: "success";
      startedAt: string;
      finishedAt: string;
      durationMs: number;
      httpStatus: number;
      data: unknown;
      rawText?: string;
    }
  | {
      kind: "error";
      startedAt: string;
      finishedAt: string;
      durationMs: number;
      message: string;
      name?: string;
      httpStatus?: number;
      rawText?: string;
    };

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function InfluencerRunDebugCard({ state }: { state: ManualRunDebugState | null }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Last manual run (debug)</CardTitle>
          {state ? (
            <Badge variant={state.kind === "success" ? "default" : "destructive"}>
              {state.kind === "success" ? "success" : "error"}
            </Badge>
          ) : (
            <Badge variant="secondary">no runs yet</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!state ? (
          <p className="text-sm text-muted-foreground">
            Click <span className="font-medium">Run Now</span> to populate this panel with the exact response.
          </p>
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Started</div>
                <div className="mt-1 text-sm font-mono break-all">{state.startedAt}</div>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Finished</div>
                <div className="mt-1 text-sm font-mono break-all">{state.finishedAt}</div>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="mt-1 text-sm font-semibold">{state.durationMs}ms</div>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">HTTP</div>
                <div className="mt-1 text-sm font-semibold">
                  {"httpStatus" in state && state.httpStatus ? state.httpStatus : "—"}
                </div>
              </div>
            </div>

            {state.kind === "error" && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-sm font-semibold">{state.name ? `${state.name}: ` : ""}{state.message}</div>
              </div>
            )}

            <div className="rounded-md border bg-card p-3">
              <div className="mb-2 text-xs text-muted-foreground">Response body</div>
              <pre className="max-h-[360px] overflow-auto text-xs leading-relaxed">
                {state.kind === "success" ? safeStringify(state.data) : (state.rawText ?? "(no body)")}
              </pre>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
