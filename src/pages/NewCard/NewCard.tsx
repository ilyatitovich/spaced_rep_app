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
    const { id, levels, draft } = topic;
    const firstLevelCards = levels[0].cards;

    const navigate = useNavigate();
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [cardData, setCardData] = useState({ front: "", back: "" });
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isEdited, setIsEdited] = useState<boolean>(false);
    const [isDraft, setIsDraft] = useState<boolean>(true);

    const cardDataIsExist = cardData.front && cardData.back;

    const leftBtn = isDraft ? (
        isEdited ? (
            <button key="done" onClick={() => setIsEdited(false)}>
                Done
            </button>
        ) : (
            <button
                key="save-draft"
                onClick={() => handleSaveCard("draft")}
                disabled={!!cardData.front === false}
            >
                Save Draft
            </button>
        )
    ) : isEdited ? (
        <button key="done" onClick={() => setIsEdited(false)}>
            Done
        </button>
    ) : (
        <button key="save" onClick={() => handleSaveCard("new")}>
            Save
        </button>
    );

    useEffect(() => {
        if (cardDataIsExist) {
            setIsDraft(false);
        } else {
            setIsDraft(true);
        }
    }, [cardDataIsExist]);

    useEffect(() => {
        let timer: NodeJS.Timeout;

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

    function handleSaveCard(cardStatus: "new" | "draft") {
        const cardForSave = {
            id: firstLevelCards.length,
            level: 0,
            ...cardData,
        };

        if (cardStatus === "new") {
            firstLevelCards.push(cardForSave);
        } else {
            draft.push(cardForSave);
        }

        localStorage.setItem(id, JSON.stringify(topic));
        setIsSaving(true);
        setCardData({ front: "", back: "" });
        setIsFlipped(false);
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
                <p>{isFlipped ? "Back" : "Front"}</p>
                {/* {isEdited ? (
                    <Button key="done" handleClick={() => setIsEdited(false)}>
                        Done
                    </Button>
                ) : (
                    <Button key="save" handleClick={saveCard}>
                        Save
                    </Button>
                )} */}
                {leftBtn}
            </nav>
            <div className="card-container">
                {!isSaving && (
                    <Card
                        data={cardData}
                        isFlipped={isFlipped}
                        isEditable={true}
                        handleFocus={() => setIsEdited(true)}
                        handleBlur={() => setIsEdited(false)}
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
