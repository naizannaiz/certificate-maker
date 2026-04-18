import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import { LogOut } from 'lucide-react';

// ProtectedRoute: Redirects to /admin/login if not authenticated
function ProtectedRoute({ session, children }) {
  if (session === undefined) {
    // Still loading auth state — show a minimal spinner
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

function AppLayout({ session }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  return (
    <>
      {/* Global Navbar */}
      <header className="w-full h-14 sm:h-16 sticky top-0 z-50 bg-[#13121e]/60 backdrop-blur-md flex justify-between items-center px-4 sm:px-8 border-b border-white/5">
        <Link to="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#e9c349] text-xl sm:text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          <span className="text-lg sm:text-2xl font-headline tracking-tighter text-[#e9c349]">Certificate Maker</span>
        </Link>
        <nav className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant hidden sm:block truncate max-w-[180px]">{session.user.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-red-400 transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <Link to="/admin/login" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              Admin Login
            </Link>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute session={session}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/login"
          element={
            // If already logged in, go straight to dashboard
            session ? <Navigate to="/admin" replace /> : <AdminLogin />
          }
        />
      </Routes>
    </>
  );
}

function App() {
  // undefined = loading, null = logged out, object = logged in
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <AppLayout session={session} />
    </BrowserRouter>
  );
}

export default App;
