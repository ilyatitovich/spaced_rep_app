import "./index.scss";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home, { loader as homeLoader } from "./pages/Home/Home";
import NewTopic from "./pages/NewTopic/NewTopic";
import Topic, { loader as topicLoader } from "./pages/Topic/Topic";
import NewCard, { loader as newCardLoader } from "./pages/NewCard/NewCard";
import Test, { loader as testLoader } from "./pages/Test/Test";

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
    {
        path: "topic/:topicId",
        element: <Topic />,
        loader: topicLoader,
    },
    {
        path: "topic/:topicId/new-card",
        element: <NewCard />,
        loader: newCardLoader,
    },
    {
        path: "topic/:topicId/test",
        element: <Test />,
        loader: testLoader,
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
