import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center text-muted-foreground">
      <p className="text-6xl font-bold text-foreground/10 mb-4" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>404</p>
      <p className="text-sm font-medium text-foreground">Page not found</p>
      <p className="text-xs mt-1">This page doesn't exist.</p>
      <Link href="/" className="mt-4 text-sm text-primary hover:underline">Go to Library</Link>
    </div>
  );
}
