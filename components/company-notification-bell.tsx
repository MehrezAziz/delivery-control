"use client";



import { useEffect, useState, useRef, useCallback } from "react";

import { Bell } from "lucide-react";

import { useRouter } from "next/navigation";

import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";



type CompanyNotification = {

  id: string;

  title: string;

  body: string;

  sentAt: string;

  readAt: string | null;

  type?: string;

  relatedEntityType?: string;

  relatedEntityId?: string;

};



export function CompanyNotificationBell() {

  const [open, setOpen] = useState(false);

  const [count, setCount] = useState(0);

  const [rows, setRows] = useState<CompanyNotification[]>([]);

  const router = useRouter();

  const wrapRef = useRef<HTMLDivElement>(null);



  const loadCount = useCallback(async () => {

    const res = await fetch("/api/company/notifications/unread-count", { cache: "no-store" });

    const data = await res.json();

    if (res.ok) setCount(Number(data?.count || 0));

  }, []);



  const loadRows = useCallback(async () => {

    const res = await fetch("/api/company/notifications?limit=10&page=1", { cache: "no-store" });

    const data = await res.json();

    if (res.ok) setRows(Array.isArray(data) ? data : []);

  }, []);



  useEffect(() => {

    void loadCount();

    const t = setInterval(() => void loadCount(), 12000);

    return () => clearInterval(t);

  }, [loadCount]);



  useEffect(() => {

    let cancelled = false;

    async function initSocket() {

      try {

        const meRes = await fetch("/api/company-auth/me", { cache: "no-store" });

        if (!meRes.ok) return;

        const me = await meRes.json();

        if (!me?.token || cancelled) return;

        const socket = connectSocket(String(me.token));

        socket.on("notification", (n: CompanyNotification) => {

          const activeChat = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("dc_company_chat_order_id") : null;

          const isMsg =

            n?.type === "NEW_MESSAGE_FROM_DRIVER" ||

            n?.type === "NEW_MESSAGE_FROM_CUSTOMER" ||

            (n?.title || "").toLowerCase().includes("message");

          if (

            isMsg &&

            activeChat &&

            n?.relatedEntityType === "Order" &&

            n?.relatedEntityId === activeChat

          ) {

            if (n?.id) {

              void fetch(`/api/company/notifications/${n.id}/read`, { method: "PATCH" });

            }

            return;

          }

          void loadCount();

        });

      } catch {

        /* ignore */

      }

    }

    void initSocket();

    return () => {

      cancelled = true;

      const s = getSocket();

      s?.off("notification");

      disconnectSocket();

    };

  }, [loadCount, loadRows]);



  useEffect(() => {

    function onDocMouseDown(e: MouseEvent) {

      if (!open) return;

      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {

        setOpen(false);

      }

    }

    document.addEventListener("mousedown", onDocMouseDown);

    return () => document.removeEventListener("mousedown", onDocMouseDown);

  }, [open]);



  const toggle = () => {

    setOpen((v) => {

      const next = !v;

      if (next) void loadRows();

      return next;

    });

  };



  return (

    <div className="relative" ref={wrapRef}>

      <button type="button" className="relative rounded-md border px-2 py-1" aria-expanded={open} onClick={toggle}>

        <Bell className="h-4 w-4" />

        {count > 0 && (

          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[10px] text-white">

            {count > 99 ? "99+" : count}

          </span>

        )}

      </button>

      {open && (

        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-popover shadow-lg">

          <div className="flex items-center justify-between border-b px-3 py-2">

            <span className="text-sm font-semibold">Notifications</span>

            <button

              type="button"

              className="text-xs text-primary underline"

              onClick={async () => {

                await fetch("/api/company/notifications/read-all", { method: "PATCH" });

                setRows((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));

                setCount(0);

              }}

            >

              Make all as read

            </button>

          </div>

          <div className="max-h-80 overflow-auto">

            {rows.length === 0 ? (

              <p className="p-3 text-sm text-muted-foreground">No notifications.</p>

            ) : (

              rows.map((n) => (

                <button

                  key={n.id}

                  type="button"

                  className={`w-full border-b px-3 py-2 text-left text-sm hover:bg-muted/40 ${

                    !n.readAt ? "bg-primary/5" : ""

                  }`}

                  onClick={async () => {

                    if (!n.readAt) {

                      await fetch(`/api/company/notifications/${n.id}/read`, { method: "PATCH" });

                      setCount((c) => Math.max(0, c - 1));

                      setRows((prev) =>

                        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),

                      );

                    }

                  }}

                >

                  <p className="font-medium">{n.title || "Notification"}</p>

                  <p className="text-xs text-muted-foreground">{n.body || "-"}</p>

                </button>

              ))

            )}

          </div>

          <div className="px-3 py-2">

            <button

              type="button"

              className="text-xs text-primary underline"

              onClick={() => {

                setOpen(false);

                router.push("/company/notifications");

              }}

            >

              View all notifications

            </button>

          </div>

        </div>

      )}

    </div>

  );

}

