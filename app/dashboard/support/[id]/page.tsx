"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSupportTicketLive } from "@/hooks/use-support-ticket-live";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setTicket(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [id]);

  const routeTicketId = Array.isArray(id) ? id[0] : id;
  useSupportTicketLive(routeTicketId, loadTicket);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ticket?.messages]);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/cs/support/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setMessage("");
      await loadTicket();
    } catch (e: any) { console.error("Send error:", e); }
    finally { setSending(false); }
  }

  async function handleClose() {
    await fetch(`/api/cs/support/${id}/close`, { method: "PATCH" });
    await loadTicket();
  }

  async function handleReopen() {
    await fetch(`/api/cs/support/${id}/reopen`, { method: "PATCH" });
    await loadTicket();
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return <Card><CardContent className="py-8"><p className="text-sm text-red-500 text-center">{error}</p></CardContent></Card>;
  if (!ticket) return null;

  const isClosed = ticket.status === "CLOSED";

  function getSenderLabel(msg: Message) {
    if (msg.senderType === "BOT") return "Assistant";
    if (msg.senderType === "ADMIN") return "Admin";
    if (msg.senderType === "CUSTOMER_SERVICE") return ticket?.customerService?.superUser?.pseudo || "CS Agent";
    if (msg.senderType === "USER") {
      return [ticket?.user?.firstName, ticket?.user?.secondName].filter(Boolean).join(" ") || "User";
    }
    return "User";
  }

  function getSenderBadgeVariant(senderType: string): "default" | "secondary" | "destructive" | "outline" {
    if (senderType === "BOT") return "secondary";
    if (senderType === "ADMIN") return "destructive";
    if (senderType === "CUSTOMER_SERVICE") return "default";
    return "outline";
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/support")}>← Back</Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{ticket.user.firstName} {ticket.user.secondName}</span>
              <Badge variant="outline">{ticket.user.role}</Badge>
              <Badge>{ticket.status.replace("_", " ")}</Badge>
              <Badge variant="destructive">ADMIN VIEW</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {ticket.category.replace("_", " ")} · {ticket.priority} · Assigned: {ticket.customerService?.superUser.pseudo || "Unassigned"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isClosed ? (
            <Button size="sm" variant="outline" onClick={handleReopen}>Reopen</Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={handleClose}>Close Ticket</Button>
          )}
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-blue-800 mb-1">Original request</div>
            <div className="text-blue-700">{ticket.description}</div>
            <div className="text-xs text-muted-foreground mt-1">{new Date(ticket.createdAt).toLocaleString()}</div>
          </div>

          {ticket.messages.map(msg => {
            const isStaff = msg.senderType === "CUSTOMER_SERVICE" || msg.senderType === "ADMIN";
            const isBot = msg.senderType === "BOT";
            return (
              <div key={msg.id} className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isStaff
                      ? msg.senderType === "ADMIN"
                        ? "bg-red-900 text-white rounded-br-sm"
                        : "bg-zinc-900 text-white rounded-br-sm"
                      : isBot
                        ? "bg-emerald-950/40 border border-emerald-800/60 text-foreground rounded-bl-sm"
                        : "bg-card border rounded-bl-sm"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-medium ${
                        isStaff ? "text-zinc-300" : isBot ? "text-emerald-200" : "text-muted-foreground"
                      }`}
                    >
                      {getSenderLabel(msg)}
                    </span>
                    <Badge variant={getSenderBadgeVariant(msg.senderType)} className="text-[9px] px-1 py-0 h-4">
                      {isBot ? "BOT" : msg.senderType}
                    </Badge>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  <div className={`text-[10px] mt-1 ${isStaff ? "text-zinc-400 text-right" : "text-muted-foreground"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </CardContent>

        {isClosed ? (
          <div className="p-3 bg-muted text-center text-sm text-muted-foreground border-t">
            Ticket is closed. Reopen to continue chatting.
          </div>
        ) : (
          <div className="p-3 border-t flex gap-2">
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type a message as Admin..."
              className="resize-none min-h-[40px] max-h-[120px]"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button onClick={handleSend} disabled={!message.trim() || sending} className="self-end bg-red-700 hover:bg-red-800">
              {sending ? "..." : "Send"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
