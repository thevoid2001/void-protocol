import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NavBar } from "./components/NavBar.tsx";
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

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-void-bg">
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
        </Routes>
      </div>
    </BrowserRouter>
  );
}
