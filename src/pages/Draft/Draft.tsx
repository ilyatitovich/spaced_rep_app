import "./Draft.scss";
import { Card } from "../../lib/definitions";
import {
    LoaderFunctionArgs,
    useLoaderData,
    useNavigate,
} from "react-router-dom";
import { getLevelCards } from "../../lib/utils";
import CardsListContainer from "../../components/CardsListContainer/CardsListContainer";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const draftCards = getLevelCards(params.topicId!, "draft");
    return { draftCards };
}

export default function Draft() {
    const navigate = useNavigate();
    const { draftCards } = useLoaderData() as {
        draftCards: Card[];
    };

    return (
        <div className="draft">
            <nav>
                <button onClick={() => navigate(-1)}>Back</button>
                <p className="title">Draft</p>
            </nav>
            <CardsListContainer cardsFrom="draft" cardsList={draftCards}/>
        </div>
    );
}
