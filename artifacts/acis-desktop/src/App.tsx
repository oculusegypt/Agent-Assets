import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UIProvider } from "./contexts/ui-settings";
import { Layout } from "./components/layout";
import { CommandPalette } from "./components/command-palette";
import { GlobalErrorBoundary, ErrorBoundary } from "./components/error-boundary";
import { useRealtime } from "./hooks/use-realtime";
import { useWsNotifications } from "./hooks/use-ws-notifications";
import { Skeleton } from "@/components/ui/skeleton";
import { BillieFloat } from "./components/billie-float";

// ── Lazy-loaded pages for code splitting ──────────────────────────────────────
const Dashboard         = lazy(() => import("./pages/dashboard"));
const BilliePage        = lazy(() => import("./pages/billie"));
const AcisPage          = lazy(() => import("./pages/acis"));
const ProductionPage    = lazy(() => import("./pages/production"));
const NexusPage         = lazy(() => import("./pages/nexus"));
const CaeosPage         = lazy(() => import("./pages/caeos"));
const ConversationsPage = lazy(() => import("./pages/conversations"));
const SettingsPage      = lazy(() => import("./pages/settings"));
const ArchivePage       = lazy(() => import("./pages/archive"));
const MissionControlPage = lazy(() => import("./pages/mission-control"));
const NotFound          = lazy(() => import("./pages/not-found"));

// ── Query client — optimized for fast navigation ──────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,          // بيانات "حديثة" لمدة 30ث بدون إعادة جلب
      gcTime: 5 * 60_000,         // الإبقاء على cache 5 دقائق
      refetchInterval: false,
      refetchOnWindowFocus: false, // منع الجلب عند العودة للنافذة
      refetchOnMount: false,       // منع الجلب عند remount (التنقل)
      refetchOnReconnect: false,
    },
  },
});

// ── Splash screen removal ─────────────────────────────────────────────────────
function SplashRemover() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof (window as any).__ACIS_READY__ === "function") (window as any).__ACIS_READY__();
    }, 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}

// ── Page loading fallback ─────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="p-6 space-y-4" dir="rtl">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-4 w-64 rounded" />
      <div className="grid grid-cols-4 gap-3 mt-6">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl mt-4" />
    </div>
  );
}

// ── Global realtime provider — singleton WebSocket ────────────────────────────
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  useWsNotifications();
  return <>{children}</>;
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={() => <ErrorBoundary pageName="لوحة التحكم"><Dashboard /></ErrorBoundary>} />
          <Route path="/billie" component={() => <ErrorBoundary pageName="بيليه"><BilliePage /></ErrorBoundary>} />
          <Route path="/mission-control" component={() => <ErrorBoundary pageName="مركز التحكم"><MissionControlPage /></ErrorBoundary>} />
          <Route path="/acis" component={() => <ErrorBoundary pageName="ACIS السينمائي"><AcisPage /></ErrorBoundary>} />
          <Route path="/production" component={() => <ErrorBoundary pageName="خط الإنتاج"><ProductionPage /></ErrorBoundary>} />
          <Route path="/nexus" component={() => <ErrorBoundary pageName="نيكسوس"><NexusPage /></ErrorBoundary>} />
          <Route path="/caeos" component={() => <ErrorBoundary pageName="كايوس"><CaeosPage /></ErrorBoundary>} />
          <Route path="/conversations" component={() => <ErrorBoundary pageName="تواصل الوكلاء"><ConversationsPage /></ErrorBoundary>} />
          <Route path="/archive" component={() => <ErrorBoundary pageName="الأرشيف"><ArchivePage /></ErrorBoundary>} />
          <Route path="/settings" component={() => <ErrorBoundary pageName="الإعدادات"><SettingsPage /></ErrorBoundary>} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <UIProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <SplashRemover />
              <RealtimeProvider>
                <Router />
                <BillieFloat />
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
