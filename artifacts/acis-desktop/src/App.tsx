import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UIProvider } from "./contexts/ui-settings";
import { Layout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import BilliePage from "./pages/billie";
import AcisPage from "./pages/acis";
import ProductionPage from "./pages/production";
import NexusPage from "./pages/nexus";
import CaeosPage from "./pages/caeos";
import ConversationsPage from "./pages/conversations";
import SettingsPage from "./pages/settings";
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
        <Route path="/" component={Dashboard} />
        <Route path="/billie" component={BilliePage} />
        <Route path="/acis" component={AcisPage} />
        <Route path="/production" component={ProductionPage} />
        <Route path="/nexus" component={NexusPage} />
        <Route path="/caeos" component={CaeosPage} />
        <Route path="/conversations" component={ConversationsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UIProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <RealtimeProvider>
              <Router />
            </RealtimeProvider>
          </WouterRouter>
          <Toaster />
        </UIProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
