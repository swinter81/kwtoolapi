import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Database, Cpu, Terminal, BarChart3, Heart, Zap, BookOpen,
  ChevronRight, Menu, X, Globe, Upload
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/", icon: BookOpen },
  { label: "Resolve", href: "/resolve", icon: Zap },
  { label: "Search", href: "/search", icon: Search },
  { label: "Manufacturers", href: "/manufacturers", icon: Globe },
  { label: "Products", href: "/products", icon: Cpu },
  { label: "App Programs", href: "/programs", icon: Terminal },
  { label: "DPTs", href: "/dpts", icon: Database },
  { label: "Statistics", href: "/stats", icon: BarChart3 },
  { label: "Health", href: "/health", icon: Heart },
  { label: "Ingest", href: "/ingest", icon: Upload },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 lg:z-auto
        w-72 h-screen bg-card border-r border-border
        transform transition-transform lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">KNXforge</h1>
              <p className="text-xs text-muted-foreground">API Documentation</p>
            </div>
          </Link>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-88px)]">
          <nav className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
              Endpoints
            </p>
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border lg:hidden">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-semibold">KNXforge API</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
