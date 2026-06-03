import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UIProvider } from "./contexts/ui-settings";
import { Layout } from "./components/layout";
import { CommandPalette } from "./components/command-palette";
import { GlobalErrorBoundary, ErrorBoundary } from "./components/error-boundary";
import Dashboard from "./pages/dashboard";
import BilliePage from "./pages/billie";
import AcisPage from "./pages/acis";
import ProductionPage from "./pages/production";
import NexusPage from "./pages/nexus";
import CaeosPage from "./pages/caeos";
import ConversationsPage from "./pages/conversations";
import SettingsPage from "./pages/settings";
import ArchivePage from "./pages/archive";
import NotFound from "@/pages/not-found";
import { useRealtime } from "./hooks/use-realtime";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchInterval: false,
    },
  },
});

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  return <>{children}</>;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={() => <ErrorBoundary pageName="لوحة التحكم"><Dashboard /></ErrorBoundary>} />
        <Route path="/billie" component={() => <ErrorBoundary pageName="بيليه"><BilliePage /></ErrorBoundary>} />
        <Route path="/acis" component={() => <ErrorBoundary pageName="ACIS السينمائي"><AcisPage /></ErrorBoundary>} />
        <Route path="/production" component={() => <ErrorBoundary pageName="خط الإنتاج"><ProductionPage /></ErrorBoundary>} />
        <Route path="/nexus" component={() => <ErrorBoundary pageName="نيكسوس"><NexusPage /></ErrorBoundary>} />
        <Route path="/caeos" component={() => <ErrorBoundary pageName="كايوس"><CaeosPage /></ErrorBoundary>} />
        <Route path="/conversations" component={() => <ErrorBoundary pageName="تواصل الوكلاء"><ConversationsPage /></ErrorBoundary>} />
        <Route path="/archive" component={() => <ErrorBoundary pageName="الأرشيف"><ArchivePage /></ErrorBoundary>} />
        <Route path="/settings" component={() => <ErrorBoundary pageName="الإعدادات"><SettingsPage /></ErrorBoundary>} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <UIProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <RealtimeProvider>
                <Router />
              </RealtimeProvider>
            </WouterRouter>
            <Toaster />
            <SonnerToaster position="bottom-left" richColors dir="rtl" />
            <CommandPalette />
          </UIProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
