import "./Home.scss";

import { Link, useLoaderData } from "react-router-dom";

import { TopicItem } from "../../lib/definitions";
import { getTopicsList } from "../../lib/utils";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader() {
    const topics: TopicItem[] = getTopicsList();
    return { topics };
}

export default function Home() {
    const { topics } = useLoaderData() as { topics: TopicItem[] };

    return (
        <div className="home">
            <nav>
                <p>Topics</p>
            </nav>
            <div className="content">
                {topics.length > 0 ? (
                    <div className="topics">
                        <ul>
                            {topics.map((topic) => (
                                <li key={topic.id}>
                                    <Link
                                        to={`topic/${topic.id}`}
                                        className="topic"
                                    >
                                        {topic.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="message">
                        <p>No topics to study yet</p>
                    </div>
                )}
            </div>
            <footer>
                <Link to="new-topic">Add Topic</Link>
            </footer>
        </div>
    );
}
