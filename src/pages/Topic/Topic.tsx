import "./Topic.scss";
import { useLoaderData } from "react-router-dom";
import NavBar from "../../components/NavBar/NavBar";
import Button from "../../components/Buttons/Button";
import DayOfWeek from "../../components/DayOfWeek/DayOfWeek";
import LevelRow from "../../components/LevelRow/LevelRow";
import { type Level } from "../../lib/definitions";

interface LoaderParams {
    params: {
        topicId: string;
    };
}

export async function loader({ params }: LoaderParams) {
    const topic = await JSON.parse(localStorage.getItem(params.topicId)!);
    return { topic };
}

export default function TopicScreen() {
    const { topic } = useLoaderData();

    const { id, title, week, levels } = topic;

    function handleDelete(id: string) {
        localStorage.removeItem(id);
    }

    return (
        <div className="topic">
            <header>
                <NavBar justifyContent="space-between">
                    <Button asLink to="/" title="Back" />
                    <h4 className="title">{title}</h4>
                    <Button
                        asLink
                        to="/"
                        title="Delete"
                        handleClick={() => handleDelete(id)}
                    />
                </NavBar>
                <div className="week">
                    {week.map(() => (
                        <DayOfWeek />
                    ))}
                </div>
            </header>
            <main className="content">
                <div className="add-card-wrapper">
                    <h3>Levels</h3>
                    <Button
                        title="Add Card"
                        handleClick={() => alert("add card")}
                    />
                </div>
                <div className="levels">
                    <ul>
                        {levels.map((level: Level) => (
                            <LevelRow level={level} />
                        ))}
                    </ul>
                </div>
            </main>
        </div>
    );
}
