import "@radix-ui/themes/styles.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";
import "./styles.css";

const el = document.getElementById("root");
if (!el) {
  throw new Error('Missing root element: <div id="root" />');
}

const router = getRouter();

createRoot(el).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);


