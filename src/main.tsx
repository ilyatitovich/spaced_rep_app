import "./index.scss";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home, { loader as homeLoader } from "./pages/Home/Home";
import NewTopic from "./pages/NewTopic/NewTopic";
// import NewCard from "./pages/NewCard/NewCard";
import Topic, { loader as topicLoader } from "./pages/Topic/Topic";

const router = createBrowserRouter([
    {
        path: "/",
        element: <Home />,
        loader: homeLoader,
    },
    {
        path: "new-topic",
        element: <NewTopic />,
    },
    // {
    //     path: "new-card",
    //     element: <NewCard />,
    // },
    {
        path: "topic/:topicId",
        element: <Topic />,
        loader: topicLoader,
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
