import "./Home.scss";
import { Link, useLoaderData } from "react-router-dom";
import Button from "../../components/Buttons/Button";
import { getAllTopics } from "../../lib/utils";

interface TopicItem {
    id: string;
    title: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loader() {
    const topics = await getAllTopics();
    return { topics };
}

export default function Home() {
    const { topics } = useLoaderData() as { topics: TopicItem[] };

    return (
        <div className="screen home">
            <nav>
                <p>Your Topics</p>
            </nav>
            <div className="topics-list">
                {topics.length > 0 ? (
                    <ul>
                        {topics.map((item) => (
                            <Link
                                key={item.title}
                                to={`topic/${item.id}`}
                                className="topic-item"
                            >
                                {item.title}
                            </Link>
                        ))}
                    </ul>
                ) : (
                    <p className="message">No topics to study yet</p>
                )}
            </div>
            <footer>
                <Button asLink to="new-topic">
                    Add Topic
                </Button>
            </footer>
        </div>
    );
}
