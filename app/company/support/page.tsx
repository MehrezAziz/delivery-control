"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { connectSocket, getSocket } from "@/lib/socket";

type Ticket = {
  id: string;
  status: string;
  priority: string;
  description: string;
  createdAt: string;
};
type TicketMessage = {
  id: string;
  senderType: string;
  content: string;
  timestamp: string;
};

export default function CompanySupportPage() {
  const searchParams = useSearchParams();
  const ticketFromUrl = searchParams.get("ticket");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [description, setDescription] = useState("");
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/company/support", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setTickets(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ticketFromUrl) return;
    if (tickets.some((x) => x.id === ticketFromUrl)) {
      setActiveTicketId(ticketFromUrl);
    }
  }, [ticketFromUrl, tickets]);

  const loadMessages = async (ticketId: string) => {
    const res = await fetch(`/api/company/support/${ticketId}/messages`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setMessages(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!activeTicketId) return;
    const initialFetch = setTimeout(() => {
      void loadMessages(activeTicketId);
    }, 0);
    const onNotif = (n: { relatedEntityType?: string; relatedEntityId?: string; type?: string }) => {
      const isSupportNotif =
        n?.relatedEntityType === "SupportTicket" && n?.relatedEntityId === activeTicketId;
      if (isSupportNotif) void loadMessages(activeTicketId);
    };
    let cancelled = false;
    async function initSocket() {
      try {
        const meRes = await fetch("/api/company-auth/me", { cache: "no-store" });
        if (!meRes.ok) return;
        const me = await meRes.json().catch(() => null);
        if (!me?.token || cancelled) return;
        const socket = connectSocket(String(me.token));
        socket.on("notification", onNotif);
      } catch {
        // ignore transient socket init errors
      }
    }
    void initSocket();
    return () => {
      cancelled = true;
      clearTimeout(initialFetch);
      const socket = getSocket();
      socket?.off("notification", onNotif);
    };
  }, [activeTicketId]);

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-xl border p-4">
        <h2 className="mb-2 text-lg font-semibold">Customer Service Support</h2>
        <textarea
          className="min-h-28 w-full rounded-md border px-3 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your issue..."
        />
        <button
          className="mt-3 rounded-md border px-3 py-2"
          onClick={async () => {
            const res = await fetch("/api/company/support", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description }),
            });
            const data = await res.json();
            if (!res.ok) return setMessage(data?.error || "Failed to send support request");
            setDescription("");
            setMessage("Support request sent.");
            await load();
          }}
        >
          Request support
        </button>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">My Support Tickets</h2>
        <div className="space-y-2">
          {tickets.map((t) => (
            <button key={t.id} className="w-full rounded-md border p-3 text-left text-sm" onClick={() => setActiveTicketId(t.id)}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{t.id}</p>
                <p>{t.status}</p>
              </div>
              <p className="text-muted-foreground">{t.description}</p>
            </button>
          ))}
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">No support tickets yet.</p>}
        </div>
      </section>

      {activeTicketId && (
        <section className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Support Chat Room</h2>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
            {messages.map((m) => (
              <div key={m.id} className={`text-sm ${m.senderType === "USER" ? "text-right" : "text-left"}`}>
                <span className={`inline-block rounded-md px-2 py-1 ${m.senderType === "USER" ? "bg-primary/10" : "bg-muted"}`}>
                  {m.content}
                </span>
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded-md border px-3 py-2"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
            />
            <button
              className="rounded-md border px-3 py-2"
              onClick={async () => {
                const content = chatInput.trim();
                if (!content) return;
                const res = await fetch(`/api/company/support/${activeTicketId}/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content }),
                });
                const data = await res.json();
                if (!res.ok) return setMessage(data?.error || "Failed to send message");
                setChatInput("");
                await loadMessages(activeTicketId);
              }}
            >
              Send
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
