import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import Environment from "./Environment.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(<Environment />);
