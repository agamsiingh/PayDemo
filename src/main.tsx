import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Checkout from "./pages/Checkout";
import Status from "./pages/Status";
import Inspector from "./pages/Inspector";
import Admin from "./pages/Admin";
import Guide from "./pages/Guide";
import FakeCashier from "./pages/FakeCashier";
import NotFound from "./pages/NotFound";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/checkout/:productId" element={<Checkout />} />
          <Route path="/status/:merchantOrderNo" element={<Status />} />
          <Route path="/how-it-works" element={<Inspector />} />
          <Route path="/how-it-works/:merchantOrderNo" element={<Inspector />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/fake-cashier/:merchantOrderNo" element={<FakeCashier />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
