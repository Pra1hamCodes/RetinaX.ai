import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import ScrollToTop from "@/components/layout/ScrollToTop";
import ApproachPage from "@/pages/ApproachPage";
import DashboardPage from "@/pages/DashboardPage";
import DatasetPage from "@/pages/DatasetPage";
import DetectionPage from "@/pages/DetectionPage";
import EvaluationPage from "@/pages/EvaluationPage";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import ModelArenaPage from "@/pages/ModelArenaPage";
import NotFoundPage from "@/pages/NotFoundPage";
import SignupPage from "@/pages/SignupPage";
import { useAuthStore } from "@/store/authStore";

export default function App() {
  const refresh = useAuthStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/detect" element={<DetectionPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/approach" element={<ApproachPage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/model-arena" element={<ModelArenaPage />} />
          <Route path="/dataset" element={<DatasetPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
