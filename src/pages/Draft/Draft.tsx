import "./Draft.scss";
import { type Card } from "../../lib/definitions";
import {
    type LoaderFunctionArgs,
    useLoaderData,
    useNavigate,
    Link,
} from "react-router-dom";
import { getDraftCards } from "../../lib/utils";
import Button from "../../components/Buttons/Button";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const draftCards = await getDraftCards(params.topicId as string);
    return { draftCards };
}

export default function Draft() {
    const { draftCards } = useLoaderData() as {
        draftCards: Card[];
    };
    const navigate = useNavigate();
    return (
        <div className="screen draft">
            <nav>
                <Button handleClick={() => navigate(-1)}>Back</Button>
                <p className="title">Draft</p>
            </nav>
            <div className="cards-list">
                {draftCards.length > 0 &&
                    draftCards.map((card, index) => (
                        <Link
                            key={card.id * Math.random()}
                            to={`${index}/edit`}
                            className="card"
                        >
                            <small>{card.front}</small>
                        </Link>
                    ))}
                <div className="message">
                    <p>Cards with only one side are saved as drafts.</p>
                </div>
            </div>
        </div>
    );
}
