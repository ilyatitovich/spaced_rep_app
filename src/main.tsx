import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home/Home";
import AddNewTopic from "./pages/AddNewTopic/AddNewTopic";
import TopicScreen, { loader as topicLoader } from "./pages/Topic/Topic";

const router = createBrowserRouter([
    {
        path: "/",
        element: <Home />,
    },
    {
        path: "new-topic",
        element: <AddNewTopic />,
    },
    {
        path: "topic/:topicId",
        element: <TopicScreen />,
        loader: topicLoader,
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
