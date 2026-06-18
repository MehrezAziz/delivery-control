"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSupportTicketLive } from "@/hooks/use-support-ticket-live";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Headphones,
  MessageSquare,
  Send,
  Lock,
  Unlock,
  Shield,
  Bot,
} from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  senderType: "USER" | "CUSTOMER_SERVICE" | "ADMIN" | "BOT";
  content: string;
  image: string | null;
  timestamp: string;
  readAt: string | null;
}

interface Ticket {
  id: string;
  userId: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdAt: string;
  assignedTo: string | null;
  user: { id: string; firstName: string | null; secondName: string | null; role: string; phone: string | null };
  customerService: { superUser: { pseudo: string } } | null;
  messages: Message[];
  _locked?: boolean;
  _viewerRole?: string;
}

function priorityClass(priority: string) {
  if (priority === "HIGH" || priority === "URGENT") return "bg-red-500/20 text-red-100 border-red-400/30";
  if (priority === "MEDIUM") return "bg-amber-500/20 text-amber-100 border-amber-400/30";
  return "bg-white/15 text-white border-white/20";
}

export default function AdminSupportChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/cs/support/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setTicket(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const routeTicketId = Array.isArray(id) ? id[0] : id;
  useSupportTicketLive(routeTicketId, loadTicket);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/cs/support/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setMessage("");
      await loadTicket();
    } catch (e: any) {
      console.error("Send error:", e);
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    await fetch(`/api/cs/support/${id}/close`, { method: "PATCH" });
    await loadTicket();
  }

  async function handleReopen() {
    await fetch(`/api/cs/support/${id}/reopen`, { method: "PATCH" });
    await loadTicket();
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-sky-50/50 via-background to-background dark:from-sky-950/10">
        <div className="max-w-[1400px] mx-auto space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-[calc(100vh-14rem)] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-lg mx-auto border-red-200">
        <CardContent className="py-8">
          <p className="text-sm text-red-500 text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!ticket) return null;

  const isClosed = ticket.status === "CLOSED";
  const userName = [ticket.user.firstName, ticket.user.secondName].filter(Boolean).join(" ") || "User";

  function getSenderLabel(msg: Message) {
    if (msg.senderType === "BOT") return "Assistant";
    if (msg.senderType === "ADMIN") return "Admin";
    if (msg.senderType === "CUSTOMER_SERVICE") return ticket?.customerService?.superUser?.pseudo || "CS Agent";
    if (msg.senderType === "USER") return userName;
    return "User";
  }

  function getSenderBadgeVariant(senderType: string): "default" | "secondary" | "destructive" | "outline" {
    if (senderType === "BOT") return "secondary";
    if (senderType === "ADMIN") return "destructive";
    if (senderType === "CUSTOMER_SERVICE") return "default";
    return "outline";
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-sky-50/50 via-background to-background dark:from-sky-950/10 flex flex-col">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col flex-1 min-h-0 space-y-4">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-600 via-blue-600 to-slate-700 text-white shadow-lg shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/support")}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                    "bg-white/15 text-white border-white/20 hover:bg-white/25",
                  )}
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Back to support
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                  <Headphones className="h-5 w-5 opacity-90" />
                  <h1 className="text-xl sm:text-2xl font-bold">{userName}</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/15 text-white border-white/20">{ticket.user.role}</Badge>
                  <Badge className={cn("border", priorityClass(ticket.priority))}>{ticket.priority}</Badge>
                  <Badge className={cn("border", isClosed ? "bg-white/10 text-white/80" : "bg-emerald-500/20 text-emerald-100 border-emerald-400/30")}>
                    {isClosed ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                    {ticket.status.replace("_", " ")}
                  </Badge>
                  <Badge className="bg-red-500/80 text-white border-red-400/30">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin view
                  </Badge>
                </div>
                <p className="text-sky-100 text-xs">
                  {ticket.category.replace(/_/g, " ")} · Assigned: {ticket.customerService?.superUser.pseudo || "Unassigned"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {isClosed ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/15 text-white border-white/20 hover:bg-white/25"
                    onClick={handleReopen}
                  >
                    <Unlock className="h-3.5 w-3.5 mr-1.5" />
                    Reopen
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={handleClose}>
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Close ticket
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-3 divide-x divide-white/15">
            <div className="px-4 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-sky-200">Messages</p>
              <p className="text-lg font-bold tabular-nums">{ticket.messages.length}</p>
            </div>
            <div className="px-4 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-sky-200">Category</p>
              <p className="text-xs font-semibold mt-0.5 truncate px-1">{ticket.category.replace(/_/g, " ")}</p>
            </div>
            <div className="px-4 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-sky-200">Opened</p>
              <p className="text-xs font-semibold mt-0.5">{new Date(ticket.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col min-h-0 border-sky-200/50 dark:border-sky-800/30 shadow-sm">
          <div className="h-0.5 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 shrink-0" />
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50/50 dark:from-sky-950/30 dark:to-blue-950/20 p-4">
              <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 mb-2">
                <MessageSquare className="h-4 w-4" />
                <span className="font-semibold text-sm">Original request</span>
              </div>
              <p className="text-sm text-sky-900 dark:text-sky-100">{ticket.description}</p>
              <p className="text-xs text-muted-foreground mt-2">{new Date(ticket.createdAt).toLocaleString()}</p>
            </div>

            {ticket.messages.map((msg) => {
              const isStaff = msg.senderType === "CUSTOMER_SERVICE" || msg.senderType === "ADMIN";
              const isBot = msg.senderType === "BOT";
              return (
                <div key={msg.id} className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                      isStaff
                        ? msg.senderType === "ADMIN"
                          ? "bg-gradient-to-br from-red-800 to-red-900 text-white rounded-br-sm"
                          : "bg-gradient-to-br from-zinc-800 to-zinc-900 text-white rounded-br-sm"
                        : isBot
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-bl-sm"
                          : "bg-card border rounded-bl-sm",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isBot && <Bot className="h-3 w-3 text-emerald-600" />}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          isStaff ? "text-zinc-300" : isBot ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
                        )}
                      >
                        {getSenderLabel(msg)}
                      </span>
                      <Badge variant={getSenderBadgeVariant(msg.senderType)} className="text-[9px] px-1 py-0 h-4">
                        {isBot ? "BOT" : msg.senderType}
                      </Badge>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <div className={cn("text-[10px] mt-1.5", isStaff ? "text-zinc-400 text-right" : "text-muted-foreground")}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </CardContent>

          {isClosed ? (
            <div className="p-4 bg-muted/50 text-center text-sm text-muted-foreground border-t flex items-center justify-center gap-2 shrink-0">
              <Lock className="h-4 w-4" />
              Ticket is closed. Reopen to continue chatting.
            </div>
          ) : (
            <div className="p-3 border-t bg-muted/20 flex gap-2 shrink-0">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message as Admin..."
                className="resize-none min-h-[44px] max-h-[120px] bg-background"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="self-end bg-red-700 hover:bg-red-800 shrink-0"
              >
                {sending ? "..." : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
