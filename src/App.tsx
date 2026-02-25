import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import ResolvePage from "./pages/ResolvePage";
import SearchPage from "./pages/SearchPage";
import ManufacturersPage from "./pages/ManufacturersPage";
import ProductsPage from "./pages/ProductsPage";
import ProgramsPage from "./pages/ProgramsPage";
import DptsPage from "./pages/DptsPage";
import StatsPage from "./pages/StatsPage";
import HealthPage from "./pages/HealthPage";
import IngestPage from "./pages/IngestPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/resolve" element={<ResolvePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/manufacturers" element={<ManufacturersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/programs" element={<ProgramsPage />} />
            <Route path="/dpts" element={<DptsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/ingest" element={<IngestPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
