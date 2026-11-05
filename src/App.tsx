import { BrowserRouter as Router, Routes, Route, Link, NavLink } from "react-router-dom";
import { Key, ShieldCheck, FileText } from "lucide-react";
import { ThemeProvider } from "./hooks/use-theme";
import { ToastProvider } from "./hooks/use-toast";
import { MAIN_ID, useRouteEffects } from "./hooks/use-route-effects";
import { ThemeToggle } from "./components/ui/theme-toggle";
import { Logo } from "./components/ui/logo";
import { ExternalLink } from "./components/ui/external-link";

// Import page components
import Keys from "./components/pages/Keys";
import Templates from "./components/pages/Templates";
import ActivationKeyEditor from "./components/pages/ActivationKeyEditor";

const MENU_ITEMS = [
  { title: "Editor", icon: ShieldCheck, path: "/" },
  { title: "Templates", icon: FileText, path: "/templates" },
  { title: "Keys", icon: Key, path: "/keys" },
];

const FOOTER_LINKS = [
  { label: "ReadonlyREST", href: "https://readonlyrest.com/" },
  { label: "Anaphora", href: "https://anaphora.it/" },
  { label: "Beshu", href: "https://beshu.tech/" },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Route-driven accessibility effects (title, focus) need to live inside the router. */
function Shell() {
  useRouteEffects();

  return (
    <div className="min-h-screen page-pattern flex flex-col">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground focus:outline-2 focus:outline-ring"
      >
        Skip to main content
      </a>

      <header className="border-b bg-background/70 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className={`rounded-md focus-visible:outline-offset-4 ${focusRing}`}>
              <Logo />
            </Link>

            <nav aria-label="Main" className="flex items-center space-x-1">
              {MENU_ITEMS.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.path}
                  end={item.path === "/"}
                  className={`relative flex items-center gap-2 px-2.5 sm:px-3.5 py-2 rounded-md text-[13px] font-normal uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors aria-[current=page]:text-primary aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-[11px] aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-linear-to-r aria-[current=page]:after:from-brand-cyan aria-[current=page]:after:to-brand-green aria-[current=page]:after:content-[''] ${focusRing}`}
                >
                  <item.icon aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">{item.title}</span>
                </NavLink>
              ))}
              <div className="ml-2 pl-2 border-l">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="container mx-auto w-full max-w-6xl px-4 py-8 sm:py-10 flex-1 focus:outline-none"
      >
        <Routes>
          <Route path="/" element={<ActivationKeyEditor />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/keys" element={<Keys />} />
        </Routes>
      </main>

      <footer className="border-t bg-black/10 dark:bg-black/20 mt-auto">
        <div className="container mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()}</span>
              <ExternalLink
                href="https://beshu.tech/"
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                Beshu Tech
              </ExternalLink>
              <span>— All rights reserved</span>
            </p>

            <nav aria-label="Beshu products and company">
              <ul className="flex items-center gap-6">
                {FOOTER_LINKS.map((link) => (
                  <li key={link.href + link.label}>
                    <ExternalLink
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="ak-tools-theme">
      <ToastProvider>
        <Router>
          <Shell />
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
