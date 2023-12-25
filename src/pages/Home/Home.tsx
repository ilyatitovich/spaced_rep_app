import "./Home.scss";
import { useState, useEffect } from "react";
import NavBar from "../../components/NavBar/NavBar";
import TopicsList from "../../components/TopicsList/TopicsList";
import Button from "../../components/Buttons/Button";

import { getAllTopics } from "../../lib/utils";

export default function Home() {
    const [topics, setTopics] = useState<{ id: string; title: string }[]>([]);

    useEffect(() => {
        const topicsFromLocalStorage = getAllTopics();
        setTopics(topicsFromLocalStorage);
    }, []);

    console.log(topics);

    return (
        <div id="start-screen-container">
            <NavBar justifyContent="center">
                <p>Your Topics</p>
            </NavBar>

            <TopicsList topics={topics} />

            <footer>
                <Button asLink to="new-topic" title="Add Topic" />
            </footer>
        </div>
    );
}
