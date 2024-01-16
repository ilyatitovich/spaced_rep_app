import "./NewTopic.scss";
import Button from "../../components/Buttons/Button";
import { useState } from "react";
import { TopicModel } from "../../lib/models";

export default function NewTopic() {
    const [topicTitle, setTopicTitle] = useState<string>("");

    function handleSave() {
        const topic = new TopicModel(topicTitle);
        topic.setStartWeek();
        try {
            localStorage.setItem(topic.id, JSON.stringify(topic));
            setTopicTitle("");
        } catch (error) {
            console.error("Error when saving topic", (error as Error).message);
        }
    }

    return (
        <div className="screen new-topic">
            <nav>
                <Button asLink to="/">Back</Button>
                <Button asLink to="/" handleClick={handleSave}>Save</Button>
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
                />
            </div>
        </div>
    );
}
