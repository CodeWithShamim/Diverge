import { useEffect } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { Landing } from "./views/Landing";
import { Board } from "./views/Board";
import { DisputeDetail } from "./views/DisputeDetail";
import { Assert } from "./views/Assert";
import { Challenge } from "./views/Challenge";
import { Appeal } from "./views/Appeal";
import { ResolutionExplorer } from "./views/ResolutionExplorer";
import { Docs } from "./views/Docs";
import { initLenis } from "./design/motion";
import { CHAIN_ID, CHAIN_NAME, MOCK_MODE } from "./config/chain";
import { WalletControl } from "./components/WalletButton";
import { ThemeToggle } from "./components/ThemeToggle";
import { Footer } from "./components/Footer";
import { Toaster } from "./components/Toaster";

export default function App() {
  useEffect(() => {
    initLenis();
  }, []);

  return (
    <HashRouter>
      <div className="app-shell">
      <header className="hdr">
        <div className="hdr-inner">
          <NavLink to="/" className="hdr-mark">
            DIVERGE<span className="fork-glyph">⟋⟍</span>
          </NavLink>
          <nav aria-label="Primary">
            <NavLink to="/board" className={({ isActive }) => (isActive ? "active" : "")}>
              Board
            </NavLink>
            <NavLink to="/assert" className={({ isActive }) => (isActive ? "active" : "")}>
              Assert
            </NavLink>
            <NavLink to="/explorer" className={({ isActive }) => (isActive ? "active" : "")}>
              Explorer
            </NavLink>
            <NavLink to="/docs" className={({ isActive }) => (isActive ? "active" : "")}>
              Docs
            </NavLink>
          </nav>
          <ThemeToggle />
          <WalletControl />
          <span className="hdr-chain">
            {CHAIN_NAME} {CHAIN_ID}
            {MOCK_MODE && <span className="mock-flag"> · SIMULATED</span>}
          </span>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/board" element={<Board />} />
          <Route path="/dispute/:id" element={<DisputeDetail />} />
          <Route path="/assert" element={<Assert />} />
          <Route path="/challenge/:id" element={<Challenge />} />
          <Route path="/appeal/:id" element={<Appeal />} />
          <Route path="/explorer" element={<ResolutionExplorer />} />
          <Route path="/docs" element={<Docs />} />
        </Routes>
      </main>
      <Footer />
      </div>
      <Toaster />
    </HashRouter>
  );
}
