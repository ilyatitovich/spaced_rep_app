import "./App.scss";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import AddNewTopic from "./pages/AddNewTopic/AddNewTopic";

export default function App() {
    return (
        <Routes>
            <Route path="/">
                <Route index element={<Home />} />
                <Route path="new-topic" element={<AddNewTopic />} />

                {/* <Route path="*" element={<NoMatch />} /> */}
            </Route>
        </Routes>
    );
}
