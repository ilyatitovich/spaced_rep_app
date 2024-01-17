import "./NewTopic.scss";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Buttons/Button";
import { useState } from "react";
import { TopicModel } from "../../lib/models";

export default function NewTopic() {
    const navigate = useNavigate();
    const [topicTitle, setTopicTitle] = useState<string>("");

    function handleSave() {
        const topic = new TopicModel(topicTitle);
        topic.setStartWeek();
        localStorage.setItem(topic.id, JSON.stringify(topic));
        navigate(-1);
    }

    return (
        <div className="screen new-topic">
            <nav>
                <Button asLink to="/">
                    Back
                </Button>
                <Button handleClick={handleSave}>Save</Button>
            </nav>
            <div className="input-container">
                <label htmlFor="topic-title">
                    What are you going to learn?
                </label>
                <input
                    name="title"
                    type="text"
                    value={topicTitle}
                    maxLength={10}
                    onChange={(event) =>
                        setTopicTitle(event.currentTarget.value)
                    }
                    onKeyDown={(event) => event.key === "Enter" && handleSave()}
                />
            </div>
        </div>
    );
}
