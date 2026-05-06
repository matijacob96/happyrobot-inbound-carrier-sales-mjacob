import { Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import { HomePage } from "./pages/HomePage";
import { CallsPage } from "./pages/CallsPage";
import { CarriersPage } from "./pages/CarriersPage";
import { LoadsPage } from "./pages/LoadsPage";
import { DataProvider, useData } from "./lib/data";

export default function App() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

function AppShell() {
  const { loading, refresh } = useData();
  return (
    <Routes>
      <Route
        element={
          <MainLayout
            loading={loading}
            onRefresh={() => void refresh()}
          />
        }
      >
        <Route index element={<HomePage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="carriers" element={<CarriersPage />} />
        <Route path="loads" element={<LoadsPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
