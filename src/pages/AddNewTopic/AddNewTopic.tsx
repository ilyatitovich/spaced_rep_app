import "./AddNewTopic.scss";
import NavBar from "../../components/NavBar/NavBar";
import Button from "../../components/Buttons/Button";
import { useState } from "react";
import { Topic } from "../../lib/definitions";

export default function AddNewTopic() {
    const [topicTitle, setTopicTitle] = useState<string>("");

    function handleSave() {
        const topic = new Topic(topicTitle);
        topic.setStartWeek();
        try {
            localStorage.setItem(topic.id, JSON.stringify(topic));
            setTopicTitle("");
        } catch (error) {
            console.error("Error when saving topic", (error as Error).message);
        }
    }

    return (
        <div className="add-new-topic">
            <NavBar justifyContent="space-between">
                <Button asLink to="/" title="Cancel" />
                <Button title="Save" handleClick={handleSave} />
            </NavBar>
            <form>
                <label htmlFor="topic-title">
                    What are you going to learn?
                </label>
                <input
                    name="title"
                    type="text"
                    value={topicTitle}
                    onChange={(event) =>
                        setTopicTitle(event.currentTarget.value)
                    }
                />
            </form>
        </div>
    );
}
