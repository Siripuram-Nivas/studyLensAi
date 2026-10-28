import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { QuizPage } from "./pages/Quiz";
import { SettingsPage } from "./pages/Settings";
import { Workspace } from "./pages/Workspace";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/study" element={<Workspace />} />
        <Route path="/quiz/:quizId" element={<QuizPage />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
