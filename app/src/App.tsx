import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { NavBar } from "./components/NavBar.tsx";
import { Background, FloatingParticles } from "./components/Background.tsx";
import { IntroAnimation } from "./components/IntroAnimation.tsx";
import { HomePage } from "./pages/Home.tsx";
import { StampPage } from "./pages/Stamp.tsx";
import { DropPage } from "./pages/Drop.tsx";
import { DropCreatePage } from "./pages/DropCreate.tsx";
import { DropSubmitPage } from "./pages/DropSubmit.tsx";
import { DropDashboardPage } from "./pages/DropDashboard.tsx";
import { BurnPage } from "./pages/Burn.tsx";
import { BurnSendPage } from "./pages/BurnSend.tsx";
import { BurnInboxPage } from "./pages/BurnInbox.tsx";
import { FeedPage } from "./pages/Feed.tsx";
import { FeedSourcesPage } from "./pages/FeedSources.tsx";
import { FeedSavedPage } from "./pages/FeedSaved.tsx";
import { FeedDiscoverPage } from "./pages/FeedDiscover.tsx";
import { SocialPage } from "./pages/Social.tsx";

// Check intro status synchronously to avoid flash
function shouldShowIntro(): boolean {
  if (typeof window === "undefined") return false;
  const hasSeenIntro = sessionStorage.getItem("void-intro-seen");
  const isHomePage = window.location.pathname === "/";
  return isHomePage && !hasSeenIntro;
}

function AppContent() {
  const location = useLocation();
  const [introActive, setIntroActive] = useState(() => shouldShowIntro());
  const [introComplete, setIntroComplete] = useState(() => !shouldShowIntro());

  const handleIntroComplete = () => {
    sessionStorage.setItem("void-intro-seen", "true");
    setIntroComplete(true);
    setTimeout(() => setIntroActive(false), 500);
  };

  return (
    <div className="min-h-screen">
      {/* Background layers */}
      <Background />
      <FloatingParticles />

      {/* Intro animation */}
      {introActive && !introComplete && (
        <IntroAnimation onComplete={handleIntroComplete} />
      )}

      {/* Main content - hidden during intro */}
      <div
        className={`relative z-[2] transition-opacity duration-500 ${
          introActive && !introComplete ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <NavBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stamp" element={<StampPage />} />
          <Route path="/drop" element={<DropPage />} />
          <Route path="/drop/create" element={<DropCreatePage />} />
          <Route path="/drop/submit/:slug" element={<DropSubmitPage />} />
          <Route path="/drop/dashboard" element={<DropDashboardPage />} />
          <Route path="/burn" element={<BurnPage />} />
          <Route path="/burn/send" element={<BurnSendPage />} />
          <Route path="/burn/inbox" element={<BurnInboxPage />} />
          <Route path="/feed" element={<FeedDiscoverPage />} />
          <Route path="/feed/my" element={<FeedPage />} />
          <Route path="/feed/sources" element={<FeedSourcesPage />} />
          <Route path="/feed/saved" element={<FeedSavedPage />} />
          <Route path="/social" element={<SocialPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
