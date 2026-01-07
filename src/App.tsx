import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import { Key, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { ThemeProvider } from './hooks/use-theme';
import { ToastProvider } from './hooks/use-toast';
import { ThemeToggle } from './components/ui/theme-toggle';

// Import page components
import Keys from './components/pages/Keys';
import Templates from './components/pages/Templates';
import ActivationKeyEditor from './components/pages/ActivationKeyEditor';

function App() {
  const menuItems = [
    { title: "Editor", icon: ShieldCheck, path: "/" },
    { title: "Templates", icon: FileText, path: "/templates" },
    { title: "Keys", icon: Key, path: "/keys" },
  ];

  return (
    <ThemeProvider defaultTheme="system" storageKey="ak-tools-theme">
      <ToastProvider>
      <Router>
        <div className="min-h-screen page-pattern flex flex-col">
          <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between h-16">
                <Link to="/" className="flex items-center gap-3 group">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md group-hover:bg-primary/30 transition-colors" />
                    <svg
                      viewBox="0 0 24 24"
                      className="h-9 w-9 text-primary relative"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M3 7c0-1.657 4.03-3 9-3s9 1.343 9 3v10c0 1.657-4.03 3-9 3s-9-1.343-9-3V7z"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M12 4c4.97 0 9 1.343 9 3 0 1.657-4.03 3-9 3s-9-1.343-9-3c0-1.657 4.03-3 9-3z"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M3.5 11c4.5 2 12.5 2 17 0M3.5 15c4.5 2 12.5 2 17 0"
                        strokeWidth="1"
                      />
                      <path
                        d="M14 5l2-2 1 1"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <span className="text-xl font-bold tracking-tight">
                    <span className="text-primary">AK</span>
                    <span className="text-muted-foreground font-medium ml-1">Tools</span>
                  </span>
                </Link>

                <div className="flex items-center space-x-1">
                  {menuItems.map((item) => (
                    <Link
                      key={item.title}
                      to={item.path}
                      className="nav-link flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  ))}
                  <div className="ml-2 pl-2 border-l">
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <main className="container mx-auto px-4 py-8 flex-1">
            <Routes>
              <Route path="/" element={<ActivationKeyEditor />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/keys" element={<Keys />} />
            </Routes>
          </main>

          <footer className="border-t bg-card/60 backdrop-blur-sm mt-auto">
            <div className="container mx-auto px-4 py-6">
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
