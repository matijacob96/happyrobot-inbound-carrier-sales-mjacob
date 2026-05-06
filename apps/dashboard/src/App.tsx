import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import { HomePage } from "./pages/HomePage";
import { CallsPage } from "./pages/CallsPage";
import { CarriersPage } from "./pages/CarriersPage";
import { LoadsPage } from "./pages/LoadsPage";
import { DataProvider, useData } from "./lib/data";
import { getApiBase, getApiKey } from "./lib/api";

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(!getApiBase() || !getApiKey());

  return (
    <DataProvider ready={!needsSetup}>
      <AppShell needsSetup={needsSetup} setNeedsSetup={setNeedsSetup} />
    </DataProvider>
  );
}

function AppShell({
  needsSetup,
  setNeedsSetup,
}: {
  needsSetup: boolean;
  setNeedsSetup: (v: boolean) => void;
}) {
  const { loading, refresh } = useData();
  return (
    <Routes>
      <Route
        element={
          <MainLayout
            needsSetup={needsSetup}
            loading={loading}
            onRefresh={() => void refresh()}
            onSettingsSaved={() => {
              setNeedsSetup(false);
              void refresh();
            }}
            livePolling={!needsSetup}
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
