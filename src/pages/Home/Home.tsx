import "./Home.scss";
import { TopicItem } from "../../lib/definitions";
import { Link, useLoaderData } from "react-router-dom";
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
            {topics.length > 0 ? (
                <div className="topics-list">
                    <ul>
                        {topics.map((item) => (
                            <li>
                                <Link
                                    key={item.title}
                                    to={`topic/${item.id}`}
                                    className="topic-item"
                                >
                                    {item.title}
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

            <footer>
                <Link to="new-topic">Add Topic</Link>
            </footer>
        </div>
    );
}
