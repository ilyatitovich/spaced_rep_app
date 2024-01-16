import "./NewCard.scss";
import NavBar from "../../components/NavBar/NavBar";
import Button from "../../components/Buttons/Button";
import Card from "../../components/Card/Card";

export default function NewCard() {
    return (
        <div className="new-card">
            <NavBar justifyContent="space-between">
                <Button asLink to="/">
                    Back
                </Button>
                <Button handleClick={() => alert("saved")}>Save</Button>
            </NavBar>
            <div className="card-container">
                <Card front="" back=""/>
            </div>
        </div>
    );
}
