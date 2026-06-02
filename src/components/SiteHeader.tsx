import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, BookOpen, MessagesSquare, Bookmark, ShieldCheck, LogOut, UserCircle2, Search, Pencil } from "lucide-react";

const navItems = [
  { to: "/chapters", label: "Chapters", icon: BookOpen },
  { to: "/chat", label: "Halls", icon: MessagesSquare },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/users", label: "Seekers", icon: Search },
];

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <Moon className="h-5 w-5 text-primary group-hover:rotate-12 transition-transform" />
          <span className="font-display text-xl tracking-[0.2em] uppercase text-glow">
            Nightveil
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-sans transition-colors ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-sans transition-colors ${
                pathname.startsWith("/admin")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Scriptorium
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/profile" aria-label="Your profile" className="text-muted-foreground hover:text-primary transition-colors">
                <UserCircle2 className="h-6 w-6" />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="font-sans text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="bg-gold-gradient text-gold-foreground hover:opacity-90 font-sans">
                Enter
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}