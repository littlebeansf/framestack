/**
 * SecretMessages — Jack ↔ Sally private message system.
 *
 * Three pieces:
 *  1. <InboxPopper>  — shown automatically when there are unread messages on first visit.
 *                      A full-screen envelope "letter arrival" modal.
 *  2. <ComposeDialog> — lets you write a secret message to the other person.
 *  3. <SecretMessagesTab> — archive view of all received messages + compose button.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SecretMessage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Mail, Lock, Send, Archive, Trash2, X, ChevronRight, Pencil, Sparkles } from "lucide-react";

// ── Mood options ──────────────────────────────────────────────────────────────
const MOODS = [
  { emoji: "💖", label: "Love" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "🔥", label: "Hype" },
  { emoji: "🥺", label: "Soft" },
  { emoji: "😤", label: "Mood" },
  { emoji: "🌙", label: "Dreamy" },
  { emoji: "✨", label: "Sparkle" },
  { emoji: "💀", label: "Dead" },
];

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Compose Dialog ────────────────────────────────────────────────────────────
function ComposeDialog({
  from,
  to,
  accentFrom,
  onClose,
}: {
  from: string;
  to: string;
  accentFrom: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/messages", { from, to, subject, body, mood });
      return res.json();
    },
    onSuccess: (msg: SecretMessage) => {
      qc.setQueryData<SecretMessage[]>(["/api/messages", to], (old = []) => [msg, ...old]);
      toast({ title: "Message sent 💌" });
      onClose();
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  const toLabel = to === "jack" ? "Jack" : "Sally";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: "hsl(230 18% 9%)" }}
      >
        {/* Header */}
        <div
          className="p-5 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${accentFrom}22, ${accentFrom}08)`, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <Lock size={14} style={{ color: accentFrom }} />
            <span className="text-sm font-bold tracking-wide">Secret message to {toLabel}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mood */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">Mood</p>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map(m => (
                <button
                  key={m.emoji}
                  onClick={() => setMood(mood === m.emoji ? null : m.emoji)}
                  title={m.label}
                  className={cn(
                    "w-9 h-9 rounded-xl text-base transition-all border",
                    mood === m.emoji
                      ? "scale-110 border-white/30 bg-white/10"
                      : "border-white/5 hover:bg-white/8 hover:scale-105"
                  )}
                  data-testid={`mood-${m.label}`}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1.5">Subject (optional)</p>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="A tiny headline…"
              className="bg-white/5 border-white/10 text-sm placeholder:text-white/20"
              data-testid="input-message-subject"
            />
          </div>

          {/* Body */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1.5">Message</p>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={`Write something only ${toLabel} will see…`}
              rows={5}
              className="bg-white/5 border-white/10 text-sm placeholder:text-white/20 resize-none"
              data-testid="textarea-message-body"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} className="border-white/10 text-white/60 hover:text-white">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!body.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
              data-testid="button-send-message"
              style={{ background: accentFrom }}
              className="text-white font-semibold gap-1.5 hover:opacity-90 border-0"
            >
              <Send size={12} />
              {mutation.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inbox Popper — full-screen letter arrival ─────────────────────────────────
function InboxPopper({
  messages,
  owner,
  accentTo,
  accentFrom,
  onDismiss,
}: {
  messages: SecretMessage[];
  owner: string;
  accentTo: string;
  accentFrom: string;
  onDismiss: () => void;
}) {
  const qc = useQueryClient();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const msg = messages[currentIdx];
  if (!msg) return null;

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/messages/${id}/read`, {});
      return res.json() as Promise<SecretMessage>;
    },
    onSuccess: (updated: SecretMessage) => {
      // update both the unread list and the full archive
      qc.setQueryData<SecretMessage[]>(["/api/messages", owner, "unread"], (old = []) =>
        old.filter(m => m.id !== updated.id)
      );
      qc.setQueryData<SecretMessage[]>(["/api/messages", owner], (old = []) =>
        old.map(m => m.id === updated.id ? updated : m)
      );
    },
  });

  function handleNext() {
    markRead.mutate(msg.id);
    if (currentIdx + 1 < messages.length) {
      setCurrentIdx(i => i + 1);
    } else {
      setLeaving(true);
      setTimeout(onDismiss, 400);
    }
  }

  const fromLabel = msg.from === "jack" ? "Jack" : "Sally";
  const senderAccent = msg.from === "jack" ? accentFrom : accentTo; // contextual but we pass both

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center p-4 transition-opacity duration-400",
        leaving ? "opacity-0" : "opacity-100"
      )}
      style={{ background: "rgba(11,12,20,0.92)", backdropFilter: "blur(12px)" }}
    >
      <style>{`
        @keyframes letter-in {
          0%   { opacity:0; transform:translateY(32px) scale(0.94) rotate(-1deg); }
          60%  { transform:translateY(-4px) scale(1.01) rotate(0.3deg); }
          100% { opacity:1; transform:translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes envelope-float {
          0%,100% { transform:translateY(0); }
          50%     { transform:translateY(-6px); }
        }
        @keyframes seal-pop {
          0%  { transform:scale(0) rotate(-20deg); opacity:0; }
          70% { transform:scale(1.2) rotate(5deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
      `}</style>

      <div
        className="relative w-full max-w-md"
        style={{ animation: "letter-in 0.6s cubic-bezier(0.34,1.3,0.64,1) both" }}
      >
        {/* Envelope header */}
        <div
          className="flex items-center justify-center mb-4 gap-3"
          style={{ animation: "envelope-float 3s ease-in-out infinite" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl border border-white/10"
            style={{ background: `linear-gradient(135deg, ${senderAccent}33, ${senderAccent}11)` }}
          >
            <Mail size={26} style={{ color: senderAccent }} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Secret letter from</p>
            <p className="text-lg font-extrabold" style={{ color: senderAccent, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {fromLabel}
            </p>
          </div>
          {messages.length > 1 && (
            <span className="ml-auto text-[10px] text-white/30 font-mono">
              {currentIdx + 1} / {messages.length}
            </span>
          )}
        </div>

        {/* Letter card */}
        <div
          className="rounded-3xl border border-white/8 overflow-hidden shadow-2xl"
          style={{ background: "hsl(230 18% 11%)" }}
        >
          {/* Wax seal + subject */}
          <div
            className="px-6 pt-6 pb-4 flex items-start gap-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            {msg.mood && (
              <span
                className="shrink-0 text-2xl mt-0.5"
                style={{ animation: "seal-pop 0.5s cubic-bezier(0.34,1.4,0.64,1) 0.35s both" }}
              >
                {msg.mood}
              </span>
            )}
            <div className="flex-1 min-w-0">
              {msg.subject && (
                <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-1">
                  {msg.subject}
                </p>
              )}
              <p className="text-sm font-medium text-white/90 leading-relaxed whitespace-pre-wrap">
                {msg.body}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] text-white/25 font-mono">{fmtDate(msg.createdAt)}</span>
            <Button
              size="sm"
              onClick={handleNext}
              data-testid="button-message-next"
              style={{ background: senderAccent }}
              className="text-white font-semibold gap-1.5 hover:opacity-90 border-0 text-xs"
            >
              {currentIdx + 1 < messages.length ? (
                <><ChevronRight size={12} /> Next</>
              ) : (
                <><Archive size={12} /> Archive</>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/20 mt-4">
          This message is only visible to you 🔒
        </p>
      </div>
    </div>
  );
}

// ── Message Card (archive) ────────────────────────────────────────────────────
function MessageCard({
  msg,
  accentSender,
  owner,
}: {
  msg: SecretMessage;
  accentSender: string;
  owner: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/messages/${msg.id}`, {});
    },
    onSuccess: () => {
      qc.setQueryData<SecretMessage[]>(["/api/messages", owner], (old = []) =>
        old.filter(m => m.id !== msg.id)
      );
      toast({ title: "Message deleted" });
    },
  });

  const fromLabel = msg.from === "jack" ? "Jack" : "Sally";

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-200 overflow-hidden",
        expanded ? "border-white/12 bg-white/5" : "border-white/6 bg-white/3 hover:bg-white/5"
      )}
    >
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
        data-testid={`button-expand-message-${msg.id}`}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-base"
          style={{ background: `${accentSender}22` }}
        >
          {msg.mood || "💌"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold" style={{ color: accentSender }}>{fromLabel}</span>
            <span className="text-[10px] text-white/25 font-mono ml-auto shrink-0">{fmtDate(msg.createdAt)}</span>
          </div>
          {msg.subject && (
            <p className="text-xs text-white/70 font-semibold truncate">{msg.subject}</p>
          )}
          {!expanded && (
            <p className="text-xs text-white/40 truncate mt-0.5">{msg.body}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap border-t border-white/5 pt-3">
            {msg.body}
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-red-400 transition-colors"
              data-testid={`button-delete-message-${msg.id}`}
            >
              <Trash2 size={11} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function SecretMessagesTab({
  owner,
  accentOwner,
  accentOther,
}: {
  owner: "jack" | "sally";
  accentOwner: string;   // this profile's accent (sender colour)
  accentOther: string;   // the other person's accent (recipient colour)
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [inboxDismissed, setInboxDismissed] = useState(false);
  const { toast } = useToast();

  const otherOwner = owner === "jack" ? "sally" : "jack";

  // All messages addressed to this owner (archive)
  const { data: allMessages = [], isLoading } = useQuery<SecretMessage[]>({
    queryKey: ["/api/messages", owner],
    staleTime: 15_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/messages/${owner}`, undefined);
      return res.json();
    },
  });

  // Unread messages (inbox pop)
  const { data: unread = [] } = useQuery<SecretMessage[]>({
    queryKey: ["/api/messages", owner, "unread"],
    staleTime: 15_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/messages/${owner}/unread`, undefined);
      return res.json();
    },
  });

  const showInbox = unread.length > 0 && !inboxDismissed;
  const jackAccent  = "hsl(220 80% 62%)";
  const sallyAccent = "hsl(330 75% 65%)";

  function getAccent(who: string) {
    return who === "jack" ? jackAccent : sallyAccent;
  }

  return (
    <div className="space-y-5 animate-page-in">
      {/* Inbox pop — auto-shown when there are unread messages */}
      {showInbox && (
        <InboxPopper
          messages={unread}
          owner={owner}
          accentTo={accentOwner}
          accentFrom={accentOther}
          onDismiss={() => setInboxDismissed(true)}
        />
      )}

      {/* Compose dialog */}
      {composeOpen && (
        <ComposeDialog
          from={owner}
          to={otherOwner}
          accentFrom={accentOwner}
          onClose={() => setComposeOpen(false)}
        />
      )}

      {/* Tab header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock size={14} style={{ color: accentOwner }} />
          <span className="text-sm font-bold">Secret mailbox</span>
          {allMessages.filter(m => !m.readAt).length > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${accentOther}33`, color: accentOther }}
            >
              {allMessages.filter(m => !m.readAt).length} new
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setComposeOpen(true)}
          data-testid="button-compose-message"
          className="text-white font-semibold gap-1.5 hover:opacity-90 border-0 text-xs"
          style={{ background: accentOwner }}
        >
          <Pencil size={11} />
          Write to {otherOwner === "jack" ? "Jack" : "Sally"}
        </Button>
      </div>

      {/* Archive list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 skeleton rounded-2xl" />)}
        </div>
      ) : allMessages.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/3 p-10 flex flex-col items-center gap-3 text-center">
          <span className="text-4xl" style={{ filter: `drop-shadow(0 0 12px ${accentOwner}66)` }}>💌</span>
          <p className="text-sm font-semibold text-white/60">No secret messages yet</p>
          <p className="text-xs text-white/30">Messages sent to you will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allMessages.map(msg => (
            <MessageCard
              key={msg.id}
              msg={msg}
              accentSender={getAccent(msg.from)}
              owner={owner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
