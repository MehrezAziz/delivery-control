"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

const SUPPORT_TICKET_EVENT = "dc-company-support-ticket";

function syncSupportSessionStorage(ticketId: string | null) {
  if (typeof sessionStorage === "undefined") return;
  if (ticketId) sessionStorage.setItem("dc_company_support_ticket_id", ticketId);
  else sessionStorage.removeItem("dc_company_support_ticket_id");
  window.dispatchEvent(new Event(SUPPORT_TICKET_EVENT));
}

function CompanySupportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketFromUrl = searchParams.get("ticket");
  const chatFocus = searchParams.get("chat") === "1";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [description, setDescription] = useState("");
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const handledChatQueryRef = useRef(false);

  const chatSectionRef = useRef<HTMLElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatComposerRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  const scrollChatIntoView = useCallback((opts?: { focusInput?: boolean }) => {
    const innerBehavior: ScrollBehavior = opts?.focusInput ? "auto" : "smooth";
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: innerBehavior });
      requestAnimationFrame(() => {
        chatComposerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        });
        if (opts?.focusInput) {
          window.setTimeout(() => {
            chatInputRef.current?.focus({ preventScroll: true });
          }, 200);
        }
      });
    });
  }, []);

  const load = async () => {
    const res = await fetch("/api/company/support", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setTickets(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ticketFromUrl) return;
    if (tickets.some((x) => x.id === ticketFromUrl)) {
      setActiveTicketId(ticketFromUrl);
    }
  }, [ticketFromUrl, tickets]);

  useEffect(() => {
    syncSupportSessionStorage(activeTicketId);
    return () => {
      syncSupportSessionStorage(null);
    };
  }, [activeTicketId]);

  const loadMessages = useCallback(async (ticketId: string) => {
    setMessagesLoaded(false);
    try {
      const res = await fetch(`/api/company/support/${ticketId}/messages`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setMessages(Array.isArray(data) ? data : []);
      }
    } finally {
      setMessagesLoaded(true);
    }
  }, []);

  const markSupportThreadRead = useCallback(() => {
    if (!activeTicketId) return;
    void fetch("/api/company/notifications/thread/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupKey: `support:${activeTicketId}` }),
    })
      .then(() => {
        window.dispatchEvent(new Event("dc-company-notifications-refresh"));
      })
      .catch(() => {});
  }, [activeTicketId]);

  useEffect(() => {
    if (!activeTicketId) return;
    void markSupportThreadRead();
  }, [activeTicketId, messages.length, markSupportThreadRead]);

  /** Deep link from notification (`chat=1`): show last messages + composer + focused input; strip query. */
  useEffect(() => {
    if (!chatFocus || !activeTicketId || !messagesLoaded || handledChatQueryRef.current) return;
    handledChatQueryRef.current = true;
    router.replace(`/company/support?ticket=${encodeURIComponent(activeTicketId)}`, { scroll: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollChatIntoView({ focusInput: true }));
    });
  }, [chatFocus, activeTicketId, messagesLoaded, router, scrollChatIntoView]);

  useEffect(() => {
    handledChatQueryRef.current = false;
  }, [activeTicketId]);

  useEffect(() => {
    if (!activeTicketId || !messagesLoaded) return;
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      chatComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    });
  }, [messages, activeTicketId, messagesLoaded]);

  useEffect(() => {
    if (!activeTicketId) return;
    void loadMessages(activeTicketId);
    const poll = setInterval(() => void loadMessages(activeTicketId), 2000);
    return () => clearInterval(poll);
  }, [activeTicketId, loadMessages]);

  const sendChat = async () => {
    const content = chatInput.trim();
    if (!content || !activeTicketId) return;
    const res = await fetch(`/api/company/support/${activeTicketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to send message");
    setChatInput("");
    await loadMessages(activeTicketId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollChatIntoView({ focusInput: true }));
    });
  };

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
            <button
              key={t.id}
              className="w-full rounded-md border p-3 text-left text-sm"
              onClick={() => setActiveTicketId(t.id)}
            >
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
        <section ref={chatSectionRef} className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Support Chat Room</h2>
          <div
            ref={chatScrollRef}
            className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3 bg-muted/20"
          >
            {messages.map((m) => (
              <div key={m.id} className={`text-sm ${m.senderType === "USER" ? "text-right" : "text-left"}`}>
                <span
                  className={`inline-block max-w-[min(100%,28rem)] rounded-md px-2 py-1 ${
                    m.senderType === "USER" ? "bg-primary text-primary-foreground" : "bg-card border"
                  }`}
                >
                  {m.content}
                </span>
              </div>
            ))}
            {messages.length === 0 && messagesLoaded && (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
          </div>
          <div ref={chatComposerRef} className="mt-3 flex scroll-mt-4 gap-2">
            <input
              ref={chatInputRef}
              className="w-full rounded-md border px-3 py-2"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
            />
            <button type="button" className="rounded-md border px-3 py-2" onClick={() => void sendChat()}>
              Send
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function CompanySupportPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading support…</div>}>
      <CompanySupportPageContent />
    </Suspense>
  );
}
