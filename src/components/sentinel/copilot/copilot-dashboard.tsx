"use client";

import * as React from "react";
import { Brain, Send, Loader2, MessageSquare, Sparkles, Database, ChevronRight, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  retrievedData?: any;
  referencedEntities?: string[];
  referencedEvents?: string[];
  processingMs?: number;
}

const SUGGESTED_QUERIES = [
  "Show illegal mining near Pra River.",
  "Why is the cyanide spill event high confidence?",
  "What's the risk to Atewa Forest?",
  "Explain the sediment prediction for the Offin River.",
  "Which areas have the highest hotspot probability?",
  "What did the AI detect in the satellite imagery?",
  "How many intelligence events are open?",
  "What's the fused confidence for the Prestea cyanide spill?",
];

export function CopilotDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendQuery = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversationId }),
      });

      if (res.ok) {
        const data = await res.json();
        setConversationId(data.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            retrievedData: data.retrievedData,
            referencedEntities: data.referencedEntities,
            referencedEvents: data.referencedEvents,
            processingMs: data.processingMs,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "I couldn't process that query. Please try rephrasing your question." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/copilot/summary", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <CopilotKpi icon={MessageSquare} label="Conversations" value={summary.totalConversations ?? 0} />
        <CopilotKpi icon={Brain} label="Messages" value={summary.totalMessages ?? 0} />
        <CopilotKpi icon={Sparkles} label="Avg Response" value={summary.avgProcessingMs ? `${(summary.avgProcessingMs / 1000).toFixed(1)}s` : "—"} />
        <CopilotKpi icon={Database} label="Data Sources" value={8} hint="twin/events/CV/fusion/predictions/hotspots/observations/satellite" />
      </div>

      {/* Chat interface */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Digital Twin AI Copilot</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">Real LLM · z-ai-web-dev-sdk</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Messages */}
            <div ref={scrollRef} className="max-h-[400px] min-h-[300px] space-y-3 overflow-y-auto -mr-2 pr-2">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="h-12 w-12 text-primary/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Ask me anything about the Digital Twin</p>
                  <p className="text-[11px] text-muted-foreground mt-1">I can query mines, rivers, forests, events, predictions, and more</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Brain className="h-4 w-4" />
                    </div>
                  )}
                  <div className={cn("max-w-[80%] rounded-lg p-3", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border")}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && msg.retrievedData && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <div className="flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
                          {msg.processingMs && <span>{(msg.processingMs / 1000).toFixed(1)}s</span>}
                          {msg.referencedEntities && msg.referencedEntities.length > 0 && <span>· {msg.referencedEntities.length} entities</span>}
                          {msg.referencedEvents && msg.referencedEvents.length > 0 && <span>· {msg.referencedEvents.length} events</span>}
                          {msg.retrievedData && Object.keys(msg.retrievedData).length > 0 && (
                            <span>· data: {Object.keys(msg.retrievedData).join(", ")}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <Separator className="my-3" />
            <form onSubmit={(e) => { e.preventDefault(); sendQuery(input); }} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about mines, rivers, forests, predictions, confidence..."
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Suggested queries */}
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Suggested Queries</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuery(q)}
                  disabled={loading}
                  className="flex w-full items-start gap-2 rounded-md border border-border/60 bg-card/40 p-2 text-left text-[11px] hover:bg-accent/50 transition-colors disabled:opacity-50"
                >
                  <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">What I Can Do</p>
              {[
                { icon: Database, label: "Query Digital Twin", desc: "Find mines, rivers, forests, communities" },
                { icon: Brain, label: "Explain Confidence", desc: "Break down fusion scores and reasoning" },
                { icon: Sparkles, label: "Interpret Predictions", desc: "Explain risk scores and hotspots" },
                { icon: MessageSquare, label: "Summarize Events", desc: "Get overviews of intelligence events" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded border border-border/40 bg-card/30 p-2">
                  <f.icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium">{f.label}</p>
                    <p className="text-[8px] text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CopilotKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {hint && <span className="text-[9px] text-muted-foreground uppercase">{hint}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
