import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import { Key, ShieldCheck } from 'lucide-react';
import { ThemeProvider } from './hooks/use-theme'
import { ThemeToggle } from './components/ThemeToggle';

// Import page components
import Keys from './components/pages/Keys';
import ActivationKeyEditor from './components/pages/ActivationKeyEditor';

function App() {
  const menuItems = [
    { title: "Activation Key Editor", icon: IdCard, path: "/" },
    { title: "Keys", icon: Key, path: "/keys" },
  ];

  return (
    <ThemeProvider defaultTheme="system" storageKey="ak-tools-theme">
      <Router>
        <div className="min-h-screen">
          <nav className="border-b">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between h-20">
                <div className="flex items-center gap-4">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-10 w-10 text-primary"
                    fill="none"
                    stroke="currentColor"
                  >
                    {/* Main can body - outline */}
                    <path 
                      d="M3 7c0-1.657 4.03-3 9-3s9 1.343 9 3v10c0 1.657-4.03 3-9 3s-9-1.343-9-3V7z" 
                      strokeWidth="1.5"
                    />
                    
                    {/* Top rim */}
                    <path 
                      d="M12 4c4.97 0 9 1.343 9 3 0 1.657-4.03 3-9 3s-9-1.343-9-3c0-1.657 4.03-3 9-3z" 
                      strokeWidth="1.5"
                    />
                    
                    {/* Decorative rings */}
                    <path 
                      d="M3.5 11c4.5 2 12.5 2 17 0M3.5 15c4.5 2 12.5 2 17 0" 
                      strokeWidth="1"
                    />
                    
                    {/* Pull tab */}
                    <path 
                      d="M14 5l2-2 1 1" 
                      strokeWidth="1.5" 
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-2xl font-bold text-primary">AK TOOLS</span>
                </div>
                
                <div className="flex items-center space-x-6">
                  {menuItems.map((item) => (
                    <Link
                      key={item.title}
                      to={item.path}
                      className="flex items-center space-x-2 px-4 py-2 rounded-md text-base font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  ))}
                  <div className="ml-4">
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <main className="container mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<ActivationKeyEditor />} />
              <Route path="/keys" element={<Keys />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
