import "./NewCard.scss";
import { type Topic } from "../../lib/definitions";
import {
    type LoaderFunctionArgs,
    useLoaderData,
    useNavigate,
} from "react-router-dom";
import { useState, useEffect, type ChangeEvent } from "react";
import { getTopic } from "../../lib/utils";
import Button from "../../components/Buttons/Button";
import Card from "../../components/Card/Card";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const topic = await getTopic(params.topicId as string);
    return { topic };
}

export default function NewCard() {
    const { topic } = useLoaderData() as { topic: Topic };
    const navigate = useNavigate();

    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [cardData, setCardData] = useState({ front: "", back: "" });
    const [isSaving, setIsSaving] = useState<boolean>(false);

    let timer: number;

    const { id, levels } = topic;
    const firstLevelCards = levels[0].cards;

    useEffect(() => {
        if (isSaving) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            timer = setTimeout(() => {
                setIsSaving(false);
            }, 100);
        }

        return () => {
            clearTimeout(timer);
        };
    }, [isSaving]);

    function handleChange(
        event: ChangeEvent<HTMLTextAreaElement>,
        side: "front" | "back"
    ) {
        switch (side) {
            case "front":
                setCardData({
                    ...cardData,
                    front: event.target.value,
                });
                break;
            case "back":
                setCardData({
                    ...cardData,
                    back: event.target.value,
                });
                break;
            default:
                return;
        }
    }

    function saveCard() {
        const newCard = {
            id: firstLevelCards.length,
            level: 0,
            ...cardData,
        };
        firstLevelCards.push(newCard);
        localStorage.setItem(id, JSON.stringify(topic));
        setIsSaving(true);
        setCardData({ front: "", back: "" });
    }

    return (
        <div className="screen new-card">
            <nav>
                <Button
                    handleClick={() => {
                        navigate(-1);
                    }}
                >
                    Back
                </Button>
                <h3>{isFlipped ? "Back" : "Front"}</h3>
                <Button handleClick={saveCard}>Save</Button>
            </nav>
            <div className="card-container">
                {!isSaving && (
                    <Card
                        data={cardData}
                        isFlipped={isFlipped}
                        isEditable={true}
                        handleChange={handleChange}
                    />
                )}
            </div>
            <footer>
                <Button handleClick={() => setIsFlipped(!isFlipped)}>
                    Flip
                </Button>
            </footer>
        </div>
    );
}
