import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      {/* Global Navbar */}
      <header className="w-full h-14 sm:h-16 sticky top-0 z-50 bg-[#13121e]/60 backdrop-blur-md flex justify-between items-center px-4 sm:px-8 border-b border-white/5">
        <Link to="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#e9c349] text-xl sm:text-2xl" style={{fontVariationSettings: "'FILL' 1"}}>workspace_premium</span>
          <span className="text-lg sm:text-2xl font-headline tracking-tighter text-[#e9c349]">Certificate Maker</span>
        </Link>
        <nav>
          <Link to="/admin" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Admin Login</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
