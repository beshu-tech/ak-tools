import { BrowserRouter as Router, Routes, Route, Link, NavLink } from "react-router-dom";
import { Key, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { ThemeProvider } from "./hooks/use-theme";
import { ToastProvider } from "./hooks/use-toast";
import { ThemeToggle } from "./components/ui/theme-toggle";
import { Logo } from "./components/ui/logo";

// Import page components
import Keys from "./components/pages/Keys";
import Templates from "./components/pages/Templates";
import ActivationKeyEditor from "./components/pages/ActivationKeyEditor";

function App() {
  const menuItems = [
    { title: "Editor", icon: ShieldCheck, path: "/" },
    { title: "Templates", icon: FileText, path: "/templates" },
    { title: "Keys", icon: Key, path: "/keys" },
  ];

  return (
    <ThemeProvider defaultTheme="dark" storageKey="ak-tools-theme">
      <ToastProvider>
        <Router>
          <div className="min-h-screen page-pattern flex flex-col">
            <nav className="border-b bg-background/70 backdrop-blur-md sticky top-0 z-50">
              <div className="container mx-auto max-w-6xl px-4">
                <div className="flex items-center justify-between h-14">
                  <Link
                    to="/"
                    aria-label="AK Tools home"
                    className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    <Logo />
                  </Link>

                  <div className="flex items-center space-x-1">
                    {menuItems.map((item) => (
                      <NavLink
                        key={item.title}
                        to={item.path}
                        end={item.path === "/"}
                        className="relative flex items-center gap-2 px-2.5 sm:px-3.5 py-2 rounded-md text-[13px] font-normal uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors aria-[current=page]:text-primary aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-[11px] aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-linear-to-r aria-[current=page]:after:from-brand-cyan aria-[current=page]:after:to-brand-green aria-[current=page]:after:content-['']"
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only">{item.title}</span>
                      </NavLink>
                    ))}
                    <div className="ml-2 pl-2 border-l">
                      <ThemeToggle />
                    </div>
                  </div>
                </div>
              </div>
            </nav>

            <main className="container mx-auto w-full max-w-6xl px-4 py-8 sm:py-10 flex-1">
              <Routes>
                <Route path="/" element={<ActivationKeyEditor />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/keys" element={<Keys />} />
              </Routes>
            </main>

            <footer className="border-t bg-black/10 dark:bg-black/20 mt-auto">
              <div className="container mx-auto max-w-6xl px-4 py-5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>© {new Date().getFullYear()}</span>
                    <a
                      href="https://beshu.tech/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      Beshu Tech
                    </a>
                    <span>— All rights reserved</span>
                  </div>

                  <div className="flex items-center gap-6">
                    <a
                      href="https://readonlyrest.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
                    >
                      <span>ReadonlyREST</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <a
                      href="https://anaphora.it/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
                    >
                      <span>Anaphora</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <a
                      href="https://beshu.tech/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
                    >
                      <span>Beshu</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
