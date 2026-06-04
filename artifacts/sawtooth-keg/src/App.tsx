import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";
import KegOrderForm from "@/pages/KegOrderForm";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminOrderDetail from "@/pages/admin/AdminOrderDetail";
import AdminBeers from "@/pages/admin/AdminBeers";
import AdminCalendar from "@/pages/admin/AdminCalendar";
import PickupForms from "@/pages/pickup/PickupForms";
import PickupReceipt from "@/pages/pickup/PickupReceipt";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const rawClerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = rawClerkPublishableKey
  ? publishableKeyFromHost(window.location.hostname, rawClerkPublishableKey)
  : null;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
  },
  variables: {
    colorPrimary: "hsl(28, 90%, 45%)",
    colorForeground: "hsl(30, 20%, 15%)",
    colorMutedForeground: "hsl(30, 10%, 45%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(40, 33%, 98%)",
    colorInput: "hsl(30, 15%, 85%)",
    colorInputForeground: "hsl(30, 20%, 15%)",
    colorNeutral: "hsl(30, 15%, 75%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-stone-200",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-stone-900 font-serif font-bold",
    headerSubtitle: "text-stone-500",
    socialButtonsBlockButtonText: "text-stone-700",
    formFieldLabel: "text-stone-700 font-medium",
    footerActionLink: "text-amber-700 hover:text-amber-800 font-medium",
    footerActionText: "text-stone-500",
    dividerText: "text-stone-400",
    identityPreviewEditButton: "text-amber-700",
    formFieldSuccessText: "text-green-700",
    alertText: "text-stone-700",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-14 w-14",
    socialButtonsBlockButton: "border-stone-200 hover:bg-stone-50",
    formButtonPrimary: "bg-amber-600 hover:bg-amber-700 text-white",
    formFieldInput: "border-stone-300 bg-stone-50 text-stone-900",
    footerAction: "bg-stone-50 border-t border-stone-200",
    dividerLine: "bg-stone-200",
    alert: "border-stone-200",
    otpCodeFieldInput: "border-stone-300",
    formFieldRow: "",
    main: "px-8 py-6",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsub;
  }, [addListener, qc]);

  return null;
}

// DEMO MODE: auth bypassed — re-enable by restoring Show when="signed-in/out" guards
function HomeRedirect() {
  return <Landing />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  return <Component />;
  // Re-enable auth by replacing the line above with:
  // return (
  //   <>
  //     <Show when="signed-in">
  //       <Component />
  //     </Show>
  //     <Show when="signed-out">
  //       <Redirect to="/sign-in" />
  //     </Show>
  //   </>
  // );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stone-50 px-4 py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stone-50 px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/keg-order" component={KegOrderForm} />
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/orders" component={() => <AdminRoute component={AdminOrders} />} />
      <Route path="/admin/orders/:id" component={() => <AdminRoute component={AdminOrderDetail} />} />
      <Route path="/admin/beers" component={() => <AdminRoute component={AdminBeers} />} />
      <Route path="/admin/calendar" component={() => <AdminRoute component={AdminCalendar} />} />
      <Route path="/pickup/:orderId/forms" component={() => <AdminRoute component={PickupForms} />} />
      <Route path="/pickup/:orderId/receipt" component={() => <AdminRoute component={PickupReceipt} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to manage keg orders" } },
        signUp: { start: { title: "Create staff account", subtitle: "Get access to the admin dashboard" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
