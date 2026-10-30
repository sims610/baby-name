import { lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import type { RouteObject } from "react-router";
import AuthProvider from "@/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import RootLayout from "@/layouts/RootLayout";
import AboutView from "@/views/about";

// Views are code-split: each one is downloaded the first time its route is visited.
const HomeView = lazy(() => import("@/views/home"));
const CreateAccountView = lazy(() => import("@/views/CreateAccountView"));
const LoginView = lazy(() => import("@/views/LoginView"));
const NotFoundView = lazy(() => import("@/views/NotFoundView"));
const ContactView = lazy(() => import("@/views/contact"));
const DiscoverView = lazy(() => import("@/views/discover"));
const FavoritesView = lazy(() => import("@/views/FavoritesView"));
const MatchesView = lazy(() => import("@/views/MatchesView"));
const DashboardView = lazy(() => import("@/views/DashboardView"));
const NameDetailView = lazy(() => import("@/views/NameDetailView"));
const SearchView = lazy(() => import("@/views/SearchView"));
const ForgotPasswordView = lazy(() => import("@/views/ForgotPasswordView"));
const ResetPasswordView = lazy(() => import("@/views/ResetPasswordView"));
const ChangePasswordView = lazy(() => import("@/views/ChangePasswordView"));

const routes: RouteObject[] = [
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeView /> },
      { path: "register", element: <CreateAccountView /> },
      { path: "login", element: <LoginView /> },
      { path: "forgot-password", element: <ForgotPasswordView /> },
      { path: "reset-password", element: <ResetPasswordView /> },
      { path: "about", element: <AboutView /> },
      // Signed-in users only. Keep in sync with MEMBERS_ONLY_PATHS in auth/config.ts,
      // which hides the matching header and footer links.
      {
        element: <RequireAuth />,
        children: [
          { path: "dashboard", element: <DashboardView /> },
          { path: "discover", element: <DiscoverView /> },
          // Matches is a demo-mode preview until partner linking is built.
          { path: "favorites", element: <FavoritesView /> },
          { path: "matches", element: <MatchesView /> },
          { path: "names/:name", element: <NameDetailView /> },
          { path: "search", element: <SearchView /> },
          { path: "account/password", element: <ChangePasswordView /> },
        ],
      },
      { path: "contact", element: <ContactView /> },
      // Any path not matched above, including links to pages that aren't built yet.
      { path: "*", element: <NotFoundView /> },
    ],
  },
];

// Created once, outside the component, so it isn't rebuilt on every render.
const router = createBrowserRouter(routes);

/** The whole app: shared providers around the router. */
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
