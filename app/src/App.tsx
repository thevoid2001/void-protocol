import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NavBar } from "./components/NavBar.tsx";
import { HomePage } from "./pages/Home.tsx";
import { StampPage } from "./pages/Stamp.tsx";
import { DropPage } from "./pages/Drop.tsx";
import { DropCreatePage } from "./pages/DropCreate.tsx";
import { DropSubmitPage } from "./pages/DropSubmit.tsx";
import { DropDashboardPage } from "./pages/DropDashboard.tsx";

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
        </Routes>
      </div>
    </BrowserRouter>
  );
}
