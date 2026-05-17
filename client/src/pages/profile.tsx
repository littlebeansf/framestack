import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Lock, BarChart3, BookOpen, Film, Tv, Star, Book } from "lucide-react";
import type { Item } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book",
};
const TYPE_COLORS: Record<string, string> = {
  anime: "hsl(255 70% 55%)",
  manga: "hsl(340 60% 55%)",
  movie: "hsl(30 70% 55%)",
  series: "hsl(190 60% 50%)",
  book: "hsl(160 50% 48%)",
};

export default function ProfilePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, updateUser } = useAuth();

  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
    queryFn: () => apiRequest("GET", "/api/items").then(r => r.json()),
  });

  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    avatarUrl: user?.avatarUrl ?? "",
  });

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const profileMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/auth/profile", profileForm).then(r => r.json()),
    onSuccess: (updated) => {
      updateUser(updated);
      toast({ title: "Profile updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pwMutation = useMutation({
    mutationFn: () => {
      if (pwForm.newPassword !== pwForm.confirmPassword) throw new Error("Passwords don't match");
      return apiRequest("POST", "/api/auth/change-password", {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      }).then(async r => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
        return r.json();
      });
    },
    onSuccess: () => {
      toast({ title: "Password changed" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Stats
  const total = (items || []).length;
  const completed = (items || []).filter(i => i.status === "completed").length;
  const rated = (items || []).filter(i => i.rating != null);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const byType = ["anime", "manga", "movie", "series", "book"].map(t => ({
    type: t,
    count: (items || []).filter(i => i.mediaType === t).length,
  })).filter(x => x.count > 0);

  const initials = (user?.displayName || user?.username || "?")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2 mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          <User size={18} className="text-primary" />
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: total },
          { label: "Completed", value: completed },
          { label: "Avg rating", value: avgRating ? `★ ${avgRating}` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(" ", "-")}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* By type breakdown */}
      {byType.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BarChart3 size={12} />
            Library breakdown
          </p>
          {byType.map(({ type, count }) => (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-14">{TYPE_LABELS[type]}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${total > 0 ? (count / total) * 100 : 0}%`,
                    backgroundColor: TYPE_COLORS[type],
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Profile form */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Account details</h2>

        {/* Avatar preview */}
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profileForm.avatarUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{user?.displayName || user?.username}</p>
            <p className="text-xs text-muted-foreground">@{user?.username}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input
              data-testid="input-display-name"
              value={profileForm.displayName}
              onChange={e => setProfileForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              data-testid="input-profile-email"
              type="email"
              value={profileForm.email}
              onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Avatar URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              data-testid="input-avatar-url"
              value={profileForm.avatarUrl}
              onChange={e => setProfileForm(f => ({ ...f, avatarUrl: e.target.value }))}
              placeholder="https://…"
            />
          </div>
        </div>

        <Button
          onClick={() => profileMutation.mutate()}
          disabled={profileMutation.isPending}
          data-testid="button-save-profile"
          size="sm"
        >
          {profileMutation.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>

      <Separator />

      {/* Change password */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock size={14} />
          Change password
        </h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input
              type="password"
              data-testid="input-current-password"
              value={pwForm.currentPassword}
              onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              data-testid="input-new-password"
              value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              data-testid="input-confirm-password"
              value={pwForm.confirmPassword}
              onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pwMutation.mutate()}
          disabled={pwMutation.isPending || !pwForm.currentPassword || !pwForm.newPassword}
          data-testid="button-change-password"
        >
          {pwMutation.isPending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </div>
  );
}
